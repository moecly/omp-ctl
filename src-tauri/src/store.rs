use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::os::unix::fs::symlink;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};
use crate::paths;

pub const MANAGED: [&str; 4] = ["SYSTEM.md", "APPEND_SYSTEM.md", "AGENTS.md", "RULES.md"];
pub const MODELS: &str = "models.yml";
pub const CONFIG: &str = "config.yml";

const META: &str = ".links.json";
const BACKUP_DIR: &str = "backup";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LinkKind {
    Absent,
    Managed,
    Unmanaged,
}

#[derive(Debug, Clone, Serialize)]
pub struct LinkState {
    pub path: PathBuf,
    pub kind: LinkKind,
    pub target: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkMeta {
    pub backup: String,
    pub adopted_at: u64,
}

pub fn now_ts() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn ensure_store() -> Result<PathBuf> {
    let store = paths::store_dir()?;
    fs::create_dir_all(store.join(BACKUP_DIR)).map_err(|e| AppError::fs(&store, e.to_string()))?;
    Ok(store)
}

/// Whether an absolute link target lives inside the store directory.
fn target_in_store(target: &Path, store: &Path) -> bool {
    let abs = if target.is_absolute() {
        target.to_path_buf()
    } else {
        // links are created absolute; a relative one is still ours if it resolves into the store
        target.to_path_buf()
    };
    abs == store.join(abs.file_name().unwrap_or_default()) || abs.starts_with(store)
}

/// Link state for a path described relative to both the agent and store roots.
pub fn link_state_rel(agent_root: &Path, rel: &str) -> Result<LinkState> {
    let path = agent_root.join(rel);
    let store = paths::store_dir()?;

    let meta = match fs::symlink_metadata(&path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Ok(LinkState {
                path,
                kind: LinkKind::Absent,
                target: None,
            })
        }
        Err(e) => return Err(AppError::fs(&path, e.to_string())),
    };

    if meta.file_type().is_symlink() {
        let target = fs::read_link(&path).map_err(|e| AppError::fs(&path, e.to_string()))?;
        if target_in_store(&target, &store) {
            return Ok(LinkState {
                path,
                kind: LinkKind::Managed,
                target: Some(target),
            });
        }
        return Ok(LinkState {
            path,
            kind: LinkKind::Unmanaged,
            target: Some(target),
        });
    }

    Ok(LinkState {
        path,
        kind: LinkKind::Unmanaged,
        target: None,
    })
}

pub fn link_state(agent: &Path, name: &str) -> Result<LinkState> {
    link_state_rel(agent, name)
}

fn write_link_rel(agent_root: &Path, rel: &str) -> Result<()> {
    let store = ensure_store()?;
    let dst = agent_root.join(rel);
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::fs(parent, e.to_string()))?;
    }
    let target = store.join(rel);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::fs(parent, e.to_string()))?;
    }
    symlink(target, &dst).map_err(|e| AppError::fs(&dst, e.to_string()))?;
    Ok(())
}

fn read_meta_raw() -> Result<BTreeMap<String, LinkMeta>> {
    let path = paths::store_dir()?.join(META);
    match fs::read_to_string(&path) {
        Ok(text) if !text.trim().is_empty() => serde_json::from_str(&text)
            .map_err(|e| AppError::internal(format!("{}: {e}", path.display()))),
        _ => Ok(BTreeMap::new()),
    }
}

pub fn write_meta(meta: &BTreeMap<String, LinkMeta>) -> Result<()> {
    let store = ensure_store()?;
    let text = serde_json::to_string_pretty(meta)?;
    write_atomic(&store.join(META), text.as_bytes())
}

pub fn read_meta_public() -> Result<BTreeMap<String, LinkMeta>> {
    read_meta_raw()
}

pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let dir = path.parent().unwrap_or(Path::new("."));
    fs::create_dir_all(dir).map_err(|e| AppError::fs(dir, e.to_string()))?;
    let tmp = dir.join(format!(".tmp-{}-{}", now_ts(), std::process::id()));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| AppError::fs(&tmp, e.to_string()))?;
        f.write_all(bytes)
            .map_err(|e| AppError::fs(&tmp, e.to_string()))?;
        f.sync_all()
            .map_err(|e| AppError::fs(&tmp, e.to_string()))?;
    }
    fs::rename(&tmp, path).map_err(|e| AppError::fs(path, e.to_string()))?;
    Ok(())
}

