const { chromium } = require('@playwright/test');

(async () => {
  console.log('🚀 Starting Playwright test for Get Started button');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('📱 Navigating to Remote UI at http://127.0.0.1:9090');
  await page.goto('http://127.0.0.1:9090');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  console.log('✅ Page loaded');
  
  // Look for the Get Started button
  console.log('🔍 Looking for Get Started button...');
  
  try {
    // Try multiple selectors for the button
    const selectors = [
      'button:has-text("Get Started")',
      'text=Get Started',
      '[data-testid="get-started-button"]',
      'button >> text=Get Started'
    ];
    
    let button = null;
    for (const selector of selectors) {
      try {
        button = await page.waitForSelector(selector, { timeout: 5000 });
        if (button) {
          console.log(`✅ Found button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`❌ Selector ${selector} not found`);
      }
    }
    
    if (button) {
      console.log('🖱️ Clicking Get Started button...');
      await button.click();
      console.log('✅ Button clicked!');
      
      // Wait a bit to see if hanzod starts
      console.log('⏳ Waiting for hanzod to spawn...');
      await page.waitForTimeout(3000);
      
      // Check if hanzod is running on port 3690
      console.log('🔍 Checking if hanzod is running on port 3690...');
      try {
        const response = await fetch('http://127.0.0.1:3690/health');
        const health = await response.json();
        console.log('✅ hanzod is running!', health);
      } catch (e) {
        console.log('❌ hanzod not responding on port 3690:', e.message);
      }
    } else {
      console.log('❌ Could not find Get Started button');
      console.log('📸 Taking screenshot for debugging...');
      await page.screenshot({ path: 'debug-get-started.png' });
      console.log('Screenshot saved to debug-get-started.png');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: 'error-get-started.png' });
  }
  
  // Keep browser open for debugging
  console.log('🔍 Keeping browser open for debugging (press Ctrl+C to exit)');
  await page.waitForTimeout(60000);
  
  await browser.close();
})();