#!/usr/bin/env node
// Minimal smoke-test: toggle terms checkbox, click Get Started, assert navigation
import { chromium } from 'playwright';

const REMOTE_URL = process.env.REMOTE_UI_URL || 'http://localhost:9090';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(REMOTE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Ensure we land on the terms page
    // Wait for any checkbox and check it
    await page.waitForSelector('input[type="checkbox"]', { timeout: 15000 });
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }

    // Find and click the Get Started button when enabled
    const selectors = [
      'button:has-text("Get Started")',
      '[role="button"]:has-text("Get Started")',
    ];

    let btn = null;
    for (const s of selectors) {
      const cand = page.locator(s).first();
      if ((await cand.count()) > 0) { btn = cand; break; }
    }
    if (!btn) throw new Error('Get Started button not found');

    // Wait until enabled (no disabled attribute)
    await page.waitForFunction((el) => !el.hasAttribute('disabled'), btn, { timeout: 15000 });
    await btn.click();

    // Wait for navigation away from terms
    const ok = await Promise.race([
      page.waitForURL((url) => !url.pathname.includes('terms-conditions'), { timeout: 30000 }).then(() => true),
      page.waitForSelector('text=Welcome', { timeout: 30000 }).then(() => false),
    ]);

    if (!ok) {
      throw new Error('Did not navigate away from terms-conditions');
    }

    console.log('✅ Smoke onboarding passed');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Smoke onboarding failed:', err?.message || err);
    try { await page.screenshot({ path: 'smoke-onboarding-failure.png', fullPage: true }); } catch {}
    await browser.close();
    process.exit(1);
  }
}

main();

