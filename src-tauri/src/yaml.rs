use std::fs;
use std::path::Path;

use serde_json::Value as JValue;

use crate::error::{AppError, Result};
use crate::store;

const PROVIDERS: &str = "providers:";

/// Comment-preserving editor for `models.yml`.
///
/// Only provider blocks under the top-level `providers:` mapping are rewritten, by replacing the
/// exact line range of `  <id>:` up to the next line indented at most two spaces. Everything else
/// (top-level comments, inline comments on untouched keys, unknown keys) is bytes-preserved.
pub struct YamlDoc {
    text: String,
}

#[derive(Debug, Clone, Copy)]
struct Block {
    start: usize,
    /// exclusive
    end: usize,
}

fn indentation(line: &str) -> usize {
    line.len() - line.trim_start_matches(' ').len()
}

fn providers_line(lines: &[&str]) -> Option<usize> {
    lines.iter().position(|l| l.trim_end() == PROVIDERS)
}

fn provider_id_of(line: &str) -> Option<String> {
    if indentation(line) != 2 {
        return None;
    }
    let rest = line.trim_start();
    if rest.starts_with('-') {
        return None;
    }
    let colon = rest.find(':')?;
    let id = rest[..colon].trim();
    if id.is_empty() {
        return None;
    }
    let after = rest[colon + 1..].trim_start();
    if !after.is_empty() && !after.starts_with('#') {
        return None;
    }
    Some(id.to_string())
}

fn is_ignorable(line: &str) -> bool {
    let t = line.trim_start();
    t.is_empty() || t.starts_with('#')
}

/// Text following the colon on a key line, e.g. the `# comment` in `  axon: # comment`.
fn inline_suffix(line: &str) -> Option<String> {
    let colon = line.find(':')?;
    let rest = line[colon + 1..].trim();
    if rest.is_empty() {
        None
    } else {
        Some(rest.to_string())
    }
}

fn find_block(lines: &[&str], id: &str) -> Option<Block> {
    let start = providers_line(lines)? + 1;
    for i in start..lines.len() {
        let line = lines[i];
        if is_ignorable(line) {
            continue;
        }
        if indentation(line) <= 2 {
            if provider_id_of(line).as_deref() == Some(id) {
                let mut end = lines.len();
                for j in (i + 1)..lines.len() {
                    let l = lines[j];
                    if is_ignorable(l) {
                        continue;
                    }
                    if indentation(l) > 2 {
                        continue;
                    }
                    end = j;
                    break;
                }
                return Some(Block { start: i, end });
            }
            // a different sibling key or a dedent terminates the providers mapping
            if provider_id_of(line).is_none() {
                return None;
            }
        }
    }
    None
}

/// End of the `providers:` mapping body (exclusive), skipping trailing blank lines.
fn providers_body_end(lines: &[&str]) -> Option<usize> {
    let header = providers_line(lines)?;
    let mut end = lines.len();
    for j in (header + 1)..lines.len() {
        let l = lines[j];
        if is_ignorable(l) {
            continue;
        }
        if indentation(l) == 0 {
            end = j;
            break;
        }
    }
    // trim trailing blanks inside the range
    let mut e = end;
    while e > header + 1 && is_ignorable(lines[e - 1]) {
        e -= 1;
    }
    Some(e)
}

fn render_provider(id: &str, value: &JValue) -> Result<Vec<String>> {
    let yaml = serde_yaml::to_string(value)
        .map_err(|e| AppError::internal(format!("cannot serialize provider `{id}`: {e}")))?;
    let mut out = vec![format!("  {id}:")];
    // serde_yaml emits mapping keys at indent 0 and block-sequence items at 0/2; the whole
    // provider body has to sit at indent 4 under `  <id>:`, so shift it uniformly.
    for line in yaml.lines() {
        let trimmed = line.trim_end();
        if trimmed.trim().is_empty() {
            continue;
        }
        out.push(format!("    {trimmed}"));
    }
    Ok(out)
}

fn parse_line(id: &str, block: &[String]) -> Result<JValue> {
    // block lines are already stored at their true file indentation, so `  <id>:` + body round-trips
    let mut text = format!("providers:\n");
    for line in block {
        text.push_str(line);
        text.push('\n');
    }
    let parsed: serde_yaml::Value = serde_yaml::from_str(&text)
        .map_err(|e| AppError::yaml(format!("provider `{id}`"), e.to_string()))?;
    let providers = parsed
        .get("providers")
        .and_then(|p| p.get(id))
        .ok_or_else(|| AppError::yaml(format!("provider `{id}`"), "block did not parse"))?;
    serde_json::to_value(providers)
        .map_err(|e| AppError::yaml(format!("provider `{id}`"), e.to_string()))
}

