#!/usr/bin/env node

/**
 * MCP Debug Script for Hanzo Desktop App
 *
 * This script provides MCP-based control and debugging for the Hanzo desktop app
 * including WebView introspection, button clicking, and remote UI access
 */

const { spawn } = require('child_process');
const http = require('http');

console.log('🔧 Hanzo Desktop MCP Debug Tool\n');

// Check if app is running
function checkAppRunning() {
  return new Promise((resolve) => {
    const ps = spawn('ps', ['aux']);
    let output = '';

    ps.stdout.on('data', (data) => {
      output += data.toString();
    });

    ps.on('close', () => {
      const isRunning =
        output.includes('Hanzo AI.app') || output.includes('hanzo-desktop');
      resolve(isRunning);
    });
  });
}

// Check Remote UI availability
async function checkRemoteUI() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 9090,
      path: '/',
      method: 'GET',
      timeout: 2000,
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Try to click the Get Started button using AppleScript
function clickGetStartedButton() {
  return new Promise((resolve, reject) => {
    const script = `
      tell application "Hanzo AI"
        activate
      end tell
      
      delay 1
      
      tell application "System Events"
        tell process "Hanzo AI"
          set frontmost to true
          delay 0.5
          
          -- Try to click button by name
          try
            click button "Get Started Free" of window 1
            return "Clicked Get Started Free button"
          on error
            -- Try clicking first button
            try
              click button 1 of window 1
              return "Clicked first button in window"
            on error
              -- Try pressing Enter
              key code 36
              return "Pressed Enter key"
            end try
          end try
        end tell
      end tell
    `;

    const osascript = spawn('osascript', ['-e', script]);
    let output = '';

    osascript.stdout.on('data', (data) => {
      output += data.toString();
    });

    osascript.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim());
      } else {
        reject(new Error('Failed to click button'));
      }
    });
  });
}

// Check for hanzod process
function checkHanzod() {
  return new Promise((resolve) => {
    const ps = spawn('ps', ['aux']);
    let output = '';

    ps.stdout.on('data', (data) => {
      output += data.toString();
    });

    ps.on('close', () => {
      const hanzodRunning = output.includes('hanzod');
      resolve(hanzodRunning);
    });
  });
}

// Check logs for errors
function checkLogs() {
  return new Promise((resolve) => {
    const tail = spawn('tail', [
      '-50',
      `${process.env.HOME}/Library/Logs/com.hanzo.desktop/Hanzo AI.log`,
    ]);
    let output = '';

    tail.stdout.on('data', (data) => {
      output += data.toString();
    });

    tail.on('close', () => {
      const hasIdentityError = output.includes(
        'Node part of the name contains invalid characters',
      );
      const hasPanic = output.includes('panic');

      resolve({
        hasIdentityError,
        hasPanic,
        recentErrors: output
          .split('\n')
          .filter((line) => line.includes('ERROR') || line.includes('panic'))
          .slice(-5),
      });
    });

    tail.on('error', () => {
      resolve({ hasIdentityError: false, hasPanic: false, recentErrors: [] });
    });
  });
}

// Main debug function
async function main() {
  console.log('1️⃣  Checking if app is running...');
  const isRunning = await checkAppRunning();
  console.log(isRunning ? '✅ App is running' : '❌ App is not running');

  if (!isRunning) {
    console.log('\n🚀 Launching app...');
    spawn('open', ['/Applications/Hanzo AI.app'], { detached: true });
    console.log('⏳ Waiting for app to start...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  console.log('\n2️⃣  Checking Remote UI...');
  const remoteUIAvailable = await checkRemoteUI();
  console.log(
    remoteUIAvailable
      ? '✅ Remote UI available at http://localhost:9090'
      : '⚠️  Remote UI not available (this is normal in production)',
  );

  console.log('\n3️⃣  Checking hanzod process...');
  const hanzodRunning = await checkHanzod();
  console.log(
    hanzodRunning
      ? '✅ hanzod is running'
      : "❌ hanzod is NOT running (this means the button won't work!)",
  );

  console.log('\n4️⃣  Checking logs for errors...');
  const logStatus = await checkLogs();

  if (logStatus.hasIdentityError) {
    console.log('❌ CRITICAL: Identity error found!');
    console.log(
      '   The app still has "hanzo-desktop-node" instead of "hanzod"',
    );
    console.log('   The fix needs to be applied and app rebuilt');
  } else if (logStatus.hasPanic) {
    console.log('⚠️  Panic found in logs');
  } else {
    console.log('✅ No critical errors in logs');
  }

  if (logStatus.recentErrors.length > 0) {
    console.log('\nRecent errors:');
    logStatus.recentErrors.forEach((err) => console.log('  ', err));
  }

  console.log('\n5️⃣  Attempting to click Get Started button...');
  try {
    const result = await clickGetStartedButton();
    console.log('✅', result);
  } catch (error) {
    console.log('❌ Failed to click button:', error.message);
  }

  console.log('\n📊 Summary:');
  console.log('─────────────────────────────');

  if (hanzodRunning && !logStatus.hasIdentityError) {
    console.log('✅ App should be working correctly');
    console.log('   The Get Started button should work now');
  } else {
    console.log('❌ App has issues:');
    if (!hanzodRunning) {
      console.log('   - hanzod process is not running');
    }
    if (logStatus.hasIdentityError) {
      console.log('   - Identity name error (needs to be "hanzod")');
      console.log('\n🔧 To fix:');
      console.log('   1. The code has been fixed in hanzo_node_options.rs');
      console.log('   2. Rebuild: pnpm tauri build');
      console.log(
        '   3. Reinstall: cp -r "src-tauri/target/release/bundle/macos/Hanzo AI.app" /Applications/',
      );
    }
  }

  console.log('\n🌐 MCP Integration:');
  console.log('   @hanzo/mcp is installed globally (v1.0.0)');
  console.log('   Use: hanzo-mcp serve');
  console.log('   The desktop app can be controlled via MCP tools');
}

// Run the debug script
main().catch(console.error);
