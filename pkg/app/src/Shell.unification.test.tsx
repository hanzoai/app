import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

const { part } = vi.hoisted(() => {
  type Props = {
    children?: ReactNode
    name?: string
    label?: string
    'data-slot'?: string
    icon?: ReactNode
  }
  const part = ({ children, name, label, 'data-slot': slot, icon }: Props) => {
    const attrs: Record<string, unknown> = {}
    if (slot !== undefined) attrs['data-slot'] = slot
    if (name !== undefined) attrs['data-name'] = name
    if (label !== undefined) attrs['data-label'] = label
    return createElement('div', attrs, icon, label ?? name, children)
  }
  return { part }
})

vi.mock('@hanzo/i18n/react', () => ({
  useI18n: () => ({ t: (s: string) => s, dir: 'ltr', locale: 'en' }),
}))
vi.mock('@hanzo/ai/react', () => ({
  AiProvider: ({ children }: { children?: ReactNode }) => children,
  useAgents: () => ({ agents: [], create: async () => {}, remove: async () => {}, loading: false, error: null }),
  useInbox: () => ({ channels: [] }),
  useModels: () => ({ models: [] }),
  usePeople: () => ({ people: [], loading: false, error: null }),
}))
vi.mock('@hanzo/gui', () => ({
  Box: part,
  Text: part,
  XStack: part,
  YStack: part,
}))
vi.mock('@hanzo/ui', () => ({
  Box: part,
  Shortcut: part,
  XStack: part,
  YStack: part,
  Text: part,
}))
vi.mock('./Gate', () => ({ Gate: ({ children }: { children?: ReactNode }) => children }))
vi.mock('./Account', () => ({ Account: () => null }))
vi.mock('./Search', () => ({ Search: () => null }))
vi.mock('./Settings', () => ({ FIRST: 'general', SettingsList: () => null }))
vi.mock('./OrgSwitcher', () => ({ Tiles: () => null }))
vi.mock('./WindowControls', () => ({ dragWindow: () => {}, toggleWindowMaximize: () => {}, WindowControls: () => null }))
vi.mock('./cast', () => ({ Face: () => null }))
vi.mock('./host', () => ({ useHost: () => ({ router: { push: () => {} }, path: '/' }) }))
vi.mock('./network', () => ({ channelName: (c: { key: string }) => c.key }))
vi.mock('./SettingsPane', () => ({ SettingsPane: () => null }))
vi.mock('./lib/signout', () => ({ useSigningOut: () => false, useSignOut: () => async () => {} }))
vi.mock('./lib/tiers', () => ({ useTiers: () => new Set<string>(), useHidden: () => [new Set<string>(), () => {}] as const }))
vi.mock('@hanzo/ui/glass', () => ({
  scrim: {},
  sheet: () => ({}),
}))
vi.mock('@hanzo/ui/chat', () => ({
  Sidebar: part,
  SidebarIconButton: part,
  SidebarNewChat: ({ label }: { label?: string }) => createElement('div', { 'data-slot': 'sidebar-new', 'data-label': label }, label),
  SidebarScroll: part,
  SidebarSection: ({ label, children }: { label?: string; children?: ReactNode }) =>
    createElement('section', { 'data-slot': 'sidebar-section', 'data-label': label }, children),
  SidebarItem: ({ children, 'data-slot': slot }: { children?: ReactNode; 'data-slot'?: string }) =>
    createElement('button', { 'data-slot': slot ?? 'sidebar-item' }, children),
  SidebarFolder: ({ name, children }: { name?: string; children?: ReactNode }) =>
    createElement('div', { 'data-slot': 'sidebar-folder', 'data-name': name }, children),
}))
vi.mock('@hanzo/iam/react', () => ({
  OrgProjectSwitcher: () => null,
  useIam: () => ({ user: { id: 'u1' }, isAuthenticated: true, isLoading: false }),
  useOrganizations: () => ({ currentOrg: { name: 'hanzo' }, currentOrgId: 'hanzo', organizations: [] }),
}))
vi.mock('@hanzo/build', () => ({
  Gutter: () => null,
  SideProvider: ({ children }: { children?: ReactNode }) => children,
  path: () => '/plans',
  useSplit: () => ({ main: null, aside: null, side: { hidden: false }, grip: null }),
}))
vi.mock('./dev', () => ({ useDevHost: () => ({ go: () => {}, path: '', token: () => '' }) }))
vi.mock('./keys', () => ({ useGlobalKeys: () => {} }))
vi.mock('./rail-open', () => ({ useSidebar: () => [true, () => {}, () => {}] as const }))
vi.mock('./SkipLink', () => ({ MAIN: { id: 'main-content', tabIndex: -1, render: 'main' }, SkipLink: () => null }))
vi.mock('@hanzo/mod', () => ({ restoreActiveMod: () => {} }))
vi.mock('@hanzogui/shell', () => ({ HanzoMark: () => null }))
vi.mock('@hanzo/ui/product', () => ({ BUSINESS_APPS: [], BusinessHeader: () => null }))
vi.mock('@hanzo/ui/models', () => ({ ModelPicker: () => null }))
vi.mock('@hanzo/ui/models/catalog', () => ({ parseModels: () => [] }))
vi.mock('./thread', () => ({
  ConversationMenu: ({ children }: { children?: ReactNode }) => createElement('div', { 'data-slot': 'conversation-menu' }, children),
  ThreadRow: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  useThreadList: () => ({ threads: [], loading: false, error: null }),
}))
vi.mock('./lib/ai', () => ({ useAi: () => ({ client: null }) }))
vi.mock('./lib/account', () => ({ useAccount: () => ({ user: null }) }))
vi.mock('./lib/accounts', () => ({
  useAccounts: () => ({ accounts: [], current: null, switchTo: async () => {}, add: async () => {} }),
}))
vi.mock('./lib/session', () => ({
  bearer: () => '',
  hasSession: () => true,
  org: () => 'hanzo',
  pick: () => {},
}))
vi.mock('./lib/share', () => ({
  address: (s: string) => s,
  sharedWithMe: async () => [],
}))
vi.mock('./open', () => ({
  useOpen: () => ({
    thread: null,
    open: () => {},
    empty: () => {},
    agents: [],
    openAgent: () => {},
    withAgents: () => {},
    openSession: () => {},
    aside: null,
    showAside: () => {},
    settings: null,
    showSettings: () => {},
    channel: null,
    openChannel: () => {},
  }),
}))
vi.mock('./stars', () => ({
  useStarred: () => [new Set<string>(), () => {}] as const,
  titleOf: (n: string) => n,
}))
vi.mock('./kept', () => ({
  useKept: <T,>(_k: string, init: T) => [init, () => {}] as const,
}))
vi.mock('./Upgrade', () => ({ useFree: () => false }))
vi.mock('./channels', () => ({
  useChannels: () => ({ channels: [], wrong: null }),
  teamKey: (c: { id: string }) => c.id,
  channelHref: (id: string) => `/inbox/${id}`,
}))
vi.mock('./contacts-store', () => ({
  getStoredPeople: () => [],
  getStoredAgents: () => [],
  getCustomThreads: () => [],
  createDirectChat: () => 'thread_1',
}))

