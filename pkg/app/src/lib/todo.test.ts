import { afterEach, describe, expect, it, vi } from 'vitest'
import { open, targetOf } from './todo'

describe('targetOf', () => {
  it('goes to the card\'s own board first', () => {
    expect(targetOf('cloud', 'dev', ['hanzo'])).toBe('cloud')
  })
  it('on All boards goes to the first real board, never to "all"', () => {
    expect(targetOf('', 'all', ['hanzo', 'cloud'])).toBe('hanzo')
    expect(targetOf(undefined, 'all', [])).toBe('')
  })
  it('uses the board on screen when there is one', () => {
    expect(targetOf('', 'dev', ['hanzo'])).toBe('dev')
  })
})

describe('open', () => {
  afterEach(() => vi.unstubAllGlobals())
  const store = () => {
    const kept = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) } })
  }
  it('says a card is only on this device when the server did not take it', async () => {
    store()
    const client = { http: { json: async () => { throw new Error('down') } } }
    expect((await open(client as never, 'hanzo', { title: 'x' })).local).toBe(true)
  })
  it('does not say so for a card the server created', async () => {
    store()
    const client = { http: { json: async () => ({ id: 'srv-1', title: 'x' }) } }
    expect((await open(client as never, 'hanzo', { title: 'x' })).local).toBeUndefined()
  })
})
