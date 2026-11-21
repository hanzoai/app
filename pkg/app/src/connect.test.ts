import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('./lib/session', () => ({ bearer: () => 'token', scope: () => ({ Authorization: 'Bearer token', 'X-Org-Id': 'acme' }) }))
vi.mock('./lib/api', () => ({ api: () => 'https://api.example' }))

const { install } = await import('./connect')

afterEach(() => vi.unstubAllGlobals())

describe('install: a role’s skills in one write (hanzo-inc/app issue 323)', () => {
  test('switches every named skill on in one PUT, as its tool, with the session and the org', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ enabled: ['skill_a_b', 'skill_c_d', 'cloud_get_ping'] }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await expect(install(['a_b', 'c_d'])).resolves.toEqual(['skill_a_b', 'skill_c_d', 'cloud_get_ping'])
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.example/v1/tools/activation')
    expect(init.method).toBe('PUT')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token', 'X-Org-Id': 'acme' })
    expect(JSON.parse(String(init.body))).toEqual({ activate: ['skill_a_b', 'skill_c_d'] })
  })

  test('asks nothing when nothing is ticked', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(install([])).resolves.toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  test('a refusal carries its status, for the picker to say who may add skills', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })))
    await expect(install(['a_b'])).rejects.toMatchObject({ status: 403 })
  })
})
