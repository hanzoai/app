import { cloneElement, createElement, Fragment, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const { part, menu, menuItem, menuLabel, menuBack, menuSeparator, through, devState } = vi.hoisted(() => {
  type Part = {
    children?: ReactNode
    render?: ReactElement | string
    icon?: ReactNode
    label?: string
    'aria-label'?: string
    'aria-current'?: string
    'data-slot'?: string
    role?: string
    'data-item'?: string
    active?: boolean
  }
  const devState = { on: false, opened: new Set(['finance']) }
  const through = ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children)
  const part = ({ children, render, icon, label, 'aria-label': named, 'aria-current': current, 'data-slot': slot, 'data-item': item, role, active }: Part) => {
    const attrs = { 'data-slot': slot, 'data-item': item, 'aria-label': label ?? named, 'aria-current': current ?? (active ? 'page' : undefined), role }
    const kids = [icon, children].filter((k) => k != null)
    if (isValidElement(render)) return cloneElement(render, attrs, ...kids)
    return createElement(typeof render === 'string' ? render : 'div', attrs, ...kids)
  }
  const menu = ({ trigger, items, children }: { trigger: ReactElement; items?: { key: string; label?: string; description?: string }[]; children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'menu' }, trigger, ...(items ?? []).map((i) => createElement('span', { key: i.key, 'data-item': i.key }, `${i.label} ${i.description ?? ''}`)), children)
  const menuItem = ({ children, actions, page, 'aria-current': current, 'data-item': key }: { children?: ReactNode; actions?: ReactNode; page?: string; 'aria-current'?: string; 'data-item'?: string }) => createElement('span', { 'data-item': key, 'data-page': page, 'aria-current': current }, children, actions)
  const menuLabel = ({ label, children }: { label?: string; children?: ReactNode }) => createElement('section', { 'aria-label': label }, createElement('b', { 'data-heading': '' }, label), children)
  const menuBack = ({ children }: { children?: ReactNode }) => createElement('span', { 'data-back': '' }, children)
  const menuSeparator = () => createElement('hr', { 'data-sep': '' })
  return { part, menu, menuItem, menuLabel, menuBack, menuSeparator, through, devState }
})

const { MARKS } = vi.hoisted(() => {
  const mark = () => () => null
  const one = { icon: mark(), make: mark() }
  return { MARKS: { chat: one, dev: one, design: one, studio: one, tabs: one, library: one, scheduled: one, customize: one } }
})
vi.mock('@hanzo/gui', () => ({ Text: part, XStack: part, YStack: part }))
vi.mock('@hanzo/ui', () => ({
  Button: part,
  DropdownMenu: menu,
  DropdownMenuContent: through,
  DropdownMenuItem: menuItem,
  DropdownMenuSection: menuLabel,
  DropdownMenuPage: through,
  DropdownMenuBack: menuBack,
  DropdownMenuSeparator: menuSeparator,
  Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) => (open ? createElement('div', { 'data-slot': 'dialog' }, children) : null),
  DialogContent: part,
  DialogTitle: part,
  Switch: part,
  Text: part,
  Tooltip: through,
  TooltipContent: part,
  TooltipProvider: through,
  TooltipTrigger: through,
  View: part,
  toast: { success: () => {}, error: () => {} },
}))
vi.mock('@hanzo/ui/chat', () => ({ Sidebar: part, SidebarIconButton: part, SidebarItem: part, StatusDot: () => null }))
vi.mock('@hanzogui/shell', () => ({ HanzoMark: () => null }))
vi.mock('./Betas', () => ({ BetasDialog: () => null, useBetas: () => ({ open: (id: string) => devState.opened.has(id) }) }))
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
  const group = (id: string, label: string, names: string[]) => ({ id, label, links: names.map((n) => ({ id: n === 'New run' ? 'new' : n.toLowerCase(), label: n, icon: null })) })
  return {
    MARKS,
    DOTS: {},
    Gutter: () => null,
    Rename: () => null,
    route,
    useSessions: () => ({ value: [], loading: false, error: null, reload: () => {} }),
    useRunMarks: () => [{}, () => {}],
    useLanguage: () => ['', () => {}] as const,
    NEW: 'new',
    own: () => [group('work', 'Work', ['New run', 'Projects', 'Issues', 'Templates'])],
    tabs: () => [group('customize', '', ['Agents', 'Bots', 'Skills', 'Connectors', 'Plugins'])],
    library: () => [group('library-do', '', ['Upload']), group('library-kinds', '', ['All', 'Images', 'Documents'])],
    useScheduled: () => [group('scheduled-do', '', ['New task']), group('scheduled-tasks', 'Tasks', ['Morning brief'])],
  }
})
vi.mock('./Account', () => ({ Made: () => null, Account: () => createElement('div', { 'data-slot': 'me' }) }))
vi.mock('./Recents', () => ({
  Recents: ({ mode, host }: { mode: string; host: { name?: string } }) => createElement('div', { 'data-slot': 'recents', 'data-mode': mode, 'data-host': host.name ?? '' }),
}))
vi.mock('./DevPane', () => ({
  // The Dev core's lists are fetched lazily and draw only in a browser; the sidebar's own structure is what is read here.
  ChatList: () => createElement('div', { 'data-slot': 'recents', 'data-mode': 'chat' }),
  DevList: () => null,
  useScope: () => undefined,
}))
vi.mock('./Setup', () => ({ Setup: () => createElement('div', { 'data-slot': 'setup-card' }) }))
vi.mock('./span', () => ({ useSpan: () => ({ ref: null, style: {}, span: 256, move: () => {}, keep: () => {} }) }))
vi.mock('./lib/dev-mode', () => ({ useDevMode: () => [devState.on, () => {}], rememberSettingsReturn: () => {} }))

