import { describe, expect, it } from 'vitest'
import { contextPercent } from './context'

describe('contextPercent', () => {
  it('reads against the model\'s own window, not a fixed 128k', () => {
    expect(contextPercent(400_000, 200_000)).toBe(50)
    expect(contextPercent(400_000, 1_000_000)).toBe(10)
  })
  it('has no meter for a model that names no window', () => {
    expect(contextPercent(400_000, undefined)).toBeNull()
    expect(contextPercent(400_000, 0)).toBeNull()
  })
  it('stops at 100', () => {
    expect(contextPercent(10_000_000, 1000)).toBe(100)
  })
})
