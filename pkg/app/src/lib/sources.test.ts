import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  compact, dollars, heaviest, level, ordered, percent, providers, readUsage, resets, revokeSource, route, snapshotsFor, span, total,
  type Row, type Source, type Usage,
} from './sources'

vi.mock('./api', () => ({ api: () => 'https://api.test' }))
vi.mock('./session', () => ({ scope: () => ({ Authorization: 'Bearer t', 'X-Org-Id': 'hanzo' }) }))

const row = (key: string, i = 0, o = 0, c = 0, usd = 0): Row => ({ key, inputTokens: i, outputTokens: o, cacheTokens: c, costUsd: usd })
const src = (id: string, state: Source['state'], last?: string, name = id): Source => ({
  id, kind: 'desktop', name, os: 'darwin', state, last_seen: last, linked_at: '2026-11-01T00:00:00Z', providers: [],
})

afterEach(() => vi.unstubAllGlobals())

describe('totals', () => {
  test('sum every kind of token and the cost', () => {
    expect(total([row('a', 1, 2, 3, 0.5), row('b', 10, 20, 30, 1.25)])).toEqual(row('total', 11, 22, 33, 1.75))
    expect(total([])).toEqual(row('total'))
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
  test('dollars: cents small, whole when large', () => {
    expect(dollars(1.5)).toBe('$1.50')
    expect(dollars(1234.56)).toBe('$1,235')
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
})

describe('route', () => {
  test('a subscription login stays on its device, a key is a key', () => {
    expect(route('login')).toBe('On this device only')
    expect(route('key')).toBe('API key')
  })
})

describe('sources', () => {
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
})

describe('snapshots', () => {
  const snap = (sourceId: string, provider: string, fetchedAt: string) => ({ sourceId, provider, fetchedAt, source: 'oauth', windows: [] })
  const usage: Usage = {
    rows: [row('claude', 100), row('codex', 900)],
    snapshots: [snap('a', 'claude', '2026-11-21T01:00:00Z'), snap('b', 'claude', '2026-11-21T02:00:00Z'), snap('a', 'gemini', '2026-11-21T01:00:00Z')],
  }
  test('a provider reads its snapshots, freshest first', () => {
    expect(snapshotsFor(usage, 'claude').map((s) => s.sourceId)).toEqual(['b', 'a'])
    expect(snapshotsFor(usage, 'none')).toEqual([])
  })
  test('providers come heaviest first, then those with only a snapshot', () => {
    expect(providers(usage)).toEqual(['codex', 'claude', 'gemini'])
  })
})

describe('the cloud', () => {
  test('span is the last N days to now', () => {
    const now = new Date('2026-11-21T00:00:00Z')
    expect(span(7, now)).toEqual({ from: '2026-11-14T00:00:00.000Z', to: '2026-11-21T00:00:00.000Z' })
  })
  test('usage asks /v1 with the range, the bearer and the org, and coerces bad counts to 0', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ rows: [{ key: 'm', inputTokens: 5, outputTokens: 'x', cacheTokens: null, costUsd: 0.1 }] })))
    vi.stubGlobal('fetch', fetch)
    const out = await readUsage('model', 30, new Date('2026-11-21T00:00:00Z'))
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/v1/sources/usage?by=model&from=2026-10-22T00%3A00%3A00.000Z&to=2026-11-21T00%3A00%3A00.000Z')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer t', 'X-Org-Id': 'hanzo' })
    expect(out).toEqual({ rows: [row('m', 5, 0, 0, 0.1)], snapshots: [] })
  })
  test('revoke is a DELETE of the one source', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    await revokeSource('src_1/x')
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/v1/sources/src_1%2Fx')
    expect(init.method).toBe('DELETE')
  })
  test('a refusal carries its status; a dead network is status 0', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 403 })))
    await expect(readUsage('user', 7)).rejects.toMatchObject({ status: 403 })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    await expect(readUsage('user', 7)).rejects.toMatchObject({ status: 0 })
  })
})
