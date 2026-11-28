import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

const { part, row, convMenu, presses, state, devState, capturedActions, marked } = vi.hoisted(() => {
  type Part = { children?: ReactNode; 'data-slot'?: string; 'aria-label'?: string; 'aria-expanded'?: boolean; active?: boolean }
  const presses: (() => void)[] = []
  const state = { threads: [] as { id: string; title: string; updatedAt: string; pinned?: boolean }[] }
  const devState = { sessions: [] as { id: string; title: string; status: string; createdAt: string }[] }
  const capturedActions: { remove?: (t: { id: string; title?: string }) => Promise<boolean>; rename?: (t: { id: string; title?: string }, next: string) => Promise<boolean> }[] = []
  const part = ({ children, 'data-slot': slot, 'aria-label': label, 'aria-expanded': expanded }: Part) =>
    createElement('div', { 'data-slot': slot, 'aria-label': label, 'aria-expanded': expanded }, children)
  const convMenu = ({ children, canShare, noun, customActions }: { children?: ReactNode; canShare?: boolean; noun?: string; customActions?: typeof capturedActions[number] }) => {
    if (customActions) capturedActions.push(customActions)
    return createElement('div', { 'data-slot': 'conv-menu', 'data-share': String(Boolean(canShare)), 'data-noun': noun }, children)
  }
  // What @hanzo/build's run marks store was asked to keep, by run id.
  const marked: Record<string, Record<string, unknown>> = {}
  const row = ({ children, active, onPress }: Part & { onPress?: () => void }) => {
    if (onPress) presses.push(onPress)
    return createElement('div', { 'data-slot': 'row', 'aria-current': active ? 'page' : undefined }, children)
  }
  return { part, row, convMenu, presses, state, devState, capturedActions, marked }
})

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s, dir: 'ltr' }) }))
vi.mock('@hanzo/gui', () => ({ ScrollView: part, SizableText: part, XStack: part, YStack: part }))
vi.mock('lucide-react', () => ({ CheckSquare: () => null, ChevronDown: () => null, ChevronRight: () => null, GitPullRequest: () => null, ListFilter: () => null }))
vi.mock('@hanzo/dev/builder', () => ({
  DOTS: { running: 'running', done: 'done', error: 'error' },
  route: () => ({ kind: 'new' }),
  useSessions: () => ({ value: devState.sessions, loading: false, error: null, reload: () => {} }),
  useRunMarks: () => [marked, (id: string, patch: Record<string, unknown>) => void (marked[id] = { ...marked[id], ...patch })],
}))
vi.mock('@hanzo/ui', () => ({
  DropdownMenu: ({ items }: { items: { key: string }[] }) => createElement('div', { 'data-slot': 'menu' }, items.map((i) => createElement('span', { key: i.key, 'data-item': i.key }))),
}))
vi.mock('@hanzo/ui/chat', () => ({ SidebarItem: row, StatusDot: ({ status }: { status: string }) => createElement('span', { 'data-dot': status }) }))
vi.mock('./thread', () => ({ ConversationMenu: convMenu, ThreadRow: ({ children, aside }: { children?: ReactNode; aside?: ReactNode }) => createElement('div', null, children, aside), useThreadList: () => ({ threads: state.threads, loading: false, error: null }) }))

function studio(read?: () => { rows: unknown[]; error: string }) {
  vi.resetModules()
  vi.doMock('@hanzo/studio', () => ({
    path: (r: { kind: string; id?: string }) => (r.kind === 'chat' ? `c/${r.id}` : ''),
    route: (at: string) => (at.startsWith('c/') ? { kind: 'chat', id: at.slice(2) } : { kind: 'new' }),
    useRecent: read,
  }))
}

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
  state.threads = []
  devState.sessions = []
  capturedActions.length = 0
  for (const k of Object.keys(marked)) delete marked[k]
  vi.unstubAllGlobals()
  vi.doUnmock('@hanzo/studio')
})

