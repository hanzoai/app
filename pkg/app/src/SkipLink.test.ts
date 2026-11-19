// @vitest-environment happy-dom
// The skip link and the page's main area are written from one `MAIN`, so the link lands on the pane Split draws.
import { act, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/gui', () => ({
  Text: ({ children }: { children?: ReactNode }) => createElement('span', null, children),
  XStack: ({ render, children, 'data-slot': slot }: { render?: { props: { href: string } }; children?: ReactNode; 'data-slot'?: string }) =>
    createElement('a', { href: render?.props.href, 'data-slot': slot }, children),
}))

const { MAIN, SkipLink } = await import('./SkipLink')

test('the skip link lands on an element drawn with MAIN, which is a focusable main landmark', () => {
  const box = document.createElement('div')
  document.body.append(box)
  const root = createRoot(box)
  // What Split draws its pane with: {...MAIN} on a `main` element.
  const pane = createElement('main', { id: MAIN.id, tabIndex: MAIN.tabIndex }, 'page')
  act(() => root.render(createElement('div', null, createElement(SkipLink), pane)))
  const link = box.querySelector<HTMLAnchorElement>('[data-slot="skip-link"]')!
  expect(link.textContent).toBe('Skip to main content')
  const target = box.querySelector<HTMLElement>(new URL(link.href).hash)
  expect(target?.tagName).toBe('MAIN')
  expect(MAIN.render).toBe('main')
  expect(target?.tabIndex).toBe(-1)
  act(() => root.unmount())
})
