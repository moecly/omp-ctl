use std::path::PathBuf;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value as JValue};

use crate::config_edit;
use crate::error::{AppError, Result};
use crate::paths::{self, DirInfo};
use crate::store;
use crate::yaml::YamlDoc;

#[cfg(test)]
mod tests;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelEntry {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api: Option<String>,
    #[serde(default)]
    pub reasoning: bool,
    #[serde(default)]
    pub image_input: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thinking_level: Option<String>,
    /// unmodelled keys carried through untouched
    #[serde(default)]
    pub raw: JValue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub api: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub auth_none: bool,
    #[serde(default)]
    pub disable_strict_tools: bool,
    #[serde(default)]
    pub models: Vec<ModelEntry>,
    #[serde(default)]
    pub raw: JValue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRef {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub thinking: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSummary {
    pub id: String,
    pub base_url: String,
    pub api: String,
    pub auth_none: bool,
    pub model_count: usize,
    pub has_api_key: bool,
}

fn obj(raw: &JValue) -> Map<String, JValue> {
    raw.as_object().cloned().unwrap_or_default()
}

impl Provider {
    pub fn from_value(id: &str, value: &JValue) -> Provider {
        let m = obj(value);
        let models = m
            .get("models")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .map(|mv| {
                        let mm = obj(mv);
                        let input = mm
                            .get("input")
                            .and_then(|v| v.as_array())
                            .map(|a| a.iter().filter_map(|x| x.as_str()).any(|s| s == "image"))
                            .unwrap_or(false);
                        ModelEntry {
                            id: mm
                                .get("id")
                                .and_then(|v| v.as_str())
                                .unwrap_or_default()
                                .to_string(),
                            name: mm
                                .get("name")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                            api: mm
                                .get("api")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                            reasoning: mm
                                .get("reasoning")
                                .and_then(|v| v.as_bool())
                                .unwrap_or(false),
                            image_input: input,
                            context_window: mm.get("contextWindow").and_then(|v| v.as_u64()),
                            max_tokens: mm.get("maxTokens").and_then(|v| v.as_u64()),
                            thinking_level: mm
                                .get("thinkingLevelMap")
                                .and_then(|v| v.as_object())
                                .and_then(|o| o.keys().next().cloned()),
                            raw: mv.clone(),
                        }
                    })
                    .collect()
            })
            .unwrap_or_default();

        Provider {
            id: id.to_string(),
            base_url: m
                .get("baseUrl")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            api: m
                .get("api")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            api_key: m
                .get("apiKey")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            auth_none: m.get("authNone").and_then(|v| v.as_bool()).unwrap_or(false),
            disable_strict_tools: m
                .get("disableStrictTools")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            models,
            raw: value.clone(),
        }
    }

    /// Merge modelled fields onto the untouched original mapping.
    pub fn to_value(&self) -> Result<JValue> {
        let mut m = obj(&self.raw);
        m.remove("models");

        m.insert("baseUrl".into(), json!(self.base_url));
        set_or_remove(&mut m, "api", opt(self.api.trim()));
        if self.auth_none {
            m.insert("authNone".into(), json!(true));
            m.remove("apiKey");
        } else {
            m.remove("authNone");
            set_or_remove(&mut m, "apiKey", opt(self.api_key.trim()));
        }
        set_bool(&mut m, "disableStrictTools", self.disable_strict_tools);

        let mut models: Vec<JValue> = Vec::with_capacity(self.models.len());
        for entry in &self.models {
            let mut em = obj(&entry.raw);
            em.insert("id".into(), json!(entry.id));
            set_or_remove(&mut em, "name", opt_of(entry.name.as_deref()));
            set_or_remove(&mut em, "api", opt_of(entry.api.as_deref()));
            set_bool(&mut em, "reasoning", entry.reasoning);
            em.insert(
                "input".into(),
                if entry.image_input {
                    json!(["text", "image"])
                } else {
                    json!(["text"])
                },
            );
            set_num(&mut em, "contextWindow", entry.context_window);
            set_num(&mut em, "maxTokens", entry.max_tokens);
            match entry.thinking_level.as_deref().map(str::trim) {
                Some(level) if !level.is_empty() && level != "off" => {
                    em.insert("thinkingLevelMap".into(), json!({ level: JValue::Null }));
                }
                _ => {
                    em.remove("thinkingLevelMap");
                }
            }
            models.push(JValue::Object(em));
        }
        m.insert("models".into(), JValue::Array(models));
        Ok(JValue::Object(m))
    }
}

fn opt(s: &str) -> Option<String> {
    if s.is_empty() {
        None
    } else {
        Some(s.to_string())
    }
}

