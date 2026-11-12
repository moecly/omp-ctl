use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};
use crate::paths;

#[cfg(unix)]
fn symlink(target: &Path, link: &Path, _is_dir: bool) -> std::io::Result<()> {
    std::os::unix::fs::symlink(target, link)
}

#[cfg(windows)]
fn symlink(target: &Path, link: &Path, is_dir: bool) -> std::io::Result<()> {
    if is_dir {
        std::os::windows::fs::symlink_dir(target, link)
    } else {
        std::os::windows::fs::symlink_file(target, link)
    }
}

/// Directory link that needs no privilege on Windows.
///
/// `CreateSymbolicLink` requires SeCreateSymbolicLinkPrivilege unless the machine
/// is in Developer Mode, so a normal user gets ERROR_PRIVILEGE_NOT_HELD. A
/// directory junction (`mklink /J`) has no such requirement and is still a real
/// reparse point, so omp and this app both follow it transparently.
#[cfg(windows)]
fn junction(target: &Path, link: &Path) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut cmd = std::process::Command::new("cmd");
    cmd.args(["/C", "mklink", "/J"])
        .arg(link)
        .arg(target)
        .creation_flags(CREATE_NO_WINDOW);
    let out = cmd.output()?;
    if out.status.success() {
        return Ok(());
    }
    Err(std::io::Error::other(
        String::from_utf8_lossy(&out.stderr).trim().to_string(),
    ))
}

#[cfg(not(windows))]
fn junction(target: &Path, link: &Path) -> std::io::Result<()> {
    symlink(target, link, true)
}

/// `Copy` entries are real files in the agent directory rather than links.
///
/// Without symlink privilege the link model cannot exist on Windows, so the
/// agent path holds a copy and `sync_copies` keeps both sides equal.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum LinkMode {
    #[default]
    Symlink,
    Junction,
    Copy,
}

pub const MANAGED: [&str; 4] = ["SYSTEM.md", "APPEND_SYSTEM.md", "AGENTS.md", "RULES.md"];
pub const MODELS: &str = "models.yml";
pub const CONFIG: &str = "config.yml";

const META: &str = ".links.json";
const BACKUP_DIR: &str = "backup";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum LinkKind {
    #[default]
    Absent,
    Managed,
    Unmanaged,
}

#[derive(Debug, Clone, Serialize)]
pub struct LinkState {
    pub path: PathBuf,
    pub kind: LinkKind,
    pub target: Option<PathBuf>,
    /// How a managed entry is realised; `None` when nothing is managed here.
    pub mode: Option<LinkMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LinkMeta {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub backup: Option<String>,
    pub adopted_at: u64,
    #[serde(default)]
    pub mode: LinkMode,
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

/// Read a reparse point that is not a name-surrogate symlink (a junction).
fn junction_target(path: &Path) -> Option<PathBuf> {
    if !cfg!(windows) {
        return None;
    }
    // std only treats name-surrogate tags as symlinks; junctions still resolve here.
    let meta = fs::symlink_metadata(path).ok()?;
    if !meta.is_dir() || meta.file_type().is_symlink() {
        return None;
    }
    fs::read_link(path).ok()
}

/// Link state for a path described relative to both the agent and store roots.
pub fn link_state_rel(agent_root: &Path, rel: &str) -> Result<LinkState> {
    let path = agent_root.join(rel);
    let store = paths::store_dir()?;
    let recorded = read_meta_raw()?.get(rel).map(|m| m.mode);

    let meta = match fs::symlink_metadata(&path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Ok(LinkState {
                path,
                kind: LinkKind::Absent,
                target: None,
                mode: recorded,
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
                mode: Some(LinkMode::Symlink),
            });
        }
        return Ok(LinkState {
            path,
            kind: LinkKind::Unmanaged,
            target: Some(target),
            mode: None,
        });
    }

    if let Some(target) = junction_target(&path) {
        let kind = if target_in_store(&target, &store) {
            LinkKind::Managed
        } else {
            LinkKind::Unmanaged
        };
        return Ok(LinkState {
            path,
            kind,
            target: Some(target),
            mode: Some(LinkMode::Junction),
        });
    }

    // A recorded `copy` entry is a managed entry whose content lives in both places.
    if recorded == Some(LinkMode::Copy) {
        return Ok(LinkState {
            path,
            kind: LinkKind::Managed,
            target: Some(store.join(rel)),
            mode: Some(LinkMode::Copy),
        });
    }

    Ok(LinkState {
        path,
        kind: LinkKind::Unmanaged,
        target: None,
        mode: recorded,
    })
}

pub fn link_state(agent: &Path, name: &str) -> Result<LinkState> {
    link_state_rel(agent, name)
}

fn privileged_error(e: &std::io::Error) -> bool {
    // ERROR_ACCESS_DENIED / ERROR_PRIVILEGE_NOT_HELD
    matches!(e.raw_os_error(), Some(5) | Some(1314))
}

fn create_entry(target: &Path, dst: &Path, is_dir: bool) -> Result<LinkMode> {
    match symlink(target, dst, is_dir) {
        Ok(()) => return Ok(LinkMode::Symlink),
        Err(e) if cfg!(windows) && privileged_error(&e) => {}
        Err(e) => return Err(AppError::fs(dst, e.to_string())),
    }
    if is_dir {
        junction(target, dst).map_err(|e| AppError::fs(dst, e.to_string()))?;
        return Ok(LinkMode::Junction);
    }
    copy_file(target, dst)?;
    Ok(LinkMode::Copy)
}

fn copy_file(from: &Path, to: &Path) -> Result<()> {
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::fs(parent, e.to_string()))?;
    }
    let bytes = fs::read(from).map_err(|e| AppError::fs(from, e.to_string()))?;
    write_atomic(to, &bytes)
}

