#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { chromium } from 'playwright';

/**
 * MCP Server for Hanzo Desktop Browser Control
 *
 * This server provides tools to control the Hanzo desktop app via browser automation.
 * It connects to the app's remote UI WebSocket server exposed by tauri-remote-ui.
 */

class HanzoBrowserControlServer {
  constructor() {
    this.browser = null;
    this.page = null;
    this.server = new Server(
      {
        name: 'hanzo-browser-control',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'connect_to_app',
          description: 'Connect to the Hanzo desktop app via remote UI',
          inputSchema: {
            type: 'object',
            properties: {
              port: {
                type: 'number',
                description: 'Port where remote UI is exposed (default: 9090)',
                default: 9090,
              },
            },
          },
        },
        {
          name: 'disconnect',
          description: 'Disconnect from the Hanzo desktop app',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'click_element',
          description: 'Click on an element in the app',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector or text to click',
              },
            },
            required: ['selector'],
          },
        },
        {
          name: 'type_text',
          description: 'Type text into an input field',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector of the input field',
              },
              text: {
                type: 'string',
                description: 'Text to type',
              },
            },
            required: ['selector', 'text'],
          },
        },
        {
          name: 'get_text',
          description: 'Get text content from an element',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector of the element',
              },
            },
            required: ['selector'],
          },
        },
        {
          name: 'take_screenshot',
          description: 'Take a screenshot of the current app state',
          inputSchema: {
            type: 'object',
            properties: {
              fullPage: {
                type: 'boolean',
                description: 'Capture full page (default: false)',
                default: false,
              },
            },
          },
        },
        {
          name: 'wait_for_element',
          description: 'Wait for an element to appear',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector to wait for',
              },
              timeout: {
                type: 'number',
                description: 'Timeout in milliseconds (default: 30000)',
                default: 30000,
              },
            },
            required: ['selector'],
          },
        },
        {
          name: 'navigate',
          description: 'Navigate to a specific route in the app',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to navigate to (e.g., /settings)',
              },
            },
            required: ['path'],
          },
        },
        {
          name: 'invoke_tauri_command',
          description: 'Invoke a Tauri command directly',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'Tauri command name',
              },
              args: {
                type: 'object',
                description: 'Arguments for the command',
                default: {},
              },
            },
            required: ['command'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'connect_to_app':
            return await this.connectToApp(args.port || 9090);

          case 'disconnect':
            return await this.disconnect();

          case 'click_element':
            return await this.clickElement(args.selector);

          case 'type_text':
            return await this.typeText(args.selector, args.text);

          case 'get_text':
            return await this.getText(args.selector);

          case 'take_screenshot':
            return await this.takeScreenshot(args.fullPage);

          case 'wait_for_element':
            return await this.waitForElement(args.selector, args.timeout);

          case 'navigate':
            return await this.navigate(args.path);

          case 'invoke_tauri_command':
            return await this.invokeTauriCommand(args.command, args.args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async connectToApp(port) {
    if (this.browser) {
      await this.disconnect();
    }

    this.browser = await chromium.launch({
      headless: false, // Show the browser for debugging
    });

    this.page = await this.browser.newPage();
    await this.page.goto(`http://localhost:${port}`);

    // Wait for the app to load
    await this.page.waitForLoadState('networkidle');

    return {
      content: [
        {
          type: 'text',
          text: `Connected to Hanzo desktop app on port ${port}`,
        },
      ],
    };
  }

  async disconnect() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }

    return {
      content: [
        {
          type: 'text',
          text: 'Disconnected from Hanzo desktop app',
        },
      ],
    };
  }

  async clickElement(selector) {
    if (!this.page) {
      throw new Error('Not connected to app. Use connect_to_app first.');
    }

    await this.page.click(selector);

    return {
      content: [
        {
          type: 'text',
          text: `Clicked element: ${selector}`,
        },
      ],
    };
  }

  async typeText(selector, text) {
    if (!this.page) {
      throw new Error('Not connected to app. Use connect_to_app first.');
    }

    await this.page.fill(selector, text);

    return {
      content: [
        {
          type: 'text',
          text: `Typed "${text}" into ${selector}`,
        },
      ],
    };
  }

  async getText(selector) {
    if (!this.page) {
      throw new Error('Not connected to app. Use connect_to_app first.');
    }

    const text = await this.page.textContent(selector);

    return {
      content: [
        {
          type: 'text',
          text: text || '(empty)',
        },
      ],
    };
  }

  async takeScreenshot(fullPage = false) {
    if (!this.page) {
      throw new Error('Not connected to app. Use connect_to_app first.');
    }

    const screenshot = await this.page.screenshot({
      fullPage,
      type: 'png',
    });

    return {
      content: [
        {
          type: 'image',
          data: screenshot.toString('base64'),
          mimeType: 'image/png',
        },
      ],
    };
  }

  async waitForElement(selector, timeout = 30000) {
    if (!this.page) {
      throw new Error('Not connected to app. Use connect_to_app first.');
    }

    await this.page.waitForSelector(selector, { timeout });

    return {
      content: [
        {
          type: 'text',
          text: `Element ${selector} is now visible`,
        },
      ],
    };
  }

  async navigate(path) {
    if (!this.page) {
      throw new Error('Not connected to app. Use connect_to_app first.');
    }

    const currentUrl = this.page.url();
    const baseUrl = new URL(currentUrl).origin;
    await this.page.goto(`${baseUrl}${path}`);
    await this.page.waitForLoadState('networkidle');

    return {
      content: [
        {
          type: 'text',
          text: `Navigated to ${path}`,
        },
      ],
    };
  }

  async invokeTauriCommand(command, args = {}) {
    if (!this.page) {
      throw new Error('Not connected to app. Use connect_to_app first.');
    }

    // Execute the Tauri command via the remote UI interface
    const result = await this.page.evaluate(
      async (cmd, cmdArgs) => {
        // The remote UI should have the invoke function available
        if (window.__TAURI_INVOKE__) {
          return await window.__TAURI_INVOKE__(cmd, cmdArgs);
        } else if (window.invoke) {
          return await window.invoke(cmd, cmdArgs);
        } else {
          throw new Error('Tauri invoke function not available');
        }
      },
      command,
      args,
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Hanzo Browser Control MCP server running on stdio');
  }
}

// Start the server
const server = new HanzoBrowserControlServer();
server.run().catch(console.error);
