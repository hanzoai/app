#!/usr/bin/env node

/**
 * Hanzo Desktop - Playwright Remote UI Automation
 *
 * This script connects to the running Hanzo Desktop app via tauri-remote-ui
 * and allows you to automate it while watching the real app update in real-time.
 *
 * The desktop app window stays visible and interactive - no placeholder screen!
 */

const { chromium } = require('playwright');

// Configuration
const REMOTE_UI_PORT = 9090; // Default tauri-remote-ui port
const REMOTE_UI_URL = `http://localhost:${REMOTE_UI_PORT}`;

async function connectToHanzoDesktop() {
    console.log('🔗 Connecting to Hanzo Desktop via Remote UI...');
    console.log(`📡 Remote UI URL: ${REMOTE_UI_URL}`);

    try {
        // Connect to the remote UI endpoint
        const browser = await chromium.connectOverCDP(REMOTE_UI_URL);
        const contexts = browser.contexts();

        if (contexts.length === 0) {
            console.log('Creating new context...');
            const context = await browser.newContext();
            const page = await context.newPage();
            await page.goto(REMOTE_UI_URL);
            return { browser, page };
        }

        // Use existing context
        const context = contexts[0];
        const pages = context.pages();
        const page = pages[0] || await context.newPage();

        console.log('✅ Connected to Hanzo Desktop!');
        console.log('👁️  The desktop app window remains visible and interactive');

        return { browser, page };
    } catch (error) {
        if (error.message.includes('ECONNREFUSED')) {
            console.error('❌ Could not connect to Remote UI on port', REMOTE_UI_PORT);
            console.log('\n📝 To enable Remote UI:');
            console.log('1. The app needs to start with remote UI enabled');
            console.log('2. Or enable it from Settings > Developer > Remote UI');
            console.log('\nAlternatively, set environment variable:');
            console.log('HANZO_ENABLE_REMOTE_UI=1 /Applications/Hanzo.app/Contents/MacOS/hanzo-desktop');
        } else {
            console.error('Error:', error.message);
        }
        throw error;
    }
}

async function automateHanzoDesktop() {
    const { browser, page } = await connectToHanzoDesktop();

    try {
        console.log('\n🤖 Starting automation...');
        console.log('Watch your desktop app window - you\'ll see everything happen there!\n');

        // Wait a moment for the app to be ready
        await page.waitForTimeout(1000);

        // Example: Check if we're on the onboarding page
        const onboardingExists = await page.locator('.onboarding-checklist').count() > 0;
        if (onboardingExists) {
            console.log('📋 Found onboarding checklist');

            // Get onboarding status
            const statusText = await page.locator('.text-cyan-400').first().textContent();
            console.log('Status:', statusText);
        }

        // Example: Navigate to different pages
        console.log('\n🔄 Navigating through the app...');

        // Check for navigation elements
        const hasQuickConnection = await page.locator('a[href="/quick-connection"]').count() > 0;
        if (hasQuickConnection) {
            console.log('Found quick connection link');
            // Uncomment to click it:
            // await page.click('a[href="/quick-connection"]');
            // await page.waitForTimeout(2000);
        }

        // Example: Interact with buttons
        const buttons = await page.locator('button').all();
        console.log(`\n🔘 Found ${buttons.length} buttons in the current view`);

        // Take a screenshot (saves to disk, app keeps running)
        await page.screenshot({
            path: 'hanzo-desktop-automated.png',
            fullPage: true
        });
        console.log('📸 Screenshot saved to hanzo-desktop-automated.png');

        // Example: Monitor for specific events
        console.log('\n👀 Monitoring app for 5 seconds...');

        // Listen for console messages from the app
        page.on('console', msg => {
            console.log('App console:', msg.text());
        });

        // Listen for page navigation
        page.on('framenavigated', frame => {
            if (frame === page.mainFrame()) {
                console.log('App navigated to:', frame.url());
            }
        });

        // Wait and observe
        await page.waitForTimeout(5000);

        console.log('\n✅ Automation complete!');
        console.log('The app remains open and fully functional.');

    } catch (error) {
        console.error('Automation error:', error);
    } finally {
        // Disconnect but keep the app running
        await browser.close();
        console.log('\n👋 Disconnected from Remote UI (app still running)');
    }
}

// Advanced example: Real-time interaction
async function interactiveMode() {
    const { browser, page } = await connectToHanzoDesktop();

    console.log('\n🎮 Interactive Mode');
    console.log('The desktop app is now controllable via Playwright');
    console.log('You can see all actions happen in the actual app window!\n');

    // Keep connection open for REPL or further commands
    // You could integrate this with a REPL or command interface

    return { browser, page };
}

// Run the automation
if (require.main === module) {
    automateHanzoDesktop().catch(console.error);
}

module.exports = {
    connectToHanzoDesktop,
    automateHanzoDesktop,
    interactiveMode
};