// Folded 52px icons-only rail & shared Hanzo product list:
// - Real Hanzo names and order (`Chat`, `Dev`, `Design`,
//   `Library`, `Scheduled tasks`, `Customize`, `Tabs`, `Betas`; Developer mode hides none of them).
// - Strictly monochrome active chrome (`bg="$raised"`, zero `--data-*` colors or dots).
// - Never auto-injects `HOSTED_APPS` (`app-*`) into Pinned; keeps them in More unless pinned.
import { createElement, Fragment, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({ opened: new Set<string>(), went: [] as string[], devMode: false, selects: new Map<string, () => void>(), pin: vi.fn() }))

type Part = {
  children?: ReactNode
  'data-slot'?: string
  'data-expanded'?: string
  'aria-label'?: string
  'aria-current'?: string
  'data-item'?: string
  'data-nav-id'?: string
  bg?: string
  onClick?: () => void
  onPress?: () => void
  label?: string
  active?: boolean
}
const draw = ({ children, 'data-slot': slot, 'data-expanded': exp, 'aria-label': named, 'aria-current': current, 'data-item': item, 'data-nav-id': nav, bg }: Part) =>
  createElement('div', { 'data-slot': slot, 'data-expanded': exp, 'aria-label': named, 'aria-current': current, 'data-item': item, 'data-nav-id': nav, 'data-bg': bg }, children)
const through = ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children)
const { MARKS } = vi.hoisted(() => {
  const mark = () => () => null
  const one = { icon: mark(), make: mark() }
  return { MARKS: { chat: one, dev: one, design: one, tabs: one, library: one, scheduled: one, customize: one } }
})
vi.mock('@hanzo/gui', () => ({ Text: draw, XStack: draw, YStack: draw }))
vi.mock('@hanzo/build', () => ({ MARKS, route: () => ({ kind: 'home' }) }))
vi.mock('@hanzo/ui', () => ({
  DropdownMenu: ({ trigger, items, children }: { trigger?: ReactNode; items?: { key?: string; label?: string }[]; children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'menu', 'data-items': (items ?? []).map((i) => i.key ?? '-').join(',') }, trigger, children),
  DropdownMenuContent: through,
  DropdownMenuPage: through,
  DropdownMenuBack: ({ children }: { children?: ReactNode }) => createElement('span', { 'data-back': '' }, children),
  DropdownMenuItem: ({ children, actions, onSelect, page, 'aria-current': current, 'data-item': key }: { children?: ReactNode; actions?: ReactNode; onSelect?: () => void; page?: string; 'aria-current'?: string; 'data-item'?: string }) => {
    if (key && onSelect) state.selects.set(key, onSelect)
    return createElement('span', { 'data-item': key, 'data-page': page, 'aria-current': current }, children, actions)
  },
  DropdownMenuSection: ({ label, children }: { label?: string; children?: ReactNode }) => createElement('section', { 'aria-label': label }, createElement('b', { 'data-heading': '' }, label), children),
  DropdownMenuSeparator: () => createElement('hr'),
  Tooltip: through,
  TooltipContent: draw,
  TooltipProvider: through,
  TooltipTrigger: through,
  toast: { success: () => {}, error: () => {} },
}))
vi.mock('@hanzo/ui/chat', () => ({
  SidebarItem: ({ children, 'data-slot': slot, active }: Part) => createElement('div', { 'data-slot': slot, 'aria-current': active ? 'page' : undefined }, children),
}))
vi.mock('@hanzo/i18n/react', () => ({
  useI18n: () => ({ t: (s: string, vars?: Record<string, string>) => (vars ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : s), dir: 'ltr' }),
}))
vi.mock('./Betas', () => ({ BetasDialog: () => null, useBetas: () => ({ open: (id: string) => state.opened.has(id) }) }))
vi.mock('./help', () => ({ out: (href: string) => state.went.push(href) }))
vi.mock('./Account', () => ({ Account: () => null }))
vi.mock('./lib/dev-mode', () => ({ useDevMode: () => [state.devMode, () => {}] }))

const { carriedPinnedNav, DEFAULT_NAV, DEFAULT_PINNED_NAV, Rail, reorderedPinnedNav, shiftedPinnedNav, toggledPinnedNav } = await import('./Rail')

