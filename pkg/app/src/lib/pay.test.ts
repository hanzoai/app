import { describe, expect, test } from 'vitest'
import { money } from './pay'

describe('money', () => {
  test('English stays $20, and another locale writes its own', () => {
    expect(money(20)).toBe('$20')
    expect(money(16.67)).toBe('$16.67')
    expect(money(20, 'de-DE')).not.toBe('$20')
    expect(money(20, 'de-DE')).toContain('20')
  })
})
