import { describe, expect, it, vi } from 'vitest'

vi.mock('@hanzo/iam/react', () => ({ useIam: () => ({}) }))

const { served } = await import('./ai')

const ids = (...xs: string[]) => xs.map((id) => ({ id }))

describe('served', () => {
  it('answers on the model asked for when the gateway serves it', () => {
    expect(served(ids('enso-auto', 'openrouter/auto'), 'openrouter/auto')).toBe('openrouter/auto')
    expect(served(ids('enso-auto', 'zen6'), 'zen6')).toBe('zen6')
  })

  it('never relabels an id the gateway does not serve as ours', () => {
    expect(served(ids('enso-auto'), 'openrouter/auto')).toBe('enso-auto')
    expect(served(ids('gpt-x'), 'openrouter/auto')).toBe('gpt-x')
  })

  it('answers a free turn on the free pool', () => {
    expect(served(ids('enso-auto', 'enso-free', 'other:free'), 'free')).toBe('enso-free')
    expect(served(ids('enso-auto', 'zen-free'), 'enso-free')).toBe('zen-free')
    expect(served(ids('enso-auto'), 'enso-free')).toBe('enso-free')
  })

  it('falls to a house router, then the first model served', () => {
    expect(served(ids('a', 'zen'), 'gone')).toBe('zen')
    expect(served(ids('a', 'enso-pro'), 'gone')).toBe('enso-pro')
    expect(served(ids('a', 'b'), 'gone')).toBe('a')
    expect(served([], '')).toBe('enso-auto')
  })
})
