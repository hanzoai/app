const { MARKS } = vi.hoisted(() => {
  const mark = () => () => null
  const one = { icon: mark(), make: mark() }
  return { MARKS: { chat: one, dev: one, design: one, tabs: one, library: one, scheduled: one, customize: one } }
})
vi.mock('./Usage', () => ({ UsageProvider: ({ children }: { children: unknown }) => children }))
import { createElement, Fragment, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// The window's frame, drawn with every part it holds stood in by a div that
// names itself: what is under test is which parts Betas, Tabs and Chat draw,
// not how each is drawn. A part that takes places says how many groups it got.
const { part, stub, state, through } = vi.hoisted(() => {
  type Part = { children?: ReactNode; 'data-slot'?: string; pt?: unknown; pb?: unknown; paddingInlineEnd?: unknown; display?: unknown }
  const through = ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children)
  // The frame's padding is what these tests read, so it is written on the stand-in.
  const part = ({ children, 'data-slot': slot, pt, pb, paddingInlineEnd, display }: Part) =>
    createElement('div', { 'data-slot': slot, 'data-pt': pt as string | undefined, 'data-pb': pb as string | undefined, 'data-pe': paddingInlineEnd as string | undefined, 'data-display': display as string | undefined }, children)
  const stub = (slot: string) => (props: { places?: unknown[]; children?: ReactNode }) =>
    createElement('div', { 'data-slot': slot, 'data-places': props.places === undefined ? 'none' : String(props.places.length) }, props.children)
  const state = { path: '/beta', drawer: 'shut' as 'shut' | 'open', leaveAt: '', pushed: [] as string[] }
  return { part, stub, state, through }
})

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('lucide-react', () => ({ ChevronLeft: () => null, ChevronRight: () => null, RefreshCw: () => null, Sparkles: () => null, Workflow: () => null }))
vi.mock('./icons', () => ({ CHEVRON: 2.25, MARKS }))
vi.mock('@hanzo/ai/react', () => ({ AiProvider: through }))
vi.mock('@hanzo/gui', () => ({ Text: part, XStack: part, YStack: part }))
vi.mock('@hanzo/ui', () => ({ Button: part, Text: part }))
vi.mock('@hanzo/build', () => ({ MARKS,
  Builder: stub('builder'),
  HostProvider: through,
  PrefsProvider: through,
  route: () => ({ kind: 'home' }),
  tabs: () => [],
}))
vi.mock('@hanzo/studio', () => ({ nav: () => [{ id: 'make', links: [] }], directorNav: () => [{ id: 'make', links: [] }], flowNav: () => [{ id: 'flow', links: [] }], Studio: stub('studio') }))
vi.mock('./lib/ai', () => ({ useAi: () => ({ client: null }) }))
vi.mock('./Chat', () => ({ Chat: stub('chat') }))
vi.mock('./Sidebar', () => ({ Sidebar: stub('app-column') }))
vi.mock('./Learning', () => ({ Learning: () => null }))
// The builder's spend question is Confirm's (Confirm.gui.test.tsx); here only that App draws it.
vi.mock('./Confirm', () => ({ useBuildSpend: () => ({ confirm: async () => false, dialog: null }), useMaking: () => ({ spend: async () => false, dialog: null }) }))
vi.mock('./dev', () => ({ isPlans: () => false, leave: () => {}, useDevHost: () => ({ go: () => {}, path: '', token: () => '' }) }))
vi.mock('./Gate', () => ({ Gate: through }))
vi.mock('./Report', () => ({ Report: through, reportProblem: () => {} }))
vi.mock('./host', () => ({ useHost: () => ({ router: { back: () => {}, forward: () => {}, push: () => {} }, path: state.path }) }))
vi.mock('./kept', () => ({ useKept: (_k: string, initial: unknown) => [initial, () => {}] }))
vi.mock('./Rail', () => ({
  Mark: ({ 'data-slot': slot }: { 'data-slot'?: string }) => (slot ? createElement('div', { 'data-slot': slot }) : null),
  raised: () => null,
  Rail: stub('rail'),
  RAIL_FOLDED: 52,
  usePinnedNav: () => [[], () => {}, () => {}],
  Toggle: ({ 'data-slot': slot = 'sidebar-toggle' }: { 'data-slot'?: string }) => createElement('div', { 'data-slot': slot }),
}))
vi.mock('./Drawer', () => ({
  Foot: () => null,
  Layer: stub('drawer'),
  Lift: () => null,
  RAISED: {},
  useDrawer: () => ({
    state: state.drawer,
    slide: null,
    open: () => {},
    close: () => {},
    depart: (f: (replace: boolean) => void) => f(false),
    exit: (f: (replace: boolean) => void) => f(false),
    drop: () => {},
    window: () => {},
    pane: () => {},
  }),
}))
vi.mock('./open', () => ({ empty: () => {}, openThread: () => {}, showSettings: () => {}, useOpen: () => ({ thread: null, settings: null }) }))
vi.mock('./Shell', () => ({ Split: through }))
vi.mock('./Search', () => ({ Search: () => null }))
vi.mock('./seek', () => ({ summons: () => false, togglesSidebar: () => false }))
vi.mock('./ground', () => ({ floor: {}, pane: () => ({}), SIDE: 256, BAR: 44, RAIL: 56 }))
vi.mock('./lib/session', () => ({ org: () => null, pick: () => {}, bearer: () => null, hasSession: () => true }))
vi.mock('./lib/pay', () => ({ payUrl: (p: string) => p }))
vi.mock('./Upgrade', () => ({ Upgrade: () => null, useFree: () => false }))
vi.mock('./Settings', () => ({
  FIRST: 'general',
  isSettingsPath: (p: string) => p === '/settings' || p.startsWith('/settings/') || p === '/account/billing',
  settingsRowOf: (p: string) => (p.includes('billing') ? 'billing' : 'account'),
  settingsPathFor: (id: string) => (id === 'billing' ? '/settings/organization/billing' : `/settings/${id}`),
  SettingsList: ({ active }: { active: string }) => createElement('div', { 'data-slot': 'settings-list', 'data-active': active }),
}))
vi.mock('./SettingsPane', () => ({ SettingsPane: ({ id }: { id: string }) => createElement('div', { 'data-slot': 'settings-pane', 'data-id': id }) }))
vi.mock('./ContextMenu', () => ({ AppContextMenu: () => null }))
vi.mock('./lib/host', () => ({
  TERMINALS: '/tabs',
  app: (at: string) => `/dev/${at}`,
  go: () => {},
  hosted: (id: string) => `/apps/${id}`,
  settings: () => '/settings',
  design: (at: string) => `/design/${at}`,
  flow: (at: string) => `/flow/${at}`,
  talk: () => '/chat',
  visit: () => {},
  place: (p: string) =>
    p === '/beta' ? { mode: 'beta' } : p === '/tabs' ? { mode: 'tabs' } : p === '/chat' ? { mode: 'chat', thread: null } : p === '/apps/crm' ? { mode: 'hosted', id: 'crm' } : null,
}))
vi.mock('./Bar', () => ({ Bar: stub('app-bar') }))
vi.mock('./view', () => ({ FOOT: 0, HEIGHT: '100dvh', TOP: 0, useView: () => () => {} }))
vi.mock('./WindowControls', () => ({ dragWindow: () => {}, toggleWindowMaximize: () => {}, WindowControls: () => null }))
vi.mock('./Betas', () => ({ Ask: () => null, BetasPane: stub('betas-pane'), useBetas: () => ({ open: () => true }) }))
vi.mock('./Hosted', () => ({ HostedPane: ({ id }: { id: string }) => createElement('div', { 'data-slot': 'hosted-pane', 'data-id': id }) }))

