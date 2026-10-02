#![cfg(test)]

use std::fs;

use super::*;
use crate::store;

struct Sandbox {
    root: std::path::PathBuf,
    _guard: std::sync::MutexGuard<'static, ()>,
}

impl Sandbox {
    fn new(tag: &str) -> Sandbox {
        let guard = crate::SANDBOX_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let root = std::env::temp_dir().join(format!(
            "omp-ctl-backup-{tag}-{}-{:?}",
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

    fn dir(&self) -> std::path::PathBuf {
        self.root.join(".omp-ctl")
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn backup_names(dir: &std::path::Path, base: &str) -> Vec<String> {
    let prefix = format!("{base}.bak.");
    let mut out: Vec<String> = fs::read_dir(dir)
        .unwrap()
        .flatten()
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| n.starts_with(&prefix))
        .collect();
    out.sort();
    out
}

#[test]
fn missing_file_disables_backups() {
    let sb = Sandbox::new("missing");
    assert_eq!(load(), BackupConfig::default());
    let target = sb.dir().join("models.yml");
    fs::write(&target, "a: 1\n").unwrap();
    assert_eq!(store::backup_file(&target).unwrap(), None);
    assert!(backup_names(&sb.dir(), "models.yml").is_empty());
}

#[test]
fn corrupt_file_disables_backups() {
    let sb = Sandbox::new("corrupt");
    fs::write(sb.dir().join("defaults.yml"), "backup: [unclosed\n").unwrap();
    assert_eq!(load(), BackupConfig::default());
}

#[test]
fn keep_clamps() {
    let sb = Sandbox::new("clamp");
    fs::write(
        sb.dir().join("defaults.yml"),
        "backup:\n  enabled: true\n  keep: 0\n",
    )
    .unwrap();
    assert_eq!(load().keep, 5);
    fs::write(
        sb.dir().join("defaults.yml"),
        "backup:\n  enabled: true\n  keep: 500\n",
    )
    .unwrap();
    assert_eq!(load().keep, 100);
}

#[test]
fn disabled_leaves_existing_backups() {
    let sb = Sandbox::new("disabled-keep");
    fs::write(
        sb.dir().join("defaults.yml"),
        "backup:\n  enabled: false\n  keep: 5\n",
    )
    .unwrap();
    let target = sb.dir().join("models.yml");
    fs::write(&target, "a: 1\n").unwrap();
    fs::write(sb.dir().join("models.yml.bak.1"), "old").unwrap();
    fs::write(sb.dir().join("models.yml.bak.2"), "old").unwrap();
    assert_eq!(store::backup_file(&target).unwrap(), None);
    assert_eq!(backup_names(&sb.dir(), "models.yml").len(), 2);
}

#[test]
fn enabled_prunes_to_keep() {
    let sb = Sandbox::new("prune");
    fs::write(
        sb.dir().join("defaults.yml"),
        "backup:\n  enabled: true\n  keep: 3\n",
    )
    .unwrap();
    let target = sb.dir().join("models.yml");
    fs::write(&target, "a: 1\n").unwrap();
    for i in 1..=5 {
        fs::write(sb.dir().join(format!("models.yml.bak.{i}")), "old").unwrap();
    }
    let made = store::backup_file(&target).unwrap().expect("backup path");
    assert!(made.exists());
    assert_eq!(backup_names(&sb.dir(), "models.yml").len(), 3);
    let made_name = made.file_name().unwrap().to_string_lossy().into_owned();
    assert!(backup_names(&sb.dir(), "models.yml").contains(&made_name));
}

#[test]
fn keep_zero_does_not_wipe() {
    let sb = Sandbox::new("zero");
    fs::write(
        sb.dir().join("defaults.yml"),
        "backup:\n  enabled: true\n  keep: 0\n",
    )
    .unwrap();
    let target = sb.dir().join("models.yml");
    fs::write(&target, "a: 1\n").unwrap();
    for i in 1..=4 {
        fs::write(sb.dir().join(format!("models.yml.bak.z{i}")), "old").unwrap();
    }
    store::backup_file(&target).unwrap().expect("backup path");
    assert_eq!(backup_names(&sb.dir(), "models.yml").len(), 5);
}
