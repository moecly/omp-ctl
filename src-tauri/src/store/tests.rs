#![cfg(test)]

use std::fs;
use std::os::unix::fs::symlink;
use std::path::Path;

use super::*;

struct Sandbox {
    root: std::path::PathBuf,
    _guard: std::sync::MutexGuard<'static, ()>,
}

impl Sandbox {
    fn new(tag: &str) -> Sandbox {
        let guard = crate::SANDBOX_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let root = std::env::temp_dir().join(format!(
            "omp-ctl-{tag}-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join(".omp-ctl/backup")).unwrap();
        fs::create_dir_all(root.join(".omp/agent")).unwrap();
        std::env::set_var("HOME", &root);
        std::env::set_var("PI_CODING_AGENT_DIR", root.join(".omp/agent"));
        Sandbox {
            root,
            _guard: guard,
        }
    }

    fn store(&self) -> std::path::PathBuf {
        self.root.join(".omp-ctl")
    }

    fn agent(&self) -> std::path::PathBuf {
        self.root.join(".omp/agent")
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn read(path: &Path) -> String {
    fs::read_to_string(path).unwrap()
}

fn backups(sb: &Sandbox) -> Vec<std::path::PathBuf> {
    let dir = sb.store().join("backup");
    match fs::read_dir(&dir) {
        Ok(entries) => entries.filter_map(|e| e.ok()).map(|e| e.path()).collect(),
        Err(_) => Vec::new(),
    }
}

#[test]
fn adopt_symlink_reads_through_and_stores_backup() {
    let sb = Sandbox::new("adopt-symlink");
    let real = sb.root.join("real.md");
    fs::write(&real, "HELLO").unwrap();
    symlink(&real, sb.agent().join("X.md")).unwrap();

    let state = adopt(&sb.agent(), "X.md").unwrap();
    assert_eq!(state.kind, LinkKind::Managed);

    assert_eq!(read(&sb.store().join("X.md")), "HELLO");

    let link = fs::read_link(sb.agent().join("X.md")).unwrap();
    assert_eq!(link, sb.store().join("X.md"));

    // the original entity (the symlink itself) was moved into backup, real file untouched
    let backup = backups(&sb);
    assert_eq!(backup.len(), 1, "expected one backup entry: {backup:?}");
    let backup_path = backup[0].clone();
    let meta = fs::symlink_metadata(&backup_path).unwrap();
    assert!(
        meta.file_type().is_symlink(),
        "backup must be the original symlink"
    );
    assert_eq!(fs::read_link(&backup_path).unwrap(), real);
    assert_eq!(read(&real), "HELLO");

    let recorded: std::collections::BTreeMap<String, LinkMeta> =
        serde_json::from_str(&read(&sb.store().join(".links.json"))).unwrap();
    assert_eq!(
        recorded.get("X.md").unwrap().backup,
        backup_path.to_string_lossy()
    );
    assert!(has_backup("X.md").unwrap());

    detach(&sb.agent(), "X.md").unwrap();
    assert!(!sb.agent().join("X.md").exists());
    assert!(sb.store().join("X.md").exists(), "store copy survives detach");
}

#[test]
fn adopt_regular_file() {
    let sb = Sandbox::new("adopt-file");
    fs::write(sb.agent().join("X.md"), "PLAIN").unwrap();

    let state = adopt(&sb.agent(), "X.md").unwrap();
    assert_eq!(state.kind, LinkKind::Managed);
    assert_eq!(read(&sb.store().join("X.md")), "PLAIN");

    let backup = backups(&sb);
    assert_eq!(backup.len(), 1);
    assert!(!fs::symlink_metadata(&backup[0]).unwrap().file_type().is_symlink());
    assert_eq!(read(&backup[0]), "PLAIN");

    restore_backup(&sb.agent(), "X.md").unwrap();
    let restored = fs::symlink_metadata(sb.agent().join("X.md")).unwrap();
    assert!(
        !restored.file_type().is_symlink(),
        "restored entity is the plain file"
    );
    assert_eq!(read(&sb.agent().join("X.md")), "PLAIN");
    assert!(!has_backup("X.md").unwrap());
    assert!(sb.store().join("X.md").exists(), "store copy is preserved");
}

#[test]
fn adopt_absent_creates_link() {
    let sb = Sandbox::new("adopt-absent");
    let state = adopt(&sb.agent(), "X.md").unwrap();
    assert_eq!(state.kind, LinkKind::Managed);
    assert_eq!(
        fs::read_link(sb.agent().join("X.md")).unwrap(),
        sb.store().join("X.md")
    );
    assert!(backups(&sb).is_empty());
}

#[test]
fn adopt_is_idempotent_for_managed() {
    let sb = Sandbox::new("adopt-idem");
    adopt(&sb.agent(), "X.md").unwrap();
    write_content("X.md", "V1").unwrap();
    adopt(&sb.agent(), "X.md").unwrap();
    assert_eq!(read(&sb.store().join("X.md")), "V1");
    assert!(backups(&sb).is_empty());
}

#[test]
fn adopt_dangling_link_errors_without_touching_agent() {
    let sb = Sandbox::new("adopt-dangling");
    symlink(sb.root.join("nowhere.md"), sb.agent().join("X.md")).unwrap();

    match adopt(&sb.agent(), "X.md") {
        Err(AppError::Fs { .. }) => {}
        other => panic!("expected Fs error, got {other:?}"),
    }
    // untouched: still the original dangling symlink
    assert_eq!(
        fs::read_link(sb.agent().join("X.md")).unwrap(),
        sb.root.join("nowhere.md")
    );
    assert!(!sb.store().join("X.md").exists());
    assert!(backups(&sb).is_empty());
}

#[test]
fn detach_leaves_foreign_entries_alone() {
    let sb = Sandbox::new("detach-foreign");
    fs::write(sb.agent().join("X.md"), "MINE").unwrap();
    detach(&sb.agent(), "X.md").unwrap();
    assert_eq!(read(&sb.agent().join("X.md")), "MINE");

    let real = sb.root.join("real.md");
    fs::write(&real, "R").unwrap();
    symlink(&real, sb.agent().join("Y.md")).unwrap();
    detach(&sb.agent(), "Y.md").unwrap();
    assert_eq!(fs::read_link(sb.agent().join("Y.md")).unwrap(), real);
}

#[test]
fn link_state_reports_unmanaged_for_foreign_symlink() {
    let sb = Sandbox::new("link-state");
    let real = sb.root.join("real.md");
    fs::write(&real, "R").unwrap();
    symlink(&real, sb.agent().join("Y.md")).unwrap();

    let state = link_state(&sb.agent(), "Y.md").unwrap();
    assert_eq!(state.kind, LinkKind::Unmanaged);
    assert_eq!(state.target.unwrap(), real);

    assert_eq!(link_state(&sb.agent(), "NOPE.md").unwrap().kind, LinkKind::Absent);
}

#[test]
fn agent_dir_prefers_env_override_in_sandbox() {
    let sb = Sandbox::new("agent-dir");
    assert_eq!(crate::paths::agent_dir().unwrap(), sb.agent());
}
