import { describe, expect, test, vi } from 'vitest'
import { createClient, span } from './client'

const client = (fetch: typeof globalThis.fetch) =>
  createClient({ apiBase: 'https://api.test/', token: () => 't', org: 'hanzo', fetch })

describe('the cloud client', () => {
  test('span is the last N days to now', () => {
    const now = new Date('2026-11-21T00:00:00Z')
    expect(span(7, now)).toEqual({ from: '2026-11-14T00:00:00.000Z', to: '2026-11-21T00:00:00.000Z' })
  })
  test('usage asks /v1/machines with the range, the bearer and the org, and coerces bad counts to 0', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ rows: [{ key: 'm', inputTokens: 5, outputTokens: 'x', cacheTokens: null, costUsd: 0.1 }] })))
    const out = await client(fetch as never).usage('model', 30, new Date('2026-11-21T00:00:00Z'))
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/v1/machines/usage?by=model&from=2026-10-22T00%3A00%3A00.000Z&to=2026-11-21T00%3A00%3A00.000Z')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer t', 'X-Org-Id': 'hanzo' })
    expect(out).toEqual({ rows: [{ key: 'm', inputTokens: 5, outputTokens: 0, cacheTokens: 0, costUsd: 0.1 }], snapshots: [] })
  })
  test('machines list reads {machines}; accounts read {accounts} and a missing class is local', async () => {
    const fetch = vi.fn(async (url: string) =>
      new Response(JSON.stringify(String(url).endsWith('/accounts') ? { accounts: [{ id: 'a', provider: 'p', kind: 'login' }] } : { machines: [{ id: 'm1' }] })),
    )
    const c = client(fetch as never)
    expect((await c.machines())[0]).toMatchObject({ id: 'm1', providers: [] })
    expect((await c.accounts())[0].classes).toEqual(['local'])
    expect(fetch.mock.calls.map((x) => (x as unknown as [string])[0])).toEqual(['https://api.test/v1/machines', 'https://api.test/v1/machines/accounts'])
  })
  test('revoke, key add and key delete use /v1/machines routes', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    const c = client(fetch as never)
    await c.revoke('src_1/x')
    await c.removeAccount('k 1')
    const calls = fetch.mock.calls as unknown as [string, RequestInit][]
    expect(calls[0][0]).toBe('https://api.test/v1/machines/src_1%2Fx')
    expect(calls[0][1].method).toBe('DELETE')
    expect(calls[1][0]).toBe('https://api.test/v1/machines/accounts/k%201')
    const post = vi.fn(async () => new Response(JSON.stringify({ id: 'k' }), { status: 201 }))
    await client(post as never).addKey({ provider: 'anthropic', label: 'work', value: 'sk-x' })
    const [url, init] = post.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/v1/machines/accounts')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ provider: 'anthropic', label: 'work', value: 'sk-x', kind: 'key' })
  })
  test('a refusal carries its status; a dead network is status 0; no token means no header', async () => {
    await expect(client((async () => new Response('no', { status: 403 })) as never).usage('user', 7)).rejects.toMatchObject({ status: 403 })
    await expect(client((async () => { throw new TypeError('offline') }) as never).machines()).rejects.toMatchObject({ status: 0 })
    const fetch = vi.fn(async () => new Response('{}'))
    const bare = createClient({ apiBase: 'https://api.test', token: null, fetch: fetch as never })
    await bare.machines()
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toEqual({})
    expect(bare.signedIn()).toBe(false)
  })
})
