import { describe, expect, test } from 'vitest'
import { CAP, find, fit, rank, RECENT, summons, type Hit } from './seek'
import type { Press } from './chord'

const hit = (label: string, extra: Partial<Hit> = {}): Hit => ({ id: label, label, ...extra })

const chats = [
  hit('GPU speed and memory', { at: '2026-10-19T10:00:00Z' }),
  hit('Write private investor reply', { at: '2026-10-20T09:00:00Z' }),
  hit('Pitch evaluation options', { at: '2026-10-18T09:00:00Z' }),
  hit('Kai-1 DDT', { at: '2026-10-20T08:00:00Z' }),
]

describe('which rows a query keeps, and in what order', () => {
  test('the label read whole, then its start, then a word of it, then anywhere in it, then the other words', () => {
    const rows = [hit('Overkai'), hit('Kai notes'), hit('Notes on kai'), hit('Nothing', { keywords: ['kai'] }), hit('kai')]
    expect(rank(rows, 'kai').map((r) => r.label)).toEqual(['kai', 'Kai notes', 'Notes on kai', 'Overkai', 'Nothing'])
  })

  test('every word must be found, in any order', () => {
    expect(fit(chats[0], 'memory gpu')).toBeGreaterThan(0)
    expect(fit(chats[0], 'memory cpu')).toBe(0)
  })

  test('ties keep the order they came in, and a group shows at most five', () => {
    const rows = Array.from({ length: 9 }, (_, i) => hit(`run ${i}`))
    expect(rank(rows, 'run').map((r) => r.id)).toEqual(rows.slice(0, CAP).map((r) => r.id))
  })

  test('case and the space around the query do not matter', () => {
    expect(rank(chats, '  KAI ')).toEqual([chats[3]])
  })
})

describe('what the palette lists', () => {
  test('an empty field: the newest chats under Recent chats, and nothing else', () => {
    const groups = find('', chats, [{ id: 'actions', label: 'Actions', items: [hit('New chat')] }])
    expect(groups.map((g) => g.label)).toEqual(['Recent chats'])
    expect(groups[0].items.map((r) => r.label)).toEqual(['Write private investor reply', 'Kai-1 DDT', 'GPU speed and memory', 'Pitch evaluation options'])
  })

  test('the newest eight at most', () => {
    const many = Array.from({ length: 20 }, (_, i) => hit(`chat ${i}`, { at: `2026-10-${String(i + 1).padStart(2, '0')}` }))
    expect(find('', many, [])[0].items).toHaveLength(RECENT)
    expect(find('', many, [])[0].items[0].label).toBe('chat 19')
  })

  test('no chats yet: no group at all', () => {
    expect(find('', [], [])).toEqual([])
  })

  test('a query: Chats first, then the groups in their order, an empty one left out', () => {
    const groups = find('new', chats, [
      { id: 'projects', label: 'Projects', items: [hit('hanzo.ai')] },
      { id: 'agents', label: 'Agents', items: [hit('Newton')] },
      { id: 'actions', label: 'Actions', items: [hit('Settings'), hit('New chat'), hit('New Dev task')] },
    ])
    expect(groups.map((g) => g.label)).toEqual(['Agents', 'Actions'])
    expect(groups[1].items.map((r) => r.label)).toEqual(['New chat', 'New Dev task'])
  })

  test('a chat is found by its title', () => {
    expect(find('investor', chats, [])).toEqual([{ id: 'chats', label: 'Chats', items: [chats[1]] }])
  })
})

describe('the key that opens it', () => {
  const press = (key: string, extra: Partial<Press> = {}): Press => ({
    key,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    target: null,
    ...extra,
  })

  test('⌘K and Ctrl+K, whichever case the key reads', () => {
    expect(summons(press('k', { metaKey: true }))).toBe(true)
    expect(summons(press('k', { ctrlKey: true }))).toBe(true)
    expect(summons(press('K', { ctrlKey: true }))).toBe(true)
  })

  test('from a field too: the palette is the one search', () => {
    expect(summons(press('k', { metaKey: true, target: { tagName: 'TEXTAREA' } as unknown as EventTarget }))).toBe(true)
  })

  test('not K alone, not with Shift or Alt, not a held key, not mid-composition', () => {
    expect(summons(press('k'))).toBe(false)
    expect(summons(press('k', { metaKey: true, shiftKey: true }))).toBe(false)
    expect(summons(press('k', { ctrlKey: true, altKey: true }))).toBe(false)
    expect(summons(press('k', { metaKey: true, repeat: true }))).toBe(false)
    expect(summons(press('k', { metaKey: true, isComposing: true }))).toBe(false)
    expect(summons(press('j', { metaKey: true }))).toBe(false)
  })
})
