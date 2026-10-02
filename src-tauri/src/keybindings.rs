use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::{AppError, Result};
use crate::paths;
use crate::store::{self, LinkKind};

pub const FILE: &str = "keybindings.yml";

const HEADER: &str = "# omp 键位覆盖（由 omp-ctl 管理）\n";

const MODIFIERS: [&str; 8] = [
    "Ctrl",
    "Cmd",
    "CtrlOrCmd",
    "Alt",
    "Option",
    "Shift",
    "Meta",
    "Super",
];

pub struct ActionSpec {
    pub id: &'static str,
    pub default_chords: &'static [&'static str],
    pub label: &'static str,
}

pub const ACTIONS: [ActionSpec; 22] = [
    ActionSpec { id: "app.model.cycleForward", default_chords: &["Ctrl+P"], label: "角色模型前移" },
    ActionSpec { id: "app.model.cycleBackward", default_chords: &["Shift+Ctrl+P"], label: "角色模型后移" },
    ActionSpec { id: "app.model.selectTemporary", default_chords: &["Alt+P"], label: "临时选模型（本会话）" },
    ActionSpec { id: "app.model.select", default_chords: &["Alt+M"], label: "模型选择器/设角色" },
    ActionSpec { id: "app.plan.toggle", default_chords: &["Alt+Shift+P"], label: "切换 plan 模式" },
    ActionSpec { id: "app.history.search", default_chords: &["Ctrl+R"], label: "搜索 prompt 历史" },
    ActionSpec { id: "app.tools.expand", default_chords: &["Ctrl+O"], label: "工具输出展开/折叠" },
    ActionSpec { id: "app.tools.toggleVisibility", default_chords: &["Ctrl+Shift+O"], label: "显示/隐藏工具活动" },
    ActionSpec { id: "app.thinking.toggle", default_chords: &["Ctrl+T"], label: "思考块显示" },
    ActionSpec { id: "app.thinking.cycle", default_chords: &["Shift+Tab"], label: "思考等级循环" },
    ActionSpec { id: "app.editor.external", default_chords: &["Ctrl+G"], label: "用 $EDITOR 编辑草稿" },
    ActionSpec { id: "app.message.followUp", default_chords: &["Ctrl+Q", "Ctrl+Enter"], label: "排队后续消息" },
    ActionSpec { id: "app.message.dequeue", default_chords: &["Alt+Up", "Shift+Up"], label: "取回排队消息" },
    ActionSpec { id: "app.retry", default_chords: &["Alt+R"], label: "重试上一轮失败回合" },
    ActionSpec { id: "app.display.reset", default_chords: &["Alt+L"], label: "重置终端显示" },
    ActionSpec { id: "app.clipboard.copyLine", default_chords: &["Alt+Shift+L"], label: "复制当前行" },
    ActionSpec { id: "app.clipboard.copyPrompt", default_chords: &["Alt+Shift+C"], label: "复制整个 prompt" },
    ActionSpec { id: "app.clipboard.pasteTextRaw", default_chords: &["Ctrl+Shift+V", "Alt+Shift+V"], label: "粘贴文本（不折叠）" },
    ActionSpec { id: "app.clipboard.pasteImage", default_chords: &["Ctrl+V"], label: "粘贴剪贴板（图片优先）" },
    ActionSpec { id: "app.stt.toggle", default_chords: &[], label: "语音转文字（按住 Space）" },
    ActionSpec { id: "app.live.toggle", default_chords: &["Ctrl+L"], label: "开始/停止实时语音" },
    ActionSpec { id: "app.agents.hub", default_chords: &["Alt+A"], label: "打开 Agent Hub" },
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BindingState {
    pub action: String,
    pub label: Option<String>,
    pub default_chords: Vec<String>,
    pub chords: Vec<String>,
    pub overridden: bool,
    pub disabled: bool,
    pub known: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeybindingsState {
    pub file: String,
    pub agent_path: PathBuf,
    pub store_path: PathBuf,
    pub link: LinkKind,
    pub link_target: Option<String>,
    pub store_exists: bool,
    pub has_backup: bool,
    pub bindings: Vec<BindingState>,
}

fn indentation(line: &str) -> usize {
    line.len() - line.trim_start_matches(' ').len()
}

fn key_of(line: &str) -> Option<&str> {
    if indentation(line) != 0 {
        return None;
    }
    let trimmed = line.trim_end();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return None;
    }
    let colon = trimmed.find(':')?;
    let key = trimmed[..colon].trim();
    if key.is_empty() {
        None
    } else {
        Some(key)
    }
}

/// The `# comment` that trails a key line with an empty value, e.g. `action: # note`.
fn pure_comment(line: &str) -> Option<String> {
    let colon = line.find(':')?;
    let rest = line[colon + 1..].trim();
    if rest.starts_with('#') {
        Some(rest.to_string())
    } else {
        None
    }
}

#[derive(Debug, Clone, Copy)]
struct Block {
    start: usize,
    /// exclusive
    end: usize,
}

fn find_block(lines: &[&str], action: &str) -> Option<Block> {
    for i in 0..lines.len() {
        if key_of(lines[i]) != Some(action) {
            continue;
        }
        let mut end = lines.len();
        for j in (i + 1)..lines.len() {
            let line = lines[j];
            if line.trim().is_empty() {
                continue;
            }
            if indentation(line) == 0 {
                end = j;
                break;
            }
        }
        return Some(Block { start: i, end });
    }
    None
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

fn validate_text(text: &str, path: &Path) -> Result<()> {
    let parsed: serde_yaml::Value =
        serde_yaml::from_str(text).map_err(|e| AppError::yaml(path, e.to_string()))?;
    if !parsed.is_mapping() && !parsed.is_null() {
        return Err(AppError::yaml(path, "top level must be a mapping"));
    }
    let Some(map) = parsed.as_mapping() else {
        return Ok(());
    };
    for (key, value) in map {
        if !key.is_string() {
            return Err(AppError::yaml(path, "keys must be strings"));
        }
        if value.is_string() || value.is_null() {
            continue;
        }
        if let Some(seq) = value.as_sequence() {
            if seq.iter().all(|v| v.is_string()) {
                continue;
            }
        }
        return Err(AppError::yaml(path, "values must be a string or a list of strings"));
    }
    Ok(())
}

pub struct BindingsDoc {
    text: String,
}

impl BindingsDoc {
    pub fn load(path: &Path) -> Result<BindingsDoc> {
        let text = match fs::read_to_string(path) {
            Ok(t) => t,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
            Err(e) => return Err(AppError::fs(path, e.to_string())),
        };
        if text.trim().is_empty() {
            return Ok(BindingsDoc { text: String::new() });
        }
        validate_text(&text, path)?;
        Ok(BindingsDoc { text })
    }

    pub fn overrides(&self) -> Result<BTreeMap<String, Vec<String>>> {
        let mut out = BTreeMap::new();
        if self.text.trim().is_empty() {
            return Ok(out);
        }
        let parsed: serde_yaml::Value =
            serde_yaml::from_str(&self.text).map_err(|e| AppError::yaml(FILE, e.to_string()))?;
        let Some(map) = parsed.as_mapping() else {
            return Ok(out);
        };
        for (key, value) in map {
            let Some(action) = key.as_str() else { continue };
            let chords = if value.is_null() {
                Vec::new()
            } else if let Some(s) = value.as_str() {
                vec![s.to_string()]
            } else if let Some(seq) = value.as_sequence() {
                seq.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            } else {
                Vec::new()
            };
            out.insert(action.to_string(), chords);
        }
        Ok(out)
    }

    fn render(action: &str, chords: &[String]) -> String {
        match chords {
            [] => format!("{action}: []"),
            [one] => format!("{action}: {one}"),
            many => format!("{action}: [{}]", many.join(", ")),
        }
    }

    pub fn set(&mut self, action: &str, chords: &[String]) -> Result<()> {
        let mut lines: Vec<String> = self.text.lines().map(|s| s.to_string()).collect();
        let refs: Vec<&str> = lines.iter().map(|s| s.as_str()).collect();
        let mut rendered = Self::render(action, chords);

        if let Some(block) = find_block(&refs, action) {
            if let Some(comment) = pure_comment(&lines[block.start]) {
                rendered = format!("{rendered} {comment}");
            }
            let mut end = block.end;
            while end > block.start + 1 && lines[end - 1].trim().is_empty() {
                end -= 1;
            }
            lines.splice(block.start..end, [rendered]);
        } else {
            lines.push(rendered);
        }
        self.text = normalize(lines);
        Ok(())
    }

    pub fn remove(&mut self, action: &str) -> Result<bool> {
        let mut lines: Vec<String> = self.text.lines().map(|s| s.to_string()).collect();
        let refs: Vec<&str> = lines.iter().map(|s| s.as_str()).collect();
        let Some(block) = find_block(&refs, action) else {
            return Ok(false);
        };
        let mut end = block.end;
        if end < lines.len() && lines[end].trim().is_empty() {
            end += 1;
        }
        lines.drain(block.start..end);
        self.text = normalize(lines);
        Ok(true)
    }

    pub fn save(&self, path: &Path) -> Result<Option<PathBuf>> {
        let backup = if path.exists() {
            store::backup_file(path)?
        } else {
            None
        };
        store::write_atomic(path, self.text.as_bytes())?;
        Ok(backup)
    }
}

fn validate_action(raw: &str) -> Result<String> {
    let action = raw.trim();
    if action.is_empty() {
        return Err(AppError::validation("action", "action id must not be empty"));
    }
    if action
        .chars()
        .any(|c| c.is_whitespace() || c == ':' || c == '#')
    {
        return Err(AppError::validation(
            "action",
            "action id must not contain whitespace, `:` or `#`",
        ));
    }
    Ok(action.to_string())
}

fn validate_chord(raw: &str) -> Result<String> {
    let chord = raw.trim();
    if chord.is_empty() {
        return Err(AppError::validation("chord", "chord must not be empty"));
    }
    if chord
        .chars()
        .any(|c| c.is_whitespace() || c == ',' || c == '[' || c == ']' || c == ':')
    {
        return Err(AppError::validation(
            "chord",
            "chord must not contain whitespace, `,`, `[`, `]` or `:`",
        ));
    }
    let parts: Vec<&str> = chord.split('+').collect();
    if parts.iter().any(|p| p.is_empty()) {
        return Err(AppError::validation("chord", "chord has an empty segment"));
    }
    if MODIFIERS.contains(&parts[parts.len() - 1]) {
        return Err(AppError::validation("chord", "chord must end with a key, not a modifier"));
    }
    Ok(chord.to_string())
}

fn validate_chords(chords: &[String]) -> Result<Vec<String>> {
    let mut out: Vec<String> = Vec::with_capacity(chords.len());
    for raw in chords {
        let chord = validate_chord(raw)?;
        if out.contains(&chord) {
            return Err(AppError::validation(
                "chord",
                format!("duplicate chord `{chord}`"),
            ));
        }
        out.push(chord);
    }
    Ok(out)
}

fn resolve(agent: &Path) -> Result<PathBuf> {
    let agent_path = agent.join(FILE);
    if agent_path.exists() {
        return Ok(agent_path);
    }
    store::store_file(FILE)
}

pub fn state() -> Result<KeybindingsState> {
    let agent = paths::agent_dir()?;
    let store_path = store::store_file(FILE)?;
    let store_exists = store_path.exists();
    let link = store::link_state(&agent, FILE)?;
    let doc = BindingsDoc::load(&resolve(&agent)?)?;
    let overrides = doc.overrides()?;

    let mut bindings: Vec<BindingState> = Vec::with_capacity(ACTIONS.len());
    for spec in ACTIONS.iter() {
        let override_value = overrides.get(spec.id);
        let chords = override_value
            .cloned()
            .unwrap_or_else(|| spec.default_chords.iter().map(|s| s.to_string()).collect());
        bindings.push(BindingState {
            action: spec.id.to_string(),
            label: Some(spec.label.to_string()),
            default_chords: spec.default_chords.iter().map(|s| s.to_string()).collect(),
            disabled: override_value.map(|v| v.is_empty()).unwrap_or(false),
            overridden: override_value.is_some(),
            chords,
            known: true,
        });
    }

    let known: Vec<&str> = ACTIONS.iter().map(|s| s.id).collect();
    let mut extra: Vec<(&String, &Vec<String>)> = overrides
        .iter()
        .filter(|(id, _)| !known.contains(&id.as_str()))
        .collect();
    extra.sort_by(|a, b| a.0.cmp(b.0));
    for (id, chords) in extra {
        bindings.push(BindingState {
            action: id.clone(),
            label: None,
            default_chords: Vec::new(),
            chords: chords.clone(),
            overridden: true,
            disabled: chords.is_empty(),
            known: false,
        });
    }

    Ok(KeybindingsState {
        file: FILE.to_string(),
        agent_path: agent.join(FILE),
        store_path,
        store_exists,
        has_backup: store::has_backup(FILE)?,
        link: link.kind,
        link_target: link.target.map(|t| t.to_string_lossy().into_owned()),
        bindings,
    })
}

pub fn adopt() -> Result<KeybindingsState> {
    let agent = paths::agent_dir()?;
    store::ensure_store()?;
    let store_path = store::store_file(FILE)?;
    if !store_path.exists() {
        store::write_atomic(&store_path, HEADER.as_bytes())?;
    }
    store::adopt(&agent, FILE)?;
    state()
}

pub fn detach() -> Result<KeybindingsState> {
    let agent = paths::agent_dir()?;
    store::detach(&agent, FILE)?;
    state()
}

pub fn set(action: &str, chords: Vec<String>) -> Result<KeybindingsState> {
    let action = validate_action(action)?;
    let chords = validate_chords(&chords)?;
    adopt()?;
    let store_path = store::store_file(FILE)?;
    let mut doc = BindingsDoc::load(&store_path)?;
    doc.set(&action, &chords)?;
    doc.save(&store_path)?;
    state()
}

pub fn remove(action: &str) -> Result<KeybindingsState> {
    let action = validate_action(action)?;
    let store_path = store::store_file(FILE)?;
    let mut doc = BindingsDoc::load(&store_path)?;
    if doc.remove(&action)? {
        doc.save(&store_path)?;
    }
    state()
}

pub fn restore_backup() -> Result<KeybindingsState> {
    let agent = paths::agent_dir()?;
    store::restore_backup(&agent, FILE)?;
    state()
}

#[cfg(test)]
mod tests;
