#![cfg(test)]

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::json;

use super::*;

struct Sandbox {
    root: PathBuf,
    _guard: std::sync::MutexGuard<'static, ()>,
}

impl Sandbox {
    fn new(tag: &str) -> Sandbox {
        let guard = crate::SANDBOX_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let root = std::env::temp_dir().join(format!(
            "omp-ctl-yaml-{tag}-{}-{}",
            std::process::id(),
            crate::store::now_ts()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join(".omp-ctl/backup")).unwrap();
        fs::create_dir_all(root.join(".omp/agent")).unwrap();
        std::env::set_var("HOME", &root);
        std::env::set_var("PI_CODING_AGENT_DIR", root.join(".omp/agent"));
        Sandbox { root, _guard: guard }
    }

    fn file(&self) -> PathBuf {
        self.root.join(".omp-ctl/models.yml")
    }
}

impl Drop for Sandbox {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

const SAMPLE: &str = "\
# 顶层注释，必须保留
providers:
  axon: # 行内注释，必须保留
    baseUrl: http://localhost:8090
    api: anthropic-messages
    apiKey: secret
    models:
      - id: deepseek-v4-flash
        input:
          - text
        reasoning: true
        thinkingLevelMap:
          high: null
        contextWindow: 128000
";

fn read(path: &Path) -> String {
    fs::read_to_string(path).unwrap()
}

fn doc_text_for_debug(sb: &Sandbox) -> String {
    fs::read_to_string(sb.file()).unwrap_or_default()
}

#[test]
fn preserves_comments_and_unmodelled_keys() {
    let sb = Sandbox::new("comments");
    fs::write(sb.file(), SAMPLE).unwrap();

    let mut doc = YamlDoc::load(&sb.file()).unwrap();
    assert_eq!(doc.ids(), vec!["axon".to_string()]);

    let axon = doc.get("axon").unwrap();
    assert_eq!(axon["baseUrl"], json!("http://localhost:8090"), "raw doc:\n{}", doc_text_for_debug(&sb));
    assert_eq!(axon["models"][0]["reasoning"], json!(true));
    assert_eq!(axon["models"][0]["contextWindow"], json!(128000));
    assert_eq!(axon["models"][0]["thinkingLevelMap"]["high"], json!(null));

    // mutate the provider name only
    let mut updated = axon.clone();
    updated["baseUrl"] = json!("https://api.example.com");
    doc.set("axon", &updated).unwrap();
    doc.save(&sb.file()).unwrap();

    let out = read(&sb.file());
    assert!(out.contains("# 顶层注释，必须保留"), "top comment lost:\n{out}");
    assert!(out.contains("  axon: # 行内注释，必须保留"), "inline comment lost:\n{out}");
    assert!(out.contains("https://api.example.com"));
    assert!(out.contains("reasoning: true"), "reasoning lost:\n{out}");
    assert!(out.contains("128000"), "contextWindow lost:\n{out}");
    assert!(out.contains("thinkingLevelMap"), "thinkingLevelMap lost:\n{out}");

    let reparsed = YamlDoc::load(&sb.file()).unwrap().get("axon").unwrap();
    assert_eq!(reparsed["baseUrl"], json!("https://api.example.com"));
    assert_eq!(reparsed["models"][0]["contextWindow"], json!(128000));
}

#[test]
fn adds_second_provider_without_disturbing_first() {
    let sb = Sandbox::new("add");
    fs::write(sb.file(), SAMPLE).unwrap();

    let mut doc = YamlDoc::load(&sb.file()).unwrap();
    doc.set(
        "omptest",
        &json!({
            "baseUrl": "http://localhost:8090",
            "api": "anthropic-messages",
            "apiKey": "k",
            "models": [{ "id": "deepseek-v4-flash", "reasoning": true, "contextWindow": 128000 }],
        }),
    )
    .unwrap();
    doc.save(&sb.file()).unwrap();

    let out = read(&sb.file());
    assert!(out.contains("# 顶层注释，必须保留"));
    let doc = YamlDoc::load(&sb.file()).unwrap();
    assert_eq!(doc.ids(), vec!["axon".to_string(), "omptest".to_string()]);
    assert_eq!(doc.get("omptest").unwrap()["models"][0]["id"], json!("deepseek-v4-flash"));
    assert_eq!(doc.get("axon").unwrap()["apiKey"], json!("secret"));
}

#[test]
fn remove_drops_only_that_block() {
    let sb = Sandbox::new("remove");
    fs::write(
        sb.file(),
        "\
# keep me
providers:
  a:
    baseUrl: http://a
    api: x
  b:
    baseUrl: http://b
    api: x
",
    )
    .unwrap();

    let mut doc = YamlDoc::load(&sb.file()).unwrap();
    assert!(doc.remove("a").unwrap());
    doc.save(&sb.file()).unwrap();

    let doc = YamlDoc::load(&sb.file()).unwrap();
    assert_eq!(doc.ids(), vec!["b".to_string()]);
    assert!(read(&sb.file()).contains("# keep me"));
}

#[test]
fn rejects_invalid_yaml_without_writing() {
    let sb = Sandbox::new("invalid");
    let bad = "providers: [1,2";
    fs::write(sb.file(), bad).unwrap();
    let before = fs::read(sb.file()).unwrap();

    match YamlDoc::load(&sb.file()) {
        Err(AppError::Yaml { .. }) => {}
        Err(other) => panic!("expected yaml error, got {other:?}"),
        Ok(_) => panic!("expected yaml error, got Ok"),
    }

    assert_eq!(fs::read(sb.file()).unwrap(), before, "file must be untouched");
}

#[test]
fn save_creates_bak() {
    let sb = Sandbox::new("bak");
    fs::write(sb.file(), SAMPLE).unwrap();
    let before = fs::read(sb.file()).unwrap();

    let mut doc = YamlDoc::load(&sb.file()).unwrap();
    let mut v = doc.get("axon").unwrap();
    v["apiKey"] = json!("rotated");
    doc.set("axon", &v).unwrap();
    let backup = doc.save(&sb.file()).unwrap().expect("backup path");

    assert_eq!(fs::read(&backup).unwrap(), before);
    let name = backup.file_name().unwrap().to_string_lossy().into_owned();
    assert!(name.starts_with("models.yml.bak."), "unexpected backup name {name}");
    assert!(read(&sb.file()).contains("rotated"));
}

#[test]
fn missing_file_yields_empty_providers() {
    let sb = Sandbox::new("missing");
    let doc = YamlDoc::load(&sb.file()).unwrap();
    assert!(doc.ids().is_empty());
    assert_eq!(doc.ids(), Vec::<String>::new());
}
