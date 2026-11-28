import { formatDeviceLabel as formatBuilt } from '@hanzo/dev/dev-mode'

// ONE DEVELOPER MODE. The switch, its key and the choice made once for a device
// that never made it (on where Tabs listed a terminal or a linked machine, or
// Dev's transcript asks for more; off for everyone else) are @hanzo/build's,
// which Dev reads too: a run's transcript folds its process into one plain line
// while it is off (hanzo-inc/app issues 317 and 321).
export { DEV_MODE_EVENT, DEV_MODE_KEY, getDevMode, setDevMode, useDevMode } from '@hanzo/dev/dev-mode'

export const SETTINGS_RETURN_KEY = 'hanzo.settings.return'

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
