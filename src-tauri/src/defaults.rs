use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};
use crate::{paths, store};

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ModelDefaults {
    pub api: Option<String>,
    pub reasoning: bool,
    pub image_input: bool,
    pub context_window: Option<u64>,
    pub max_tokens: Option<u64>,
    pub thinking_level: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Defaults {
    pub model: ModelDefaults,
    pub role_thinking_level: Option<String>,
}

fn defaults_path() -> Result<PathBuf> {
    Ok(paths::store_dir()?.join("defaults.yml"))
}

pub fn read() -> Result<Defaults> {
    let path = defaults_path()?;
    if !path.exists() {
        return Ok(Defaults::default());
    }
    let text = std::fs::read_to_string(&path).map_err(|e| AppError::fs(&path, e.to_string()))?;
    serde_yaml::from_str(&text).map_err(|e| AppError::yaml(&path, e.to_string()))
}

pub fn write(d: &Defaults) -> Result<Defaults> {
    let path = defaults_path()?;
    if path.exists() {
        store::backup_file(&path)?;
    }
    let text = serde_yaml::to_string(d).map_err(|e| AppError::internal(e.to_string()))?;
    store::write_atomic(&path, text.as_bytes())?;
    read()
}

#[cfg(test)]
mod tests;
