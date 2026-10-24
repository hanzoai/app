import { describe, expect, it } from 'vitest'
import { detectPlatform, PLATFORM_PROFILES } from './platform'
import { BUILTIN_MODS, exportMod, forkMod, importMod } from './theme'

describe('mod system', () => {
  it('detects platforms accurately from user agents', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')).toBe('android')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')).toBe('macos')
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')).toBe('windows')
    expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36')).toBe('linux')
  })

  it('provides platform profiles with correct typography and radius', () => {
    expect(PLATFORM_PROFILES.ios.radiusCard).toBe(22)
    expect(PLATFORM_PROFILES.ios.glassBlur).toBe(24)
    expect(PLATFORM_PROFILES.android.radiusCard).toBe(16)
    expect(PLATFORM_PROFILES.windows.radiusCard).toBe(8)
  })

  it('serializes and deserializes mods cleanly', () => {
    const base = BUILTIN_MODS[0]
    const json = exportMod(base)
    const imported = importMod(json)
    expect(imported.name).toBe(base.name)
    expect(imported.platform).toBe(base.platform)
  })

  it('forks mods with custom designer overrides', () => {
    const base = BUILTIN_MODS[0]
    const forked = forkMod(base, {
      name: 'Acme Brand Theme',
      primary: '#10b981',
      fontHeading: 'Cabinet Grotesk',
    })
    expect(forked.name).toBe('Acme Brand Theme')
    expect(forked.primary).toBe('#10b981')
    expect(forked.fontHeading).toBe('Cabinet Grotesk')
    expect(forked.platform).toBe('ios')
  })
})
