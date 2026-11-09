// @vitest-environment happy-dom
import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  accounts: { accounts: [], current: null, switchTo: async () => {}, add: async () => {}, leave: async () => true } as {
    accounts: { sub: string; owner: string; name: string; displayName: string; email: string; avatar: string }[]
    current: { sub: string; displayName: string; name: string; email: string } | null
    switchTo: (a: unknown) => Promise<void>
    add: () => Promise<void>
    leave: (a: unknown) => Promise<boolean>
  },
}))

const draw = ({ render, children }: { render?: ReactElement | string; children?: ReactNode }) =>
  isValidElement(render) ? cloneElement(render, undefined, children) : createElement(typeof render === 'string' ? render : 'div', undefined, children)
vi.mock('@hanzo/gui', () => ({ Text: draw, View: draw, XStack: draw, YStack: draw }))
vi.mock('@hanzo/ui', () => ({
  Avatar: () => null,
  DropdownMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) => createElement('button', { onClick: onSelect }, children),
}))
vi.mock('./lib/signout', () => ({ here: () => true, OUT: '/login?from=logout', useClient: () => ({}) }))
vi.mock('lucide-react', () => ({ LogOut: () => null, UserPlus: () => null }))
vi.mock('./lib/accounts', async (original) => ({ ...(await original<typeof import('./lib/accounts')>()), useAccounts: () => state.accounts }))

const { Others } = await import('./Others')

const bob = { sub: 's1', owner: 'hanzo', name: 'bob', displayName: 'Bob Ross', email: 'bob@hanzo.ai', avatar: '' }
const carol = { sub: 's2', owner: 'hanzo', name: 'carol', displayName: 'Carol Ames', email: 'carol@example.com', avatar: '' }

async function mount(props: Partial<Parameters<typeof Others>[0]> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const out = vi.fn()
  await act(async () => root.render(createElement(Others, { out, ...props })))
  const press = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!
  return { host, out, press, done: async () => (await act(async () => root.unmount()), host.remove()) }
}

describe('the account menu rows', () => {
  beforeEach(() => {
    state.accounts = { accounts: [bob, carol], current: bob, switchTo: vi.fn(async () => {}), add: vi.fn(async () => {}), leave: vi.fn(async () => true) }
  })

  test('with several signed in: the others, Add account, this one’s own way out, and all of them', async () => {
    const m = await mount()
    const texts = [...m.host.querySelectorAll('button')].map((b) => b.textContent)
    expect(texts).toEqual(['Carol Amescarol@example.com', 'Add account', 'Sign out Bob Ross', 'Sign out of all accounts'])
    await m.done()
  })

  test('alone it is Add account and Log out, which is all of it', async () => {
    state.accounts = { ...state.accounts, accounts: [bob], current: bob }
    const m = await mount()
    expect([...m.host.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Add account', 'Log out'])
    await m.done()
  })

  test('a press is lib/accounts’ unless the host hands its own', async () => {
    const m = await mount()
    await act(async () => m.press('Carol Ames').click())
    expect(state.accounts.switchTo).toHaveBeenCalledWith(carol)
    await act(async () => m.press('Add account').click())
    expect(state.accounts.add).toHaveBeenCalledTimes(1)
    await act(async () => m.press('Sign out Bob Ross').click())
    expect(state.accounts.leave).toHaveBeenCalledWith(bob)
    expect(m.out).not.toHaveBeenCalled()
    await act(async () => m.press('Sign out of all accounts').click())
    expect(m.out).toHaveBeenCalledTimes(1)
    await m.done()

    const pick = vi.fn()
    const add = vi.fn()
    const own = await mount({ pick, add })
    await act(async () => own.press('Carol Ames').click())
    await act(async () => own.press('Add account').click())
    expect(pick).toHaveBeenCalledWith(carol)
    expect(add).toHaveBeenCalledTimes(1)
    expect(state.accounts.switchTo).toHaveBeenCalledTimes(1)
    expect(state.accounts.add).toHaveBeenCalledTimes(1)
    await own.done()
  })
})
