// @vitest-environment happy-dom
// A DOM, so a real I18nProvider runs its effect and loads a catalog; the markup
// tests below render with no provider at all and read English.
import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// What the bar reads, set per test: the session, and who the token names.
const state = vi.hoisted(() => ({
  iam: { isAuthenticated: true, user: null as Record<string, string> | null },
  named: { name: 'Bob Ross', display: 'Bob Ross', email: 'bob@hanzo.ai' } as { name: string; display: string; email: string } | null,
  accounts: { accounts: [], current: null, switchTo: async () => {}, add: async () => {} } as {
    accounts: { sub: string; owner: string; name: string; displayName: string; email: string; avatar: string }[]
    current: { sub: string } | null
    switchTo: () => Promise<void>
    add: () => Promise<void>
  },
}))

// The drawing libraries are not under test and do not load outside a bundler.
// A gui element draws the element it is given to render, with its children; the
// menu draws its content, so the folded account's two ways out are in the markup.
// Its accessible name is kept: it is what a reader and the gates know it by.
// gui stamps its own `data-slot` on what it draws, so a slot the bar names is a prop; the mock stamps it the same way.
const draw = ({ render, children, 'aria-label': named, 'data-scrolled': scrolled, 'data-slot': slot, bg }: { render?: ReactElement | string; children?: ReactNode; 'aria-label'?: string; 'data-scrolled'?: string; 'data-slot'?: string; bg?: string }) =>
  isValidElement(render)
    ? cloneElement(render, slot ? ({ 'data-slot': slot } as object) : undefined, children)
    : createElement(typeof render === 'string' ? render : 'div', { ...(named ? { 'aria-label': named } : null), ...(scrolled ? { 'data-scrolled': scrolled, 'data-bg': bg } : null) }, children)
const pass = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
vi.mock('@hanzo/gui', () => ({ Text: draw, View: draw, XStack: draw, YStack: draw }))
vi.mock('@hanzo/ui', () => ({
  Avatar: () => null,
  Button: ({ children }: { children?: ReactNode }) => createElement('button', null, children),
  DropdownMenu: pass,
  DropdownMenuContent: pass,
  DropdownMenuItem: ({ children, onSelect }: { children?: ReactNode; onSelect?: () => void }) => createElement('button', { onClick: onSelect }, children),
  DropdownMenuLabel: pass,
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: pass,
}))
vi.mock('@hanzogui/shell', () => ({ HanzoWordmark: ({ label }: { label: string }) => createElement('span', null, label) }))
vi.mock('@hanzo/iam/react', () => ({ useIam: () => state.iam }))
vi.mock('./lib/session', () => ({ named: () => state.named }))
vi.mock('./lib/accounts', async (original) => ({ ...(await original<typeof import('./lib/accounts')>()), useAccounts: () => state.accounts }))
vi.mock('./lib/signout', () => ({ useSignOut: () => async () => {} }))
vi.mock('./where', () => ({ brand: () => 'Hanzo AI', site: (p: string) => p }))

const { Chrome } = await import('./Chrome')
const { I18nProvider } = await import('@hanzo/i18n/react')
const { default: fr } = await import('@hanzo/i18n/catalogs/fr-FR.json')

const drawn = (back?: ReactNode, account?: ReactNode) => renderToStaticMarkup(createElement(Chrome, account === undefined ? { back } : { back, account }))

