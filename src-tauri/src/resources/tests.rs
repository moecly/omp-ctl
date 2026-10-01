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
            "omp-ctl-res-{tag}-{}-{:?}",
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

#[test]
fn list_merges_store_and_agent() {
    let sb = Sandbox::new("merge");
    fs::create_dir_all(sb.store().join("agents")).unwrap();
    fs::write(
        sb.store().join("agents/only-store.md"),
        "---\ndescription: S\n---\n",
    )
    .unwrap();
    fs::create_dir_all(sb.agent().join("agents")).unwrap();
    fs::write(
        sb.agent().join("agents/only-agent.md"),
        "---\ndescription: A\n---\n",
    )
    .unwrap();

    let entries = list(&sb.agent(), "agents").unwrap();
    let names: Vec<&str> = entries.iter().map(|e| e.name.as_str()).collect();
    assert_eq!(names, vec!["only-agent.md", "only-store.md"]);
    let store_entry = entries.iter().find(|e| e.name == "only-store.md").unwrap();
    assert!(!store_entry.enabled && store_entry.store_exists && !store_entry.foreign);
    let agent_entry = entries.iter().find(|e| e.name == "only-agent.md").unwrap();
    assert_eq!(agent_entry.summary.as_deref(), Some("A"));
}

#[test]
fn write_then_read_roundtrips_for_dir_layout() {
    let sb = Sandbox::new("roundtrip");
    let body = "---\nname: foo\ndescription: Foo skill\n---\n\nBody\n";
    let entry = write(&sb.agent(), "skills", "foo", body).unwrap();
    assert!(entry.enabled);
    assert_eq!(entry.summary.as_deref(), Some("Foo skill"));
    assert_eq!(read(&sb.agent(), "skills", "foo").unwrap(), body);

    let link = fs::read_link(sb.agent().join("skills/foo")).unwrap();
    assert_eq!(link, sb.store().join("skills/foo"));
}

#[test]
fn set_enabled_false_on_foreign_link_errors() {
    let sb = Sandbox::new("foreign");
    fs::create_dir_all(sb.agent().join("extensions")).unwrap();
    let real = sb.root.join("rtk.ts");
    fs::write(&real, "export default 1").unwrap();
    std::os::unix::fs::symlink(&real, sb.agent().join("extensions/rtk.ts")).unwrap();

    let entry = list(&sb.agent(), "extensions").unwrap().remove(0);
    assert!(entry.foreign);
    assert!(!entry.enabled);

    match set_enabled(&sb.agent(), "extensions", "rtk.ts", false) {
        Err(AppError::Validation { field, .. }) => assert_eq!(field, "link"),
        other => panic!("expected validation error, got {other:?}"),
    }
    assert_eq!(
        fs::read_link(sb.agent().join("extensions/rtk.ts")).unwrap(),
        real
    );

    // adoption then makes it manageable
    let adopted = adopt(&sb.agent(), "extensions", "rtk.ts").unwrap();
    assert!(adopted.enabled && !adopted.foreign);
    let disabled = set_enabled(&sb.agent(), "extensions", "rtk.ts", false).unwrap();
    assert!(!disabled.enabled);
    assert!(!sb.agent().join("extensions/rtk.ts").exists());
}

#[test]
fn name_with_separator_is_rejected() {
    let sb = Sandbox::new("names");
    for bad in ["..", "a/b", "a\\b", ""] {
        match write(&sb.agent(), "agents", bad, "x") {
            Err(AppError::Validation { field, .. }) => assert_eq!(field, "name"),
            other => panic!("expected validation error for {bad:?}, got {other:?}"),
        }
    }
    assert!(list(&sb.agent(), "nope").is_err());
}

#[test]
fn remove_archives_instead_of_hard_deleting() {
    let sb = Sandbox::new("remove");
    write(&sb.agent(), "agents", "gone.md", "BODY").unwrap();
    remove(&sb.agent(), "agents", "gone.md").unwrap();

    assert!(!sb.store().join("agents/gone.md").exists());
    assert!(!sb.agent().join("agents/gone.md").exists());
    let backup_dir = sb.store().join("backup/agents");
    let entries: Vec<_> = fs::read_dir(&backup_dir)
        .unwrap()
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .collect();
    assert_eq!(entries.len(), 1);
    assert_eq!(fs::read_to_string(&entries[0]).unwrap(), "BODY");
}

#[test]
fn agent_model_and_disabled_round_trip() {
    let sb = Sandbox::new("agent-task");
    fs::write(
        sb.store().join("config.yml"),
        "task:\n  disabledAgents: []\n  agentModelOverrides: {}\n",
    )
    .unwrap();
    fs::create_dir_all(sb.agent().join("agents")).unwrap();
    fs::write(sb.agent().join("agents/reviewer.md"), "BODY").unwrap();

    let entry = set_agent_disabled(&sb.agent(), "reviewer.md", true).unwrap();
    assert!(entry.agent_disabled);
    let entry = set_agent_model(&sb.agent(), "reviewer.md", "axon/x").unwrap();
    assert_eq!(entry.agent_model.as_deref(), Some("axon/x"));
    assert!(entry.agent_disabled);

    let listed = list(&sb.agent(), "agents").unwrap();
    let found = listed.iter().find(|e| e.name == "reviewer.md").unwrap();
    assert!(found.agent_disabled);
    assert_eq!(found.agent_model.as_deref(), Some("axon/x"));
    let text = fs::read_to_string(sb.store().join("config.yml")).unwrap();
    assert!(text.contains("disabledAgents"));
    assert!(text.contains("agentModelOverrides"));

    let entry = set_agent_model(&sb.agent(), "reviewer.md", "").unwrap();
    assert!(entry.agent_model.is_none());
    let entry = set_agent_disabled(&sb.agent(), "reviewer.md", false).unwrap();
    assert!(!entry.agent_disabled);
}

#[test]
fn restore_agent_default_writes_bundled_content() {
    let sb = Sandbox::new("agent-restore");
    let name = bundled_agent_names().unwrap().into_iter().next().unwrap();
    fs::create_dir_all(sb.agent().join("agents")).unwrap();
    let entry = restore_agent_default(&sb.agent(), &name).unwrap();
    assert!(entry.bundled);
    assert!(entry.store_exists);
    assert_eq!(
        fs::read(sb.store().join("agents").join(&name)).unwrap(),
        fs::read(&entry.agent_path).unwrap()
    );
    write(&sb.agent(), "agents", &name, "MINE").unwrap();
    assert_eq!(fs::read_to_string(&entry.agent_path).unwrap(), "MINE");
    let entry = restore_agent_default(&sb.agent(), &name).unwrap();
    assert!(entry.bundled);
    assert_ne!(fs::read_to_string(entry.agent_path).unwrap(), "MINE");
}
