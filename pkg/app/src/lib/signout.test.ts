// @vitest-environment happy-dom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({ out: vi.fn(async () => {}), options: {} as { to?: string; everywhere?: boolean; issuer?: string } }))
vi.mock('@hanzo/iam', () => ({ IAM: class {} }))
vi.mock('@hanzo/iam/react', () => ({ useIam: () => ({ config: { serverUrl: 'https://hanzo.id' } }) }))
vi.mock('@hanzo/ui/auth', () => ({
  useSignOut: (options: { to?: string; everywhere?: boolean; issuer?: string }) => {
    state.options = options
    return state.out
  },
}))
vi.mock('./tags', () => ({ track: () => {} }))
const said = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('@hanzo/ui', () => ({ toast: said }))
vi.mock('./host', () => ({ answers: () => false, SIGNIN: 'https://hanzo.ai' }))
const who = vi.hoisted(() => ({ sub: undefined as string | undefined }))
vi.mock('./session', () => ({ subject: () => who.sub }))

const { endsAt, here, PATIENCE, signingOut, useSignOut } = await import('./signout')
const { FRESH, useUnfinished } = await import('./unfinished')
const { configure } = await import('../where')

describe('signing out', () => {
  afterEach(() => {
    delete (window as unknown as { google?: unknown }).google
    state.out.mockClear()
    said.error.mockClear()
    sessionStorage.clear()
  })

  const draw = async (Probe: () => null) => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(createElement(Probe)))
    return async () => {
      await act(async () => root.unmount())
      host.remove()
    }
  }
  const probe = async (to?: string) => {
    let leave!: () => Promise<void>
    const done = await draw(() => {
      leave = useSignOut(to)
      return null
    })
    return { leave, done }
  }
  const press = async (to?: string) => {
    const { leave, done } = await probe(to)
    await act(async () => leave())
    await done()
  }
  /** The page a sign-out moved to, opening. */
  const land = async () =>
    (await draw(() => {
      useUnfinished()
      return null
    }))()

  test('tells Google One Tap not to sign the person straight back in, and then signs out', async () => {
    const disable = vi.fn()
    ;(window as unknown as { google: unknown }).google = { accounts: { id: { disableAutoSelect: disable } } }
    await press()
    expect(disable).toHaveBeenCalledTimes(1)
    expect(state.out).toHaveBeenCalledTimes(1)
  })

  test("the host's leaving is awaited to its end before the session ends and the page moves", async () => {
    const order: string[] = []
    state.out.mockImplementation(async () => void order.push('signed out'))
    configure({ signOut: () => new Promise<void>((done) => setTimeout(() => (order.push('host forgot'), done()), 20)) })
    try {
      await press()
      expect(order).toEqual(['host forgot', 'signed out'])
    } finally {
      configure({ signOut: undefined })
      state.out.mockImplementation(async () => {})
    }
  })

  test("a host whose leaving fails still signs the person out, and the page it lands on says so, once", async () => {
    configure({ signOut: async () => { throw new Error('keychain locked') } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await press()
      expect(state.out).toHaveBeenCalledTimes(1)
      expect(said.error, 'not on the page that is leaving: nobody would see it').not.toHaveBeenCalled()
      await land()
      await vi.waitFor(() => expect(said.error).toHaveBeenCalledTimes(1))
      expect(said.error).toHaveBeenCalledWith('Signed out, but this device could not finish forgetting you. Sign out again if anything remains.')
      await land()
      expect(said.error, 'the next page after that says nothing').toHaveBeenCalledTimes(1)
    } finally {
      configure({ signOut: undefined })
      said.error.mockClear()
    }
  })

  test('a sign-out whose host finished leaves the next page nothing to say', async () => {
    configure({ signOut: async () => {} })
    try {
      await press()
      await land()
      expect(said.error).not.toHaveBeenCalled()
    } finally {
      configure({ signOut: undefined })
    }
  })

  test("a host's leaving that hangs is given a few seconds, then counted as unfinished, and the sign-out goes on", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let settle!: () => void
    const own = vi.fn(() => new Promise<void>((done) => (settle = done)))
    configure({ signOut: own })
    const { leave, done } = await probe()
    try {
      const pressed = leave()
      await vi.advanceTimersByTimeAsync(PATIENCE - 1)
      expect(state.out).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await pressed
      expect(state.out).toHaveBeenCalledTimes(1)
      expect(sessionStorage.getItem('hanzo.signout.unfinished')).not.toBeNull()
      // The host's leaving is still running: the lock stays until it settles, so nothing overlaps it.
      await act(async () => leave())
      expect(own).toHaveBeenCalledTimes(1)
      expect(state.out).toHaveBeenCalledTimes(1)
      settle()
      await vi.advanceTimersByTimeAsync(0)
      const again = leave()
      // The host's step starts a microtask in: let it, then let it settle.
      await vi.advanceTimersByTimeAsync(0)
      settle()
      await vi.advanceTimersByTimeAsync(0)
      await again
      expect(own, 'once it settled, a press is a sign-out again').toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
      await done()
      configure({ signOut: undefined })
    }
  })

  test('the note is said only while fresh, and only to the person who signed out or to nobody', async () => {
    const note = (sub: string | undefined, age: number) =>
      sessionStorage.setItem('hanzo.signout.unfinished', JSON.stringify({ sub, at: Date.now() - age }))
    try {
      note('ada', FRESH + 1000)
      await land()
      expect(said.error, 'a note left on a page that never said it does not wait for a later sign-in').not.toHaveBeenCalled()
      expect(sessionStorage.getItem('hanzo.signout.unfinished')).toBeNull()
      who.sub = 'grace'
      note('ada', 0)
      await land()
      expect(said.error, "grace is not told about ada's sign-out").not.toHaveBeenCalled()
      expect(sessionStorage.getItem('hanzo.signout.unfinished')).toBeNull()
      who.sub = 'ada'
      note('ada', 0)
      await land()
      expect(said.error).toHaveBeenCalledTimes(1)
    } finally {
      who.sub = undefined
    }
  })

  test('the note names the person whose sign-out it was', async () => {
    who.sub = 'ada'
    configure({ signOut: async () => { throw new Error('keychain locked') } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await press()
      expect(JSON.parse(sessionStorage.getItem('hanzo.signout.unfinished')!)).toMatchObject({ sub: 'ada' })
    } finally {
      who.sub = undefined
      configure({ signOut: undefined })
    }
  })

  test("a second press while a sign-out runs is ignored: the host's leaving never runs twice at once", async () => {
    let finish!: () => void
    const own = vi.fn(() => new Promise<void>((done) => (finish = done)))
    configure({ signOut: own })
    const { leave, done } = await probe()
    try {
      const first = leave()
      await act(async () => leave())
      expect(own).toHaveBeenCalledTimes(1)
      finish()
      await act(async () => first)
      expect(state.out).toHaveBeenCalledTimes(1)
      // Once it is over, a press is a sign-out again.
      const again = leave()
      await act(async () => {}) // the host's step starts a microtask in
      finish()
      await act(async () => again)
      expect(own).toHaveBeenCalledTimes(2)
    } finally {
      await done()
      configure({ signOut: undefined })
    }
  })

  test("every sign-out tells One Tap, Sign out <name> as much as Log out: it is the one path's step", async () => {
    const disable = vi.fn()
    ;(window as unknown as { google: unknown }).google = { accounts: { id: { disableAutoSelect: disable } } }
    const finish = vi.fn(async () => {})
    // As lib/accounts calls it for the account in use: its own finish, no hook.
    await act(async () => void (await signingOut(finish)))
    expect(disable).toHaveBeenCalledTimes(1)
    expect(finish).toHaveBeenCalledTimes(1)
  })

  test("IAM's own calls that hang are given a few seconds; then the page moves, the device already signed out", async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const here = new URL(window.location.href)
    const assign = vi.fn()
    vi.stubGlobal('location', { href: here.href, origin: here.origin, protocol: here.protocol, host: here.host, hostname: here.hostname, pathname: here.pathname, search: '', hash: '', assign, replace: vi.fn() })
    state.out.mockImplementation(() => new Promise<void>(() => {}))
    const { leave, done } = await probe()
    try {
      const pressed = leave()
      await vi.advanceTimersByTimeAsync(PATIENCE - 1)
      expect(assign).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await pressed
      expect(assign).toHaveBeenCalledWith('/')
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
      await done()
      state.out.mockImplementation(async () => {})
    }
  })

  test('is the same without Google\'s script on the page', async () => {
    await press()
    expect(state.out).toHaveBeenCalledTimes(1)
  })

  test('lands on the home page after a sign-out, or where the caller says, and ends every Hanzo site either way', async () => {
    await press()
    expect(state.options).toMatchObject({ to: '/', everywhere: true })
    await press('/login?client_id=hanzo-cli')
    expect(state.options).toMatchObject({ to: '/login?client_id=hanzo-cli', everywhere: true })
  })

  test('on a dev server the plain sign-out ends here, and the chooser\'s always does', async () => {
    // happy-dom is localhost: a dev server's sign-out stays on this machine.
    await press()
    expect(state.options.issuer).toBe('')
    await press('/login?client_id=hanzo-cli&prompt=select_account')
    expect(state.options.issuer).toBe('')
  })

  test('a sign-out everywhere ends on hanzo.ai\'s end-session page, where the session lives', () => {
    // The configured server is where the token calls go, and IAM's walk starts
    // only on a sign-in origin, so Hanzo's own hosts end on hanzo.ai.
    expect(endsAt('https://api.hanzo.ai', 'hanzo.ai')).toBe('https://hanzo.ai')
    expect(endsAt('https://api.hanzo.ai', 'hanzo.app')).toBe('https://hanzo.ai')
    expect(endsAt('https://hanzo.id', 'hanzo.bot')).toBe('https://hanzo.ai')
    // A brand with an issuer of its own ends there.
    expect(endsAt('https://lux.id', 'lux.network')).toBe('https://lux.id')
    // A dev server ends here, and a server that is no address ends nothing past it.
    expect(endsAt('https://api.hanzo.ai', 'localhost')).toBe('')
    // Hanzo Desktop's own window is this computer too (tauri://localhost on macOS and Linux,
    // http://tauri.localhost on Windows): its sign-out ends here and @hanzo/ui loads `to` in
    // the window itself, the load that clears the signed-in screen and says a carried note.
    expect(endsAt('https://api.hanzo.ai', new URL('tauri://localhost/chat').hostname)).toBe('')
    expect(endsAt('https://api.hanzo.ai', new URL('http://tauri.localhost/chat').hostname)).toBe('')
    expect(endsAt('https://api.hanzo.ai', 'app.localhost')).toBe('')
    expect(endsAt('not an address', 'hanzo.ai')).toBe('')
  })
})

describe('a page that answers IAM on its own origin', () => {
  afterEach(() => configure({ answers: undefined }))

  test('is a Hanzo host, or a host that says it signs in on its own page', () => {
    // happy-dom's host is localhost, which no Hanzo list names here (host is mocked to none).
    expect(here()).toBe(false)
    configure({ answers: (host) => host === 'localhost' })
    expect(here()).toBe(true)
    configure({ answers: (host) => host === 'hanzo.market' })
    expect(here()).toBe(false)
    configure({ answers: () => true })
    expect(here()).toBe(true)
  })
})

