use hanzo_node_manager::Manager;
use std::time::Duration;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    println!("Testing Hanzo node detection...");

    // Create manager with default settings
    let settings = hanzo_node::Settings::default();
    let manager = Manager::new(settings, Duration::from_secs(5));

    // Try to start or attach
    match manager.start_or_attach().await {
        Ok(handle) => {
            if handle.pid == 0 {
                println!("✅ SUCCESS: Attached to existing hanzod on {}:{}", handle.host, handle.port);
            } else {
                println!("Started new hanzod with PID {} on {}:{}", handle.pid, handle.host, handle.port);
            }
        }
        Err(e) => {
            println!("❌ ERROR: Failed to start or attach: {}", e);
        }
    }

    // Also test direct detection
    let is_running = hanzo_node::health::detect_running_node(
        "127.0.0.1",
        3690,
        Duration::from_millis(1000)
    ).await;

    println!("Direct detection result: {}", if is_running { "✅ Node detected" } else { "❌ Node not detected" });
}