import { defineConfig } from '@playwright/test'

// The browser test draws the Linked sources view in Chromium against a fake
// api: nothing reaches Hanzo. `pnpm exec playwright test`.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.ts',
  use: { baseURL: 'http://localhost:4177' },
  webServer: { command: 'pnpm exec vite --config e2e/vite.config.ts', url: 'http://localhost:4177', reuseExistingServer: !process.env.CI, timeout: 120_000 },
})
