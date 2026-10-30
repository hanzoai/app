// The rail's marks for the apps that draw inside the app: which a reader is shown,
// where they go, and that the same apps are not also offered a second way.
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({ opened: new Set<string>(), went: [] as string[] }))

// The drawing libraries are not under test: each part stands in as an element that keeps what a test reads.
type Part = { children?: ReactNode; 'data-slot'?: string; 'aria-label'?: string; 'aria-current'?: string; onPress?: () => void; label?: string; active?: boolean }
const draw = ({ children, 'data-slot': slot, 'aria-label': named, 'aria-current': current }: Part) => createElement('div', { 'data-slot': slot, 'aria-label': named, 'aria-current': current }, children)
vi.mock('@hanzo/gui', () => ({ Text: draw, XStack: draw, YStack: draw }))
vi.mock('@hanzo/build', () => ({ route: () => ({ kind: 'home' }) }))
vi.mock('@hanzo/ui', () => ({
  DropdownMenu: ({ trigger, items }: { trigger?: ReactNode; items?: { key?: string; label?: string }[] }) =>
    createElement('div', { 'data-slot': 'menu', 'data-items': (items ?? []).map((i) => i.key ?? '-').join(',') }, trigger),
}))
vi.mock('@hanzo/ui/chat', () => ({
  SidebarItem: ({ children, 'data-slot': slot, active }: Part) => createElement('div', { 'data-slot': slot, 'aria-current': active ? 'page' : undefined }, children),
}))
vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s, dir: 'ltr' }) }))
vi.mock('./Betas', () => ({ BetasDialog: () => null, useBetas: () => ({ open: (id: string) => state.opened.has(id) }) }))
vi.mock('./help', () => ({ out: (href: string) => state.went.push(href) }))
vi.mock('./Account', () => ({ Account: () => null }))

const { Rail } = await import('./Rail')

const host = {} as never
const draw5 = (props: { mode?: 'chat' | 'hosted'; inside?: string | null; rows?: boolean } = {}) =>
  renderToStaticMarkup(
    createElement(Rail, { host, mode: props.mode ?? 'chat', at: null, inside: props.inside ?? null, open: true, rows: props.rows, onChat: () => {}, onDev: () => {}, onStudio: () => {}, onTabs: () => {}, go: () => {}, onOrg: () => {} }),
  )
const marks = (html: string) => [...html.matchAll(/data-slot="(?:rail|place)-app-([a-z]+)"/g)].map((m) => m[1])

beforeEach(() => {
  state.opened = new Set()
  state.went = []
})

describe('the apps that draw inside the app, on the rail', () => {
  test('a reader with no app open has none of their marks', () => {
    expect(marks(draw5())).toEqual([])
  })

  test('a member with beta.crm alone has CRM and no other', () => {
    state.opened = new Set(['crm'])
    expect(marks(draw5())).toEqual(['crm'])
  })

  test('staff, for whom every beta opens, have all five, in the registry\'s order', () => {
    state.opened = new Set(['crm', 'commerce', 'cms', 'analytics', 'insights', 'erp', 'finance'])
    expect(marks(draw5())).toEqual(['crm', 'commerce', 'cms', 'analytics', 'insights'])
  })

  test('they stand after Tabs and before Library, so before the overflow', () => {
    state.opened = new Set(['crm', 'insights'])
    const html = draw5()
    const at = (slot: string) => html.indexOf(`data-slot="${slot}"`)
    expect(at('rail-tabs')).toBeLessThan(at('rail-app-crm'))
    expect(at('rail-app-insights')).toBeLessThan(at('rail-library'))
    expect(at('rail-betas')).toBeLessThan(at('rail-more'))
  })

  test('the one the reader is in is lit, and the others are not', () => {
    state.opened = new Set(['crm', 'cms'])
    const html = draw5({ mode: 'hosted', inside: 'cms' })
    expect(html).toMatch(/data-slot="rail-app-cms"[^>]*aria-current="page"|aria-current="page"[^>]*data-slot="rail-app-cms"/)
    expect(html).not.toMatch(/data-slot="rail-app-crm"[^>]*aria-current="page"/)
  })

  test('a phone\'s menu lists the same apps as rows, in the same order, after Tabs', () => {
    state.opened = new Set(['crm', 'analytics'])
    const html = draw5({ rows: true })
    expect(marks(html)).toEqual(['crm', 'analytics'])
    expect(html.indexOf('data-slot="place-tabs"')).toBeLessThan(html.indexOf('data-slot="place-app-crm"'))
    expect(html.indexOf('data-slot="place-app-analytics"')).toBeLessThan(html.indexOf('data-slot="place-more"'))
  })

  test('are not offered a second way in the overflow: More lists the other betas only', () => {
    state.opened = new Set(['crm', 'finance'])
    const items = draw5().match(/data-slot="menu" data-items="([^"]*)"/)![1]
    expect(items).toContain('beta-finance')
    expect(items).not.toContain('beta-crm')
  })
})
