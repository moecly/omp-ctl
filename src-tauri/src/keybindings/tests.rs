#![cfg(test)]

use std::fs;

use super::*;

struct Sandbox {
    root: PathBuf,
    _guard: std::sync::MutexGuard<'static, ()>,
}

impl Sandbox {
    fn new(tag: &str) -> Sandbox {
        let guard = crate::SANDBOX_LOCK
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let root = std::env::temp_dir().join(format!(
            "omp-ctl-keybindings-{tag}-{}-{:?}",
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

    fn agent(&self) -> PathBuf {
        self.root.join(".omp/agent")
    }

    fn store(&self) -> PathBuf {
        self.root.join(".omp-ctl/keybindings.yml")
    }

    fn read_store(&self) -> String {
        fs::read_to_string(self.store()).unwrap()
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

const SAMPLE: &str = "# 说明\napp.plan.toggle: Alt+Shift+P\napp.custom.thing: [F5, Ctrl+F5]\n";

#[test]
fn adopt_preserves_bytes_and_management() {
    let sb = Sandbox::new("adopt");
    fs::write(sb.agent().join(FILE), SAMPLE).unwrap();

    let state = adopt().unwrap();

    assert_eq!(sb.read_store(), SAMPLE, "store must mirror the original bytes");
    let meta = fs::symlink_metadata(sb.agent().join(FILE)).unwrap();
    assert!(meta.file_type().is_symlink(), "agent path must become a symlink");
    assert_eq!(
        fs::read_link(sb.agent().join(FILE)).unwrap(),
        sb.store(),
        "symlink must point at the store file"
    );

    assert_eq!(state.link, LinkKind::Managed);
    assert!(state.store_exists);

    let plan = state
        .bindings
        .iter()
        .find(|b| b.action == "app.plan.toggle")
        .unwrap();
    assert!(plan.overridden && !plan.disabled);
    assert_eq!(plan.chords, vec!["Alt+Shift+P"]);

    let custom = state
        .bindings
        .iter()
        .find(|b| b.action == "app.custom.thing")
        .unwrap();
    assert!(!custom.known);
    assert_eq!(custom.chords, vec!["F5", "Ctrl+F5"]);

    let cycle = state
        .bindings
        .iter()
        .find(|b| b.action == "app.thinking.cycle")
        .unwrap();
    assert!(!cycle.overridden);
    assert_eq!(cycle.chords, vec!["Shift+Tab"]);
}

#[test]
fn set_appends_and_preserves_untouched_lines() {
    let sb = Sandbox::new("set");
    fs::write(sb.agent().join(FILE), SAMPLE).unwrap();
    adopt().unwrap();

    let state = set("app.thinking.cycle", vec!["Tab".to_string()]).unwrap();

    let out = sb.read_store();
    assert!(out.contains("# 说明"), "comment lost: {out}");
    assert!(out.contains("app.custom.thing: [F5, Ctrl+F5]"), "unknown action lost: {out}");
    assert!(out.contains("app.thinking.cycle: Tab"), "new line missing: {out}");
    assert!(out.ends_with("app.thinking.cycle: Tab\n"), "must append at end: {out}");

    let cycle = state
        .bindings
        .iter()
        .find(|b| b.action == "app.thinking.cycle")
        .unwrap();
    assert!(cycle.overridden && !cycle.disabled);
    assert_eq!(cycle.chords, vec!["Tab"]);
}

#[test]
fn empty_chord_list_renders_as_disabled() {
    let sb = Sandbox::new("disabled");
    fs::write(sb.agent().join(FILE), SAMPLE).unwrap();
    set("app.thinking.cycle", vec!["Tab".to_string()]).unwrap();

    let state = set("app.thinking.cycle", Vec::new()).unwrap();

    assert!(sb.read_store().contains("app.thinking.cycle: []"));
    let cycle = state
        .bindings
        .iter()
        .find(|b| b.action == "app.thinking.cycle")
        .unwrap();
    assert!(cycle.overridden && cycle.disabled);
    assert!(cycle.chords.is_empty());
}

#[test]
fn remove_drops_the_override() {
    let sb = Sandbox::new("remove");
    fs::write(sb.agent().join(FILE), SAMPLE).unwrap();
    set("app.thinking.cycle", vec!["Tab".to_string()]).unwrap();

    let state = remove("app.thinking.cycle").unwrap();

    assert!(!sb.read_store().contains("app.thinking.cycle"));
    let cycle = state
        .bindings
        .iter()
        .find(|b| b.action == "app.thinking.cycle")
        .unwrap();
    assert!(!cycle.overridden);
    assert_eq!(cycle.chords, vec!["Shift+Tab"]);
}

#[test]
fn pure_comment_is_kept_on_rewrite() {
    let sb = Sandbox::new("comment");
    fs::write(sb.agent().join(FILE), "app.live.toggle: # 保留我\n").unwrap();

    set("app.live.toggle", vec!["Ctrl+L".to_string()]).unwrap();

    assert_eq!(sb.read_store(), "app.live.toggle: Ctrl+L # 保留我\n");
}

#[test]
fn restore_backup_returns_the_original_file() {
    let sb = Sandbox::new("restore");
    fs::write(sb.agent().join(FILE), SAMPLE).unwrap();
    adopt().unwrap();
    set("app.thinking.cycle", vec!["Tab".to_string()]).unwrap();

    let state = restore_backup().unwrap();

    let meta = fs::symlink_metadata(sb.agent().join(FILE)).unwrap();
    assert!(!meta.file_type().is_symlink(), "agent path must be a regular file again");
    assert_eq!(fs::read_to_string(sb.agent().join(FILE)).unwrap(), SAMPLE);
    assert_eq!(state.link, LinkKind::Unmanaged);
}

#[test]
fn validation_rejects_bad_input() {
    let _sb = Sandbox::new("validation");

    assert!(validate_action("").is_err());
    assert!(validate_action("a b").is_err());
    assert!(validate_action("a:b").is_err());
    assert!(validate_action("a#b").is_err());
    assert!(validate_action("app.plan.toggle").is_ok());

    assert!(validate_chord("").is_err());
    assert!(validate_chord("Ctrl P").is_err());
    assert!(validate_chord("Ctrl+").is_err());
    assert!(validate_chord("Ctrl").is_err());
    assert!(validate_chord("a,b").is_err());
    assert!(validate_chord("Ctrl+P").is_ok());

    assert!(validate_chords(&["Ctrl+P".into(), "Ctrl+P".into()]).is_err());
    assert!(validate_chords(&["Ctrl+P".into(), "Ctrl+Q".into()]).is_ok());
}

#[test]
fn unknown_action_survives_state_and_edits() {
    let sb = Sandbox::new("unknown");
    fs::write(sb.agent().join(FILE), SAMPLE).unwrap();
    adopt().unwrap();

    set("app.custom.thing", vec!["F6".to_string()]).unwrap();

    let out = sb.read_store();
    assert!(out.contains("app.custom.thing: F6"), "unknown action edit lost: {out}");
    assert!(!out.contains("Ctrl+F5"));
}
