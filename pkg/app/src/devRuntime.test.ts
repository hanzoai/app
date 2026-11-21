import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('./lib/api', () => ({ api: () => 'https://api.test' }))
vi.mock('./lib/session', () => ({ bearer: () => 'iam-token' }))

import { resolveRuntime } from './devRuntime'

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
      '/v1/agents/targets': { targets: [{ id: 'm1', label: 'Mac', host: 'm1.tunnel.test', status: 'online' }] },
      '/v1/dev/sessions': { id: 'c1', zap: 'cell.test', sandbox: 'sb1' },
    })
    const r = await resolveRuntime(signal)
    expect(r).toMatchObject({ kind: 'machine', id: 'm1', zap: 'https://m1.tunnel.test' })
    expect(await r?.token()).toBe('iam-token')
    expect(calls).not.toContain('POST /v1/dev/sessions') // a lease creates state: not asked for when a machine is linked
  })
  test('an offline machine is skipped for the cell, which carries the sandbox', async () => {
    serve({
      '/v1/agents/targets': { targets: [{ id: 'm1', host: 'm1.tunnel.test', status: 'offline' }] },
      '/v1/dev/sessions': { id: 'c1', zap: 'https://cell.test/zap', sandbox: 'sb1' },
    })
    expect(await resolveRuntime(signal)).toMatchObject({ kind: 'cell', zap: 'https://cell.test/zap', sandbox: 'sb1' })
    expect(calls).toContain('POST /v1/dev/sessions')
  })
  test('no machine and no cell (404) is null, not an error', async () => {
    serve({ '/v1/agents/targets': { targets: [] } })
    expect(await resolveRuntime(signal)).toBeNull()
  })
})
