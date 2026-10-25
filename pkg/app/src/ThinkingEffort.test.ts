// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/ui', () => ({
  Box: () => null,
  Popover: () => null,
  PopoverTrigger: () => null,
  PopoverContent: () => null,
  Text: () => null,
  XStack: () => null,
  YStack: () => null,
}))

vi.mock('@hanzo/i18n/react', () => ({
  useI18n: () => ({ t: (s: string) => s }),
}))

import { DEFAULT_EFFORT, EFFORT_STEPS } from './ThinkingEffort'

describe('thinking effort', () => {
  test('defines 6 discrete effort steps with high as default', () => {
    expect(DEFAULT_EFFORT).toBe('high')
    expect(EFFORT_STEPS.map((s) => s.id)).toEqual(['auto', 'low', 'medium', 'high', 'xhigh', 'max'])
  })

  test('provides descriptions for all effort steps', () => {
    for (const step of EFFORT_STEPS) {
      expect(step.label.length).toBeGreaterThan(0)
      expect(step.note.length).toBeGreaterThan(0)
    }
  })
})
