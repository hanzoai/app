import { describe, expect, test } from 'vitest'
import { AGENTS, DAY, HOME, LENGTH, ORGS, PEOPLE, SCENE, STILL, channelOf, frame, orgOf, type Event } from './workday'

const rooms = new Set(ORGS.flatMap((o) => o.channels.map((c) => `${o.id}/${c.id}`)))
const roomOf = (e: Event) => ('room' in e ? e.room : undefined)

describe('the working day TeamPreview plays', () => {
  test('plays more than five minutes before it starts again', () => {
    expect(LENGTH).toBeGreaterThanOrEqual(5 * 60 * 1000)
  })

  test('every event names a room, a person or agent, and a message that exist', () => {
    const ids = new Set<string>()
    for (const e of DAY) {
      const room = roomOf(e)
      if (room) expect(rooms.has(room), room).toBe(true)
      if ('who' in e && typeof e.who === 'string') expect(e.who in PEOPLE || e.who in AGENTS, e.who).toBe(true)
      if (e.kind === 'huddle') for (const w of e.who) expect(w in PEOPLE, w).toBe(true)
      if (e.kind === 'say' && e.id) {
        expect(ids.has(e.id), `${e.id} is said once`).toBe(false)
        ids.add(e.id)
      }
      if ((e.kind === 'react' || e.kind === 'reply' || e.kind === 'card') && e.to) expect(ids.has(e.to), `${e.kind} → ${e.to}`).toBe(true)
      if (e.kind === 'thread' && e.to) expect(ids.has(e.to)).toBe(true)
      expect(e.wait).toBeGreaterThan(0)
    }
  })

  test('every channel plays a scene of its own when a reader opens it', () => {
    for (const room of rooms) {
      expect(SCENE[room]?.[0], room).toMatchObject({ kind: 'open', room })
    }
    for (const org of ORGS) expect(orgOf(HOME[org.id]).id).toBe(org.id)
  })

  test('every mention names someone the org has', () => {
    for (const e of DAY) {
      if (e.kind !== 'say') continue
      const org = orgOf(e.room)
      for (const [, id] of e.text.matchAll(/@([a-z]+)/g)) expect([...org.people, ...org.agents], `${e.room}: @${id}`).toContain(id)
    }
  })

  test('the still frame is #eng with the pull request merged and the next ticket waiting', () => {
    const f = frame(DAY, STILL)
    expect(f.room).toBe('acme/eng')
    const pr = f.rooms['acme/eng'].find((m) => m.id === 'pr')
    expect(pr?.card).toMatchObject({ kind: 'pr', state: 'merged' })
    expect(pr?.replies.length).toBeGreaterThan(0)
    expect(pr?.reactions).toEqual([{ mark: 'rocket', n: 3 }])
    expect(f.unread['acme/support']).toBe(1)
    expect(f.thread).toBe(null)
  })

  test('the first thirty seconds switch organizations at least twice', () => {
    let at = 0
    const orgs: string[] = []
    for (const e of DAY) {
      at += e.wait
      if (at > 30_000) break
      if (e.kind === 'open' && orgOf(e.room).id !== orgs[orgs.length - 1]) orgs.push(orgOf(e.room).id)
    }
    expect(orgs.length, orgs.join(' → ')).toBeGreaterThanOrEqual(3)
    expect(new Set(orgs).size).toBeGreaterThanOrEqual(3)
  })

  test('the first frame and the still one hold several organizations and many channels', () => {
    expect(ORGS.length).toBeGreaterThanOrEqual(3)
    for (const at of [0, STILL]) {
      const f = frame(DAY, at)
      expect(orgOf(f.room).channels.length).toBeGreaterThanOrEqual(6)
      const waiting = ORGS.filter((o) => o.id !== orgOf(f.room).id && o.channels.some((c) => (f.unread[`${o.id}/${c.id}`] ?? 0) > 0))
      expect(waiting.length).toBeGreaterThanOrEqual(2)
    }
  })

  test('a room opened is read; a message to another room leaves it unread', () => {
    const start = frame(DAY, 1)
    expect(start.room).toBe('acme/general')
    expect(start.unread['acme/general']).toBe(0)
    const supportOpens = DAY.findIndex((e) => e.kind === 'open' && e.room === 'acme/support')
    expect(frame(DAY, supportOpens).unread['acme/support']).toBe(1)
    expect(frame(DAY, supportOpens + 1).unread['acme/support']).toBe(0)
  })

  test('the switcher flips to Friday Club in the evening', () => {
    const rooms = DAY.filter((e) => e.kind === 'open').map((e) => roomOf(e) as string)
    expect(rooms.map((r) => orgOf(r).id)).toContain('friday')
    expect(rooms[0]).toBe('acme/general')
    expect(channelOf(rooms[rooms.length - 1])).toBe('game-night')
  })

  test('a room keeps a bounded tail of messages however long the day runs', () => {
    const f = frame(DAY, DAY.length)
    for (const list of Object.values(f.rooms)) expect(list.length).toBeLessThanOrEqual(14)
  })
})
