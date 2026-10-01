#[cfg(test)]
pub(crate) static SANDBOX_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

pub mod error;
mod config_edit;
mod models;
mod paths;
mod prompts;
mod store;
mod yaml;

pub mod harness;

use std::path::PathBuf;

use serde::Serialize;
use serde_json::Value as JValue;

use crate::error::{AppError, Result};
use crate::models::{ModelRef, Provider, ProviderSummary};
use crate::paths::DirInfo;
use crate::prompts::PromptState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub backup: Option<PathBuf>,
    pub role_updates: Vec<String>,
}

#[tauri::command]
fn get_dirs() -> Result<DirInfo> {
    models::dir_info()
}

#[tauri::command]
fn list_providers() -> Result<Vec<Provider>> {
    models::ensure_linked()?;
    models::load_providers()
}

#[tauri::command]
fn list_provider_summaries() -> Result<Vec<ProviderSummary>> {
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

#[tauri::command]
fn get_provider(id: String) -> Result<Option<Provider>> {
    models::ensure_linked()?;
    Ok(models::load_providers()?.into_iter().find(|p| p.id == id))
}

#[tauri::command]
fn list_model_refs() -> Result<Vec<ModelRef>> {
    models::ensure_linked()?;
    let mut out = Vec::new();
    for p in models::load_providers()? {
        for m in p.models {
            out.push(ModelRef {
                id: format!("{}/{}", p.id, m.id),
                name: m.name,
            });
        }
    }
    Ok(out)
}

#[tauri::command]
fn upsert_provider(provider: Provider) -> Result<SaveResult> {
    models::validate(&provider)?;
    let before = models::provider_ids()?;
    let existed = before.iter().any(|id| id == &provider.id);
    models::save_provider(&provider)?;
    let _ = existed;
    Ok(SaveResult {
        backup: None,
        role_updates: Vec::new(),
    })
}

#[tauri::command]
fn delete_provider(id: String) -> Result<bool> {
    models::delete_provider(&id)
}

#[tauri::command]
fn rename_provider(old_id: String, new_id: String) -> Result<SaveResult> {
    let mut providers = models::load_providers()?;
    let Some(index) = providers.iter().position(|p| p.id == old_id) else {
        return Err(AppError::validation("id", format!("provider `{old_id}` not found")));
    };
    if providers.iter().any(|p| p.id == new_id) {
        return Err(AppError::validation(
            "id",
            format!("provider `{new_id}` already exists"),
        ));
    }
    providers[index].id = new_id.clone();
    let provider = providers[index].clone();
    models::save_provider(&provider)?;
    models::delete_provider(&old_id)?;
    let role_updates = models::rewrite_default_roles(&old_id, &new_id)?;
    Ok(SaveResult {
        backup: None,
        role_updates,
    })
}

#[tauri::command]
fn probe_models(base_url: String, api_key: String, auth_none: bool) -> Result<Vec<String>> {
    models::probe(&base_url, &api_key, auth_none)
}

#[tauri::command]
fn set_default_model(selector: String) -> Result<()> {
    models::set_default_model(&selector)
}

#[tauri::command]
fn list_prompts() -> Result<Vec<PromptState>> {
    prompts::list()
}

#[tauri::command]
fn set_prompt_enabled(key: String, enabled: bool) -> Result<PromptState> {
    prompts::set_enabled(&key, enabled)
}

#[tauri::command]
fn read_prompt(key: String) -> Result<String> {
    prompts::read(&key)
}

#[tauri::command]
fn write_prompt(key: String, content: String) -> Result<PromptState> {
    prompts::write(&key, &content)
}

#[tauri::command]
fn restore_prompt_backup(key: String) -> Result<PromptState> {
    prompts::restore_backup(&key)
}

#[tauri::command]
fn open_in_file_manager(path: String) -> Result<()> {
    let target = PathBuf::from(&path);
    let arg = if target.is_dir() {
        target
    } else {
        target.parent().map(|p| p.to_path_buf()).unwrap_or(target)
    };
    std::process::Command::new("xdg-open")
        .arg(&arg)
        .spawn()
        .map_err(|e| AppError::fs(&arg, format!("cannot open file manager: {e}")))?;
    Ok(())
}

#[tauri::command]
fn read_config() -> Result<JValue> {
    let agent = paths::agent_dir()?;
    let path = store::store_file(store::CONFIG)?;
    if !path.exists() {
        return Ok(JValue::Null);
    }
    let _ = store::adopt(&agent, store::CONFIG)?;
    config_edit::read_json()
}

#[tauri::command]
fn link_states() -> Result<Vec<JValue>> {
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

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_dirs,
            list_providers,
            list_provider_summaries,
            get_provider,
            list_model_refs,
            upsert_provider,
            delete_provider,
            rename_provider,
            probe_models,
            set_default_model,
            list_prompts,
            set_prompt_enabled,
            read_prompt,
            write_prompt,
            restore_prompt_backup,
            open_in_file_manager,
            read_config,
            link_states,
        ])
        .run(tauri::generate_context!())
        .expect("error while running omp-ctl");
}
