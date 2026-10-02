use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};
use crate::{config_edit, paths, prompts, resources, roles, store};

const WS_DIR: &str = "workspaces";
const ACTIVE_FILE: &str = ".active";
const MANIFEST: &str = "workspace.json";
const MCP_FILE: &str = "mcp.json";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceEntry {
    pub name: String,
    pub updated_at: u64,
    pub active: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct Manifest {
    name: String,
    updated_at: u64,
    roles: BTreeMap<String, String>,
    cycle_order: Vec<String>,
    disabled_agents: Vec<String>,
    prompts_enabled: BTreeMap<String, bool>,
    resources_enabled: BTreeMap<String, BTreeMap<String, bool>>,
}

fn root() -> Result<PathBuf> {
    Ok(paths::store_dir()?.join(WS_DIR))
}

fn ws_dir(name: &str) -> Result<PathBuf> {
    Ok(root()?.join(name))
}

fn active_path() -> Result<PathBuf> {
    Ok(root()?.join(ACTIVE_FILE))
}

fn validate_name(name: &str) -> Result<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::validation("name", "workspace name is required"));
    }
    if name.contains(['/', '\\']) || name.contains("..") {
        return Err(AppError::validation(
            "name",
            "workspace name must not contain `/`, `\\`, or `..`",
        ));
    }
    Ok(name.to_string())
}

pub fn active() -> Result<Option<String>> {
    let path = active_path()?;
    match fs::read_to_string(&path) {
        Ok(text) => {
            let name = text.trim().to_string();
            if name.is_empty() {
                Ok(None)
            } else {
                Ok(Some(name))
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(AppError::fs(&path, e.to_string())),
    }
}

fn set_active(name: &str) -> Result<()> {
    let path = active_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::fs(parent, e.to_string()))?;
    }
    store::write_atomic(&path, name.as_bytes())
}

pub fn clear_active() -> Result<()> {
    let path = active_path()?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(AppError::fs(&path, e.to_string())),
    }
}

fn remove_if_exists(path: &Path) -> Result<()> {
    match fs::symlink_metadata(path) {
        Ok(m) => {
            if m.is_dir() && !m.file_type().is_symlink() {
                fs::remove_dir_all(path).map_err(|e| AppError::fs(path, e.to_string()))
            } else {
                fs::remove_file(path).map_err(|e| AppError::fs(path, e.to_string()))
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(AppError::fs(path, e.to_string())),
    }
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst).map_err(|e| AppError::fs(dst, e.to_string()))?;
    let entries = fs::read_dir(src).map_err(|e| AppError::fs(src, e.to_string()))?;
    for entry in entries {
        let entry = entry.map_err(|e| AppError::fs(src, e.to_string()))?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        let meta = fs::symlink_metadata(&from).map_err(|e| AppError::fs(&from, e.to_string()))?;
        remove_if_exists(&to)?;
        if meta.file_type().is_symlink() {
            let target = fs::read_link(&from).map_err(|e| AppError::fs(&from, e.to_string()))?;
            #[cfg(unix)]
            std::os::unix::fs::symlink(&target, &to)
                .map_err(|e| AppError::fs(&to, e.to_string()))?;
            #[cfg(windows)]
            {
                let is_dir = from.is_dir();
                if is_dir {
                    std::os::windows::fs::symlink_dir(&target, &to)
                } else {
                    std::os::windows::fs::symlink_file(&target, &to)
                }
                .map_err(|e| AppError::fs(&to, e.to_string()))?;
            }
        } else if meta.is_dir() {
            copy_dir_all(&from, &to)?;
        } else {
            fs::copy(&from, &to).map_err(|e| AppError::fs(&to, e.to_string()))?;
        }
    }
    Ok(())
}

fn copy_store_file(rel: &str, dst_dir: &Path) -> Result<()> {
    let src = paths::store_dir()?.join(rel);
    if !src.exists() {
        return Ok(());
    }
    let meta = fs::symlink_metadata(&src).map_err(|e| AppError::fs(&src, e.to_string()))?;
    let dst = dst_dir.join(rel);
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::fs(parent, e.to_string()))?;
    }
    remove_if_exists(&dst)?;
    if meta.is_dir() {
        copy_dir_all(&src, &dst)
    } else {
        fs::copy(&src, &dst).map_err(|e| AppError::fs(&dst, e.to_string()))?;
        Ok(())
    }
}