import { SIDE } from './ground'
import { ROSTER_WIDTH_DEFAULT } from './bots/grid'
import { ShellIndex, SIDEBAR_WIDTH } from './Shell'

describe('hanzo.dev shell unification', () => {
  test('converges default sidebar width to 256px across ground.ts, Shell.tsx, and Bots roster', () => {
    expect(SIDE).toBe(256)
    expect(SIDEBAR_WIDTH).toBe(256)
    expect(ROSTER_WIDTH_DEFAULT).toBe(256)
  })

  test('routes mode="dev" cleanly to Projects + Threads instead of falling through to generic Chats', () => {
    const html = renderToStaticMarkup(
      createElement(ShellIndex, { mode: 'dev', owner: 'hanzo', filter: '', navigate: () => {} }),
    )
    expect(html).toContain('data-slot="dev-index"')
    expect(html).toContain('data-slot="sidebar-new" data-label="New thread"')
    expect(html).toContain('data-slot="dev-projects"')
    expect(html).toContain('data-slot="sidebar-folder" data-name="Projects"')
    expect(html).toContain('data-slot="dev-threads"')
    expect(html).toContain('data-slot="sidebar-folder" data-name="Threads"')

    // Projects precedes Threads.
    expect(html.indexOf('data-slot="dev-projects"')).toBeLessThan(html.indexOf('data-slot="dev-threads"'))
  })

  test('exposes a subtle /flow Workflows entry alongside Bots in mode="bots"', () => {
    const html = renderToStaticMarkup(
      createElement(ShellIndex, { mode: 'bots', owner: 'hanzo', filter: '', navigate: () => {} }),
    )
    expect(html).toContain('data-slot="bots-index"')
    expect(html).toContain('data-slot="bots-workflows"')
    expect(html).toContain('data-slot="bots-workflows-link"')
    expect(html).toContain('Workflows')

    // Filtering narrows Workflows cleanly.
    const hidden = renderToStaticMarkup(
      createElement(ShellIndex, { mode: 'bots', owner: 'hanzo', filter: 'zzzz-no-match', navigate: () => {} }),
    )
    expect(hidden).not.toContain('data-slot="bots-workflows"')

    const matchedByFlow = renderToStaticMarkup(
      createElement(ShellIndex, { mode: 'bots', owner: 'hanzo', filter: 'flow', navigate: () => {} }),
    )
    expect(matchedByFlow).toContain('data-slot="bots-workflows-link"')
  })
})
