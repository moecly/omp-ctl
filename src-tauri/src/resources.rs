use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::{AppError, Result};
use crate::proc;
use crate::store::{self, LinkKind};

#[derive(Clone, Copy)]
pub enum Layout {
    Dir { entry: &'static str },
    File { exts: &'static [&'static str] },
}

pub struct ResourceSpec {
    pub id: &'static str,
    pub store_sub: &'static str,
    pub agent_sub: &'static str,
    pub layout: Layout,
}

pub const RESOURCES: [ResourceSpec; 6] = [
    ResourceSpec {
        id: "skills",
        store_sub: "skills",
        agent_sub: "skills",
        layout: Layout::Dir { entry: "SKILL.md" },
    },
    ResourceSpec {
        id: "agents",
        store_sub: "agents",
        agent_sub: "agents",
        layout: Layout::File { exts: &["md"] },
    },
    ResourceSpec {
        id: "hooks_pre",
        store_sub: "hooks/pre",
        agent_sub: "hooks/pre",
        layout: Layout::File {
            exts: &["ts", "js"],
        },
    },
    ResourceSpec {
        id: "hooks_post",
        store_sub: "hooks/post",
        agent_sub: "hooks/post",
        layout: Layout::File {
            exts: &["ts", "js"],
        },
    },
    ResourceSpec {
        id: "extensions",
        store_sub: "extensions",
        agent_sub: "extensions",
        layout: Layout::File {
            exts: &["ts", "js"],
        },
    },
    ResourceSpec {
        id: "tools",
        store_sub: "tools",
        agent_sub: "tools",
        layout: Layout::File {
            exts: &["ts", "js", "md", "json", "sh", "bash", "py"],
        },
    },
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceEntry {
    pub resource: String,
    pub name: String,
    pub store_path: PathBuf,
    pub agent_path: PathBuf,
    pub enabled: bool,
    pub link: LinkKind,
    pub link_target: Option<String>,
    pub foreign: bool,
    pub has_backup: bool,
    pub store_exists: bool,
    pub size: Option<u64>,
    pub modified: Option<u64>,
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuiltinTool {
    pub name: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredSkill {
    pub name: String,
    pub description: Option<String>,
    pub file_path: Option<String>,
    pub base_dir: Option<String>,
    pub source: Option<String>,
    pub hide: bool,
}

pub fn spec(resource: &str) -> Result<&'static ResourceSpec> {
    RESOURCES
        .iter()
        .find(|r| r.id == resource)
        .ok_or_else(|| AppError::validation("resource", format!("unknown resource `{resource}`")))
}

fn validate_name(name: &str) -> Result<()> {
    if name.is_empty() {
        return Err(AppError::validation("name", "name is required"));
    }
    if name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(AppError::validation(
            "name",
            "name must not contain path separators",
        ));
    }
    Ok(())
}

fn rel(spec: &ResourceSpec, name: &str) -> String {
    format!("{}/{}", spec.agent_sub, name)
}

fn accepts(spec: &ResourceSpec, path: &Path) -> bool {
    match spec.layout {
        Layout::Dir { entry } => path.is_dir() && path.join(entry).is_file(),
        Layout::File { exts } => {
            path.is_file()
                && path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| exts.contains(&e))
                    .unwrap_or(false)
        }
    }
}

/// Extract the value of a `description:` key from leading YAML frontmatter.
fn frontmatter_description(text: &str) -> Option<String> {
    let mut lines = text.lines();
    if lines.next()?.trim() != "---" {
        return None;
    }
    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" {
            return None;
        }
        if let Some(rest) = trimmed.strip_prefix("description:") {
            let value = rest.trim().trim_matches(['"', '\''].as_ref()).trim();
            if !value.is_empty() {
                return Some(value.to_string());
            }
            return None;
        }
    }
    None
}

fn summary_of(spec: &ResourceSpec, path: &Path) -> Option<String> {
    let file = match spec.layout {
        Layout::Dir { entry } => path.join(entry),
        Layout::File { .. } => path.to_path_buf(),
    };
    let text = fs::read_to_string(file).ok()?;
    frontmatter_description(&text)
}

fn store_root(spec: &ResourceSpec) -> Result<PathBuf> {
    Ok(crate::paths::store_dir()?.join(spec.store_sub))
}

fn agent_root(agent: &Path, spec: &ResourceSpec) -> PathBuf {
    agent.join(spec.agent_sub)
}

