use std::time::Duration;
use tracing::{debug, instrument, info, warn};

/// Check if a node is healthy at the given host and port
#[instrument]
pub async fn is_healthy(host: &str, port: u16) -> bool {
    detect_running_node(host, port, Duration::from_millis(1000)).await
}

/// Wait for a node to become healthy
#[instrument]
pub async fn wait_healthy(host: &str, port: u16, max_wait: Duration) -> bool {
    let start = std::time::Instant::now();
    let check_interval = Duration::from_millis(500);

    while start.elapsed() < max_wait {
        if is_healthy(host, port).await {
            info!("Node is healthy at {}:{}", host, port);
            return true;
        }
        tokio::time::sleep(check_interval).await;
    }

    warn!("Node health check timed out after {:?}", max_wait);
    false
}

/// Detect if a node is already running (renamed from check_external_node)
#[instrument]
pub async fn detect_running_node(host: &str, port: u16, timeout: Duration) -> bool {
    let client = reqwest::Client::new();
    let url = format!("http://{}:{}/v2/health_check", host, port);

    debug!("Checking for existing node at {} (timeout: {}ms)", url, timeout.as_millis());

    match tokio::time::timeout(timeout, client.get(&url).send()).await {
        Ok(Ok(response)) if response.status().is_success() => {
            info!("Detected running node service at {}:{}", host, port);
            true
        }
        Ok(Ok(response)) => {
            debug!("Health check returned non-success status: {}", response.status());
            false
        }
        Ok(Err(e)) => {
            debug!("Health check request failed: {}", e);
            false
        }
        Err(_) => {
            debug!("Health check timed out");
            false
        }
    }
}