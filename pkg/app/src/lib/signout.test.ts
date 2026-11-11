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
vi.mock('./host', () => ({ answers: () => false, SIGNIN: 'https://hanzo.ai' }))

const { endsAt, here, useSignOut } = await import('./signout')
const { configure } = await import('../where')

describe('signing out', () => {
  afterEach(() => {
    delete (window as unknown as { google?: unknown }).google
    state.out.mockClear()
  })

  const press = async (to?: string) => {
    let leave!: () => Promise<void>
    const Probe = () => {
      leave = useSignOut(to)
      return null
    }
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(createElement(Probe)))
    await act(async () => leave())
    await act(async () => root.unmount())
    host.remove()
  }

  test('tells Google One Tap not to sign the person straight back in, and then signs out', async () => {
    const disable = vi.fn()
    ;(window as unknown as { google: unknown }).google = { accounts: { id: { disableAutoSelect: disable } } }
    await press()
    expect(disable).toHaveBeenCalledTimes(1)
    expect(state.out).toHaveBeenCalledTimes(1)
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