import { App } from './App'

const draw = (path: string, betas?: ReactNode, bar?: { inset?: number }) => {
  state.path = path
  return renderToStaticMarkup(createElement(App, { betas, bar }))
}

beforeEach(() => {
  state.drawer = 'shut'
})

describe('Betas and hosted apps keep the sidebar column', () => {
  test('Betas draws the rail, the sidebar column (with no Dev places), and the pane', () => {
    const html = draw('/beta', createElement('div', { 'data-slot': 'portal' }))
    expect(html).toContain('data-slot="rail"')
    expect(html).toContain('data-slot="app-column" data-places="0"')
  })

  test('a host’s betas is the whole pane, in place of the app’s own list', async () => {
    const html = draw('/beta', createElement('div', { 'data-slot': 'portal' }))
    expect(html).toContain('data-slot="portal"')
    // Rendered twice, so the list's lazy module has had its turn to load.
    await Promise.resolve()
    expect(draw('/beta', createElement('div', { 'data-slot': 'portal' }))).not.toContain('betas-pane')
  })

  test('with no betas from the host, the pane is the app’s own list', async () => {
    draw('/beta')
    await new Promise((r) => setTimeout(r, 0))
    const html = draw('/beta')
    expect(html).toContain('data-slot="betas-pane"')
    expect(html).toContain('data-slot="app-column" data-places="0"')
  })

  test('a phone’s bar and menu in Betas carry no Dev places', () => {
    state.drawer = 'open'
    const html = draw('/beta')
    expect(html).toMatch(/data-slot="app-bar" data-places="0"/)
    // The menu is the column on the floor, with no places of Dev's in it.
    expect(html).toMatch(/data-slot="drawer"[^>]*>.*data-slot="app-column" data-places="0"/)
  })

  test('a phone’s menu is one sidebar column: no side-by-side rail, and no foot of its own', () => {
    state.drawer = 'open'
    const html = draw('/chat')
    // First Build: a single unified drawer sidebar replaced the rail-beside-column menu.
    expect(html).not.toContain('data-slot="drawer-rail"')
    expect(html).toMatch(/data-slot="drawer"[^>]*>.*data-slot="app-column"/)
    expect(html).not.toContain('data-slot="drawer-foot"')
    expect(html).not.toContain('data-slot="drawer-chat"')
  })

  test('Tabs draws the sidebar beside its panes', () => {
    const html = draw('/tabs')
    expect(html).toContain('data-slot="app-column"')
    expect(html).toMatch(/data-slot="app-bar" data-places="none"/)
  })

  test('a hosted app draws its pane, the rail, and the sidebar column with none of Dev’s places', async () => {
    draw('/apps/crm')
    await new Promise((r) => setTimeout(r, 0))
    const html = draw('/apps/crm')
    expect(html).toContain('data-slot="rail"')
    expect(html).toContain('data-slot="hosted-pane" data-id="crm"')
    expect(html).toContain('data-slot="app-column" data-places="0"')
    expect(html).not.toContain('betas-pane')
  })

  test('a phone’s menu over a hosted app carries no places of Dev’s', () => {
    state.drawer = 'open'
    const html = draw('/apps/crm')
    expect(html).toMatch(/data-slot="app-bar" data-places="0"/)
    expect(html).toMatch(/data-slot="drawer"[^>]*>.*data-slot="app-column" data-places="0"/)
  })

  test('Chat keeps its sidebar', () => {
    expect(draw('/chat')).toContain('data-slot="app-column"')
  })

  test('in-app /settings/organization/billing draws SettingsList and SettingsPane on billing', async () => {
    draw('/settings/organization/billing')
    await new Promise((r) => setTimeout(r, 0))
    const html = draw('/settings/organization/billing')
    expect(html).toContain('data-slot="settings-list" data-active="billing"')
    expect(html).toContain('data-slot="settings-pane" data-id="billing"')
  })
})

describe('the pane keeps one gap all round', () => {
  const frame = (html: string) => html.match(/<div[^>]*data-slot="frame"[^>]*>/)![0]

  test('the panels leave the same gap above, below and at the end, in every app and under a window’s bar', () => {
    for (const path of ['/chat', '/dev', '/beta', '/tabs']) {
      for (const tag of [frame(draw(path)), frame(draw(path, undefined, {}))]) {
        expect(tag).toContain('data-pt="var(--pane-gap)"')
        expect(tag).toContain('data-pb="var(--pane-gap)"')
        expect(tag).toContain('data-pe="var(--pane-gap)"')
      }
    }
  })

  test('only a desktop window draws a bar, with Back and Forward; the web draws none above the panels', () => {
    const web = draw('/chat')
    expect(web).not.toContain('data-slot="title-bar"')
    expect(web).not.toContain('data-slot="back"')
    expect(web).not.toContain('data-slot="forward"')
    const window = draw('/chat', undefined, {})
    expect(window).toContain('data-slot="title-bar"')
    expect(window).toContain('data-slot="back"')
    expect(window).toContain('data-slot="forward"')
  })
})
