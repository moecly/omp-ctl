use std::fs;
use std::path::Path;

use serde_json::{json, Value as JValue};

use crate::error::{AppError, Result};
use crate::store;

fn config_path() -> Result<std::path::PathBuf> {
    store::store_file(store::CONFIG)
}

pub fn read_json() -> Result<JValue> {
    let path = config_path()?;
    let text = match fs::read_to_string(&path) {
        Ok(t) => t,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(json!({})),
        Err(e) => return Err(AppError::fs(&path, e.to_string())),
    };
    if text.trim().is_empty() {
        return Ok(json!({}));
    }
    serde_yaml::from_str(&text).map_err(|e| AppError::yaml(&path, e.to_string()))
}

/// comment-preserving scalar write at a nested mapping path
pub fn set_str(path: &[&str], value: &str) -> Result<()> {
    set_raw(path, value)
}

/// Comment-preserving write of raw YAML text at a nested mapping path.
/// `raw` is an already-serialized YAML scalar or flow collection.
pub fn set_raw(path: &[&str], raw: &str) -> Result<()> {
    if path.is_empty() {
        return Err(AppError::validation("path", "config path is empty"));
    }
    let file = config_path()?;
    let text = match fs::read_to_string(&file) {
        Ok(t) => t,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(AppError::fs(&file, e.to_string())),
    };

    let mut lines: Vec<String> = text.lines().map(|s| s.to_string()).collect();

    // resolve (or create) every intermediate level
    let mut depth = 0usize;
    let mut insert_at = lines.len();
    for (i, key) in path.iter().enumerate() {
        let last = i + 1 == path.len();
        let indent = depth * 2;
        let existing = find_key(&lines, key, indent, insert_at);
        match existing {
            Some(idx) => {
                if last {
                    lines[idx] = format!("{}{key}: {raw}", " ".repeat(indent));
                    let end = section_end(&lines, idx);
                    lines.drain(idx + 1..end);
                    return finish(&file, &lines);
                }
                insert_at = section_end(&lines, idx);
                depth += 1;
            }
            None => {
                let mut added: Vec<String> = Vec::new();
                for (j, rest) in path[i..].iter().enumerate() {
                    let ind = (depth + j) * 2;
                    if depth + j + 1 == depth + path.len() - i {
                        added.push(format!("{}{rest}: {raw}", " ".repeat(ind)));
                    } else {
                        added.push(format!("{}{rest}:", " ".repeat(ind)));
                    }
                }
                lines.splice(insert_at..insert_at, added);
                return finish(&file, &lines);
            }
        }
    }
    finish(&file, &lines)
}

/// Whether a dotted/nested mapping path exists in config.yml.
pub fn has_path(path: &[&str]) -> Result<bool> {
    if path.is_empty() {
        return Ok(false);
    }
    let file = config_path()?;
    let text = match fs::read_to_string(&file) {
        Ok(t) => t,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(e) => return Err(AppError::fs(&file, e.to_string())),
    };
    let lines: Vec<String> = text.lines().map(|s| s.to_string()).collect();

    let mut depth = 0usize;
    let mut scope_end = lines.len();
    for (i, key) in path.iter().enumerate() {
        let last = i + 1 == path.len();
        let indent = depth * 2;
        match find_key(&lines, key, indent, scope_end) {
            Some(idx) => {
                if last {
                    return Ok(true);
                }
                scope_end = section_end(&lines, idx);
                depth += 1;
            }
            None => return Ok(false),
        }
    }
    Ok(true)
}

/// Delete a nested mapping key together with its whole child block.
/// Returns whether anything was removed.
pub fn remove_path(path: &[&str]) -> Result<bool> {
    if path.is_empty() {
        return Err(AppError::validation("path", "config path is empty"));
    }
    let file = config_path()?;
    let text = match fs::read_to_string(&file) {
        Ok(t) => t,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(e) => return Err(AppError::fs(&file, e.to_string())),
    };
    let mut lines: Vec<String> = text.lines().map(|s| s.to_string()).collect();

    let mut depth = 0usize;
    let mut scope_end = lines.len();
    for (i, key) in path.iter().enumerate() {
        let last = i + 1 == path.len();
        let indent = depth * 2;
        let Some(idx) = find_key(&lines, key, indent, scope_end) else {
            return Ok(false);
        };
        if last {
            let end = section_end(&lines, idx);
            lines.drain(idx..end);
            finish(&file, &lines)?;
            return Ok(true);
        }
        scope_end = section_end(&lines, idx);
        depth += 1;
    }
    Ok(false)
}

fn finish(file: &Path, lines: &[String]) -> Result<()> {
    let mut text = lines.join("\n");
    if !text.ends_with('\n') {
        text.push('\n');
    }
    if file.exists() {
        store::backup_file(file)?;
    }
    store::write_atomic(file, text.as_bytes())
}

fn indent_of(line: &str) -> usize {
    line.chars().take_while(|c| *c == ' ').count()
}

fn key_matches(line: &str, key: &str, indent: usize) -> bool {
    if line.trim().is_empty() || indent_of(line) != indent {
        return false;
    }
    let rest = line.trim_start();
    let Some(colon) = rest.find(':') else {
        return false;
    };
    let candidate = rest[..colon].trim();
    candidate == key
}

fn find_key(lines: &[String], key: &str, indent: usize, before: usize) -> Option<usize> {
    (0..before.min(lines.len())).find(|&i| key_matches(&lines[i], key, indent))
}

/// Block end for a mapping key, exclusive.
fn section_end(lines: &[String], key_idx: usize) -> usize {
    let indent = indent_of(&lines[key_idx]);
    for j in (key_idx + 1)..lines.len() {
        let l = &lines[j];
        if l.trim().is_empty() {
            continue;
        }
        if indent_of(l) <= indent {
            return j;
        }
    }
    lines.len()
}

#[cfg(test)]
mod tests;
