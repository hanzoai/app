import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('./lib/api', () => ({ api: () => 'https://api.test' }))
vi.mock('./lib/session', () => ({ bearer: () => 'iam-token' }))

import { configure } from './where'
import { cell, resolveRuntime } from './devRuntime'

const calls: string[] = []
const serve = (routes: Record<string, unknown | null>) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${new URL(url).pathname}`)
      const body = routes[new URL(url).pathname]
      return body === null || body === undefined ? new Response('', { status: 404 }) : Response.json(body)
    }),
  )
const signal = new AbortController().signal

afterEach(() => {
  vi.unstubAllGlobals()
  calls.length = 0
})

describe('resolveRuntime', () => {
  test('a linked machine comes first', async () => {
    serve({
      '/v1/sources': { sources: [{ id: 'm1', name: 'Mac', kind: 'desktop', zap: 'm1.tunnel.test', state: 'online' }] },
      '/v1/dev/sessions': { id: 'c1', zap: 'cell.test', sandbox: 'sb1' },
    })
    const r = await resolveRuntime(signal)
    expect(r).toMatchObject({ kind: 'machine', id: 'm1', zap: 'https://m1.tunnel.test' })
    expect(await r?.token()).toBe('iam-token')
    expect(calls).not.toContain('POST /v1/dev/sessions') // a lease creates state: not asked for when a machine is linked
  })
  test('with no local runtime and no linked machine it is null, and nothing is leased (/dev/open resolves this way)', async () => {
    serve({
      '/v1/sources': { sources: [{ id: 'm1', zap: 'm1.tunnel.test', state: 'offline' }] },
      '/v1/dev/sessions': { id: 'c1', zap: 'https://cell.test/zap', sandbox: 'sb1' },
    })
    expect(await resolveRuntime(signal)).toBeNull()
    expect(calls.filter((c) => c === 'POST /v1/dev/sessions')).toHaveLength(0) // a cell is billed: only an explicit action leases one
  })
  test('no machine and no cell (404) is null, not an error', async () => {
    serve({ '/v1/sources': { sources: [] } })
    expect(await resolveRuntime(signal)).toBeNull()
  })
  test("the host's own Dev comes before a machine, a lease and any request", async () => {
    serve({ '/v1/sources': { sources: [{ id: 'm1', zap: 'm1.tunnel.test', state: 'online' }] } })
    configure({ runtime: async () => ({ kind: 'machine', id: 'here', label: 'This computer', zap: 'http://127.0.0.1:3773', token: async () => 'p' }) })
    expect(await resolveRuntime(signal)).toMatchObject({ id: 'here', zap: 'http://127.0.0.1:3773' })
    expect(calls).toEqual([])
    configure({ runtime: undefined })
  })
})

describe('a runtime that will not pair', () => {
  test('a machine on plain http is never offered, and a skipped machine falls through to none, never a lease', async () => {
    serve({
      '/v1/sources': { sources: [{ id: 'dgx', zap: 'http://dgx.test', state: 'online' }, { id: 'm2', zap: 'm2.tunnel.test', state: 'online' }] },
      '/v1/dev/sessions': { id: 'c1', zap: 'https://cell.test/zap', sandbox: 'sb1' },
    })
    expect(await resolveRuntime(signal)).toMatchObject({ kind: 'machine', id: 'm2' })
    expect(await resolveRuntime(signal, new Set(['m2']))).toBeNull()
    expect(calls).not.toContain('POST /v1/dev/sessions')
  })
  test('with every machine skipped and no cell, there is none: Dev draws its start state', async () => {
    serve({ '/v1/sources': { sources: [{ id: 'm2', zap: 'm2.tunnel.test', state: 'online' }] } })
    expect(await resolveRuntime(signal, new Set(['m2']))).toBeNull()
  })
})

describe('cell', () => {
  test('a refused or missing lease is null, so Dev can say there is no cloud session', async () => {
    serve({})
    expect(await cell(signal)).toBeNull()
  })
  test('a lease is a cell with its sandbox', async () => {
    serve({ '/v1/dev/sessions': { id: 'c1', zap: 'https://cell.test/zap', sandbox: 'sb1' } })
    expect(await cell(signal)).toMatchObject({ kind: 'cell', id: 'c1', sandbox: 'sb1' })
  })
})
