import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Agent, AgentRun } from '@hanzo/ai'

const { keptState, part } = vi.hoisted(() => {
  const keptState: Record<string, unknown> = {}
  type Props = {
    children?: ReactNode
    render?: string
    'data-slot'?: string
    'data-parity-key'?: string
    'data-name'?: string
    'data-cols'?: number
    'data-icon-size'?: string
    'data-avatar-px'?: number
    gridTemplateColumns?: string
    'aria-label'?: string
  }
  const part = ({
    children,
    render,
    'data-slot': slot,
    'data-parity-key': parity,
    'data-name': name,
    'data-cols': cols,
    'data-icon-size': iconSize,
    'data-avatar-px': avatarPx,
    gridTemplateColumns,
    'aria-label': ariaLabel,
  }: Props) => {
    const attrs: Record<string, unknown> = {}
    if (slot !== undefined) attrs['data-slot'] = slot
    if (parity !== undefined) attrs['data-parity-key'] = parity
    if (name !== undefined) attrs['data-name'] = name
    if (cols !== undefined) attrs['data-cols'] = String(cols)
    if (iconSize !== undefined) attrs['data-icon-size'] = iconSize
    if (avatarPx !== undefined) attrs['data-avatar-px'] = String(avatarPx)
    if (gridTemplateColumns !== undefined) attrs['data-grid-cols'] = gridTemplateColumns
    if (ariaLabel !== undefined) attrs['aria-label'] = ariaLabel
    return createElement(typeof render === 'string' ? render : 'div', attrs, children)
  }
  return { keptState, part }
})

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string, v?: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? '')) }) }))
vi.mock('@hanzo/gui', () => ({ Input: part, Text: part, XStack: part, YStack: part }))
vi.mock('@hanzo/ui', () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => createElement('div', { 'data-slot': 'dropdown' }, children),
  DropdownMenuContent: part,
  DropdownMenuItem: part,
  DropdownMenuLabel: part,
  DropdownMenuSeparator: () => createElement('hr'),
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))
vi.mock('lucide-react', () => {
  const icon = () => createElement('svg')
  return {
    ArrowLeft: icon,
    Check: icon,
    Grid2x2Plus: icon,
    Layers: icon,
    LayoutGrid: icon,
    Pin: icon,
    PinOff: icon,
    Plus: icon,
    Search: icon,
    SlidersHorizontal: icon,
    Users: icon,
    Workflow: icon,
    X: icon,
  }
})
vi.mock('../kept', () => ({
  useKept: <T,>(key: string, initial: T): [T, (next: T) => void] => {
    const value = key in keptState ? (keptState[key] as T) : initial
    return [value, (next: T) => { keptState[key] = next }]
  },
}))
vi.mock('../lib/signout', () => ({ useSigningOut: () => false, useSignOut: () => async () => {} }))
vi.mock('../PreferencesDialog', () => ({ PreferencesDialog: () => null }))
vi.mock('./ConnectorsDialog', () => ({ ConnectorsDialog: () => null }))
vi.mock('./face', () => ({
  Face: ({ bot, size }: { bot: { name: string }; size?: number }) =>
    createElement('div', { 'data-slot': 'face', 'data-bot': bot.name, 'data-size': String(size ?? 36) }),
}))

import { Roster } from './Roster'

const bots: Agent[] = [
  { id: '1', name: 'hanzo', model: 'enso', createdAt: '2026-10-01T09:00:00Z' },
  { id: '2', name: 'vi', model: 'enso', createdAt: '2026-10-02T09:00:00Z' },
  { id: '3', name: 'dev', model: 'enso', createdAt: '2026-10-03T09:00:00Z' },
  { id: '4', name: 'custom-bot', model: 'enso', createdAt: '2026-10-04T09:00:00Z' },
]

const renderRoster = (width: number) =>
  renderToStaticMarkup(
    createElement(Roster, {
      bots,
      groups: [{ id: 'g1', name: 'core', layer: 1, members: ['hanzo', 'vi'], policy: { kind: 'leader', leader: 'hanzo' } }],
      last: new Map<string, AgentRun>(),
      open: 'hanzo',
      unread: null,
      me: null,
      width,
      onPick: () => {},
      onMake: () => {},
      onMakeGroup: () => {},
      disabled: false,
    }),
  )

