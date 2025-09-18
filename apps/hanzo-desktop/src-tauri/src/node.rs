use std::sync::Arc;
use std::time::Duration;
use log::info;
use tokio::sync::RwLock;
use tokio::process::Child;

const PORT: u16 = 3690;

/// Simple node state management
pub struct Node {
    child: Arc<RwLock<Option<Child>>>,
}

impl Node {
    pub fn new() -> Self {
        Node {
            child: Arc::new(RwLock::new(None)),
        }
    }

    /// Start hanzod - finds existing or spawns new
    pub async fn start(&self) -> Result<(), String> {
        info!("Starting node...");

        // Already running? Done.
        if self.is_running().await {
            info!("Node already running");
            return Ok(());
        }

        // Spawn it
        self.spawn().await
    }

    /// Check if node is running
    pub async fn is_running(&self) -> bool {
        reqwest::Client::builder()
            .timeout(Duration::from_millis(500))
            .build()
            .unwrap()
            .get(format!("http://127.0.0.1:{}/health", PORT))
            .send()
            .await
            .is_ok()
    }

    /// Stop the node if we spawned it
    pub async fn stop(&self) -> Result<(), String> {
        let mut child = self.child.write().await;
        if let Some(mut proc) = child.take() {
            info!("Stopping node...");
            proc.kill().await.map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// Spawn hanzod process
    async fn spawn(&self) -> Result<(), String> {
        use tokio::process::Command;

        // Find hanzod binary
        let hanzod_path = if std::path::Path::new("../../../node/target/debug/hanzod").exists() {
            "../../../node/target/debug/hanzod"
        } else if std::path::Path::new("/Users/z/work/hanzo/node/target/debug/hanzod").exists() {
            "/Users/z/work/hanzo/node/target/debug/hanzod"
        } else {
            return Err("hanzod binary not found".to_string());
        };

        let mut cmd = Command::new(hanzod_path);
        cmd.env("NODE_API_PORT", PORT.to_string())
           .env("NODE_API_IP", "127.0.0.1")
           .env("NO_SECRET_FILE", "true")
           .env("FIRST_DEVICE_NEEDS_REGISTRATION_CODE", "false")
           .kill_on_drop(true);

        let child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn: {}", e))?;

        // Store the child process
        *self.child.write().await = Some(child);

        // Wait for it to be ready
        for _ in 0..100 {
            if self.is_running().await {
                info!("Node started");
                return Ok(());
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        // If we get here, it failed
        self.stop().await?;
        Err("Node failed to start".to_string())
    }
}