fn names_in(dir: &Path, spec: &ResourceSpec) -> Vec<String> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for entry in entries.filter_map(|e| e.ok()) {
        if !accepts(spec, &entry.path()) {
            continue;
        }
        if let Some(name) = entry.file_name().to_str() {
            out.push(name.to_string());
        }
    }
    out.sort();
    out
}

pub fn entry_of(agent: &Path, spec: &ResourceSpec, name: &str) -> Result<ResourceEntry> {
    let rel_path = rel(spec, name);
    let link = store::link_state_rel(agent, &rel_path)?;
    let store_path = store_root(spec)?.join(name);
    let agent_path = agent.join(&rel_path);
    let store_exists = store_path.exists();
    let foreign = link.kind == LinkKind::Unmanaged && !store_exists;

    let meta = fs::metadata(&agent_path)
        .or_else(|_| fs::metadata(&store_path))
        .ok();
    let summary = summary_of(spec, &agent_path).or_else(|| summary_of(spec, &store_path));

    Ok(ResourceEntry {
        resource: spec.id.to_string(),
        name: name.to_string(),
        store_path,
        agent_path,
        enabled: link.kind == LinkKind::Managed,
        link: link.kind,
        link_target: link.target.map(|t| t.to_string_lossy().into_owned()),
        foreign,
        has_backup: store::has_backup_rel(&rel_path)?,
        store_exists,
        size: meta.as_ref().map(|m| m.len()),
        modified: meta
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs()),
        summary,
    })
}

pub fn list(agent: &Path, resource: &str) -> Result<Vec<ResourceEntry>> {
    let spec = spec(resource)?;
    let mut names: Vec<String> = Vec::new();
    for name in names_in(&agent_root(agent, spec), spec) {
        if !names.contains(&name) {
            names.push(name);
        }
    }
    for name in names_in(&store_root(spec)?, spec) {
        if !names.contains(&name) {
            names.push(name);
        }
    }
    names.sort();
    names
        .iter()
        .map(|name| entry_of(agent, spec, name))
        .collect()
}

pub fn read(agent: &Path, resource: &str, name: &str) -> Result<String> {
    let spec = spec(resource)?;
    validate_name(name)?;
    let agent_path = agent.join(rel(spec, name));
    let target = match spec.layout {
        Layout::Dir { entry } => agent_path.join(entry),
        Layout::File { .. } => agent_path.clone(),
    };
    match fs::read_to_string(&target) {
        Ok(text) => return Ok(text),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => return Err(AppError::fs(&target, e.to_string())),
    }
    let store_path = store_root(spec)?.join(name);
    let store_target = match spec.layout {
        Layout::Dir { entry } => store_path.join(entry),
        Layout::File { .. } => store_path,
    };
    fs::read_to_string(&store_target).map_err(|e| AppError::fs(&store_target, e.to_string()))
}

pub fn write(agent: &Path, resource: &str, name: &str, content: &str) -> Result<ResourceEntry> {
    let spec = spec(resource)?;
    validate_name(name)?;

    let store_path = store_root(spec)?.join(name);
    let file = match spec.layout {
        Layout::Dir { entry } => {
            fs::create_dir_all(&store_path)
                .map_err(|e| AppError::fs(&store_path, e.to_string()))?;
            store_path.join(entry)
        }
        Layout::File { .. } => store_path.clone(),
    };
    if file.exists() {
        store::backup_file(&file)?;
    }
    store::write_atomic(&file, content.as_bytes())?;
    store::adopt_rel(agent, &rel(spec, name))?;
    entry_of(agent, spec, name)
}

pub fn adopt(agent: &Path, resource: &str, name: &str) -> Result<ResourceEntry> {
    let spec = spec(resource)?;
    validate_name(name)?;
    store::adopt_rel(agent, &rel(spec, name))?;
    entry_of(agent, spec, name)
}

pub fn remove(agent: &Path, resource: &str, name: &str) -> Result<()> {
    let spec = spec(resource)?;
    validate_name(name)?;
    let rel_path = rel(spec, name);
    if store_root(spec)?.join(name).exists() {
        store::archive_rel(&rel_path)?;
    }
    store::detach_rel(agent, &rel_path)
}