beforeEach(() => {
  for (const k of Object.keys(keptState)) delete keptState[k]
})

describe('Bots Roster sidebar', () => {
  test('renders 1, 2, and 3 pinned columns across width breakpoints', () => {
    const c1 = renderRoster(200)
    expect(c1).toContain('data-cols="1"')
    expect(c1).toContain('data-grid-cols="repeat(1, minmax(0, 1fr))"')

    const c2 = renderRoster(256)
    expect(c2).toContain('data-cols="2"')
    expect(c2).toContain('data-grid-cols="repeat(2, minmax(0, 1fr))"')

    const c3 = renderRoster(320)
    expect(c3).toContain('data-cols="3"')
    expect(c3).toContain('data-grid-cols="repeat(3, minmax(0, 1fr))"')
  })

  test('renders all 4 avatar sizes (xs 24px, sm 32px, md 44px, lg 56px) and applies the selected size to pinned faces', () => {
    const cases: Array<['xs' | 'sm' | 'md' | 'lg', number]> = [
      ['xs', 24],
      ['sm', 32],
      ['md', 44],
      ['lg', 56],
    ]
    for (const [sz, px] of cases) {
      keptState['hanzo.bots.roster.iconSize'] = sz
      const html = renderRoster(256)
      expect(html).toContain(`data-icon-size="${sz}"`)
      expect(html).toContain(`data-avatar-px="${px}"`)
      expect(html).toContain(`data-slot="face" data-bot="hanzo" data-size="${px}"`)
    }

    const menuHtml = renderRoster(256)
    expect(menuHtml).toContain('data-slot="bots-size-xs"')
    expect(menuHtml).toContain('data-slot="bots-size-sm"')
    expect(menuHtml).toContain('data-slot="bots-size-md"')
    expect(menuHtml).toContain('data-slot="bots-size-lg"')
  })

  test('renders Pinned Bots above the hairline divider, followed by GROUPS & LAYERS, unpinned bots, and /flow Workflows below', () => {
    keptState['hanzo.bots.roster.pinned'] = ['hanzo', 'vi']
    const html = renderRoster(256)

    const pinnedIdx = html.indexOf('data-slot="bots-pinned"')
    const dividerIdx = html.indexOf('data-slot="bots-divider"')
    const groupsIdx = html.indexOf('data-parity-key="bots.groups"')
    const unpinnedIdx = html.indexOf('data-slot="bots-unpinned"')
    const workflowsIdx = html.indexOf('data-slot="bots-workflows"')

    expect(pinnedIdx).toBeGreaterThanOrEqual(0)
    expect(dividerIdx).toBeGreaterThan(pinnedIdx)
    expect(groupsIdx).toBeGreaterThan(dividerIdx)
    expect(unpinnedIdx).toBeGreaterThan(groupsIdx)
    expect(workflowsIdx).toBeGreaterThan(unpinnedIdx)

    // Pinned section contains hanzo & vi with unpin controls; unpinned contains dev & custom-bot with pin controls.
    const pinnedSlice = html.slice(pinnedIdx, dividerIdx)
    expect(pinnedSlice).toContain('data-name="hanzo"')
    expect(pinnedSlice).toContain('data-name="vi"')
    expect(pinnedSlice).not.toContain('data-name="custom-bot"')
    expect(pinnedSlice).toContain('data-slot="bots-unpin"')

    const unpinnedSlice = html.slice(unpinnedIdx, workflowsIdx)
    expect(unpinnedSlice).toContain('data-name="dev"')
    expect(unpinnedSlice).toContain('data-name="custom-bot"')
    expect(unpinnedSlice).not.toContain('data-name="hanzo"')
    expect(unpinnedSlice).toContain('data-slot="bots-pin"')

    // Subtle /flow Workflows entry is present below.
    expect(html).toContain('data-slot="bots-workflows-link"')
    expect(html).toContain('/flow')
  })
})
