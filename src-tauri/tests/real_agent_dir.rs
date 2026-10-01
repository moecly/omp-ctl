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
fn providers_load_from_the_resolved_agent_dir() {
    if !real_agent_dir_available() {
        eprintln!("skipping: no agent directory resolvable");
        return;
    }
    let providers = harness::summaries().unwrap();
    for p in &providers {
        assert!(!p.id.is_empty());
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
