/**
 * Redesigning a site on Hanzo Desktop (hanzo-inc/app issue 312, hanzoai/desktop issue 15).
 *
 * `desktopSite()` is @hanzo/build's `Site` (`Host.site`) over the desktop's own commands: the window opens the
 * site from the computer's connection and saves a copy into a folder (`local_site_capture`), serves the folder's
 * `redesign/` live on this computer (`local_preview_start`) and shows it in Chrome (`local_preview_open`). A browser
 * page has no such commands, so it gets none and Dev offers nothing of it. The agent runs through `desktopLocal()`.
 *
 * What the desktop refuses it says in plain words (an address on a private network, a site that will not answer), and
 * those words are what a person reads: they are passed up as the error's own message.
 */
import type { Site } from '@hanzo/dev/builder'

import { isTauri } from './local-fs'

/** Invoke a desktop command; a refusal is its plain words, as an Error. */
async function command<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const win = window as unknown as { __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<T> } }
  const invoke = win.__TAURI_INTERNALS__?.invoke
  if (!invoke) throw new Error('Hanzo Desktop is not running.')
  try {
    return await invoke(name, args)
  } catch (e) {
    throw e instanceof Error ? e : new Error(typeof e === 'string' ? e : 'Hanzo Desktop could not do that.')
  }
}

/** What `local_site_folder` answers: the folder's name and path. */
interface SiteFolder {
  name: string
  path: string
}

/** What `local_site_capture` answers. */
interface SiteSaved {
  title: string
  url: string
  files: string[]
  screenshot: boolean
}

/** What `local_preview_start` answers. */
interface Live {
  url: string
  port: number
}

/** Hanzo Desktop's way of redesigning a site, or null outside its window. */
export function desktopSite(): Site | null {
  if (!isTauri()) return null
  return {
    folder: async (name) => {
      const made = await command<SiteFolder>('local_site_folder', { name })
      return { path: made.path, name: made.name }
    },
    capture: async (url, folder) => {
      const saved = await command<SiteSaved>('local_site_capture', { url, dir: folder })
      return { title: saved.title, url: saved.url, files: saved.files, screenshot: saved.screenshot }
    },
    preview: async (folder) => {
      const live = await command<Live>('local_preview_start', { dir: folder })
      return { url: live.url }
    },
    stop: async (folder) => {
      await command<null>('local_preview_stop', { dir: folder })
    },
    show: async (url) => {
      await command<null>('local_preview_open', { url })
    },
  }
}
