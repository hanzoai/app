use std::path::{Path, PathBuf};

/// Resolve the path to the hanzod binary
pub fn resolve_bin(name: &str) -> PathBuf {
    // Try to find in PATH first
    if let Ok(path) = which::which(name) {
        return path;
    }

    // Fall back to common locations
    let candidates = vec![
        PathBuf::from(format!("/usr/local/bin/{}", name)),
        PathBuf::from(format!("/usr/bin/{}", name)),
        PathBuf::from(format!("./target/debug/{}", name)),
        PathBuf::from(format!("./target/release/{}", name)),
    ];

    for candidate in candidates {
        if candidate.exists() {
            return candidate;
        }
    }

    // Default to assuming it's in PATH
    PathBuf::from(name)
}

/// Get the default storage directory for node data
pub fn default_storage_dir() -> PathBuf {
    if let Some(data_dir) = dirs::data_local_dir() {
        data_dir.join("hanzo").join("node_storage")
    } else {
        PathBuf::from("./node_storage")
    }
}

/// Ensure a directory exists, creating it if necessary
pub fn ensure_dir(path: &Path) -> std::io::Result<()> {
    if !path.exists() {
        std::fs::create_dir_all(path)?;
    }
    Ok(())
}