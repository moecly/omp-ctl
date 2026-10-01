#[cfg(test)]
pub(crate) static SANDBOX_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

mod config_edit;
pub mod error;
mod mcp;
mod models;
mod overview;
mod paths;
mod proc;
mod prompts;
mod resources;
mod roles;
mod settings;
mod store;
mod yaml;

pub mod harness;

use std::path::PathBuf;

use serde::Serialize;
use serde_json::Value as JValue;

use crate::error::{AppError, Result};
use crate::mcp::McpServer;
use crate::models::{CatalogModel, ModelRef, Provider, ProviderSummary};
use crate::overview::Overview;
use crate::paths::DirInfo;
use crate::prompts::PromptState;
use crate::resources::{BuiltinTool, DiscoveredSkill, ResourceEntry};
use crate::roles::ModelRoles;
use crate::settings::{SettingEntry, SettingsCatalog};
use crate::store::LinkState;

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
        return Err(AppError::validation(
            "id",
            format!("provider `{old_id}` not found"),
        ));
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
fn catalog_models(provider: String) -> Result<Vec<CatalogModel>> {
    models::catalog(&provider)
}

#[tauri::command]
fn set_default_model(selector: String) -> Result<()> {
    models::set_default_model(&selector)
}

#[tauri::command]
fn get_default_model() -> Result<Option<String>> {
    roles::get_default()
}

#[tauri::command]
fn export_snapshot() -> Result<PathBuf> {
    store::export_snapshot()
}

#[tauri::command]
fn import_snapshot(path: PathBuf) -> Result<()> {
    store::import_snapshot(&path)
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

#[tauri::command]
fn list_settings() -> Result<SettingsCatalog> {
    let agent = paths::agent_dir()?;
    settings::list(&agent)
}

#[tauri::command]
fn set_setting(key: String, value: String) -> Result<SettingEntry> {
    let agent = paths::agent_dir()?;
    settings::set(&agent, &key, &value)
}

#[tauri::command]
fn reset_setting(key: String) -> Result<SettingEntry> {
    let agent = paths::agent_dir()?;
    settings::reset(&agent, &key)
}

#[tauri::command]
fn get_overview() -> Result<Overview> {
    overview::get()
}

#[tauri::command]
fn list_model_roles() -> Result<ModelRoles> {
    roles::list()
}

#[tauri::command]
fn set_model_role(role: String, selector: String) -> Result<ModelRoles> {
    roles::set_role(&role, &selector)
}

#[tauri::command]
fn delete_model_role(role: String) -> Result<ModelRoles> {
    roles::delete_role(&role)
}

#[tauri::command]
fn set_cycle_order(order: Vec<String>) -> Result<ModelRoles> {
    roles::set_cycle_order(&order)
}

#[tauri::command]
fn list_resources(resource: String) -> Result<Vec<ResourceEntry>> {
    let agent = paths::agent_dir()?;
    resources::list(&agent, &resource)
}

#[tauri::command]
fn read_resource(resource: String, name: String) -> Result<String> {
    let agent = paths::agent_dir()?;
    resources::read(&agent, &resource, &name)
}

#[tauri::command]
fn write_resource(resource: String, name: String, content: String) -> Result<ResourceEntry> {
    let agent = paths::agent_dir()?;
    resources::write(&agent, &resource, &name, &content)
}

#[tauri::command]
fn adopt_resource(resource: String, name: String) -> Result<ResourceEntry> {
    let agent = paths::agent_dir()?;
    resources::adopt(&agent, &resource, &name)
}

#[tauri::command]
fn delete_resource(resource: String, name: String) -> Result<()> {
    let agent = paths::agent_dir()?;
    resources::remove(&agent, &resource, &name)
}

#[tauri::command]
fn set_resource_enabled(resource: String, name: String, enabled: bool) -> Result<ResourceEntry> {
    let agent = paths::agent_dir()?;
    resources::set_enabled(&agent, &resource, &name, enabled)
}

#[tauri::command]
fn restore_resource(resource: String, name: String) -> Result<ResourceEntry> {
    let agent = paths::agent_dir()?;
    resources::restore(&agent, &resource, &name)
}

#[tauri::command]
fn list_builtin_tools() -> Result<Vec<BuiltinTool>> {
    resources::builtin_tools()
}

#[tauri::command]
fn read_builtin_tool_doc(name: String) -> Result<String> {
    resources::builtin_tool_doc(&name)
}

#[tauri::command]
fn discover_skills() -> Result<Vec<DiscoveredSkill>> {
    resources::discover_skills()
}

#[tauri::command]
fn list_managed_skills() -> Result<Vec<ResourceEntry>> {
    let agent = paths::agent_dir()?;
    resources::managed_skills(&agent)
}

#[tauri::command]
fn adopt_config_file(name: String) -> Result<LinkState> {
    if name != mcp::MCP_FILE {
        return Err(AppError::validation(
            "name",
            format!("unsupported config file `{name}`"),
        ));
    }
    let agent = paths::agent_dir()?;
    store::adopt_rel(&agent, mcp::MCP_FILE)
}

#[tauri::command]
fn list_mcp_servers() -> Result<Vec<McpServer>> {
    let agent = paths::agent_dir()?;
    mcp::list(&agent)
}

#[tauri::command]
fn upsert_mcp_server(name: String, value: JValue) -> Result<McpServer> {
    let agent = paths::agent_dir()?;
    mcp::upsert(&agent, &name, value)
}

#[tauri::command]
fn delete_mcp_server(name: String) -> Result<()> {
    let agent = paths::agent_dir()?;
    mcp::remove(&agent, &name)
}

#[tauri::command]
fn set_mcp_server_enabled(name: String, enabled: bool) -> Result<McpServer> {
    let agent = paths::agent_dir()?;
    mcp::set_enabled(&agent, &name, enabled)
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
            catalog_models,
            set_default_model,
            get_default_model,
            list_prompts,
            set_prompt_enabled,
            read_prompt,
            write_prompt,
            restore_prompt_backup,
            open_in_file_manager,
            read_config,
            link_states,
            get_overview,
            list_settings,
            set_setting,
            reset_setting,
            list_model_roles,
            set_model_role,
            delete_model_role,
            set_cycle_order,
            export_snapshot,
            import_snapshot,
            list_resources,
            read_resource,
            write_resource,
            adopt_resource,
            delete_resource,
            set_resource_enabled,
            restore_resource,
            list_builtin_tools,
            read_builtin_tool_doc,
            discover_skills,
            list_managed_skills,
            adopt_config_file,
            list_mcp_servers,
            upsert_mcp_server,
            delete_mcp_server,
            set_mcp_server_enabled,
        ])
        .run(tauri::generate_context!())
        .expect("error while running omp-ctl");
}