describe('Design’s Recents & collapsible Pinned section', () => {
  test('lists Studio’s conversations with ConversationMenu (canShare=false), the one Studio holds lit, and opens a row at its address in Design', async () => {
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
    expect(html).toMatch(/aria-current="page">Logo</)
    // First Build: a row wears its age, and a dot only while it works or when it failed; the settled Logo has none.
    expect(html.match(/data-dot="[a-z]+"/g)).toEqual(['data-dot="running"', 'data-dot="error"'])
    // Design conversations now have full ConversationMenu + Select multiple, with Chat-only Share disabled.
    expect(html).toContain('data-slot="conv-menu" data-share="false" data-noun="design"')
    expect(html).toContain('select-multiple')
    expect(html).not.toContain('data-item="status-')
    expect(html).not.toContain('No chats yet.')
    presses.at(-1)!()
    expect(went).toEqual(['c/d3'])
  })

  test('renders a collapsible Pinned section above Recents when pinned threads exist', async () => {
    state.threads = [
      { id: 'c1', title: 'Pinned strategy', updatedAt: new Date(now - 60_000).toISOString(), pinned: true },
      { id: 'c2', title: 'Daily notes', updatedAt: new Date(now - 120_000).toISOString(), pinned: false },
    ]
    const { Recents } = await import('./Recents')
    const html = renderToStaticMarkup(createElement(Recents, { host: {} as never, mode: 'chat', thread: null, onOpen: () => {}, onNew: () => {} }))
    expect(html).toContain('data-slot="pinned-group-toggle"')
    expect(html).toContain('data-slot="conv-menu" data-share="true" data-noun="chat"')
    expect(html.indexOf('Pinned strategy')).toBeLessThan(html.indexOf('Daily notes'))
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

  test('deleting or renaming a Dev run sends Authorization and X-Org-Id to /v1/agent/sessions/:id', async () => {
    const calls: { url: string; method?: string; headers?: Record<string, string> }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method, headers: init?.headers as Record<string, string> })
        return { ok: true, status: 200 }
      }),
    )
    devState.sessions = [{ id: 'sess_del_1', title: 'Old run', status: 'done', createdAt: new Date(now - 60_000).toISOString() }]
    const { Recents } = await import('./Recents')
    const host = { api: 'https://api.hanzo.ai', org: 'mvee85560', token: () => 'tok_123', path: '', go: () => {} } as never
    renderToStaticMarkup(createElement(Recents, { host, mode: 'dev', thread: null, onOpen: () => {}, onNew: () => {} }))
    expect(capturedActions.length).toBeGreaterThan(0)
    await capturedActions[0]!.remove?.({ id: 'sess_del_1', title: 'Old run' })
    await capturedActions[0]!.rename?.({ id: 'sess_del_1', title: 'Old run' }, 'Renamed run')
    expect(calls).toEqual([
      {
        url: 'https://api.hanzo.ai/v1/agent/sessions/sess_del_1',
        method: 'DELETE',
        headers: { Authorization: 'Bearer tok_123', 'X-Org-Id': 'mvee85560' },
      },
      {
        url: 'https://api.hanzo.ai/v1/agent/sessions/sess_del_1',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok_123', 'X-Org-Id': 'mvee85560' },
      },
    ])
  })

  test('a Dev run’s menu calls it a run, and its archive, pin and delete go to the store a run’s own menu writes (@hanzo/build)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200 })))
    devState.sessions = [{ id: 'sess_a', title: 'Add a checkout page', status: 'done', createdAt: new Date(now - 60_000).toISOString() }]
    const { Recents } = await import('./Recents')
    const host = { api: 'https://api.hanzo.ai', org: 'acme', token: () => 'tok', path: '', go: () => {} } as never
    const html = renderToStaticMarkup(createElement(Recents, { host, mode: 'dev', thread: null, onOpen: () => {}, onNew: () => {} }))
    expect(html).toContain('data-noun="run"')
    const act = capturedActions[0] as unknown as {
      archive: (t: { id: string; archived?: boolean }) => Promise<boolean>
      pin: (t: { id: string; pinned?: boolean }) => Promise<boolean>
      remove: (t: { id: string }) => Promise<boolean>
    }
    await act.archive({ id: 'sess_a', archived: false })
    await act.pin({ id: 'sess_a', pinned: false })
    expect(marked.sess_a).toEqual({ archived: true, pinned: true })
    await act.archive({ id: 'sess_a', archived: true })
    expect(marked.sess_a).toMatchObject({ archived: false })
    await act.remove({ id: 'sess_a' })
    expect(marked.sess_a).toMatchObject({ deleted: true })
  })

  test('a run archived from its own page is out of the Recents list, and one deleted there too', async () => {
    devState.sessions = [
      { id: 'sess_keep', title: 'Fix the footer', status: 'done', createdAt: new Date(now - 60_000).toISOString() },
      { id: 'sess_arch', title: 'Old experiment', status: 'done', createdAt: new Date(now - 120_000).toISOString() },
      { id: 'sess_gone', title: 'Wrong turn', status: 'done', createdAt: new Date(now - 180_000).toISOString() },
    ]
    marked.sess_arch = { archived: true }
    marked.sess_gone = { deleted: true }
    const { Recents } = await import('./Recents')
    const host = { api: 'https://api.hanzo.ai', org: 'acme', token: () => 'tok', path: '', go: () => {} } as never
    const html = renderToStaticMarkup(createElement(Recents, { host, mode: 'dev', thread: null, onOpen: () => {}, onNew: () => {} }))
    expect(html).toContain('Fix the footer')
    expect(html).not.toContain('Old experiment')
    expect(html).not.toContain('Wrong turn')
  })
})
