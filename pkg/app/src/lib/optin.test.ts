// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest'
import { block, CHANGED, opt, optin } from './optin'

vi.mock('./api', () => ({ api: () => 'https://api.test' }))
vi.mock('./session', () => ({ scope: () => ({ Authorization: 'Bearer t', 'X-Org-Id': 'acme' }) }))

const answer = (status: number, json: unknown = {}) => vi.fn().mockResolvedValue({ ok: status < 300, status, json: async () => json })

afterEach(() => vi.unstubAllGlobals())

describe('the experimental opt-in', () => {
  test('reads the choice, the block and the public betas, scoped to the reader', async () => {
    const fetcher = answer(200, { on: true, blocked: false, public: ['koma', 7, 'zen7'] })
    vi.stubGlobal('fetch', fetcher)
    expect(await optin()).toEqual({ on: true, blocked: false, public: ['koma', 'zen7'] })
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.test/v1/flag/optin')
    expect(init.method).toBeUndefined()
    expect(init.headers).toMatchObject({ Authorization: 'Bearer t', 'X-Org-Id': 'acme' })
  })

  test('an answer missing a field reads as off, unblocked and nothing public', async () => {
    vi.stubGlobal('fetch', answer(200, {}))
    expect(await optin()).toEqual({ on: false, blocked: false, public: [] })
  })

  test('opting in puts {on} and tells the page it changed', async () => {
    const fetcher = answer(200, { on: true, blocked: false, public: ['iro'] })
    vi.stubGlobal('fetch', fetcher)
    const heard = vi.fn()
    window.addEventListener(CHANGED, heard)
    expect(await opt(true)).toEqual({ on: true, blocked: false, public: ['iro'] })
    window.removeEventListener(CHANGED, heard)
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.test/v1/flag/optin')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ on: true })
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(heard).toHaveBeenCalledTimes(1)
  })

  test('an organization block puts {blocked} at the org address', async () => {
    const fetcher = answer(200, { blocked: true })
    vi.stubGlobal('fetch', fetcher)
    expect(await block(true)).toEqual({ blocked: true })
    expect(fetcher.mock.calls[0][0]).toBe('https://api.test/v1/flag/optin/org')
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ blocked: true })
  })

  test('refusals are words a person can act on, never a status code', async () => {
    vi.stubGlobal('fetch', answer(401))
    await expect(optin()).rejects.toThrow('Sign in to choose experimental features.')
    vi.stubGlobal('fetch', answer(403))
    await expect(opt(true)).rejects.toThrow('Your team or organization has turned experimental features off.')
    vi.stubGlobal('fetch', answer(403))
    await expect(block(true)).rejects.toThrow('Only an admin of this organization can change this for everyone in it.')
    vi.stubGlobal('fetch', answer(500))
    await expect(opt(false)).rejects.toThrow('Your choice was not saved. Try again in a moment.')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(optin()).rejects.toThrow('Check your connection and try again.')
    for (const status of [401, 403, 500]) {
      vi.stubGlobal('fetch', answer(status))
      await expect(opt(true)).rejects.not.toThrow(String(status))
    }
  })

  test('a refused write tells the page nothing changed', async () => {
    vi.stubGlobal('fetch', answer(403))
    const heard = vi.fn()
    window.addEventListener(CHANGED, heard)
    await expect(opt(true)).rejects.toThrow()
    window.removeEventListener(CHANGED, heard)
    expect(heard).not.toHaveBeenCalled()
  })
})
