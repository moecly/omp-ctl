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

pub fn link_state(agent: &Path, name: &str) -> Result<LinkState> {
    let path = agent.join(name);
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

fn write_link(agent: &Path, name: &str) -> Result<()> {
    let store = ensure_store()?;
    let dst = agent.join(name);
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::fs(parent, e.to_string()))?;
    }
    symlink(store.join(name), &dst).map_err(|e| AppError::fs(&dst, e.to_string()))?;
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
        f.write_all(bytes).map_err(|e| AppError::fs(&tmp, e.to_string()))?;
        f.sync_all().map_err(|e| AppError::fs(&tmp, e.to_string()))?;
    }
    fs::rename(&tmp, path).map_err(|e| AppError::fs(path, e.to_string()))?;
    Ok(())
}

pub fn backup_path(name: &str) -> Result<PathBuf> {
    ensure_store()?;
    let store = paths::store_dir()?;
    let ts = now_ts();
    let mut candidate = store.join(BACKUP_DIR).join(format!("{name}.{ts}"));
    let mut n = 1;
    while candidate.exists() {
        candidate = store.join(BACKUP_DIR).join(format!("{name}.{ts}.{n}"));
        n += 1;
    }
    Ok(candidate)
}

/// Take over `agent/name`.
///
/// Absent    -> create the link.
/// Managed   -> no-op.
/// Unmanaged -> read content through any existing file/symlink, copy it into the store,
///              move the original entity into `store/backup/`, then create the link.
pub fn adopt(agent: &Path, name: &str) -> Result<LinkState> {
    ensure_store()?;
    let state = link_state(agent, name)?;
    match state.kind {
        LinkKind::Managed => Ok(state),
        LinkKind::Absent => {
            write_link(agent, name)?;
            link_state(agent, name)
        }
        LinkKind::Unmanaged => {
            let src = agent.join(name);
            // reading follows symlinks; an unreadable/dangling entry aborts before any mutation
            let bytes = fs::read(&src).map_err(|e| AppError::fs(&src, e.to_string()))?;

            let store = paths::store_dir()?;
            write_atomic(&store.join(name), &bytes)?;

            let backup = backup_path(name)?;
            fs::rename(&src, &backup).map_err(|e| AppError::fs(&src, e.to_string()))?;

            write_link(agent, name)?;

            let mut meta = read_meta_raw()?;
            meta.insert(
                name.to_string(),
                LinkMeta {
                    backup: backup.to_string_lossy().into_owned(),
                    adopted_at: now_ts(),
                },
            );
            write_meta(&meta)?;

            link_state(agent, name)
        }
    }
}

/// Remove the link only when it points into the store; never touch foreign files.
pub fn detach(agent: &Path, name: &str) -> Result<()> {
    let state = link_state(agent, name)?;
    if state.kind == LinkKind::Managed {
        fs::remove_file(&state.path).map_err(|e| AppError::fs(&state.path, e.to_string()))?;
    }
    Ok(())
}

pub fn has_backup(name: &str) -> Result<bool> {
    let meta = read_meta_raw()?;
    match meta.get(name) {
        Some(entry) => Ok(Path::new(&entry.backup).exists()),
        None => Ok(false),
    }
}

/// Move the pre-adoption entity back to `agent/name`. The store copy is preserved.
pub fn restore_backup(agent: &Path, name: &str) -> Result<()> {
    let mut meta = read_meta_raw()?;
    let entry = meta
        .get(name)
        .cloned()
        .ok_or_else(|| AppError::validation(name, "no adoption backup recorded"))?;

    let backup = PathBuf::from(&entry.backup);
    if !backup.exists() {
        return Err(AppError::fs(&backup, "recorded backup is missing"));
    }

    let dst = agent.join(name);
    match fs::symlink_metadata(&dst) {
        Ok(_) => {
            fs::remove_file(&dst).map_err(|e| AppError::fs(&dst, e.to_string()))?;
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(AppError::fs(&dst, e.to_string())),
    }

    fs::rename(&backup, &dst).map_err(|e| AppError::fs(&dst, e.to_string()))?;

    meta.remove(name);
    write_meta(&meta)?;
    Ok(())
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

#[cfg(test)]
mod tests;

