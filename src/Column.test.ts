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
vi.mock('@hanzo/build', () => {
  const route = (at: string) =>
    at === '-/artifacts'
      ? { kind: 'screen', screen: 'artifacts' }
      : at === '-/automations'
        ? { kind: 'screen', screen: 'automations' }
        : at.startsWith('-/customize')
          ? { kind: 'customize', tab: 'agents' }
          : at.startsWith('-/settings')
            ? { kind: 'settings', section: 'general' }
            : { kind: 'new' }
  const group = (id: string, label: string, names: string[]) => ({ id, label, links: names.map((n) => ({ id: n.toLowerCase(), label: n, icon: null })) })
  return {
    DOTS: {},
    Gutter: () => null,
    path: () => '-/settings/notifications',
    route,
    useSessions: () => ({ value: [], loading: false, error: null, reload: () => {} }),
    NEW: 'new',
    own: () => [group('work', 'Work', ['New run', 'Projects', 'Issues', 'Templates'])],
    sections: () => [group('Settings', '', ['General', 'Account']), group('Organization', 'Organization', ['Members'])],
    tabs: () => [group('customize', '', ['Agents', 'Skills', 'Connectors', 'Plugins'])],
    library: () => [group('library-do', '', ['Upload']), group('library-kinds', '', ['All', 'Images', 'Documents'])],
    useScheduled: () => [group('scheduled-do', '', ['New task']), group('scheduled-tasks', 'Tasks', ['Morning brief'])],
  }
})
vi.mock('./Me', () => ({ Made: () => null, Me: () => createElement('div', { 'data-slot': 'me' }) }))
vi.mock('./Recents', () => ({ Recents: () => createElement('div', { 'data-slot': 'recents' }) }))
vi.mock('./Setup', () => ({ Setup: () => null }))
vi.mock('./span', () => ({ useSpan: () => ({ ref: null, style: {}, span: 272, move: () => {}, keep: () => {} }) }))

import { Column } from './Column'
import { Rail } from './Rail'
import { TABS, WORKSPACE, type Place } from './lib/host'

const hostAt = (path = '') => ({ go: () => {}, path }) as unknown as Parameters<typeof Column>[0]['host']
const host = hostAt()
const noop = () => {}

const column = (mode: Place['mode'], path = '') => renderToStaticMarkup(createElement(Column, { host: hostAt(path), mode, thread: null, go: noop, onShut: noop, onBack: noop }))
const rail = (mode: Place['mode'], toggle?: () => void, where: string | null = null) =>
  renderToStaticMarkup(createElement(Rail, { host, mode, at: where, open: true, toggle, onChat: noop, onDev: noop, onStudio: noop, onTabs: noop, go: noop, onOrg: noop }))

/** Where a string first stands in the markup, failing when it is absent. */
const at = (html: string, s: string): number => {
  const i = html.indexOf(s)
  expect(i, s).toBeGreaterThanOrEqual(0)
  return i
}

