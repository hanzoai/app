use hanzo_node_manager::Manager;
use std::time::Duration;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    println!("\n🔍 Testing Hanzo node detection...\n");

    // First test direct detection
    println!("1️⃣  Testing direct health check detection...");
    let is_running = hanzo_node::health::detect_running_node(
        "127.0.0.1",
        3690,
        Duration::from_millis(1000)
    ).await;

    if is_running {
        println!("   ✅ Node detected at 127.0.0.1:3690");
    } else {
        println!("   ❌ No node detected at 127.0.0.1:3690");
    }

    // Now test the manager's start_or_attach
    println!("\n2️⃣  Testing Manager::start_or_attach()...");
    let settings = hanzo_node::Settings::default();
    let manager = Manager::new(settings, Duration::from_secs(5));

    match manager.start_or_attach().await {
        Ok(handle) => {
            if handle.pid == 0 {
                println!("   ✅ SUCCESS: Attached to existing hanzod!");
                println!("      Host: {}", handle.host);
                println!("      Port: {}", handle.port);
            } else {
                println!("   🚀 Started new hanzod");
                println!("      PID: {}", handle.pid);
                println!("      Host: {}", handle.host);
                println!("      Port: {}", handle.port);
            }
        }
        Err(e) => {
            println!("   ❌ ERROR: Failed to start or attach");
            println!("      Error: {}", e);
        }
    }

    println!("\n✨ Test complete!");
}