import { AnonSettingsPane, Sidebar } from './Sidebar'
import { moreGroups } from './MoreMenu'
import { Rail, type Pins } from './Rail'
import { TABS, WORKSPACE, type Place } from './lib/host'
import { Windowed } from './windowed'

const hostAt = (path = '') => ({ go: () => {}, path }) as unknown as Parameters<typeof Sidebar>[0]['host']
const host = hostAt()
const noop = () => {}
/** Nothing pinned: the menu as it stands for someone who never pinned. */
const pins: Pins = [[], noop, noop, noop]
const FIVE = ['chat', 'dev', 'design', 'library', 'tabs']

const column = (mode: Place['mode'], path = '', held: Pins = pins) => renderToStaticMarkup(createElement(Sidebar, { pins: held, host: hostAt(path), mode, thread: null, go: noop, onShut: noop, onBack: noop }))
const rail = (mode: Place['mode'], onOpen?: () => void, where: string | null = null) =>
  renderToStaticMarkup(
    createElement(Rail, {
      pins,
      host,
      mode,
      at: where,
      open: false,
      onOpen,
      onNew: noop,
      onChat: noop,
      onDev: noop,
      onDesign: noop,
      onStudio: noop,
      onTabs: noop,
      go: noop,
      onOrg: noop,
    }),
  )

const at = (html: string, s: string): number => {
  const i = html.indexOf(s)
  expect(i, s).toBeGreaterThanOrEqual(0)
  return i
}

beforeEach(() => {
  devState.on = false
  devState.opened = new Set(['finance'])
})

