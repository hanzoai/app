import playwright from '@playwright/test';
const { chromium } = playwright;

console.log('🚀 Testing Get Started button flow...');

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

// Navigate to the app
console.log('📍 Navigating to http://localhost:1420/terms-conditions');
await page.goto('http://localhost:1420/terms-conditions');
await page.waitForLoadState('networkidle');

// Take a screenshot
await page.screenshot({ path: 'debug-get-started.png' });
console.log('📸 Screenshot saved to debug-get-started.png');

// Check if terms checkbox exists
const termsCheckbox = await page.$('#terms');
if (termsCheckbox) {
  console.log('✅ Found terms checkbox');
  await termsCheckbox.click();
  console.log('☑️ Checked terms');
  
  // Look for button
  const button = await page.$('button:has-text("Get Started")');
  if (button) {
    const isDisabled = await button.isDisabled();
    console.log(`🔘 Get Started button found - Disabled: ${isDisabled}`);
    
    if (!isDisabled) {
      console.log('🖱️ Clicking Get Started...');
      await button.click();
      
      // Wait and check logs
      await page.waitForTimeout(3000);
      
      // Check if hanzod is running
      try {
        const response = await fetch('http://127.0.0.1:3690/health');
        const data = await response.json();
        console.log('✅ SUCCESS! HANZOD IS RUNNING!', data);
      } catch (err) {
        console.log('❌ Hanzod not responding on port 3690');
      }
    }
  } else {
    console.log('❌ Get Started button not found');
  }
} else {
  console.log('❌ Terms checkbox not found - are we on the right page?');
  console.log('Current URL:', page.url());
}

console.log('🔍 Test complete. Check debug-get-started.png');
await browser.close();
