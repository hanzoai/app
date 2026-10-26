import { createElement, Fragment, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// The window's frame, drawn with every part it holds stood in by a div that
// names itself: what is under test is which parts Betas, Tabs and Chat draw,
// not how each is drawn. A part that takes places says how many groups it got.
const { part, stub, state, through } = vi.hoisted(() => {
  type Part = { children?: ReactNode; 'data-slot'?: string; pt?: unknown; pb?: unknown; paddingInlineEnd?: unknown }
  const through = ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children)
  // The frame's padding is what these tests read, so it is written on the stand-in.
  const part = ({ children, 'data-slot': slot, pt, pb, paddingInlineEnd }: Part) =>
    createElement('div', { 'data-slot': slot, 'data-pt': pt as string | undefined, 'data-pb': pb as string | undefined, 'data-pe': paddingInlineEnd as string | undefined }, children)
  const stub = (slot: string) => (props: { places?: unknown[]; children?: ReactNode }) =>
    createElement('div', { 'data-slot': slot, 'data-places': props.places === undefined ? 'none' : String(props.places.length) }, props.children)
  const state = { path: '/beta', drawer: 'shut' as 'shut' | 'open' }
  return { part, stub, state, through }
})

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('lucide-react', () => ({ ArrowLeft: () => null, ArrowRight: () => null, RefreshCw: () => null }))
vi.mock('@hanzo/ai/react', () => ({ AiProvider: through }))
vi.mock('@hanzo/gui', () => ({ XStack: part, YStack: part }))
vi.mock('@hanzo/build', () => ({
  Builder: stub('builder'),
  HostProvider: through,
  PrefsProvider: through,
  route: () => ({ kind: 'home' }),
  tabs: () => [],
}))
vi.mock('@hanzo/studio', () => ({ nav: () => [{ id: 'studio', links: [] }], Studio: stub('studio') }))
vi.mock('./lib/ai', () => ({ useAi: () => ({ client: null }) }))
vi.mock('./Chat', () => ({ Chat: stub('chat') }))
vi.mock('./Column', () => ({ Column: stub('app-column') }))
vi.mock('./Learning', () => ({ Learning: () => null }))
vi.mock('./dev', () => ({ isPlans: () => false, leave: () => {}, useDevHost: () => ({ go: () => {}, path: '', token: () => '' }) }))
vi.mock('./Orgs', () => ({ Orgs: through }))
vi.mock('./host', () => ({ useRooms: () => ({ router: { back: () => {}, forward: () => {}, push: () => {} }, path: state.path }) }))
vi.mock('./kept', () => ({ useKept: () => [false, () => {}] }))
vi.mock('./Rail', () => ({ Mark: () => null, raised: () => null, Rail: stub('rail'), Toggle: () => null }))
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
vi.mock('./Shell', () => ({ Paned: through }))
vi.mock('./Palette', () => ({ Palette: () => null }))
vi.mock('./seek', () => ({ summons: () => false }))
vi.mock('./ground', () => ({ floor: {}, pane: () => ({}) }))
vi.mock('./lib/session', () => ({ pick: () => {} }))
vi.mock('./lib/host', () => ({
  TERMINALS: '/tabs',
  app: (at: string) => `/dev/${at}`,
  go: () => {},
  settings: () => '/settings',
  studio: (at: string) => `/studio/${at}`,
  talk: () => '/chat',
  visit: () => {},
  place: (p: string) => (p === '/beta' ? { mode: 'beta' } : p === '/tabs' ? { mode: 'tabs' } : p === '/chat' ? { mode: 'chat', thread: null } : null),
}))
vi.mock('./Top', () => ({ Top: stub('app-bar') }))
vi.mock('./view', () => ({ FOOT: 0, HEIGHT: '100dvh', TOP: 0, useView: () => () => {} }))
vi.mock('./WindowControls', () => ({ dragWindow: () => {}, toggleWindowMaximize: () => {}, WindowControls: () => null }))
vi.mock('./Betas', () => ({ BetasPane: stub('betas-pane') }))

import { App } from './App'

const draw = (path: string, betas?: ReactNode, bar?: { inset?: number }) => {
  state.path = path
  return renderToStaticMarkup(createElement(App, { betas, bar }))
}

beforeEach(() => {
  state.drawer = 'shut'
})

describe('Betas stands alone, as Tabs does', () => {
  test('Betas draws the rail and the pane, and no sidebar beside them', () => {
    const html = draw('/beta', createElement('div', { 'data-slot': 'portal' }))
    expect(html).toContain('data-slot="rail"')
    expect(html).not.toContain('data-slot="app-column"')
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
    expect(html).not.toContain('data-slot="app-column"')
  })

  test('a phone’s bar and menu in Betas carry no Dev places', () => {
    state.drawer = 'open'
    const html = draw('/beta')
    expect(html).toMatch(/data-slot="app-bar" data-places="0"/)
    // The menu is the column on the floor, with no places of Dev's in it.
    expect(html).toMatch(/data-slot="drawer"[^>]*>.*data-slot="app-column" data-places="0"/)
  })

  test('Tabs is as it was: no sidebar beside its panes, and the bar’s places are Dev’s', () => {
    const html = draw('/tabs')
    expect(html).not.toContain('data-slot="app-column"')
    expect(html).toMatch(/data-slot="app-bar" data-places="none"/)
  })

  test('Chat keeps its sidebar', () => {
    expect(draw('/chat')).toContain('data-slot="app-column"')
  })
})

describe('the pane keeps one gap all round', () => {
  const frame = (html: string) => html.match(/<div[^>]*data-slot="frame"[^>]*>/)![0]

  test('above, below and at its end the frame leaves the same gap', () => {
    const tag = frame(draw('/chat'))
    expect(tag).toContain('data-pt="var(--pane-gap)"')
    expect(tag).toContain('data-pb="var(--pane-gap)"')
    expect(tag).toContain('data-pe="var(--pane-gap)"')
  })

  test('a window’s own bar stands for the gap above', () => {
    expect(frame(draw('/chat', undefined, {}))).toContain('data-pt="0"')
  })

  test('the same holds in Betas and Tabs', () => {
    for (const path of ['/beta', '/tabs']) expect(frame(draw(path))).toContain('data-pt="var(--pane-gap)"')
  })
})
