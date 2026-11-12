#[cfg(test)]
pub(crate) static SANDBOX_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

mod backup;
mod config_edit;
mod defaults;
pub mod error;
mod fonts;
mod keybindings;
mod mcp;
mod models;
mod overview;
mod paths;
mod presets;
mod proc;
mod prompts;
mod resources;
mod roles;
mod settings;
mod store;
mod workspaces;
mod yaml;

pub mod harness;

use std::collections::BTreeMap;
use std::path::PathBuf;

use serde::Serialize;
use serde_json::Value as JValue;

use crate::defaults::Defaults;
use crate::error::{AppError, Result};
use crate::keybindings::KeybindingsState;
use crate::mcp::McpServer;
use crate::models::{CatalogModel, ModelRef, Provider, ProviderSummary};
use crate::overview::Overview;
use crate::paths::DirInfo;
use crate::presets::PresetEntry;
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyPresetOutcome {
    pub roles: ModelRoles,
    pub workspace_synced: Option<String>,
}

/// Run a command body on the blocking pool.
///
/// Tauri executes non-async commands on the IPC thread, which is the event loop
/// thread, so every blocking body freezes the window until it returns. The
/// bodies here spawn the `omp` CLI, read and write files, and make HTTP
/// requests, so they all belong on the blocking pool. `spawn_blocking` also
/// keeps `reqwest::blocking` out of the async runtime, where it panics.
async fn offload<T, F>(body: F) -> Result<T>
where
    F: FnOnce() -> Result<T> + Send + 'static,
    T: Send + 'static,
{
    match tauri::async_runtime::spawn_blocking(body).await {
        Ok(result) => result,
        Err(e) => Err(AppError::internal(format!("command task failed: {e}"))),
    }
}

#[tauri::command]
async fn get_dirs() -> Result<DirInfo> {
    offload(move || {
        models::dir_info()
    })
    .await
}

#[tauri::command]
async fn list_providers() -> Result<Vec<Provider>> {
    offload(move || {
        models::ensure_linked()?;
        models::load_providers()
    })
    .await
}

#[tauri::command]
async fn list_provider_summaries() -> Result<Vec<ProviderSummary>> {
    offload(move || {
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
    })
    .await
}

#[tauri::command]
async fn get_provider(id: String) -> Result<Option<Provider>> {
    offload(move || {
        models::ensure_linked()?;
        Ok(models::load_providers()?.into_iter().find(|p| p.id == id))
    })
    .await
}

#[tauri::command]
async fn list_model_refs() -> Result<Vec<ModelRef>> {
    offload(move || {
        models::ensure_linked()?;
        models::list_refs()
    })
    .await
}

#[tauri::command]
async fn upsert_provider(mut provider: Provider) -> Result<SaveResult> {
    offload(move || {
        models::validate(&provider)?;
        if defaults::read().map(|d| d.enable_max_thinking).unwrap_or(false) {
            models::ensure_max_levels(&mut provider);
        }
        let before = models::provider_ids()?;
        let existed = before.iter().any(|id| id == &provider.id);
        models::save_provider(&provider)?;
        let _ = existed;
        Ok(SaveResult {
            backup: None,
            role_updates: Vec::new(),
        })
    })
    .await
}

#[tauri::command]
async fn delete_provider(id: String) -> Result<bool> {
    offload(move || {
        models::delete_provider(&id)
    })
    .await
}

#[tauri::command]
async fn rename_provider(old_id: String, new_id: String) -> Result<SaveResult> {
    offload(move || {
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
    })
    .await
}

#[tauri::command]
async fn probe_models(base_url: String, api_key: String, auth_none: bool) -> Result<Vec<String>> {
    offload(move || {
        models::probe(&base_url, &api_key, auth_none)
    })
    .await
}

#[tauri::command]
async fn catalog_models(provider: String) -> Result<Vec<CatalogModel>> {
    offload(move || {
        models::catalog(&provider)
    })
    .await
}