describe('the folded rail', () => {
  test('Pinned items (Chat, Dev, Design, Library, Tabs), then More, and the account at the foot; Dev places stay in Dev sidebar', () => {
    const html = rail('chat')
    const order = ['Chat', 'Dev', 'Design', 'Library', 'Tabs', 'More'].map((n) => at(html, `aria-label="${n}"`))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(at(html, 'data-slot="me"')).toBeGreaterThan(order.at(-1)!)
    for (const place of ['Templates', 'Projects', 'Issues', 'Machines', 'Environments']) {
      expect(html, `${place} is Dev’s, listed in Dev’s sidebar alone`).not.toContain(`aria-label="${place}"`)
    }
  })

  test('in anonymous mode (person === null), hides Design, Tabs, Scheduled tasks, Customize, and Betas on the rail', () => {
    const anonHost = { ...host, person: null } as unknown as Parameters<typeof Sidebar>[0]['host']
    const html = renderToStaticMarkup(
      createElement(Rail, { pins, host: anonHost, mode: 'chat', at: null, open: false, onChat: noop, onDev: noop, onDesign: noop, onStudio: noop, onTabs: noop, go: noop, onOrg: noop }),
    )
    for (const kept of ['Chat', 'Dev', 'Library']) {
      expect(html).toContain(`aria-label="${kept}"`)
    }
    for (const hidden of ['Design', 'Studio', 'Tabs', 'Terminals', 'Scheduled tasks', 'Automations', 'Customize', 'Extensions', 'Betas', 'More', 'Build']) {
      expect(html).not.toContain(`aria-label="${hidden}"`)
    }
  })

  test('a place on the rail is lit while the reader is on it, and Dev is not', () => {
    expect(rail('dev', undefined, '')).toMatch(/aria-label="Dev" aria-current="page"/)
    const library = rail('dev', undefined, '-/artifacts')
    expect(library).toMatch(/aria-label="Library" aria-current="page"/)
    expect(library).not.toMatch(/aria-label="Dev" aria-current="page"/)
    expect(rail('dev', undefined, '-/customize')).toMatch(/aria-label="Customize" aria-current="page"/)
    expect(rail('dev', undefined, '-/settings/machines')).toMatch(/aria-label="Dev" aria-current="page"/)
  })

  test('the mode the reader is in is the one lit', () => {
    expect(rail('chat')).toMatch(/aria-label="Chat" aria-current="page"/)
    expect(rail('chat')).not.toMatch(/aria-label="Dev" aria-current="page"/)
    expect(rail('dev')).toMatch(/aria-label="Dev" aria-current="page"/)
  })

  test('the expand button leads the rail when folded and calls onOpen', () => {
    expect(rail('chat')).not.toContain('sidebar-toggle')
    const html = rail('chat', noop)
    expect(at(html, 'data-slot="sidebar-toggle"')).toBeLessThan(at(html, 'aria-label="Chat"'))
    expect(html).toContain('aria-label="Open sidebar"')
  })

  test('folded More holds unpinned items in exact order plus external products, and none of Dev’s places', () => {
    const html = rail('chat')
    expect(at(html, 'aria-label="Library"')).toBeLessThan(at(html, 'aria-label="More"'))
    expect(at(html, 'data-item="scheduled"')).toBeLessThan(at(html, 'data-item="customize"'))
    expect(at(html, 'data-item="ext-team"')).toBeGreaterThan(at(html, 'aria-label="More"'))
    // A beta the reader may open shows without Developer mode, as before; one they may not open does not.
    expect(at(html, 'data-item="beta-finance"')).toBeGreaterThan(at(html, 'data-item="ext-team"'))
    expect(html).not.toContain('data-item="beta-erp"')
    devState.on = true
    expect(rail('chat')).toContain('data-item="beta-finance"')
    for (const k of ['projects', 'templates', 'issues', 'machines', 'environments']) expect(html).not.toContain(`data-item="${k}"`)
    expect(html, 'nothing on the rail leaves for tabs.hanzo.ai').not.toContain(TABS)
    expect(TABS).toBe('https://tabs.hanzo.ai')
    expect(WORKSPACE).toBe('https://hanzo.team')
  })
})

describe('a phone’s menu', () => {
  test('in the drawer the column lists the apps, then Recents, and the foot last', () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, {
        pins,
        host,
        mode: 'chat',
        thread: null,
        go: noop,
        onShut: noop,
        onBack: noop,
        drawer: true,
        rail: createElement('nav', { 'data-slot': 'places' }),
        foot: createElement('div', { 'data-slot': 'drawer-foot' }),
      }),
    )
    expect(at(html, 'Hanzo')).toBeLessThan(at(html, 'aria-label="Search"'))
    expect(at(html, 'New chat')).toBeLessThan(at(html, 'data-slot="rail-pinned"'))
    expect(at(html, 'data-slot="rail-pinned"')).toBeLessThan(at(html, 'data-slot="recents"'))
    expect(at(html, 'data-slot="recents"')).toBeLessThan(at(html, 'data-slot="drawer-foot"'))
  })
})

