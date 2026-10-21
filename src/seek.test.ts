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
  const actions = { id: 'actions', label: 'Actions', items: [hit('New chat'), hit('New Dev task'), hit('Toggle theme')] }
  const go = {
    id: 'go',
    label: 'Go to',
    items: [hit('Chat'), hit('Studio'), hit('Settings'), hit('Account', { keywords: ['Settings', 'profile'] }), hit('Explore', { keywords: ['Studio'] })],
  }

  test('an empty field: Recent, newest first, then the idle groups as they are', () => {
    const groups = find('', chats, [actions, go], [])
    expect(groups.map((g) => g.label)).toEqual(['Recent', 'Actions', 'Go to'])
    expect(groups[0].items.map((r) => r.label)).toEqual(['Write private investor reply', 'Kai-1 DDT', 'GPU speed and memory', 'Pitch evaluation options'])
  })

  test(`Recent lists the newest ${RECENT} at most, and none at all is no group`, () => {
    const many = Array.from({ length: 20 }, (_, i) => hit(`chat ${i}`, { at: `2026-10-${String(i + 1).padStart(2, '0')}` }))
    expect(find('', many, [], [])[0].items).toHaveLength(RECENT)
    expect(find('', many, [], [])[0].items[0].label).toBe('chat 19')
    expect(find('', [], [actions], []).map((g) => g.label)).toEqual(['Actions'])
  })

  test('"set" finds Settings, then its sections', () => {
    const groups = find('set', chats, [], [actions, go])
    expect(groups[0].label).toBe('Go to')
    expect(groups[0].items.map((r) => r.label)).toEqual(['Settings', 'Account'])
  })

  test('"studio" finds Studio first, then its places, and New Studio creation under Actions', () => {
    const groups = find('studio', chats, [], [{ ...actions, items: [...actions.items, hit('New Studio creation')] }, go])
    expect(groups.map((g) => g.label)).toEqual(['Go to', 'Actions'])
    expect(groups[0].items.map((r) => r.label)).toEqual(['Studio', 'Explore'])
    expect(groups[1].items.map((r) => r.label)).toEqual(['New Studio creation'])
  })

  test('a chat is found by its title, and its group leads when it is the best answer', () => {
    const groups = find('investor', chats, [], [actions, go, { id: 'chats', label: 'Chats', items: chats }])
    expect(groups).toEqual([{ id: 'chats', label: 'Chats', items: [chats[1]] }])
  })

  test('a typo still finds its row, below an exact one', () => {
    expect(rank([hit('Settings'), hit('Usage')], 'sttngs').map((r) => r.label)).toEqual(['Settings'])
    expect(fit(hit('Settings'), 'sttngs')).toBeLessThan(fit(hit('Nothing', { keywords: ['sttngs'] }), 'sttngs'))
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
