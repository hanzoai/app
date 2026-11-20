import { afterEach, describe, expect, it, vi } from 'vitest'
import { home, open, projects, targetOf } from './todo'

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

describe('home', () => {
  const asked = (todo: unknown, dev: unknown) => ({
    http: { json: async ({ path }: { path: string }) => { if (path.includes('todo')) return todo; return dev } },
  }) as never
  it('is the first board the server names, never a stand-in', async () => {
    expect(await home(asked({ projects: [{ key: 'acme' }] }, []))).toBe('acme')
    expect((await projects(asked({ projects: [{ key: 'acme' }] }, [])))[0]!.key).toBe('hanzo')
  })
  it('is null when the server names none or cannot be asked', async () => {
    expect(await home(asked({ projects: [] }, []))).toBeNull()
    expect(await home({ http: { json: async () => { throw new Error('down') } } } as never)).toBeNull()
  })
})