describe('the unified desktop sidebar', () => {
  test('eliminates duplicate bottom-left column-settings/column-upgrade rows, renders Account at foot, and gates Setup behind Developer mode', () => {
    const simpleHtml = column('chat')
    expect(simpleHtml).not.toContain('data-slot="column-settings"')
    expect(simpleHtml).not.toContain('data-slot="column-upgrade"')
    expect(simpleHtml).not.toContain('data-slot="setup-card"')
    expect(simpleHtml).toContain('data-slot="sidebar-account"')
    expect(simpleHtml).toContain('data-slot="me"')

    devState.on = true
    const devHtml = column('chat')
    expect(devHtml).not.toContain('data-slot="column-settings"')
    expect(devHtml).toContain('data-slot="setup-card"')
  })

  test('carries one fold button, Activity bell, Search, primary New action, Pinned products, Recents, the More row under it, and Account', () => {
    const html = column('chat')
    expect(at(html, 'Hanzo')).toBeLessThan(at(html, 'aria-label="Activity"'))
    expect(at(html, 'aria-label="Activity"')).toBeLessThan(at(html, 'aria-label="Search"'))
    expect(at(html, 'aria-label="Search"')).toBeLessThan(at(html, 'data-slot="sidebar-toggle"'))
    expect(at(html, 'data-slot="sidebar-toggle"')).toBeLessThan(at(html, 'New chat'))
    expect(at(html, 'New chat')).toBeLessThan(at(html, 'data-slot="sidebar-nav"'))
    expect(at(html, 'data-slot="rail-pinned"')).toBeLessThan(at(html, 'data-slot="recents"'))
    expect(at(html, 'data-slot="recents"')).toBeLessThan(at(html, 'data-slot="place-more"'))
    expect(at(html, 'data-slot="place-more"')).toBeLessThan(at(html, 'data-slot="sidebar-account"'))
    expect(html).not.toContain('data-slot="nav-latest"')
    // First Build: Tabs is a locked top-5 app, an internal /tabs page, not tabs.hanzo.ai.
    expect(html, 'Tabs is locked in the top 5 main apps').toContain('data-slot="rail-tabs"')
  })

  test('Dev: renders New run, indents Dev sub-links (Projects, Issues, Templates) right beneath active Dev row, then Recents; no duplicate column', () => {
    const html = column('dev')
    expect(at(html, 'New run')).toBeLessThan(at(html, 'data-slot="rail-dev"'))
    expect(at(html, 'data-slot="rail-dev"')).toBeLessThan(at(html, 'data-slot="nav-sublinks"'))
    expect(at(html, 'data-slot="nav-sublinks"')).toBeLessThan(at(html, 'Templates'))
    expect(at(html, 'Templates')).toBeLessThan(at(html, 'data-slot="recents"'))
    expect(html).not.toContain('data-slot="app-places"')
    expect(html).toContain('data-slot="nav-item-options"')
    // Each of the five can be pinned to the top (hanzo-inc/app issue 316); none is pinned yet, so none moves and none is under Pinned.
    expect(html).toContain('data-item="pin"')
    expect(html).toContain('aria-label="Pin Dev to top"')
    expect(html).not.toContain('data-item="move-up"')
    expect(html).not.toContain('data-slot="nav-pins"')
    expect(html).not.toContain(TABS)
  })

  test('More shrinks as places are pinned and goes away when none is left in it', () => {
    const inMore = [...column('chat').matchAll(/data-item="pin-([^"]+)"/g)].map((m) => m[1])
    expect(inMore).toContain('scheduled')
    const pinnedOne = column('chat', '', [['scheduled'], noop, noop, noop])
    expect(pinnedOne).not.toContain('data-item="pin-scheduled"')
    expect(pinnedOne).toContain('data-item="pin-customize"')
    expect(pinnedOne).toContain('data-slot="place-more"')
    const all = column('chat', '', [[...inMore], noop, noop, noop])
    expect(all).not.toContain('data-slot="place-more"')
  })

  test('a pinned app can be moved up and down from its menu, not only by dragging: the first has no Move up, the last no Move down', () => {
    const moves = (held: Pins) => {
      const html = column('chat', '', held)
      return [...html.matchAll(/data-item="move-(up|down)"/g)].map((m) => m[1])
    }
    const two: Pins = [['chat', 'dev'], noop, noop, noop]
    // Five pinned apps: four can go up, four can go down, one of each end is missing.
    expect(moves([FIVE, noop, noop, noop])).toEqual(['down', 'up', 'down', 'up', 'down', 'up', 'down', 'up'])
    expect(moves(two)).toEqual(['down', 'up'])
    // An app that is not pinned keeps its default place, so it has no moves.
    expect(moves(pins)).toEqual([])
  })

  test('pinned apps stand first, under Pinned, and an unpinned one is back in its default place (hanzo-inc/app issue 316)', () => {
    const order = (html: string) => [...html.matchAll(/data-slot="rail-([a-z-]+)"[^>]*aria-label=/g)].map((m) => m[1])
    expect(order(column('chat'))).toEqual(FIVE)
    const pinned = column('chat', '', [['scheduled', 'design'], noop, noop, noop])
    expect(order(pinned)).toEqual(['scheduled', 'design', 'chat', 'dev', 'library', 'tabs'])
    expect(at(pinned, 'data-slot="nav-pins-head"')).toBeLessThan(at(pinned, 'data-slot="rail-scheduled"'))
    expect(at(pinned, 'data-slot="rail-design"')).toBeLessThan(at(pinned, 'data-slot="rail-chat"'))
    expect(pinned).toContain('aria-label="Unpin Design"')
    expect(pinned).toContain('aria-label="Pin Chat to top"')
    // Scheduled tasks pinned is out of More; unpinned it is back in it.
    expect(pinned).not.toContain('data-item="pin-scheduled"')
    expect(column('chat')).toContain('data-item="pin-scheduled"')
  })

  test('every list item sits in a list, in each sidebar a person can be in', () => {
    const places = [{ id: 'g', label: 'Gallery', links: [{ id: 'a', label: 'A', icon: () => null }] }]
    for (const html of [column('chat'), column('dev'), column('dev', '-/customize'), renderToStaticMarkup(createElement(Sidebar, { pins, host: hostAt(''), mode: 'studio', thread: null, go: noop, onShut: noop, onBack: noop, places: places as never }))]) {
      const doc = new Window().document
      doc.body.innerHTML = html
      const items = [...doc.querySelectorAll('[role="listitem"]')]
      expect(items.length).toBeGreaterThan(0)
      for (const item of items) expect(item.closest('[role="list"]')).not.toBeNull()
    }
  })

  test('More is one row under Recents that opens a menu: every other place in it, each pinnable, none listed inline', () => {
    const html = column('chat')
    expect(html.match(/data-slot="place-more"/g)).toHaveLength(1)
    for (const k of ['scheduled', 'customize', 'betas', 'ext-team', 'ext-bots', 'ext-market', 'beta-finance']) {
      expect(html, k).toContain(`data-item="${k}"`)
    }
    // One pin button per row, as the row's own control (no "Pin X to top" rows), named for the sidebar.
    expect(html).toContain('data-item="pin-scheduled"')
    expect(html).not.toMatch(/Pin [^"<]* to top</)
    expect(html).toMatch(/data-page="pin"/)
    expect(html).toContain('data-item="pin-to-scheduled"')
    const headings = [...html.matchAll(/data-heading="">([^<]*)</g)].map((m) => m[1])
    expect(headings.slice(0, 2)).toEqual(['Workspace', 'Business'])
    // The five locked apps are never offered for pinning, and the menu's entries are not drawn as rows in the column.
    expect(html).not.toContain('data-item="pin-chat"')
    expect(html).not.toContain('aria-label="Scheduled tasks"')
    expect(column('dev', '-/customize')).not.toContain('data-slot="place-more"')
  })

  test('an app that lives in More draws its own row and sub-links in the list while the reader is in it (Studio)', () => {
    devState.opened = new Set(['finance', 'studio'])
    const places = [{ id: 'studio', label: '', links: [{ id: 'new', label: 'New creation', icon: null }, { id: 'gallery', label: 'Gallery', icon: null }] }]
    const html = renderToStaticMarkup(createElement(Sidebar, { pins, host: hostAt(''), mode: 'studio', thread: null, go: noop, onShut: noop, onBack: noop, places }))
    expect(at(html, 'data-slot="rail-pinned"')).toBeLessThan(at(html, 'data-slot="rail-studio"'))
    expect(at(html, 'data-slot="rail-studio"')).toBeLessThan(at(html, 'data-slot="nav-sublinks"'))
    expect(at(html, 'data-slot="nav-sublinks"')).toBeLessThan(at(html, 'Gallery'))
    expect(at(html, 'Gallery')).toBeLessThan(at(html, 'data-slot="place-more"'))
    // Not lit twice: the More row stays plain, the menu still lists Studio.
    expect(html).not.toMatch(/data-slot="place-more"[^>]*aria-current/)
    expect(html).toContain('data-item="studio"')
    expect(column('chat')).not.toContain('data-slot="rail-studio"')
  })

  test('the phone’s drawer lists the five apps and the grouped More, with Recents below', () => {
    const html = renderToStaticMarkup(createElement(Sidebar, { pins, host: hostAt(''), mode: 'chat', thread: null, go: noop, onShut: noop, onBack: noop, drawer: true }))
    const places = ['Chat', 'Dev', 'Design', 'Library', 'Tabs'].map((n) => at(html, `aria-label="${n}"`))
    expect(places).toEqual([...places].sort((a, b) => a - b))
    expect(at(html, 'aria-label="Tabs"')).toBeLessThan(at(html, 'aria-label="More"'))
    expect(at(html, 'data-item="scheduled"')).toBeGreaterThan(at(html, 'aria-label="More"'))
    expect(html).toContain('data-item="pin-scheduled"')
  })

  test('moreGroups: Workspace first, then Hanzo’s own group names in order, empty groups gone, every entry exactly once', () => {
    const entry = (id: string) => ({ id, slot: `rail-${id}`, label: id.toUpperCase(), href: `/${id}`, on: false, icon: null, onPress: () => {} })
    const ids = ['scheduled', 'app-crm', 'beta-finance', 'ext-team', 'ext-bots', 'ext-market', 'beta-kms', 'betas', 'app-analytics']
    const groups = moreGroups(ids.map(entry), (k) => k)
    expect(groups.map((g) => g.label)).toEqual(['Workspace', 'Business', 'Data', 'Agents', 'Security'])
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([['scheduled', 'betas'], ['app-crm', 'beta-finance', 'ext-team', 'ext-market'], ['app-analytics'], ['ext-bots'], ['beta-kms']])
    expect(groups.flatMap((g) => g.items.map((i) => i.id)).sort()).toEqual([...ids].sort())
  })

  test('a place the rail holds takes the sidebar: Back, the name, its own rows, and nothing of Dev’s', () => {
    const customize = column('dev', '-/customize')
    expect(at(customize, 'aria-label="Back"')).toBeLessThan(at(customize, '>Customize<'))
    for (const word of ['New run', 'data-slot="recents"']) expect(customize).not.toContain(word)
    expect(at(customize, '>Customize<')).toBeLessThan(at(customize, 'Agents'))
    expect(at(customize, 'Agents')).toBeLessThan(at(customize, 'Bots'))
    expect(at(customize, 'Bots')).toBeLessThan(at(customize, 'Skills'))
    const library = column('dev', '-/artifacts')
    expect(at(library, '>Library<')).toBeLessThan(at(library, 'Upload'))
    expect(at(library, 'Upload')).toBeLessThan(at(library, 'Images'))
    expect(library).not.toContain('New run')
    const scheduled = column('dev', '-/automations')
    expect(at(scheduled, '>Scheduled tasks<')).toBeLessThan(at(scheduled, 'New task'))
    expect(at(scheduled, 'New task')).toBeLessThan(at(scheduled, 'Morning brief'))
    expect(scheduled).not.toContain('New run')
  })

  test('Settings takes no sidebar: it is the site’s pages, and a builder place filed under it is Dev’s', () => {
    const machines = column('dev', '-/settings/machines')
    expect(machines).not.toContain('data-slot="place-name"')
    expect(machines).not.toContain('aria-label="Back"')
    expect(at(machines, 'New run')).toBeLessThan(at(machines, 'data-slot="recents"'))
  })

  test('the bell lists the runs and leaves for no Settings page', () => {
    const html = column('chat')
    expect(html).toContain('Nothing new')
    expect(html).not.toContain('Notification settings')
  })

  test('the search is the palette, in every mode: the sidebar holds no field of its own', () => {
    for (const mode of ['chat', 'dev', 'studio'] as const) {
      const html = column(mode, '')
      expect(html).toContain('aria-label="Search"')
      expect(html).not.toContain('<input')
    }
  })

  test('AnonSettingsPane renders simple General and Data controls preferences', () => {
    const anonHost = { ...host, person: null } as unknown as Parameters<typeof Sidebar>[0]['host']
    const html = renderToStaticMarkup(createElement(AnonSettingsPane, { host: anonHost, onClose: noop }))
    expect(html).toContain('data-slot="anon-settings-pane"')
    expect(html).toContain('data-slot="anon-settings-back"')
    for (const text of [
      'General',
      'Appearance',
      'Language',
      'Data controls',
      'Improve the model for everyone',
      'Personalize ads',
      'Marketing measurement',
      'Personalized marketing',
    ]) {
      expect(html).toContain(text)
    }
  })

  test('Design lists its own conversations, through the host Studio is mounted with; Studio and Flow list none, never Chat’s', () => {
    expect(column('studio')).not.toContain('data-slot="recents"')
    expect(column('flow')).not.toContain('data-slot="recents"')
    expect(column('design')).not.toContain('data-slot="recents"')
    const made = { ...hostAt(''), name: 'Design' }
    const design = renderToStaticMarkup(createElement(Sidebar, { pins, host: hostAt(''), mode: 'design', thread: null, go: noop, onShut: noop, onBack: noop, made }))
    expect(design).toContain('data-slot="recents" data-mode="design" data-host="Design"')
    expect(column('chat')).toContain('data-slot="recents" data-mode="chat"')
    expect(column('dev')).toContain('data-slot="recents" data-mode="dev"')
  })

  test('Tabs lists Desktop and Browser inside indented sublinks without Chat’s Recents; a terminal is the New terminal row alone', () => {
    const html = column('tabs')
    expect(html.split('New terminal').length - 1).toBe(1)
    expect(html).not.toContain('>Terminal<')
    expect(html).toContain('Desktop')
    expect(html).toContain('Browser')
    expect(html).not.toContain('data-slot="recents"')
  })

  test('the product rows keep their place in every section: the New row stands above them in each, for guests too', () => {
    const rows = ['data-slot="app-new"', 'data-slot="rail-chat"', 'data-slot="rail-dev"', 'data-slot="rail-design"']
    for (const mode of ['chat', 'dev', 'design', 'studio', 'tabs', 'hosted'] as Place['mode'][]) {
      const html = column(mode)
      const order = rows.map((r) => at(html, r))
      expect(order, mode).toEqual([...order].sort((a, b) => a - b))
    }
    expect(column('tabs')).toContain('New terminal')
    const guest = (mode: Place['mode']) =>
      renderToStaticMarkup(createElement(Sidebar, { pins, host: { ...host, person: null } as never, mode, thread: null, go: noop, onShut: noop, onBack: noop }))
    for (const mode of ['chat', 'dev'] as Place['mode'][]) {
      const html = guest(mode)
      const order = ['data-slot="app-new"', 'data-slot="app-images"', 'data-slot="app-plugins"', 'data-slot="rail-chat"'].map((r) => at(html, r))
      expect(order, mode).toEqual([...order].sort((a, b) => a - b))
      expect(html, 'a guest’s New is a chat').toContain('New chat')
    }
  })

  test('signed out, every section has one compact Log in at the foot, never the old two-button card', () => {
    for (const mode of ['chat', 'dev', 'design', 'tabs'] as Place['mode'][]) {
      const html = renderToStaticMarkup(createElement(Sidebar, { pins, host: { ...host, person: null } as never, mode, thread: null, go: noop, onShut: noop, onBack: noop }))
      for (const slot of ['column-login', 'column-signup', 'anon-tailored']) expect(html, mode).not.toContain(`data-slot="${slot}"`)
      expect(html.split('data-slot="anon-login"').length - 1, mode).toBe(1)
      expect(html, mode).toContain('data-slot="anon-settings"')
    }
  })

  test('a guest’s Images says why it cannot, with the way in, never a silent prefill', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('./Sidebar.tsx', import.meta.url), 'utf8')
    expect(src).toContain("onPress={() => setGated(t('Sign in to create images'))}")
    expect(src).not.toContain("hanzo:anon-prompt")
    expect(src).toContain('data-slot="signin-prompt"')
  })

  test('every sign-in door goes through the host’s addresses, never a hard-coded /login or /signup', async () => {
    const { readFileSync } = await import('node:fs')
    for (const file of ['./Sidebar.tsx', './DevPane.tsx', './Chat.tsx']) {
      const src = readFileSync(new URL(file, import.meta.url), 'utf8')
      expect(src, file).not.toMatch(/assign\(['"]\/(login|signup)/)
    }
    const sidebar = readFileSync(new URL('./Sidebar.tsx', import.meta.url), 'utf8')
    expect(sidebar).toContain('data-slot="signin-prompt-signup" onPress={() => enter(signUp())}')
  })

  test('a window of its own (Hanzo Desktop) offers no Open in new tab; a browser does', () => {
    const inside = (windowed: boolean) =>
      renderToStaticMarkup(createElement(Windowed.Provider, { value: windowed }, createElement(Sidebar, { pins, host, mode: 'chat', thread: null, go: noop, onShut: noop, onBack: noop })))
    expect(inside(false)).toContain('data-item="new-tab"')
    expect(inside(true)).not.toContain('data-item="new-tab"')
    expect(inside(true)).toContain('data-item="copy-link"')
  })
})
