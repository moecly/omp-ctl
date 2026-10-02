#![cfg(test)]

use std::collections::BTreeMap;
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
            "omp-ctl-presets-{tag}-{}-{:?}",
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

fn roles_of(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
    pairs
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect()
}

const CURRENT: &str = "\
setupVersion: 2
modelRoles:
  default: axon/one
  slow: axon/two
  stale: axon/three
";

#[test]
fn save_then_list_contains_preset() {
    let _sb = Sandbox::new("save");
    let saved = save(
        "chatgpt",
        roles_of(&[("default", "openai/gpt-4o")]),
        vec!["default".into()],
    )
    .unwrap();
    let entry = saved.iter().find(|e| e.name == "chatgpt").unwrap();
    assert_eq!(entry.roles.get("default").map(String::as_str), Some("openai/gpt-4o"));
    assert_eq!(entry.cycle_order, vec!["default"]);
    assert_eq!(list().unwrap().len(), 1);
}

#[test]
fn apply_replaces_roles_and_cycle_order() {
    let sb = Sandbox::new("apply");
    sb.write_config(CURRENT);
    save(
        "openai",
        roles_of(&[("default", "openai/gpt-4o"), ("review", "openai/o3:high")]),
        vec!["default".into(), "review".into()],
    )
    .unwrap();
    let roles = apply("openai").unwrap();
    assert_eq!(roles.roles.len(), 2, "{:?}", roles.roles);
    assert_eq!(roles.roles.get("default").map(String::as_str), Some("openai/gpt-4o"));
    assert_eq!(roles.roles.get("review").map(String::as_str), Some("openai/o3:high"));
    assert_eq!(roles.cycle_order, vec!["default", "review"]);
    let out = sb.read_config();
    assert!(!out.contains("stale:"), "{out}");
    assert!(!out.contains("slow:"), "{out}");
    assert!(out.contains("  review: openai/o3:high"), "{out}");
    assert!(out.contains(r#"cycleOrder: ["default","review"]"#), "{out}");
    assert!(out.starts_with("setupVersion: 2"), "{out}");
}

#[test]
fn apply_empty_order_writes_empty_list() {
    let sb = Sandbox::new("emptyorder");
    sb.write_config(CURRENT);
    save("bare", roles_of(&[("default", "axon/one")]), Vec::new()).unwrap();
    let roles = apply("bare").unwrap();
    assert!(roles.cycle_order.is_empty());
    assert!(sb.read_config().contains("cycleOrder: []"), "{}", sb.read_config());
}

#[test]
fn apply_unknown_preset_rejected() {
    let _sb = Sandbox::new("unknown");
    match apply("nope") {
        Err(AppError::Validation { field, .. }) => assert_eq!(field, "name"),
        other => panic!("expected validation error, got {other:?}"),
    }
}

#[test]
fn invalid_names_rejected() {
    let _sb = Sandbox::new("invalid");
    for bad in ["a/b", "a\\b", "..", "", "   "] {
        match save(bad, BTreeMap::new(), Vec::new()) {
            Err(AppError::Validation { field, .. }) => assert_eq!(field, "name"),
            other => panic!("expected validation error for {bad:?}, got {other:?}"),
        }
    }
}
