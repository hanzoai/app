import { afterEach, describe, expect, test, vi } from 'vitest'
import { configure } from '../where'
import { bearer, live, renew } from './session'

/** A Storage held in a map. */
function memory(seed: Record<string, string> = {}): Storage {
  const held = new Map(Object.entries(seed))
  return {
    get length() {
      return held.size
    },
    key: (i: number) => [...held.keys()][i] ?? null,
    getItem: (k: string) => held.get(k) ?? null,
    setItem: (k: string, v: string) => void held.set(k, String(v)),
    removeItem: (k: string) => void held.delete(k),
    clear: () => held.clear(),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  configure({ session: undefined })
})

describe('the session is read where the host keeps it', () => {
  test('a page keeps it in localStorage', () => {
    vi.stubGlobal('window', { localStorage: memory({ hanzo_iam_access_token: 'page', hanzo_iam_expires_at: String(Date.now() + 60_000) }) })
    expect(bearer()).toBe('page')
    expect(live()).toBe(true)
  })

  test('a host with a store of its own (the desktop keychain) is read there, and never from localStorage', () => {
    const keychain = memory({ hanzo_iam_access_token: 'keychain', hanzo_iam_expires_at: String(Date.now() + 60_000) })
    vi.stubGlobal('window', { localStorage: memory({ hanzo_iam_access_token: 'stale' }) })
    configure({ session: keychain })
    expect(bearer()).toBe('keychain')
    expect(live()).toBe(true)
    renew()
    expect(keychain.getItem('hanzo_iam_expires_at')).toBe('0')
    expect(live()).toBe(false)
  })
})
