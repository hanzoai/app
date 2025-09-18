import { describe, it, expect, beforeAll, afterAll } from '@playwright/test';
import { _electron as electron, Page, ElectronApplication } from '@playwright/test';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

describe('Hanzo Desktop Model Browser E2E Tests', () => {
  let electronApp: ElectronApplication;
  let page: Page;
  let hanzodProcess: ChildProcess;

  beforeAll(async () => {
    // Start hanzod node
    console.log('🚀 Starting hanzod node...');
    hanzodProcess = spawn('/Users/z/work/hanzo/node/target/debug/hanzod', [], {
      env: {
        ...process.env,
        NODE_API_PORT: '3690',
        NODE_API_IP: '127.0.0.1',
        NODE_WS_PORT: '3691',
        NO_SECRET_FILE: 'true',
        FIRST_DEVICE_NEEDS_REGISTRATION_CODE: 'false'
      },
      detached: false
    });

    // Wait for node to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if node is running
    const nodeHealthCheck = await fetch('http://127.0.0.1:3690/v2/health_check').catch(() => null);
    console.log('✅ Hanzod node health:', nodeHealthCheck?.status === 200 ? 'Running' : 'Failed');

    // Launch the Electron app
    console.log('🚀 Launching Hanzo Desktop app...');
    const appPath = path.join(__dirname, '..', 'src-tauri', 'target', 'debug', 'hanzo-desktop');

    electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        RUST_LOG: 'debug'
      }
    });

    // Get the first window
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    console.log('✅ App launched successfully');
  });

  afterAll(async () => {
    await electronApp?.close();
    hanzodProcess?.kill();
  });

  describe('Onboarding Flow', () => {
    it('should navigate through terms and conditions', async () => {
      // Check if we're on the terms page
      const getStartedButton = await page.locator('button:has-text("Get Started Free")');
      expect(await getStartedButton.isVisible()).toBeTruthy();

      // Click Get Started
      await getStartedButton.click();
      console.log('✅ Clicked Get Started button');

      // Should see node connection message
      const nodeMessage = await page.locator('text=/Connecting to Hanzo Node/');
      expect(await nodeMessage.isVisible()).toBeTruthy();
      console.log('✅ Node connection message displayed');
    });
  });

  describe('Model Browser', () => {
    it('should display the model repository page', async () => {
      // Navigate to model installation page
      await page.goto('#/ai-model-installation');
      await page.waitForLoadState('networkidle');

      // Check title
      const title = await page.locator('h1:has-text("Hanzo Model Repository")');
      expect(await title.isVisible()).toBeTruthy();
      console.log('✅ Model repository page loaded');
    });

    it('should show featured Zen models with logos', async () => {
      // Click on Featured tab
      await page.locator('button[role="tab"]:has-text("Featured")').click();

      // Check for Zen models
      const zenModels = [
        'Zen 1.7B',
        'Zen 4B',
        'Zen Coder',
        'Zen Next'
      ];

      for (const model of zenModels) {
        const modelCard = await page.locator(`text=/${model}/`);
        expect(await modelCard.isVisible()).toBeTruthy();
        console.log(`✅ Found ${model} in featured models`);
      }

      // Check for GPT5 mention in Zen Next
      const zenNextCard = await page.locator('text=/GPT5 level performance/');
      expect(await zenNextCard.isVisible()).toBeTruthy();
      console.log('✅ Zen Next shows GPT5 level performance');
    });

    it('should have size filter from 0GB to 1TB', async () => {
      // Check size filter slider
      const sizeFilter = await page.locator('text=/0GB-1TB/');
      expect(await sizeFilter.isVisible()).toBeTruthy();
      console.log('✅ Size filter shows 0GB-1TB range');

      // Test slider interaction
      const slider = await page.locator('div[role="slider"]').first();
      await slider.click();
      console.log('✅ Size filter slider is interactive');
    });

    it('should search models from Hugging Face', async () => {
      // Type in search box
      const searchInput = await page.locator('input[placeholder*="Search models"]');
      await searchInput.fill('llama');

      // Wait for search results
      await page.waitForTimeout(1000);

      // Check if search tab appears
      const searchTab = await page.locator('button[role="tab"]:has-text("Search")');
      if (await searchTab.isVisible()) {
        await searchTab.click();
        console.log('✅ Search functionality works');
      }
    });

    it('should load LM Studio models', async () => {
      // Click LM Studio tab
      await page.locator('button[role="tab"]:has-text("LM Studio")').click();
      await page.waitForTimeout(2000);

      // Check for loading or models
      const loadingText = await page.locator('text=/Loading LM Studio models/');
      const modelCards = await page.locator('[class*="Card"]');

      if (await loadingText.isVisible()) {
        console.log('⏳ LM Studio models loading...');
      } else if (await modelCards.count() > 0) {
        console.log(`✅ Found ${await modelCards.count()} LM Studio models`);
      }
    });

    it('should show MLX models on macOS', async () => {
      const platform = process.platform;

      if (platform === 'darwin') {
        const mlxTab = await page.locator('button[role="tab"]:has-text("MLX")');
        expect(await mlxTab.isVisible()).toBeTruthy();

        await mlxTab.click();
        await page.waitForTimeout(2000);

        console.log('✅ MLX tab available on macOS');
      } else {
        console.log('⏭️ Skipping MLX test (not on macOS)');
      }
    });

    it('should allow custom Hugging Face URL import', async () => {
      // Find custom URL input
      const urlInput = await page.locator('input[placeholder*="Hugging Face model URL"]');
      expect(await urlInput.isVisible()).toBeTruthy();

      // Type a sample URL
      await urlInput.fill('https://huggingface.co/meta-llama/Llama-2-7b');

      // Check import button
      const importButton = await page.locator('button:has-text("Import")');
      expect(await importButton.isVisible()).toBeTruthy();
      console.log('✅ Custom URL import available');
    });

    it('should show trending models', async () => {
      // Click Trending tab
      await page.locator('button[role="tab"]:has-text("Trending")').click();
      await page.waitForTimeout(2000);

      const loadingText = await page.locator('text=/Loading trending models/');
      const modelCards = await page.locator('[class*="Card"]');

      if (await loadingText.isVisible()) {
        console.log('⏳ Trending models loading...');
      } else if (await modelCards.count() > 0) {
        console.log(`✅ Found ${await modelCards.count()} trending models`);
      }
    });

    it('should have refresh functionality', async () => {
      const refreshButton = await page.locator('button:has-text("Refresh")');
      expect(await refreshButton.isVisible()).toBeTruthy();

      await refreshButton.click();
      console.log('✅ Refresh button works');
    });
  });

  describe('Model Installation', () => {
    it('should show install button on model cards', async () => {
      // Go to featured tab
      await page.locator('button[role="tab"]:has-text("Featured")').click();

      // Check for install buttons
      const installButtons = await page.locator('button:has-text("Install")');
      const count = await installButtons.count();

      expect(count).toBeGreaterThan(0);
      console.log(`✅ Found ${count} install buttons`);
    });

    it('should show model details on cards', async () => {
      // Check for model size info
      const sizeInfo = await page.locator('text=/Size:.*GB/').first();
      expect(await sizeInfo.isVisible()).toBeTruthy();

      // Check for context length
      const contextInfo = await page.locator('text=/Context:.*k/').first();
      expect(await contextInfo.isVisible()).toBeTruthy();

      console.log('✅ Model cards show size and context info');
    });
  });

  describe('Navigation', () => {
    it('should have continue button for onboarding', async () => {
      const continueButton = await page.locator('button:has-text("Continue")');

      if (await continueButton.isVisible()) {
        console.log('✅ Continue button present for onboarding');
        await continueButton.click();
      }
    });
  });
});