pub fn backup_path(name: &str) -> Result<PathBuf> {
    ensure_store()?;
    let store = paths::store_dir()?;
    let ts = now_ts();
    let dir = store.join(BACKUP_DIR).join(name);
    if let Some(parent) = dir.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::fs(parent, e.to_string()))?;
    }
    let mut candidate = PathBuf::from(format!("{}.{ts}", dir.display()));
    let mut n = 1;
    while candidate.exists() {
        candidate = PathBuf::from(format!("{}.{ts}.{n}", dir.display()));
        n += 1;
    }
    Ok(candidate)
}

/// Copy a directory tree, copying files and rebuilding symlinks verbatim.
fn copy_dir_all(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst).map_err(|e| AppError::fs(dst, e.to_string()))?;
    let entries = fs::read_dir(src).map_err(|e| AppError::fs(src, e.to_string()))?;
    for entry in entries {
        let entry = entry.map_err(|e| AppError::fs(src, e.to_string()))?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        let meta = fs::symlink_metadata(&from).map_err(|e| AppError::fs(&from, e.to_string()))?;
        if meta.file_type().is_symlink() {
            let target = fs::read_link(&from).map_err(|e| AppError::fs(&from, e.to_string()))?;
            symlink(target, &to).map_err(|e| AppError::fs(&to, e.to_string()))?;
        } else if meta.is_dir() {
            copy_dir_all(&from, &to)?;
        } else {
            fs::copy(&from, &to).map_err(|e| AppError::fs(&from, e.to_string()))?;
        }
    }
    Ok(())
}

/// Take over the entity at `agent_root/rel`.
///
/// Absent    -> create the link.
/// Managed   -> no-op.
/// Unmanaged -> copy the existing entity (file or directory) into the store,
///              move the original entity into `store/backup/`, then create the link.
pub fn adopt_rel(agent_root: &Path, rel: &str) -> Result<LinkState> {
    ensure_store()?;
    let state = link_state_rel(agent_root, rel)?;
    match state.kind {
        LinkKind::Managed => Ok(state),
        LinkKind::Absent => {
            write_link_rel(agent_root, rel)?;
            link_state_rel(agent_root, rel)
        }
        LinkKind::Unmanaged => {
            let src = agent_root.join(rel);
            let store = paths::store_dir()?;
            let dst = store.join(rel);
            if let Some(parent) = dst.parent() {
                fs::create_dir_all(parent).map_err(|e| AppError::fs(parent, e.to_string()))?;
            }

            let meta = fs::metadata(&src).map_err(|e| AppError::fs(&src, e.to_string()))?;
            if meta.is_dir() {
                copy_dir_all(&src, &dst)?;
            } else {
                // reading follows symlinks; an unreadable/dangling entry aborts before any mutation
                let bytes = fs::read(&src).map_err(|e| AppError::fs(&src, e.to_string()))?;
                write_atomic(&dst, &bytes)?;
            }

            let backup = backup_path(rel)?;
            fs::rename(&src, &backup).map_err(|e| AppError::fs(&src, e.to_string()))?;

            write_link_rel(agent_root, rel)?;

            let mut meta = read_meta_raw()?;
            meta.insert(
                rel.to_string(),
                LinkMeta {
                    backup: backup.to_string_lossy().into_owned(),
                    adopted_at: now_ts(),
                },
            );
            write_meta(&meta)?;

            link_state_rel(agent_root, rel)
        }
    }
}

pub fn adopt(agent: &Path, name: &str) -> Result<LinkState> {
    adopt_rel(agent, name)
}

/// Remove the link only when it points into the store; never touch foreign files.
pub fn detach_rel(agent_root: &Path, rel: &str) -> Result<()> {
    let state = link_state_rel(agent_root, rel)?;
    if state.kind == LinkKind::Managed {
        let meta = fs::symlink_metadata(&state.path)
            .map_err(|e| AppError::fs(&state.path, e.to_string()))?;
        if meta.is_dir() {
            fs::remove_dir_all(&state.path)
                .map_err(|e| AppError::fs(&state.path, e.to_string()))?;
        } else {
            fs::remove_file(&state.path).map_err(|e| AppError::fs(&state.path, e.to_string()))?;
        }
    }
    Ok(())
}

pub fn detach(agent: &Path, name: &str) -> Result<()> {
    detach_rel(agent, name)
}

