use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::{AppError, Result};
use crate::paths;

/// Fonts the user imported, kept inside the store so a snapshot carries them.
const FONT_DIR: &str = "fonts";

/// Extensions browsers can load as a webfont without conversion.
const LOADABLE: [&str; 4] = ["woff2", "woff", "ttf", "otf"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedFont {
    /// Name usable in CSS `font-family` after import: the stem of the file.
    pub family: String,
    pub file_name: String,
    pub path: PathBuf,
    pub size: u64,
}

fn font_dir() -> Result<PathBuf> {
    Ok(paths::store_dir()?.join(FONT_DIR))
}

fn extension(path: &Path) -> String {
    path.extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default()
}

/// Every imported font, newest name order, so the picker is stable.
pub fn list() -> Result<Vec<ImportedFont>> {
    let dir = font_dir()?;
    let entries = match std::fs::read_dir(&dir) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(AppError::fs(&dir, e.to_string())),
    };
    let mut out = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| AppError::fs(&dir, e.to_string()))?;
        let path = entry.path();
        if !path.is_file() || !LOADABLE.contains(&extension(&path).as_str()) {
            continue;
        }
        let Some(stem) = path.file_stem().map(|s| s.to_string_lossy().into_owned()) else {
            continue;
        };
        out.push(ImportedFont {
            family: stem,
            file_name: path
                .file_name()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default(),
            size: entry.metadata().map(|m| m.len()).unwrap_or(0),
            path,
        });
    }
    out.sort_by(|a, b| a.family.to_lowercase().cmp(&b.family.to_lowercase()));
    Ok(out)
}

/// Copy a font the user picked into the store and report its new identity.
///
/// Rejects anything the webview cannot load, so a picker mistake surfaces as a
/// validation error instead of a font that silently never applies.
pub fn import(src: &Path) -> Result<ImportedFont> {
    if !src.is_file() {
        return Err(AppError::fs(src, "font file does not exist"));
    }
    let ext = extension(src);
    if !LOADABLE.contains(&ext.as_str()) {
        return Err(AppError::validation(
            "path",
            format!(
                "unsupported font format `{ext}`; expected one of {}",
                LOADABLE.join(", ")
            ),
        ));
    }
    let stem = src
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| AppError::validation("path", "font file has no usable name"))?;

    let dir = font_dir()?;
    std::fs::create_dir_all(&dir).map_err(|e| AppError::fs(&dir, e.to_string()))?;
    let dst = dir.join(format!("{stem}.{ext}"));
    let bytes = std::fs::read(src).map_err(|e| AppError::fs(src, e.to_string()))?;
    // Overwriting keeps the name stable when the user re-imports an updated build.
    std::fs::write(&dst, &bytes).map_err(|e| AppError::fs(&dst, e.to_string()))?;

    Ok(ImportedFont {
        family: stem,
        file_name: dst
            .file_name()
            .map(|s| s.to_string_lossy().into_owned())
            .unwrap_or_default(),
        size: bytes.len() as u64,
        path: dst,
    })
}

/// Raw bytes of one imported font.
///
/// Served through IPC rather than the asset protocol so the app never has to
/// widen its filesystem scope: the UI builds a blob URL from these bytes.
pub fn read(family: &str) -> Result<Vec<u8>> {
    let wanted = family.trim();
    if wanted.is_empty() {
        return Err(AppError::validation("family", "family is required"));
    }
    let hit = list()?
        .into_iter()
        .find(|f| f.family == wanted)
        .ok_or_else(|| AppError::validation("family", format!("font `{wanted}` is not imported")))?;
    std::fs::read(&hit.path).map_err(|e| AppError::fs(&hit.path, e.to_string()))
}

/// Remove one imported font by family name.
pub fn remove(family: &str) -> Result<bool> {
    let wanted = family.trim();
    if wanted.is_empty() {
        return Err(AppError::validation("family", "family is required"));
    }
    for font in list()? {
        if font.family == wanted {
            std::fs::remove_file(&font.path)
                .map_err(|e| AppError::fs(&font.path, e.to_string()))?;
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(test)]
mod tests;
