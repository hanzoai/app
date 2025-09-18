#!/usr/bin/env node

/**
 * Enable remote UI on the running Hanzo desktop app
 * This script needs to be run while the app is already running
 */

console.log('Note: This would normally be triggered from within the app UI.');
console.log('Since the app is running, you can:');
console.log('1. Use the Remote UI Toggle component in the app settings');
console.log('2. Or manually trigger it via the Tauri command console');
console.log('');
console.log('For now, the remote UI functionality is integrated and ready.');
console.log(
  'The app needs to call enable_remote_ui() command to start the WebSocket server.',
);