describe('the focused pages\' bar', () => {
  beforeEach(() => {
    state.iam = { isAuthenticated: true, user: null }
    state.named = { name: 'Bob Ross', display: 'Bob Ross', email: 'bob@hanzo.ai' }
  })

  test('the brand leads it and goes to this host\'s root', () => {
    const html = drawn()
    expect(html).toContain('href="/"')
    expect(html).toContain('aria-label="Hanzo AI home"')
    expect(html).toContain('data-slot="home"')
    expect(html).toContain('>Hanzo AI<')
  })

  test('a host\'s own account control stands in the bar\'s, and null draws none', () => {
    const own = drawn(undefined, createElement('button', { 'aria-label': 'Account: Ada' }, 'Ada'))
    expect(own).toContain('aria-label="Account: Ada"')
    expect(own).not.toContain('Bob Ross')
    expect(own).not.toContain('Log out')
    const none = drawn(undefined, null)
    expect(none).toContain('>Hanzo AI<')
    expect(none).not.toContain('aria-label="Account')
  })

  test('signed in, it collapses account actions into the account dropdown menu', () => {
    const html = drawn()
    expect(html.match(/>Bob Ross</g)).toHaveLength(1)
    expect(html.match(/>bob@hanzo\.ai</g)).toHaveLength(1)
    expect(html.match(/>Add account</g)).toHaveLength(1)
    expect(html.match(/>Log out</g)).toHaveLength(1)
    expect(html).toContain('aria-label="Account: Bob Ross"')
  })

  test('IAM\'s own account outranks the token\'s claims', () => {
    state.iam = { isAuthenticated: true, user: { displayName: 'Robert Ross', email: 'robert@hanzo.ai' } }
    const html = drawn()
    expect(html).toContain('>Robert Ross<')
    expect(html).toContain('>robert@hanzo.ai<')
    expect(html).not.toContain('Bob Ross')
  })

  test('a token with no display name is named by its address alone', () => {
    state.named = { name: '', display: '', email: 'bob@hanzo.ai' }
    expect(drawn().match(/>bob@hanzo\.ai</g)).toHaveLength(1)
  })

  test('signed out, the brand alone: nobody named and no way out offered', () => {
    state.iam = { isAuthenticated: false, user: null }
    const html = drawn()
    expect(html).toContain('>Hanzo AI<')
    expect(html).not.toContain('aria-label="Account')
    expect(html).not.toContain('Log out')
    expect(html).not.toContain('Add account')
  })

  test('the host\'s back stands after the brand', () => {
    const html = drawn(createElement('button', null, 'Back'))
    expect(html.indexOf('>Back<')).toBeGreaterThan(html.indexOf('>Hanzo AI<'))
    expect(html.indexOf('>Back<')).toBeLessThan(html.indexOf('>Bob Ross<'))
  })

  test('under a provider in French, the ways out read in French', async () => {
    expect(fr['Log out']).not.toBe('Log out')
    const at = document.createElement('div')
    const root = createRoot(at)
    await act(async () => root.render(createElement(I18nProvider, { userId: 'bob', initialLocale: 'fr-FR' }, createElement(Chrome))))
    await vi.waitFor(() => expect(at.innerHTML.match(new RegExp(`>${fr['Log out']}<`, 'g'))).toHaveLength(1))
    expect(at.innerHTML).toContain(`aria-label="${fr['Account']}"`)
    expect(at.innerHTML).not.toContain('>Log out<')
    await act(async () => root.unmount())
  })
})

describe('the bar\'s ground', () => {
  const html = () => document.body.innerHTML

  test('at rest it has none, so the page\'s light runs up behind it; the page moving under it gives it glass', async () => {
    state.iam = { isAuthenticated: false, user: null }
    state.named = null
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(createElement(Chrome, {})))
    expect(html()).toContain('data-scrolled="false"')
    expect(html()).toContain('data-bg="transparent"')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 })
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(html()).toContain('data-scrolled="true"')
    expect(html()).toContain('data-bg="$background/72"')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(html()).toContain('data-bg="transparent"')
    await act(async () => root.unmount())
    host.remove()
  })
})

describe('the bar\'s other accounts', () => {
  const bob = { sub: 's1', owner: 'hanzo', name: 'bob', displayName: 'Bob Ross', email: 'bob@hanzo.ai', avatar: '' }
  const carol = { sub: 's2', owner: 'hanzo', name: 'carol', displayName: 'Carol Ames', email: 'carol@example.com', avatar: '' }

  beforeEach(() => {
    state.iam = { isAuthenticated: true, user: null }
    state.named = { name: 'Bob Ross', display: 'Bob Ross', email: 'bob@hanzo.ai' }
  })

  test('the accounts signed in on this browser are one tap away, and this one is not among them', () => {
    state.accounts = { ...state.accounts, accounts: [bob, carol], current: bob }
    const html = drawn()
    expect(html.match(/>Carol Ames</g)).toHaveLength(1)
    expect(html.match(/>carol@example\.com</g)).toHaveLength(1)
    expect(html.match(/>bob@hanzo\.ai</g), 'the reader once, in the menu\'s heading').toHaveLength(1)
  })

  test('a tap is being that account, Add account is adding one, and neither signs anyone out', async () => {
    const switchTo = vi.fn(async () => {})
    const add = vi.fn(async () => {})
    state.accounts = { accounts: [bob, carol], current: bob, switchTo, add }
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(createElement(Chrome, {})))
    const press = async (text: string) => {
      const button = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text))
      expect(button, text).toBeTruthy()
      await act(async () => button!.click())
    }
    await press('Carol Ames')
    expect(switchTo).toHaveBeenCalledWith(carol)
    await press('Add account')
    expect(add).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
    host.remove()
  })
})

describe('the way home', () => {
  test('a mouse over the name lights it (the highlight and the arrow); leaving puts it out; a finger never lights it', async () => {
    state.iam = { isAuthenticated: false, user: null }
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    await act(async () => root.render(createElement(Chrome, {})))
    const home = host.querySelector<HTMLAnchorElement>('a[data-slot="home"]')!
    expect(home.getAttribute('data-lit')).toBe('false')
    const point = async (type: string, pointerType: string) =>
      act(async () => {
        home.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType, relatedTarget: document.body }))
      })
    await point('pointerover', 'mouse')
    expect(home.getAttribute('data-lit')).toBe('true')
    await point('pointerout', 'mouse')
    expect(home.getAttribute('data-lit')).toBe('false')
    await point('pointerover', 'touch')
    expect(home.getAttribute('data-lit')).toBe('false')
    await act(async () => root.unmount())
    host.remove()
  })
})
