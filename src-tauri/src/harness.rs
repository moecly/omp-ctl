//! Non-Tauri entry points into the same logic the GUI commands call.
//! Used by the headless e2e driver and by integration tests.

use std::path::PathBuf;

use serde_json::Value as JValue;

use crate::error::{AppError, Result};
use crate::models::{Provider, ProviderSummary};
use crate::paths::DirInfo;
use crate::prompts::PromptState;
use crate::{models, paths, prompts, store};

pub fn dir_info() -> Result<DirInfo> {
    paths::dir_info()
}

pub fn link_states() -> Result<Vec<JValue>> {
    let agent = paths::agent_dir()?;
    let mut names: Vec<&str> = store::MANAGED.to_vec();
    names.push(store::MODELS);
    names.push(store::CONFIG);
    names
        .into_iter()
        .map(|name| {
            let state = store::link_state(&agent, name)?;
            Ok(serde_json::json!({
                "name": name,
                "path": state.path,
                "kind": state.kind,
                "target": state.target,
            }))
        })
        .collect()
}

pub fn summaries() -> Result<Vec<ProviderSummary>> {
    models::ensure_linked()?;
    let providers = models::load_providers()?;
    Ok(providers
        .iter()
        .map(|p| ProviderSummary {
            id: p.id.clone(),
            base_url: p.base_url.clone(),
            api: p.api.clone(),
            auth_none: p.auth_none,
            model_count: p.models.len(),
            has_api_key: !p.api_key.is_empty(),
        })
        .collect())
}

pub fn provider(id: String) -> Result<Option<Provider>> {
    models::ensure_linked()?;
    Ok(models::load_providers()?.into_iter().find(|p| p.id == id))
}

pub fn upsert_from_file(path: &PathBuf) -> Result<()> {
    let text = std::fs::read_to_string(path).map_err(|e| AppError::fs(path, e.to_string()))?;
    let provider: Provider = serde_json::from_str(&text)?;
    models::validate(&provider)?;
    models::save_provider(&provider)
}

pub fn delete(id: String) -> Result<bool> {
    models::delete_provider(&id)
}

pub fn set_default(selector: String) -> Result<()> {
    models::set_default_model(&selector)
}

pub fn prompts() -> Result<Vec<PromptState>> {
    prompts::list()
}

pub fn set_prompt(key: String, enabled: bool) -> Result<PromptState> {
    prompts::set_enabled(&key, enabled)
}

pub fn read_prompt(key: String) -> Result<String> {
    prompts::read(&key)
}

pub fn write_prompt(key: String, content: String) -> Result<PromptState> {
    prompts::write(&key, &content)
}

pub fn write_prompt_from_file(key: String, path: &PathBuf) -> Result<PromptState> {
    let content = std::fs::read_to_string(path).map_err(|e| AppError::fs(path, e.to_string()))?;
    prompts::write(&key, &content)
}

pub fn restore_prompt(key: String) -> Result<PromptState> {
    prompts::restore_backup(&key)
}

pub fn probe(base_url: String, api_key: String, auth_none: bool) -> Result<Vec<String>> {
    models::probe(&base_url, &api_key, auth_none)
}

pub fn meta() -> Result<std::collections::BTreeMap<String, store::LinkMeta>> {
    store::read_meta_public()
}
