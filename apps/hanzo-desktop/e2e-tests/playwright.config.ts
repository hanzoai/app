import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: process.env.REMOTE_UI_URL || 'http://127.0.0.1:9090',
    headless: false, // Set to false to see the browser during tests
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  // Start the app with remote UI before tests
  webServer: {
    command: 'cd .. && TAURI_REMOTE_UI=1 pnpm tauri dev',
    url: process.env.REMOTE_UI_URL || 'http://127.0.0.1:9090',
    reuseExistingServer: true,
    timeout: 120000, // 2 minutes timeout for app to start
  },
  
  // Test timeout
  timeout: 60000,
  
  // Only use chromium for now
  projects: [
    {
      name: 'chromium',
      use: { 
        browserName: 'chromium',
      },
    },
  ],
});