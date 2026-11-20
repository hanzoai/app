import { useCallback, useSyncExternalStore } from 'react'

export const DEV_MODE_KEY = 'hanzo.dev_mode'
export const DEV_MODE_EVENT = 'hanzo:dev-mode'
export const SETTINGS_RETURN_KEY = 'hanzo.settings.return'

export function getDevMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(DEV_MODE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setDevMode(next: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DEV_MODE_KEY, next ? 'true' : 'false')
  } catch {}
  window.dispatchEvent(new CustomEvent(DEV_MODE_EVENT, { detail: { enabled: next } }))
}

function subscribeDevMode(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => onChange()
  const onStorage = (e: StorageEvent) => {
    if (e.key === DEV_MODE_KEY) onChange()
  }
  window.addEventListener(DEV_MODE_EVENT, handler)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(DEV_MODE_EVENT, handler)
    window.removeEventListener('storage', onStorage)
  }
}

export function useDevMode(): [boolean, (next: boolean) => void] {
  const enabled = useSyncExternalStore(subscribeDevMode, getDevMode, () => false)
  const update = useCallback((next: boolean) => setDevMode(next), [])
  return [enabled, update]
}

export interface DeviceLabelOptions {
  firstName?: string | null
  kind?: string | null
  os?: string | null
  devMode?: boolean
}

export function formatDeviceLabel(
  raw: string | null | undefined,
  opts: DeviceLabelOptions = {},
): { title: string; detail?: string } {
  const cleanRaw = (raw ?? '').trim()
  if (!cleanRaw) return { title: 'Cloud' }
  if (opts.devMode) return { title: cleanRaw }

  const lower = cleanRaw.toLowerCase()

  if (
    lower === 'hanzo sandbox' ||
    lower === 'sandbox' ||
    lower === 'cloud' ||
    /^cloud(-\d+)?(\b|\s|·)/.test(lower)
  ) {
    return {
      title: 'Auto (Cloud)',
      detail: cleanRaw === 'Cloud' ? 'Managed Hanzo cloud workspace' : cleanRaw,
    }
  }

  // Strip shell/tmux/hardware suffixes for the human-facing title while keeping full detail for tooltip
  const basePart = cleanRaw
    .split(/\s*·\s*/)[0]
    .replace(/\s*\((?:shell|desk|tmux|tty)[^)]*\)\s*$/i, '')
    .replace(/\.(local|lan|home|internal)$/i, '')
    .replace(/-\d+$/, '')
    .trim()

  if (
    /macbook|\b(imac|mac-studio|mac-mini|mac|laptop|desktop|workstation|localhost|local)\b/i.test(cleanRaw) ||
    opts.os === 'darwin' ||
    opts.kind === 'laptop' ||
    opts.kind === 'desktop' ||
    /^tgt_[a-z0-9]+$/i.test(basePart)
  ) {
    const title = 'Local - Device'
    return { title, detail: cleanRaw !== title ? cleanRaw : undefined }
  }

  const humanized = basePart
    .replace(/[-_]+/g, ' ')
    .trim()

  const title = humanized ? `Local - ${humanized}` : 'Local - Device'
  return { title, detail: cleanRaw !== title ? cleanRaw : undefined }
}

export function rememberSettingsReturn(path?: string): void {
  if (typeof window === 'undefined') return
  try {
    const target = path ?? `${window.location.pathname}${window.location.search}`
    if (target && !target.startsWith('/settings')) {
      window.sessionStorage.setItem(SETTINGS_RETURN_KEY, target)
    }
  } catch {}
}

export function readSettingsReturn(fallback = '/chat'): string {
  if (typeof window === 'undefined') return fallback
  try {
    const saved = window.sessionStorage.getItem(SETTINGS_RETURN_KEY)
    return saved && !saved.startsWith('/settings') ? saved : fallback
  } catch {
    return fallback
  }
}
