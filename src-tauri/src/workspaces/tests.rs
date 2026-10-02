#![cfg(test)]

use std::fs;

use serde_json::json;

use super::*;

struct Sandbox {
    root: std::path::PathBuf,
    _guard: std::sync::MutexGuard<'static, ()>,
}

impl Sandbox {
    fn new(tag: &str) -> Sandbox {
        let guard = crate::SANDBOX_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let root = std::env::temp_dir().join(format!(
            "omp-ctl-workspaces-{tag}-{}-{:?}",
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
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&root_for(&self.root));
    }
}

fn root_for(root: &std::path::PathBuf) -> std::path::PathBuf {
    root.clone()
}

fn setup_state() -> Sandbox {
    let sb = Sandbox::new("round");
    sb.write_config("setupVersion: 2\nmodelRoles:\n  default: axon/one\n");
    let agent = paths::agent_dir().unwrap();
    crate::mcp::upsert(
        &agent,
        "codegraph",
        json!({"type": "stdio", "command": "cg", "enabled": true}),
    )
    .unwrap();
    crate::mcp::set_enabled(&agent, "codegraph", true).unwrap();
    crate::resources::write(&agent, "skills", "demo", "# demo\n").unwrap();
    crate::resources::set_enabled(&agent, "skills", "demo", true).unwrap();
    sb
}

#[test]
fn create_apply_roundtrip_restores_mcp_skill_role() {
    let sb = setup_state();
    let agent = paths::agent_dir().unwrap();

    create("A").unwrap();
    crate::mcp::set_enabled(&agent, "codegraph", false).unwrap();
    crate::resources::remove(&agent, "skills", "demo").unwrap();
    crate::roles::set_role("default", "axon/two").unwrap();

    apply("A").unwrap();

    let servers = crate::mcp::list(&agent).unwrap();
    let cg = servers.iter().find(|s| s.name == "codegraph").unwrap();
    assert!(cg.enabled);
    assert!(sb.root.join(".omp-ctl/skills/demo").exists());
    assert_eq!(
        crate::roles::list().unwrap().roles.get("default").unwrap(),
        "axon/one"
    );
}

#[test]
fn sync_active_quiet_updates_snapshot() {
    let _sb = setup_state();
    let agent = paths::agent_dir().unwrap();
    create("A").unwrap();
    crate::mcp::set_enabled(&agent, "codegraph", false).unwrap();
    sync_active_quiet();
    let dir = ws_dir("A").unwrap();
    let text = fs::read_to_string(dir.join("mcp.json")).unwrap();
    assert!(text.contains("\"enabled\": false") || text.contains("\"enabled\":false"));
}

#[test]
fn invalid_names_rejected() {
    let _sb = Sandbox::new("names");
    assert!(create("").is_err());
    assert!(create("a/b").is_err());
    assert!(create("..").is_err());
    assert!(apply("missing").is_err());
}

#[test]
fn active_pointer_roundtrip() {
    let _sb = setup_state();
    create("A").unwrap();
    assert_eq!(active().unwrap().as_deref(), Some("A"));
    clear_active().unwrap();
    assert_eq!(active().unwrap(), None);
}
