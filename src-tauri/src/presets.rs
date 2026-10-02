use std::collections::BTreeMap;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};
use crate::roles::ModelRoles;
use crate::{config_edit, paths, roles, store};

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Preset {
    pub roles: BTreeMap<String, String>,
    pub cycle_order: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetEntry {
    pub name: String,
    pub roles: BTreeMap<String, String>,
    pub cycle_order: Vec<String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(default)]
struct PresetFile {
    presets: BTreeMap<String, Preset>,
}

fn presets_path() -> Result<PathBuf> {
    Ok(paths::store_dir()?.join("presets.yml"))
}

fn read_file() -> Result<PresetFile> {
    let path = presets_path()?;
    if !path.exists() {
        return Ok(PresetFile::default());
    }
    let text = std::fs::read_to_string(&path).map_err(|e| AppError::fs(&path, e.to_string()))?;
    serde_yaml::from_str(&text).map_err(|e| AppError::yaml(&path, e.to_string()))
}

fn write_file(file: &PresetFile) -> Result<()> {
    let path = presets_path()?;
    if path.exists() {
        store::backup_file(&path)?;
    }
    let text = serde_yaml::to_string(file).map_err(|e| AppError::internal(e.to_string()))?;
    store::write_atomic(&path, text.as_bytes())
}

fn validate_name(name: &str) -> Result<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::validation("name", "preset name is required"));
    }
    if name.contains(['/', '\\']) || name.contains("..") {
        return Err(AppError::validation(
            "name",
            "preset name must not contain `/`, `\\`, or `..`",
        ));
    }
    Ok(name.to_string())
}

fn entries(file: &PresetFile) -> Vec<PresetEntry> {
    file.presets
        .iter()
        .map(|(name, p)| PresetEntry {
            name: name.clone(),
            roles: p.roles.clone(),
            cycle_order: p.cycle_order.clone(),
        })
        .collect()
}

pub fn list() -> Result<Vec<PresetEntry>> {
    Ok(entries(&read_file()?))
}

pub fn save(name: &str, roles_map: BTreeMap<String, String>, order: Vec<String>) -> Result<Vec<PresetEntry>> {
    let name = validate_name(name)?;
    let mut file = read_file()?;
    file.presets.insert(
        name,
        Preset {
            roles: roles_map,
            cycle_order: order,
        },
    );
    write_file(&file)?;
    list()
}

pub fn delete(name: &str) -> Result<Vec<PresetEntry>> {
    let name = validate_name(name)?;
    let mut file = read_file()?;
    file.presets.remove(&name);
    write_file(&file)?;
    list()
}

pub fn apply(name: &str) -> Result<ModelRoles> {
    let name = validate_name(name)?;
    let file = read_file()?;
    let preset = file
        .presets
        .get(&name)
        .ok_or_else(|| AppError::validation("name", "preset not found"))?;

    let agent = paths::agent_dir()?;
    store::adopt(&agent, store::CONFIG)?;

    let root = config_edit::read_json()?;
    let existing: Vec<String> = root
        .get("modelRoles")
        .and_then(|v| v.as_object())
        .map(|m| m.keys().cloned().collect())
        .unwrap_or_default();
    for key in existing {
        if !preset.roles.contains_key(&key) {
            config_edit::remove_path(&["modelRoles", &key])?;
        }
    }
    for (role, selector) in &preset.roles {
        config_edit::set_str(&["modelRoles", role], selector)?;
    }
    roles::set_cycle_order(&preset.cycle_order)?;

    roles::list()
}

#[cfg(test)]
mod tests;
