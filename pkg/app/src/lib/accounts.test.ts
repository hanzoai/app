// @vitest-environment happy-dom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  iam: { isAuthenticated: true, user: { email: 'bob@hanzo.ai', name: 'bob' } as Record<string, string> | null, config: { serverUrl: 'https://hanzo.id' } },
  named: null as { name: string; email: string } | null,
  here: false,
  url: vi.fn(async (_: unknown) => 'https://hanzo.ai/v1/iam/oauth/authorize?client_id=app'),
  remembered: vi.fn(),
}))

vi.mock('@hanzo/iam/react', () => ({ useIam: () => state.iam }))
vi.mock('./destination', () => ({ rememberDestination: () => state.remembered() }))
vi.mock('./session', () => ({ named: () => state.named }))
vi.mock('./signout', () => ({ here: () => state.here, useClient: () => ({ getSigninUrl: state.url }) }))

const { read, is, label, useAccounts } = await import('./accounts')

const bob = { sub: 's1', owner: 'hanzo', name: 'bob', displayName: 'Bob Ross', email: 'bob@hanzo.ai', avatar: 'https://img/bob.png' }
const carol = { sub: 's2', owner: 'hanzo', name: 'carol', displayName: '', email: 'Carol@Example.com', avatar: 'http://img/carol.png' }

const answer = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response)

describe('the accounts IAM holds for this browser', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('are read from IAM with the browser\'s cookie, from its envelope or a bare list', async () => {
    const fetched = answer({ status: 'ok', data: [bob] })
    vi.stubGlobal('fetch', fetched)
    expect(await read('https://hanzo.ai/')).toEqual([bob])
    expect(fetched).toHaveBeenCalledWith('https://hanzo.ai/v1/iam/accounts', expect.objectContaining({ credentials: 'include' }))
    vi.stubGlobal('fetch', answer([bob]))
    expect(await read('https://hanzo.ai')).toEqual([bob])
  })

  test('keep a person once, the address in lower case, only an https picture, and drop a row that cannot be named', async () => {
    vi.stubGlobal('fetch', answer({ data: [bob, { ...bob }, carol, { sub: '', name: 'x' }, { sub: 's3' }, null, 'nobody'] }))
    const got = await read('https://hanzo.ai')
    expect(got.map((a) => a.sub)).toEqual(['s1', 's2'])
    expect(got[1]).toMatchObject({ email: 'carol@example.com', avatar: '' })
  })

  test('are nobody when IAM refuses, answers something else, or cannot be reached', async () => {
    vi.stubGlobal('fetch', answer({ data: [bob] }, false))
    expect(await read('https://hanzo.ai')).toEqual([])
    vi.stubGlobal('fetch', answer({ status: 'error' }))
    expect(await read('https://hanzo.ai')).toEqual([])
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await read('https://hanzo.ai')).toEqual([])
  })
})

describe('which one is the reader, and what a row says', () => {
  test('the subject, else the address, else the username (only when there is no address)', () => {
    expect(is(bob, { sub: 's1' })).toBe(true)
    expect(is(bob, { email: ' BOB@hanzo.ai ' })).toBe(true)
    expect(is(bob, { email: 'other@hanzo.ai', name: 'bob' })).toBe(false)
    expect(is(bob, { name: 'bob' })).toBe(true)
    expect(is(bob, {})).toBe(false)
  })

  test('the display name, else the username, and the address when it adds something', () => {
    expect(label(bob)).toEqual({ title: 'Bob Ross', line: 'bob@hanzo.ai' })
    expect(label({ ...carol, email: 'carol' })).toEqual({ title: 'carol', line: '' })
  })
})

describe('being another account, and adding one', () => {
  let host: HTMLDivElement
  let seen: ReturnType<typeof useAccounts>
  const Probe = () => {
    seen = useAccounts()
    return null
  }
  const mount = async () => {
    host = document.createElement('div')
    document.body.append(host)
    await act(async () => createRoot(host).render(createElement(Probe)))
    await act(async () => {})
  }

  beforeEach(() => {
    state.iam = { isAuthenticated: true, user: { email: 'bob@hanzo.ai', name: 'bob' }, config: { serverUrl: 'https://hanzo.id' } }
    state.here = false
    state.url.mockClear()
    state.remembered.mockClear()
    vi.stubGlobal('fetch', answer({ data: [bob, carol] }))
    const loc = { replace: vi.fn() }
    vi.stubGlobal('location', { ...window.location, origin: 'https://hanzo.ai', replace: loc.replace })
  })
  afterEach(() => vi.unstubAllGlobals())

  test('the list is the issuer\'s, or this origin\'s where it answers IAM itself; the reader is told from the rest', async () => {
    await mount()
    expect(fetch).toHaveBeenCalledWith('https://hanzo.id/v1/iam/accounts', expect.anything())
    expect(seen.accounts.map((a) => a.sub)).toEqual(['s1', 's2'])
    expect(seen.current?.sub).toBe('s1')
    state.here = true
    await mount()
    expect(fetch).toHaveBeenLastCalledWith('https://hanzo.ai/v1/iam/accounts', expect.anything())
  })

  test('signed out it reads nobody', async () => {
    state.iam = { isAuthenticated: false, user: null, config: { serverUrl: 'https://hanzo.id' } }
    await mount()
    expect(fetch).not.toHaveBeenCalled()
    expect(seen.accounts).toEqual([])
  })

  test('being carol is the sign-in naming her by subject, written down first, and signs nobody out', async () => {
    await mount()
    await act(async () => seen.switchTo(seen.accounts[1]))
    expect(state.remembered).toHaveBeenCalledTimes(1)
    expect(state.url).toHaveBeenCalledWith({ additionalParams: { login_hint: 's2' } })
    expect(window.location.replace).toHaveBeenCalledWith('https://hanzo.ai/v1/iam/oauth/authorize?client_id=app')
  })

  test('adding one is the sign-in that asks for credentials and keeps the others', async () => {
    await mount()
    await act(async () => seen.add())
    expect(state.url).toHaveBeenCalledWith({ additionalParams: { prompt: 'login' } })
    expect(state.remembered).toHaveBeenCalledTimes(1)
  })
})
