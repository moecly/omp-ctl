#![cfg(test)]

use std::fs;

use super::*;

struct Sandbox {
    root: std::path::PathBuf,
    _guard: std::sync::MutexGuard<'static, ()>,
}

impl Sandbox {
    fn new(tag: &str) -> Sandbox {
        let guard = crate::SANDBOX_LOCK
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let root = std::env::temp_dir().join(format!(
            "omp-ctl-cfg-{tag}-{}-{:?}",
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

    fn write_config(&self, text: &str) {
        fs::write(self.root.join(".omp-ctl/config.yml"), text).unwrap();
    }

    fn read_config(&self) -> String {
        fs::read_to_string(self.root.join(".omp-ctl/config.yml")).unwrap()
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

const SAMPLE: &str = "\
setupVersion: 2 # keep this first
modelRoles:
  # default selector
  default: axon/one
  slow: axon/two
composer:
  shape: claude
";

#[test]
fn set_raw_keeps_comments() {
    let sb = Sandbox::new("set-raw");
    sb.write_config(SAMPLE);
    super::set_raw(&["cycleOrder"], r#"["a","b"]"#).unwrap();
    let out = sb.read_config();
    assert!(out.contains("setupVersion: 2 # keep this first"));
    assert!(out.contains("  # default selector"));
    assert!(out.contains(r#"cycleOrder: ["a","b"]"#));
    assert!(out.contains("  shape: claude"));
}

#[test]
fn remove_path_deletes_nested_block() {
    let sb = Sandbox::new("remove");
    sb.write_config(SAMPLE);
    assert!(super::remove_path(&["modelRoles", "slow"]).unwrap());
    let out = sb.read_config();
    assert!(!out.contains("slow: axon/two"));
    assert!(out.contains("default: axon/one"));
    assert!(out.contains("  # default selector"));
    assert!(out.contains("composer:"));
}

#[test]
fn has_path_reports_nested_existence() {
    let sb = Sandbox::new("has-path");
    sb.write_config(SAMPLE);
    assert!(super::has_path(&["modelRoles", "default"]).unwrap());
    assert!(super::has_path(&["composer"]).unwrap());
    assert!(!super::has_path(&["modelRoles", "review"]).unwrap());
    assert!(!super::has_path(&["nope"]).unwrap());
}

#[test]
fn set_str_creates_missing_block() {
    let sb = Sandbox::new("create");
    sb.write_config(SAMPLE);
    super::set_str(&["modelRoles", "review"], "axon/three").unwrap();
    let out = sb.read_config();
    assert!(out.contains("  review: axon/three"));
    assert!(out.contains("composer:"));
}

#[test]
fn set_raw_replaces_stale_empty_key() {
    let sb = Sandbox::new("stale-empty");
    sb.write_config("modelRoles:\n  default: axon/one\ncycleOrder:\n  []\n");
    super::set_raw(&["cycleOrder"], "[]").unwrap();
    let out = sb.read_config();
    assert!(out.contains("cycleOrder: []\n"), "{out}");
    assert!(!out.contains("\n  []"), "{out}");
    let v: serde_yaml::Value = serde_yaml::from_str(&out).unwrap();
    assert!(v.get("cycleOrder").unwrap().as_sequence().unwrap().is_empty());
}
