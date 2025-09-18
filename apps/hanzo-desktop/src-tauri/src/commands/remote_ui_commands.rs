use tauri::AppHandle;
use tauri_remote_ui::{RemoteUiConfig, RemoteUiExt};

#[tauri::command]
pub async fn enable_remote_ui(app: AppHandle, port: Option<u16>) -> Result<String, String> {
    let config = RemoteUiConfig::default().set_port(port.or(Some(9090)));

    match app.start_remote_ui(config).await {
        Ok(()) => {
            log::info!(
                "Remote UI server started on port {:?}",
                port.unwrap_or(9090)
            );
            Ok(format!(
                "Remote UI server started on port {}",
                port.unwrap_or(9090)
            ))
        }
        Err(err) => {
            log::error!("Failed to start Remote UI server: {:?}", err);
            Err(format!("Failed to start Remote UI server: {:?}", err))
        }
    }
}

#[tauri::command]
pub async fn disable_remote_ui(app: AppHandle) -> Result<String, String> {
    match app.stop_remote_ui().await {
        Ok(()) => {
            log::info!("Remote UI server stopped");
            Ok("Remote UI server stopped".to_string())
        }
        Err(err) => {
            log::error!("Failed to stop Remote UI server: {:?}", err);
            Err(format!("Failed to stop Remote UI server: {:?}", err))
        }
    }
}

#[tauri::command]
pub async fn get_remote_ui_status(_app: AppHandle) -> Result<bool, String> {
    // For now, we'll return a simple status
    // The actual implementation would check if the server is running
    Ok(false)
}
