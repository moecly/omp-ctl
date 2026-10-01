use std::collections::BTreeMap;
use std::path::Path;

use serde::Serialize;
use serde_json::Value as JValue;

use crate::config_edit;
use crate::error::{AppError, Result};
use crate::proc;
use crate::store;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingEntry {
    pub key: String,
    pub tab: String,
    pub value: JValue,
    pub ty: String,
    pub description: String,
    pub options: Option<Vec<String>>,
    pub configured: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsCatalog {
    pub tabs: Vec<String>,
    pub entries: Vec<SettingEntry>,
}

const KNOWN_TYPES: [&str; 6] = ["string", "number", "boolean", "array", "record", "enum"];

/// Parse `omp config list` human output into (tabs, key -> (tab, options)).
pub fn parse_human_list(
    text: &str,
) -> (Vec<String>, BTreeMap<String, (String, Option<Vec<String>>)>) {
    let mut tabs: Vec<String> = Vec::new();
    let mut map: BTreeMap<String, (String, Option<Vec<String>>)> = BTreeMap::new();
    let mut tab = String::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.starts_with('[') && trimmed.ends_with(']') && !trimmed.contains(' ') {
            tab = trimmed.trim_matches(['[', ']'].as_ref()).to_string();
            if !tabs.contains(&tab) {
                tabs.push(tab.clone());
            }
            continue;
        }
        let Some((key, rest)) = trimmed.split_once('=') else {
            continue;
        };
        let key = key.trim().to_string();
        if key.is_empty() {
            continue;
        }
        let rest = rest.trim();
        let annotation = if rest.ends_with(')') {
            rest.rfind('(').map(|i| {
                let inner = &rest[i + 1..rest.len() - 1];
                let value = rest[..i].trim().to_string();
                (inner.to_string(), value)
            })
        } else {
            None
        };
        let options = match annotation {
            Some((inner, _)) if KNOWN_TYPES.contains(&inner.as_str()) => None,
            Some((inner, _)) if inner.contains('|') => {
                Some(inner.split('|').map(|s| s.trim().to_string()).collect())
            }
            _ => None,
        };
        map.insert(key, (tab.clone(), options));
    }

    (tabs, map)
}

fn json_catalog() -> Result<BTreeMap<String, JValue>> {
    let out = proc::omp(&["config", "list", "--json"])?;
    let value: JValue = serde_json::from_str(&out)
        .map_err(|e| AppError::internal(format!("omp config list --json: {e}")))?;
    Ok(value
        .as_object()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .collect())
}

fn configured(key: &str) -> bool {
    let path: Vec<&str> = key.split('.').collect();
    config_edit::has_path(&path).unwrap_or(false)
}

fn entry_from(
    key: &str,
    meta: &JValue,
    hint: Option<&(String, Option<Vec<String>>)>,
) -> SettingEntry {
    let field = |name: &str| meta.get(name).cloned().unwrap_or(JValue::Null);
    let fallback_tab = key.split('.').next().unwrap_or(key).to_string();
    SettingEntry {
        key: key.to_string(),
        tab: hint
            .map(|(tab, _)| tab.clone())
            .filter(|t| !t.is_empty())
            .unwrap_or(fallback_tab),
        value: field("value"),
        ty: field("type").as_str().unwrap_or("string").to_string(),
        description: field("description").as_str().unwrap_or("").to_string(),
        options: hint.and_then(|(_, opts)| opts.clone()),
        configured: configured(key),
    }
}

pub fn list(_agent: &Path) -> Result<SettingsCatalog> {
    let (raw, human) = std::thread::scope(|s| {
        let json = s.spawn(json_catalog);
        let human = s.spawn(|| proc::omp(&["config", "list"]));
        (json.join().unwrap(), human.join().unwrap())
    });
    let (tabs, hints) = parse_human_list(&human?);

    let entries = raw?
        .iter()
        .map(|(key, meta)| entry_from(key, meta, hints.get(key)))
        .collect();

    Ok(SettingsCatalog { tabs, entries })
}

fn entry_for(key: &str, human: &str) -> Result<SettingEntry> {
    let out = proc::omp(&["config", "get", key, "--json"])?;
    let meta: JValue = serde_json::from_str(&out)
        .map_err(|e| AppError::internal(format!("omp config get {key}: {e}")))?;
    let (_, hints) = parse_human_list(human);
    Ok(entry_from(key, &meta, hints.get(key)))
}

pub fn set(agent: &Path, key: &str, value: &str) -> Result<SettingEntry> {
    if key.trim().is_empty() {
        return Err(AppError::validation("key", "key is required"));
    }
    store::adopt(agent, store::CONFIG)?;
    let config = store::store_file(store::CONFIG)?;
    if config.exists() {
        store::backup_file(&config)?;
    }
    proc::omp(&["config", "set", key, value])?;
    let human = proc::omp(&["config", "list"])?;
    entry_for(key, &human)
}

pub fn reset(agent: &Path, key: &str) -> Result<SettingEntry> {
    if key.trim().is_empty() {
        return Err(AppError::validation("key", "key is required"));
    }
    store::adopt(agent, store::CONFIG)?;
    let config = store::store_file(store::CONFIG)?;
    if config.exists() {
        store::backup_file(&config)?;
    }
    proc::omp(&["config", "reset", key])?;
    let human = proc::omp(&["config", "list"])?;
    entry_for(key, &human)
}

#[cfg(test)]
mod tests;
