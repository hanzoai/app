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
}))

// The drawing libraries are not under test and do not load outside a bundler.
// A gui element draws the element it is given to render, with its children; the
// menu draws its content, so the folded account's two ways out are in the markup.
// Its accessible name is kept: it is what a reader and the gates know it by.
const draw = ({ render, children, 'aria-label': named }: { render?: ReactElement | string; children?: ReactNode; 'aria-label'?: string }) =>
  isValidElement(render)
    ? cloneElement(render, undefined, children)
    : createElement(typeof render === 'string' ? render : 'div', named ? { 'aria-label': named } : null, children)
const pass = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
vi.mock('@hanzo/gui', () => ({ Text: draw, View: draw, XStack: draw, YStack: draw }))
vi.mock('@hanzo/ui', () => ({
  Avatar: () => null,
  Button: ({ children }: { children?: ReactNode }) => createElement('button', null, children),
  DropdownMenu: pass,
  DropdownMenuContent: pass,
  DropdownMenuItem: ({ children }: { children?: ReactNode }) => createElement('button', null, children),
  DropdownMenuLabel: pass,
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: pass,
}))
vi.mock('@hanzogui/shell', () => ({ HanzoWordmark: ({ label }: { label: string }) => createElement('span', null, label) }))
vi.mock('@hanzo/iam/react', () => ({ useIam: () => state.iam }))
vi.mock('./lib/session', () => ({ named: () => state.named }))
vi.mock('./lib/destination', () => ({ rememberDestination: () => {} }))
vi.mock('./lib/signout', () => ({ useSignOut: () => async () => {} }))
vi.mock('./where', () => ({ brand: () => 'Hanzo AI' }))

const { Chrome } = await import('./Chrome')
const { I18nProvider } = await import('@hanzo/i18n/react')
const { default: fr } = await import('@hanzo/i18n/catalogs/fr-FR.json')

const drawn = (back?: ReactNode) => renderToStaticMarkup(createElement(Chrome, { back }))

describe('the focused pages\' bar', () => {
  beforeEach(() => {
    state.iam = { isAuthenticated: true, user: null }
    state.named = { name: 'Bob Ross', display: 'Bob Ross', email: 'bob@hanzo.ai' }
  })

  test('the brand leads it and goes to this host\'s root', () => {
    const html = drawn()
    expect(html).toContain('href="/"')
    expect(html).toContain('aria-label="Hanzo AI home"')
    expect(html).toContain('>Hanzo AI<')
  })

  test('signed in, it names who, wide and folded, with both ways out in each', () => {
    const html = drawn()
    expect(html.match(/>Bob Ross</g)).toHaveLength(2)
    expect(html.match(/>bob@hanzo\.ai</g)).toHaveLength(2)
    expect(html.match(/>Use another account</g)).toHaveLength(2)
    expect(html.match(/>Log out</g)).toHaveLength(2)
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
    expect(drawn().match(/>bob@hanzo\.ai</g)).toHaveLength(2)
  })

  test('signed out, the brand alone: nobody named and no way out offered', () => {
    state.iam = { isAuthenticated: false, user: null }
    const html = drawn()
    expect(html).toContain('>Hanzo AI<')
    expect(html).not.toContain('aria-label="Account')
    expect(html).not.toContain('Log out')
    expect(html).not.toContain('Use another account')
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
    await vi.waitFor(() => expect(at.innerHTML.match(new RegExp(`>${fr['Log out']}<`, 'g'))).toHaveLength(2))
    expect(at.innerHTML).toContain(`aria-label="${fr['Account']}"`)
    expect(at.innerHTML).not.toContain('>Log out<')
    await act(async () => root.unmount())
  })
})