pub fn has_backup_rel(rel: &str) -> Result<bool> {
    let meta = read_meta_raw()?;
    match meta.get(rel) {
        Some(entry) => Ok(Path::new(&entry.backup).exists()),
        None => Ok(false),
    }
}

pub fn has_backup(name: &str) -> Result<bool> {
    has_backup_rel(name)
}

/// Move the pre-adoption entity back to `agent_root/rel`. The store copy is preserved.
pub fn restore_backup_rel(agent_root: &Path, rel: &str) -> Result<()> {
    let mut meta = read_meta_raw()?;
    let entry = meta
        .get(rel)
        .cloned()
        .ok_or_else(|| AppError::validation(rel, "no adoption backup recorded"))?;

    let backup = PathBuf::from(&entry.backup);
    if !backup.exists() {
        return Err(AppError::fs(&backup, "recorded backup is missing"));
    }

    let dst = agent_root.join(rel);
    match fs::symlink_metadata(&dst) {
        Ok(m) => {
            if m.is_dir() {
                fs::remove_dir_all(&dst).map_err(|e| AppError::fs(&dst, e.to_string()))?;
            } else {
                fs::remove_file(&dst).map_err(|e| AppError::fs(&dst, e.to_string()))?;
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(AppError::fs(&dst, e.to_string())),
    }

    fs::rename(&backup, &dst).map_err(|e| AppError::fs(&dst, e.to_string()))?;

    meta.remove(rel);
    write_meta(&meta)?;
    Ok(())
}

pub fn restore_backup(agent: &Path, name: &str) -> Result<()> {
    restore_backup_rel(agent, name)
}

/// Move the store entity at `rel` into `backup/` (recording the move) and return the backup path.
/// The agent-side link, if any, is left for the caller to `detach_rel`.
pub fn archive_rel(rel: &str) -> Result<PathBuf> {
    ensure_store()?;
    let store = paths::store_dir()?;
    let src = store.join(rel);
    if !src.exists() {
        return Err(AppError::fs(&src, "not found"));
    }

    let backup = backup_path(rel)?;
    fs::rename(&src, &backup).map_err(|e| AppError::fs(&src, e.to_string()))?;

    let mut meta = read_meta_raw()?;
    meta.insert(
        rel.to_string(),
        LinkMeta {
            backup: backup.to_string_lossy().into_owned(),
            adopted_at: now_ts(),
        },
    );
    write_meta(&meta)?;
    Ok(backup)
}

pub fn write_content(name: &str, text: &str) -> Result<PathBuf> {
    let store = ensure_store()?;
    let path = store.join(name);
    write_atomic(&path, text.as_bytes())?;
    Ok(path)
}

pub fn read_content(name: &str) -> Result<String> {
    let store = paths::store_dir()?;
    let path = store.join(name);
    fs::read_to_string(&path).map_err(|e| AppError::fs(&path, e.to_string()))
}

pub fn store_file(name: &str) -> Result<PathBuf> {
    Ok(paths::store_dir()?.join(name))
}

/// Copy `<path>` to `<path>.bak.<ts>` and return the backup path.
pub fn backup_file(path: &Path) -> Result<PathBuf> {
    let ts = now_ts();
    let mut candidate = PathBuf::from(format!("{}.bak.{ts}", path.display()));
    let mut n = 1;
    while candidate.exists() {
        candidate = PathBuf::from(format!("{}.bak.{ts}.{n}", path.display()));
        n += 1;
    }
    fs::copy(path, &candidate).map_err(|e| AppError::fs(path, e.to_string()))?;
    Ok(candidate)
}

fn snapshot_entries() -> Vec<String> {
    let mut out: Vec<String> = vec![
        CONFIG.to_string(),
        MODELS.to_string(),
        crate::mcp::MCP_FILE.to_string(),
        META.to_string(),
    ];
    for name in MANAGED {
        out.push(name.to_string());
    }
    for spec in crate::resources::RESOURCES {
        out.push(spec.store_sub.to_string());
    }
    out
}

fn run_tar(dir: &Path, args: &[String]) -> Result<()> {
    let out = std::process::Command::new("tar")
        .args(args)
        .current_dir(dir)
        .output()
        .map_err(|e| AppError::internal(format!("tar: {e}")))?;
    if !out.status.success() {
        return Err(AppError::internal(format!(
            "tar: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        )));
    }
    Ok(())
}

pub fn export_snapshot() -> Result<PathBuf> {
    let store = ensure_store()?;
    let dest = store
        .join(BACKUP_DIR)
        .join(format!("migrate-{}.tar.gz", now_ts()));
    let mut present: Vec<String> = snapshot_entries()
        .into_iter()
        .filter(|rel| store.join(rel).exists())
        .collect();
    if present.is_empty() {
        return Err(AppError::fs(&store, "nothing to back up"));
    }
    present.sort();
    let mut args = vec![
        "-czf".to_string(),
        dest.to_string_lossy().into_owned(),
    ];
    args.extend(present);
    run_tar(&store, &args)?;
    Ok(dest)
}

pub fn import_snapshot(path: &Path) -> Result<()> {
    if !path.is_file() {
        return Err(AppError::fs(path, "snapshot not found"));
    }
    let store = ensure_store()?;
    let tmp = store
        .join(BACKUP_DIR)
        .join(format!(".import-{}-{}", now_ts(), std::process::id()));
    if tmp.exists() {
        fs::remove_dir_all(&tmp).map_err(|e| AppError::fs(&tmp, e.to_string()))?;
    }
    fs::create_dir_all(&tmp).map_err(|e| AppError::fs(&tmp, e.to_string()))?;
    let cleanup = |r: Result<()>| {
        if r.is_err() {
            fs::remove_dir_all(&tmp).ok();
        }
        r
    };
    let extracted = (|| {
        run_tar(
            &tmp,
            &["-xzf".to_string(), path.to_string_lossy().into_owned()],
        )?;
        let mut staged: Vec<String> = Vec::new();
        for rel in snapshot_entries() {
            let src = tmp.join(&rel);
            if !src.exists() {
                continue;
            }
            if fs::symlink_metadata(&src)
                .map(|m| m.file_type().is_symlink())
                .unwrap_or(false)
            {
                return Err(AppError::validation(
                    "snapshot",
                    format!("refusing symlink entry `{rel}`"),
                ));
            }
            if src.is_dir()
                && !crate::resources::RESOURCES
                    .iter()
                    .any(|s| s.store_sub == rel)
            {
                continue;
            }
            staged.push(rel);
        }
        if staged.is_empty() {
            return Err(AppError::validation(
                "snapshot",
                "snapshot contains no known entries",
            ));
        }
        for rel in &staged {
            let src = tmp.join(rel);
            let dst = store.join(rel);
            if src.is_dir() {
                if dst.exists() {
                    let bak = backup_path(rel)?;
                    fs::rename(&dst, &bak).map_err(|e| AppError::fs(&dst, e.to_string()))?;
                }
                copy_dir_all(&src, &dst)?;
            } else {
                if dst.is_file() {
                    backup_file(&dst)?;
                }
                let bytes = fs::read(&src).map_err(|e| AppError::fs(&src, e.to_string()))?;
                write_atomic(&dst, &bytes)?;
            }
        }
        let agent = paths::agent_dir()?;
        for rel in &staged {
            if rel == META {
                continue;
            }
            let agent_path = agent.join(rel);
            let target = store.join(rel);
            if !target.exists() {
                continue;
            }
            match fs::symlink_metadata(&agent_path) {
                Ok(m) if m.file_type().is_symlink() => {
                    let cur =
                        fs::read_link(&agent_path).map_err(|e| AppError::fs(&agent_path, e.to_string()))?;
                    if target_in_store(&cur, &store) {
                        continue;
                    }
                    fs::remove_file(&agent_path).map_err(|e| AppError::fs(&agent_path, e.to_string()))?;
                }
                Ok(m) if m.is_dir() => {
                    let bak = backup_path(rel)?;
                    fs::rename(&agent_path, &bak).map_err(|e| AppError::fs(&agent_path, e.to_string()))?;
                }
                Ok(_) => {
                    backup_file(&agent_path)?;
                    fs::remove_file(&agent_path).map_err(|e| AppError::fs(&agent_path, e.to_string()))?;
                }
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => return Err(AppError::fs(&agent_path, e.to_string())),
            }
            if let Some(parent) = agent_path.parent() {
                fs::create_dir_all(parent).map_err(|e| AppError::fs(parent, e.to_string()))?;
            }
            if fs::symlink_metadata(&agent_path).is_err() {
                symlink(target, &agent_path).map_err(|e| AppError::fs(&agent_path, e.to_string()))?;
            }
        }
        Ok(())
    })();
    let r = cleanup(extracted);
    fs::remove_dir_all(&tmp).ok();
    r
}

#[cfg(test)]
mod tests;
