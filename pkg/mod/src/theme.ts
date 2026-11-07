import { PLATFORM_PROFILES, type PlatformId, applyPlatformTokens, clearPlatformTokens } from './platform'

export interface ModTheme {
  id: string
  name: string
  description?: string
  author?: string
  org?: string
  platform?: PlatformId
  theme?: 'light' | 'dark' | 'system'
  background?: string
  surface?: string
  foreground?: string
  fontHeading?: string
  fontBody?: string
  fontMono?: string
  customFontUrl?: string
  primary?: string
  accent?: string
  glassTint?: string
  glassBlur?: number
  radius?: number
  density?: 'compact' | 'comfortable' | 'default'
  customCss?: string
}

export const BUILTIN_MODS: ModTheme[] = [
  {
    id: 'ios-liquid',
    name: 'Apple iOS Liquid',
    description: 'Continuous squircles, high-specular liquid glass, and Apple SF Pro typography.',
    author: 'Hanzo Design',
    platform: 'ios',
    theme: 'dark',
    background: '#000000',
    glassBlur: 24,
    radius: 22,
    density: 'comfortable',
  },
  {
    id: 'android-material',
    name: 'Android Material 3',
    description: 'Google Material 3 tonal elevations, Roboto Sans, and smooth dynamic rounded cards.',
    author: 'Hanzo Design',
    platform: 'android',
    theme: 'dark',
    background: '#0b0e14',
    glassBlur: 16,
    radius: 16,
    density: 'default',
  },
  {
    id: 'macos-vibrant',
    name: 'macOS Vibrant',
    description: 'Translucent sidebars, vibrant visual effect filters, and clean desktop density.',
    author: 'Hanzo Design',
    platform: 'macos',
    theme: 'dark',
    background: '#09090b',
    glassBlur: 20,
    radius: 12,
    density: 'compact',
  },
  {
    id: 'windows-fluent',
    name: 'Windows Mica Fluent',
    description: 'Microsoft Fluent Design Mica acrylic and Segoe UI Variable geometry.',
    author: 'Hanzo Design',
    platform: 'windows',
    theme: 'dark',
    background: '#0a0d12',
    glassBlur: 18,
    radius: 8,
    density: 'default',
  },
  {
    id: 'cyber-zen',
    name: 'Cyber Zen (OLED)',
    description: 'High contrast deep OLED black with electric cyan and magenta accents.',
    author: 'Hanzo Labs',
    platform: 'ios',
    theme: 'dark',
    background: '#000000',
    primary: '#00f0ff',
    accent: '#ff007f',
    glassBlur: 28,
    radius: 20,
    density: 'comfortable',
  },
  {
    id: 'nordic-frost',
    name: 'Nordic Frost',
    description: 'Pure arctic monochrome glass, high clarity, and minimalist typography.',
    author: 'Hanzo Design',
    platform: 'macos',
    theme: 'dark',
    background: '#090d16',
    primary: '#e2e8f0',
    accent: '#38bdf8',
    glassBlur: 22,
    radius: 14,
    density: 'default',
  },
  {
    id: 'studio-light',
    name: 'Studio Paper (Light)',
    description: 'Warm editorial paper ground, crisp ink typography, and subtle daylight glass.',
    author: 'Hanzo Design',
    platform: 'macos',
    theme: 'light',
    background: '#faf8f5',
    primary: '#18181b',
    accent: '#2563eb',
    glassBlur: 16,
    radius: 12,
    density: 'default',
  },
]

const ORG_MOD_KEY = (orgId: string) => `hanzo.mod.org.${orgId}`
const ACTIVE_MOD_KEY = 'hanzo.mod.active'

/** Serializes a theme mod to JSON for exporting/sharing */
export function exportMod(mod: ModTheme): string {
  return JSON.stringify(mod, null, 2)
}

