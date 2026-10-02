use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value as JValue;

use crate::config_edit;
use crate::error::Result;
use crate::paths::DirInfo;
use crate::prompts::PromptState;
use crate::store::{self, LinkKind};
use crate::{mcp, paths, proc, prompts, resources};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSummary {
    pub id: String,
    pub base_url: String,
    pub api: String,
    pub auth_none: bool,
    pub model_count: usize,
    pub has_api_key: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkStateRow {
    pub name: String,
    pub path: PathBuf,
    pub kind: LinkKind,
    pub target: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Overview {
    pub info: DirInfo,
    pub omp_version: Option<String>,
    pub providers: Vec<ProviderSummary>,
    pub model_count: usize,
    pub model_roles: BTreeMap<String, String>,
    pub cycle_order: Vec<String>,
    pub prompts: Vec<PromptState>,
    pub resource_counts: BTreeMap<String, usize>,
    pub mcp_servers: usize,
    pub memory_backend: Option<String>,
    pub approval_mode: Option<String>,
    pub enabled_models: Vec<JValue>,
    pub disabled_extensions: Vec<JValue>,
    pub links: Vec<LinkStateRow>,
}

fn string_field(root: &JValue, path: &[&str]) -> Option<String> {
    let mut cur = root;
    for key in path {
        cur = cur.get(key)?;
    }
    cur.as_str().map(|s| s.to_string())
}

fn array_field(root: &JValue, key: &str) -> Vec<JValue> {
    root.get(key)
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default()
}

fn links_of(agent: &Path) -> Result<Vec<LinkStateRow>> {
    let mut names: Vec<String> = store::MANAGED.iter().map(|s| s.to_string()).collect();
    names.push(store::MODELS.to_string());
    names.push(store::CONFIG.to_string());
    names.push(mcp::MCP_FILE.to_string());
    names.push(crate::keybindings::FILE.to_string());
    let mut out = Vec::new();
    for name in names {
        let state = store::link_state(agent, &name)?;
        out.push(LinkStateRow {
            name,
            path: state.path,
            kind: state.kind,
            target: state.target.map(|t| t.to_string_lossy().into_owned()),
        });
    }
    Ok(out)
}

pub fn get() -> Result<Overview> {
    let version = std::thread::spawn(|| proc::omp(&["--version"]));
    let info = paths::dir_info()?;
    let agent = info.agent.clone();
    let providers: Vec<ProviderSummary> = crate::models::load_providers()?
        .into_iter()
        .map(|p| ProviderSummary {
            id: p.id,
            base_url: p.base_url,
            api: p.api,
            auth_none: p.auth_none,
            model_count: p.models.len(),
            has_api_key: !p.api_key.is_empty(),
        })
        .collect();
    let model_count = providers.iter().map(|p| p.model_count).sum();

    let config = config_edit::read_json().unwrap_or(JValue::Null);
    let mut model_roles = BTreeMap::new();
    if let Some(roles) = config.get("modelRoles").and_then(|v| v.as_object()) {
        for (role, value) in roles {
            if let Some(selector) = value.as_str() {
                model_roles.insert(role.clone(), selector.to_string());
            }
        }
    }
    let cycle_order = config
        .get("cycleOrder")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let mut resource_counts = BTreeMap::new();
    for spec in resources::RESOURCES.iter() {
        resource_counts.insert(spec.id.to_string(), resources::list(&agent, spec.id)?.len());
    }

    let mcp_servers = mcp::list(&agent).map(|s| s.len()).unwrap_or(0);

    let version = version.join().unwrap();
    Ok(Overview {
        omp_version: version.ok().map(|s| s.trim().to_string()),
        providers,
        model_count,
        model_roles,
        cycle_order,
        prompts: prompts::list()?,
        resource_counts,
        mcp_servers,
        memory_backend: string_field(&config, &["memory", "backend"]),
        approval_mode: string_field(&config, &["tools", "approvalMode"]),
        enabled_models: array_field(&config, "enabledModels"),
        disabled_extensions: array_field(&config, "disabledExtensions"),
        links: links_of(&agent)?,
        info,
    })
}
