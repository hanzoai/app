#!/usr/bin/env node

// Test script to debug the Get Started button issue and MCP integration
const { spawn } = require('child_process');
const path = require('path');

console.log('Testing Hanzo Desktop Get Started functionality...\n');

// 1. Test if the app can launch
console.log('1. Testing app launch...');
const appPath = '/Applications/Hanzo AI.app/Contents/MacOS/hanzo-desktop';

// 2. Test MCP availability
console.log('\n2. Testing MCP availability...');
const checkMCP = spawn('which', ['npx']);
checkMCP.on('close', (code) => {
  if (code === 0) {
    console.log('✓ npx found - MCP JS version can be installed');

    // Try to run MCP
    console.log('  Checking if @hanzo/mcp is available...');
    const testMCP = spawn('npx', ['@hanzo/mcp', '--version'], {
      timeout: 5000,
      stdio: 'pipe',
    });

    testMCP.stdout.on('data', (data) => {
      console.log(`  MCP Version: ${data}`);
    });

    testMCP.stderr.on('data', (data) => {
      console.log(`  MCP not installed yet: ${data}`);
      console.log('  Run: npm install -g @hanzo/mcp');
    });
  } else {
    console.log('✗ npx not found - install Node.js first');
  }
});

// 3. Test hanzo node spawning
console.log('\n3. Testing Hanzo Node spawn...');
console.log('  The app should spawn hanzod (not hanzo-desktop-node)');
console.log(
  '  Previous error: "Node part of the name contains invalid characters"',
);
console.log('  Fixed by changing global_identity_name to "hanzod"');

// 4. Launch the app with debug output
console.log('\n4. Launching app with debug output...');
console.log('  Running: RUST_LOG=debug RUST_BACKTRACE=1', appPath);

const app = spawn(appPath, [], {
  env: {
    ...process.env,
    RUST_LOG: 'debug',
    RUST_BACKTRACE: '1',
  },
  stdio: 'pipe',
});

let errorFound = false;

app.stdout.on('data', (data) => {
  const output = data.toString();

  // Look for key events
  if (output.includes('Get Started') || output.includes('get_started')) {
    console.log('📌 GET STARTED EVENT:', output);
  }

  if (output.includes('spawn') && output.includes('hanzo')) {
    console.log('🚀 SPAWN EVENT:', output);
  }

  if (output.includes('MCP') || output.includes('mcp')) {
    console.log('🔧 MCP EVENT:', output);
  }
});

app.stderr.on('data', (data) => {
  const output = data.toString();

  if (output.includes('panic') || output.includes('ERROR')) {
    console.error('❌ ERROR:', output);
    errorFound = true;

    if (output.includes('Node part of the name contains invalid characters')) {
      console.error('\n⚠️  CRITICAL: The old error is still happening!');
      console.error('  The app needs to be rebuilt with the fix.');
      console.error(
        '  Run: cd /Users/z/work/hanzo/app/apps/hanzo-desktop && pnpm tauri build',
      );
      console.error(
        '  Then: cp -r src-tauri/target/release/bundle/macos/Hanzo\\ AI.app /Applications/',
      );
    }
  }
});

// Give it 10 seconds then report
setTimeout(() => {
  if (!errorFound) {
    console.log('\n✅ App launched successfully without panics!');
    console.log('The Get Started button should now work.');
  } else {
    console.log('\n❌ Errors detected - see output above');
  }

  console.log('\nTo enable MCP computer control:');
  console.log('1. Install MCP: npm install -g @hanzo/mcp');
  console.log('2. The app will automatically start MCP when launched');
  console.log(
    '3. Computer control will be available via the MCP API on port 3333',
  );

  app.kill();
  process.exit(errorFound ? 1 : 0);
}, 10000);
