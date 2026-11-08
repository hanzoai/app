// @vitest-environment happy-dom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({ out: vi.fn(async () => {}), options: {} as { to?: string; everywhere?: boolean } }))
vi.mock('@hanzo/iam', () => ({ IAM: class {} }))
vi.mock('@hanzo/iam/react', () => ({ useIam: () => ({ config: {} }) }))
vi.mock('@hanzo/ui/auth', () => ({
  useSignOut: (options: { to?: string; everywhere?: boolean }) => {
    state.options = options
    return state.out
  },
}))
vi.mock('./tags', () => ({ track: () => {} }))
vi.mock('./host', () => ({ answers: () => false }))

const { useSignOut } = await import('./signout')

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

  test('lands on the sign-in after a sign-out, or where the caller says, and ends every Hanzo site either way', async () => {
    await press()
    expect(state.options).toMatchObject({ to: '/login?from=logout', everywhere: true })
    await press('/login?client_id=hanzo-cli')
    expect(state.options).toMatchObject({ to: '/login?client_id=hanzo-cli', everywhere: true })
  })
})
