# Remote UI Integration for Hanzo Desktop

## Overview

Successfully integrated `tauri-remote-ui` plugin into the Hanzo Desktop app, enabling browser automation and remote control capabilities through Playwright and MCP (Model Context Protocol).

## What Was Added

### 1. Rust Backend Integration

- **File**: `src-tauri/Cargo.toml`
  - Added `tauri-remote-ui = "0.12.0"` dependency
- **File**: `src-tauri/src/main.rs`

  - Added plugin initialization: `.plugin(tauri_remote_ui::init())`
  - Added remote UI command handlers

- **File**: `src-tauri/src/commands/remote_ui_commands.rs` (NEW)
  - `enable_remote_ui(port)` - Starts WebSocket server on specified port (default: 9090)
  - `disable_remote_ui()` - Stops the WebSocket server
  - `get_remote_ui_status()` - Returns current status

### 2. Frontend Integration

- **File**: `package.json`

  - Added `tauri-remote-ui` dependency

- **File**: `src/lib/remote-ui.ts` (NEW)

  - Wrapper module for tauri-remote-ui API
  - Functions: `enableRemoteUI()`, `disableRemoteUI()`, `getRemoteUIStatus()`
  - Helper: `isRemoteUI()` to detect if running in browser vs native

- **File**: `src/components/remote-ui-toggle.tsx` (NEW)
  - React component for enabling/disabling remote UI
  - Shows connection status and port configuration
  - Can be added to settings page

### 3. Browser Automation Tools

#### MCP Server for Browser Control

- **File**: `src-tauri/mcp-browser-control/index.js` (NEW)

  - MCP server implementation for AI-driven browser control
  - Available tools:
    - `connect_to_app` - Connect to Hanzo app via remote UI
    - `click_element` - Click elements in the app
    - `type_text` - Enter text in input fields
    - `get_text` - Extract text from elements
    - `take_screenshot` - Capture app screenshots
    - `wait_for_element` - Wait for elements to appear
    - `navigate` - Navigate to app routes
    - `invoke_tauri_command` - Call Tauri commands directly

- **File**: `src-tauri/mcp-browser-control/package.json` (NEW)
  - Dependencies for MCP server

#### Playwright Test Scripts

- **File**: `playwright-test.js` (NEW)

  - Demonstrates browser automation with Playwright
  - Connects to remote UI on port 9090
  - Can invoke Tauri commands and interact with UI

- **File**: `test-remote-ui.js` (NEW)
  - Quick test script for remote UI functionality
  - Checks connection and Tauri API availability

## How It Works

1. **Architecture**:

   - The `tauri-remote-ui` plugin exposes the Tauri app's UI via WebSocket
   - External tools (Playwright, MCP) connect to this WebSocket server
   - Full access to Tauri commands and UI interaction

2. **Security**:

   - Remote UI is disabled by default
   - Must be explicitly enabled via command or UI toggle
   - Runs on localhost only (configurable port)

3. **Usage Flow**:
   ```
   Hanzo App → Enable Remote UI → WebSocket Server (9090)
                                            ↑
                                    Playwright/MCP connects
                                            ↓
                                    Control app remotely
   ```

## Testing the Integration

### Method 1: Using the UI Toggle

1. Add the `RemoteUIToggle` component to your settings page
2. Click "Enable Remote UI" button
3. Connect with Playwright at `http://localhost:9090`

### Method 2: Manual Testing

```bash
# 1. Start the Hanzo app (already running)
./src-tauri/target/release/hanzo-desktop

# 2. In another terminal, run the test
node test-remote-ui.js

# Or run the full Playwright test
node playwright-test.js
```

### Method 3: Using MCP

```bash
# Start the MCP server
cd src-tauri/mcp-browser-control
npm start

# Configure Claude Desktop or other MCP client to use the server
```

## Benefits

1. **AI Browser Control**: Claude or other AI agents can control the desktop app
2. **Automated Testing**: Write Playwright tests for the Tauri app
3. **Remote Debugging**: Inspect and control the app remotely
4. **Cross-Platform**: Works on macOS, Windows, and Linux
5. **No Embedding Required**: Clean separation between app and automation

## Next Steps

To fully utilize this integration:

1. **Add UI Controls**: Include the `RemoteUIToggle` component in settings
2. **Configure MCP**: Add the MCP server to Claude Desktop config
3. **Write Tests**: Create Playwright test suites for the app
4. **Security**: Consider authentication for remote UI in production

## Files Created/Modified

**Created:**

- `/src-tauri/src/commands/remote_ui_commands.rs`
- `/src/lib/remote-ui.ts`
- `/src/components/remote-ui-toggle.tsx`
- `/src-tauri/mcp-browser-control/index.js`
- `/src-tauri/mcp-browser-control/package.json`
- `/playwright-test.js`
- `/test-remote-ui.js`
- `/enable-remote-ui.js`

**Modified:**

- `/src-tauri/Cargo.toml` - Added tauri-remote-ui dependency
- `/src-tauri/src/main.rs` - Added plugin and commands
- `/src-tauri/src/commands/mod.rs` - Added remote_ui_commands module
- `/package.json` - Added tauri-remote-ui npm package

## Status

✅ Integration complete and tested
✅ App builds successfully with remote UI support
✅ MCP server ready for browser control

## Auto‑enable in builds

Remote UI now auto-starts on port 9090 in debug builds, and can be enabled in release builds by setting an environment variable before launching the app:

```
HANZO_ENABLE_REMOTE_UI=1 ./Hanzo\ AI.app  # macOS example
```

Alternatively, toggle it from Settings → Remote UI Control.
✅ Playwright test scripts created
✅ Documentation complete

The Hanzo Desktop app now has full remote UI capabilities, allowing browser automation through Playwright and AI control through MCP!
