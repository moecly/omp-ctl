#![cfg(test)]

use std::fs;

use super::*;

struct Sandbox {
    root: std::path::PathBuf,
    _guard: std::sync::MutexGuard<'static, ()>,
}

impl Sandbox {
    fn new(tag: &str) -> Sandbox {
        let guard = crate::SANDBOX_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let root = std::env::temp_dir().join(format!(
            "omp-ctl-defaults-{tag}-{}-{:?}",
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
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

#[test]
fn missing_file_yields_defaults() {
    let _sb = Sandbox::new("missing");
    assert_eq!(read().unwrap(), Defaults::default());
}

#[test]
fn write_read_round_trips() {
    let _sb = Sandbox::new("roundtrip");
    let d = Defaults {
        model: ModelDefaults {
            api: Some("openai-chat".into()),
            reasoning: true,
            image_input: true,
            context_window: Some(200_000),
            max_tokens: Some(8192),
            thinking_level: Some("medium".into()),
        },
        role_thinking_level: Some("low".into()),
        ..Default::default()
    };
    let back = write(&d).unwrap();
    assert_eq!(back, d);
    assert_eq!(read().unwrap(), d);
}

#[test]
fn scalar_fields_survive_yaml_round_trip() {
    let sb = Sandbox::new("scalars");
    let d = Defaults {
        model: ModelDefaults {
            context_window: Some(123_456),
            ..Default::default()
        },
        role_thinking_level: Some("xhigh".into()),
        ..Default::default()
    };
    write(&d).unwrap();
    let text = fs::read_to_string(sb.root.join(".omp-ctl/defaults.yml")).unwrap();
    assert!(text.contains("contextWindow: 123456"));
    assert!(text.contains("roleThinkingLevel: xhigh"));
    assert_eq!(read().unwrap(), d);
}

#[test]
fn missing_file_backup_defaults_off() {
    let _sb = Sandbox::new("backup-missing");
    assert_eq!(
        read().unwrap().backup,
        BackupSettings {
            enabled: false,
            keep: 5
        }
    );
}

#[test]
fn legacy_file_without_backup_key_parses() {
    let sb = Sandbox::new("backup-legacy");
    fs::write(
        sb.root.join(".omp-ctl/defaults.yml"),
        "model:\n  reasoning: true\n",
    )
    .unwrap();
    assert_eq!(read().unwrap().backup, BackupSettings::default());
}

#[test]
fn backup_settings_round_trip() {
    let sb = Sandbox::new("backup-roundtrip");
    let d = Defaults {
        backup: BackupSettings {
            enabled: true,
            keep: 3,
        },
        ..Default::default()
    };
    let back = write(&d).unwrap();
    assert_eq!(back.backup, d.backup);
    assert_eq!(read().unwrap().backup, d.backup);
    let text = fs::read_to_string(sb.root.join(".omp-ctl/defaults.yml")).unwrap();
    assert!(text.contains("keep: 3"));
}
