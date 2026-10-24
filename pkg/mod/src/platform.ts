/**
 * Native OS platform detection and design system adaptors for Hanzo.
 *
 * Configures native look/feel tailored to the user's OS:
 * - iOS: Continuous squircles, Liquid Glass blurs, SF Pro fonts, safe area insets, specular highlights
 * - Android: Material 3 tokens, Roboto/Google Sans, tonal elevations, ripple curves
 * - macOS: Vibrant translucent glass, compact desktop paddings
 * - Windows: Fluent/Mica acrylic glass, sharp modern geometry
 * - Linux: Clean system lines, flat modern edges
 */

export type PlatformId = 'ios' | 'android' | 'macos' | 'windows' | 'linux'

export interface PlatformProfile {
  id: PlatformId
  name: string
  fontFamily: string
  fontMono: string
  radiusCard: number | string
  radiusPill: number | string
  glassBlur: number
  glassSaturate: number
  specularBorder: boolean
  touchFeedback: 'spring' | 'ripple' | 'subtle'
}

export const PLATFORM_PROFILES: Record<PlatformId, PlatformProfile> = {
  ios: {
    id: 'ios',
    name: 'Apple iOS',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
    fontMono: '"SF Mono", ui-monospace, Menlo, monospace',
    radiusCard: 22,
    radiusPill: 9999,
    glassBlur: 24,
    glassSaturate: 190,
    specularBorder: true,
    touchFeedback: 'spring',
  },
  android: {
    id: 'android',
    name: 'Google Android',
    fontFamily: 'Roboto, "Google Sans", system-ui, sans-serif',
    fontMono: '"Roboto Mono", monospace',
    radiusCard: 16,
    radiusPill: 16,
    glassBlur: 16,
    glassSaturate: 130,
    specularBorder: false,
    touchFeedback: 'ripple',
  },
  macos: {
    id: 'macos',
    name: 'Apple macOS',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    fontMono: '"SF Mono", Menlo, monospace',
    radiusCard: 12,
    radiusPill: 9999,
    glassBlur: 20,
    glassSaturate: 160,
    specularBorder: true,
    touchFeedback: 'subtle',
  },
  windows: {
    id: 'windows',
    name: 'Microsoft Windows',
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
    fontMono: '"Cascadia Code", Consolas, monospace',
    radiusCard: 8,
    radiusPill: 9999,
    glassBlur: 18,
    glassSaturate: 125,
    specularBorder: false,
    touchFeedback: 'subtle',
  },
  linux: {
    id: 'linux',
    name: 'Linux / Desktop',
    fontFamily: 'system-ui, -apple-system, "Cantarell", sans-serif',
    fontMono: '"Ubuntu Mono", monospace',
    radiusCard: 10,
    radiusPill: 9999,
    glassBlur: 14,
    glassSaturate: 110,
    specularBorder: false,
    touchFeedback: 'subtle',
  },
}

const STORAGE_KEY = 'hanzo.mod.platform'

/** Detects the current OS platform from user agent strings */
export function detectPlatform(userAgent?: string): PlatformId {
  const ua = (userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')).toLowerCase()
  if (/iphone|ipad|ipod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  if (/android/.test(ua)) return 'android'
  if (/macintosh|mac os x/.test(ua)) return 'macos'
  if (/windows|win32|win64/.test(ua)) return 'windows'
  if (/linux|x11/.test(ua)) return 'linux'
  return 'ios'
}

/** Reads the user's active platform preference (stored or detected) */
export function getActivePlatform(): PlatformId {
  if (typeof window === 'undefined') return 'ios'
  try {
    const kept = window.localStorage.getItem(STORAGE_KEY) as PlatformId | null
    if (kept && kept in PLATFORM_PROFILES) return kept
  } catch {
    // ignore storage restrictions
  }
  return detectPlatform()
}

/** Sets the user's preferred platform customization */
export function setActivePlatform(platform: PlatformId | 'auto'): void {
  if (typeof window === 'undefined') return
  try {
    if (platform === 'auto') {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, platform)
    }
  } catch {
    // ignore storage restrictions
  }
  applyPlatformTokens(platform === 'auto' ? detectPlatform() : platform)
  window.dispatchEvent(new CustomEvent('hanzo:mod:change', { detail: { platform } }))
}

/** Statically stamps the platform CSS custom properties onto documentElement */
export function applyPlatformTokens(platform: PlatformId): void {
  if (typeof document === 'undefined') return
  const profile = PLATFORM_PROFILES[platform] ?? PLATFORM_PROFILES.ios
  const root = document.documentElement

  root.setAttribute('data-platform', profile.id)
  root.style.setProperty('--platform-font-sans', profile.fontFamily)
  root.style.setProperty('--platform-font-mono', profile.fontMono)
  root.style.setProperty('--platform-radius-card', typeof profile.radiusCard === 'number' ? `${profile.radiusCard}px` : profile.radiusCard)
  root.style.setProperty('--platform-radius-pill', typeof profile.radiusPill === 'number' ? `${profile.radiusPill}px` : profile.radiusPill)
  root.style.setProperty('--glass-blur', `${profile.glassBlur}px`)
  root.style.setProperty('--glass-saturate', `${profile.glassSaturate}%`)
}
