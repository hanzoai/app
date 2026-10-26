// @vitest-environment happy-dom
import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  accounts: { accounts: [], current: null, switchTo: async () => {}, add: async () => {} } as {
    accounts: { sub: string; owner: string; name: string; displayName: string; email: string; avatar: string }[]
    current: { sub: string } | null
    switchTo: (a: unknown) => Promise<void>
    add: () => Promise<void>
  },
  out: vi.fn(async () => {}),
}))

// A gui element draws the element it is given to render, with its children; the props a row is found by are kept.
const draw = ({ render, children, onClick, 'aria-label': named, 'aria-current': current }: { render?: ReactElement | string; children?: ReactNode; onClick?: () => void; 'aria-label'?: string; 'aria-current'?: boolean }) =>
  isValidElement(render)
    ? cloneElement(render, undefined, children)
    : createElement(typeof render === 'string' ? render : 'div', { onClick, 'aria-label': named, 'aria-current': current ? 'true' : undefined }, children)
vi.mock('@hanzo/gui', () => ({ Text: draw, View: draw, XStack: draw, YStack: draw }))
vi.mock('@hanzo/ui', () => ({
  Avatar: () => null,
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => createElement('button', { onClick }, children),
}))
vi.mock('./lib/accounts', async (original) => ({ ...(await original<typeof import('./lib/accounts')>()), useAccounts: () => state.accounts }))
vi.mock('./lib/signout', () => ({ useSignOut: () => state.out }))

const { Accounts } = await import('./Accounts')

const bob = { sub: 's1', owner: 'hanzo', name: 'bob', displayName: 'Bob Ross', email: 'bob@hanzo.ai', avatar: '' }
const carol = { sub: 's2', owner: 'hanzo', name: 'carol', displayName: 'Carol Ames', email: 'carol@example.com', avatar: '' }

describe('the accounts section', () => {
  beforeEach(() => {
    state.accounts = { accounts: [bob, carol], current: bob, switchTo: vi.fn(async () => {}), add: vi.fn(async () => {}) }
    state.out.mockClear()
  })

  test('is nothing when IAM holds no account for this browser', () => {
    state.accounts = { ...state.accounts, accounts: [], current: null }
    expect(renderToStaticMarkup(createElement(Accounts))).toBe('')
  })

  test('lists every account with its name and address, this one marked, and says nothing else', () => {
    const html = renderToStaticMarkup(createElement(Accounts))
    for (const text of ['Bob Ross', 'bob@hanzo.ai', 'Carol Ames', 'carol@example.com', 'Add account', 'Log out']) expect(html).toContain(`>${text}<`)
    expect(html.match(/aria-current="true"/g), 'one account is this one').toHaveLength(1)
    // A heading, the rows and two buttons: no paragraph explains any of it.
    expect(html).not.toMatch(/<p[\s>]/)
  })

  test('a tap on another is being it, on this one is nothing, and Log out is IAM\'s, for all', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(createElement(Accounts)))
    const row = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!
    await act(async () => row('Bob Ross').click())
    expect(state.accounts.switchTo).not.toHaveBeenCalled()
    await act(async () => row('Carol Ames').click())
    expect(state.accounts.switchTo).toHaveBeenCalledWith(carol)
    await act(async () => row('Add account').click())
    expect(state.accounts.add).toHaveBeenCalledTimes(1)
    await act(async () => row('Log out').click())
    expect(state.out).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
    host.remove()
  })
})
