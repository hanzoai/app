/**
 * E2E Tests for Hanzo Desktop Onboarding Flow
 * Tests the Get Started button, node detection, and navigation
 */

const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');
const { spawn } = require('child_process');

let electronApp;
let window;
let hanzodProcess;

test.describe('Hanzo Desktop Onboarding', () => {
  test.beforeAll(async () => {
    // Start hanzod node first
    console.log('Starting hanzod node...');
    hanzodProcess = spawn('/Users/z/work/hanzo/node/target/debug/hanzod', [], {
      env: {
        ...process.env,
        NODE_API_PORT: '3690',
        NODE_API_IP: '127.0.0.1',
        NODE_WS_PORT: '3691',
        NO_SECRET_FILE: 'true',
        FIRST_DEVICE_NEEDS_REGISTRATION_CODE: 'false'
      }
    });

    // Wait for node to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify node is running
    const response = await fetch('http://127.0.0.1:3690/v2/health_check');
    expect(response.ok).toBeTruthy();
    console.log('✅ Hanzod node is running');
  });

  test.beforeEach(async () => {
    // Launch Electron app
    const appPath = path.join(__dirname, '../src-tauri/target/debug/hanzo-desktop');
    electronApp = await electron.launch({
      executablePath: appPath,
      args: ['--no-sandbox'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        RUST_LOG: 'debug'
      }
    });

    // Get the first window
    window = await electronApp.firstWindow();
    await window.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test.afterAll(async () => {
    if (hanzodProcess) {
      hanzodProcess.kill();
    }
  });

  test('Get Started button should be visible and clickable', async () => {
    // Wait for the Get Started button
    const getStartedButton = await window.waitForSelector('button:has-text("Get Started")', {
      timeout: 10000
    });

    expect(getStartedButton).toBeTruthy();

    // Check button is enabled after accepting terms
    const termsCheckbox = await window.$('input#terms');
    if (termsCheckbox) {
      await termsCheckbox.click();
    }

    // Button should now be enabled
    const isDisabled = await getStartedButton.isDisabled();
    expect(isDisabled).toBeFalsy();
  });

  test('Node status message should be displayed', async () => {
    // Look for node status message
    const nodeMessage = await window.waitForSelector('text=/Select a Hanzo Node|Connecting to Hanzo Node/', {
      timeout: 5000
    });

    expect(nodeMessage).toBeTruthy();
  });

  test('Connect Different Node button should be present', async () => {
    // Accept terms first
    const termsCheckbox = await window.$('input#terms');
    if (termsCheckbox) {
      await termsCheckbox.click();
    }

    // Look for Connect Different Node button
    const connectDifferentButton = await window.$('button:has-text("Connect Different Node")');
    expect(connectDifferentButton).toBeTruthy();
  });

  test('Clicking Get Started should start node and navigate', async () => {
    // Accept terms
    const termsCheckbox = await window.$('input#terms');
    if (termsCheckbox) {
      await termsCheckbox.click();
    }

    // Click Get Started
    const getStartedButton = await window.waitForSelector('button:has-text("Get Started")');
    await getStartedButton.click();

    // Should show connecting message
    const connectingMessage = await window.waitForSelector('text=/Connecting to Hanzo Node/', {
      timeout: 5000
    });
    expect(connectingMessage).toBeTruthy();

    // Should show animated emoji
    const animatedEmoji = await window.$('.animate-spin');
    expect(animatedEmoji).toBeTruthy();

    // Wait for navigation (might take longer due to node startup)
    await window.waitForURL('**/analytics', { timeout: 30000 });
    const currentUrl = window.url();
    expect(currentUrl).toContain('/analytics');
  });

  test('Node auto-detection should work', async () => {
    // The app should auto-detect the running node
    // Check logs for detection
    const logs = await electronApp.evaluate(async ({ app }) => {
      const logsPath = app.getPath('logs');
      const fs = require('fs');
      const logFiles = fs.readdirSync(logsPath);
      const latestLog = logFiles[logFiles.length - 1];
      if (latestLog) {
        return fs.readFileSync(path.join(logsPath, latestLog), 'utf8');
      }
      return '';
    });

    // Should contain node detection logs
    expect(logs).toMatch(/checking external|Found existing|3690/i);
  });

  test('Onboarding checklist should appear after connection', async () => {
    // Accept terms and proceed
    const termsCheckbox = await window.$('input#terms');
    if (termsCheckbox) {
      await termsCheckbox.click();
    }

    const getStartedButton = await window.waitForSelector('button:has-text("Get Started")');
    await getStartedButton.click();

    // Wait for navigation
    await window.waitForURL('**/analytics', { timeout: 30000 });

    // Check for onboarding checklist
    const checklist = await window.$('text=/Get Started Checklist/');
    expect(checklist).toBeTruthy();

    // Should show progress
    const progressBar = await window.$('[role="progressbar"]');
    expect(progressBar).toBeTruthy();
  });

  test('Model selection should show Qwen3 models', async () => {
    // Navigate through onboarding to model selection
    const termsCheckbox = await window.$('input#terms');
    if (termsCheckbox) {
      await termsCheckbox.click();
    }

    const getStartedButton = await window.waitForSelector('button:has-text("Get Started")');
    await getStartedButton.click();

    // Continue through analytics
    await window.waitForURL('**/analytics', { timeout: 30000 });
    const continueButton = await window.$('button:has-text("Continue")');
    if (continueButton) {
      await continueButton.click();
    }

    // Wait for model selection page
    await window.waitForURL('**/install-ai-models', { timeout: 10000 });

    // Check for Qwen3 models
    const qwen3Nano = await window.$('text=/Qwen3 1.7B Nano/');
    const qwen34B = await window.$('text=/Qwen3 4B/');
    const qwen3Coder = await window.$('text=/Qwen3-Coder/');
    const qwen3Next = await window.$('text=/Qwen3-Next/');

    expect(qwen3Nano).toBeTruthy();
    expect(qwen34B).toBeTruthy();
    expect(qwen3Coder).toBeTruthy();
    expect(qwen3Next).toBeTruthy();
  });

  test('Network setup should be accessible', async () => {
    // Navigate to network setup
    const termsCheckbox = await window.$('input#terms');
    if (termsCheckbox) {
      await termsCheckbox.click();
    }

    const getStartedButton = await window.waitForSelector('button:has-text("Get Started")');
    await getStartedButton.click();

    await window.waitForURL('**/analytics', { timeout: 30000 });

    // Look for network setup option in checklist
    const networkSetupButton = await window.$('button:has-text("Configure Network")');
    if (networkSetupButton) {
      await networkSetupButton.click();
      await window.waitForURL('**/network-setup', { timeout: 5000 });

      const networkPage = window.url();
      expect(networkPage).toContain('/network-setup');
    }
  });

  test('Full onboarding flow should complete successfully', async () => {
    // Complete entire onboarding
    const termsCheckbox = await window.$('input#terms');
    if (termsCheckbox) {
      await termsCheckbox.click();
    }

    // Start
    const getStartedButton = await window.waitForSelector('button:has-text("Get Started")');
    await getStartedButton.click();

    // Analytics
    await window.waitForURL('**/analytics', { timeout: 30000 });
    const analyticsCheckbox = await window.$('input[type="checkbox"]');
    if (analyticsCheckbox) {
      await analyticsCheckbox.click();
    }
    const continueAnalytics = await window.$('button:has-text("Continue")');
    await continueAnalytics.click();

    // Network setup (optional, might be skipped)
    const currentUrl = window.url();
    if (currentUrl.includes('network-setup')) {
      const skipButton = await window.$('button:has-text("Skip")');
      if (skipButton) {
        await skipButton.click();
      }
    }

    // Model selection
    await window.waitForURL('**/install-ai-models', { timeout: 10000 });
    const continueModels = await window.$('button:has-text("Continue")');
    await continueModels.click();

    // Should reach home
    await window.waitForURL('**/home', { timeout: 10000 });
    const homeUrl = window.url();
    expect(homeUrl).toContain('/home');
  });
});