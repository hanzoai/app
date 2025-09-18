use anyhow::{anyhow, Result};
use reqwest;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub name: String,
    pub published_at: String,
    pub assets: Vec<GitHubAsset>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f32,
}

pub struct HanzoNodeDownloader {
    app: AppHandle,
    storage_dir: PathBuf,
}

impl HanzoNodeDownloader {
    const GITHUB_API_URL: &'static str = "https://api.github.com/repos/hanzoai/hanzo/releases/latest";
    const BINARY_NAME: &'static str = "hanzod";

    pub fn new(app: AppHandle, storage_dir: PathBuf) -> Self {
        Self { app, storage_dir }
    }

    /// Get the platform-specific binary name
    fn get_platform_binary_name() -> String {
        let os = std::env::consts::OS;
        let arch = std::env::consts::ARCH;

        match (os, arch) {
            ("macos", "aarch64") => "hanzod-darwin-arm64",
            ("macos", "x86_64") => "hanzod-darwin-amd64",
            ("linux", "x86_64") => "hanzod-linux-amd64",
            ("linux", "aarch64") => "hanzod-linux-arm64",
            ("windows", "x86_64") => "hanzod-windows-amd64.exe",
            _ => panic!("Unsupported platform: {}-{}", os, arch),
        }.to_string()
    }

    /// Get the path where the binary should be installed
    pub fn get_binary_path(&self) -> PathBuf {
        self.storage_dir.join(Self::BINARY_NAME)
    }

    /// Check if Hanzo node is already installed
    pub fn is_installed(&self) -> bool {
        self.get_binary_path().exists()
    }

    /// Get the currently installed version
    pub async fn get_installed_version(&self) -> Option<String> {
        if !self.is_installed() {
            return None;
        }

        let binary_path = self.get_binary_path();
        let output = tokio::process::Command::new(&binary_path)
            .arg("--version")
            .output()
            .await
            .ok()?;

        let version_str = String::from_utf8_lossy(&output.stdout);
        // Parse version from output like "hanzod version 0.1.0"
        version_str
            .lines()
            .find(|line| line.contains("version"))
            .and_then(|line| line.split_whitespace().last())
            .map(|v| v.to_string())
    }

    /// Get the latest release info from GitHub
    pub async fn get_latest_release(&self) -> Result<GitHubRelease> {
        let client = reqwest::Client::new();
        let response = client
            .get(Self::GITHUB_API_URL)
            .header("User-Agent", "Hanzo-Desktop")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to fetch release info: {}", response.status()));
        }

        let release: GitHubRelease = response.json().await?;
        Ok(release)
    }

    /// Check if an update is available
    pub async fn check_for_updates(&self) -> Result<(bool, Option<String>)> {
        let latest_release = self.get_latest_release().await?;
        let latest_version = latest_release.tag_name.trim_start_matches('v');

        if let Some(installed_version) = self.get_installed_version().await {
            let installed = installed_version.trim_start_matches('v');
            Ok((installed != latest_version, Some(latest_version.to_string())))
        } else {
            // Not installed, so update is available
            Ok((true, Some(latest_version.to_string())))
        }
    }

    /// Download the Hanzo node binary
    pub async fn download_hanzo_node<F>(&self, progress_callback: F) -> Result<()>
    where
        F: Fn(DownloadProgress) + Send + 'static,
    {
        let release = self.get_latest_release().await?;
        let platform_name = Self::get_platform_binary_name();

        let asset = release
            .assets
            .iter()
            .find(|a| a.name == platform_name)
            .ok_or_else(|| anyhow!("No binary found for platform: {}", platform_name))?;

        log::info!("Downloading {} from {}", asset.name, asset.browser_download_url);

        let client = reqwest::Client::new();
        let response = client
            .get(&asset.browser_download_url)
            .header("User-Agent", "Hanzo-Desktop")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("Failed to download binary: {}", response.status()));
        }

        let total_size = response
            .content_length()
            .unwrap_or(asset.size as u64);

        let temp_path = self.storage_dir.join(format!("{}.tmp", Self::BINARY_NAME));
        let mut file = tokio::fs::File::create(&temp_path).await?;
        let mut downloaded = 0u64;
        let mut stream = response.bytes_stream();

        use futures_util::StreamExt;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            let progress = DownloadProgress {
                downloaded,
                total: total_size,
                percentage: (downloaded as f32 / total_size as f32) * 100.0,
            };
            progress_callback(progress);
        }

        file.flush().await?;
        drop(file);

        // Move temp file to final location
        let final_path = self.get_binary_path();
        tokio::fs::rename(&temp_path, &final_path).await?;

        // Make the binary executable on Unix-like systems
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = tokio::fs::metadata(&final_path).await?.permissions();
            perms.set_mode(0o755);
            tokio::fs::set_permissions(&final_path, perms).await?;
        }

        log::info!("Successfully downloaded and installed Hanzo node to {:?}", final_path);
        Ok(())
    }

    /// Remove the installed Hanzo node binary
    pub async fn uninstall(&self) -> Result<()> {
        let binary_path = self.get_binary_path();
        if binary_path.exists() {
            tokio::fs::remove_file(binary_path).await?;
            log::info!("Uninstalled Hanzo node");
        }
        Ok(())
    }

    /// Update to the latest version
    pub async fn update<F>(&self, progress_callback: F) -> Result<String>
    where
        F: Fn(DownloadProgress) + Send + 'static,
    {
        let (needs_update, latest_version) = self.check_for_updates().await?;

        if !needs_update {
            return Ok("Already up to date".to_string());
        }

        // Backup current binary if it exists
        let binary_path = self.get_binary_path();
        let backup_path = self.storage_dir.join(format!("{}.backup", Self::BINARY_NAME));

        if binary_path.exists() {
            tokio::fs::copy(&binary_path, &backup_path).await?;
        }

        // Download new version
        if let Err(e) = self.download_hanzo_node(progress_callback).await {
            // Restore backup on failure
            if backup_path.exists() {
                tokio::fs::rename(&backup_path, &binary_path).await?;
            }
            return Err(e);
        }

        // Remove backup after successful update
        if backup_path.exists() {
            tokio::fs::remove_file(&backup_path).await?;
        }

        Ok(format!("Updated to version {}", latest_version.unwrap_or_default()))
    }
}

/// Tauri commands for the frontend
#[tauri::command]
pub async fn check_hanzo_node_updates(app: AppHandle) -> Result<(bool, Option<String>), String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let downloader = HanzoNodeDownloader::new(app, app_data_dir);
    downloader.check_for_updates()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn download_hanzo_node(app: AppHandle, window: tauri::Window) -> Result<(), String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let downloader = HanzoNodeDownloader::new(app, app_data_dir);

    downloader.download_hanzo_node(move |progress| {
        let _ = window.emit("hanzo-node-download-progress", progress);
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_hanzo_node(app: AppHandle, window: tauri::Window) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let downloader = HanzoNodeDownloader::new(app, app_data_dir);

    downloader.update(move |progress| {
        let _ = window.emit("hanzo-node-update-progress", progress);
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_hanzo_node_version(app: AppHandle) -> Result<Option<String>, String> {
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let downloader = HanzoNodeDownloader::new(app, app_data_dir);
    Ok(downloader.get_installed_version().await)
}