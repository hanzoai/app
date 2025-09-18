use hanzo_node::{health, paths::resolve_bin, process, Settings};
use std::{path::PathBuf, time::Duration};
use thiserror::Error;
use tracing::{info, instrument};

#[derive(Debug, Error)]
pub enum ManagerError {
    #[error(transparent)]
    Node(#[from] process::NodeError),

    #[error("configuration error: {0}")]
    Config(String),
}

#[derive(Debug)]
pub struct Manager {
    pub settings: Settings,
    pub min_alive: Duration,
    pub bin_path: Option<PathBuf>,
}

impl Manager {
    pub fn new(settings: Settings, min_alive: Duration) -> Self {
        Self {
            settings,
            min_alive,
            bin_path: None,
        }
    }

    pub fn with_bin_path(mut self, path: PathBuf) -> Self {
        self.bin_path = Some(path);
        self
    }

    /// Start the node or attach to an existing one (renamed from spawn)
    #[instrument(skip(self))]
    pub async fn start_or_attach(&self) -> Result<process::NodeHandle, ManagerError> {
        info!("Manager::start_or_attach() called");

        // First check if node is already running (renamed from check_external_node)
        info!("Detecting existing node service on port {}", self.settings.api_port);

        if health::detect_running_node(&self.settings.host, self.settings.api_port, Duration::from_millis(1000)).await {
            info!("Attached to existing node service, using it instead of spawning new instance");
            return Ok(process::NodeHandle {
                pid: 0, // External process, PID unknown
                host: self.settings.host.clone(),
                port: self.settings.api_port,
            });
        }

        info!("No external node detected, starting new instance");

        // Resolve binary path
        let bin_path = self.bin_path.clone()
            .unwrap_or_else(|| resolve_bin("hanzod"));

        // Prepare environment variables
        let env_vars = self.build_env_vars();

        // Start the node
        let handle = process::start(
            bin_path.to_str().ok_or_else(|| ManagerError::Config("Invalid binary path".to_string()))?,
            &self.settings.host,
            self.settings.api_port,
            env_vars,
            self.min_alive,
        ).await?;

        info!("Node started successfully");
        Ok(handle)
    }

    fn build_env_vars(&self) -> Vec<(String, String)> {
        vec![
            ("NODE_API_IP".to_string(), self.settings.host.clone()),
            ("NODE_API_PORT".to_string(), self.settings.api_port.to_string()),
            ("NODE_WS_PORT".to_string(), self.settings.ws_port.to_string()),
            ("NODE_PORT".to_string(), self.settings.node_port.to_string()),
            ("NODE_HTTPS_PORT".to_string(), self.settings.https_port.to_string()),
            ("NODE_STORAGE_PATH".to_string(), self.settings.storage_path.to_string_lossy().to_string()),
            ("NO_SECRET_FILE".to_string(), self.settings.no_secret_file.to_string()),
            ("FIRST_DEVICE_NEEDS_REGISTRATION_CODE".to_string(), self.settings.first_device_needs_registration.to_string()),
        ]
    }
}