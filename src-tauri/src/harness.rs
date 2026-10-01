//! Non-Tauri entry points into the same logic the GUI commands call.
//! Used by the headless e2e driver and by integration tests.

use std::path::PathBuf;

use serde_json::Value as JValue;

use crate::error::{AppError, Result};
use crate::mcp::McpServer;
use crate::models::{Provider, ProviderSummary};
use crate::overview::Overview;
use crate::paths::DirInfo;
use crate::prompts::PromptState;
use crate::resources::{BuiltinTool, DiscoveredSkill, ResourceEntry};
use crate::roles::ModelRoles;
use crate::settings::{SettingEntry, SettingsCatalog};
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

pub fn overview() -> Result<Overview> {
    crate::overview::get()
}

pub fn settings() -> Result<SettingsCatalog> {
    let agent = paths::agent_dir()?;
    crate::settings::list(&agent)
}

pub fn set_setting(key: String, value: String) -> Result<SettingEntry> {
    let agent = paths::agent_dir()?;
    crate::settings::set(&agent, &key, &value)
}

pub fn reset_setting(key: String) -> Result<SettingEntry> {
    let agent = paths::agent_dir()?;
    crate::settings::reset(&agent, &key)
}

pub fn model_roles() -> Result<ModelRoles> {
    crate::roles::list()
}

pub fn set_model_role(role: String, selector: String) -> Result<ModelRoles> {
    crate::roles::set_role(&role, &selector)
}

pub fn delete_model_role(role: String) -> Result<ModelRoles> {
    crate::roles::delete_role(&role)
}

pub fn set_cycle_order(order: Vec<String>) -> Result<ModelRoles> {
    crate::roles::set_cycle_order(&order)
}

pub fn resources(resource: String) -> Result<Vec<ResourceEntry>> {
    let agent = paths::agent_dir()?;
    crate::resources::list(&agent, &resource)
}

pub fn read_resource(resource: String, name: String) -> Result<String> {
    let agent = paths::agent_dir()?;
    crate::resources::read(&agent, &resource, &name)
}

pub fn write_resource(resource: String, name: String, content: String) -> Result<ResourceEntry> {
    let agent = paths::agent_dir()?;
    crate::resources::write(&agent, &resource, &name, &content)
}

pub fn adopt_resource(resource: String, name: String) -> Result<ResourceEntry> {
    let agent = paths::agent_dir()?;
    crate::resources::adopt(&agent, &resource, &name)
}

pub fn delete_resource(resource: String, name: String) -> Result<()> {
    let agent = paths::agent_dir()?;
    crate::resources::remove(&agent, &resource, &name)
}

pub fn set_resource_enabled(
    resource: String,
    name: String,
    enabled: bool,
) -> Result<ResourceEntry> {
    let agent = paths::agent_dir()?;
    crate::resources::set_enabled(&agent, &resource, &name, enabled)
}

pub fn restore_resource(resource: String, name: String) -> Result<ResourceEntry> {
    let agent = paths::agent_dir()?;
    crate::resources::restore(&agent, &resource, &name)
}

pub fn builtin_tools() -> Result<Vec<BuiltinTool>> {
    crate::resources::builtin_tools()
}

pub fn builtin_tool_doc(name: String) -> Result<String> {
    crate::resources::builtin_tool_doc(&name)
}

pub fn discover_skills() -> Result<Vec<DiscoveredSkill>> {
    crate::resources::discover_skills()
}

pub fn managed_skills() -> Result<Vec<ResourceEntry>> {
    let agent = paths::agent_dir()?;
    crate::resources::managed_skills(&agent)
}

pub fn adopt_config_file(name: String) -> Result<store::LinkState> {
    if name != crate::mcp::MCP_FILE {
        return Err(AppError::validation(
            "name",
            format!("unsupported config file `{name}`"),
        ));
    }
    let agent = paths::agent_dir()?;
    store::adopt_rel(&agent, crate::mcp::MCP_FILE)
}

pub fn mcp_servers() -> Result<Vec<McpServer>> {
    let agent = paths::agent_dir()?;
    crate::mcp::list(&agent)
}

pub fn upsert_mcp_server(name: String, value: JValue) -> Result<McpServer> {
    let agent = paths::agent_dir()?;
    crate::mcp::upsert(&agent, &name, value)
}

pub fn delete_mcp_server(name: String) -> Result<()> {
    let agent = paths::agent_dir()?;
    crate::mcp::remove(&agent, &name)
}

pub fn set_mcp_server_enabled(name: String, enabled: bool) -> Result<McpServer> {
    let agent = paths::agent_dir()?;
    crate::mcp::set_enabled(&agent, &name, enabled)
}
