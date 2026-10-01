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
            "omp-ctl-mcp-{tag}-{}-{:?}",
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

    fn agent(&self) -> std::path::PathBuf {
        self.root.join(".omp/agent")
    }

    fn read_store(&self) -> String {
        fs::read_to_string(self.root.join(".omp-ctl/mcp.json")).unwrap()
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

const SAMPLE: &str = r#"{
  "$schema": "https://example/schema.json",
  "mcpServers": {
    "codegraph": {
      "type": "stdio",
      "command": "codegraph",
      "args": ["serve", "--mcp"]
    }
  }
}"#;

#[test]
fn upsert_preserves_schema_key() {
    let sb = Sandbox::new("upsert");
    fs::write(sb.agent().join("mcp.json"), SAMPLE).unwrap();

    let servers = list(&sb.agent()).unwrap();
    assert_eq!(servers.len(), 1);
    assert_eq!(servers[0].name, "codegraph");
    assert!(servers[0].enabled);

    // reading an unmanaged file must not take it over
    assert!(fs::symlink_metadata(sb.agent().join("mcp.json"))
        .unwrap()
        .file_type()
        .is_file());

    store::adopt_rel(&sb.agent(), MCP_FILE).unwrap();

    upsert(
        &sb.agent(),
        "e2e",
        serde_json::json!({ "type": "stdio", "command": "true" }),
    )
    .unwrap();

    let out = sb.read_store();
    assert!(
        out.starts_with("{\n  \"$schema\""),
        "unexpected head: {out}"
    );
    assert!(out.contains("\"codegraph\""));
    assert!(out.contains("\"e2e\""));

    remove(&sb.agent(), "e2e").unwrap();
    let names: Vec<String> = list(&sb.agent())
        .unwrap()
        .into_iter()
        .map(|s| s.name)
        .collect();
    assert_eq!(names, vec!["codegraph"]);
}

#[test]
fn set_enabled_preserves_other_keys() {
    let sb = Sandbox::new("enable");
    fs::write(sb.agent().join("mcp.json"), SAMPLE).unwrap();
    store::adopt_rel(&sb.agent(), MCP_FILE).unwrap();

    let server = set_enabled(&sb.agent(), "codegraph", false).unwrap();
    assert!(!server.enabled);
    assert_eq!(server.command.as_deref(), Some("codegraph"));
    assert_eq!(server.args, vec!["serve", "--mcp"]);

    let out = sb.read_store();
    assert!(out.contains("\"enabled\": false"));
    assert!(out.contains("\"$schema\""));
    assert!(out.contains("\"serve\""));
}

#[test]
fn unmanaged_file_is_readable_but_edits_stay_in_place() {
    let sb = Sandbox::new("unmanaged");
    fs::write(sb.agent().join("mcp.json"), SAMPLE).unwrap();

    upsert(
        &sb.agent(),
        "local",
        serde_json::json!({ "type": "stdio", "command": "true" }),
    )
    .unwrap();

    assert!(!sb.root.join(".omp-ctl/mcp.json").exists());
    let text = fs::read_to_string(sb.agent().join("mcp.json")).unwrap();
    assert!(text.contains("\"local\""));
    assert!(text.contains("\"$schema\""));
}
