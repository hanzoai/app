import { describe, expect, test } from 'vitest'
import {
  arrange,
  arrangePriority,
  chats,
  dayTimeline,
  defaultDensity,
  densityOf,
  designs,
  hasUnreadUpdate,
  MENUS,
  PINNED,
  PLAIN,
  PRIORITY,
  projectGroups,
  runs,
  UNTITLED,
  viewOf,
} from './recent'

const now = new Date('2026-10-08T12:00:00Z')
const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000).toISOString()

const rows = chats([
  { id: 'a', title: 'Aurora', updatedAt: at(1) },
  { id: 'b', title: 'Borealis', updatedAt: at(50), pinned: true },
  { id: 'c', title: 'Comet', updatedAt: at(2) },
  { id: 'd', title: 'Dune', updatedAt: at(3), pinned: true },
])

describe('Recents', () => {
  test('pinned conversations come first, under Pinned, in the order the view sorts them', () => {
    const groups = arrange(rows, PLAIN, now)
    expect(groups[0]).toEqual({ title: PINNED, rows: [rows[3], rows[1]] })
    expect(groups.slice(1).flatMap((g) => g.rows.map((r) => r.id))).toEqual(['a', 'c'])
    expect(groups.slice(1).some((g) => g.title === PINNED)).toBe(false)
  })

  test('a view grouped by None still lists the pinned ones first', () => {
    const groups = arrange(rows, { ...PLAIN, group: 'none' }, now)
    expect(groups.map((g) => g.title)).toEqual([PINNED, ''])
    expect(groups[1].rows.map((r) => r.id)).toEqual(['a', 'c'])
  })

  test('the plain view is Pinned, then every other row under one Recents heading, as the reference lists them', () => {
    expect(PLAIN.group).toBe('none')
    expect(arrange(rows, PLAIN, now).map((g) => g.title)).toEqual([PINNED, ''])
  })

  test('an archived conversation reads as archived, and the archived view keeps it', () => {
    const away = chats([{ id: 'e', title: 'Eclipse', updatedAt: at(5), archived: true }])
    expect(away[0].status).toBe('archived')
    expect(arrange(away, { ...PLAIN, status: 'archived' }, now).flatMap((g) => g.rows)).toEqual(away)
  })

  test("Chat's Status is whether a conversation is archived, and Chat groups by Project, Date, or None", () => {
    expect(MENUS.chat.status.map((o) => o.id)).toEqual(['all', 'archived'])
    expect(MENUS.chat.group.map((o) => o.id)).toEqual(['project', 'date', 'none'])
    // A view kept before the pin replaced the star reads as the plain one: nothing is migrated.
    expect(viewOf('chat', { group: 'starred' })).toEqual(PLAIN)
    expect(viewOf('chat', { status: 'archived' }).status).toBe('archived')
    expect(viewOf('dev', { status: 'archived' }).status).toBe('archived')
    expect(MENUS.dev.status.map((o) => o.id)).toContain('archived')
  })

  test('Design and Studio conversations are rows of their own, their state read as a run’s', () => {
    const made = designs([
      { id: 'd1', title: 'Spring poster', updated: Date.parse('2026-11-12T10:00:00Z'), state: 'making' },
      { id: 'd2', title: '', updated: Date.parse('2026-11-11T10:00:00Z'), state: 'failed' },
      { id: 'd3', title: 'Logo', updated: Number.NaN, state: 'done' },
    ])
    expect(made.map((r) => [r.kind, r.status])).toEqual([
      ['design', 'running'],
      ['design', 'error'],
      ['design', 'done'],
    ])
    expect(made[0]).toMatchObject({ title: 'Spring poster', at: '2026-11-12T10:00:00.000Z', began: '2026-11-12T10:00:00.000Z' })
    expect(made[1]!.title).toBe(UNTITLED)
    expect(made[2]!.at).toBe('')
    expect(arrange(made, PLAIN, now).flatMap((g) => g.rows.map((r) => r.id))).toEqual(['d1', 'd2', 'd3'])
    const studioRows = designs([{ id: 's1', title: 'Launch reel', updated: Date.parse('2026-11-12T10:00:00Z'), state: 'done' }], 'studio')
    expect(studioRows[0]).toMatchObject({ kind: 'studio', status: 'done', title: 'Launch reel' })
  })

  test('Design and Studio share unified organize/sort/status controls', () => {
    for (const mode of ['design', 'studio'] as const) {
      expect(MENUS[mode].status.map((o) => o.id)).toEqual(['all', 'archived'])
      expect(MENUS[mode].group.map((o) => o.id)).toEqual(['project', 'date', 'none'])
      expect(MENUS[mode].sort.map((o) => o.id)).toEqual(['activity', 'title'])
      expect(viewOf(mode, { status: 'archived', group: 'project' })).toMatchObject({ status: 'archived', group: 'project' })
    }
  })

  test('arrangePriority groups Priority rows first, then Today, Yesterday, exact weekdays (2-6d ago), and Older', () => {
    // Thursday 2026-10-08T12:00:00 local-ish reference via explicit local Date constructor so weekday names are deterministic.
    const ref = new Date(2026, 9, 8, 12, 0, 0) // Thu Oct 8, 2026
    const daysAgo = (d: number, hours = 1) => new Date(ref.getTime() - d * 86_400_000 - hours * 3_600_000).toISOString()
    const items = [
      { id: 'r1', kind: 'dev' as const, title: 'Live deploy', at: daysAgo(3), began: daysAgo(3), status: 'running' as const },
      { id: 'r2', kind: 'chat' as const, title: 'Pinned spec', at: daysAgo(5), began: daysAgo(5), status: 'done' as const, pinned: true },
      { id: 'r3', kind: 'chat' as const, title: 'Unread note', at: daysAgo(4), began: daysAgo(4), status: 'done' as const, unread: true },
      { id: 'r4', kind: 'chat' as const, title: 'Morning standup', at: daysAgo(0, 1), began: daysAgo(0, 1), status: 'done' as const },
      { id: 'r5', kind: 'chat' as const, title: 'Yesterday sync', at: daysAgo(1, 0), began: daysAgo(1, 0), status: 'done' as const },
      { id: 'r6', kind: 'chat' as const, title: 'Two days ago', at: daysAgo(2, 0), began: daysAgo(2, 0), status: 'done' as const },
      { id: 'r7', kind: 'chat' as const, title: 'Last month', at: daysAgo(20, 0), began: daysAgo(20, 0), status: 'done' as const },
    ]
    const groups = arrangePriority(items, PLAIN, ref)
    expect(groups.map((g) => g.title)).toEqual([PRIORITY, 'Today', 'Yesterday', 'Tuesday', 'Older'])
    expect(groups[0]!.rows.map((r) => r.id)).toEqual(['r1', 'r3', 'r2'])
    expect(groups[1]!.rows.map((r) => r.id)).toEqual(['r4'])
    expect(groups[2]!.rows.map((r) => r.id)).toEqual(['r5'])
    expect(groups[3]!.rows.map((r) => r.id)).toEqual(['r6'])
    expect(groups[4]!.rows.map((r) => r.id)).toEqual(['r7'])
    expect(dayTimeline(daysAgo(0, 1), ref).title).toBe('Today')
    expect(dayTimeline(daysAgo(1, 0), ref).title).toBe('Yesterday')
    expect(dayTimeline(daysAgo(2, 0), ref).title).toBe('Tuesday')
    expect(dayTimeline(daysAgo(10, 0), ref).title).toBe('Older')
  })

  test('density defaults and validation: Dev defaults to 2-line, others to 1-line, priority defaults to 3-line', () => {
    expect(defaultDensity('dev', false)).toBe(2)
    expect(defaultDensity('chat', false)).toBe(1)
    expect(defaultDensity('design', false)).toBe(1)
    expect(defaultDensity('studio', false)).toBe(1)
    expect(defaultDensity('chat', true)).toBe(3)
    expect(defaultDensity('dev', true)).toBe(3)
    expect(densityOf('chat', { ...PLAIN, density: 3 }, false)).toBe(3)
    expect(densityOf('dev', { ...PLAIN, density: 1 }, false)).toBe(1)
    expect(densityOf('dev', viewOf('dev', { density: 'bad' }), false)).toBe(2)
    expect(densityOf('chat', PLAIN, true)).toBe(3)
    expect(densityOf('chat', PLAIN, true, 2)).toBe(2)
  })

  test('chats extract [Project] tags and runs preserve repo, branch, pr, and preview for multi-line cards and Projects section', () => {
    const tagged = chats([
      { id: 'c1', title: '[Billing] Usage alert fix', updatedAt: at(1), lastMessage: 'Fixed unbounded class detection.' },
      { id: 'c2', title: '[Billing] Invoice PDF', updatedAt: at(2) },
      { id: 'c3', title: 'Quick question', updatedAt: at(3) },
    ])
    expect(tagged[0]).toMatchObject({ project: 'Billing', preview: 'Fixed unbounded class detection.' })
    const projects = projectGroups(tagged)
    expect(projects.map((p) => [p.name, p.rows.length])).toEqual([['Billing', 2]])

    const devRuns = runs([
      {
        id: 's1',
        title: 'Fix sidebar alignment',
        status: 'running',
        repo: 'hanzoai/app',
        branch: 'fix/unified-ux',
        base: 'main',
        pr: 'https://github.com/hanzoai/app/pull/143',
        lastEvent: { preview: 'Running vitest suite' },
        createdAt: at(2),
        updatedAt: at(1),
      },
    ])
    expect(devRuns[0]).toMatchObject({
      project: 'app',
      repo: 'hanzoai/app',
      branch: 'fix/unified-ux',
      base: 'main',
      pr: 'https://github.com/hanzoai/app/pull/143',
      preview: 'Running vitest suite',
    })
  })

  test('a conversation updated since it was seen is unread, unless the pane holds it', () => {
    const seen = { c1: Date.parse('2026-11-12T10:00:00Z'), c2: Date.parse('2026-11-12T10:00:00Z') }
    expect(hasUnreadUpdate('c1', '2026-11-12T10:05:00Z', null, seen)).toBe(true)
    expect(hasUnreadUpdate('c1', '2026-11-12T10:05:00Z', 'c1', seen)).toBe(false)
    expect(hasUnreadUpdate('c2', '2026-11-12T09:59:00Z', null, seen)).toBe(false)
    expect(hasUnreadUpdate('c3', '2026-11-12T10:05:00Z', null, seen)).toBe(false)
  })
})
