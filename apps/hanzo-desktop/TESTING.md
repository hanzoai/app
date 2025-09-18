# Hanzo Desktop Testing Guide

This document provides comprehensive instructions for setting up and running integration tests for the Hanzo Desktop application's onboarding flow.

## Overview

The testing infrastructure includes:
- **Playwright** for comprehensive browser-based testing
- **WebdriverIO** for alternative WebDriver-based testing
- **Test utilities** for common operations and assertions
- **Automated setup/teardown** for consistent test environments

## Prerequisites

1. **Node.js** (v18 or higher)
2. **pnpm** package manager
3. **Playwright browsers** (will be installed automatically)
4. **Tauri CLI** (for building and running the desktop app)

## Installation

All testing dependencies are already included in the project. Simply run:

```bash
pnpm install
```

This will install:
- `@playwright/test` - Browser automation framework
- `@wdio/cli` - WebdriverIO test runner
- `@wdio/local-runner` - Local test execution
- `@wdio/mocha-framework` - Test framework integration
- `@wdio/spec-reporter` - Test result reporting
- `webdriverio` - WebDriver protocol implementation

## Test Structure

```
tests/
├── setup/
│   ├── global-setup.js       # Test environment setup
│   └── global-teardown.js    # Test environment cleanup
├── utils/
│   └── test-helpers.js       # Common test utilities
├── playwright/
│   └── onboarding-flow.spec.js  # Playwright test suite
└── specs/
    └── onboarding.wdio.js    # WebdriverIO test suite
```

## Configuration Files

- **`playwright.config.js`** - Playwright test configuration
- **`wdio.conf.js`** - WebdriverIO test configuration

## Running Tests

### Quick Start

```bash
# Run all Playwright tests
pnpm test

# Run tests with browser UI visible
pnpm test:headed

# Run tests in debug mode
pnpm test:debug

# Run tests with interactive UI
pnpm test:ui

# View test reports
pnpm test:report
```

### WebdriverIO Tests

```bash
# Run WebdriverIO tests
pnpm test:wdio
```

### Advanced Options

```bash
# Run specific test file
npx playwright test tests/playwright/onboarding-flow.spec.js

# Run tests in specific browser
npx playwright test --project=webkit

# Run tests with specific timeout
npx playwright test --timeout=60000

# Run tests with retry on failure
npx playwright test --retries=2
```

## Test Scenarios

The test suite covers the following onboarding scenarios:

### 1. Initial Onboarding Display
- ✅ Onboarding checklist appears on first load
- ✅ Progress indicator shows 0% completion
- ✅ All onboarding steps are visible

### 2. Onboarding Steps Coverage
Tests validate the presence of all GetStartedSteps:
- **SetupHanzoNode** - Hanzo desktop setup
- **CreateAIAgent** - AI agent creation
- **CreateAIChatWithAgent** - Chat with agent creation
- **CreateTool** - Tool creation

### 3. Interactive Elements
- ✅ Onboarding checklist can be expanded/collapsed
- ✅ Step buttons are clickable and functional
- ✅ Navigation buttons redirect correctly

### 4. Progress Tracking
- ✅ Progress bar updates as steps are completed
- ✅ Percentage completion is displayed accurately
- ✅ Completion states are tracked properly

### 5. Accessibility & Responsiveness
- ✅ ARIA labels and semantic markup
- ✅ Keyboard navigation support
- ✅ Responsive design at different screen sizes

### 6. Completion Handling
- ✅ Dismiss functionality when all steps complete
- ✅ Proper cleanup of onboarding UI

## Test Utilities

The `test-helpers.js` file provides common functions:

```javascript
// Wait for elements
await waitForElement(page, '.onboarding-checklist');
await waitForText(page, 'Get Started');

// Onboarding-specific helpers
await waitForOnboardingChecklist(page);
await clickOnboardingStep(page, 'CreateAIAgent');
await verifyStepStatus(page, 'SetupHanzoNode', 'completed');

// Progress verification
await assertOnboardingProgress(page, 50); // 50% completion

// Debug utilities
await takeScreenshot(page, 'onboarding-state');
```

## Environment Setup

### Automatic Setup
The test framework automatically:
1. Starts the Tauri development server
2. Waits for the application to be ready
3. Runs the test suite
4. Cleans up processes after completion

### Manual Setup (for debugging)
```bash
# Terminal 1: Start Tauri dev server
pnpm tauri:dev

# Terminal 2: Run tests (when server is ready)
pnpm test
```

## Debugging Tests

### Visual Debugging
```bash
# Run with browser visible
pnpm test:headed

# Interactive debugging
pnpm test:debug

# UI mode for test exploration
pnpm test:ui
```

### Screenshots and Traces
- Screenshots are automatically taken on test failures
- Full page traces available for detailed debugging
- Test artifacts saved to `test-results/` directory

### Common Debug Commands
```bash
# Run single test with debug info
npx playwright test tests/playwright/onboarding-flow.spec.js --debug

# Generate test report
npx playwright show-report

# Record new tests interactively
npx playwright codegen http://localhost:1420
```

## Troubleshooting

### Common Issues

**Test fails to start:**
- Ensure Tauri development server is accessible
- Check that port 1420 is available
- Verify all dependencies are installed

**Onboarding elements not found:**
- Check if onboarding component is rendered correctly
- Verify CSS selectors in test files
- Use `--headed` mode to visually inspect the app

**Tests timeout:**
- Increase timeout values in configuration
- Check for slow network/build operations
- Ensure proper wait conditions

### Debug Logs
Enable detailed logging:
```bash
DEBUG=pw:api pnpm test
```

## Configuration Customization

### Playwright Config
Edit `playwright.config.js` to customize:
- Browser selection (webkit, chromium, firefox)
- Timeout values
- Retry configuration
- Reporter options

### WebdriverIO Config
Edit `wdio.conf.js` to customize:
- Browser capabilities
- Test execution settings
- Reporter configuration

## Best Practices

1. **Stable Selectors**: Use `data-testid` attributes for reliable element selection
2. **Wait Conditions**: Always wait for elements before interaction
3. **Error Handling**: Implement proper error handling and cleanup
4. **Screenshots**: Take screenshots on failures for debugging
5. **Isolation**: Ensure tests don't depend on each other

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Desktop App Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: pnpm install
      - run: pnpm test
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: test-results
          path: test-results/
```

## Advanced Testing

### Custom Test Scenarios
Add new test files to `tests/playwright/` or `tests/specs/` directories:

```javascript
// tests/playwright/custom-flow.spec.js
const { test, expect } = require('@playwright/test');

test('custom onboarding scenario', async ({ page }) => {
  // Your test implementation
});
```

### Performance Testing
```javascript
// Measure onboarding load time
const startTime = Date.now();
await page.goto('/');
await waitForOnboardingChecklist(page);
const loadTime = Date.now() - startTime;
console.log(`Onboarding loaded in ${loadTime}ms`);
```

## Support

For issues or questions about the testing infrastructure:
1. Check the test output and screenshots in `test-results/`
2. Review this documentation for common solutions
3. Run tests with `--debug` flag for detailed information
4. Use `--headed` mode to visually inspect test execution

---

*This testing infrastructure ensures the Hanzo Desktop onboarding experience works reliably across different environments and user interactions.*