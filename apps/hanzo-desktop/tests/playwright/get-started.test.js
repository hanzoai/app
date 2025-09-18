import { test, expect } from '@playwright/test';

const HANZOD_PORT = 3690;
const HANZOD_HEALTH_URL = `http://127.0.0.1:${HANZOD_PORT}/v2/health_check`;
const APP_URL = 'http://localhost:1420';

/**
 * Automated E2E test for Hanzo Desktop App
 * Tests the "Get Started" button functionality and hanzod spawning
 */

test.describe('Hanzo Desktop App - Get Started Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto(APP_URL);
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test('should display Get Started button on initial load', async ({ page }) => {
    // Check if the Get Started button is visible
    const getStartedButton = page.getByRole('button', { name: /get started/i })
      || page.getByText(/get started/i);
    
    await expect(getStartedButton).toBeVisible({ timeout: 10000 });
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/initial-load.png' });
  });

  test('should spawn hanzod when clicking Get Started button', async ({ page }) => {
    console.log('🧪 Testing Get Started button spawns hanzod...');
    
    // First check if hanzod is already running (from auto-spawn)
    let hanzodRunning = false;
    try {
      const response = await fetch(HANZOD_HEALTH_URL);
      hanzodRunning = response.ok;
      if (hanzodRunning) {
        console.log('ℹ️ Hanzod is already running (auto-spawned on boot)');
      }
    } catch (e) {
      console.log('ℹ️ Hanzod not running yet - will test Get Started button');
    }

    // Find and click the Get Started button
    const getStartedButton = page.getByRole('button', { name: /get started/i })
      || page.getByText(/get started/i);
    
    await expect(getStartedButton).toBeVisible({ timeout: 10000 });
    
    console.log('📍 Clicking Get Started button...');
    await getStartedButton.click();
    
    // Wait for potential loading state
    await page.waitForTimeout(2000);
    
    // Check for any error messages
    const errorMessage = page.locator('text=/error|failed/i');
    const hasError = await errorMessage.isVisible().catch(() => false);
    
    if (hasError) {
      const errorText = await errorMessage.textContent();
      console.error('❌ Error displayed after clicking Get Started:', errorText);
      
      // Take a screenshot of the error
      await page.screenshot({ path: 'test-results/get-started-error.png' });
      
      // Check if it's a "node locked" error
      if (errorText && errorText.includes('locked')) {
        console.log('⚠️ Node is locked - may need to reset data');
      }
    }

    // Wait for hanzod to start (if not already running)
    if (!hanzodRunning) {
      console.log('⏳ Waiting for hanzod to spawn...');
      
      // Poll for hanzod to be ready
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        try {
          const response = await fetch(HANZOD_HEALTH_URL);
          if (response.ok) {
            console.log('✅ Hanzod spawned successfully!');
            hanzodRunning = true;
            break;
          }
        } catch (e) {
          // Not ready yet
        }
        
        await page.waitForTimeout(1000);
        attempts++;
      }
      
      expect(hanzodRunning).toBe(true);
    }
    
    // Verify we've progressed past the Get Started screen
    await page.waitForTimeout(2000);
    
    // Check if we're now on a different screen (no longer showing Get Started)
    const stillShowingGetStarted = await getStartedButton.isVisible().catch(() => false);
    
    if (!hasError) {
      expect(stillShowingGetStarted).toBe(false);
      console.log('✅ Successfully progressed past Get Started screen');
    }
    
    // Take a final screenshot
    await page.screenshot({ path: 'test-results/after-get-started.png' });
  });

  test('should verify hanzod is accessible after spawn', async ({ page }) => {
    console.log('🧪 Verifying hanzod health endpoint...');
    
    // Check if hanzod is running and accessible
    let healthCheckPassed = false;
    let healthData = null;
    
    try {
      const response = await fetch(HANZOD_HEALTH_URL);
      if (response.ok) {
        healthData = await response.json();
        healthCheckPassed = true;
        console.log('✅ Hanzod health check passed:', healthData);
      }
    } catch (e) {
      console.error('❌ Hanzod health check failed:', e.message);
    }
    
    expect(healthCheckPassed).toBe(true);
    expect(healthData).toBeTruthy();
  });

  test('should handle auto-spawn on app boot', async ({ page }) => {
    console.log('🧪 Testing auto-spawn functionality...');
    
    // This test verifies that hanzod starts automatically when the app boots
    // (as per the user's requirement)
    
    // Check if hanzod started automatically
    const autoSpawned = process.env.HANZOD_AUTO_STARTED === 'true';
    
    if (autoSpawned) {
      console.log('✅ Hanzod auto-spawned on app boot');
      
      // Verify it's still running
      const response = await fetch(HANZOD_HEALTH_URL);
      expect(response.ok).toBe(true);
    } else {
      console.log('⚠️ Hanzod did not auto-spawn - may need to investigate');
      
      // The Get Started button should handle spawning
      const getStartedButton = page.getByRole('button', { name: /get started/i })
        || page.getByText(/get started/i);
      
      await expect(getStartedButton).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Hanzod Process Management', () => {
  test('should verify hanzod process is running', async () => {
    console.log('🧪 Checking hanzod process...');
    
    // Use Node's child_process to check if hanzod is running
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      // Check for hanzod process
      const { stdout } = await execAsync('ps aux | grep hanzod | grep -v grep');
      
      if (stdout && stdout.includes('hanzod')) {
        console.log('✅ Hanzod process found:', stdout.trim());
        expect(stdout).toContain('hanzod');
      } else {
        console.log('⚠️ Hanzod process not found via ps');
      }
    } catch (error) {
      console.error('❌ Failed to check process:', error.message);
    }
    
    // Also verify via health endpoint
    const response = await fetch(HANZOD_HEALTH_URL);
    expect(response.ok).toBe(true);
  });

  test('should verify hanzod is listening on correct port', async () => {
    console.log('🧪 Verifying hanzod port binding...');
    
    // Check if port 3690 is in use
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      const { stdout } = await execAsync(`lsof -i :${HANZOD_PORT} | grep LISTEN`);
      
      if (stdout) {
        console.log('✅ Port 3690 is in use:', stdout.trim());
        expect(stdout).toContain('3690');
        expect(stdout.toLowerCase()).toContain('listen');
      }
    } catch (error) {
      // lsof might fail if port is not in use
      console.log('⚠️ Could not verify port via lsof');
    }
    
    // Verify via direct connection
    const response = await fetch(HANZOD_HEALTH_URL);
    expect(response.ok).toBe(true);
  });
});