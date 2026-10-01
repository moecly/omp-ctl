use std::path::PathBuf;

use serde::Serialize;

use crate::error::{AppError, Result};
use crate::paths;
use crate::store::{self, LinkKind, LinkState};

pub struct PromptSpec {
    pub key: &'static str,
    pub name: &'static str,
    pub label: &'static str,
    pub risk: &'static str,
    pub description: &'static str,
    pub default_content: &'static str,
}

pub const PROMPTS: [PromptSpec; 4] = [
    PromptSpec {
        key: "append_system",
        name: "APPEND_SYSTEM.md",
        label: "追加系统提示词",
        risk: "low",
        description: "追加到默认系统提示词之后，保留内置工具与工作流指导。",
        default_content: "# 用户追加指令\n\n",
    },
    PromptSpec {
        key: "rules",
        name: "RULES.md",
        label: "硬性规则",
        risk: "medium",
        description: "常驻规则，每次请求都会随上下文携带。",
        default_content: "# 硬性规则\n\n",
    },
    PromptSpec {
        key: "agents",
        name: "AGENTS.md",
        label: "用户级全局上下文",
        risk: "medium",
        description: "全局 AGENTS.md，对所有项目生效。",
        default_content: "# 用户级全局指令\n\n",
    },
    PromptSpec {
        key: "system",
        name: "SYSTEM.md",
        label: "替换系统提示词",
        risk: "high",
        description: "整块替换默认系统提示词，会丢失内置工具与工作流指导。",
        default_content: "# 自定义系统提示词\n\n",
    },
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptState {
    pub key: String,
    pub name: String,
    pub label: String,
    pub risk: String,
    pub description: String,
    pub store_path: PathBuf,
    pub agent_path: PathBuf,
    pub enabled: bool,
    pub link: LinkKind,
    pub link_target: Option<String>,
    pub has_backup: bool,
    pub store_exists: bool,
    pub store_content: Option<String>,
}

pub fn spec(key: &str) -> Result<&'static PromptSpec> {
    PROMPTS
        .iter()
        .find(|p| p.key == key)
        .ok_or_else(|| AppError::validation("key", format!("unknown prompt key `{key}`")))
}

fn state_of(spec: &PromptSpec, agent: &std::path::Path) -> Result<PromptState> {
    let link: LinkState = store::link_state(agent, spec.name)?;
    let store_path = store::store_file(spec.name)?;
    let store_exists = store_path.exists();
    let store_content = if store_exists {
        store::read_content(spec.name).ok()
    } else {
        None
    };
    Ok(PromptState {
        key: spec.key.to_string(),
        name: spec.name.to_string(),
        label: spec.label.to_string(),
        risk: spec.risk.to_string(),
        description: spec.description.to_string(),
        store_path,
        agent_path: agent.join(spec.name),
        enabled: link.kind == LinkKind::Managed,
        link: link.kind,
        link_target: link.target.map(|t| t.to_string_lossy().into_owned()),
        has_backup: store::has_backup(spec.name)?,
        store_exists,
        store_content,
    })
}

pub fn list() -> Result<Vec<PromptState>> {
    let agent = paths::agent_dir()?;
    PROMPTS.iter().map(|s| state_of(s, &agent)).collect()
}

pub fn set_enabled(key: &str, enabled: bool) -> Result<PromptState> {
    let spec = spec(key)?;
    let agent = paths::agent_dir()?;

    if enabled {
        store::ensure_store()?;
        if !store::store_file(spec.name)?.exists() {
            store::write_content(spec.name, spec.default_content)?;
        }
        store::adopt(&agent, spec.name)?;
    } else {
        store::detach(&agent, spec.name)?;
    }
    state_of(spec, &agent)
}

pub fn read(key: &str) -> Result<String> {
    let spec = spec(key)?;
    match store::read_content(spec.name) {
        Ok(text) => Ok(text),
        Err(e) => {
            if store::store_file(spec.name)?.exists() {
                Err(e)
            } else {
                Ok(spec.default_content.to_string())
            }
        }
    }
}

pub fn write(key: &str, content: &str) -> Result<PromptState> {
    let spec = spec(key)?;
    let agent = paths::agent_dir()?;
    store::write_content(spec.name, content)?;
    store::adopt(&agent, spec.name)?;
    state_of(spec, &agent)
}

pub fn restore_backup(key: &str) -> Result<PromptState> {
    let spec = spec(key)?;
    let agent = paths::agent_dir()?;
    store::restore_backup(&agent, spec.name)?;
    state_of(spec, &agent)
}
