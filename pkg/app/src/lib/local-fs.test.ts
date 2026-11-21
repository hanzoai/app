import { afterEach, describe, expect, it, vi } from 'vitest'

import { desktopLocal, getLocalWorkspaces, runLocalDev } from './local-fs'

/** A window with Hanzo Desktop's IPC (`invoke`) and storage behind it, as the desktop's webview has. */
function desktop(invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>, seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed))
  const localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
  ;(globalThis as Record<string, unknown>).window = { __TAURI_INTERNALS__: { invoke }, localStorage }
  return map
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window
})

const two = JSON.stringify([
  { id: 'ws_1', name: 'site', path: '/Users/me/site', addedAt: 1, lastOpenedAt: 100 },
  { id: 'ws_2', name: 'api', path: '/Users/me/api', addedAt: 2, lastOpenedAt: 300 },
])

describe('This computer for Dev (hanzo-inc/app issues 309 and 310)', () => {
  it('is nothing in a browser page, which has no folder of its own', () => {
    ;(globalThis as Record<string, unknown>).window = { localStorage: { getItem: () => null } }
    expect(desktopLocal()).toBeNull()
  })

  it('lists the folders Hanzo Desktop opened, each with when it was used last', () => {
    desktop(async () => null, { 'hanzo.local_workspaces': two })
    expect(desktopLocal()!.folders()).toEqual([
      { path: '/Users/me/site', name: 'site', used: 100 },
      { path: '/Users/me/api', name: 'api', used: 300 },
    ])
  })

  it('runs the dev agent in the folder and reads the desktop’s own answer', async () => {
    const invoke = vi.fn(async () => ({ session_id: 'local_1', output: 'Edited README.md', success: true }))
    desktop(invoke)
    await expect(desktopLocal()!.run('/Users/me/api', 'Fix the typo')).resolves.toEqual({ ok: true, output: 'Edited README.md' })
    expect(invoke).toHaveBeenCalledWith('local_workspace_run_dev', { workspacePath: '/Users/me/api', prompt: 'Fix the typo' })
    await expect(runLocalDev('/Users/me/api', 'x')).resolves.toMatchObject({ sessionId: 'local_1', ok: true })
  })

  it('says a run the agent failed is not ok, with what it printed', async () => {
    desktop(async () => ({ session_id: 'local_2', output: 'error: not signed in', success: false }))
    await expect(desktopLocal()!.run('/Users/me/api', 'x')).resolves.toEqual({ ok: false, output: 'error: not signed in' })
  })

  it('takes a folder from the window’s own dialog, keeps it, and makes it the one used last', async () => {
    desktop(async (cmd) => (cmd === 'local_workspace_open_dialog' ? '/Users/me/new' : null), { 'hanzo.local_workspaces': two })
    const picked = await desktopLocal()!.pick()
    expect(picked).toMatchObject({ path: '/Users/me/new', name: 'new' })
    expect(getLocalWorkspaces().map((w) => w.path)).toContain('/Users/me/new')
    expect(picked!.used).toBeGreaterThan(300)
  })

  it('a closed dialog picks nothing, and never falls back to a picker that gives no path', async () => {
    const showDirectoryPicker = vi.fn()
    desktop(async () => null)
    ;(globalThis as unknown as { window: Record<string, unknown> }).window.showDirectoryPicker = showDirectoryPicker
    await expect(desktopLocal()!.pick()).resolves.toBeNull()
    expect(showDirectoryPicker).not.toHaveBeenCalled()
  })

  it('marks a folder used, so Auto picks it next', () => {
    desktop(async () => null, { 'hanzo.local_workspaces': two })
    desktopLocal()!.use('/Users/me/site')
    const site = getLocalWorkspaces().find((w) => w.path === '/Users/me/site')!
    expect(site.lastOpenedAt).toBeGreaterThan(300)
  })
})
