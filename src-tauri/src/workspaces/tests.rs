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

#[test]
fn sync_active_roles_updates_snapshot_and_keeps_pointer() {
    let _sb = setup_state();
    create("A").unwrap();
    assert_eq!(active().unwrap().as_deref(), Some("A"));

    let mut roles = BTreeMap::new();
    roles.insert("default".to_string(), "axon/preset".to_string());
    sync_active_roles(&roles, &["default".to_string()]).unwrap();

    assert_eq!(active().unwrap().as_deref(), Some("A"));
    let manifest = read_manifest(&ws_dir("A").unwrap()).unwrap();
    assert_eq!(manifest.roles.get("default").unwrap(), "axon/preset");
    assert_eq!(manifest.cycle_order, vec!["default"]);
}

#[test]
fn sync_active_roles_without_active_workspace_errors() {
    let _sb = setup_state();
    let roles = BTreeMap::new();
    assert!(sync_active_roles(&roles, &[]).is_err());
}

#[test]
fn apply_recreates_missing_mcp_link() {
    let _sb = setup_state();
    let agent = paths::agent_dir().unwrap();
    create("A").unwrap();

    fs::remove_file(agent.join(MCP_FILE)).unwrap();
    assert_eq!(
        store::link_state(&agent, MCP_FILE).unwrap().kind,
        store::LinkKind::Absent
    );

    apply("A").unwrap();

    assert_eq!(
        store::link_state(&agent, MCP_FILE).unwrap().kind,
        store::LinkKind::Managed
    );
    assert!(fs::read_to_string(agent.join(MCP_FILE))
        .unwrap()
        .contains("codegraph"));
}

#[test]
fn apply_repairs_dangling_mcp_link() {
    let sb = setup_state();
    let agent = paths::agent_dir().unwrap();
    create("A").unwrap();

    fs::remove_file(sb.root.join(".omp-ctl/mcp.json")).unwrap();
    assert!(!agent.join(MCP_FILE).exists());

    apply("A").unwrap();

    assert!(agent.join(MCP_FILE).exists());
    assert!(fs::read_to_string(agent.join(MCP_FILE))
        .unwrap()
        .contains("codegraph"));
}

#[test]
fn repair_active_restores_dangling_mcp_store() {
    let sb = setup_state();
    let agent = paths::agent_dir().unwrap();
    create("A").unwrap();

    fs::remove_file(sb.root.join(".omp-ctl/mcp.json")).unwrap();
    assert!(!agent.join(MCP_FILE).exists());

    assert!(repair_active().unwrap());
    assert!(agent.join(MCP_FILE).exists());
    assert_eq!(
        store::link_state(&agent, MCP_FILE).unwrap().kind,
        store::LinkKind::Managed
    );
    assert!(fs::read_to_string(agent.join(MCP_FILE))
        .unwrap()
        .contains("codegraph"));
}

#[test]
fn repair_active_recreates_missing_mcp_link() {
    let sb = setup_state();
    let agent = paths::agent_dir().unwrap();
    create("A").unwrap();

    fs::remove_file(agent.join(MCP_FILE)).unwrap();
    assert!(sb.root.join(".omp-ctl/mcp.json").exists());

    assert!(repair_active().unwrap());
    assert_eq!(
        store::link_state(&agent, MCP_FILE).unwrap().kind,
        store::LinkKind::Managed
    );
}

#[test]
fn repair_active_restores_missing_resource_link() {
    let _sb = setup_state();
    let agent = paths::agent_dir().unwrap();
    create("A").unwrap();

    fs::remove_file(agent.join("skills/demo")).unwrap();
    assert!(repair_active().unwrap());
    assert_eq!(
        store::link_state_rel(&agent, "skills/demo").unwrap().kind,
        store::LinkKind::Managed
    );
    assert!(agent.join("skills/demo/SKILL.md").exists());
}

