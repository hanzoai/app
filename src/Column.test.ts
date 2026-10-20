import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

// The drawing libraries are not under test and do not load outside a bundler.
// A part draws its children as a div, or, given `render`, as that element, the
// way gui draws a part into the element it is handed. A menu draws its trigger
// and then each item's label, in order, as if open.
const { part, menu } = vi.hoisted(() => {
  type Part = {
    children?: ReactNode
    render?: ReactElement | string
    icon?: ReactNode
    label?: string
    'aria-label'?: string
    'aria-current'?: string
    'data-slot'?: string
    role?: string
  }
  const part = ({ children, render, icon, label, 'aria-label': named, 'aria-current': current, 'data-slot': slot, role }: Part) => {
    const attrs = { 'data-slot': slot, 'aria-label': label ?? named, 'aria-current': current, role }
    const kids = [icon, children].filter((k) => k != null)
    if (isValidElement(render)) return cloneElement(render, attrs, ...kids)
    return createElement(typeof render === 'string' ? render : 'div', attrs, ...kids)
  }
  const menu = ({ trigger, items }: { trigger: ReactElement; items: { key: string; label?: string; description?: string }[] }) =>
    createElement('div', { 'data-slot': 'menu' }, trigger, ...items.map((i) => createElement('span', { key: i.key, 'data-item': i.key }, `${i.label} ${i.description ?? ''}`)))
  return { part, menu }
})

vi.mock('@hanzo/gui', () => ({ Text: part, XStack: part, YStack: part }))
vi.mock('@hanzo/ui', () => ({ DropdownMenu: menu }))
vi.mock('@hanzo/ui/chat', () => ({ Sidebar: part, SidebarIconButton: part, SidebarItem: part, StatusDot: () => null }))
vi.mock('@hanzogui/shell', () => ({ HanzoMark: () => null }))
vi.mock('@hanzo/build', () => ({
  DOTS: {},
  Grip: () => null,
  path: () => '-/settings/notifications',
  route: (at: string) => (at === '-/artifacts' ? { kind: 'screen', screen: 'artifacts' } : at === '-/customize' ? { kind: 'customize' } : { kind: 'new' }),
  useSessions: () => ({ value: [], loading: false, error: null, reload: () => {} }),
  NEW: 'new',
  nav: () => [
    {
      id: 'work',
      label: 'Work',
      links: [
        { id: 'new', label: 'New run', icon: null },
        { id: 'projects', label: 'Projects', icon: null },
      ],
    },
  ],
}))
vi.mock('./Me', () => ({ Made: () => null, Me: () => createElement('div', { 'data-slot': 'me' }) }))
vi.mock('./Recents', () => ({ Recents: () => createElement('div', { 'data-slot': 'recents' }) }))
vi.mock('./Setup', () => ({ Setup: () => null }))
vi.mock('./span', () => ({ useSpan: () => ({ ref: null, style: {}, span: 272, move: () => {}, keep: () => {} }) }))

import { Column } from './Column'
import { Rail } from './Rail'
import { TABS, WORKSPACE, type Place } from './lib/host'
import type { Mode } from './recent'

const host = { go: () => {} } as unknown as Parameters<typeof Column>[0]['host']
const noop = () => {}

const column = (mode: Place['mode']) => renderToStaticMarkup(createElement(Column, { host, mode, thread: null, go: noop, onShut: noop }))
const rail = (mode: Mode, toggle?: () => void, at: string | null = null) =>
  renderToStaticMarkup(createElement(Rail, { host, mode, at, open: true, toggle, onChat: noop, onDev: noop, onStudio: noop, go: noop, onOrg: noop }))

/** Where a string first stands in the markup, failing when it is absent. */
const at = (html: string, s: string): number => {
  const i = html.indexOf(s)
  expect(i, s).toBeGreaterThanOrEqual(0)
  return i
}

describe('the rail', () => {
  test('Chat, Dev, Studio, Library, Scheduled tasks, Customize, then More, and the account at the foot', () => {
    const html = rail('chat')
    const order = ['Chat', 'Dev', 'Studio', 'Library', 'Scheduled tasks', 'Customize', 'More'].map((n) => at(html, `aria-label="${n}"`))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(at(html, 'data-slot="me"')).toBeGreaterThan(order.at(-1)!)
  })

  test('a place raised out of Dev is lit where the reader stands, and Dev for the rest of Dev', () => {
    expect(rail('dev', undefined, '-/artifacts')).toMatch(/aria-label="Library" aria-current="page"/)
    expect(rail('dev', undefined, '-/artifacts')).not.toMatch(/aria-label="Dev" aria-current="page"/)
    expect(rail('dev', undefined, '-/customize')).toMatch(/aria-label="Customize" aria-current="page"/)
    expect(rail('dev', undefined, '')).toMatch(/aria-label="Dev" aria-current="page"/)
  })

  test('the mode the reader is in is the one lit', () => {
    expect(rail('chat')).toMatch(/aria-label="Chat" aria-current="page"/)
    expect(rail('chat')).not.toMatch(/aria-label="Dev" aria-current="page"/)
    expect(rail('dev')).toMatch(/aria-label="Dev" aria-current="page"/)
  })

  test('the sidebar toggle leads it where the host asks, and only there', () => {
    expect(rail('chat')).not.toContain('sidebar-toggle')
    const html = rail('chat', noop)
    expect(at(html, 'data-slot="sidebar-toggle"')).toBeLessThan(at(html, 'aria-label="Chat"'))
    expect(html).toContain('aria-label="Close sidebar"')
  })

  test('More holds the rest: Dev’s other places, then the apps on hosts of their own', () => {
    const html = rail('chat')
    const order = ['projects', 'templates', 'issues', 'machines', 'environments', 'tabs', 'team'].map((k) => at(html, `data-item="${k}"`))
    expect(order[0]).toBeGreaterThan(at(html, 'aria-label="More"'))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(TABS).toBe('https://tabs.hanzo.ai')
    expect(WORKSPACE).toBe('https://hanzo.team')
  })
})

describe('the sidebar', () => {
  test('carries no switch between the modes: the rail is how the app moves', () => {
    for (const mode of ['chat', 'dev'] as const) {
      const html = column(mode)
      expect(html).not.toContain('Switch Hanzo')
      expect(html).not.toContain('mode-switch')
    }
  })

  test('Chat: its name, the bell and the search, New chat, then Recents', () => {
    const html = column('chat')
    expect(at(html, 'Hanzo AI')).toBeLessThan(at(html, 'aria-label="Activity"'))
    expect(at(html, 'aria-label="Activity"')).toBeLessThan(at(html, 'aria-label="Search"'))
    expect(at(html, 'aria-label="Search"')).toBeLessThan(at(html, 'New chat'))
    expect(at(html, 'New chat')).toBeLessThan(at(html, 'data-slot="recents"'))
    expect(html, 'Tabs lives behind the rail’s More').not.toContain(TABS)
  })

  test('Dev: its name, then every place, then Recents', () => {
    const html = column('dev')
    expect(at(html, 'Hanzo Dev')).toBeLessThan(at(html, 'New run'))
    expect(at(html, 'New run')).toBeLessThan(at(html, 'Projects'))
    expect(at(html, 'Projects')).toBeLessThan(at(html, 'data-slot="recents"'))
    expect(html).not.toContain(TABS)
  })

  test('the search is the palette, in every mode: the sidebar holds no field of its own', () => {
    for (const mode of ['chat', 'dev', 'studio'] as const) {
      const html = column(mode)
      expect(html).toContain('aria-label="Search"')
      expect(html).not.toContain('<input')
    }
  })
})