fn opt_of(s: Option<&str>) -> Option<String> {
    s.map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

fn set_or_remove(m: &mut Map<String, JValue>, key: &str, value: Option<String>) {
    match value {
        Some(v) => {
            m.insert(key.to_string(), json!(v));
        }
        None => {
            m.remove(key);
        }
    }
}

fn set_bool(m: &mut Map<String, JValue>, key: &str, value: bool) {
    if value {
        m.insert(key.to_string(), json!(true));
    } else {
        m.remove(key);
    }
}

fn set_num(m: &mut Map<String, JValue>, key: &str, value: Option<u64>) {
    match value {
        Some(v) => {
            m.insert(key.to_string(), json!(v));
        }
        None => {
            m.remove(key);
        }
    }
}

fn models_path() -> Result<PathBuf> {
    Ok(store::store_file(store::MODELS)?)
}

pub fn load_providers() -> Result<Vec<Provider>> {
    let path = models_path()?;
    let doc = YamlDoc::load(&path)?;
    let mut out = Vec::new();
    for id in doc.ids() {
        if let Some(value) = doc.get(&id) {
            out.push(Provider::from_value(&id, &value));
        }
    }
    Ok(out)
}

pub fn provider_ids() -> Result<Vec<String>> {
    let path = models_path()?;
    Ok(YamlDoc::load(&path)?.ids())
}

/// Route every models.yml read/write through the store link.
pub fn ensure_linked() -> Result<PathBuf> {
    let agent = paths::agent_dir()?;
    store::adopt(&agent, store::MODELS)?;
    store::store_file(store::MODELS)
}

pub fn save_provider(p: &Provider) -> Result<()> {
    validate(p)?;
    let path = ensure_linked()?;
    let mut doc = YamlDoc::load(&path)?;
    doc.set(&p.id, &p.to_value()?)?;
    doc.save(&path)?;
    Ok(())
}

pub fn delete_provider(id: &str) -> Result<bool> {
    let path = ensure_linked()?;
    let mut doc = YamlDoc::load(&path)?;
    let removed = doc.remove(id)?;
    if removed {
        doc.save(&path)?;
    }
    Ok(removed)
}

pub const VALID_APIS: [&str; 11] = [
    "openai-completions",
    "openai-responses",
    "openai-codex-responses",
    "azure-openai-responses",
    "anthropic-messages",
    "bedrock-converse-stream",
    "google-generative-ai",
    "google-gemini-cli",
    "google-vertex",
    "openrouter-decisions",
    "typesafe",
];

fn check_api(field: &str, api: &str) -> Result<()> {
    if VALID_APIS.contains(&api.trim()) {
        return Ok(());
    }
    Err(AppError::validation(
        field,
        format!("unknown api `{}` (must be one of {})", api.trim(), VALID_APIS.join(", ")),
    ))
}

pub fn validate(p: &Provider) -> Result<()> {
    if p.id.trim().is_empty() {
        return Err(AppError::validation("id", "provider id is required"));
    }
    if p.base_url.trim().is_empty() {
        return Err(AppError::validation("baseUrl", "baseUrl is required"));
    }
    if !p.auth_none && p.api_key.trim().is_empty() {
        return Err(AppError::validation(
            "apiKey",
            "apiKey is required unless auth=none",
        ));
    }
    let any_model_api = p.models.iter().any(|m| {
        m.api
            .as_deref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false)
    });
    if p.api.trim().is_empty() && !any_model_api {
        return Err(AppError::validation(
            "api",
            "provider api or every model api must be set",
        ));
    }
    if !p.api.trim().is_empty() {
        check_api("api", &p.api)?;
    }
    let mut seen = std::collections::BTreeSet::new();
    for m in &p.models {
        if m.id.trim().is_empty() {
            return Err(AppError::validation("models", "model id is required"));
        }
        if let Some(api) = m.api.as_deref().filter(|s| !s.trim().is_empty()) {
            check_api("models.api", api)?;
        }
        if !seen.insert(m.id.clone()) {
            return Err(AppError::validation(
                "models",
                format!("duplicate model id `{}`", m.id),
            ));
        }
    }
    Ok(())
}

fn models_url(base_url: &str) -> String {
    let base = base_url.trim().trim_end_matches('/');
    if base.ends_with("/v1") {
        format!("{base}/models")
    } else {
        format!("{base}/v1/models")
    }
}