fn disabled_agents_now() -> Vec<String> {
    config_edit::read_json()
        .ok()
        .and_then(|root| root.get("task")?.get("disabledAgents")?.as_array().cloned())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

fn capture_into(dir: &Path, name: &str) -> Result<Manifest> {
    let agent = paths::agent_dir()?;
    let model_roles = roles::list()?;
    let mut prompts_enabled = BTreeMap::new();
    let mut resources_enabled: BTreeMap<String, BTreeMap<String, bool>> = BTreeMap::new();

    fs::create_dir_all(dir).map_err(|e| AppError::fs(dir, e.to_string()))?;

    copy_store_file(MCP_FILE, dir)?;
    for spec in prompts::PROMPTS {
        copy_store_file(spec.name, dir)?;
        let enabled = store::link_state(&agent, spec.name)
            .map(|s| s.kind == store::LinkKind::Managed)
            .unwrap_or(false);
        prompts_enabled.insert(spec.key.to_string(), enabled);
    }
    for spec in resources::RESOURCES {
        copy_store_file(spec.store_sub, dir)?;
        let mut items = BTreeMap::new();
        if let Ok(entries) = resources::list(&agent, spec.id) {
            for entry in entries {
                let enabled = if spec.id == "agents" {
                    !entry.agent_disabled
                } else {
                    entry.enabled
                };
                items.insert(entry.name, enabled);
            }
        }
        resources_enabled.insert(spec.id.to_string(), items);
    }

    let manifest = Manifest {
        name: name.to_string(),
        updated_at: store::now_ts(),
        roles: model_roles.roles,
        cycle_order: model_roles.cycle_order,
        disabled_agents: disabled_agents_now(),
        prompts_enabled,
        resources_enabled,
    };
    let text = serde_json::to_string_pretty(&manifest)?;
    store::write_atomic(&dir.join(MANIFEST), text.as_bytes())?;
    Ok(manifest)
}

fn read_manifest(dir: &Path) -> Result<Manifest> {
    let path = dir.join(MANIFEST);
    let text = fs::read_to_string(&path).map_err(|e| AppError::fs(&path, e.to_string()))?;
    serde_json::from_str(&text).map_err(|e| AppError::internal(format!("{}: {e}", path.display())))
}

fn apply_manifest(manifest: &Manifest, dir: &Path) -> Result<()> {
    let agent = paths::agent_dir()?;
    let store = paths::store_dir()?;

    store::adopt(&agent, store::CONFIG)?;
    let root = config_edit::read_json()?;
    let existing: Vec<String> = root
        .get("modelRoles")
        .and_then(|v| v.as_object())
        .map(|m| m.keys().cloned().collect())
        .unwrap_or_default();
    for key in existing {
        if !manifest.roles.contains_key(&key) {
            config_edit::remove_path(&["modelRoles", &key])?;
        }
    }
    for (role, selector) in &manifest.roles {
        config_edit::set_str(&["modelRoles", role], selector)?;
    }
    roles::set_cycle_order(&manifest.cycle_order)?;

    let raw = serde_json::to_string(&manifest.disabled_agents)?;
    config_edit::set_raw(&["task", "disabledAgents"], &raw)?;

    let snap_mcp = dir.join(MCP_FILE);
    let store_mcp = store.join(MCP_FILE);
    if snap_mcp.exists() {
        if store_mcp.exists() {
            let _ = store::backup_file(&store_mcp)?;
        }
        let bytes = fs::read(&snap_mcp).map_err(|e| AppError::fs(&snap_mcp, e.to_string()))?;
        store::write_atomic(&store_mcp, &bytes)?;
    } else if store_mcp.exists() {
        fs::remove_file(&store_mcp).map_err(|e| AppError::fs(&store_mcp, e.to_string()))?;
    }

    for spec in prompts::PROMPTS {
        let snap = dir.join(spec.name);
        let store_path = store.join(spec.name);
        if snap.exists() {
            if store_path.exists() {
                let _ = store::backup_file(&store_path)?;
            }
            let bytes = fs::read(&snap).map_err(|e| AppError::fs(&snap, e.to_string()))?;
            store::write_atomic(&store_path, &bytes)?;
        } else {
            let _ = store::detach(&agent, spec.name);
            if store_path.exists() {
                fs::remove_file(&store_path).map_err(|e| AppError::fs(&store_path, e.to_string()))?;
            }
            continue;
        }
        let enabled = manifest.prompts_enabled.get(spec.key).copied().unwrap_or(false);
        prompts::set_enabled(spec.key, enabled)?;
    }

    for spec in resources::RESOURCES {
        let snap_sub = dir.join(spec.store_sub);
        let store_sub = store.join(spec.store_sub);
        if store_sub.exists() || fs::symlink_metadata(&store_sub).is_ok() {
            let _ = store::archive_rel(spec.store_sub);
            let meta = fs::symlink_metadata(&store_sub);
            if let Ok(m) = meta {
                if m.is_dir() {
                    fs::remove_dir_all(&store_sub)
                        .map_err(|e| AppError::fs(&store_sub, e.to_string()))?;
                } else {
                    fs::remove_file(&store_sub)
                        .map_err(|e| AppError::fs(&store_sub, e.to_string()))?;
                }
            }
        }
        if snap_sub.exists() {
            copy_dir_all(&snap_sub, &store_sub)?;
        }
        if spec.id == "agents" {
            continue;
        }
        let wanted = manifest.resources_enabled.get(spec.id);
        let agent_sub = agent.join(spec.agent_sub);
        let mut present: Vec<String> = Vec::new();
        if let Ok(entries) = fs::read_dir(&agent_sub) {
            for entry in entries.flatten() {
                present.push(entry.file_name().to_string_lossy().into_owned());
            }
        }
        let mut names: Vec<String> = present;
        if let Some(w) = wanted {
            for name in w.keys() {
                if !names.contains(name) {
                    names.push(name.clone());
                }
            }
        }
        for name in names {
            let rel = format!("{}/{}", spec.agent_sub, name);
            let should = wanted
                .and_then(|w| w.get(&name))
                .copied()
                .unwrap_or(false);
            let state = store::link_state_rel(&agent, &rel)?;
            if should {
                if state.kind != store::LinkKind::Managed && store.join(&rel).exists() {
                    let _ = store::adopt_rel(&agent, &rel);
                }
            } else if state.kind == store::LinkKind::Managed {
                store::detach_rel(&agent, &rel)?;
            }
        }
    }
    Ok(())
}

fn entries() -> Result<Vec<WorkspaceEntry>> {
    let active_name = active()?;
    let root = root()?;
    let mut out = Vec::new();
    let Ok(dirs) = fs::read_dir(&root) else {
        return Ok(out);
    };
    for entry in dirs.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().into_owned();
        let updated_at = read_manifest(&path).map(|m| m.updated_at).unwrap_or(0);
        out.push(WorkspaceEntry {
            active: active_name.as_deref() == Some(&name),
            name,
            updated_at,
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub fn list() -> Result<Vec<WorkspaceEntry>> {
    entries()
}

pub fn create(name: &str) -> Result<Vec<WorkspaceEntry>> {
    let name = validate_name(name)?;
    let dir = ws_dir(&name)?;
    if dir.exists() {
        return Err(AppError::validation("name", "workspace already exists"));
    }
    capture_into(&dir, &name)?;
    set_active(&name)?;
    entries()
}

pub fn save(name: &str) -> Result<Vec<WorkspaceEntry>> {
    let name = validate_name(name)?;
    let dir = ws_dir(&name)?;
    if !dir.exists() {
        return Err(AppError::validation("name", "workspace not found"));
    }
    capture_into(&dir, &name)?;
    entries()
}

pub fn delete(name: &str) -> Result<Vec<WorkspaceEntry>> {
    let name = validate_name(name)?;
    let dir = ws_dir(&name)?;
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| AppError::fs(&dir, e.to_string()))?;
    }
    if active()?.as_deref() == Some(&name) {
        clear_active()?;
    }
    entries()
}

pub fn apply(name: &str) -> Result<WorkspaceEntry> {
    let name = validate_name(name)?;
    let dir = ws_dir(&name)?;
    if !dir.exists() {
        return Err(AppError::validation("name", "workspace not found"));
    }
    let manifest = read_manifest(&dir)?;
    apply_manifest(&manifest, &dir)?;
    set_active(&name)?;
    Ok(WorkspaceEntry {
        name,
        updated_at: manifest.updated_at,
        active: true,
    })
}

pub(crate) fn sync_active_quiet() {
    let name = match active() {
        Ok(Some(n)) => n,
        _ => return,
    };
    let dir = match ws_dir(&name) {
        Ok(d) => d,
        Err(_) => return,
    };
    if !dir.exists() {
        return;
    }
    if let Err(e) = capture_into(&dir, &name) {
        eprintln!("workspace sync failed: {e}");
    }
}

#[cfg(test)]
mod tests;
