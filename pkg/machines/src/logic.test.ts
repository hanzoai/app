import { describe, expect, test } from 'vitest'
import {
  ago, availability, choose, compact, dollars, heaviest, level, listed, money, ordered, percent, providers, resets, snapshotOf, snapshotsFor, tokens, total,
} from './logic'
import type { Account, Machine, Row, Usage } from './types'

const row = (key: string, i = 0, o = 0, c = 0, usd = 0): Row => ({ key, inputTokens: i, outputTokens: o, cacheTokens: c, costUsd: usd })
const src = (id: string, state: Machine['state'], last?: string, name = id, kind: Machine['kind'] = 'desktop'): Machine => ({
  id, kind, name, os: 'darwin', state, last_seen: last, linked_at: '2026-11-01T00:00:00Z', providers: [],
})

describe('totals', () => {
  test('sum every kind of token and the cost', () => {
    expect(total([row('a', 1, 2, 3, 0.5), row('b', 10, 20, 30, 1.25)])).toEqual(row('total', 11, 22, 33, 1.75))
    expect(total([])).toEqual(row('total'))
    expect(tokens(row('x', 1, 2, 3))).toBe(6)
  })
  test('heaviest first, ties by key, input untouched', () => {
    const rows = [row('b', 5), row('a', 5), row('c', 50)]
    expect(heaviest(rows).map((r) => r.key)).toEqual(['c', 'a', 'b'])
    expect(rows.map((r) => r.key)).toEqual(['b', 'a', 'c'])
  })
})

describe('formatting', () => {
  test('counts are compact', () => {
    expect([0, 950, 1000, 1234, 15_300, 999_999, 3_400_000, 1_100_000_000].map(compact)).toEqual(['0', '950', '1K', '1.2K', '15.3K', '1M', '3.4M', '1.1B'])
  })
  test('dollars: cents small, whole when large; money keeps the provider currency', () => {
    expect(dollars(1.5)).toBe('$1.50')
    expect(dollars(1234.56)).toBe('$1,235')
    expect(money(2, 'EUR', 'en-US')).toBe('€2.00')
    expect(money(2, 'nope!', 'en-US')).toBe('2 nope!')
  })
  test('percent is a whole number inside the bar', () => {
    expect([-4, 42.4, 99.6, 180, NaN].map(percent)).toEqual([0, 42, 100, 100, 0])
  })
  test('level marks the limits that are close', () => {
    expect([10, 74, 75, 89, 90, 100].map(level)).toEqual(['ok', 'ok', 'warn', 'warn', 'high', 'high'])
  })
  test('a reset is relative, and silent when unknown or past', () => {
    const now = new Date('2026-11-21T10:00:00Z')
    expect(resets('2026-11-21T10:45:00Z', now)).toBe('in 45m')
    expect(resets('2026-11-21T15:10:00Z', now)).toBe('in 5h')
    expect(resets('2026-11-24T10:00:00Z', now)).toBe('in 3d')
    expect(resets('2026-11-21T09:00:00Z', now)).toBe('')
    expect(resets(undefined, now)).toBe('')
    expect(resets('nope', now)).toBe('')
  })
  test('ago reads the largest unit', () => {
    const now = new Date('2026-11-21T10:00:00Z')
    expect(ago('2026-11-21T09:59:30Z', now)).toBe('now')
    expect(ago('2026-11-21T09:48:00Z', now)).toBe('12m')
    expect(ago('2026-11-21T07:00:00Z', now)).toBe('3h')
    expect(ago('2026-11-19T10:00:00Z', now)).toBe('2d')
    expect(ago('bad', now)).toBe('')
  })
})

describe('sources and snapshots', () => {
  test('online first, then the freshest heartbeat, revoked last', () => {
    const list = [
      src('r', 'revoked', '2026-11-21T09:00:00Z'),
      src('o1', 'offline', '2026-11-20T09:00:00Z'),
      src('on-old', 'online', '2026-11-21T08:00:00Z'),
      src('o2', 'offline', '2026-11-21T01:00:00Z'),
      src('on-new', 'online', '2026-11-21T09:59:00Z'),
    ]
    expect(ordered(list).map((s) => s.id)).toEqual(['on-new', 'on-old', 'o2', 'o1', 'r'])
  })
  const snap = (sourceId: string, provider: string, fetchedAt: string) => ({ sourceId, provider, fetchedAt, source: 'oauth', windows: [] })
  const usage: Usage = {
    rows: [row('claude', 100), row('codex', 900)],
    snapshots: [snap('a', 'claude', '2026-11-21T01:00:00Z'), snap('b', 'claude', '2026-11-21T02:00:00Z'), snap('a', 'gemini', '2026-11-21T01:00:00Z')],
  }
  test('a provider reads its snapshots, freshest first; an account its own source and provider', () => {
    expect(snapshotsFor(usage, 'claude').map((s) => s.sourceId)).toEqual(['b', 'a'])
    expect(snapshotsFor(usage, 'none')).toEqual([])
    expect(snapshotOf(usage, { provider: 'claude', sourceId: 'a' })?.fetchedAt).toBe('2026-11-21T01:00:00Z')
    expect(snapshotOf(usage, { provider: 'claude', sourceId: 'zzz' })).toBeUndefined()
  })
  test('providers come heaviest first, then those with only a snapshot', () => {
    expect(providers(usage)).toEqual(['codex', 'claude', 'gemini'])
  })
})

