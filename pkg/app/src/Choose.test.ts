// @vitest-environment happy-dom
import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({ user: null as { id?: string; email?: string } | null, out: vi.fn(async () => {}) }))

const draw = ({ render, children, onClick, disabled, 'aria-label': named, 'aria-current': current }: { render?: ReactElement | string; children?: ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string; 'aria-current'?: boolean }) =>
  isValidElement(render)
    ? cloneElement(render, { onClick, disabled, 'aria-label': named, 'aria-current': current ? 'true' : undefined } as never, children)
    : createElement(typeof render === 'string' ? render : 'div', { onClick, 'aria-label': named }, children)
vi.mock('@hanzo/gui', () => ({ Text: draw, View: draw, XStack: draw, YStack: draw }))
vi.mock('@hanzo/ui', () => ({
  Avatar: () => null,
  Button: ({ children, onClick, disabled, 'aria-label': named }: { children?: ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) => createElement('button', { onClick, disabled, 'aria-label': named }, children),
}))
vi.mock('@hanzo/ui/marketing', () => ({ TextLink: ({ children, onPress }: { children?: ReactNode; onPress?: () => void }) => createElement('a', { onClick: onPress, role: 'link' }, children) }))
vi.mock('@hanzo/iam/react', () => ({ useIam: () => ({ user: state.user }) }))
vi.mock('./lib/signout', () => ({ useSignOut: () => state.out }))

const { Choose } = await import('./Choose')

const bob = { sub: 's1', owner: 'hanzo', name: 'bob', displayName: 'Bob Ross', email: 'bob@hanzo.ai', avatar: '' }
const carol = { sub: 's2', owner: 'acme', name: 'carol', displayName: 'Carol Ames', email: 'carol@example.com', avatar: '' }

async function mount(props: Partial<Parameters<typeof Choose>[0]> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const all = {
    rows: [bob, carol],
    listed: true,
    known: { leave: vi.fn(async () => true) },
    onOther: vi.fn(),
    pick: vi.fn(async () => true),
    ...props,
  }
  await act(async () => root.render(createElement(Choose, all as never)))
  const press = (text: string) => [...host.querySelectorAll('button, a')].find((b) => b.textContent === text || b.getAttribute('aria-label') === text) as HTMLElement
  return { host, all, press, done: async () => (await act(async () => root.unmount()), host.remove()) }
}

describe('the account chooser', () => {
  beforeEach(() => {
    state.user = null
    state.out.mockClear()
  })

  test('lists each account by name, address and org, with a way out for each, and the two ways to leave them', async () => {
    const m = await mount()
    expect(m.host.textContent).toContain('Bob Ross')
    expect(m.host.textContent).toContain('bob@hanzo.ai · hanzo')
    expect(m.host.textContent).toContain('Carol Ames')
    expect(m.press('Continue as bob@hanzo.ai')).toBeTruthy()
    expect(m.press('Sign out Carol Ames')).toBeTruthy()
    expect(m.press('Use another account')).toBeTruthy()
    expect(m.press('Sign out of all accounts')).toBeTruthy()
    expect(m.host.querySelector('section[aria-label="Accounts"]')).toBeTruthy()
    await m.done()
  })

  test('one account alone has no all-accounts way out', async () => {
    const m = await mount({ rows: [bob] })
    expect(m.press('Sign out of all accounts')).toBeUndefined()
    await m.done()
  })

  test('a press is that account: the host’s pick is asked for it, and the page waits for the answer', async () => {
    const m = await mount()
    await act(async () => m.press('Continue as carol@example.com').click())
    expect(m.all.pick).toHaveBeenCalledWith(carol)
    expect(m.all.onOther).not.toHaveBeenCalled()
    await m.done()
  })

  test('an account IAM has no session to spend for asks for the credential instead', async () => {
    const m = await mount({ pick: vi.fn(async () => false) })
    await act(async () => m.press('Continue as bob@hanzo.ai').click())
    expect(m.all.onOther).toHaveBeenCalledTimes(1)
    await m.done()
  })

  test('a pick that fails is said, and the rows are pressable again', async () => {
    const m = await mount({ pick: vi.fn(async () => Promise.reject(new Error('no'))) })
    await act(async () => m.press('Continue as bob@hanzo.ai').click())
    expect(m.host.textContent).toContain('Something went wrong. Try again.')
    expect(m.press('Continue as bob@hanzo.ai').hasAttribute('disabled')).toBe(false)
    await m.done()
  })

  test('Sign out is that account alone, here; a refusal is said', async () => {
    const m = await mount()
    await act(async () => m.press('Sign out Carol Ames').click())
    expect(m.all.known.leave).toHaveBeenCalledWith(carol, `${window.location.pathname}${window.location.search}`)
    expect(state.out).not.toHaveBeenCalled()
    await m.done()
    const refused = await mount({ known: { leave: vi.fn(async () => false) } })
    await act(async () => refused.press('Sign out Carol Ames').click())
    expect(refused.host.textContent).toContain('Something went wrong. Try again.')
    await refused.done()
  })

  test('a tab’s own account has no session of IAM’s to end alone: its Sign out is the whole sign-out', async () => {
    const m = await mount({ rows: [bob], listed: false })
    await act(async () => m.press('Sign out Bob Ross').click())
    expect(state.out).toHaveBeenCalledTimes(1)
    expect(m.all.known.leave).not.toHaveBeenCalled()
    await m.done()
  })

  test('Sign out of all accounts and Use another account are the page’s own', async () => {
    const m = await mount()
    await act(async () => m.press('Sign out of all accounts').click())
    expect(state.out).toHaveBeenCalledTimes(1)
    await act(async () => m.press('Use another account').click())
    expect(m.all.onOther).toHaveBeenCalledTimes(1)
    await m.done()
  })

  test('marks the account this tab is signed in as, and draws the host’s frame, refusal and note', async () => {
    state.user = { email: 'carol@example.com' }
    const Frame = ({ label, children }: { label: string; children: ReactNode }) => createElement('div', { 'data-frame': label }, children)
    const Refusal = ({ text }: { text: string | null }) => (text ? createElement('i', { 'data-refusal': '' }, text) : null)
    const m = await mount({ frame: Frame, refusal: Refusal, note: createElement('p', { 'data-note': '' }, 'An app asks'), pick: vi.fn(async () => Promise.reject(new Error('x'))) })
    expect(m.host.querySelector('[data-frame="Accounts"]')).toBeTruthy()
    expect(m.host.querySelector('[data-note]')?.textContent).toBe('An app asks')
    expect(m.press('Continue as carol@example.com').getAttribute('aria-current')).toBe('true')
    expect(m.press('Continue as bob@hanzo.ai').getAttribute('aria-current')).toBeNull()
    await act(async () => m.press('Continue as bob@hanzo.ai').click())
    expect(m.host.querySelector('[data-refusal]')?.textContent).toBe('Something went wrong. Try again.')
    await m.done()
  })
})
