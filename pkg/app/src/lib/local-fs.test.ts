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

  it('runs the dev agent in the folder and reads the desktop’s own answer: what it said, and what it did', async () => {
    const invoke = vi.fn(async (cmd: string) =>
      cmd === 'local_workspace_run_dev' ? { session_id: 'local_1', output: 'Edited README.md', process: "exec bash -lc 'ls ~'", success: true } : null,
    )
    desktop(invoke)
    await expect(desktopLocal()!.run('/Users/me/api', 'Fix the typo')).resolves.toEqual({ ok: true, output: 'Edited README.md', process: "exec bash -lc 'ls ~'" })
    expect(invoke).toHaveBeenCalledWith('local_workspace_run_dev', { workspacePath: '/Users/me/api', prompt: 'Fix the typo' })
    await expect(runLocalDev('/Users/me/api', 'x')).resolves.toMatchObject({ sessionId: 'local_1', ok: true, process: "exec bash -lc 'ls ~'" })
  })

  it('says a run the agent failed is not ok, with what it printed', async () => {
    desktop(async (cmd) => (cmd === 'local_workspace_run_dev' ? { session_id: 'local_2', output: 'error: not signed in', success: false } : null))
    await expect(desktopLocal()!.run('/Users/me/api', 'x')).resolves.toEqual({ ok: false, output: 'error: not signed in', process: '' })
  })

  it('hears the desktop fetch the agent while a run waits, and stops listening once it is done', async () => {
    let heard: ((e: { payload: { percent: number } }) => void) | null = null
    const calls: string[] = []
    const invoke = vi.fn(async (cmd: string) => {
      calls.push(cmd)
      if (cmd === 'plugin:event|listen') return 7
      if (cmd === 'local_workspace_run_dev') {
        heard?.({ payload: { percent: 40 } })
        heard?.({ payload: { percent: 100 } })
        return { session_id: 'local_3', output: 'Done.', success: true }
      }
      return null
    })
    desktop(invoke)
    const internals = (globalThis as unknown as { window: { __TAURI_INTERNALS__: Record<string, unknown> } }).window.__TAURI_INTERNALS__
    internals.transformCallback = (cb: (e: { payload: { percent: number } }) => void) => {
      heard = cb
      return 1
    }
    const percents: number[] = []
    await desktopLocal()!.run('/Users/me/api', 'x', (p) => percents.push(p))
    expect(percents).toEqual([40, 100])
    expect(invoke).toHaveBeenCalledWith('plugin:event|listen', expect.objectContaining({ event: 'local-dev-setup' }))
    expect(invoke).toHaveBeenCalledWith('plugin:event|unlisten', { event: 'local-dev-setup', eventId: 7 })
    expect(calls.indexOf('plugin:event|listen')).toBeLessThan(calls.indexOf('local_workspace_run_dev'))
  })

  it('runs without listening in a window that has no event plugin', async () => {
    const invoke = vi.fn(async (cmd: string) => (cmd === 'local_workspace_run_dev' ? { session_id: 'local_4', output: 'Done.', success: true } : null))
    desktop(invoke)
    await expect(desktopLocal()!.run('/Users/me/api', 'x', () => {})).resolves.toMatchObject({ ok: true })
    expect(invoke).not.toHaveBeenCalledWith('plugin:event|listen', expect.anything())
  })

  it('adds the project folders the desktop finds, after the ones opened, and says when they arrive', async () => {
    desktop(
      async (cmd) =>
        cmd === 'local_workspace_discover'
          ? [
              { name: 'shop', path: '/Users/me/work/shop', modified: 900 },
              { name: 'site', path: '/Users/me/site', modified: 800 },
              { name: 'blog', path: '/Users/me/blog', modified: 700 },
            ]
          : null,
      { 'hanzo.local_workspaces': two },
    )
    const here = desktopLocal()!
    // Before the answer: only the ones opened.
    expect(here.folders().map((f) => f.name)).toEqual(['site', 'api'])
    const arrived = vi.fn()
    const stop = here.changed!(arrived)
    await vi.waitFor(() => expect(arrived).toHaveBeenCalled())
    // A folder found that was also opened is listed once, as opened; the rest follow in the order found.
    expect(here.folders()).toEqual([
      { path: '/Users/me/site', name: 'site', used: 100 },
      { path: '/Users/me/api', name: 'api', used: 300 },
      { path: '/Users/me/work/shop', name: 'shop' },
      { path: '/Users/me/blog', name: 'blog' },
    ])
    stop()
  })

  it('opens a folder that was only found, so the next run there is the one used last', async () => {
    desktop(async (cmd) => (cmd === 'local_workspace_discover' ? [{ name: 'shop', path: '/Users/me/work/shop', modified: 900 }] : null), { 'hanzo.local_workspaces': two })
    const here = desktopLocal()!
    await vi.waitFor(() => expect(here.folders().map((f) => f.name)).toContain('shop'))
    here.use('/Users/me/work/shop')
    expect(getLocalWorkspaces().map((w) => w.path)).toContain('/Users/me/work/shop')
    expect(here.folders().find((f) => f.name === 'shop')!.used).toBeGreaterThan(300)
  })

  it('offers only the folders it opened when the desktop cannot look', async () => {
    desktop(async (cmd) => {
      if (cmd === 'local_workspace_discover') throw new Error('Command not found')
      return null
    }, { 'hanzo.local_workspaces': two })
    const here = desktopLocal()!
    await Promise.resolve()
    expect(here.folders().map((f) => f.name)).toEqual(['site', 'api'])
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