impl YamlDoc {
    pub fn load(path: &Path) -> Result<YamlDoc> {
        let text = match fs::read_to_string(path) {
            Ok(t) => t,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                return Ok(YamlDoc {
                    text: format!("{PROVIDERS}\n"),
                })
            }
            Err(e) => return Err(AppError::fs(path, e.to_string())),
        };
        if text.trim().is_empty() {
            return Ok(YamlDoc {
                text: format!("{PROVIDERS}\n"),
            });
        }
        // validate before anyone can call save()
        let parsed: serde_yaml::Value =
            serde_yaml::from_str(&text).map_err(|e| AppError::yaml(path, e.to_string()))?;
        if !parsed.is_mapping() && !parsed.is_null() {
            return Err(AppError::yaml(path, "top level must be a mapping"));
        }
        if let Some(p) = parsed.get("providers") {
            if !p.is_mapping() && !p.is_null() {
                return Err(AppError::yaml(path, "`providers` must be a mapping"));
            }
        }
        Ok(YamlDoc { text })
    }

    pub fn ids(&self) -> Vec<String> {
        let lines: Vec<&str> = self.text.lines().collect();
        match providers_line(&lines) {
            Some(_) => lines.iter().filter_map(|l| provider_id_of(l)).collect(),
            None => Vec::new(),
        }
    }

    pub fn get(&self, id: &str) -> Option<JValue> {
        let lines: Vec<&str> = self.text.lines().collect();
        let block = find_block(&lines, id)?;
        let owned: Vec<String> = lines[block.start..block.end]
            .iter()
            .map(|s| s.to_string())
            .collect();
        parse_line(id, &owned).ok()
    }

    fn set_provider(&mut self, id: &str, rendered: Vec<String>) -> Result<()> {
        let mut lines: Vec<String> = self.text.lines().map(|s| s.to_string()).collect();
        let refs: Vec<&str> = lines.iter().map(|s| s.as_str()).collect();

        if let Some(block) = find_block(&refs, id) {
            // keep whatever trailed the `  <id>:` header (usually an inline comment)
            let mut rendered = rendered;
            if let Some(trailing) = inline_suffix(&lines[block.start]) {
                rendered[0] = format!("{} {trailing}", rendered[0].trim_end());
            }
            // drop trailing blanks inside the replaced range, then re-insert one separator
            let mut end = block.end;
            while end > block.start + 1 && lines[end - 1].trim().is_empty() {
                end -= 1;
            }
            lines.splice(block.start..end, rendered.clone());
            self.text = normalize(lines);
            return Ok(());
        }

        let body_end = providers_body_end(&refs)
            .ok_or_else(|| AppError::validation("providers", "`providers:` mapping not found"))?;
        lines.splice(body_end..body_end, rendered.clone());
        self.text = normalize(lines);
        Ok(())
    }

    pub fn set(&mut self, id: &str, value: &JValue) -> Result<()> {
        let rendered = render_provider(id, value)?;
        self.set_provider(id, rendered)
    }

    pub fn remove(&mut self, id: &str) -> Result<bool> {
        let mut lines: Vec<String> = self.text.lines().map(|s| s.to_string()).collect();
        let refs: Vec<&str> = lines.iter().map(|s| s.as_str()).collect();
        let Some(block) = find_block(&refs, id) else {
            return Ok(false);
        };
        let mut end = block.end;
        // also swallow the single blank separator line after the block
        if end < lines.len() && lines[end].trim().is_empty() {
            end += 1;
        }
        lines.drain(block.start..end);
        self.text = normalize(lines);
        Ok(true)
    }

    pub fn save(&self, path: &Path) -> Result<Option<std::path::PathBuf>> {
        let backup = if path.exists() {
            Some(store::backup_file(path)?)
        } else {
            None
        };
        store::write_atomic(path, self.text.as_bytes())?;
        Ok(backup)
    }
}

/// Keep exactly one trailing newline; blank-line runs of 2+ collapse to one.
fn normalize(lines: Vec<String>) -> String {
    let mut out: Vec<String> = Vec::with_capacity(lines.len());
    for line in lines {
        if line.trim().is_empty()
            && out
                .last()
                .map(|l: &String| l.trim().is_empty())
                .unwrap_or(true)
        {
            continue;
        }
        out.push(line.trim_end().to_string());
    }
    while out.last().map(|l| l.trim().is_empty()).unwrap_or(false) {
        out.pop();
    }
    let mut text = out.join("\n");
    text.push('\n');
    text
}

#[cfg(test)]
mod tests;