fn write_link_rel(agent_root: &Path, rel: &str) -> Result<LinkMode> {
    let store = ensure_store()?;
    let dst = agent_root.join(rel);
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::fs(parent, e.to_string()))?;
    }
    let target = store.join(rel);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::fs(parent, e.to_string()))?;
    }
    let is_dir = target.is_dir();
    create_entry(&target, &dst, is_dir)
}

/// Keep a `copy`-mode entry equal to its store file.
///
/// omp writes the agent path directly, so either side can be the newer one:
/// a config change made by omp has to reach the store, and a store change made
/// through the GUI has to reach the agent file. Content decides and mtime breaks
/// the tie. A missing store file is rebuilt from the agent one; a missing agent
/// file is left alone, because that is how omp represents "disabled".
fn reconcile_copy(agent_path: &Path, store_path: &Path) -> Result<()> {
    // A missing agent file *is* the disabled state for omp, so never re-create
    // it here: doing so would silently re-enable a prompt or resource the user
    // (or the GUI) turned off.
    if !agent_path.exists() {
        return Ok(());
    }
    if !store_path.exists() {
        return copy_file(agent_path, store_path);
    }
    let agent_bytes = fs::read(agent_path).map_err(|e| AppError::fs(agent_path, e.to_string()))?;
    let store_bytes = fs::read(store_path).map_err(|e| AppError::fs(store_path, e.to_string()))?;
    if agent_bytes == store_bytes {
        return Ok(());
    }
    let modified = |p: &Path| fs::metadata(p).and_then(|m| m.modified()).ok();
    // A missing mtime on the store side means the store copy is the stale one.
    let agent_newer = match (modified(agent_path), modified(store_path)) {
        (Some(a), Some(b)) => a >= b,
        _ => true,
    };
    if agent_newer {
        write_atomic(store_path, &agent_bytes)
    } else {
        write_atomic(agent_path, &store_bytes)
    }
}

/// Bring every `copy`-mode entry back in sync. Called from read paths so a
/// change made by omp shows up in the GUI and vice versa.
pub fn sync_copies(agent_root: &Path) -> Result<()> {
    let store = paths::store_dir()?;
    for (rel, entry) in read_meta_raw()? {
        if entry.mode != LinkMode::Copy {
            continue;
        }
        if link_state_rel(agent_root, &rel)?.kind != LinkKind::Managed {
            continue;
        }
        reconcile_copy(&agent_root.join(&rel), &store.join(&rel))?;
    }
    Ok(())
}

/// Path holding the content of `rel`.
///
/// A symlinked or junctioned entry lives in the store. A `copy` entry lives at
/// the agent path, because that is the file omp reads and rewrites. An unmanaged
/// entry is edited in place and never silently adopted.
pub fn content_path(agent_root: &Path, rel: &str) -> Result<PathBuf> {
    let store = paths::store_dir()?;
    let state = link_state_rel(agent_root, rel)?;
    match (state.kind, state.mode) {
        (LinkKind::Managed, Some(LinkMode::Copy)) => {
            reconcile_copy(&state.path, &store.join(rel))?;
            Ok(state.path)
        }
        (LinkKind::Unmanaged, _) if state.path.exists() => Ok(state.path),
        _ => Ok(store.join(rel)),
    }
}

