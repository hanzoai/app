/**
 * Local file system support for Hanzo Desktop & modern browsers.
 *
 * Allows users to:
 * 1. Open and track local folders/workspaces on their machine.
 * 2. Browse files and subdirectories.
 * 3. Create new files and folders.
 * 4. Read, view, and edit local files with real-time saving.
 * 5. Run local coding tasks against the workspace with `hanzoai/dev`.
 *
 * Dev's This computer is `desktopLocal()` (hanzo-inc/app issues 309 and 310): on Hanzo Desktop it hands @hanzo/build
 * the folders opened here and the project folders the desktop finds on the computer, the window's folder dialog and
 * the `dev` runner, so a run works in a folder with no repository. Auto there is the folder the ask is about, else
 * the one used most recently (`lastOpenedAt`), as @hanzo/build's `route` reads them. Its hostname (`host`) is how
 * Settings → Machines finds this computer's own machine, to share a folder of it with the web (hanzo-inc/app issue 310).
 * A browser page has no folder of its own, and gets none.
 */
import type { Folder, Local } from '@hanzo/dev/builder'

export interface LocalWorkspace {
  id: string
  name: string
  path: string
  addedAt: number
  lastOpenedAt: number
}

export interface LocalEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  lastModified?: number
}

const WORKSPACES_KEY = 'hanzo.local_workspaces'
const ACTIVE_WORKSPACE_KEY = 'hanzo.active_workspace'

const listeners = new Set<() => void>()
function notify() {
  for (const l of listeners) l()
}

export function subscribeLocalFs(l: () => void): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** Check if running inside the Tauri native desktop app */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && Boolean(
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ||
    (window as unknown as { __TAURI__?: unknown }).__TAURI__
  )
}

/** Invoke a Tauri IPC command safely */
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const win = window as unknown as {
    __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<T> }
    __TAURI__?: { core?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<T> } }
  }
  const invoke = win.__TAURI_INTERNALS__?.invoke || win.__TAURI__?.core?.invoke
  if (!invoke) throw new Error('Tauri IPC is not available')
  return invoke(cmd, args)
}

