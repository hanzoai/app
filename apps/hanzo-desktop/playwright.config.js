import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/e2e/**/*.test.js', '**/playwright/**/*.test.js'],
  timeout: 60000, // Increased timeout for E2E tests
  retries: 1,
  workers: 1, // Run tests serially to avoid conflicts with the desktop app
  
  // Test configuration
  use: {
    // Configure for desktop app testing
    headless: process.env.CI === 'true', // Headless in CI, headed locally
    viewport: { width: 1280, height: 840 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    
    // Custom test attributes
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'e2e-tests',
      testDir: './tests/e2e',
      use: {
        baseURL: 'http://localhost:1420',
        browserName: 'webkit', // Use WebKit for better macOS compatibility
      },
    },
    {
      name: 'component-tests',
      testDir: './tests/playwright',
      use: {
        baseURL: 'http://localhost:1420',
        browserName: 'chromium',
      },
    },
  ],

  // Global setup and teardown (ESM-friendly paths)
  globalSetup: process.env.SKIP_SETUP ? undefined : './tests/setup/global-setup.js',
  globalTeardown: process.env.SKIP_TEARDOWN ? undefined : './tests/setup/global-teardown.js',

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/html-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  // Output directory
  outputDir: 'test-results/',
  
  // Web server configuration (optional - use if not running tauri dev separately)
  webServer: process.env.SKIP_SERVER ? undefined : {
    command: 'pnpm tauri dev',
    port: 1420,
    timeout: 120000,
    reuseExistingServer: true,
  },
});
