use std::{process::Stdio, time::Duration};
use thiserror::Error;
use tokio::{process::Command, time::timeout};
use tracing::{info, instrument, warn};

#[derive(Debug, Error)]
pub enum NodeError {
    #[error("spawn failed: {0}")]
    Spawn(#[from] std::io::Error),

    #[error("health check failed after {attempts} attempts")]
    Health { attempts: u32 },

    #[error("timeout after {0:?}")]
    Timeout(Duration),

    #[error("process exited early with code {code:?}")]
    EarlyExit { code: Option<i32> },

    #[error("invalid configuration: {0}")]
    Config(String),
}

#[derive(Debug, Clone)]
pub struct NodeHandle {
    pub pid: u32,
    pub host: String,
    pub port: u16,
}

impl NodeHandle {
    pub fn address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

/// Start a new node process with the specified configuration
#[instrument(skip_all, fields(port = %port))]
pub async fn start(
    bin_path: &str,
    host: &str,
    port: u16,
    env_vars: Vec<(String, String)>,
    min_alive: Duration,
) -> Result<NodeHandle, NodeError> {
    info!("Starting node process at {}:{}", host, port);

    let mut cmd = Command::new(bin_path);

    // Set environment variables
    for (key, value) in env_vars {
        cmd.env(key, value);
    }

    // Configure stdio
    cmd.stdout(Stdio::piped())
       .stderr(Stdio::piped())
       .kill_on_drop(true);

    // Spawn the process
    let mut child = cmd.spawn().map_err(|e| {
        warn!("Failed to spawn node process: {}", e);
        NodeError::Spawn(e)
    })?;

    let pid = child.id().unwrap_or_default();
    info!("Node process spawned with PID: {}", pid);

    // Wait for minimum alive time
    match timeout(min_alive, child.wait()).await {
        Ok(Ok(status)) => {
            // Process exited within min_alive time - this is an error
            warn!("Node process exited early with status: {:?}", status);
            return Err(NodeError::EarlyExit {
                code: status.code(),
            });
        }
        Ok(Err(e)) => {
            warn!("Error waiting for node process: {}", e);
            return Err(NodeError::Spawn(e));
        }
        Err(_) => {
            // Timeout elapsed - process is still running, which is good
            info!("Node process passed minimum alive check");
        }
    }

    // Check health
    if super::health::is_healthy(host, port).await {
        info!(pid, "Node started and healthy at {}:{}", host, port);
        Ok(NodeHandle {
            pid,
            host: host.to_string(),
            port,
        })
    } else {
        warn!("Node health check failed");
        // Try to kill the process if it's still running
        let _ = child.kill().await;
        Err(NodeError::Health { attempts: 1 })
    }
}