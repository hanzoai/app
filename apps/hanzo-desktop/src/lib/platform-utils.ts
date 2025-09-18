/**
 * Platform utilities that work with both native and remote UI
 */

import { invoke } from '@tauri-apps/api/core';
import { platform as tauriPlatform } from '@tauri-apps/plugin-os';

/**
 * Get the current platform with fallback for browser/remote UI contexts
 * This safely handles cases where Tauri APIs aren't available
 */
export async function getPlatform(): Promise<string> {
  try {
    // First try the direct Tauri plugin API
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      return tauriPlatform();
    }

    // If we're in remote UI, try to invoke the command directly
    // The OS plugin should expose a 'plugin:os|platform' command
    try {
      const result = await invoke('plugin:os|platform');
      return result as string;
    } catch (invokeError) {
      console.warn('Failed to invoke platform command:', invokeError);
    }

    // Fallback: detect from user agent (less accurate but works everywhere)
    if (typeof window !== 'undefined' && window.navigator) {
      const userAgent = window.navigator.userAgent.toLowerCase();
      if (userAgent.includes('win')) return 'windows';
      if (userAgent.includes('linux')) return 'linux';
      if (userAgent.includes('mac')) return 'macos';
    }

    // Final fallback
    return 'macos';
  } catch (error) {
    console.warn('Platform detection failed, using fallback:', error);
    return 'macos';
  }
}

/**
 * Synchronous platform detection with fallback
 * Use this only when async isn't possible (module initialization)
 */
export function getPlatformSync(): string {
  try {
    // Try direct Tauri API if available
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      return tauriPlatform();
    }
  } catch (error) {
    // Silent catch - we'll use fallback
  }

  // Fallback to user agent detection
  if (typeof window !== 'undefined' && window.navigator) {
    const userAgent = window.navigator.userAgent.toLowerCase();
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('linux')) return 'linux';
    if (userAgent.includes('mac')) return 'macos';
  }

  return 'macos';
}
