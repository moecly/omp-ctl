use std::collections::BTreeMap;

use serde::Serialize;

use crate::config_edit;
use crate::error::{AppError, Result};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelRoles {
    pub roles: BTreeMap<String, String>,
    pub cycle_order: Vec<String>,
}

pub fn list() -> Result<ModelRoles> {
    let root = config_edit::read_json()?;
    let mut roles = BTreeMap::new();
    if let Some(map) = root.get("modelRoles").and_then(|v| v.as_object()) {
        for (role, value) in map {
            if let Some(selector) = value.as_str() {
                roles.insert(role.clone(), selector.to_string());
            }
        }
    }
    let cycle_order = root
        .get("cycleOrder")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();
    Ok(ModelRoles { roles, cycle_order })
}

fn validate_role(role: &str) -> Result<String> {
    let role = role.trim();
    if role.is_empty() {
        return Err(AppError::validation("role", "role name is required"));
    }
    if role.contains([':', '#', ' ']) {
        return Err(AppError::validation(
            "role",
            "role name must not contain `:`, `#`, or whitespace",
        ));
    }
    Ok(role.to_string())
}

pub fn set_role(role: &str, selector: &str) -> Result<ModelRoles> {
    let role = validate_role(role)?;
    let selector = selector.trim();
    if selector.is_empty() {
        return Err(AppError::validation("selector", "selector is required"));
    }
    config_edit::set_str(&["modelRoles", &role], selector)?;
    list()
}

pub fn delete_role(role: &str) -> Result<ModelRoles> {
    let role = validate_role(role)?;
    config_edit::remove_path(&["modelRoles", &role])?;
    list()
}

pub fn set_cycle_order(order: &[String]) -> Result<ModelRoles> {
    let raw = serde_json::to_string(order)?;
    config_edit::set_raw(&["cycleOrder"], &raw)?;
    list()
}

#[cfg(test)]
mod tests;
