use std::path::Path;

use serde::Deserialize;

use crate::paths;

fn default_keep() -> usize {
    5
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
pub struct BackupConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_keep")]
    pub keep: usize,
}

impl Default for BackupConfig {
    fn default() -> Self {
        BackupConfig {
            enabled: false,
            keep: 5,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
struct File {
    #[serde(default)]
    backup: BackupConfig,
}

pub fn load() -> BackupConfig {
    let mut cfg = read_file().unwrap_or_default();
    if cfg.keep == 0 {
        cfg.keep = 5;
    } else if cfg.keep > 100 {
        cfg.keep = 100;
    }
    cfg
}

fn read_file() -> Option<BackupConfig> {
    let path = paths::store_dir().ok()?.join("defaults.yml");
    let text = std::fs::read_to_string(&path).ok()?;
    serde_yaml::from_str::<File>(&text).ok().map(|f| f.backup)
}

pub fn prune_siblings(path: &Path, keep: usize) {
    let keep = keep.clamp(0, 100);
    let Some(parent) = path.parent() else { return };
    let Some(base) = path.file_name().and_then(|s| s.to_str()) else {
        return;
    };
    let prefix = format!("{base}.bak.");
    let entries = std::fs::read_dir(parent);
    let Ok(entries) = entries else { return };
    let mut matches: Vec<(std::time::SystemTime, String)> = Vec::new();
    for e in entries.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        if !name.starts_with(&prefix) {
            continue;
        }
        let mtime = e
            .metadata()
            .and_then(|m| m.modified())
            .unwrap_or(std::time::UNIX_EPOCH);
        matches.push((mtime, name));
    }
    if matches.len() <= keep {
        return;
    }
    matches.sort();
    let drop = matches.len() - keep;
    for (_, name) in matches.into_iter().take(drop) {
        let _ = std::fs::remove_file(parent.join(name));
    }
}

#[cfg(test)]
mod tests;