/** Parses and validates an imported mod JSON string */
export function importMod(json: string): ModTheme {
  const parsed = JSON.parse(json) as Partial<ModTheme>
  if (!parsed || typeof parsed !== 'object' || !parsed.name) {
    throw new Error('Invalid Hanzo mod: missing theme name')
  }
  return {
    id: parsed.id || `mod-${Date.now()}`,
    name: String(parsed.name).slice(0, 64),
    description: parsed.description ? String(parsed.description).slice(0, 256) : undefined,
    author: parsed.author ? String(parsed.author).slice(0, 64) : undefined,
    org: parsed.org,
    platform: parsed.platform && parsed.platform in PLATFORM_PROFILES ? parsed.platform : undefined,
    theme: parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system' ? parsed.theme : undefined,
    background: parsed.background,
    surface: parsed.surface,
    foreground: parsed.foreground,
    fontHeading: parsed.fontHeading,
    fontBody: parsed.fontBody,
    fontMono: parsed.fontMono,
    customFontUrl: parsed.customFontUrl,
    primary: parsed.primary,
    accent: parsed.accent,
    glassTint: parsed.glassTint,
    glassBlur: typeof parsed.glassBlur === 'number' ? parsed.glassBlur : undefined,
    radius: typeof parsed.radius === 'number' ? parsed.radius : undefined,
    density: parsed.density,
    customCss: parsed.customCss,
  }
}

/** Creates a new mod derived from an existing base theme */
export function forkMod(base: ModTheme, overrides: Partial<ModTheme>): ModTheme {
  return {
    ...base,
    ...overrides,
    id: overrides.id || `${base.id}-fork-${Date.now().toString(36)}`,
    name: overrides.name || `${base.name} (Mod)`,
  }
}

function modGroundInk(c: string): string {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(c.trim())
  if (!m) return '#fafafa'
  const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1].slice(0, 6)
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#09090b' : '#fafafa'
}

const MOD_CSS_VARS = [
  '--background',
  '--foreground',
  '--text-primary',
  '--card',
  '--surface-card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--muted',
  '--secondary',
  '--secondary-hover',
  '--secondary-foreground',
  '--pane-floor',
  '--pane-fill',
  '--composer-fill',
  '--composer-ground',
  '--primary',
  '--primary-foreground',
  '--primary-hover',
  '--accent',
  '--accent-foreground',
  '--accent-hover',
  '--ring',
  '--liquid-glass-bg',
  '--glass-blur',
  '--chrome-blur',
  '--pane-blur',
  '--radius',
  '--pane-round',
  '--radius-scale',
  '--density',
  '--font-heading',
  '--font-display',
  '--font-body',
  '--font-sans',
  '--font-mono',
] as const