describe('the rail', () => {
  test('Chat, Dev, Studio, Tabs, Library, Scheduled tasks, Customize, then More, and the account at the foot', () => {
    const html = rail('chat')
    const order = ['Chat', 'Dev', 'Studio', 'Tabs', 'Library', 'Scheduled tasks', 'Customize', 'More'].map((n) => at(html, `aria-label="${n}"`))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(at(html, 'data-slot="me"')).toBeGreaterThan(order.at(-1)!)
    for (const place of ['Templates', 'Projects', 'Issues', 'Machines', 'Environments']) {
      expect(html, `${place} is Dev’s, listed in Dev’s sidebar alone`).not.toContain(`aria-label="${place}"`)
    }
  })

  test('a place on the rail is lit while the reader is on it, and Dev is not', () => {
    expect(rail('dev', undefined, '')).toMatch(/aria-label="Dev" aria-current="page"/)
    const library = rail('dev', undefined, '-/artifacts')
    expect(library).toMatch(/aria-label="Library" aria-current="page"/)
    expect(library).not.toMatch(/aria-label="Dev" aria-current="page"/)
    expect(rail('dev', undefined, '-/customize')).toMatch(/aria-label="Customize" aria-current="page"/)
    expect(rail('dev', undefined, '-/settings')).not.toMatch(/aria-label="Dev" aria-current="page"/)
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

  test('More holds the products on hosts of their own, and none of Dev’s places; Tabs is drawn in the app', () => {
    const html = rail('chat')
    expect(at(html, 'data-item="team"')).toBeGreaterThan(at(html, 'aria-label="More"'))
    for (const k of ['tabs', 'projects', 'templates', 'issues', 'machines', 'environments', 'library', 'scheduled', 'customize']) expect(html).not.toContain(`data-item="${k}"`)
    expect(html, 'nothing on the rail leaves for tabs.hanzo.ai').not.toContain(TABS)
    expect(TABS).toBe('https://tabs.hanzo.ai')
    expect(WORKSPACE).toBe('https://hanzo.team')
  })

  test('Studio offers no Team: no More on a laptop, and a phone’s More holds the raised places alone', () => {
    const html = rail('studio')
    expect(html).not.toContain('data-item="team"')
    expect(html).not.toContain('aria-label="More"')
    const flat = renderToStaticMarkup(createElement(Rail, { host, mode: 'studio', at: null, open: true, flat: true, onChat: noop, onDev: noop, onStudio: noop, onTabs: noop, go: noop, onOrg: noop }))
    expect(flat).toContain('data-item="library"')
    expect(flat).not.toContain('data-item="team"')
    expect(flat).not.toContain('data-item="raised"')
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

  test('Dev: its name, then its own places, then Recents; nothing the rail holds', () => {
    const html = column('dev')
    expect(at(html, 'Hanzo Dev')).toBeLessThan(at(html, 'New run'))
    expect(at(html, 'New run')).toBeLessThan(at(html, 'Templates'))
    expect(at(html, 'Templates')).toBeLessThan(at(html, 'data-slot="recents"'))
    for (const word of ['Library', 'Scheduled tasks', 'Customize', '>Make<', '>Run<', '>Setup<']) expect(html).not.toContain(word)
    expect(html).not.toContain(TABS)
  })

  test('Settings and Customize take the sidebar: Back, the name, their own rows, and nothing of Dev’s', () => {
    const settings = column('dev', '-/settings')
    expect(at(settings, 'aria-label="Back"')).toBeLessThan(at(settings, '>Settings<'))
    expect(at(settings, 'General')).toBeLessThan(at(settings, 'Members'))
    for (const word of ['New run', 'data-slot="recents"', 'aria-label="Search"']) expect(settings).not.toContain(word)
    const customize = column('dev', '-/customize')
    expect(at(customize, '>Customize<')).toBeLessThan(at(customize, 'Agents'))
    expect(at(customize, 'Agents')).toBeLessThan(at(customize, 'Skills'))
    const library = column('dev', '-/artifacts')
    expect(at(library, '>Library<')).toBeLessThan(at(library, 'Upload'))
    expect(at(library, 'Upload')).toBeLessThan(at(library, 'Images'))
    expect(library).not.toContain('New run')
    const scheduled = column('dev', '-/automations')
    expect(at(scheduled, '>Scheduled tasks<')).toBeLessThan(at(scheduled, 'New task'))
    expect(at(scheduled, 'New task')).toBeLessThan(at(scheduled, 'Morning brief'))
    expect(scheduled).not.toContain('New run')
  })

  test('the search is the palette, in every mode: the sidebar holds no field of its own', () => {
    for (const mode of ['chat', 'dev', 'studio'] as const) {
      const html = column(mode, '')
      expect(html).toContain('aria-label="Search"')
      expect(html).not.toContain('<input')
    }
  })
})
