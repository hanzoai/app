use chrono::Local;
use log::{error, info};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use tauri::Manager;

use crate::globals::HANZO_NODE_MANAGER_INSTANCE;
use crate::local_hanzo_node::hanzo_node_manager::HanzoNodeManager;
use crate::local_hanzo_node::hanzo_node_options::HanzoNodeOptions;
use crate::windows::{recreate_window, Window};

// Helper function to recursively copy directories
fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.as_ref().join(entry.file_name());

        if ty.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn show_hanzo_node_manager_window(app_handle: tauri::AppHandle) {
    let _ = recreate_window(app_handle, Window::HanzoNodeManager, true);
}

#[tauri::command]
pub async fn hanzo_node_is_running() -> Result<bool, String> {
    let hanzo_node_manager_guard = HANZO_NODE_MANAGER_INSTANCE.get().unwrap().read().await;
    let is_running = hanzo_node_manager_guard.is_running().await;
    Ok(is_running)
}

#[tauri::command]
pub async fn hanzo_node_set_options(options: HanzoNodeOptions) -> Result<HanzoNodeOptions, String> {
    let mut hanzo_node_manager_guard = HANZO_NODE_MANAGER_INSTANCE.get().unwrap().write().await;
    let options = hanzo_node_manager_guard
        .set_hanzo_node_options(options)
        .await;
    Ok(options)
}

#[tauri::command]
pub async fn hanzo_node_get_options() -> Result<HanzoNodeOptions, String> {
    let hanzo_node_manager_guard = HANZO_NODE_MANAGER_INSTANCE.get().unwrap().read().await;
    let options = hanzo_node_manager_guard.get_hanzo_node_options().await;
    Ok(options)
}

#[tauri::command]
pub async fn hanzod_spawn(node: tauri::State<'_, crate::node::Node>) -> Result<(), String> {
    log::info!("hanzod_spawn command called -> delegating to node_start()");
    // Use the simplified node_start command instead of HanzoNodeManager
    node.start().await
}

#[tauri::command]
pub async fn hanzo_node_kill() -> Result<(), String> {
    let mut hanzo_node_manager_guard = HANZO_NODE_MANAGER_INSTANCE.get().unwrap().write().await;
    hanzo_node_manager_guard.kill().await;
    Ok(())
}

#[tauri::command]
pub async fn hanzo_node_remove_storage(preserve_keys: bool) -> Result<(), String> {
    let hanzo_node_manager_guard = HANZO_NODE_MANAGER_INSTANCE.get().unwrap().write().await;
    match hanzo_node_manager_guard.remove_storage(preserve_keys).await {
        Ok(_) => Ok(()),
        Err(_) => Ok(()),
    }
}

#[tauri::command]
pub async fn hanzo_node_set_default_options() -> Result<HanzoNodeOptions, String> {
    let mut hanzo_node_manager_guard = HANZO_NODE_MANAGER_INSTANCE.get().unwrap().write().await;
    let options = hanzo_node_manager_guard
        .set_default_hanzo_node_options()
        .await;
    Ok(options)
}

#[tauri::command]
pub async fn hanzo_node_get_ollama_api_url() -> Result<String, String> {
    let hanzo_node_manager_guard = HANZO_NODE_MANAGER_INSTANCE.get().unwrap().read().await;
    let ollama_api_url = hanzo_node_manager_guard.get_ollama_api_url();
    Ok(ollama_api_url)
}

#[tauri::command]
pub async fn hanzo_node_get_default_model() -> Result<String, String> {
    Ok("hanzo-backend:FREE_TEXT_INFERENCE".to_string())
}

#[tauri::command]
pub async fn hanzo_node_get_ollama_version(app_handle: tauri::AppHandle) -> Result<String, String> {
    match HanzoNodeManager::get_ollama_version(app_handle).await {
        Ok(version) => Ok(version),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
pub async fn hanzo_node_open_storage_location() -> Result<(), String> {
    let hanzo_node_manager_guard = HANZO_NODE_MANAGER_INSTANCE.get().unwrap().read().await;
    match hanzo_node_manager_guard.open_storage_location() {
        Ok(_) => Ok(()),
        Err(message) => Err(message),
    }
}

#[tauri::command]
pub async fn hanzo_node_open_storage_location_with_path(
    relative_path: String,
) -> Result<(), String> {
    let hanzo_node_manager_guard = HANZO_NODE_MANAGER_INSTANCE.get().unwrap().read().await;
    match hanzo_node_manager_guard.open_storage_location_with_path(&relative_path) {
        Ok(_) => Ok(()),
        Err(message) => Err(message),
    }
}

#[tauri::command]
pub async fn hanzo_node_open_chat_folder(
    storage_location: &str,
    chat_folder_name: &str,
) -> Result<(), String> {
    let hanzo_node_manager_guard = HANZO_NODE_MANAGER_INSTANCE.get().unwrap().read().await;
    match hanzo_node_manager_guard.open_chat_folder(storage_location, chat_folder_name) {
        Ok(_) => Ok(()),
        Err(message) => Err(message),
    }
}

#[tauri::command]
pub async fn hanzo_node_full_reset(app_handle: tauri::AppHandle) -> Result<String, String> {
    info!("Starting full Hanzo node reset with backup");

    // Step 1: Kill the node if running
    {
        let mut hanzo_node_manager_guard = HANZO_NODE_MANAGER_INSTANCE.get().unwrap().write().await;
        hanzo_node_manager_guard.kill().await;
        info!("Killed Hanzo node process");
    }

    // Step 2: Create backup directory with timestamp
    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let backup_dir = app_data_dir.join(format!("backups/backup_{}", timestamp));
    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;

    // Step 3: Backup current node storage if it exists
    {
        let hanzo_node_manager_guard = HANZO_NODE_MANAGER_INSTANCE.get().unwrap().read().await;
        let storage_path = hanzo_node_manager_guard.get_storage_path();

        if storage_path.exists() {
            let backup_storage = backup_dir.join("node_storage");
            info!(
                "Backing up node storage from {:?} to {:?}",
                storage_path, backup_storage
            );

            // Recursively copy the directory
            copy_dir_all(&storage_path, &backup_storage)
                .map_err(|e| format!("Failed to backup storage: {}", e))?;
        }
    }

    // Step 4: Backup local storage data
    let local_storage_dir = app_data_dir.join("localStorage");
    if local_storage_dir.exists() {
        let backup_local_storage = backup_dir.join("localStorage");
        info!("Backing up local storage to {:?}", backup_local_storage);

        copy_dir_all(&local_storage_dir, &backup_local_storage)
            .map_err(|e| format!("Failed to backup local storage: {}", e))?;
    }

    // Step 5: Clear all app data
    {
        let mut hanzo_node_manager_guard = HANZO_NODE_MANAGER_INSTANCE.get().unwrap().write().await;

        // Remove node storage completely
        let _ = hanzo_node_manager_guard.remove_storage(false).await;
        info!("Removed node storage");

        // Reset to default options
        hanzo_node_manager_guard
            .set_default_hanzo_node_options()
            .await;
        info!("Reset to default node options");
    }

    // Step 6: Clear browser/webview cache
    if let Ok(cache_dir) = app_handle.path().app_cache_dir() {
        if cache_dir.exists() {
            let _ = fs::remove_dir_all(&cache_dir);
            info!("Cleared app cache");
        }
    }

    // Step 7: Restart the application
    info!("Full reset complete. Backup saved to: {:?}", backup_dir);
    let backup_path = format!("Reset complete. Backup saved to: {}", backup_dir.display());

    // Trigger app restart
    app_handle.restart();

    Ok(backup_path)
}
