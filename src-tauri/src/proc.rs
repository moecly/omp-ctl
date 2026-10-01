use std::process::Command;

use crate::error::{AppError, Result};

/// Run the `omp` CLI with `args`; success yields stdout, failure an `Internal` error.
pub fn omp(args: &[&str]) -> Result<String> {
    let out = Command::new("omp")
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
