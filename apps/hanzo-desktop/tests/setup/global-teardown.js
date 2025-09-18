/**
 * Global teardown for Tauri desktop app tests
 * This will cleanup any processes started during testing
 */
export default async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...');
  
  try {
    // Kill the Tauri dev server if it was started
    if (global.tauriProcessPid) {
      console.log(`🔴 Stopping Tauri dev server (PID: ${global.tauriProcessPid})`);
      
      try {
        // Try to kill the process gracefully first
        process.kill(global.tauriProcessPid, 'SIGTERM');
        
        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Force kill if still running
        try {
          process.kill(global.tauriProcessPid, 'SIGKILL');
        } catch (error) {
          // Process might already be dead, ignore error
        }
      } catch (error) {
        console.warn('Could not kill Tauri process:', error.message);
      }
    }

    // Clean up any other background processes
    const execAsync = async (cmd) => await (await import('child_process')).execSync?.(cmd, { stdio: 'ignore' });
    
    try {
      // Kill any remaining Tauri/Hanzo processes
      try { await execAsync('pkill -f "hanzo-desktop" || true'); } catch {}
      try { await execAsync('pkill -f "tauri dev" || true'); } catch {}
    } catch (error) {
      // Ignore errors - processes might not exist
    }

    console.log('✅ Test environment cleaned up successfully');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}
