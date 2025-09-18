use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub id: Option<Value>,
    pub method: String,
    pub params: Option<Value>,
    pub jsonrpc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub id: Option<Value>,
    pub result: Option<Value>,
    pub error: Option<JsonRpcError>,
    pub jsonrpc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    pub data: Option<Value>,
}

#[derive(Debug, Clone)]
pub struct McpServerConfig {
    pub port: u16,
    pub auth_token: Option<String>,
    pub enable_logging: bool,
}

impl Default for McpServerConfig {
    fn default() -> Self {
        Self {
            port: 9222,
            auth_token: None,
            enable_logging: true,
        }
    }
}

pub struct McpServer {
    config: McpServerConfig,
    app_handle: AppHandle,
    is_running: Arc<RwLock<bool>>,
}

impl McpServer {
    pub fn new(app_handle: AppHandle, config: McpServerConfig) -> Self {
        Self {
            config,
            app_handle,
            is_running: Arc::new(RwLock::new(false)),
        }
    }

    pub async fn start(&self) -> Result<()> {
        let addr = format!("127.0.0.1:{}", self.config.port);
        let listener = TcpListener::bind(&addr)
            .await
            .map_err(|e| anyhow!("Failed to bind to {}: {}", addr, e))?;

        {
            let mut running = self.is_running.write().await;
            *running = true;
        }

        log::info!("MCP Server started on {}", addr);

        loop {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    if self.config.enable_logging {
                        log::debug!("New MCP connection from: {}", addr);
                    }

                    let server = self.clone();
                    tokio::spawn(async move {
                        if let Err(e) = server.handle_connection(stream).await {
                            log::error!("Error handling MCP connection: {}", e);
                        }
                    });
                }
                Err(e) => {
                    log::error!("Failed to accept connection: {}", e);
                }
            }

