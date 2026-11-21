import { afterEach, describe, expect, it, vi } from 'vitest'

import { desktopSite } from './local-site'

/** A window with Hanzo Desktop's IPC (`invoke`), as the desktop's webview has. */
function desktop(invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>) {
  ;(globalThis as Record<string, unknown>).window = { __TAURI_INTERNALS__: { invoke } }
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window
})

describe('Redesigning a site on Hanzo Desktop (hanzo-inc/app issue 312)', () => {
  it('is nothing in a browser page, which cannot open a site for the agent', () => {
    ;(globalThis as Record<string, unknown>).window = {}
    expect(desktopSite()).toBeNull()
  })

  it('names the folder, saves the site into it, serves its redesign and shows it, each through the desktop’s own command', async () => {
    const invoke = vi.fn(async (cmd: string) => {
      switch (cmd) {
        case 'local_site_folder':
          return { name: 'acme-redesign', path: '/Users/me/Documents/Hanzo/acme-redesign' }
        case 'local_site_capture':
          return { title: 'Acme', url: 'https://acme.test/', files: ['page.html', 'text.md'], screenshot: false }
        case 'local_preview_start':
          return { url: 'http://127.0.0.1:9933/', port: 9933 }
        default:
          return null
      }
    })
    desktop(invoke)
    const site = desktopSite()!
    await expect(site.folder('acme-redesign')).resolves.toEqual({ name: 'acme-redesign', path: '/Users/me/Documents/Hanzo/acme-redesign' })
    await expect(site.capture('https://acme.test', '/Users/me/Documents/Hanzo/acme-redesign')).resolves.toEqual({
      title: 'Acme',
      url: 'https://acme.test/',
      files: ['page.html', 'text.md'],
      screenshot: false,
    })
    await expect(site.preview('/Users/me/Documents/Hanzo/acme-redesign')).resolves.toEqual({ url: 'http://127.0.0.1:9933/' })
    await site.show('http://127.0.0.1:9933/')
    await site.stop('/Users/me/Documents/Hanzo/acme-redesign')
    expect(invoke.mock.calls).toEqual([
      ['local_site_folder', { name: 'acme-redesign' }],
      ['local_site_capture', { url: 'https://acme.test', dir: '/Users/me/Documents/Hanzo/acme-redesign' }],
      ['local_preview_start', { dir: '/Users/me/Documents/Hanzo/acme-redesign' }],
      ['local_preview_open', { url: 'http://127.0.0.1:9933/' }],
      ['local_preview_stop', { dir: '/Users/me/Documents/Hanzo/acme-redesign' }],
    ])
  })

  it('says what the desktop refused in its own words, whether it rejects with text or an Error', async () => {
    desktop(async () => {
      throw 'The site took too long to answer.'
    })
    await expect(desktopSite()!.capture('https://slow.test', '/x')).rejects.toThrow('The site took too long to answer.')
    desktop(async () => {
      throw new Error('That preview is not running any more.')
    })
    await expect(desktopSite()!.show('http://127.0.0.1:1/')).rejects.toThrow('That preview is not running any more.')
  })
})
