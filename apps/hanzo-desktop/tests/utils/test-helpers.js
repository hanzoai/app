const { test, expect } = require('@playwright/test');

/**
 * Test utilities for Hanzo Desktop onboarding flow testing
 */

/**
 * Wait for an element to be visible with custom timeout
 */
async function waitForElement(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { 
      state: 'visible', 
      timeout 
    });
    return true;
  } catch (error) {
    console.error(`Element not found: ${selector}`, error);
    return false;
  }
}

/**
 * Wait for text to appear on the page
 */
async function waitForText(page, text, timeout = 10000) {
  try {
    await page.waitForFunction(
      (searchText) => document.body.textContent.includes(searchText),
      text,
      { timeout }
    );
    return true;
  } catch (error) {
    console.error(`Text not found: ${text}`, error);
    return false;
  }
}

/**
 * Take a screenshot for debugging
 */
async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `test-results/screenshots/${name}-${timestamp}.png`;
  await page.screenshot({ 
    path: filename, 
    fullPage: true 
  });
  console.log(`📸 Screenshot saved: ${filename}`);
  return filename;
}

/**
 * Wait for onboarding checklist to be visible
 */
async function waitForOnboardingChecklist(page) {
  // Look for the "Get Started" text or onboarding UI elements
  const selectors = [
    '[data-testid="onboarding-checklist"]',
    'text="Get Started"',
    '[class*="onboarding"]',
    'text="onboardingChecklist.getStartedText"'
  ];

  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      console.log(`✅ Found onboarding element: ${selector}`);
      return true;
    } catch (error) {
      console.log(`⏭️ Selector not found, trying next: ${selector}`);
    }
  }

  // Fallback: check for any visible progress indicators or buttons
  try {
    await page.waitForFunction(
      () => {
        // Look for common onboarding indicators
        const indicators = [
          document.querySelector('[role="progressbar"]'),
          document.querySelector('button[data-testid*="onboard"]'),
          document.querySelector('[class*="progress"]'),
          document.querySelector('[class*="step"]'),
          document.querySelector('text*="Get Started"'),
        ];
        return indicators.some(el => el && el.offsetHeight > 0);
      },
      { timeout: 10000 }
    );
    console.log('✅ Found onboarding indicators via fallback method');
    return true;
  } catch (error) {
    console.error('❌ No onboarding elements found');
    return false;
  }
}

/**
 * Click on onboarding step by text or data attribute
 */
async function clickOnboardingStep(page, stepIdentifier) {
  const selectors = [
    `[data-testid="onboarding-step-${stepIdentifier}"]`,
    `text="${stepIdentifier}"`,
    `[aria-label*="${stepIdentifier}"]`
  ];

  for (const selector of selectors) {
    try {
      const element = await page.waitForSelector(selector, { timeout: 5000 });
      if (element) {
        await element.click();
        console.log(`✅ Clicked onboarding step: ${stepIdentifier}`);
        return true;
      }
    } catch (error) {
      console.log(`⏭️ Step selector not found, trying next: ${selector}`);
    }
  }

  console.error(`❌ Could not find onboarding step: ${stepIdentifier}`);
  return false;
}

/**
 * Verify step completion status
 */
async function verifyStepStatus(page, stepName, expectedStatus = 'completed') {
  // Look for visual indicators of step completion
  const completionSelectors = [
    `[data-testid="step-${stepName}"][data-status="${expectedStatus}"]`,
    `[data-testid="step-${stepName}"] [data-testid="check-icon"]`,
    `[data-testid="step-${stepName}"] .completed`,
    `[aria-label*="${stepName}"][aria-describedby*="completed"]`
  ];

  for (const selector of completionSelectors) {
    try {
      const element = await page.waitForSelector(selector, { timeout: 5000 });
      if (element) {
        console.log(`✅ Step "${stepName}" verified as ${expectedStatus}`);
        return true;
      }
    } catch (error) {
      // Continue to next selector
    }
  }

  console.warn(`⚠️ Could not verify step "${stepName}" status as ${expectedStatus}`);
  return false;
}

/**
 * Wait for navigation to complete
 */
async function waitForNavigation(page, expectedPath = null) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    if (expectedPath) {
      await page.waitForURL(`*${expectedPath}*`, { timeout: 5000 });
      console.log(`✅ Navigated to expected path: ${expectedPath}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Navigation timeout:', error);
    return false;
  }
}

/**
 * Custom assertion for onboarding progress
 */
async function assertOnboardingProgress(page, expectedPercent) {
  try {
    // Look for progress indicators
    const progressElement = await page.waitForSelector(
      '[role="progressbar"], .progress, [class*="progress"]',
      { timeout: 5000 }
    );

    if (progressElement) {
      const progressValue = await progressElement.getAttribute('aria-valuenow') || 
                           await progressElement.getAttribute('value');
      
      if (progressValue && parseInt(progressValue) >= expectedPercent) {
        console.log(`✅ Progress is at least ${expectedPercent}%`);
        return true;
      }
    }

    console.warn(`⚠️ Could not verify progress of ${expectedPercent}%`);
    return false;
  } catch (error) {
    console.error('❌ Progress assertion failed:', error);
    return false;
  }
}

/**
 * Custom test function with enhanced error handling
 */
function onboardingTest(testName, testFn) {
  return test(testName, async ({ page }) => {
    try {
      console.log(`🧪 Starting test: ${testName}`);
      
      // Navigate to the app
      await page.goto('/');
      
      // Wait for initial load
      await page.waitForLoadState('domcontentloaded');
      
      // Run the actual test
      await testFn(page);
      
      console.log(`✅ Test completed: ${testName}`);
    } catch (error) {
      console.error(`❌ Test failed: ${testName}`, error);
      
      // Take screenshot on failure
      await takeScreenshot(page, `failed-${testName.replace(/\s+/g, '-').toLowerCase()}`);
      
      // Re-throw the error to fail the test
      throw error;
    }
  });
}

module.exports = {
  waitForElement,
  waitForText,
  takeScreenshot,
  waitForOnboardingChecklist,
  clickOnboardingStep,
  verifyStepStatus,
  waitForNavigation,
  assertOnboardingProgress,
  onboardingTest,
  test,
  expect
};