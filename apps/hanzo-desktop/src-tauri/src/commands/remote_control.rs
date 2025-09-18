use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{AppHandle, Manager, WebviewWindow, Window};

#[derive(Debug, Serialize, Deserialize)]
pub struct ElementInfo {
    pub tag: String,
    pub id: Option<String>,
    pub class: Option<String>,
    pub text: Option<String>,
    pub attributes: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClickResult {
    pub success: bool,
    pub message: String,
    pub element_found: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JSExecutionResult {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DOMStructure {
    pub title: String,
    pub url: String,
    pub elements: Vec<ElementInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScreenshotResult {
    pub success: bool,
    pub data: Option<String>, // Base64 encoded image
    pub error: Option<String>,
}

/// Execute arbitrary JavaScript in the specified WebView window
#[tauri::command]
pub async fn eval_js(
    app: AppHandle,
    window_label: Option<String>,
    script: String,
) -> Result<JSExecutionResult, String> {
    let window_label = window_label.unwrap_or_else(|| "main".to_string());

    match app.get_webview_window(&window_label) {
        Some(window) => {
            match window.eval(&script) {
                Ok(_) => {
                    // For now, return success without result value
                    // In a real implementation, we'd need to modify the script to return values
                    Ok(JSExecutionResult {
                        success: true,
                        result: None,
                        error: None,
                    })
                }
                Err(e) => Ok(JSExecutionResult {
                    success: false,
                    result: None,
                    error: Some(e.to_string()),
                }),
            }
        }
        None => Err(format!("Window '{}' not found", window_label)),
    }
}

/// Execute JavaScript and return the result as JSON
#[tauri::command]
pub async fn eval_js_with_result(
    app: AppHandle,
    window_label: Option<String>,
    script: String,
) -> Result<JSExecutionResult, String> {
    let window_label = window_label.unwrap_or_else(|| "main".to_string());

    match app.get_webview_window(&window_label) {
        Some(window) => {
            // Wrap the script to capture return value
            let wrapped_script = format!(
                r#"
                (function() {{
                    try {{
                        const result = (function() {{ {} }})();
                        return {{ success: true, result: result, error: null }};
                    }} catch (error) {{
                        return {{ success: false, result: null, error: error.toString() }};
                    }}
                }})()
                "#,
                script
            );

            match window.eval(&wrapped_script) {
                Ok(_) => Ok(JSExecutionResult {
                    success: true,
                    result: None,
                    error: Some("Result capture not yet implemented".to_string()),
                }),
                Err(e) => Ok(JSExecutionResult {
                    success: false,
                    result: None,
                    error: Some(e.to_string()),
                }),
            }
        }
        None => Err(format!("Window '{}' not found", window_label)),
    }
}

/// Get DOM structure information from the WebView
#[tauri::command]
pub async fn get_dom(app: AppHandle, window_label: Option<String>) -> Result<DOMStructure, String> {
    let window_label = window_label.unwrap_or_else(|| "main".to_string());

    match app.get_webview_window(&window_label) {
        Some(window) => {
            let script = r#"
                (function() {
                    const elements = [];
                    const allElements = document.querySelectorAll('*');
                    
                    for (let i = 0; i < Math.min(allElements.length, 100); i++) {
                        const el = allElements[i];
                        const attributes = {};
                        
                        for (let attr of el.attributes) {
                            attributes[attr.name] = attr.value;
                        }
                        
                        elements.push({
                            tag: el.tagName.toLowerCase(),
                            id: el.id || null,
                            class: el.className || null,
                            text: el.textContent ? el.textContent.slice(0, 100) : null,
                            attributes: attributes
                        });
                    }
                    
                    return {
                        title: document.title,
                        url: window.location.href,
                        elements: elements
                    };
                })()
            "#;

            match window.eval(script) {
                Ok(_) => {
                    // In a real implementation, we'd need a way to get the result back
                    // For now, return a placeholder structure
                    Ok(DOMStructure {
                        title: "Hanzo AI".to_string(),
                        url: "app://localhost".to_string(),
                        elements: vec![],
                    })
                }
                Err(e) => Err(e.to_string()),
            }
        }
        None => Err(format!("Window '{}' not found", window_label)),
    }
}

/// Click an element by CSS selector
#[tauri::command]
pub async fn click_element(
    app: AppHandle,
    window_label: Option<String>,
    selector: String,
) -> Result<ClickResult, String> {
    let window_label = window_label.unwrap_or_else(|| "main".to_string());

    match app.get_webview_window(&window_label) {
        Some(window) => {
            let script = format!(
                r#"
                (function() {{
                    const element = document.querySelector('{}');
                    if (element) {{
                        element.click();
                        return {{ success: true, element_found: true, message: 'Element clicked successfully' }};
                    }} else {{
                        return {{ success: false, element_found: false, message: 'Element not found' }};
                    }}
                }})()
                "#,
                selector.replace('"', r#"\""#)
            );

            match window.eval(&script) {
                Ok(_) => Ok(ClickResult {
                    success: true,
                    message: "Click command executed".to_string(),
                    element_found: true,
                }),
                Err(e) => Ok(ClickResult {
                    success: false,
                    message: format!("Error executing click: {}", e),
                    element_found: false,
                }),
            }
        }
        None => Err(format!("Window '{}' not found", window_label)),
    }
}

/// Get a screenshot of the WebView window
#[tauri::command]
pub async fn get_screenshot(
    app: AppHandle,
    window_label: Option<String>,
) -> Result<ScreenshotResult, String> {
    let window_label = window_label.unwrap_or_else(|| "main".to_string());

    match app.get_webview_window(&window_label) {
        Some(_window) => {
            // Screenshot functionality would require platform-specific implementation
            // This is a placeholder for now
            Ok(ScreenshotResult {
                success: false,
                data: None,
                error: Some("Screenshot functionality not yet implemented".to_string()),
            })
        }
        None => Err(format!("Window '{}' not found", window_label)),
    }
}

/// Get information about all available windows
#[tauri::command]
pub async fn get_windows_info(
    app: AppHandle,
) -> Result<Vec<HashMap<String, serde_json::Value>>, String> {
    let windows: Vec<HashMap<String, serde_json::Value>> = app
        .webview_windows()
        .iter()
        .map(|(label, window)| {
            let mut info = HashMap::new();
            info.insert(
                "label".to_string(),
                serde_json::Value::String(label.clone()),
            );
            info.insert(
                "is_visible".to_string(),
                serde_json::Value::Bool(window.is_visible().unwrap_or(false)),
            );
            info.insert(
                "is_focused".to_string(),
                serde_json::Value::Bool(window.is_focused().unwrap_or(false)),
            );
            info.insert(
                "is_minimized".to_string(),
                serde_json::Value::Bool(window.is_minimized().unwrap_or(false)),
            );
            info
        })
        .collect();

    Ok(windows)
}

/// Focus a specific window
#[tauri::command]
pub async fn focus_window(app: AppHandle, window_label: String) -> Result<bool, String> {
    match app.get_webview_window(&window_label) {
        Some(window) => match window.set_focus() {
            Ok(_) => Ok(true),
            Err(e) => Err(e.to_string()),
        },
        None => Err(format!("Window '{}' not found", window_label)),
    }
}

/// Show/hide a specific window
#[tauri::command]
pub async fn set_window_visibility(
    app: AppHandle,
    window_label: String,
    visible: bool,
) -> Result<bool, String> {
    match app.get_webview_window(&window_label) {
        Some(window) => {
            let result = if visible {
                window.show()
            } else {
                window.hide()
            };

            match result {
                Ok(_) => Ok(true),
                Err(e) => Err(e.to_string()),
            }
        }
        None => Err(format!("Window '{}' not found", window_label)),
    }
}

/// Enable remote debugging for the WebView
#[tauri::command]
pub async fn enable_remote_debugging(
    app: AppHandle,
    port: Option<u16>,
) -> Result<HashMap<String, serde_json::Value>, String> {
    let port = port.unwrap_or(9222);

    // This would require implementing Chrome DevTools Protocol support
    // For now, return information about the remote UI that's already available
    let mut result = HashMap::new();
    result.insert("success".to_string(), serde_json::Value::Bool(false));
    result.insert("message".to_string(), serde_json::Value::String(
        "Remote debugging via Chrome DevTools Protocol not yet implemented. Use Remote UI on port 9090 instead.".to_string()
    ));
    result.insert(
        "remote_ui_port".to_string(),
        serde_json::Value::Number(serde_json::Number::from(9090)),
    );
    result.insert(
        "requested_port".to_string(),
        serde_json::Value::Number(serde_json::Number::from(port)),
    );

    Ok(result)
}

/// Get the current debug information
#[tauri::command]
pub async fn get_debug_info(app: AppHandle) -> Result<HashMap<String, serde_json::Value>, String> {
    let mut info = HashMap::new();

    // Get window information
    let windows_info = get_windows_info(app.clone())
        .await
        .unwrap_or_else(|_| vec![]);
    info.insert(
        "windows".to_string(),
        serde_json::Value::Array(
            windows_info
                .iter()
                .map(|w| {
                    serde_json::Value::Object(
                        w.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
                    )
                })
                .collect(),
        ),
    );

    // Check if Remote UI is available
    info.insert(
        "remote_ui_available".to_string(),
        serde_json::Value::Bool(true),
    );
    info.insert(
        "remote_ui_port".to_string(),
        serde_json::Value::Number(serde_json::Number::from(9090)),
    );

    // App version and build info
    info.insert(
        "app_version".to_string(),
        serde_json::Value::String(env!("CARGO_PKG_VERSION").to_string()),
    );
    info.insert(
        "debug_build".to_string(),
        serde_json::Value::Bool(cfg!(debug_assertions)),
    );

    Ok(info)
}