const host = {} as never
const draw5 = (props: { mode?: 'chat' | 'hosted'; inside?: string | null; compact?: boolean; pinned?: string[]; open?: boolean } = {}) =>
  renderToStaticMarkup(
    createElement(Rail, {
      pins: [props.pinned ?? [], state.pin, () => {}, () => {}],
      host,
      mode: props.mode ?? 'chat',
      at: null,
      inside: props.inside ?? null,
      open: props.open ?? false,
      compact: props.compact,
      onOpen: () => {},
      onChat: () => {},
      onDev: () => {},
      onDesign: () => {},
      onTabs: () => {},
      go: () => {},
      onOrg: () => {},
    }),
  )
const marks = (html: string) => [...html.matchAll(/data-slot="(?:rail|place)-app-([a-z]+)"/g)].map((m) => m[1])

beforeEach(() => {
  state.opened = new Set()
  state.went = []
  state.devMode = false
})

describe('persistent 52px icons-only rail with monochrome chrome', () => {
  test('defaults primary apps to Chat, Dev, Design, Library, Tabs without captions or duplicate + button', () => {
    expect(DEFAULT_PINNED_NAV).toEqual(['chat', 'dev', 'design', 'library', 'tabs'])
    const html = draw5()
    expect(html).toContain('data-expanded="false"')
    expect(html).toContain('data-slot="sidebar-toggle"')
    expect(html).not.toContain('data-slot="rail-new"')
    expect(html).not.toContain('data-slot="rail-caption"')
    expect(html).not.toContain('data-slot="rail-fold-toggle"')
    expect(html).toContain('aria-label="Chat"')
    expect(html).toContain('aria-label="Dev"')
    expect(html).toContain('aria-label="Design"')
    expect(html).toContain('aria-label="Library"')
    expect(html).not.toContain('aria-label="Build"')
    expect(html).toContain('data-bg="$raised"')
    expect(html).not.toContain('data-blue-')
    expect(html).not.toContain('data-amber-')
    expect(html).not.toContain('data-jade-')
    expect(html).toContain('data-slot="rail-more"')
    const openHtml = draw5({ open: true })
    expect(openHtml).toContain('data-expanded="true"')
    expect(openHtml).toContain('aria-label="Close sidebar"')
  })

  test('keeps hosted apps, granted betas and Flow reachable in More without Developer mode (Developer mode hides nothing that was visible before)', async () => {
        state.opened = new Set(['crm', 'commerce', 'finance', 'flow'])
    const menuOf = () => [...draw5().matchAll(/data-item="((?!pin-)[^"]*)"/g)].map((m) => m[1]).join(',')
    const offMenu = menuOf()
    expect(offMenu).toContain('scheduled,customize,flow,betas')
    expect(offMenu).toContain('app-crm,app-commerce')
    expect(offMenu).toContain('beta-finance')
    // Every place appears exactly once, under headings, and pinning is a button on the row, not a second row.
    const ids = offMenu.split(',')
    expect(new Set(ids).size).toBe(ids.length)
    const html = draw5()
    expect([...html.matchAll(/data-heading="">([^<]*)</g)].map((m) => m[1])).toEqual(['Workspace', 'Business', 'Agents'])
    expect(html).toContain('data-item="pin-scheduled"')
    expect(html).not.toMatch(/Pin [^"<]*to top/)
    // The keyboard's way: one last row opens a page that lists the places as plain rows, each pinning on select.
    expect(html).toMatch(/data-page="pin"[^>]*>(<[^>]*>)*Pin to sidebar…/)
    expect(html).toContain('data-item="pin-to-scheduled"')
    state.selects.get('pin-to-scheduled')!()
    expect(state.pin).toHaveBeenCalledWith('scheduled')

    state.devMode = true
    expect(menuOf()).toBe(offMenu)
  })

  test('pin and reorder helpers keep their contract: pins are only what the reader pinned, any app can be pinned, unpinning returns it to its place', () => {
    expect(DEFAULT_PINNED_NAV).toBe(DEFAULT_NAV)
    const withCrm = toggledPinnedNav([], 'app-crm')
    expect(withCrm).toEqual(['app-crm'])
    // A default app pins too (hanzo-inc/app issue 316), after the ones pinned before it.
    const withDesign = toggledPinnedNav(withCrm, 'design')
    expect(withDesign).toEqual(['app-crm', 'design'])
    expect(toggledPinnedNav(withDesign, 'app-crm')).toEqual(['design'])
    expect(toggledPinnedNav(['design'], 'design')).toEqual([])
    // A drag onto a pin puts the dragged app there, pinning it when it was not.
    expect(reorderedPinnedNav(withDesign, 'design', 'app-crm')).toEqual(['design', 'app-crm'])
    expect(reorderedPinnedNav(withDesign, 'chat', 'design')).toEqual(['app-crm', 'chat', 'design'])
    expect(reorderedPinnedNav(withDesign, 'chat', 'nowhere')).toEqual(['app-crm', 'design', 'chat'])
    expect(shiftedPinnedNav(withDesign, 'design', -1)).toEqual(['design', 'app-crm'])
    expect(shiftedPinnedNav(withDesign, 'app-crm', -1)).toEqual(withDesign)
    expect(shiftedPinnedNav(withDesign, 'design', 1)).toEqual(withDesign)
    // A pinned app the reader is not offered (a beta they have no access to) is stepped over, so a move is always seen.
    const kept = ['chat', 'ghost', 'design']
    const seen = kept.filter((id) => id !== 'ghost')
    expect(shiftedPinnedNav(kept, 'design', -1, seen)).toEqual(['design', 'ghost', 'chat'])
    // What an earlier version kept (the five apps, then the pins from More) carries over as just the pins from More.
    expect(carriedPinnedNav(['chat', 'dev', 'design', 'library', 'tabs', 'app-crm', 'scheduled'])).toEqual(['app-crm', 'scheduled'])
    expect(carriedPinnedNav(['dev', 'chat', 'design', 'library', 'tabs'])).toEqual([])
    expect(carriedPinnedNav(null)).toEqual([])
    expect(carriedPinnedNav('chat')).toEqual([])
  })

  test('the rail stays strictly icon-only (no visible text captions under marks; full names live in aria-label and tooltip)', () => {
    const html = draw5()
    expect(html).not.toContain('data-slot="rail-caption"')
    for (const label of ['Chat', 'Dev', 'Design', 'Library', 'Tabs', 'More']) {
      expect(html).toContain(`aria-label="${label}"`)
    }
  })

  test('pins stand first on the folded rail, a line under them, and the default apps keep their order after (hanzo-inc/app issue 316)', () => {
    const order = (html: string) => [...html.matchAll(/data-nav-id="([^"]+)"/g)].map((m) => m[1])
    expect(order(draw5())).toEqual(['chat', 'dev', 'design', 'library', 'tabs'])
    expect(draw5()).not.toContain('data-slot="rail-pins-end"')
    const pinned = draw5({ pinned: ['scheduled', 'design'] })
    expect(order(pinned)).toEqual(['scheduled', 'design', 'chat', 'dev', 'library', 'tabs'])
    expect(pinned).toContain('data-slot="rail-pins-end"')
    // Unpinned, Scheduled tasks is back in More, and Design back between Dev and Library.
    expect(order(draw5({ pinned: [] }))).toEqual(['chat', 'dev', 'design', 'library', 'tabs'])
  })
})

describe('hosted apps never auto-inject into Pinned', () => {
  test('a reader with no app open has none of their marks or menu items', () => {
    const html = draw5()
    expect(marks(html)).toEqual([])
  })

  test('unlocked hosted apps in devMode stay inside More overflow unless explicitly pinned or currently active', () => {
    state.devMode = true
    state.opened = new Set(['crm', 'commerce', 'cms', 'analytics', 'insights', 'erp', 'finance'])
    const html = draw5()
    expect(marks(html)).toEqual([])
    const menuItems = [...html.matchAll(/data-item="((?!pin-)[^"]*)"/g)].map((m) => m[1]).join(',')
    for (const id of ['app-crm', 'app-commerce', 'app-cms', 'app-analytics', 'app-insights']) expect(menuItems).toContain(id)
    expect(menuItems).toContain('beta-finance')
    // ERP is an ordinary granted beta like Finance (Hanzo's main lists it too), not a gated stub.
    expect(menuItems).toContain('beta-erp')
  })

  test('when a hosted app is active, its mark appears lit in monochrome on the folded rail', () => {
    state.opened = new Set(['crm', 'cms'])
    const html = draw5({ mode: 'hosted', inside: 'cms' })
    expect(marks(html)).toEqual(['cms'])
    expect(html).toMatch(/data-slot="rail-app-cms"[^>]*aria-current="page"|aria-current="page"[^>]*data-slot="rail-app-cms"/)
    expect(html).not.toContain('data-slot="rail-app-crm"')
  })
})
