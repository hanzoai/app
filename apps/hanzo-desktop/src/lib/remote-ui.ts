/**
 * Remote UI wrapper for Tauri
 * This module provides compatibility between tauri-remote-ui and @tauri-apps/api
 */

// Import tauri-remote-ui wrappers that handle both IPC and WebSocket
import { invoke as remoteInvoke } from 'tauri-remote-ui/api/core';
import { listen as remoteListen } from 'tauri-remote-ui/api/event';

// Re-export the wrapped functions
export { remoteInvoke as invoke, remoteListen as listen };

// Remote UI control functions
export async function enableRemoteUI(port?: number): Promise<string> {
  return await remoteInvoke('enable_remote_ui', { port });
}

export async function disableRemoteUI(): Promise<string> {
  return await remoteInvoke('disable_remote_ui');
}

export async function getRemoteUIStatus(): Promise<boolean> {
  return await remoteInvoke('get_remote_ui_status');
}

// Export a function to check if we're running in browser vs native
export function isRemoteUI(): boolean {
  return typeof window !== 'undefined' && !('__TAURI__' in window);
}