/// Whether `rel` is managed through a mirrored copy rather than a link.
pub fn is_copy_mode(agent_root: &Path, rel: &str) -> Result<bool> {
    let state = link_state_rel(agent_root, rel)?;
    Ok(state.kind == LinkKind::Managed && state.mode == Some(LinkMode::Copy))
}

/// Read a managed entry, reconciling a mirrored copy first.
pub fn read_managed(agent_root: &Path, rel: &str) -> Result<Option<String>> {
    let path = content_path(agent_root, rel)?;
    match fs::read_to_string(&path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(AppError::fs(&path, e.to_string())),
    }
}

/// Take an entry over and write `bytes` as its managed content.
///
/// Adopting first matters: `adopt_rel` copies the *existing* agent entity into
/// the store, so writing beforehand would be clobbered by the takeover.
pub fn persist_managed(agent_root: &Path, rel: &str, bytes: &[u8]) -> Result<()> {
    let store = ensure_store()?;
    let store_path = store.join(rel);
    let state = link_state_rel(agent_root, rel)?;
    match state.kind {
        LinkKind::Managed => {}
        LinkKind::Unmanaged => {
            adopt_rel(agent_root, rel)?;
        }
        LinkKind::Absent => {
            // Copy mode materialises the store file into the agent path, so the
            // store side has to exist before the entry can be adopted.
            if !store_path.exists() {
                if let Some(parent) = store_path.parent() {
                    fs::create_dir_all(parent).map_err(|e| AppError::fs(parent, e.to_string()))?;
                }
                write_atomic(&store_path, b"")?;
            }
            adopt_rel(agent_root, rel)?;
        }
    }
    write_managed(agent_root, rel, bytes)
}

