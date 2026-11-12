use std::path::PathBuf;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};

/// User home directory.
///
/// Windows Explorer launches set `USERPROFILE`, not `HOME`, so reading only
/// `HOME` made every path resolve under the process working directory while
/// omp (which uses `os.homedir()`) kept reading `%USERPROFILE%\.omp`.
pub fn home() -> Result<PathBuf> {
    for key in ["HOME", "USERPROFILE"] {
        if let Some(v) = std::env::var_os(key).filter(|v| !v.is_empty()) {
            return Ok(PathBuf::from(v));
        }
    }
    let drive = std::env::var_os("HOMEDRIVE");
    let leaf = std::env::var_os("HOMEPATH");
    if let (Some(drive), Some(leaf)) = (drive, leaf) {
        if !drive.is_empty() && !leaf.is_empty() {
            let mut path = PathBuf::from(drive);
            path.push(leaf);
            return Ok(path);
        }
    }
    std::env::current_dir()
        .map_err(|e| AppError::internal(format!("cannot resolve HOME or cwd: {e}")))
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
#[allow(dead_code)]
static AGENT_DIR_CACHE: OnceLock<(PathBuf, DirSource)> = OnceLock::new();

fn agent_dir_inner() -> Result<(PathBuf, DirSource)> {
    // tests mutate HOME/env per sandbox, so the process-wide cache must not apply
    #[cfg(test)]
    {
        return agent_dir_uncached();
    }
    #[cfg(not(test))]
    {
        if let Some(cached) = AGENT_DIR_CACHE.get() {
            return Ok(cached.clone());
        }
        let resolved = agent_dir_uncached()?;
        let _ = AGENT_DIR_CACHE.set(resolved.clone());
        Ok(resolved)
    }
}

fn agent_dir_uncached() -> Result<(PathBuf, DirSource)> {
    // 1. authoritative: omp CLI
    if let Ok(stdout) = crate::proc::omp(&["config", "path"]) {
        let s = stdout.trim().to_string();
        if !s.is_empty() {
            return Ok((PathBuf::from(s), DirSource::OmpCli));
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
            return Ok((
                home()?.join(".omp/profiles").join(p).join("agent"),
                DirSource::EnvProfile,
            ));
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
