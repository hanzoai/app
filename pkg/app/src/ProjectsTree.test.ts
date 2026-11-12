import { describe, expect, test, vi } from 'vitest'
import type { Recent } from './recent'

vi.mock('@hanzo/gui', () => ({ SizableText: () => null, XStack: () => null, YStack: () => null }))
vi.mock('@hanzo/ui', () => ({ Button: () => null, Dialog: () => null, DialogContent: () => null, DialogTitle: () => null, Input: () => null }))
vi.mock('@hanzo/ui/chat', () => ({ SidebarItem: () => null }))
vi.mock('./thread', () => ({ ConversationMenu: () => null, ThreadRow: () => null }))

const {
  EMPTY_CHAT_PROJECTS,
  groupThreadsByProject,
  hasUnreadUpdate,
  mergeProjectFolders,
  normalizeProjectSlug,
  readStoredChatProjects,
} = await import('./ProjectsTree')

describe('ProjectsTree helpers', () => {
  test('normalizes org-prefixed repo names and slugs consistently', () => {
    expect(normalizeProjectSlug('hanzoai/engine')).toBe('engine')
    expect(normalizeProjectSlug('  Hanzo Studio  ')).toBe('hanzo-studio')
  })

  test('merges local and remote project folders without duplicates, preserving local order first', () => {
    const merged = mergeProjectFolders(
      [
        { id: 'hanzo', name: 'hanzo' },
        { id: 'studio', name: 'studio' },
        { id: 'lux', name: 'lux' },
      ],
      [
        { id: 'agency', name: 'agency' },
        { id: 'hanzo', name: 'hanzo' },
      ],
    )
    expect(merged.map((f) => f.id)).toEqual(['agency', 'hanzo', 'studio', 'lux'])
  })

  test('groups explicit and implicit project threads and reports filed IDs', () => {
    const folders = [
      { id: 'hanzo', name: 'hanzo' },
      { id: 'studio', name: 'studio' },
    ]
    const rows: Recent[] = [
      { id: 't1', kind: 'chat', title: 'Describe Hanzo AI platform', began: '2026-11-12T09:50:00Z', at: '2026-11-12T10:00:00Z', pinned: false, project: 'hanzoai/hanzo' },
      { id: 't2', kind: 'chat', title: 'whoami', began: '2026-11-12T08:50:00Z', at: '2026-11-12T09:00:00Z', pinned: false },
      { id: 't3', kind: 'chat', title: 'Explain Hanzo business clearly', began: '2026-11-12T10:50:00Z', at: '2026-11-12T11:00:00Z', pinned: false },
    ]
    const { byFolder, filedIds } = groupThreadsByProject(rows, folders, { t2: 'hanzo' })
    expect(byFolder.get('hanzo')?.map((r) => r.id)).toEqual(['t1', 't2'])
    expect(byFolder.get('studio')).toEqual([])
    expect([...filedIds]).toEqual(['t1', 't2'])
  })

  test('readStoredChatProjects safely falls back on malformed storage payloads', () => {
    expect(readStoredChatProjects(null)).toEqual(EMPTY_CHAT_PROJECTS)
    expect(readStoredChatProjects('corrupt')).toEqual(EMPTY_CHAT_PROJECTS)
    const valid = readStoredChatProjects({
      folders: [{ id: 'work', name: 'work' }, { id: '', name: '' }],
      open: { work: true },
      assigned: { c1: 'work' },
    })
    expect(valid.folders).toEqual([{ id: 'work', name: 'work' }])
    expect(valid.open.work).toBe(true)
    expect(valid.assigned.c1).toBe('work')
  })

  test('hasUnreadUpdate flags background-updated threads that are not currently active', () => {
    const seen = { c1: Date.parse('2026-11-12T10:00:00Z'), c2: Date.parse('2026-11-12T10:00:00Z') }
    expect(hasUnreadUpdate('c1', '2026-11-12T10:05:00Z', null, seen)).toBe(true)
    expect(hasUnreadUpdate('c1', '2026-11-12T10:05:00Z', 'c1', seen)).toBe(false)
    expect(hasUnreadUpdate('c2', '2026-11-12T09:59:00Z', null, seen)).toBe(false)
  })
})
