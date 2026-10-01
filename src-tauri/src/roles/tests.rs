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
            "omp-ctl-roles-{tag}-{}-{:?}",
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
setupVersion: 2
modelRoles:
  default: axon/one
  slow: axon/two
";

#[test]
fn set_role_creates_missing_block() {
    let sb = Sandbox::new("set");
    fs::write(sb.root.join(".omp-ctl/config.yml"), SAMPLE).unwrap();
    let roles = set_role("review", "axon/deepseek-v4-flash:off").unwrap();
    assert_eq!(roles.roles.get("review").map(|s| s.as_str()), Some("axon/deepseek-v4-flash:off"));
    let out = sb.read_config();
    assert!(out.contains("  review: axon/deepseek-v4-flash:off"));
    assert!(out.starts_with("setupVersion: 2"));
}

#[test]
fn delete_role_removes_only_that_role() {
    let sb = Sandbox::new("delete");
    fs::write(sb.root.join(".omp-ctl/config.yml"), SAMPLE).unwrap();
    let roles = delete_role("slow").unwrap();
    assert!(!roles.roles.contains_key("slow"));
    assert!(roles.roles.contains_key("default"));
    assert!(!sb.read_config().contains("slow:"));
}

#[test]
fn cycle_order_round_trips() {
    let sb = Sandbox::new("cycle");
    fs::write(sb.root.join(".omp-ctl/config.yml"), SAMPLE).unwrap();
    let roles = set_cycle_order(&["default".into(), "smol".into()]).unwrap();
    assert_eq!(roles.cycle_order, vec!["default", "smol"]);
    assert!(sb.read_config().contains(r#"cycleOrder: ["default","smol"]"#));
    assert!(sb.read_config().starts_with("setupVersion: 2"));
}

#[test]
fn invalid_role_name_rejected() {
    let sb = Sandbox::new("invalid");
    fs::write(sb.root.join(".omp-ctl/config.yml"), SAMPLE).unwrap();
    for bad in ["a:b", "a b", "a#b", ""] {
        match set_role(bad, "x/y") {
            Err(AppError::Validation { field, .. }) => assert_eq!(field, "role"),
            other => panic!("expected validation error for {bad:?}, got {other:?}"),
        }
    }
}