/** Applies a theme mod dynamically to the page */
export function applyMod(mod: ModTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  for (const prop of MOD_CSS_VARS) {
    root.style.removeProperty(prop)
  }

  if (mod.platform) {
    applyPlatformTokens(mod.platform)
  }

  const effectiveTheme =
    mod.theme ??
    (mod.background ? (modGroundInk(mod.background) === '#09090b' ? 'light' : 'dark') : undefined)

  if (effectiveTheme) {
    const night =
      effectiveTheme === 'dark' ||
      (effectiveTheme === 'system' && typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches)
    root.classList.toggle('light', !night)
    root.classList.toggle('dark', night)
    root.classList.toggle('t_light', !night)
    root.classList.toggle('t_dark', night)
    root.style.colorScheme = night ? 'dark' : 'light'
    root.setAttribute('data-scheme', effectiveTheme)
  }

  if (mod.background) {
    const bg = mod.background.trim()
    const fg = mod.foreground?.trim() || modGroundInk(bg)
    const isLight = fg === '#09090b'
    const mixTarget = isLight ? 'black' : 'white'
    const surface = mod.surface?.trim() || `color-mix(in oklch, ${bg} 95%, ${mixTarget})`
    root.style.setProperty('--background', bg)
    root.style.setProperty('--foreground', fg)
    root.style.setProperty('--text-primary', fg)
    root.style.setProperty('--card', surface)
    root.style.setProperty('--surface-card', surface)
    root.style.setProperty('--card-foreground', fg)
    root.style.setProperty('--popover', `color-mix(in oklch, ${bg} 92%, ${mixTarget})`)
    root.style.setProperty('--popover-foreground', fg)
    root.style.setProperty('--muted', `color-mix(in oklch, ${bg} 92%, ${mixTarget})`)
    root.style.setProperty('--secondary', `color-mix(in oklch, ${bg} 90%, ${mixTarget})`)
    root.style.setProperty('--secondary-hover', `color-mix(in oklch, ${bg} 84%, ${mixTarget})`)
    root.style.setProperty('--secondary-foreground', fg)
    root.style.setProperty('--pane-floor', `color-mix(in oklch, ${bg} 95%, black)`)
    root.style.setProperty('--pane-fill', `color-mix(in oklch, ${bg} 97%, ${mixTarget})`)
    root.style.setProperty('--composer-fill', `color-mix(in oklch, ${bg} 90%, ${mixTarget})`)
    root.style.setProperty('--composer-ground', `color-mix(in oklch, ${bg} 90%, ${mixTarget})`)
  }

  const accent = mod.accent || mod.primary
  if (accent) {
    const fg = modGroundInk(accent)
    const hover = `color-mix(in oklch, ${accent} 88%, white)`
    root.style.setProperty('--primary', mod.primary || accent)
    root.style.setProperty('--primary-foreground', fg)
    root.style.setProperty('--primary-hover', hover)
    root.style.setProperty('--accent', accent)
    root.style.setProperty('--accent-foreground', fg)
    root.style.setProperty('--accent-hover', hover)
    root.style.setProperty('--ring', accent)
  }
  if (mod.glassTint) root.style.setProperty('--liquid-glass-bg', mod.glassTint)
  if (typeof mod.glassBlur === 'number') {
    root.style.setProperty('--glass-blur', `${mod.glassBlur}px`)
    root.style.setProperty('--chrome-blur', `${mod.glassBlur}px`)
    root.style.setProperty('--pane-blur', `${Math.round(mod.glassBlur * 1.5)}px`)
  }
  if (typeof mod.radius === 'number') {
    root.style.setProperty('--radius', `${mod.radius}px`)
    root.style.setProperty('--pane-round', `${mod.radius}px`)
    root.style.setProperty('--radius-scale', String(Math.round((mod.radius / 12) * 100) / 100))
  }
  if (mod.density) {
    const d = mod.density === 'compact' ? '0.85' : mod.density === 'comfortable' ? '1.15' : '1'
    root.style.setProperty('--density', d)
  }
  if (mod.fontHeading) {
    root.style.setProperty('--font-heading', mod.fontHeading)
    root.style.setProperty('--font-display', mod.fontHeading)
  }
  if (mod.fontBody) {
    root.style.setProperty('--font-body', mod.fontBody)
    root.style.setProperty('--font-sans', mod.fontBody)
  }
  if (mod.fontMono) root.style.setProperty('--font-mono', mod.fontMono)

  // Inject custom CSS if defined
  let styleEl = document.getElementById('hanzo-custom-mod-css')
  if (mod.customCss) {
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'hanzo-custom-mod-css'
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = mod.customCss
  } else if (styleEl) {
    styleEl.remove()
  }

  try {
    window.localStorage.setItem(ACTIVE_MOD_KEY, JSON.stringify(mod))
    window.dispatchEvent(new CustomEvent('hanzo:mod:applied', { detail: { mod } }))
  } catch {
    // ignore
  }
}

/** Restores and applies the persisted active mod (or org mod) if present */
export function restoreActiveMod(orgId?: string): ModTheme | null {
  if (typeof window === 'undefined') return null
  try {
    const raw =
      (orgId ? window.localStorage.getItem(ORG_MOD_KEY(orgId)) : null) ||
      window.localStorage.getItem(ACTIVE_MOD_KEY)
    if (!raw) return null
    const mod = JSON.parse(raw) as ModTheme
    if (mod && typeof mod === 'object' && mod.name) {
      applyMod(mod)
      return mod
    }
    return null
  } catch {
    return null
  }
}

/** Clears the active mod from localStorage and removes inline mod overrides */
export function clearActiveMod(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(ACTIVE_MOD_KEY)
    const styleEl = document.getElementById('hanzo-custom-mod-css')
    if (styleEl) styleEl.remove()
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      for (const prop of MOD_CSS_VARS) {
        root.style.removeProperty(prop)
      }
      clearPlatformTokens()
    }
    window.dispatchEvent(new CustomEvent('hanzo:mod:cleared'))
  } catch {
    // ignore
  }
}

/** Saves an organization-scoped mod configuration */
export function saveOrgMod(orgId: string, mod: ModTheme): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ORG_MOD_KEY(orgId), JSON.stringify({ ...mod, org: orgId }))
  } catch {
    // ignore
  }
}

/** Gets the active mod for an organization */
export function getOrgMod(orgId: string): ModTheme | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(ORG_MOD_KEY(orgId))
    return raw ? (JSON.parse(raw) as ModTheme) : null
  } catch {
    return null
  }
}