#[tauri::command]
async fn set_default_model(selector: String) -> Result<()> {
    offload(move || {
        let out = models::set_default_model(&selector);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn get_default_model() -> Result<Option<String>> {
    offload(move || {
        roles::get_default()
    })
    .await
}

#[tauri::command]
async fn export_snapshot() -> Result<PathBuf> {
    offload(move || {
        store::export_snapshot()
    })
    .await
}

#[tauri::command]
async fn import_snapshot(path: PathBuf) -> Result<()> {
    offload(move || {
        store::import_snapshot(&path)
    })
    .await
}

#[tauri::command]
async fn list_prompts() -> Result<Vec<PromptState>> {
    offload(move || {
        prompts::list()
    })
    .await
}

#[tauri::command]
async fn set_prompt_enabled(key: String, enabled: bool) -> Result<PromptState> {
    offload(move || {
        let out = prompts::set_enabled(&key, enabled);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn read_prompt(key: String) -> Result<String> {
    offload(move || {
        prompts::read(&key)
    })
    .await
}

#[tauri::command]
async fn write_prompt(key: String, content: String) -> Result<PromptState> {
    offload(move || {
        let out = prompts::write(&key, &content);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn restore_prompt_backup(key: String) -> Result<PromptState> {
    offload(move || {
        let out = prompts::restore_backup(&key);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn open_in_file_manager(path: String) -> Result<()> {
    offload(move || {
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
    })
    .await
}

#[tauri::command]
async fn read_config() -> Result<JValue> {
    offload(move || {
        let agent = paths::agent_dir()?;
        let _ = store::adopt(&agent, store::CONFIG)?;
        let path = store::content_path(&agent, store::CONFIG)?;
        if !path.exists() {
            return Ok(JValue::Null);
        }
        config_edit::read_json()
    })
    .await
}

#[tauri::command]
async fn link_states() -> Result<Vec<JValue>> {
    offload(move || {
        let agent = paths::agent_dir()?;
        let mut names: Vec<&str> = store::MANAGED.to_vec();
        names.push(store::MODELS);
        names.push(store::CONFIG);
        names.push(keybindings::FILE);
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
    })
    .await
}

#[tauri::command]
async fn list_settings() -> Result<SettingsCatalog> {
    offload(move || {
        let agent = paths::agent_dir()?;
        settings::list(&agent)
    })
    .await
}

#[tauri::command]
async fn set_setting(key: String, value: String) -> Result<SettingEntry> {
    offload(move || {
        let agent = paths::agent_dir()?;
        settings::set(&agent, &key, &value)
    })
    .await
}

#[tauri::command]
async fn reset_setting(key: String) -> Result<SettingEntry> {
    offload(move || {
        let agent = paths::agent_dir()?;
        settings::reset(&agent, &key)
    })
    .await
}

#[tauri::command]
async fn get_overview() -> Result<Overview> {
    offload(move || {
        overview::get()
    })
    .await
}

#[tauri::command]
async fn list_model_roles() -> Result<ModelRoles> {
    offload(move || {
        roles::list()
    })
    .await
}

#[tauri::command]
async fn set_model_role(role: String, selector: String) -> Result<ModelRoles> {
    offload(move || {
        let out = roles::set_role(&role, &selector);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn delete_model_role(role: String) -> Result<ModelRoles> {
    offload(move || {
        let out = roles::delete_role(&role);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn set_cycle_order(order: Vec<String>) -> Result<ModelRoles> {
    offload(move || {
        let out = roles::set_cycle_order(&order);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn list_resources(resource: String) -> Result<Vec<ResourceEntry>> {
    offload(move || {
        let agent = paths::agent_dir()?;
        resources::list(&agent, &resource)
    })
    .await
}

#[tauri::command]
async fn read_resource(resource: String, name: String) -> Result<String> {
    offload(move || {
        let agent = paths::agent_dir()?;
        resources::read(&agent, &resource, &name)
    })
    .await
}

#[tauri::command]
async fn write_resource(resource: String, name: String, content: String) -> Result<ResourceEntry> {
    offload(move || {
        let agent = paths::agent_dir()?;
        let out = resources::write(&agent, &resource, &name, &content);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn adopt_resource(resource: String, name: String) -> Result<ResourceEntry> {
    offload(move || {
        let agent = paths::agent_dir()?;
        let out = resources::adopt(&agent, &resource, &name);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn delete_resource(resource: String, name: String) -> Result<()> {
    offload(move || {
        let agent = paths::agent_dir()?;
        let out = resources::remove(&agent, &resource, &name);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn set_resource_enabled(resource: String, name: String, enabled: bool) -> Result<ResourceEntry> {
    offload(move || {
        let agent = paths::agent_dir()?;
        let out = resources::set_enabled(&agent, &resource, &name, enabled);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn restore_resource(resource: String, name: String) -> Result<ResourceEntry> {
    offload(move || {
        let agent = paths::agent_dir()?;
        let out = resources::restore(&agent, &resource, &name);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn unpack_bundled_agents() -> Result<Vec<ResourceEntry>> {
    offload(move || {
        let agent = paths::agent_dir()?;
        let out = resources::unpack_bundled_agents(&agent);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn set_agent_model(name: String, selector: String) -> Result<ResourceEntry> {
    offload(move || {
        let agent = paths::agent_dir()?;
        let out = resources::set_agent_model(&agent, &name, &selector);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn restore_agent_default(name: String) -> Result<ResourceEntry> {
    offload(move || {
        let agent = paths::agent_dir()?;
        let out = resources::restore_agent_default(&agent, &name);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn list_builtin_tools() -> Result<Vec<BuiltinTool>> {
    offload(move || {
        resources::builtin_tools()
    })
    .await
}

#[tauri::command]
async fn read_builtin_tool_doc(name: String) -> Result<String> {
    offload(move || {
        resources::builtin_tool_doc(&name)
    })
    .await
}

#[tauri::command]
async fn discover_skills() -> Result<Vec<DiscoveredSkill>> {
    offload(move || {
        resources::discover_skills()
    })
    .await
}

#[tauri::command]
async fn list_managed_skills() -> Result<Vec<ResourceEntry>> {
    offload(move || {
        let agent = paths::agent_dir()?;
        resources::managed_skills(&agent)
    })
    .await
}

#[tauri::command]
async fn adopt_config_file(name: String) -> Result<LinkState> {
    offload(move || {
        if name != mcp::MCP_FILE {
            return Err(AppError::validation(
                "name",
                format!("unsupported config file `{name}`"),
            ));
        }
        let agent = paths::agent_dir()?;
        store::adopt_rel(&agent, mcp::MCP_FILE)
    })
    .await
}

#[tauri::command]
async fn list_mcp_servers() -> Result<Vec<McpServer>> {
    offload(move || {
        let agent = paths::agent_dir()?;
        mcp::list(&agent)
    })
    .await
}

#[tauri::command]
async fn upsert_mcp_server(name: String, value: JValue) -> Result<McpServer> {
    offload(move || {
        let agent = paths::agent_dir()?;
        let out = mcp::upsert(&agent, &name, value);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn delete_mcp_server(name: String) -> Result<()> {
    offload(move || {
        let agent = paths::agent_dir()?;
        let out = mcp::remove(&agent, &name);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn set_mcp_server_enabled(name: String, enabled: bool) -> Result<McpServer> {
    offload(move || {
        let agent = paths::agent_dir()?;
        let out = mcp::set_enabled(&agent, &name, enabled);
        if out.is_ok() { workspaces::sync_active_quiet(); }
        out
    })
    .await
}

#[tauri::command]
async fn get_defaults() -> Result<Defaults> {
    offload(move || {
        defaults::read()
    })
    .await
}

#[tauri::command]
async fn set_defaults(defaults: Defaults) -> Result<Defaults> {
    offload(move || {
        let was_enabled = defaults::read()
            .map(|d| d.enable_max_thinking)
            .unwrap_or(false);
        let out = defaults::write(&defaults)?;
        if out.enable_max_thinking && !was_enabled {
            for mut provider in models::load_providers()? {
                models::ensure_max_levels(&mut provider);
                models::save_provider(&provider)?;
            }
        }
        Ok(out)
    })
    .await
}

#[tauri::command]
async fn list_presets() -> Result<Vec<PresetEntry>> {
    offload(move || {
        presets::list()
    })
    .await
}

#[tauri::command]
async fn save_preset(
    name: String,
    roles: BTreeMap<String, String>,
    order: Vec<String>,
) -> Result<Vec<PresetEntry>> {
    offload(move || {
        presets::save(&name, roles, order)
    })
    .await
}

#[tauri::command]
async fn delete_preset(name: String) -> Result<Vec<PresetEntry>> {
    offload(move || {
        presets::delete(&name)
    })
    .await
}

#[tauri::command]
async fn rename_preset(old_name: String, new_name: String) -> Result<Vec<PresetEntry>> {
    offload(move || {
        presets::rename(&old_name, &new_name)
    })
    .await
}

#[tauri::command]
async fn apply_preset(name: String) -> Result<ApplyPresetOutcome> {
    offload(move || {
        let active_ws = workspaces::active()?;
        let roles = presets::apply(&name)?;
        let workspace_synced = match &active_ws {
            Some(ws) => match workspaces::sync_active_roles(&roles.roles, &roles.cycle_order) {
                Ok(()) => Some(ws.clone()),
                Err(_) => {
                    let _ = workspaces::clear_active();
                    None
                }
            },
            None => None,
        };
        Ok(ApplyPresetOutcome { roles, workspace_synced })
    })
    .await
}

#[tauri::command]
async fn list_workspaces() -> Result<Vec<workspaces::WorkspaceEntry>> {
    offload(move || {
        if let Err(e) = workspaces::repair_active() {
            eprintln!("workspace repair failed: {e}");
        }
        workspaces::list()
    })
    .await
}

#[tauri::command]
async fn create_workspace(name: String) -> Result<Vec<workspaces::WorkspaceEntry>> {
    offload(move || {
        workspaces::create(&name)
    })
    .await
}

#[tauri::command]
async fn save_workspace(name: String) -> Result<Vec<workspaces::WorkspaceEntry>> {
    offload(move || {
        workspaces::save(&name)
    })
    .await
}

#[tauri::command]
async fn delete_workspace(name: String) -> Result<Vec<workspaces::WorkspaceEntry>> {
    offload(move || {
        workspaces::delete(&name)
    })
    .await
}

#[tauri::command]
async fn apply_workspace(name: String) -> Result<workspaces::WorkspaceEntry> {
    offload(move || {
        workspaces::apply(&name)
    })
    .await
}

#[tauri::command]
async fn list_keybindings() -> Result<KeybindingsState> {
    offload(move || {
        keybindings::state()
    })
    .await
}

#[tauri::command]
async fn adopt_keybindings() -> Result<KeybindingsState> {
    offload(move || {
        keybindings::adopt()
    })
    .await
}

#[tauri::command]
async fn detach_keybindings() -> Result<KeybindingsState> {
    offload(move || {
        keybindings::detach()
    })
    .await
}

#[tauri::command]
async fn set_keybinding(action: String, chords: Vec<String>) -> Result<KeybindingsState> {
    offload(move || {
        keybindings::set(&action, chords)
    })
    .await
}

#[tauri::command]
async fn remove_keybinding(action: String) -> Result<KeybindingsState> {
    offload(move || {
        keybindings::remove(&action)
    })
    .await
}

#[tauri::command]
async fn restore_keybindings_backup() -> Result<KeybindingsState> {
    offload(move || {
        keybindings::restore_backup()
    })
    .await
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocaleInfo {
    /// Best match for the system language among the locales the UI ships.
    pub system: String,
    /// Raw locale tags the OS reported, for display and debugging.
    pub detected: Vec<String>,
}

/// Report the system language so the UI can default to it.
///
/// `LC_ALL`/`LC_MESSAGES`/`LANG` are the POSIX answer and also work on macOS;
/// Windows leaves them unset, so fall back to the Win32 locale names. Only the
/// language subtag matters here: every Chinese variant maps to `zh`.
#[tauri::command]
async fn system_locale() -> Result<LocaleInfo> {
    offload(move || {
        let mut detected: Vec<String> = Vec::new();
        for key in ["LC_ALL", "LC_MESSAGES", "LANG", "LANGUAGE"] {
            if let Ok(v) = std::env::var(key) {
                for part in v.split([':', ';']) {
                    let tag = part.trim();
                    if !tag.is_empty() && !detected.iter().any(|d| d == tag) {
                        detected.push(tag.to_string());
                    }
                }
            }
        }
        #[cfg(windows)]
        {
            for key in ["USERLANG", "LANG"] {
                if let Ok(v) = std::env::var(key) {
                    if !v.is_empty() && !detected.iter().any(|d| d == &v) {
                        detected.push(v);
                    }
                }
            }
        }
        let system = detected
            .iter()
            .map(|tag| tag.to_ascii_lowercase())
            .find_map(|tag| {
                if tag.starts_with("zh") {
                    Some("zh".to_string())
                } else if tag.starts_with("en") {
                    Some("en".to_string())
                } else {
                    None
                }
            })
            .unwrap_or_else(|| "en".to_string());
        Ok(LocaleInfo { system, detected })
    })
    .await
}

#[tauri::command]
async fn list_imported_fonts() -> Result<Vec<fonts::ImportedFont>> {
    offload(move || fonts::list()).await
}

#[tauri::command]
async fn import_font(path: PathBuf) -> Result<fonts::ImportedFont> {
    offload(move || fonts::import(&path)).await
}

#[tauri::command]
async fn read_imported_font(family: String) -> Result<Vec<u8>> {
    offload(move || fonts::read(&family)).await
}

#[tauri::command]
async fn remove_imported_font(family: String) -> Result<bool> {
    offload(move || fonts::remove(&family)).await
}

pub fn run() {
    tauri::Builder::default()
        .setup(|_| {
            if let Err(e) = workspaces::repair_active() {
                eprintln!("workspace repair failed: {e}");
            }
            Ok(())
        })
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
            unpack_bundled_agents,
            set_agent_model,
            restore_agent_default,
            list_builtin_tools,
            read_builtin_tool_doc,
            discover_skills,
            list_managed_skills,
            adopt_config_file,
            list_mcp_servers,
            upsert_mcp_server,
            delete_mcp_server,
            set_mcp_server_enabled,
            get_defaults,
            set_defaults,
            list_presets,
            save_preset,
            delete_preset,
            rename_preset,
            apply_preset,
            list_keybindings,
            adopt_keybindings,
            detach_keybindings,
            set_keybinding,
            remove_keybinding,
            restore_keybindings_backup,
            list_workspaces,
            create_workspace,
            save_workspace,
            delete_workspace,
            apply_workspace,
            system_locale,
            list_imported_fonts,
            import_font,
            read_imported_font,
            remove_imported_font,
        ])
        .run(tauri::generate_context!())
        .expect("error while running omp-ctl");
}
