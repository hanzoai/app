#!/usr/bin/env node

/**
 * Test script for remote controlling Hanzo Desktop via MCP
 * This demonstrates using the new remote control features to click the Get Started button
 */

const http = require('http');

// MCP server configuration
const MCP_PORT = 9222;
const MCP_HOST = 'localhost';

/**
 * Send a JSON-RPC request to the MCP server
 */
function sendMCPRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    });

    const options = {
      hostname: MCP_HOST,
      port: MCP_PORT,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * Wait for MCP server to be available
 */
async function waitForMCPServer(maxAttempts = 30) {
  console.log('⏳ Waiting for MCP server to be available...');

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await sendMCPRequest('hanzo.getDebugInfo');
      console.log('✅ MCP server is ready');
      return true;
    } catch (error) {
      if (i === maxAttempts - 1) {
        console.log(
          '❌ MCP server not available after',
          maxAttempts,
          'attempts',
        );
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('🚀 Hanzo Desktop Remote Control Test\n');

  // Step 1: Check if MCP server is running
  const serverReady = await waitForMCPServer();
  if (!serverReady) {
    console.log('Starting MCP server...');
    try {
      // Try to start the MCP server via Tauri command
      await sendMCPRequest('hanzo.startMCPServer');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.log('Note: MCP server may need to be started from the app');
    }
  }

  // Step 2: Get debug info
  console.log('\n📊 Getting debug info...');
  try {
    const debugInfo = await sendMCPRequest('hanzo.getDebugInfo');
    console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
  } catch (error) {
    console.log('Could not get debug info:', error.message);
  }

  // Step 3: Execute JavaScript to check if button exists
  console.log('\n🔍 Looking for Get Started button...');
  try {
    const buttonCheck = await sendMCPRequest('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const getStartedButton = buttons.find(btn => 
            btn.textContent.includes('Get Started') || 
            btn.textContent.includes('Start')
          );
          return {
            found: !!getStartedButton,
            text: getStartedButton ? getStartedButton.textContent : null,
            selector: getStartedButton ? 
              (getStartedButton.className || getStartedButton.id || 'button') : null
          };
        })()
      `,
      returnByValue: true,
    });

    console.log('Button check result:', buttonCheck);

    if (buttonCheck.value && buttonCheck.value.found) {
      console.log('✅ Found button:', buttonCheck.value.text);

      // Step 4: Click the button
      console.log('\n🖱️ Clicking Get Started button...');
      const clickResult = await sendMCPRequest('hanzo.clickElement', {
        selector: buttonCheck.value.selector,
      });

      console.log('Click result:', clickResult);

      // Step 5: Wait and check if hanzod started
      console.log('\n⏳ Waiting for hanzod to start...');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Check if hanzod is running
      const processCheck = await sendMCPRequest('Runtime.evaluate', {
        expression: `
          // This would need to check via Tauri API
          'Check logs or use ps command to verify hanzod is running'
        `,
        returnByValue: true,
      });

      console.log('Process check:', processCheck);
    } else {
      console.log('❌ Get Started button not found');

      // Try alternative method - simulate button click via Tauri command
      console.log('\n🔄 Trying alternative method via Tauri command...');
      try {
        const spawnResult = await sendMCPRequest('hanzo.executeJS', {
          script: `
            window.__TAURI__.tauri.invoke('hanzo_node_spawn')
              .then(() => console.log('Spawn command sent'))
              .catch(err => console.error('Spawn failed:', err));
          `,
        });
        console.log('Spawn command result:', spawnResult);
      } catch (error) {
        console.log('Alternative method failed:', error.message);
      }
    }
  } catch (error) {
    console.log('Error during operation:', error.message);
  }

  // Step 6: Take a screenshot for debugging
  console.log('\n📸 Taking screenshot...');
  try {
    const screenshot = await sendMCPRequest('Page.captureScreenshot', {
      format: 'png',
    });

    if (screenshot.data) {
      const fs = require('fs');
      const buffer = Buffer.from(screenshot.data, 'base64');
      const filename = `hanzo-desktop-screenshot-${Date.now()}.png`;
      fs.writeFileSync(filename, buffer);
      console.log('✅ Screenshot saved to:', filename);
    }
  } catch (error) {
    console.log('Could not take screenshot:', error.message);
  }

  console.log('\n✨ Test complete!');
}

// Run the test
main().catch(console.error);
