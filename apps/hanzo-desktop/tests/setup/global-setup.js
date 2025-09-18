import { spawn } from 'child_process';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Global setup for Tauri desktop app tests
 * This will start the Tauri development server before running tests
 */
export default async function globalSetup() {
  console.log('🚀 Starting Tauri development server for testing...');
  
  // Start the Tauri dev server
  const tauriProcess = spawn('pnpm', ['tauri', 'dev'], {
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'test' },
    detached: false
  });

  // Store the process ID for cleanup
  global.tauriProcessPid = tauriProcess.pid;

  // Wait for the server to be ready
  let isReady = false;
  const timeout = 60000; // 60 seconds timeout
  const startTime = Date.now();

  tauriProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('Tauri Dev:', output);
    
    // Look for indicators that the app is ready
    if (output.includes('App listening') || output.includes('webview loaded')) {
      isReady = true;
    }
  });

  tauriProcess.stderr.on('data', (data) => {
    console.error('Tauri Error:', data.toString());
  });

  // Wait for the server to be ready or timeout
  while (!isReady && (Date.now() - startTime) < timeout) {
    await sleep(1000);
    
    // Try to check if localhost:1420 is responding
    try {
      const response = await fetch('http://localhost:1420', { 
        method: 'HEAD',
        timeout: 2000
      }).catch(() => null);
      
      if (response && response.ok) {
        isReady = true;
        console.log('✅ Tauri dev server is ready!');
        break;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
  }

  if (!isReady) {
    throw new Error('Tauri dev server failed to start within timeout period');
  }

  // Give a bit more time for full initialization
  await sleep(2000);
  
  console.log('🎯 Test environment ready!');
  return tauriProcess;
}
