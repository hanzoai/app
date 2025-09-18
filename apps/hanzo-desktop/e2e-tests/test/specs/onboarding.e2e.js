describe('Hanzo Desktop Onboarding', () => {
  it('should display welcome page with logo', async () => {
    // Wait for app to load
    await browser.pause(2000);
    
    // Check if the welcome heading is present
    const welcomeHeading = await $('h1');
    const text = await welcomeHeading.getText();
    expect(text).toContain('Welcome');
  });

  it('should have terms and conditions checkbox', async () => {
    // Find the checkbox
    const termsCheckbox = await $('input[type="checkbox"]#terms');
    expect(await termsCheckbox.isExisting()).toBe(true);
    
    // Initially should not be checked
    expect(await termsCheckbox.isSelected()).toBe(false);
  });

  it('should have disabled Get Started button initially', async () => {
    // Find Get Started button
    const getStartedButton = await $('button=Get Started');
    expect(await getStartedButton.isExisting()).toBe(true);
    
    // Should be disabled initially
    expect(await getStartedButton.isEnabled()).toBe(false);
  });

  it('should enable Get Started button after accepting terms', async () => {
    // Click the checkbox
    const termsCheckbox = await $('input[type="checkbox"]#terms');
    await termsCheckbox.click();
    
    // Wait for state update
    await browser.pause(500);
    
    // Check if checkbox is selected
    expect(await termsCheckbox.isSelected()).toBe(true);
    
    // Get Started button should now be enabled
    const getStartedButton = await $('button=Get Started');
    expect(await getStartedButton.isEnabled()).toBe(true);
  });

  it('should spawn hanzod when Get Started is clicked', async () => {
    // Click Get Started button
    const getStartedButton = await $('button=Get Started');
    await getStartedButton.click();
    
    // Wait for hanzod to spawn and page navigation
    await browser.pause(5000);
    
    // Should navigate to next page (check for different content)
    // This depends on what page comes after terms & conditions
    const body = await $('body');
    const bodyText = await body.getText();
    
    // Should not still be on welcome page
    expect(bodyText).not.toContain('Welcome to Hanzo AI');
  });

  it('should show agent creation page', async () => {
    // After hanzod spawns, should be on agent creation page
    // Look for agent-related content
    const pageContent = await $('body').getText();
    
    // Check for agent creation elements
    const hasAgentContent = 
      pageContent.includes('Agent') || 
      pageContent.includes('agent') ||
      pageContent.includes('AI') ||
      pageContent.includes('Create');
    
    expect(hasAgentContent).toBe(true);
  });

  it('should complete onboarding flow', async () => {
    // Navigate through remaining onboarding steps
    // This would need to be expanded based on actual flow
    
    // Look for any continue/next buttons
    const nextButtons = await $$('button');
    for (const button of nextButtons) {
      const text = await button.getText();
      if (text.includes('Continue') || text.includes('Next') || text.includes('Create')) {
        if (await button.isEnabled()) {
          await button.click();
          await browser.pause(2000);
        }
      }
    }
    
    // Eventually should reach chat interface
    // Check if we've reached the main application
    await browser.pause(3000);
    const finalPageContent = await $('body').getText();
    
    // Look for chat interface elements
    const hasChatInterface = 
      finalPageContent.includes('Chat') ||
      finalPageContent.includes('Message') ||
      finalPageContent.includes('Send') ||
      finalPageContent.includes('Type');
    
    expect(hasChatInterface).toBe(true);
  });

  it('should be able to send a message in chat', async () => {
    // Try to find chat input field
    const chatInput = await $('textarea, input[type="text"]');
    
    if (await chatInput.isExisting()) {
      // Type a test message
      await chatInput.setValue('Hello, Hanzo AI!');
      
      // Find and click send button
      const sendButton = await $('button*=Send');
      if (await sendButton.isExisting()) {
        await sendButton.click();
        
        // Wait for response
        await browser.pause(3000);
        
        // Check if message was sent
        const messages = await $$('div[role="article"], div.message');
        expect(messages.length).toBeGreaterThan(0);
      }
    }
  });
});