/** Get all registered local workspaces */
export function getLocalWorkspaces(): LocalWorkspace[] {
  try {
    const raw = window.localStorage.getItem(WORKSPACES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Get active local workspace */
export function getActiveWorkspace(): LocalWorkspace | null {
  try {
    const id = window.localStorage.getItem(ACTIVE_WORKSPACE_KEY)
    const list = getLocalWorkspaces()
    if (!id) return list[0] ?? null
    return list.find((w) => w.id === id || w.path === id) ?? list[0] ?? null
  } catch {
    return null
  }
}

/** Set active local workspace */
export function setActiveWorkspace(ws: LocalWorkspace | null): void {
  try {
    if (ws) {
      window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, ws.id)
      const list = getLocalWorkspaces().map((w) => (w.id === ws.id ? { ...w, lastOpenedAt: Date.now() } : w))
      window.localStorage.setItem(WORKSPACES_KEY, JSON.stringify(list))
    } else {
      window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
    }
  } catch {
    /* ignore storage errors */
  }
  notify()
}

/** Add a local workspace */
export function addLocalWorkspace(path: string, name?: string): LocalWorkspace {
  const cleanPath = path.trim().replace(/\/+$/, '')
  const folderName = name?.trim() || cleanPath.split(/[/\\]/).pop() || 'workspace'
  const list = getLocalWorkspaces()
  const existing = list.find((w) => w.path === cleanPath)
  if (existing) {
    setActiveWorkspace(existing)
    return existing
  }
  const ws: LocalWorkspace = {
    id: `ws_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: folderName,
    path: cleanPath,
    addedAt: Date.now(),
    lastOpenedAt: Date.now(),
  }
  try {
    window.localStorage.setItem(WORKSPACES_KEY, JSON.stringify([ws, ...list]))
    window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, ws.id)
  } catch {
    /* ignore storage errors */
  }
  notify()
  return ws
}

/** Remove a local workspace */
export function removeLocalWorkspace(idOrPath: string): void {
  const list = getLocalWorkspaces().filter((w) => w.id !== idOrPath && w.path !== idOrPath)
  try {
    window.localStorage.setItem(WORKSPACES_KEY, JSON.stringify(list))
    const current = window.localStorage.getItem(ACTIVE_WORKSPACE_KEY)
    if (current === idOrPath) {
      if (list[0]) window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, list[0].id)
      else window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
    }
  } catch {
    /* ignore storage errors */
  }
  notify()
}

/**
 * Open native dialog to pick a local folder. `browser: false` takes only the window's own dialog: the browser's
 * directory picker names a folder without its path, which a run cannot work in.
 */
export async function pickLocalFolder({ browser = true }: { browser?: boolean } = {}): Promise<LocalWorkspace | null> {
  if (isTauri()) {
    try {
      const selected = await tauriInvoke<string | null>('local_workspace_open_dialog')
      if (selected && typeof selected === 'string') {
        return addLocalWorkspace(selected)
      }
    } catch (e) {
      console.warn('local_workspace_open_dialog failed, falling back:', e)
    }
  }

  // Browser File System Access API
  if (browser && typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    try {
      const picker = (window as unknown as { showDirectoryPicker: () => Promise<{ name: string }> }).showDirectoryPicker
      const handle = await picker()
      if (handle?.name) {
        return addLocalWorkspace(`/${handle.name}`, handle.name)
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return null
      console.warn('showDirectoryPicker failed:', e)
    }
  }

  return null
}

/** Open native dialog to pick a local file to view or edit */
export async function pickLocalFile(): Promise<string | null> {
  if (isTauri()) {
    try {
      const selected = await tauriInvoke<string | null>('local_workspace_open_file_dialog')
      if (selected && typeof selected === 'string') {
        return selected
      }
    } catch (e) {
      console.warn('local_workspace_open_file_dialog failed:', e)
    }
  }
  return null
}

/** Clone a remote repository to local machine and register as a workspace */
export async function cloneRemoteRepo(repo: string, targetDir?: string): Promise<LocalWorkspace> {
  if (isTauri()) {
    const res = await tauriInvoke<{ name: string; path: string }>('local_workspace_clone_repo', {
      repo,
      targetDir,
    })
    return addLocalWorkspace(res.path, res.name)
  }
  throw new Error('Cloning remote repositories locally requires Hanzo Desktop')
}

/** Import an existing local file into the active workspace directory */
export async function importLocalFile(sourcePath: string, targetDir: string): Promise<LocalEntry> {
  if (isTauri()) {
    return await tauriInvoke<LocalEntry>('local_workspace_import_file', {
      sourcePath,
      targetDir,
    })
  }
  throw new Error('Importing files requires Hanzo Desktop')
}

/** List entries in a local directory */
export async function listLocalEntries(dirPath: string): Promise<LocalEntry[]> {
  if (isTauri()) {
    try {
      return await tauriInvoke<LocalEntry[]>('local_workspace_list', { dirPath })
    } catch (e) {
      console.warn('local_workspace_list failed:', e)
    }
  }
  return []
}

/** Read text content of a local file */
export async function readLocalFile(filePath: string): Promise<string> {
  if (isTauri()) {
    return await tauriInvoke<string>('local_workspace_read_file', { filePath })
  }
  throw new Error('Local file reading requires Hanzo Desktop')
}

/** Write text content to a local file */
export async function writeLocalFile(filePath: string, content: string): Promise<void> {
  if (isTauri()) {
    await tauriInvoke<void>('local_workspace_write_file', { filePath, content })
    return
  }
  throw new Error('Local file writing requires Hanzo Desktop')
}

/** Create a new empty file */
export async function createLocalFile(dirPath: string, name: string, content = ''): Promise<string> {
  const separator = dirPath.includes('\\') ? '\\' : '/'
  const filePath = `${dirPath.replace(/[/\\]+$/, '')}${separator}${name.trim()}`
  if (isTauri()) {
    await tauriInvoke<void>('local_workspace_create_file', { filePath, content })
    return filePath
  }
  throw new Error('Local file creation requires Hanzo Desktop')
}

/** Create a new local directory */
export async function createLocalDir(dirPath: string, name: string): Promise<string> {
  const separator = dirPath.includes('\\') ? '\\' : '/'
  const newDirPath = `${dirPath.replace(/[/\\]+$/, '')}${separator}${name.trim()}`
  if (isTauri()) {
    await tauriInvoke<void>('local_workspace_create_dir', { dirPath: newDirPath })
    return newDirPath
  }
  throw new Error('Local folder creation requires Hanzo Desktop')
}

/** Delete a local file or directory */
export async function deleteLocalPath(path: string): Promise<void> {
  if (isTauri()) {
    await tauriInvoke<void>('local_workspace_delete', { path })
    return
  }
  throw new Error('Local deletion requires Hanzo Desktop')
}

/**
 * Run local coding task with `dev` CLI. Hanzo Desktop answers `{session_id, output, process, success}` (its Rust struct's own
 * names): `output` is the agent's final message, `process` what it did on the way. `ok` is false only when it said the agent
 * failed. The desktop fetches the agent itself when the computer has none.
 */
export async function runLocalDev(workspacePath: string, prompt: string): Promise<{ sessionId: string; output?: string; process?: string; ok: boolean }> {
  if (isTauri()) {
    const r = await tauriInvoke<{ sessionId?: string; session_id?: string; output?: string; process?: string; success?: boolean }>('local_workspace_run_dev', {
      workspacePath,
      prompt,
    })
    return { sessionId: r?.sessionId ?? r?.session_id ?? '', output: r?.output, process: r?.process, ok: r?.success !== false }
  }
  throw new Error('Local Dev agent execution requires Hanzo Desktop')
}

/** A project folder the desktop found on the computer, as `local_workspace_discover` answers it. */
interface Found {
  name: string
  path: string
  modified: number
}

/**
 * Listen to an event Hanzo Desktop emits, through the window's own IPC (what `@tauri-apps/api/event`'s `listen` does,
 * without the package). Answers how to stop listening; a window without the event plugin hears nothing.
 */
async function tauriListen<T>(event: string, handler: (payload: T) => void): Promise<() => void> {
  const win = window as unknown as {
    __TAURI_INTERNALS__?: { transformCallback?: (cb: (e: { payload: T }) => void) => number; invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> }
    __TAURI_EVENT_PLUGIN_INTERNALS__?: { unregisterListener?: (event: string, id: number) => void }
  }
  const internals = win.__TAURI_INTERNALS__
  if (!internals?.transformCallback) return () => {}
  const id = (await internals.invoke('plugin:event|listen', {
    event,
    target: { kind: 'Any' },
    handler: internals.transformCallback((e) => handler(e.payload)),
  })) as number
  return () => {
    win.__TAURI_EVENT_PLUGIN_INTERNALS__?.unregisterListener?.(event, id)
    void internals.invoke('plugin:event|unlisten', { event, eventId: id }).catch(() => {})
  }
}

/** The event the desktop emits while it fetches Hanzo Dev for a computer that has none: `{ percent }`, 0 to 100. */
const SETUP_EVENT = 'local-dev-setup'

/** A workspace as Dev's Folder pill reads it. */
const folderOf = (w: LocalWorkspace): Folder => ({ path: w.path, name: w.name, used: w.lastOpenedAt || w.addedAt || 0 })

/**
 * This computer, as @hanzo/build's Dev takes it (`Host.local`): the folders Hanzo Desktop opened and the project folders it
 * finds on the computer (asked once, when this is made, and announced through `changed` when they arrive), its folder
 * dialog, and a run of the `dev` agent in one folder (`dev exec -C <folder>`, its workspace-write sandbox). Null outside
 * the desktop window, so a browser page offers the cloud workspace and the org's machines only.
 */
export function desktopLocal(): Local | null {
  if (!isTauri()) return null
  let found: Folder[] = []
  tauriInvoke<Found[] | null>('local_workspace_discover').then(
    (list) => {
      found = (Array.isArray(list) ? list : []).filter((f) => f && typeof f.path === 'string' && f.path).map((f) => ({ path: f.path, name: f.name || f.path.split(/[/\\]/).filter(Boolean).pop() || f.path }))
      if (found.length) notify()
    },
    () => {
      // A desktop that cannot look offers the folders it opened, as before.
    },
  )
  return {
    folders: () => {
      const opened = getLocalWorkspaces().map(folderOf)
      const known = new Set(opened.map((f) => f.path))
      return [...opened, ...found.filter((f) => !known.has(f.path))]
    },
    changed: subscribeLocalFs,
    pick: async () => {
      const ws = await pickLocalFolder({ browser: false })
      return ws ? folderOf(ws) : null
    },
    use: (path) => {
      const ws = getLocalWorkspaces().find((w) => w.path === path)
      if (ws) setActiveWorkspace(ws)
      else addLocalWorkspace(path)
    },
    // The name `hanzo link` registers this computer under: the OS hostname, from the window's os plugin.
    host: async () => (await tauriInvoke<string | null>('plugin:os|hostname')) ?? '',
    // Stops the agent being fetched for the first run; the run's own call then answers `Setup was cancelled.` (@hanzo/build `failed`).
    cancel: async () => {
      await tauriInvoke<boolean>('local_dev_setup_cancel')
    },
    run: async (folder, prompt, setup) => {
      const stop = setup ? await tauriListen<{ percent: number }>(SETUP_EVENT, (p) => setup(p.percent)).catch(() => () => {}) : () => {}
      try {
        const r = await runLocalDev(folder, prompt)
        return { ok: r.ok, output: r.output ?? '', process: r.process ?? '' }
      } finally {
        stop()
      }
    },
  }
}
