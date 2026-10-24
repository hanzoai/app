import { describe, expect, test } from 'vitest'
import { PLATFORM_PROFILES, type PlatformId } from './platform'

describe('@hanzo/mod platform profiles', () => {
  test('defines profiles for all major platforms', () => {
    const platforms: PlatformId[] = ['ios', 'android', 'macos', 'windows', 'linux']
    for (const p of platforms) {
      expect(PLATFORM_PROFILES[p]).toBeDefined()
      expect(PLATFORM_PROFILES[p].id).toBe(p)
      expect(PLATFORM_PROFILES[p].fontFamily).toBeDefined()
    }
  })
})
