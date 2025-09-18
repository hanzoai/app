#![forbid(unsafe_code)]
#![warn(clippy::pedantic)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Tauri command names - single source of truth
pub mod commands {
    /// Node lifecycle commands
    pub const NODE_SPAWN: &str = "node_spawn";
    pub const NODE_STOP: &str = "node_stop";
    pub const NODE_STATUS: &str = "node_status";
    pub const NODE_RESTART: &str = "node_restart";
    pub const NODE_ATTACH: &str = "node_attach";

    /// Legacy aliases for backwards compatibility
    pub const HANZOD_SPAWN: &str = "hanzod_spawn";
    pub const HANZOD_STOP: &str = "hanzod_stop";
    pub const HANZOD_STATUS: &str = "hanzod_status";
    pub const HANZOD_RESTART: &str = "hanzod_restart";
}

/// Tauri event names
pub mod events {
    /// Node lifecycle events
    pub const NODE_STARTED: &str = "node:started";
    pub const NODE_STOPPED: &str = "node:stopped";
    pub const NODE_ATTACHED: &str = "node:attached";
    pub const NODE_HEALTH_CHECK: &str = "node:health_check";
    pub const NODE_ERROR: &str = "node:error";

    /// Legacy event names
    pub const HANZOD_STARTED: &str = "hanzod:started";
    pub const HANZOD_STOPPED: &str = "hanzod:stopped";
}

/// Node spawn configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeSpawnConfig {
    pub host: String,
    pub api_port: u16,
    pub ws_port: u16,
    pub node_port: u16,
    pub https_port: u16,
    pub storage_path: String,
    pub no_secret_file: bool,
    pub first_device_needs_registration: bool,
    pub auto_detect_existing: bool,
}

impl Default for NodeSpawnConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            api_port: 3690,
            ws_port: 3691,
            node_port: 3692,
            https_port: 3693,
            storage_path: String::new(),
            no_secret_file: true,
            first_device_needs_registration: false,
            auto_detect_existing: true,
        }
    }
}

/// Node status response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub host: String,
    pub port: u16,
    pub is_external: bool,
    pub health_check_ok: bool,
    pub uptime_seconds: Option<u64>,
}

/// Node spawn response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeSpawnResponse {
    pub success: bool,
    pub pid: Option<u32>,
    pub host: String,
    pub port: u16,
    pub attached_to_existing: bool,
    pub message: String,
}

/// Node error response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeError {
    pub code: String,
    pub message: String,
    pub details: Option<HashMap<String, String>>,
}

impl NodeError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: HashMap<String, String>) -> Self {
        self.details = Some(details);
        self
    }
}

/// Common node operation result
pub type NodeResult<T> = Result<T, NodeError>;