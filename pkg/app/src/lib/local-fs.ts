/**
 * Local file system support for Hanzo Desktop & modern browsers.
 *
 * Allows users to:
 * 1. Open and track local folders/workspaces on their machine.
 * 2. Browse files and subdirectories.
 * 3. Create new files and folders.
 * 4. Read, view, and edit local files with real-time saving.
 * 5. Run local coding tasks against the workspace with `hanzoai/dev`.
 */

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

/** Open native dialog to pick a local folder */
export async function pickLocalFolder(): Promise<LocalWorkspace | null> {
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
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
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

/** Run local coding task with `dev` CLI */
export async function runLocalDev(workspacePath: string, prompt: string): Promise<{ sessionId: string; output?: string }> {
  if (isTauri()) {
    return await tauriInvoke<{ sessionId: string; output?: string }>('local_workspace_run_dev', {
      workspacePath,
      prompt,
    })
  }
  throw new Error('Local Dev agent execution requires Hanzo Desktop')
}
