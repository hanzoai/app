#!/usr/bin/env node

// This script uses Playwright to test the Get Started button
const { chromium } = require('@playwright/test');

async function testGetStartedButton() {
  console.log('🚀 Testing Get Started button flow...');
  
  const browser = await chromium.launch({
    headless: false // Show the browser
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to the app
    console.log('📍 Navigating to http://localhost:1420/');
    await page.goto('http://localhost:1420/');
    
    // Wait for navigation
    await page.waitForLoadState('networkidle');
    
    // Get current URL to see where we are
    const currentUrl = page.url();
    console.log('📍 Current URL:', currentUrl);
    
    // Check if we're on the terms page or need to navigate
    if (!currentUrl.includes('terms-conditions')) {
      console.log('➡️ Navigating to /terms-conditions');
      await page.goto('http://localhost:1420/terms-conditions');
      await page.waitForLoadState('networkidle');
    }
    
    // Check the terms checkbox
    console.log('☑️ Checking terms checkbox...');
    await page.check('#terms');
    console.log('✅ Terms checkbox checked');
    
    // Find and click the Get Started button
    console.log('🔍 Looking for Get Started button...');
    await page.click('button:has-text("Get Started")');
    console.log('✅ Button clicked!');
    
    // Wait and check if hanzod spawns
    console.log('⏳ Waiting for hanzod to spawn...');
    await page.waitForTimeout(5000);
    
    // Check if hanzod is running
    const response = await fetch('http://127.0.0.1:3690/health');
    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS! HANZOD IS RUNNING!', data);
    } else {
      console.log('❌ Hanzod not responding on port 3690');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Keep browser open
    console.log('🔍 Browser left open. Press Ctrl+C to exit.');
    await new Promise(() => {}); // Keep script running
  }
}

testGetStartedButton();
