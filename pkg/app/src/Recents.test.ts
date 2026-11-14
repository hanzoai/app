import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

// The drawing libraries are not under test and do not load outside a bundler. A
// part draws its children as a div carrying its slot, label and lit state; a row
// keeps its press, so a test can press it after the markup is drawn; a menu draws
// its items' keys.
const { part, row, presses } = vi.hoisted(() => {
  type Part = { children?: ReactNode; 'data-slot'?: string; 'aria-label'?: string; active?: boolean }
  const presses: (() => void)[] = []
  const part = ({ children, 'data-slot': slot, 'aria-label': label }: Part) => createElement('div', { 'data-slot': slot, 'aria-label': label }, children)
  const row = ({ children, active, onPress }: Part & { onPress?: () => void }) => {
    if (onPress) presses.push(onPress)
    return createElement('div', { 'data-slot': 'row', 'aria-current': active ? 'page' : undefined }, children)
  }
  return { part, row, presses }
})

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s, dir: 'ltr' }) }))
vi.mock('@hanzo/gui', () => ({ ScrollView: part, SizableText: part, XStack: part, YStack: part }))
vi.mock('lucide-react', () => ({ CheckSquare: () => null, ChevronDown: () => null, ChevronRight: () => null, GitPullRequest: () => null, ListFilter: () => null }))
vi.mock('@hanzo/build', () => ({
  DOTS: { running: 'running', done: 'done', error: 'error' },
  route: () => ({ kind: 'new' }),
  useSessions: () => ({ value: [], loading: false, error: null, reload: () => {} }),
}))
vi.mock('@hanzo/ui', () => ({
  DropdownMenu: ({ items }: { items: { key: string }[] }) => createElement('div', { 'data-slot': 'menu' }, items.map((i) => createElement('span', { key: i.key, 'data-item': i.key }))),
}))
vi.mock('@hanzo/ui/chat', () => ({ SidebarItem: row, StatusDot: ({ status }: { status: string }) => createElement('span', { 'data-dot': status }) }))
vi.mock('./thread', () => ({ ConversationMenu: part, ThreadRow: part, useThreadList: () => ({ threads: [], loading: false, error: null }) }))

/** Studio as the app finds it: with `useRecent` (0.1.11 on) answering `read`, or without it (0.1.8). */
function studio(read?: () => { rows: unknown[]; error: string }) {
  vi.resetModules()
  vi.doMock('@hanzo/studio', () => ({
    path: (r: { kind: string; id?: string }) => (r.kind === 'chat' ? `c/${r.id}` : ''),
    route: (at: string) => (at.startsWith('c/') ? { kind: 'chat', id: at.slice(2) } : { kind: 'new' }),
    // A real module namespace answers undefined for an export it lacks; a vitest mock throws, so it is said outright.
    useRecent: read,
  }))
}

/** Design's Recents, drawn with Studio at `at`, and where a pressed row went. */
async function design(at = '') {
  const went: string[] = []
  const { Recents } = await import('./Recents')
  const host = { path: at, go: (p: string) => went.push(p) } as never
  const html = renderToStaticMarkup(createElement(Recents, { host, mode: 'design', thread: null, onOpen: () => {}, onNew: () => {} }))
  return { html, went }
}

const now = Date.now()

afterEach(() => {
  presses.length = 0
  vi.doUnmock('@hanzo/studio')
})

describe('Design’s Recents', () => {
  test('lists Studio’s conversations, the one Studio holds lit, and opens a row at its address in Design', async () => {
    studio(() => ({
      rows: [
        { id: 'd1', title: 'Spring poster', updated: now - 60_000, state: 'making', count: 1 },
        { id: 'd2', title: 'Logo', updated: now - 3_600_000, state: 'done', count: 2 },
        { id: 'd3', title: 'Deck', updated: now - 7_200_000, state: 'failed', count: 0 },
      ],
      error: '',
    }))
    const { html, went } = await design('c/d2')
    expect(html.indexOf('Spring poster')).toBeLessThan(html.indexOf('Logo'))
    expect(html.indexOf('Logo')).toBeLessThan(html.indexOf('Deck'))
    expect(html).toMatch(/aria-current="page"><div>Logo</)
    // A dot while it works or when it failed; at rest, none.
    expect(html.match(/data-dot="[a-z]+"/g)).toEqual(['data-dot="running"', 'data-dot="error"'])
    // No Chat menu on its rows: no Select multiple, and no Status to narrow by.
    expect(html).not.toContain('select-multiple')
    expect(html).not.toContain('data-item="status-')
    expect(html).not.toContain('No chats yet.')
    presses.at(-1)!()
    expect(went).toEqual(['c/d3'])
  })

  test('says so when Studio has made nothing yet, and shows Studio’s own refusal', async () => {
    studio(() => ({ rows: [], error: '' }))
    expect((await design()).html).toContain('Nothing made yet.')
    studio(() => ({ rows: [], error: 'Sign in to keep what you make.' }))
    expect((await design()).html).toContain('Sign in to keep what you make.')
  })

  test('with a Studio that cannot list its conversations, lists nothing: never Chat’s', async () => {
    studio()
    const { html } = await design()
    expect(html).not.toContain('data-slot="recents"')
    expect(html).not.toContain('Nothing made yet.')
    expect(html).not.toContain('No chats yet.')
  })
})
