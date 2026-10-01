use std::path::PathBuf;

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AppError {
    Fs {
        path: String,
        message: String,
    },
    Yaml {
        path: String,
        message: String,
    },
    Validation {
        field: String,
        message: String,
    },
    Probe {
        status: Option<u16>,
        message: String,
    },
    Internal {
        message: String,
    },
}

impl AppError {
    pub fn fs(path: impl Into<PathBuf>, message: impl Into<String>) -> Self {
        AppError::Fs {
            path: path.into().to_string_lossy().into_owned(),
            message: message.into(),
        }
    }

    pub fn yaml(path: impl Into<PathBuf>, message: impl Into<String>) -> Self {
        AppError::Yaml {
            path: path.into().to_string_lossy().into_owned(),
            message: message.into(),
        }
    }

    pub fn validation(field: impl Into<String>, message: impl Into<String>) -> Self {
        AppError::Validation {
            field: field.into(),
            message: message.into(),
        }
    }

    pub fn probe(status: Option<u16>, message: impl Into<String>) -> Self {
        AppError::Probe {
            status,
            message: message.into(),
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        AppError::Internal {
            message: message.into(),
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::Fs { path, message } => write!(f, "fs error at {path}: {message}"),
            AppError::Yaml { path, message } => write!(f, "yaml error at {path}: {message}"),
            AppError::Validation { field, message } => write!(f, "invalid `{field}`: {message}"),
            AppError::Probe { status, message } => match status {
                Some(code) => write!(f, "probe failed (HTTP {code}): {message}"),
                None => write!(f, "probe failed: {message}"),
            },
            AppError::Internal { message } => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Internal {
            message: e.to_string(),
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Internal {
            message: e.to_string(),
        }
    }
}

pub type Result<T, E = AppError> = std::result::Result<T, E>;
