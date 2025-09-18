#!/usr/bin/env node

/**
 * Playwright test script for Hanzo Desktop App
 *
 * This script demonstrates how to control the Hanzo desktop app
 * through the tauri-remote-ui WebSocket interface.
 *
 * Usage:
 * 1. First, enable remote UI in the app (port 9090)
 * 2. Run this script: node playwright-test.js
 */

import { chromium } from 'playwright';

async function testHanzoDesktopApp() {
  console.log('🚀 Starting Hanzo Desktop App browser automation test...');

  // Launch browser
  const browser = await chromium.launch({
    headless: false, // Show browser for demo
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Connect to the remote UI server
    console.log('📡 Connecting to remote UI server on port 9090...');
    await page.goto('http://localhost:9090');

    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    console.log('✅ Connected to Hanzo Desktop App');

    // Take a screenshot of the initial state
    await page.screenshot({ path: 'hanzo-desktop-initial.png' });
    console.log('📸 Captured initial screenshot');

    // Example: Click on "Get Started Free" button if it exists
    const getStartedButton = await page.getByText('Get Started Free').first();
    if (await getStartedButton.isVisible()) {
      console.log('🔘 Clicking "Get Started Free" button...');
      await getStartedButton.click();
      await page.waitForTimeout(2000);
    }

    // Example: Interact with the app
    // You can add more specific interactions based on your app's UI

    // Check if terms checkbox exists
    const termsCheckbox = await page.locator('input[type="checkbox"]').first();
    if (await termsCheckbox.isVisible()) {
      console.log('☑️ Accepting terms and conditions...');
      await termsCheckbox.check();
    }

    // Example: Invoke a Tauri command directly
    console.log('🔧 Testing Tauri command invocation...');
    const nodeStatus = await page.evaluate(async () => {
      // Check if the invoke function is available
      if (typeof window.__TAURI_INVOKE__ === 'function') {
        return await window.__TAURI_INVOKE__('hanzo_node_is_running');
      } else if (typeof window.invoke === 'function') {
        return await window.invoke('hanzo_node_is_running');
      }
      return 'Tauri invoke not available';
    });
    console.log('📊 Hanzo node status:', nodeStatus);

    // Take a final screenshot
    await page.screenshot({ path: 'hanzo-desktop-final.png' });
    console.log('📸 Captured final screenshot');

    console.log('✨ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close browser
    await browser.close();
  }
}

// Run the test
testHanzoDesktopApp().catch(console.error);
