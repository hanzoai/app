import { PLATFORM_PROFILES, type PlatformId, applyPlatformTokens } from './platform'

export interface ModTheme {
  id: string
  name: string
  description?: string
  author?: string
  org?: string
  platform?: PlatformId
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
    primary: '#e2e8f0',
    accent: '#38bdf8',
    glassBlur: 22,
    radius: 14,
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

/** Applies a theme mod dynamically to the page */
export function applyMod(mod: ModTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  if (mod.platform) {
    applyPlatformTokens(mod.platform)
  }

  if (mod.primary) root.style.setProperty('--primary', mod.primary)
  if (mod.accent) root.style.setProperty('--accent', mod.accent)
  if (mod.glassTint) root.style.setProperty('--liquid-glass-bg', mod.glassTint)
  if (typeof mod.glassBlur === 'number') root.style.setProperty('--glass-blur', `${mod.glassBlur}px`)
  if (typeof mod.radius === 'number') root.style.setProperty('--radius', `${mod.radius}px`)
  if (mod.fontHeading) root.style.setProperty('--font-heading', mod.fontHeading)
  if (mod.fontBody) root.style.setProperty('--font-body', mod.fontBody)
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