#[test]
fn repair_active_restores_dangling_prompt_store() {
    let sb = setup_state();
    let agent = paths::agent_dir().unwrap();
    crate::prompts::set_enabled("agents", true).unwrap();
    create("A").unwrap();

    fs::remove_file(sb.root.join(".omp-ctl/AGENTS.md")).unwrap();
    assert!(!agent.join("AGENTS.md").exists());

    assert!(repair_active().unwrap());
    assert_eq!(
        store::link_state(&agent, "AGENTS.md").unwrap().kind,
        store::LinkKind::Managed
    );
    assert!(agent.join("AGENTS.md").exists());
}

#[test]
fn apply_overrides_foreign_prompt_with_snapshot() {
    let _sb = setup_state();
    let agent = paths::agent_dir().unwrap();
    crate::prompts::write("agents", "# snapshot\n").unwrap();
    create("A").unwrap();

    fs::remove_file(agent.join("AGENTS.md")).unwrap();
    fs::write(agent.join("AGENTS.md"), "# foreign\n").unwrap();

    apply("A").unwrap();
    assert_eq!(
        fs::read_to_string(agent.join("AGENTS.md")).unwrap(),
        "# snapshot\n"
    );
}

#[test]
fn apply_overrides_foreign_resource_with_snapshot() {
    let _sb = setup_state();
    let agent = paths::agent_dir().unwrap();
    create("A").unwrap();

    fs::remove_file(agent.join("skills/demo")).unwrap();
    fs::create_dir_all(agent.join("skills/demo")).unwrap();
    fs::write(agent.join("skills/demo/SKILL.md"), "# foreign\n").unwrap();

    apply("A").unwrap();
    assert_eq!(
        fs::read_to_string(agent.join("skills/demo/SKILL.md")).unwrap(),
        "# demo\n"
    );
}

#[test]
fn repair_active_links_snapshot_resource_missing_from_manifest() {
    let _sb = setup_state();
    let agent = paths::agent_dir().unwrap();
    create("A").unwrap();

    let snap = ws_dir("A").unwrap().join("extensions/rtk.ts");
    fs::create_dir_all(snap.parent().unwrap()).unwrap();
    fs::write(&snap, "export default {};\n").unwrap();

    assert!(repair_active().unwrap());
    assert_eq!(
        store::link_state_rel(&agent, "extensions/rtk.ts")
            .unwrap()
            .kind,
        store::LinkKind::Managed
    );
    assert_eq!(
        fs::read_to_string(agent.join("extensions/rtk.ts")).unwrap(),
        "export default {};\n"
    );
}

#[test]
fn apply_links_snapshot_resource_missing_from_manifest() {
    let _sb = setup_state();
    let agent = paths::agent_dir().unwrap();
    create("A").unwrap();

    let snap = ws_dir("A").unwrap().join("extensions/rtk.ts");
    fs::create_dir_all(snap.parent().unwrap()).unwrap();
    fs::write(&snap, "export default {};\n").unwrap();

    apply("A").unwrap();
    assert_eq!(
        store::link_state_rel(&agent, "extensions/rtk.ts")
            .unwrap()
            .kind,
        store::LinkKind::Managed
    );
    assert_eq!(
        fs::read_to_string(agent.join("extensions/rtk.ts")).unwrap(),
        "export default {};\n"
    );
}

#[test]
fn repair_active_links_store_resource_missing_from_snapshot() {
    let sb = setup_state();
    let agent = paths::agent_dir().unwrap();
    create("A").unwrap();

    let stored = sb.root.join(".omp-ctl/extensions/rtk.ts");
    fs::create_dir_all(stored.parent().unwrap()).unwrap();
    fs::write(&stored, "export default {};\n").unwrap();

    assert!(repair_active().unwrap());
    assert_eq!(
        store::link_state_rel(&agent, "extensions/rtk.ts")
            .unwrap()
            .kind,
        store::LinkKind::Managed
    );
    assert_eq!(
        fs::read_to_string(agent.join("extensions/rtk.ts")).unwrap(),
        "export default {};\n"
    );
}
