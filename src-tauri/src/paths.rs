use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};

pub fn home() -> Result<PathBuf> {
    match std::env::var_os("HOME") {
        Some(v) if !v.is_empty() => Ok(PathBuf::from(v)),
        _ => std::env::current_dir()
            .map_err(|e| AppError::internal(format!("cannot resolve HOME or cwd: {e}"))),
    }
}

pub fn store_dir() -> Result<PathBuf> {
    Ok(home()?.join(".omp-ctl"))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DirSource {
    OmpCli,
    EnvPiCodingAgentDir,
    EnvProfile,
    Xdg,
    Default,
}

impl DirSource {
    pub fn label(self) -> &'static str {
        match self {
            DirSource::OmpCli => "omp config path",
            DirSource::EnvPiCodingAgentDir => "PI_CODING_AGENT_DIR",
            DirSource::EnvProfile => "OMP_PROFILE",
            DirSource::Xdg => "XDG_DATA_HOME",
            DirSource::Default => "~/.omp/agent",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct DirInfo {
    pub store: PathBuf,
    pub agent: PathBuf,
    pub agent_source: DirSource,
    pub agent_source_label: &'static str,
    pub home: PathBuf,
}

fn non_empty(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.trim().is_empty())
}

fn agent_dir_inner() -> Result<(PathBuf, DirSource)> {
    // 1. authoritative: omp CLI
    if let Ok(out) = Command::new("omp").args(["config", "path"]).output() {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !s.is_empty() {
                return Ok((PathBuf::from(s), DirSource::OmpCli));
            }
        }
    }

    // 2. explicit override
    if let Some(v) = non_empty("PI_CODING_AGENT_DIR") {
        return Ok((PathBuf::from(v), DirSource::EnvPiCodingAgentDir));
    }

    // 3. profile
    let profile = non_empty("OMP_PROFILE").or_else(|| non_empty("PI_PROFILE"));
    if let Some(p) = profile {
        let p = p.trim();
        if p != "default" && p != "blank" {
            return Ok((home()?.join(".omp/profiles").join(p).join("agent"), DirSource::EnvProfile));
        }
    }

    // 4. XDG
    if let Some(xdg) = non_empty("XDG_DATA_HOME") {
        let candidate = PathBuf::from(xdg).join("omp/agent");
        if candidate.is_dir() {
            return Ok((candidate, DirSource::Xdg));
        }
    }

    // 5. default
    Ok((home()?.join(".omp/agent"), DirSource::Default))
}

pub fn agent_dir() -> Result<PathBuf> {
    Ok(agent_dir_inner()?.0)
}

pub fn dir_info() -> Result<DirInfo> {
    let (agent, agent_source) = agent_dir_inner()?;
    Ok(DirInfo {
        store: store_dir()?,
        agent,
        agent_source,
        agent_source_label: agent_source.label(),
        home: home()?,
    })
}
