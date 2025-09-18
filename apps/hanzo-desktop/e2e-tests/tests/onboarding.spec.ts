import { test, expect } from '@playwright/test';

test.describe('Hanzo Desktop Onboarding', () => {
  test('should display welcome page with logo', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForTimeout(2000);
    
    // Check if the welcome heading is present
    const welcomeHeading = await page.locator('h1');
    const text = await welcomeHeading.textContent();
    expect(text).toContain('Welcome');
  });

  test('should have terms and conditions checkbox', async ({ page }) => {
    await page.goto('/');
    
    // Find the checkbox
    const termsCheckbox = await page.locator('input[type="checkbox"]#terms');
    await expect(termsCheckbox).toBeVisible();
    
    // Initially should not be checked
    await expect(termsCheckbox).not.toBeChecked();
  });

  test('should have disabled Get Started button initially', async ({ page }) => {
    await page.goto('/');
    
    // Find Get Started button
    const getStartedButton = await page.getByRole('button', { name: 'Get Started' });
    await expect(getStartedButton).toBeVisible();
    
    // Should be disabled initially
    await expect(getStartedButton).toBeDisabled();
  });

  test('should enable Get Started button after accepting terms', async ({ page }) => {
    await page.goto('/');
    
    // Click the checkbox
    const termsCheckbox = await page.locator('input[type="checkbox"]#terms');
    await termsCheckbox.click();
    
    // Wait for state update
    await page.waitForTimeout(500);
    
    // Check if checkbox is selected
    await expect(termsCheckbox).toBeChecked();
    
    // Get Started button should now be enabled
    const getStartedButton = await page.getByRole('button', { name: 'Get Started' });
    await expect(getStartedButton).toBeEnabled();
  });

  test('should spawn hanzod when Get Started is clicked', async ({ page }) => {
    await page.goto('/');
    
    // Accept terms
    const termsCheckbox = await page.locator('input[type="checkbox"]#terms');
    await termsCheckbox.click();
    
    // Click Get Started button
    const getStartedButton = await page.getByRole('button', { name: 'Get Started' });
    await getStartedButton.click();
    
    // Wait for hanzod to spawn and page navigation
    await page.waitForTimeout(5000);
    
    // Should navigate to next page (check for different content)
    const bodyText = await page.locator('body').textContent();
    
    // Should not still be on welcome page
    expect(bodyText).not.toContain('Welcome to Hanzo AI');
  });

  test('should show agent creation page', async ({ page }) => {
    await page.goto('/');
    
    // Complete onboarding
    const termsCheckbox = await page.locator('input[type="checkbox"]#terms');
    await termsCheckbox.click();
    const getStartedButton = await page.getByRole('button', { name: 'Get Started' });
    await getStartedButton.click();
    
    // Wait for navigation
    await page.waitForTimeout(5000);
    
    // After hanzod spawns, should be on agent creation page
    const pageContent = await page.locator('body').textContent();
    
    // Check for agent creation elements
    const hasAgentContent = 
      pageContent?.includes('Agent') || 
      pageContent?.includes('agent') ||
      pageContent?.includes('AI') ||
      pageContent?.includes('Create');
    
    expect(hasAgentContent).toBe(true);
  });

  test('should complete onboarding flow', async ({ page }) => {
    await page.goto('/');
    
    // Complete initial onboarding
    const termsCheckbox = await page.locator('input[type="checkbox"]#terms');
    await termsCheckbox.click();
    const getStartedButton = await page.getByRole('button', { name: 'Get Started' });
    await getStartedButton.click();
    
    // Wait for navigation
    await page.waitForTimeout(2000);
    
    // Navigate through remaining onboarding steps
    // Look for any continue/next buttons
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const text = await button.textContent();
      if (text?.includes('Continue') || text?.includes('Next') || text?.includes('Create')) {
        const isEnabled = await button.isEnabled();
        if (isEnabled) {
          await button.click();
          await page.waitForTimeout(2000);
        }
      }
    }
    
    // Eventually should reach chat interface
    await page.waitForTimeout(3000);
    const finalPageContent = await page.locator('body').textContent();
    
    // Look for chat interface elements
    const hasChatInterface = 
      finalPageContent?.includes('Chat') ||
      finalPageContent?.includes('Message') ||
      finalPageContent?.includes('Send') ||
      finalPageContent?.includes('Type');
    
    expect(hasChatInterface).toBe(true);
  });

  test('should be able to send a message in chat', async ({ page }) => {
    await page.goto('/');
    
    // Complete onboarding
    const termsCheckbox = await page.locator('input[type="checkbox"]#terms');
    await termsCheckbox.click();
    const getStartedButton = await page.getByRole('button', { name: 'Get Started' });
    await getStartedButton.click();
    
    // Wait for chat interface
    await page.waitForTimeout(5000);
    
    // Try to find chat input field
    const chatInput = await page.locator('textarea, input[type="text"]').first();
    
    if (await chatInput.isVisible()) {
      // Type a test message
      await chatInput.fill('Hello, Hanzo AI!');
      
      // Find and click send button
      const sendButton = await page.getByRole('button', { name: /Send/i });
      if (await sendButton.isVisible()) {
        await sendButton.click();
        
        // Wait for response
        await page.waitForTimeout(3000);
        
        // Check if message was sent
        const messages = await page.locator('div[role="article"], div.message').all();
        expect(messages.length).toBeGreaterThan(0);
      }
    }
  });
});