pub fn set_enabled(
    agent: &Path,
    resource: &str,
    name: &str,
    enabled: bool,
) -> Result<ResourceEntry> {
    let spec = spec(resource)?;
    validate_name(name)?;
    if enabled {
        store::adopt_rel(agent, &rel(spec, name))?;
    } else {
        let entry = entry_of(agent, spec, name)?;
        if entry.foreign {
            let target = entry.link_target.unwrap_or_else(|| "?".to_string());
            return Err(AppError::validation(
                "link",
                format!("该资源由外部管理（{target}），omp-ctl 无法禁用；请先接管"),
            ));
        }
        store::detach_rel(agent, &rel(spec, name))?;
    }
    entry_of(agent, spec, name)
}

pub fn restore(agent: &Path, resource: &str, name: &str) -> Result<ResourceEntry> {
    let spec = spec(resource)?;
    validate_name(name)?;
    store::restore_backup_rel(agent, &rel(spec, name))?;
    entry_of(agent, spec, name)
}

pub fn builtin_tools() -> Result<Vec<BuiltinTool>> {
    let listing = proc::omp(&["read", "omp://"])?;
    let mut out = Vec::new();
    for line in listing.lines() {
        let Some(rest) = line.trim().strip_prefix("- [") else {
            continue;
        };
        let Some((label, tail)) = rest.split_once("](") else {
            continue;
        };
        if !tail.starts_with("omp://tools/") || !tail.ends_with(".md)") {
            continue;
        }
        let name = label.trim_end_matches(".md");
        if name.is_empty() || name.contains('/') {
            continue;
        }
        out.push(BuiltinTool {
            name: name.to_string(),
            title: name.to_string(),
        });
    }
    Ok(out)
}

pub fn builtin_tool_doc(name: &str) -> Result<String> {
    if name.is_empty()
        || !name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err(AppError::validation("name", "invalid tool name"));
    }
    proc::omp(&["read", &format!("omp://tools/{name}.md")])
}

pub fn discover_skills() -> Result<Vec<DiscoveredSkill>> {
    let out = match proc::omp(&["skill", "list", "--json"]) {
        Ok(out) => out,
        Err(e) => {
            eprintln!("omp skill list failed: {e}");
            return Ok(Vec::new());
        }
    };
    let parsed: serde_json::Value = match serde_json::from_str(&out) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("omp skill list output unparsable: {e}");
            return Ok(Vec::new());
        }
    };
    let Some(skills) = parsed.get("skills").and_then(|v| v.as_array()) else {
        return Ok(Vec::new());
    };
    Ok(skills
        .iter()
        .filter_map(|s| {
            let name = s.get("name")?.as_str()?.to_string();
            Some(DiscoveredSkill {
                name,
                description: s
                    .get("description")
                    .and_then(|v| v.as_str())
                    .map(|v| v.to_string()),
                file_path: s
                    .get("filePath")
                    .and_then(|v| v.as_str())
                    .map(|v| v.to_string()),
                base_dir: s
                    .get("baseDir")
                    .and_then(|v| v.as_str())
                    .map(|v| v.to_string()),
                source: s
                    .get("source")
                    .and_then(|v| v.as_str())
                    .map(|v| v.to_string()),
                hide: s.get("hide").and_then(|v| v.as_bool()).unwrap_or(false),
            })
        })
        .collect())
}

/// Read-only view of `<agentDir>/managed-skills/*`; OMP owns this directory.
pub fn managed_skills(agent: &Path) -> Result<Vec<ResourceEntry>> {
    let root = agent.join("managed-skills");
    let Ok(entries) = fs::read_dir(&root) else {
        return Ok(Vec::new());
    };
    let mut out = Vec::new();
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_dir() || !path.join("SKILL.md").is_file() {
            continue;
        }
        let Some(name) = entry.file_name().to_str().map(|s| s.to_string()) else {
            continue;
        };
        let store_path = crate::paths::store_dir()?
            .join("managed-skills")
            .join(&name);
        out.push(ResourceEntry {
            resource: "managed_skills".to_string(),
            name,
            store_path,
            agent_path: path.clone(),
            enabled: true,
            link: LinkKind::Absent,
            link_target: None,
            foreign: false,
            has_backup: false,
            store_exists: false,
            size: fs::metadata(&path).ok().map(|m| m.len()),
            modified: fs::metadata(&path)
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs()),
            summary: summary_of(&RESOURCES[0], &path),
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

#[cfg(test)]
mod tests;
