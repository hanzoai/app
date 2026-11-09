// @vitest-environment happy-dom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  iam: { isAuthenticated: true, user: { email: 'bob@hanzo.ai', name: 'bob' } as Record<string, string> | null, config: { serverUrl: 'https://hanzo.id', clientId: 'hanzo-app' } },
  named: null as { name: string; email: string } | null,
  here: false,
  url: vi.fn(async (_: unknown) => 'https://hanzo.ai/v1/iam/oauth/authorize?client_id=app'),
  remembered: vi.fn(),
  cleared: vi.fn(),
}))

vi.mock('@hanzo/iam/react', () => ({ useIam: () => state.iam }))
vi.mock('./destination', () => ({ rememberDestination: () => state.remembered() }))
vi.mock('./session', () => ({ named: () => state.named }))
vi.mock('./signout', () => ({ here: () => state.here, OUT: '/login?from=logout', useClient: () => ({ getSigninUrl: state.url, clearTokens: state.cleared }) }))

const { read, put, end, is, label, useAccounts } = await import('./accounts')

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

describe('a list IAM is slow to give', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('is nobody once the wait runs out, so the page that held for it goes on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted'))))),
    )
    expect(await read('https://hanzo.ai', AbortSignal.timeout(10))).toEqual([])
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
  const Probe = ({ listing }: { listing?: boolean }) => {
    seen = useAccounts(listing)
    return null
  }
  const mount = async (listing?: boolean) => {
    host = document.createElement('div')
    document.body.append(host)
    await act(async () => createRoot(host).render(createElement(Probe, { listing })))
    await act(async () => {})
  }

  beforeEach(() => {
    state.iam = { isAuthenticated: true, user: { email: 'bob@hanzo.ai', name: 'bob' }, config: { serverUrl: 'https://hanzo.id', clientId: 'hanzo-app' } }
    state.here = false
    state.url.mockClear()
    state.remembered.mockClear()
    state.cleared.mockClear()
    vi.stubGlobal('fetch', answer({ data: [bob, carol] }))
    const loc = { replace: vi.fn(), assign: vi.fn() }
    vi.stubGlobal('location', { ...window.location, origin: 'https://hanzo.ai', replace: loc.replace, assign: loc.assign })
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

  test('signed out it reads nobody, unless the page asks who is signed in before anyone is; asked not to, even a reader\'s list is not read', async () => {
    state.iam = { isAuthenticated: false, user: null, config: { serverUrl: 'https://hanzo.id', clientId: 'hanzo-app' } }
    await mount()
    expect(fetch).not.toHaveBeenCalled()
    expect(seen.accounts).toEqual([])
    await mount(true)
    expect(fetch).toHaveBeenCalledWith('https://hanzo.id/v1/iam/accounts', expect.anything())
    expect(seen.accounts.map((a) => a.sub)).toEqual(['s1', 's2'])
    ;(fetch as ReturnType<typeof vi.fn>).mockClear()
    state.iam = { isAuthenticated: true, user: { email: 'bob@hanzo.ai', name: 'bob' }, config: { serverUrl: 'https://hanzo.id', clientId: 'hanzo-app' } }
    await mount(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  test('being carol is IAM\'s current account made hers, then the sign-in naming her by subject, written down first', async () => {
    await mount()
    await act(async () => seen.switchTo(seen.accounts[1]))
    expect(fetch).toHaveBeenCalledWith('https://hanzo.id/v1/iam/accounts', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ current: 's2' }),
    })
    expect(state.remembered).toHaveBeenCalledTimes(1)
    expect(state.url).toHaveBeenCalledWith({ additionalParams: { login_hint: 's2' } })
    expect(window.location.replace).toHaveBeenCalledWith('https://hanzo.ai/v1/iam/oauth/authorize?client_id=app')
  })

  test('IAM refusing the switch of current does not stop the sign-in, which names her itself', async () => {
    await mount()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await act(async () => seen.switchTo(seen.accounts[1]))
    expect(state.url).toHaveBeenCalledWith({ additionalParams: { login_hint: 's2' } })
  })

  test('carol signed out alone is IAM\'s end-session naming her, and she leaves the list; the reader stays', async () => {
    await mount()
    let sent: RequestInit | undefined
    vi.stubGlobal('fetch', vi.fn(async (_: string, init: RequestInit) => ((sent = init), { ok: true, type: 'basic' }) as Response))
    let ended = false
    await act(async () => { ended = await seen.leave(seen.accounts[1]) })
    expect(ended).toBe(true)
    expect(fetch).toHaveBeenCalledWith('https://hanzo.id/v1/iam/oauth/logout', expect.objectContaining({ method: 'POST', credentials: 'include' }))
    expect(new URLSearchParams(String(sent?.body)).get('logout_hint')).toBe('s2')
    expect(new URLSearchParams(String(sent?.body)).get('client_id'), 'the grant of this application goes with it').toBe('hanzo-app')
    expect(seen.accounts.map((a) => a.sub)).toEqual(['s1'])
    expect(state.cleared, 'this tab is still bob\'s').not.toHaveBeenCalled()
    expect(window.location.assign).not.toHaveBeenCalled()
  })

  test('the reader signed out alone clears this tab and leaves for the sign-in, which offers the rest', async () => {
    await mount()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, type: 'basic' }) as Response))
    await act(async () => { await seen.leave(seen.accounts[0]) })
    expect(state.cleared).toHaveBeenCalledTimes(1)
    expect(window.location.assign).toHaveBeenCalledWith('/login?from=logout')
    await act(async () => { await seen.leave(seen.accounts[0], '/login?client_id=hanzo-cli') })
    expect(window.location.assign).toHaveBeenLastCalledWith('/login?client_id=hanzo-cli')
  })

  test('an end-session IAM refuses leaves everything as it was', async () => {
    await mount()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, type: 'basic' }) as Response))
    let ended = true
    await act(async () => { ended = await seen.leave(seen.accounts[0]) })
    expect(ended).toBe(false)
    expect(seen.accounts.map((a) => a.sub)).toEqual(['s1', 's2'])
    expect(state.cleared).not.toHaveBeenCalled()
    expect(window.location.assign).not.toHaveBeenCalled()
  })

  test('adding one is the sign-in that asks for credentials and keeps the others', async () => {
    await mount()
    await act(async () => seen.add())
    expect(state.url).toHaveBeenCalledWith({ additionalParams: { prompt: 'login' } })
    expect(state.remembered).toHaveBeenCalledTimes(1)
  })
})

describe('the two writes on IAM\'s list', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('making one current is a JSON PUT with the subject, and a refusal is nothing to the caller', async () => {
    const fetched = answer({ data: [] })
    vi.stubGlobal('fetch', fetched)
    await put('https://hanzo.ai/', bob)
    expect(fetched).toHaveBeenCalledWith('https://hanzo.ai/v1/iam/accounts', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ current: 's1' }) }))
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await expect(put('https://hanzo.ai', bob)).resolves.toBeUndefined()
  })

  test('signing one out is a form POST naming the subject as logout_hint, never following a redirect', async () => {
    const fetched = answer({}, true)
    vi.stubGlobal('fetch', fetched)
    expect(await end('https://hanzo.ai/', bob)).toBe(true)
    const init = (fetched.mock.calls as unknown as [string, RequestInit][])[0][1]
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', redirect: 'manual' })
    expect(new URLSearchParams(String(init.body)).toString()).toBe('logout_hint=s1')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, type: 'opaqueredirect' }) as Response))
    expect(await end('https://hanzo.ai', bob), 'a redirect held back is IAM answering').toBe(true)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await end('https://hanzo.ai', bob)).toBe(false)
  })
})
