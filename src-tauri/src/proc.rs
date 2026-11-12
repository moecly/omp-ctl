use std::path::PathBuf;
use std::process::Command;

use crate::error::{AppError, Result};

/// Candidate install locations omp uses, tried when `omp` is not on `PATH`.
/// GUI launches on macOS get a minimal `PATH`, and Windows only resolves
/// `.exe` — a `bun install -g` shim is `omp.cmd`, which `CreateProcessW`
/// never finds by name alone.
fn fallback_dirs() -> Vec<PathBuf> {
    let mut out: Vec<PathBuf> = Vec::new();
    let mut push = |p: PathBuf| {
        if !out.contains(&p) {
            out.push(p);
        }
    };
    if let Some(home) = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .filter(|v| !v.is_empty())
    {
        let home = PathBuf::from(home);
        push(home.join(".local/bin"));
        push(home.join(".bun/bin"));
    }
    if cfg!(windows) {
        if let Some(local) = std::env::var_os("LOCALAPPDATA").filter(|v| !v.is_empty()) {
            push(PathBuf::from(local).join("omp"));
        }
        if let Some(roaming) = std::env::var_os("APPDATA").filter(|v| !v.is_empty()) {
            push(PathBuf::from(roaming).join("npm"));
        }
    }
    for dir in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"] {
        push(PathBuf::from(dir));
    }
    out
}

fn exe_names() -> &'static [&'static str] {
    if cfg!(windows) {
        &["omp.exe", "omp.cmd", "omp.bat", "omp"]
    } else {
        &["omp"]
    }
}

fn resolve() -> PathBuf {
    if let Some(explicit) = std::env::var_os("OMP_BIN").filter(|v| !v.is_empty()) {
        return PathBuf::from(explicit);
    }
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|path| std::env::split_paths(&path).collect())
        .unwrap_or_default();
    dirs.extend(fallback_dirs());
    for dir in dirs {
        for name in exe_names() {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return candidate;
            }
        }
    }
    // Let the OS try, so a missing CLI still reports its usual "not found" text.
    PathBuf::from("omp")
}

#[cfg(not(test))]
static OMP_BIN: std::sync::LazyLock<PathBuf> = std::sync::LazyLock::new(resolve);

/// Resolved `omp` executable. Re-resolved per call under `cfg(test)`, where
/// sandboxes mutate `PATH`/`HOME`.
pub fn omp_bin() -> PathBuf {
    #[cfg(test)]
    {
        resolve()
    }
    #[cfg(not(test))]
    {
        OMP_BIN.clone()
    }
}

fn command() -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(omp_bin());
    // A GUI-subsystem process owns no console, so every console child allocates
    // a visible one; without this flag each omp call flashes a terminal window.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Run the `omp` CLI with `args`; success yields stdout, failure an `Internal` error.
pub fn omp(args: &[&str]) -> Result<String> {
    let out = command()
        .args(args)
        .output()
        .map_err(|e| AppError::internal(format!("omp {}: {e}", args.join(" "))))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        let detail = if stderr.is_empty() {
            String::from_utf8_lossy(&out.stdout).trim().to_string()
        } else {
            stderr
        };
        return Err(AppError::internal(format!(
            "omp {}: {detail}",
            args.join(" ")
        )));
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}
