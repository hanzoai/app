import { formatDeviceLabel as formatBuilt } from '@hanzo/build/dev-mode'
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
  /** Unused: a device is named from its own hostname now (@hanzo/build `friendly`), not the reader's name. */
  firstName?: string | null
  kind?: string | null
  os?: string | null
  devMode?: boolean
  /** The hardware it reported, kept for the detail. */
  hardware?: string | null
  /** The name the person gave it (@hanzo/build `useDeviceNames`). */
  name?: string | null
}

/**
 * A device as a person reads it: @hanzo/build's naming, the one Dev, Settings → Machines and Tabs draw
 * (`Alexs-MacBook-Pro.local` → "Alex's MacBook Pro", hardware and hostname in the detail; hanzo-inc/app issue 311).
 */
export function formatDeviceLabel(raw: string | null | undefined, opts: DeviceLabelOptions = {}): { title: string; detail?: string } {
  return formatBuilt(raw, { hardware: opts.hardware, name: opts.name, devMode: opts.devMode })
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
