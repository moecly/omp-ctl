use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value as JValue};

use crate::error::{AppError, Result};
use crate::store::{self, LinkKind};

pub const MCP_FILE: &str = "mcp.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServer {
    pub name: String,
    pub enabled: bool,
    pub transport: String,
    pub command: Option<String>,
    pub args: Vec<String>,
    pub url: Option<String>,
    pub raw: JValue,
}

fn file_path() -> Result<std::path::PathBuf> {
    store::store_file(MCP_FILE)
}

fn resolve(agent: &Path) -> Result<std::path::PathBuf> {
    let agent_path = agent.join(MCP_FILE);
    if agent_path.exists() {
        return Ok(agent_path);
    }
    Ok(file_path()?)
}

fn read_root(agent: &Path) -> Result<Map<String, JValue>> {
    let path = resolve(agent)?;
    let text = match fs::read_to_string(&path) {
        Ok(t) => t,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Map::new()),
        Err(e) => return Err(AppError::fs(&path, e.to_string())),
    };
    if text.trim().is_empty() {
        return Ok(Map::new());
    }
    let value: JValue =
        serde_json::from_str(&text).map_err(|e| AppError::validation("mcp.json", e.to_string()))?;
    Ok(value.as_object().cloned().unwrap_or_default())
}

fn server_from(name: &str, value: &JValue) -> McpServer {
    let enabled = value
        .get("enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    McpServer {
        name: name.to_string(),
        enabled,
        transport: value
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("stdio")
            .to_string(),
        command: value
            .get("command")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        args: value
            .get("args")
            .and_then(|v| v.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|x| x.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
        url: value
            .get("url")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        raw: value.clone(),
    }
}

fn server_value(value: &JValue) -> Map<String, JValue> {
    value.as_object().cloned().unwrap_or_default()
}

pub fn list(agent: &Path) -> Result<Vec<McpServer>> {
    let root = read_root(agent)?;
    let mut out: Vec<McpServer> = root
        .get("mcpServers")
        .and_then(|v| v.as_object())
        .map(|servers| {
            servers
                .iter()
                .map(|(name, value)| server_from(name, value))
                .collect()
        })
        .unwrap_or_default();
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

fn write_root(agent: &Path, root: &Map<String, JValue>) -> Result<()> {
    let kind = store::link_state_rel(agent, MCP_FILE)?.kind;
    let path = if kind == LinkKind::Managed {
        file_path()?
    } else {
        resolve(agent)?
    };
    if path.exists() {
        let _ = store::backup_file(&path)?;
    }
    let text = serde_json::to_string_pretty(&JValue::Object(root.clone()))?;
    store::write_atomic(&path, format!("{text}\n").as_bytes())?;
    if kind == LinkKind::Absent {
        store::adopt_rel(agent, MCP_FILE)?;
    }
    Ok(())
}

pub fn upsert(agent: &Path, name: &str, value: JValue) -> Result<McpServer> {
    if name.trim().is_empty() || name.contains('/') {
        return Err(AppError::validation("name", "invalid server name"));
    }
    let mut root = read_root(agent)?;
    let servers = root
        .entry("mcpServers".to_string())
        .or_insert_with(|| json!({}));
    if !servers.is_object() {
        *servers = json!({});
    }
    servers
        .as_object_mut()
        .expect("mcpServers forced to object")
        .insert(name.to_string(), value.clone());
    write_root(agent, &root)?;
    Ok(server_from(name, &value))
}

pub fn set_enabled(agent: &Path, name: &str, enabled: bool) -> Result<McpServer> {
    let mut root = read_root(agent)?;
    let Some(servers) = root.get_mut("mcpServers").and_then(|v| v.as_object_mut()) else {
        return Err(AppError::validation(
            "name",
            format!("server `{name}` not found"),
        ));
    };
    let Some(entry) = servers.get_mut(name) else {
        return Err(AppError::validation(
            "name",
            format!("server `{name}` not found"),
        ));
    };
    let mut obj = server_value(entry);
    obj.insert("enabled".into(), json!(enabled));
    *entry = JValue::Object(obj.clone());
    let updated = JValue::Object(obj);
    write_root(agent, &root)?;
    Ok(server_from(name, &updated))
}

pub fn remove(agent: &Path, name: &str) -> Result<()> {
    let mut root = read_root(agent)?;
    if let Some(servers) = root.get_mut("mcpServers").and_then(|v| v.as_object_mut()) {
        servers.remove(name);
    }
    write_root(agent, &root)
}

#[cfg(test)]
mod tests;