            // Check if we should stop
            if !*self.is_running.read().await {
                break;
            }
        }

        Ok(())
    }

    pub async fn stop(&self) {
        let mut running = self.is_running.write().await;
        *running = false;
        log::info!("MCP Server stopped");
    }

    async fn handle_connection(&self, mut stream: TcpStream) -> Result<()> {
        let mut buffer = [0; 1024];

        loop {
            let n = stream.read(&mut buffer).await?;
            if n == 0 {
                break; // Connection closed
            }

            let request_data = String::from_utf8_lossy(&buffer[..n]);
            if self.config.enable_logging {
                log::debug!("Received MCP request: {}", request_data);
            }

            // Parse JSON-RPC request
            let request: JsonRpcRequest = match serde_json::from_str(&request_data) {
                Ok(req) => req,
                Err(e) => {
                    let error_response = JsonRpcResponse {
                        id: None,
                        result: None,
                        error: Some(JsonRpcError {
                            code: -32700,
                            message: "Parse error".to_string(),
                            data: Some(json!({"error": e.to_string()})),
                        }),
                        jsonrpc: "2.0".to_string(),
                    };

                    let response = serde_json::to_string(&error_response)?;
                    stream.write_all(response.as_bytes()).await?;
                    continue;
                }
            };

            // Handle the request
            let response = self.handle_request(request).await;
            let response_data = serde_json::to_string(&response)?;

            if self.config.enable_logging {
                log::debug!("Sending MCP response: {}", response_data);
            }

            stream.write_all(response_data.as_bytes()).await?;
        }

        Ok(())
    }

    async fn handle_request(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        match request.method.as_str() {
            "Runtime.evaluate" => self.handle_runtime_evaluate(request).await,
            "Runtime.getProperties" => self.handle_runtime_get_properties(request).await,
            "DOM.getDocument" => self.handle_dom_get_document(request).await,
            "DOM.querySelector" => self.handle_dom_query_selector(request).await,
            "DOM.performSearch" => self.handle_dom_perform_search(request).await,
            "Input.dispatchMouseEvent" => self.handle_input_mouse_event(request).await,
            "Input.dispatchKeyEvent" => self.handle_input_key_event(request).await,
            "Page.captureScreenshot" => self.handle_page_screenshot(request).await,
            "Page.navigate" => self.handle_page_navigate(request).await,
            "Target.getTargets" => self.handle_target_get_targets(request).await,
            "hanzo.getDebugInfo" => self.handle_hanzo_get_debug_info(request).await,
            "hanzo.executeJS" => self.handle_hanzo_execute_js(request).await,
            "hanzo.clickElement" => self.handle_hanzo_click_element(request).await,
            "hanzo.getWindows" => self.handle_hanzo_get_windows(request).await,
            _ => JsonRpcResponse {
                id: request.id,
                result: None,
                error: Some(JsonRpcError {
                    code: -32601,
                    message: "Method not found".to_string(),
                    data: Some(json!({"method": request.method})),
                }),
                jsonrpc: "2.0".to_string(),
            },
        }
    }

    async fn handle_runtime_evaluate(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        let params = request.params.unwrap_or(json!({}));
        let expression = params
            .get("expression")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // Use our existing eval_js command
        match crate::commands::remote_control::eval_js(
            self.app_handle.clone(),
            None,
            expression.to_string(),
        )
        .await
        {
            Ok(result) => JsonRpcResponse {
                id: request.id,
                result: Some(json!({
                    "result": {
                        "type": if result.success { "object" } else { "undefined" },
                        "value": result.result
                    },
                    "exceptionDetails": result.error.map(|e| json!({"text": e}))
                })),
                error: None,
                jsonrpc: "2.0".to_string(),
            },
            Err(e) => JsonRpcResponse {
                id: request.id,
                result: None,
                error: Some(JsonRpcError {
                    code: -32603,
                    message: "Internal error".to_string(),
                    data: Some(json!({"error": e})),
                }),
                jsonrpc: "2.0".to_string(),
            },
        }
    }

    async fn handle_runtime_get_properties(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        JsonRpcResponse {
            id: request.id,
            result: Some(json!({
                "result": [],
                "internalProperties": []
            })),
            error: None,
            jsonrpc: "2.0".to_string(),
        }
    }

    async fn handle_dom_get_document(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        match crate::commands::remote_control::get_dom(self.app_handle.clone(), None).await {
            Ok(dom) => JsonRpcResponse {
                id: request.id,
                result: Some(json!({
                    "root": {
                        "nodeId": 1,
                        "nodeType": 9, // DOCUMENT_NODE
                        "nodeName": "#document",
                        "localName": "",
                        "nodeValue": "",
                        "childNodeCount": 1,
                        "children": [{
                            "nodeId": 2,
                            "nodeType": 1, // ELEMENT_NODE
                            "nodeName": "HTML",
                            "localName": "html",
                            "nodeValue": "",
                            "childNodeCount": dom.elements.len(),
                            "attributes": []
                        }]
                    }
                })),
                error: None,
                jsonrpc: "2.0".to_string(),
            },
            Err(e) => JsonRpcResponse {
                id: request.id,
                result: None,
                error: Some(JsonRpcError {
                    code: -32603,
                    message: "Internal error".to_string(),
                    data: Some(json!({"error": e})),
                }),
                jsonrpc: "2.0".to_string(),
            },
        }
    }

    async fn handle_dom_query_selector(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        let params = request.params.unwrap_or(json!({}));
        let selector = params
            .get("selector")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        JsonRpcResponse {
            id: request.id,
            result: Some(json!({
                "nodeId": 3 // Mock node ID
            })),
            error: None,
            jsonrpc: "2.0".to_string(),
        }
    }

    async fn handle_dom_perform_search(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        JsonRpcResponse {
            id: request.id,
            result: Some(json!({
                "searchId": "search_1",
                "resultCount": 0
            })),
            error: None,
            jsonrpc: "2.0".to_string(),
        }
    }

    async fn handle_input_mouse_event(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        JsonRpcResponse {
            id: request.id,
            result: Some(json!({})),
            error: None,
            jsonrpc: "2.0".to_string(),
        }
    }

    async fn handle_input_key_event(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        JsonRpcResponse {
            id: request.id,
            result: Some(json!({})),
            error: None,
            jsonrpc: "2.0".to_string(),
        }
    }

    async fn handle_page_screenshot(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        match crate::commands::remote_control::get_screenshot(self.app_handle.clone(), None).await {
            Ok(screenshot) => JsonRpcResponse {
                id: request.id,
                result: Some(json!({
                    "data": screenshot.data.unwrap_or_else(|| "".to_string())
                })),
                error: None,
                jsonrpc: "2.0".to_string(),
            },
            Err(e) => JsonRpcResponse {
                id: request.id,
                result: None,
                error: Some(JsonRpcError {
                    code: -32603,
                    message: "Internal error".to_string(),
                    data: Some(json!({"error": e})),
                }),
                jsonrpc: "2.0".to_string(),
            },
        }
    }

    async fn handle_page_navigate(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        JsonRpcResponse {
            id: request.id,
            result: Some(json!({
                "frameId": "main",
                "loaderId": "loader_1"
            })),
            error: None,
            jsonrpc: "2.0".to_string(),
        }
    }

    async fn handle_target_get_targets(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        match crate::commands::remote_control::get_windows_info(self.app_handle.clone()).await {
            Ok(windows) => JsonRpcResponse {
                id: request.id,
                result: Some(json!({
                    "targetInfos": windows.iter().map(|w| json!({
                        "targetId": w.get("label").unwrap_or(&json!("unknown")),
                        "type": "page",
                        "title": "Hanzo AI",
                        "url": "app://localhost",
                        "attached": true,
                        "canAccessOpener": false
                    })).collect::<Vec<_>>()
                })),
                error: None,
                jsonrpc: "2.0".to_string(),
            },
            Err(e) => JsonRpcResponse {
                id: request.id,
                result: None,
                error: Some(JsonRpcError {
                    code: -32603,
                    message: "Internal error".to_string(),
                    data: Some(json!({"error": e})),
                }),
                jsonrpc: "2.0".to_string(),
            },
        }
    }

    // Custom Hanzo methods
    async fn handle_hanzo_get_debug_info(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        match crate::commands::remote_control::get_debug_info(self.app_handle.clone()).await {
            Ok(info) => JsonRpcResponse {
                id: request.id,
                result: Some(json!(info)),
                error: None,
                jsonrpc: "2.0".to_string(),
            },
            Err(e) => JsonRpcResponse {
                id: request.id,
                result: None,
                error: Some(JsonRpcError {
                    code: -32603,
                    message: "Internal error".to_string(),
                    data: Some(json!({"error": e})),
                }),
                jsonrpc: "2.0".to_string(),
            },
        }
    }

    async fn handle_hanzo_execute_js(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        let params = request.params.unwrap_or(json!({}));
        let script = params.get("script").and_then(|v| v.as_str()).unwrap_or("");
        let window = params
            .get("window")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        match crate::commands::remote_control::eval_js(
            self.app_handle.clone(),
            window,
            script.to_string(),
        )
        .await
        {
            Ok(result) => JsonRpcResponse {
                id: request.id,
                result: Some(json!(result)),
                error: None,
                jsonrpc: "2.0".to_string(),
            },
            Err(e) => JsonRpcResponse {
                id: request.id,
                result: None,
                error: Some(JsonRpcError {
                    code: -32603,
                    message: "Internal error".to_string(),
                    data: Some(json!({"error": e})),
                }),
                jsonrpc: "2.0".to_string(),
            },
        }
    }

    async fn handle_hanzo_click_element(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        let params = request.params.unwrap_or(json!({}));
        let selector = params
            .get("selector")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let window = params
            .get("window")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        match crate::commands::remote_control::click_element(
            self.app_handle.clone(),
            window,
            selector.to_string(),
        )
        .await
        {
            Ok(result) => JsonRpcResponse {
                id: request.id,
                result: Some(json!(result)),
                error: None,
                jsonrpc: "2.0".to_string(),
            },
            Err(e) => JsonRpcResponse {
                id: request.id,
                result: None,
                error: Some(JsonRpcError {
                    code: -32603,
                    message: "Internal error".to_string(),
                    data: Some(json!({"error": e})),
                }),
                jsonrpc: "2.0".to_string(),
            },
        }
    }

    async fn handle_hanzo_get_windows(&self, request: JsonRpcRequest) -> JsonRpcResponse {
        match crate::commands::remote_control::get_windows_info(self.app_handle.clone()).await {
            Ok(windows) => JsonRpcResponse {
                id: request.id,
                result: Some(json!(windows)),
                error: None,
                jsonrpc: "2.0".to_string(),
            },
            Err(e) => JsonRpcResponse {
                id: request.id,
                result: None,
                error: Some(JsonRpcError {
                    code: -32603,
                    message: "Internal error".to_string(),
                    data: Some(json!({"error": e})),
                }),
                jsonrpc: "2.0".to_string(),
            },
        }
    }
}

