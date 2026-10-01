//! Integration coverage that must run against the real agent directory when one is
//! available (PI_CODING_AGENT_DIR discovery is not reliable, so these are opt-in).

use omp_ctl_lib::harness;

fn real_agent_dir_available() -> bool {
    harness::dir_info().is_ok()
}

#[test]
fn dir_info_reports_a_store_and_agent_directory() {
    if !real_agent_dir_available() {
        eprintln!("skipping: no agent directory resolvable");
        return;
    }
    let info = harness::dir_info().unwrap();
    assert!(info.store.ends_with(".omp-ctl"), "{}", info.store.display());
    assert!(!info.agent.as_os_str().is_empty());
    assert!(!info.home.as_os_str().is_empty());
}

#[test]
fn catalog_returns_models_for_first_provider() {
    if !real_agent_dir_available() {
        eprintln!("skipping: no agent directory resolvable");
        return;
    }
    let providers = harness::summaries().unwrap();
    let Some(first) = providers.first() else {
        eprintln!("skipping: no providers in agent directory");
        return;
    };
    let items = harness::catalog(first.id.clone()).unwrap();
    assert!(!items.is_empty());
    for m in &items {
        assert!(!m.id.is_empty());
    }
}

#[test]
fn prompt_catalog_covers_all_four_managed_files() {
    if !real_agent_dir_available() {
        eprintln!("skipping: no agent directory resolvable");
        return;
    }
    let states = harness::prompts().unwrap();
    let keys: Vec<&str> = states.iter().map(|s| s.key.as_str()).collect();
    assert_eq!(keys, vec!["append_system", "rules", "agents", "system"]);
    for s in &states {
        assert!(!s.store_path.as_os_str().is_empty());
        assert!(s.agent_path.display().to_string().contains(&s.name));
    }
}

#[test]
fn resources_enumerate_without_error() {
    if !real_agent_dir_available() {
        eprintln!("skipping: no agent directory resolvable");
        return;
    }
    for id in [
        "skills",
        "agents",
        "hooks_pre",
        "hooks_post",
        "extensions",
        "tools",
    ] {
        let entries = harness::resources(id.to_string()).unwrap_or_else(|e| panic!("{id}: {e}"));
        for e in &entries {
            assert_eq!(e.resource, id);
            assert!(!e.name.is_empty());
        }
    }
}

#[test]
fn overview_reports_a_version_or_none() {
    if !real_agent_dir_available() {
        eprintln!("skipping: no agent directory resolvable");
        return;
    }
    let ov = harness::overview().unwrap();
    assert!(ov.info.store.ends_with(".omp-ctl"));
    assert_eq!(ov.prompts.len(), 4);
    assert!(!ov.links.is_empty());
    let _ = ov.omp_version;
}

#[test]
fn settings_catalog_has_all_tabs() {
    if !real_agent_dir_available() {
        eprintln!("skipping: no agent directory resolvable");
        return;
    }
    let catalog = harness::settings().unwrap();
    for expected in ["appearance", "tools", "memory"] {
        assert!(
            catalog.tabs.iter().any(|t| t == expected),
            "missing tab `{expected}` in {:?}",
            catalog.tabs
        );
    }
    assert!(!catalog.entries.is_empty());
    for entry in catalog.entries.iter().take(20) {
        assert!(!entry.key.is_empty());
        assert!(!entry.ty.is_empty());
    }
}