// One test per row of HIP-1350's availability table ("One view, one picker, four surfaces").
describe('availability', () => {
  const mac = src('mac', 'online', undefined, "Zed's Mac")
  const login = (over: Partial<Account> = {}): Account => ({
    id: 'a1', provider: 'claude', kind: 'login', classes: ['local', 'desktop'], sourceId: 'mac', instance: 'claude-1', state: 'ready', shared: true, ...over,
  })
  const key: Account = { id: 'k1', provider: 'anthropic', kind: 'key', label: 'work', classes: ['key'] }

  test('key: usable on every surface that runs sessions', () => {
    expect(availability(key, undefined, 'web')).toEqual({ usable: true })
    expect(availability(key, undefined, 'desktop')).toEqual({ usable: true })
  })
  test('key: extension says where it runs', () => {
    expect(availability(key, undefined, 'extension')).toEqual({ usable: false, reason: 'Runs from Hanzo Dev or hanzo.app' })
  })
  test('login on this very device: usable', () => {
    expect(availability(login({ shared: false, classes: ['local'] }), mac, 'desktop', 'mac')).toEqual({ usable: true })
  })
  test('login with desktop class, shared, source online: "Run on <device>" on a web surface', () => {
    expect(availability(login(), mac, 'web')).toEqual({ usable: true, reason: "Run on Zed's Mac" })
    expect(availability(login(), mac, 'desktop', 'other')).toEqual({ usable: true, reason: "Run on Zed's Mac" })
  })
  test('login with desktop class but Share off: "Turn on Share on <device>"', () => {
    expect(availability(login({ shared: false }), mac, 'web')).toEqual({ usable: false, reason: "Turn on Share on Zed's Mac" })
  })
  test('login with desktop class, shared, source offline: "<device> is offline"', () => {
    expect(availability(login(), src('mac', 'offline', undefined, "Zed's Mac"), 'web')).toEqual({ usable: false, reason: "Zed's Mac is offline" })
  })
  test('login with only local: stays on its device', () => {
    expect(availability(login({ classes: ['local'] }), mac, 'web')).toEqual({
      usable: false,
      reason: "Stays on Zed's Mac: its terms do not allow remote use",
    })
  })
  test('a login with no classes is local: fail closed', () => {
    expect(availability(login({ classes: [] }), mac, 'web').reason).toMatch(/^Stays on/)
  })
  test('browser login: never', () => {
    const chrome = src('chr', 'online', undefined, 'Chrome', 'browser')
    expect(availability(login({ sourceId: 'chr', classes: ['local'] }), chrome, 'web')).toEqual({ usable: false, reason: 'Browser accounts are view-only' })
    expect(availability(login({ sourceId: 'chr' }), chrome, 'extension', 'chr').reason).toBe('Browser accounts are view-only')
  })
  test('revoked or unknown source: unlinked, whatever else is true', () => {
    expect(availability(login(), src('mac', 'revoked', undefined, "Zed's Mac"), 'web')).toEqual({ usable: false, reason: "Zed's Mac was unlinked" })
    expect(availability(login(), undefined, 'web').reason).toBe('this device was unlinked')
    expect(availability(login(), src('mac', 'revoked', undefined, "Zed's Mac"), 'desktop', 'mac').usable).toBe(false)
  })
  test('a desktop login seen from the extension runs from Dev or hanzo.app', () => {
    expect(availability(login(), mac, 'extension', 'chr').reason).toBe('Runs from Hanzo Dev or hanzo.app')
  })
})

describe('choose', () => {
  const mac = src('mac', 'online', undefined, "Zed's Mac")
  const login: Account = { id: 'a1', provider: 'claude', kind: 'login', classes: ['desktop'], sourceId: 'mac', instance: 'claude-1', shared: true }
  const key: Account = { id: 'k1', provider: 'anthropic', kind: 'key', classes: ['key'] }
  test('a key is {via:"key", account}', () => {
    expect(choose(key, undefined, 'web')).toEqual({ via: 'key', account: 'k1' })
  })
  test('a desktop route is {via:"desktop", source, instance}', () => {
    expect(choose(login, mac, 'web')).toEqual({ via: 'desktop', source: 'mac', instance: 'claude-1' })
  })
  test('a login on this device has no route: the host runs it', () => {
    expect(choose(login, mac, 'desktop', 'mac')).toBeNull()
  })
  test('nothing is chosen from a greyed account', () => {
    expect(choose({ ...login, shared: false }, mac, 'web')).toBeNull()
    expect(choose(key, undefined, 'extension')).toBeNull()
  })
})

describe('listed', () => {
  test('usable accounts first, then provider and label', () => {
    const mac = src('mac', 'online')
    const accounts: Account[] = [
      { id: 'z', provider: 'codex', kind: 'login', classes: ['local'], sourceId: 'mac' },
      { id: 'b', provider: 'openai', kind: 'key', label: 'b', classes: ['key'] },
      { id: 'a', provider: 'anthropic', kind: 'key', label: 'a', classes: ['key'] },
    ]
    expect(listed(accounts, [mac], 'web').map((a) => a.id)).toEqual(['a', 'b', 'z'])
  })
})