impl Clone for McpServer {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            app_handle: self.app_handle.clone(),
            is_running: self.is_running.clone(),
        }
    }
}

// Tauri commands for MCP server control
#[tauri::command]
pub async fn start_mcp_server(
    app: AppHandle,
    port: Option<u16>,
    auth_token: Option<String>,
) -> Result<String, String> {
    let config = McpServerConfig {
        port: port.unwrap_or(9222),
        auth_token,
        enable_logging: true,
    };

    let server = McpServer::new(app, config.clone());

    // Start the server in a background task
    tokio::spawn(async move {
        if let Err(e) = server.start().await {
            log::error!("MCP Server error: {}", e);
        }
    });

    Ok(format!("MCP Server starting on port {}", config.port))
}

#[tauri::command]
pub async fn get_mcp_server_status() -> Result<serde_json::Value, String> {
    // This is a simple status check - in a real implementation,
    // we'd maintain server state globally
    Ok(json!({
        "running": true,
        "port": 9222,
        "protocol": "JSON-RPC",
        "methods": [
            "Runtime.evaluate",
            "DOM.getDocument",
            "DOM.querySelector",
            "Page.captureScreenshot",
            "hanzo.executeJS",
            "hanzo.clickElement",
            "hanzo.getWindows",
            "hanzo.getDebugInfo"
        ]
    }))
}
