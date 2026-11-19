// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/gui', () => ({
  Text: ({ children }: { children?: ReactNode }) => createElement('span', null, children),
  XStack: ({ render, children, 'data-slot': slot }: { render?: { props: { href: string } }; children?: ReactNode; 'data-slot'?: string }) =>
    createElement('a', { href: render?.props.href, 'data-slot': slot }, children),
}))

const { SkipLink } = await import('./SkipLink')

test('the skip link is the first link on the page and lands on the page’s own main area', () => {
  const box = document.createElement('div')
  document.body.append(box)
  const main = Object.assign(document.createElement('main'), { id: 'main-content', tabIndex: -1 })
  const root = createRoot(box)
  act(() => root.render(createElement(SkipLink)))
  document.body.append(main)
  const link = box.querySelector<HTMLAnchorElement>('[data-slot="skip-link"]')!
  expect(link.textContent).toBe('Skip to main content')
  const target = document.querySelector(new URL(link.href).hash)
  expect(target).toBe(main)
  act(() => root.unmount())
})
