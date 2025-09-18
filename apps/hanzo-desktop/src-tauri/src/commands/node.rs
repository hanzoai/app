use tauri::State;
use crate::node::Node;

/// Start hanzod (attach to existing or spawn new)
#[tauri::command]
pub async fn node_start(node: State<'_, Node>) -> Result<(), String> {
    node.start().await
}

/// Check if hanzod is running
#[tauri::command]
pub async fn node_status(node: State<'_, Node>) -> Result<bool, String> {
    Ok(node.is_running().await)
}

/// Stop hanzod (if we spawned it)
#[tauri::command]
pub async fn node_stop(node: State<'_, Node>) -> Result<(), String> {
    node.stop().await
}