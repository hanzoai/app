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

import { EFFORT_STEPS } from './ThinkingEffort'

describe('thinking effort', () => {
  test('defines 4 standard discrete effort steps starting with auto', () => {
    expect(EFFORT_STEPS.length).toBe(4)
    expect(EFFORT_STEPS[0].id).toBe('auto')
    expect(EFFORT_STEPS[1].id).toBe('low')
    expect(EFFORT_STEPS[2].id).toBe('medium')
    expect(EFFORT_STEPS[3].id).toBe('high')
  })

  test('provides descriptions for all effort steps', () => {
    for (const step of EFFORT_STEPS) {
      expect(step.label.length).toBeGreaterThan(0)
      expect(step.note.length).toBeGreaterThan(0)
    }
  })
})