pub fn probe(base_url: &str, api_key: &str, auth_none: bool) -> Result<Vec<String>> {
    if base_url.trim().is_empty() {
        return Err(AppError::validation("baseUrl", "baseUrl is required"));
    }
    let url = models_url(base_url);
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::probe(None, e.to_string()))?;

    let mut req = client.get(&url);
    if !auth_none {
        req = req.header("Authorization", format!("Bearer {}", api_key.trim()));
    }

    let resp = req
        .send()
        .map_err(|e| AppError::probe(None, format!("{url}: {e}")))?;
    let status = resp.status();
    let body = resp.text().unwrap_or_default();
    if !status.is_success() {
        return Err(AppError::probe(Some(status.as_u16()), truncate(&body, 400)));
    }

    let parsed: JValue = serde_json::from_str(&body)
        .map_err(|e| AppError::probe(Some(status.as_u16()), format!("invalid JSON: {e}")))?;

    let ids = parsed
        .get("data")
        .and_then(|v| v.as_array())
        .or_else(|| parsed.get("models").and_then(|v| v.as_array()))
        .map(|arr| {
            arr.iter()
                .filter_map(|m| {
                    m.get("id")
                        .or_else(|| m.get("name"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if ids.is_empty() {
        return Err(AppError::probe(
            Some(status.as_u16()),
            "no model ids found in response",
        ));
    }
    Ok(ids)
}

fn truncate(s: &str, n: usize) -> String {
    if s.len() <= n {
        s.to_string()
    } else {
        format!("{}…", &s[..n])
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogModel {
    pub provider: String,
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u64>,
    #[serde(default)]
    pub reasoning: bool,
    #[serde(default)]
    pub thinking: Vec<String>,
    #[serde(default)]
    pub image_input: bool,
}

fn parse_catalog(out: &str, provider: Option<&str>) -> Vec<CatalogModel> {
    let parsed: JValue = serde_json::from_str(out).unwrap_or(JValue::Null);
    let arr = parsed
        .get("models")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    arr.iter()
        .filter_map(|m| {
            let p = m
                .get("provider")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            let sel = m
                .get("selector")
                .and_then(|v| v.as_str())
                .unwrap_or_default();
            if let Some(want) = provider {
                let head = sel.split('/').next().unwrap_or(p);
                if p != want && head != want && sel != want {
                    return None;
                }
            }
            let id = m.get("id").and_then(|v| v.as_str())?.to_string();
            let input_image = m
                .get("input")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|x| x.as_str()).any(|s| s == "image"))
                .unwrap_or(false);
            Some(CatalogModel {
                provider: p.to_string(),
                id,
                name: m
                    .get("name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                context_window: m.get("contextWindow").and_then(|v| v.as_u64()),
                max_tokens: m.get("maxTokens").and_then(|v| v.as_u64()),
                reasoning: m
                    .get("reasoning")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false),
                thinking: m
                    .get("thinking")
                    .and_then(|v| v.as_array())
                    .map(|a| {
                        a.iter()
                            .filter_map(|x| x.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default(),
                image_input: input_image,
            })
        })
        .collect()
}

pub fn catalog(provider: &str) -> Result<Vec<CatalogModel>> {
    let id = provider.trim();
    if id.is_empty() {
        return Err(AppError::validation("provider", "provider id is required"));
    }
    if let Ok(out) = crate::proc::omp(&["models", id, "--json"]) {
        let mut items = parse_catalog(&out, Some(id));
        if !items.is_empty() {
            for m in &mut items {
                if m.provider.is_empty() {
                    m.provider = id.to_string();
                }
            }
            return Ok(items);
        }
    }
    match crate::proc::omp(&["models", "--json"]) {
        Ok(out) => Ok(parse_catalog(&out, Some(id))),
        Err(e) => Err(e),
    }
}

pub fn set_default_model(selector: &str) -> Result<()> {
    if selector.trim().is_empty() {
        return Err(AppError::validation(
            "selector",
            "model selector is required",
        ));
    }
    let agent = paths::agent_dir()?;
    store::adopt(&agent, store::CONFIG)?;
    config_edit::set_str(&["modelRoles", "default"], selector.trim())
}

/// Re-point `modelRoles.*` selectors whose `<provider>/<model>[:level]` head changed.
pub fn rewrite_default_roles(old_id: &str, new_id: &str) -> Result<Vec<String>> {
    if old_id == new_id {
        return Ok(Vec::new());
    }
    let agent = paths::agent_dir()?;
    store::adopt(&agent, store::CONFIG)?;
    let mut root = config_edit::read_json()?;
    let Some(roles) = root.get_mut("modelRoles").and_then(|v| v.as_object_mut()) else {
        return Ok(Vec::new());
    };

    let prefix = format!("{old_id}/");
    let mut changed = Vec::new();
    for (role, value) in roles.iter_mut() {
        let Some(current) = value.as_str() else {
            continue;
        };
        if !current.starts_with(&prefix) {
            continue;
        }
        let updated = format!("{new_id}/{}", &current[prefix.len()..]);
        changed.push(format!("{role}: {current} -> {updated}"));
        *value = json!(updated);
    }
    if !changed.is_empty() {
        let text = serde_yaml::to_string(&root)
            .map_err(|e| AppError::internal(format!("cannot serialize config.yml: {e}")))?;
        let path = store::store_file(store::CONFIG)?;
        let _ = store::backup_file(&path)?;
        store::write_atomic(&path, text.as_bytes())?;
    }
    Ok(changed)
}

pub fn dir_info() -> Result<DirInfo> {
    paths::dir_info()
}
