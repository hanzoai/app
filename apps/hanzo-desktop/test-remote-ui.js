#!/usr/bin/env node

/**
 * Quick test for remote UI functionality
 * Run this after starting the Hanzo desktop app with remote UI enabled
 */

import { chromium } from 'playwright';

async function testRemoteUI() {
  console.log('🧪 Testing Hanzo Desktop Remote UI...\n');

  const browser = await chromium.launch({
    headless: false,
  });

  try {
    const page = await browser.newPage();

    // Try to connect to remote UI
    console.log('📡 Attempting to connect to http://localhost:9090...');
    await page.goto('http://localhost:9090', {
      waitUntil: 'domcontentloaded',
      timeout: 5000,
    });

    console.log('✅ Successfully connected to remote UI!\n');

    // Check if we can access Tauri APIs
    const hasTauriAPI = await page.evaluate(() => {
      return (
        typeof window.__TAURI_INVOKE__ !== 'undefined' ||
        typeof window.invoke !== 'undefined'
      );
    });

    if (hasTauriAPI) {
      console.log('✅ Tauri API is available via remote UI');

      // Try to check node status
      console.log('\n🔍 Checking Hanzo node status...');
      const nodeStatus = await page.evaluate(async () => {
        try {
          if (typeof window.__TAURI_INVOKE__ === 'function') {
            return await window.__TAURI_INVOKE__('hanzo_node_is_running');
          } else if (typeof window.invoke === 'function') {
            return await window.invoke('hanzo_node_is_running');
          }
        } catch (e) {
          return `Error: ${e.message}`;
        }
      });
      console.log(`  Node running: ${nodeStatus}`);
    } else {
      console.log('⚠️  Tauri API not detected - may need to check integration');
    }

    // Take a screenshot
    await page.screenshot({ path: 'remote-ui-test.png' });
    console.log('\n📸 Screenshot saved as remote-ui-test.png');

    console.log('\n✨ Remote UI test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.message.includes('ERR_CONNECTION_REFUSED')) {
      console.log('\n💡 Make sure to:');
      console.log('  1. Start the Hanzo desktop app first');
      console.log('  2. Enable remote UI (it should start on port 9090)');
      console.log('  3. Then run this test script');
    }
  } finally {
    await browser.close();
  }
}

// Run the test
testRemoteUI().catch(console.error);
