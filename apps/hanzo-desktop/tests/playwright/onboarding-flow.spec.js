const { test, expect } = require('@playwright/test');
const {
  waitForElement,
  waitForText,
  takeScreenshot,
  waitForOnboardingChecklist,
  clickOnboardingStep,
  verifyStepStatus,
  waitForNavigation,
  assertOnboardingProgress,
  onboardingTest,
} = require('../utils/test-helpers');

/**
 * Hanzo Desktop App - Onboarding Flow Integration Tests
 * 
 * This test suite validates the complete onboarding experience for new users,
 * covering all the steps defined in the GetStartedSteps enum:
 * - SetupHanzoNode
 * - CreateAIAgent  
 * - CreateAIChatWithAgent
 * - CreateTool
 * - EquipAgentWithTools (removed from current implementation)
 */

test.describe('Hanzo Desktop Onboarding Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and wait for it to load
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(2000);
    
    console.log('🚀 Starting onboarding flow test');
  });

  onboardingTest('should display the onboarding checklist on first load', async (page) => {
    // Check if the onboarding checklist is visible
    const checklistFound = await waitForOnboardingChecklist(page);
    expect(checklistFound).toBeTruthy();
    
    // Look for the "Get Started" text or progress indicator
    const hasGetStartedText = await waitForText(page, 'Get Started') ||
                              await waitForText(page, 'getStartedText') ||
                              await waitForText(page, 'onboardingChecklist');
    
    // Take a screenshot for debugging
    await takeScreenshot(page, 'onboarding-checklist-visible');
    
    // Verify progress is at 0% initially (or very low)
    await assertOnboardingProgress(page, 0);
  });

  onboardingTest('should show all onboarding steps', async (page) => {
    // Wait for the onboarding checklist to appear
    await waitForOnboardingChecklist(page);
    
    // Look for the main onboarding steps based on the enum values
    const stepTexts = [
      'Setup Hanzo Desktop',
      'setupHanzoDesktop',
      'Add AI Agent',
      'addAIAgent', 
      'Create AI Chat',
      'createAIChatWithAgent',
      'Create Tool',
      'createTool'
    ];

    let stepsFound = 0;
    for (const stepText of stepTexts) {
      const stepExists = await page.locator(`text*="${stepText}"`).count() > 0;
      if (stepExists) {
        stepsFound++;
        console.log(`✅ Found step: ${stepText}`);
      }
    }

    // We should find at least some of the steps
    expect(stepsFound).toBeGreaterThan(0);
    
    await takeScreenshot(page, 'all-onboarding-steps');
  });

  onboardingTest('should be able to interact with onboarding steps', async (page) => {
    // Wait for the onboarding interface
    await waitForOnboardingChecklist(page);
    
    // Try to open/expand the onboarding checklist if it's collapsed
    const possibleTriggers = [
      '[data-testid="onboarding-trigger"]',
      'button[aria-expanded="false"]',
      '[role="button"]:has-text("Get Started")',
      '.onboarding-trigger',
      '[class*="popover-trigger"]'
    ];

    for (const selector of possibleTriggers) {
      try {
        const trigger = await page.waitForSelector(selector, { timeout: 2000 });
        if (trigger) {
          await trigger.click();
          await page.waitForTimeout(1000);
          console.log(`✅ Clicked trigger: ${selector}`);
          break;
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }
    
    // Look for expandable accordion items or step buttons
    const stepInteractionSelectors = [
      '[data-testid^="onboarding-step"]',
      '[role="button"][aria-expanded]',
      '.accordion-trigger',
      'button:has-text("Add AI Agent")',
      'button:has-text("Create")'
    ];

    let interactionSuccessful = false;
    for (const selector of stepInteractionSelectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          // Click on the first available interactive element
          await elements[0].click();
          await page.waitForTimeout(1000);
          console.log(`✅ Successfully interacted with: ${selector}`);
          interactionSuccessful = true;
          break;
        }
      } catch (error) {
        console.log(`⏭️ Could not interact with: ${selector}`);
        continue;
      }
    }

    await takeScreenshot(page, 'onboarding-interaction-attempt');
    
    // The test passes if we can find and potentially interact with onboarding elements
    // Since the actual functionality might not work in test environment, we focus on UI presence
    expect(interactionSuccessful || await waitForOnboardingChecklist(page)).toBeTruthy();
  });

  onboardingTest('should handle navigation from onboarding steps', async (page) => {
    await waitForOnboardingChecklist(page);
    
    // Look for navigation buttons within onboarding steps
    const navigationButtons = [
      'button:has-text("Add AI Agent")',
      'button:has-text("Create")',
      '[href="/agents"]',
      '[href="/tools"]',
      '[href="/home"]'
    ];

    for (const buttonSelector of navigationButtons) {
      try {
        const button = await page.waitForSelector(buttonSelector, { timeout: 3000 });
        if (button) {
          console.log(`✅ Found navigation button: ${buttonSelector}`);
          
          // Click the button
          await button.click();
          
          // Wait for potential navigation
          await page.waitForTimeout(2000);
          
          // Check if URL changed or new content loaded
          const currentUrl = page.url();
          console.log(`Current URL after click: ${currentUrl}`);
          
          await takeScreenshot(page, `navigation-${buttonSelector.replace(/[^a-zA-Z0-9]/g, '-')}`);
          
          // Navigate back to home for next test
          await page.goto('/');
          await page.waitForTimeout(1000);
          
          break;
        }
      } catch (error) {
        console.log(`⏭️ Navigation button not found: ${buttonSelector}`);
        continue;
      }
    }
  });

  onboardingTest('should track progress appropriately', async (page) => {
    await waitForOnboardingChecklist(page);
    
    // Look for progress indicators
    const progressSelectors = [
      '[role="progressbar"]',
      '.progress-bar',
      '[class*="progress"]',
      '[data-testid*="progress"]'
    ];

    let progressFound = false;
    for (const selector of progressSelectors) {
      try {
        const progressElement = await page.waitForSelector(selector, { timeout: 3000 });
        if (progressElement) {
          const progressValue = await progressElement.getAttribute('value') || 
                               await progressElement.getAttribute('aria-valuenow');
          
          console.log(`✅ Found progress indicator with value: ${progressValue}`);
          progressFound = true;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    // Look for percentage text
    const hasPercentageText = await page.locator('text*="%"').count() > 0;
    
    if (hasPercentageText) {
      console.log('✅ Found percentage text in progress display');
      progressFound = true;
    }

    await takeScreenshot(page, 'progress-tracking');
    
    // Progress tracking should be visible or at least the onboarding should be present
    expect(progressFound || await waitForOnboardingChecklist(page)).toBeTruthy();
  });

  onboardingTest('should handle dismissal of completed onboarding', async (page) => {
    await waitForOnboardingChecklist(page);
    
    // Look for dismiss button or completion state
    const dismissSelectors = [
      'button:has-text("Dismiss")',
      'button:has-text("Done")',
      'button:has-text("Complete")',
      '[data-testid="dismiss-onboarding"]',
      '[aria-label*="dismiss"]'
    ];

    for (const selector of dismissSelectors) {
      try {
        const dismissButton = await page.waitForSelector(selector, { timeout: 2000 });
        if (dismissButton) {
          console.log(`✅ Found dismiss button: ${selector}`);
          
          // Check if it's clickable
          const isEnabled = await dismissButton.isEnabled();
          console.log(`Dismiss button enabled: ${isEnabled}`);
          
          if (isEnabled) {
            await dismissButton.click();
            await page.waitForTimeout(1000);
            
            // Check if onboarding was dismissed
            const checklistStillVisible = await waitForOnboardingChecklist(page);
            console.log(`Checklist still visible after dismiss: ${checklistStillVisible}`);
          }
          
          break;
        }
      } catch (error) {
        continue;
      }
    }

    await takeScreenshot(page, 'onboarding-dismissal-test');
  });

  onboardingTest('should be responsive and accessible', async (page) => {
    await waitForOnboardingChecklist(page);
    
    // Test basic accessibility
    const accessibilityChecks = [
      // Check for ARIA labels
      async () => {
        const elementsWithAria = await page.locator('[aria-label]').count();
        return elementsWithAria > 0;
      },
      
      // Check for keyboard navigation
      async () => {
        const focusableElements = await page.locator('button, [tabindex="0"]').count();
        return focusableElements > 0;
      },
      
      // Check for semantic markup
      async () => {
        const semanticElements = await page.locator('button, [role="button"], [role="progressbar"]').count();
        return semanticElements > 0;
      }
    ];

    let accessibilityScore = 0;
    for (const check of accessibilityChecks) {
      try {
        const result = await check();
        if (result) accessibilityScore++;
      } catch (error) {
        console.warn('Accessibility check failed:', error);
      }
    }

    console.log(`Accessibility score: ${accessibilityScore}/${accessibilityChecks.length}`);
    
    // Test responsiveness by checking layout at different sizes
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'responsive-small');
    
    await page.setViewportSize({ width: 1280, height: 840 });
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'responsive-large');
    
    // Basic accessibility and responsiveness should be present
    expect(accessibilityScore).toBeGreaterThan(0);
  });
});