/// Write an entry at the path that actually holds its content.
///
/// Link modes only need the store file: the agent path *is* that file. Copy mode
/// has two real files, so both are written and the agent copy is the one omp
/// reads next. An unmanaged entry is edited in place, matching `content_path`.
pub fn write_managed(agent_root: &Path, rel: &str, bytes: &[u8]) -> Result<()> {
    let path = content_path(agent_root, rel)?;
    write_atomic(&path, bytes)?;
    if is_copy_mode(agent_root, rel)? {
        write_atomic(&paths::store_dir()?.join(rel), bytes)?;
    }
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
            // Without symlink privilege the rebuild is a plain copy of the content,
            // which is what the caller asked for anyway outside link mode.
            match symlink(&target, &to, from.is_dir()) {
                Ok(()) => {}
                Err(e) if cfg!(windows) && privileged_error(&e) => {
                    if from.is_dir() {
                        copy_dir_all(&from, &to)?;
                    } else {
                        fs::copy(&from, &to).map_err(|e| AppError::fs(&to, e.to_string()))?;
                    }
                }
                Err(e) => return Err(AppError::fs(&to, e.to_string())),
            }
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
            // Even a brand-new entry has to record its mode: a mirrored copy is
            // otherwise indistinguishable from a foreign plain file.
            let mode = write_link_rel(agent_root, rel)?;
            let mut meta = read_meta_raw()?;
            meta.insert(
                rel.to_string(),
                LinkMeta {
                    backup: None,
                    adopted_at: now_ts(),
                    mode,
                },
            );
            write_meta(&meta)?;
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

            let mode = write_link_rel(agent_root, rel)?;

            let mut meta = read_meta_raw()?;
            meta.insert(
                rel.to_string(),
                LinkMeta {
                    backup: Some(backup.to_string_lossy().into_owned()),
                    adopted_at: now_ts(),
                    mode,
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

/// Remove one entry without ever recursing through a link.
///
/// A Windows junction reports `is_dir()` and is not a std symlink, so
/// `remove_dir_all` would descend into the store and delete the real content
/// instead of unlinking the entry. Junctions and symlinks are removed
/// non-recursively; only a genuine directory is deleted as a tree.
pub fn remove_entry(path: &Path) -> Result<()> {
    let meta = match fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(AppError::fs(path, e.to_string())),
    };
    let linked = meta.file_type().is_symlink() || fs::read_link(path).is_ok();
    if meta.is_dir() && !linked {
        fs::remove_dir_all(path).map_err(|e| AppError::fs(path, e.to_string()))
    } else if meta.is_dir() {
        fs::remove_dir(path).map_err(|e| AppError::fs(path, e.to_string()))
    } else {
        fs::remove_file(path).map_err(|e| AppError::fs(path, e.to_string()))
    }
}

/// Remove the link only when it points into the store; never touch foreign files.
pub fn detach_rel(agent_root: &Path, rel: &str) -> Result<()> {
    let state = link_state_rel(agent_root, rel)?;
    if state.kind == LinkKind::Managed {
        remove_entry(&state.path)?;
    }
    Ok(())
}

pub fn detach(agent: &Path, name: &str) -> Result<()> {
    detach_rel(agent, name)
}

pub fn has_backup_rel(rel: &str) -> Result<bool> {
    let meta = read_meta_raw()?;
    match meta.get(rel) {
        Some(entry) => Ok(entry
            .backup
            .as_deref()
            .map(|backup| Path::new(backup).exists())
            .unwrap_or(false)),
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

    let backup = entry
        .backup
        .as_deref()
        .map(PathBuf::from)
        .ok_or_else(|| AppError::validation(rel, "no adoption backup recorded"))?;
    if !backup.exists() {
        return Err(AppError::fs(&backup, "recorded backup is missing"));
    }

    let dst = agent_root.join(rel);
    remove_entry(&dst)?;
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
    let mode = meta.get(rel).map(|m| m.mode).unwrap_or_default();
    meta.insert(
        rel.to_string(),
        LinkMeta {
            backup: Some(backup.to_string_lossy().into_owned()),
            adopted_at: now_ts(),
            mode,
        },
    );
    write_meta(&meta)?;
    Ok(backup)
}

pub fn write_content(name: &str, text: &str) -> Result<PathBuf> {
    let agent = paths::agent_dir()?;
    write_managed(&agent, name, text.as_bytes())?;
    Ok(paths::store_dir()?.join(name))
}

pub fn store_file(name: &str) -> Result<PathBuf> {
    Ok(paths::store_dir()?.join(name))
}

/// Copy `<path>` to `<path>.bak.<ts>` and return the backup path, or `None` when backups are disabled.
pub fn backup_file(path: &Path) -> Result<Option<PathBuf>> {
    let cfg = crate::backup::load();
    if !cfg.enabled {
        return Ok(None);
    }
    crate::backup::prune_siblings(path, cfg.keep.saturating_sub(1));
    let ts = now_ts();
    let mut candidate = PathBuf::from(format!("{}.bak.{ts}", path.display()));
    let mut n = 1;
    while candidate.exists() {
        candidate = PathBuf::from(format!("{}.bak.{ts}.{n}", path.display()));
        n += 1;
    }
    fs::copy(path, &candidate).map_err(|e| AppError::fs(path, e.to_string()))?;
    Ok(Some(candidate))
}

fn snapshot_entries() -> Vec<String> {
    let mut out: Vec<String> = vec![
        CONFIG.to_string(),
        MODELS.to_string(),
        crate::mcp::MCP_FILE.to_string(),
        crate::keybindings::FILE.to_string(),
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
    let mut args = vec!["-czf".to_string(), dest.to_string_lossy().into_owned()];
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
                    let _ = backup_file(&dst)?;
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
                    let cur = fs::read_link(&agent_path)
                        .map_err(|e| AppError::fs(&agent_path, e.to_string()))?;
                    if target_in_store(&cur, &store) {
                        continue;
                    }
                    remove_entry(&agent_path)?;
                }
                Ok(m) if m.is_dir() => {
                    let bak = backup_path(rel)?;
                    fs::rename(&agent_path, &bak)
                        .map_err(|e| AppError::fs(&agent_path, e.to_string()))?;
                }
                Ok(_) => {
                    let _ = backup_file(&agent_path)?;
                    remove_entry(&agent_path)?;
                }
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => return Err(AppError::fs(&agent_path, e.to_string())),
            }
            if let Some(parent) = agent_path.parent() {
                fs::create_dir_all(parent).map_err(|e| AppError::fs(parent, e.to_string()))?;
            }
            if fs::symlink_metadata(&agent_path).is_err() {
                let mode = create_entry(&target, &agent_path, target.is_dir())?;
                let mut meta = read_meta_raw()?;
                meta.entry(rel.clone()).or_insert(LinkMeta {
                    backup: None,
                    adopted_at: now_ts(),
                    mode,
                });
                write_meta(&meta)?;
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
