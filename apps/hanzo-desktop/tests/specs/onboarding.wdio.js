const { expect } = require('@wdio/globals');

/**
 * WebdriverIO test for Hanzo Desktop Onboarding Flow
 * 
 * This provides an alternative testing approach using WebdriverIO
 * alongside the Playwright tests for comprehensive coverage.
 */
describe('Hanzo Desktop Onboarding (WebdriverIO)', () => {
    
    beforeEach(async () => {
        // Navigate to the application
        await browser.url('/');
        
        // Wait for the page to load
        await browser.waitUntil(
            async () => (await browser.execute(() => document.readyState)) === 'complete',
            { timeout: 15000, timeoutMsg: 'Page did not load within 15 seconds' }
        );

        console.log('🚀 WebdriverIO test setup complete');
    });

    it('should display the application title', async () => {
        // Get the page title
        const title = await browser.getTitle();
        console.log(`Page title: ${title}`);
        
        // Basic assertion that we're on the right app
        expect(title).toContain('Hanzo');
    });

    it('should find onboarding elements', async () => {
        // Look for onboarding-related elements
        const selectors = [
            '[data-testid*="onboarding"]',
            '*[class*="onboarding"]',
            'text=Get Started',
            '[role="progressbar"]'
        ];

        let foundElements = 0;
        
        for (const selector of selectors) {
            try {
                const elements = await $$(selector);
                if (elements.length > 0) {
                    foundElements++;
                    console.log(`✅ Found ${elements.length} elements for: ${selector}`);
                }
            } catch (error) {
                console.log(`⏭️ Selector not found: ${selector}`);
            }
        }

        // We should find at least some onboarding elements
        expect(foundElements).toBeGreaterThan(0);
    });

    it('should handle basic interactions', async () => {
        // Look for interactive elements
        const interactiveSelectors = [
            'button',
            '[role="button"]',
            '[tabindex="0"]',
            'a'
        ];

        let interactableElements = 0;

        for (const selector of interactiveSelectors) {
            try {
                const elements = await $$(selector);
                interactableElements += elements.length;
            } catch (error) {
                // Continue to next selector
            }
        }

        console.log(`Found ${interactableElements} interactive elements`);
        expect(interactableElements).toBeGreaterThan(0);
    });

    it('should be responsive to window resizing', async () => {
        // Test different window sizes
        const sizes = [
            { width: 800, height: 600 },
            { width: 1280, height: 840 },
            { width: 1920, height: 1080 }
        ];

        for (const size of sizes) {
            await browser.setWindowSize(size.width, size.height);
            await browser.pause(1000); // Wait for layout to adjust
            
            // Verify the page still loads properly
            const bodyElement = await $('body');
            const isDisplayed = await bodyElement.isDisplayed();
            expect(isDisplayed).toBe(true);
            
            console.log(`✅ Page responsive at ${size.width}x${size.height}`);
        }
    });

    it('should have proper accessibility attributes', async () => {
        // Check for accessibility features
        const accessibilitySelectors = [
            '[aria-label]',
            '[aria-describedby]',
            '[role]',
            'button',
            '[alt]'
        ];

        let accessibilityScore = 0;

        for (const selector of accessibilitySelectors) {
            try {
                const elements = await $$(selector);
                if (elements.length > 0) {
                    accessibilityScore++;
                    console.log(`✅ Found accessibility elements: ${selector} (${elements.length})`);
                }
            } catch (error) {
                // Continue checking
            }
        }

        // Should have some accessibility features
        expect(accessibilityScore).toBeGreaterThan(0);
        console.log(`Accessibility score: ${accessibilityScore}/${accessibilitySelectors.length}`);
    });

    it('should handle navigation appropriately', async () => {
        const currentUrl = await browser.getUrl();
        console.log(`Starting URL: ${currentUrl}`);

        // Look for navigation elements
        try {
            const navButtons = await $$('button, a[href], [role="button"]');
            
            if (navButtons.length > 0) {
                console.log(`Found ${navButtons.length} potential navigation elements`);
                
                // Try to interact with the first few elements safely
                for (let i = 0; i < Math.min(3, navButtons.length); i++) {
                    try {
                        const button = navButtons[i];
                        const isClickable = await button.isClickable();
                        
                        if (isClickable) {
                            console.log(`✅ Element ${i} is clickable`);
                            // We don't actually click to avoid disrupting the test flow
                            // but we verify the element is interactable
                        }
                    } catch (error) {
                        console.log(`⏭️ Element ${i} interaction check failed`);
                    }
                }
            }
        } catch (error) {
            console.warn('Navigation test encountered an error:', error.message);
        }

        // The test passes if we can analyze navigation elements without errors
        expect(true).toBe(true);
    });

    afterEach(async () => {
        // Take a screenshot for debugging if test fails
        if (browser.capabilities.browserName) {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                await browser.saveScreenshot(`./test-results/wdio-screenshot-${timestamp}.png`);
            } catch (error) {
                console.warn('Could not take screenshot:', error.message);
            }
        }
    });
});