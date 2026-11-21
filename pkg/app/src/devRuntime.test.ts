import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('./lib/api', () => ({ api: () => 'https://api.test' }))
vi.mock('./lib/session', () => ({ bearer: () => 'iam-token' }))

import { resolveRuntime } from './devRuntime'

const serve = (routes: Record<string, unknown | null>) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = routes[new URL(url).pathname]
      return body === null || body === undefined ? new Response('', { status: 404 }) : Response.json(body)
    }),
  )
const signal = new AbortController().signal

afterEach(() => vi.unstubAllGlobals())

describe('resolveRuntime', () => {
  test('a linked machine comes first', async () => {
    serve({
      '/v1/agents/targets': { targets: [{ id: 'm1', label: 'Mac', host: 'm1.tunnel.test', status: 'online' }] },
      '/v1/dev/cell': { id: 'c1', host: 'cell.test', sandbox: 'sb1' },
    })
    const r = await resolveRuntime(signal)
    expect(r).toMatchObject({ kind: 'machine', id: 'm1', host: 'https://m1.tunnel.test' })
    expect(await r?.token()).toBe('iam-token')
  })
  test('an offline machine is skipped for the cell, which carries the sandbox', async () => {
    serve({
      '/v1/agents/targets': { targets: [{ id: 'm1', host: 'm1.tunnel.test', status: 'offline' }] },
      '/v1/dev/cell': { id: 'c1', host: 'https://cell.test', sandbox: 'sb1' },
    })
    expect(await resolveRuntime(signal)).toMatchObject({ kind: 'cell', host: 'https://cell.test', sandbox: 'sb1' })
  })
  test('no machine and no cell (404) is null, not an error', async () => {
    serve({ '/v1/agents/targets': { targets: [] } })
    expect(await resolveRuntime(signal)).toBeNull()
  })
})
