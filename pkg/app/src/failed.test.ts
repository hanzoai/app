import type { Session } from '@hanzo/ai'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { failed, FRESH } from './failed'

const now = Date.parse('2026-11-08T12:00:00Z')
const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString()
const run = (id: string, over: Partial<Session> = {}): Session => ({ id, status: 'error', endedAt: ago(1), ...over })

describe("Home's failed count", () => {
  test('counts a run that failed in the past 7 days, the window Recents calls "Past 7 days"', () => {
    expect(FRESH).toBe(7 * 86_400_000)
    expect(failed([run('a', { endedAt: ago(2) }), run('b', { endedAt: ago(7 * 24 - 1) })], now).map((s) => s.id)).toEqual(['a', 'b'])
  })

  // hanzo-inc/app issue 202: the tile read "14 failed" because every errored run in
  // the last 100 counted, however long ago it ended.
  test('leaves out a failure older than 7 days, however few runs came after it', () => {
    const old = Array.from({ length: 14 }, (_, i) => run(`old${i}`, { endedAt: ago(8 * 24 + i) }))
    expect(failed([...old, run('fresh', { status: 'done' })], now)).toEqual([])
  })

  test('counts only runs whose status is error', () => {
    const rows = (['running', 'paused', 'done', undefined] as const).map((status, i) => run(`s${i}`, { status }))
    expect(failed(rows, now)).toEqual([])
  })

  test('counts a tree once: a sub-run failing under its root is not a second failure', () => {
    const rows = [
      run('root', { rootSessionId: 'root' }),
      run('kid1', { rootSessionId: 'root', parentSessionId: 'root' }),
      run('kid2', { rootSessionId: 'root', parentSessionId: 'kid1' }),
      run('kid3', { rootSessionId: 'other', parentSessionId: 'other' }),
      run('other', { status: 'done', rootSessionId: 'other' }),
    ]
    expect(failed(rows, now).map((s) => s.id)).toEqual(['root'])
  })

  test('reads when a run stopped from its end, then its last activity, then its start', () => {
    const rows = [
      run('ended-old', { endedAt: ago(10 * 24), updatedAt: ago(1) }),
      run('updated', { endedAt: undefined, updatedAt: ago(3), createdAt: ago(30 * 24) }),
      run('created', { endedAt: undefined, createdAt: ago(5) }),
      run('timeless', { endedAt: undefined }),
    ]
    expect(failed(rows, now).map((s) => s.id)).toEqual(['updated', 'created'])
  })

  test('lists the newest failure first and skips empty rows', () => {
    const rows = [run('older', { endedAt: ago(30) }), null, run('newest', { endedAt: ago(1) }), undefined]
    expect(failed(rows, now).map((s) => s.id)).toEqual(['newest', 'older'])
  })

  test('the Next card counts with it and says the window it counted', () => {
    const home = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Home.tsx'), 'utf8')
    expect(home).toContain('failed(safeSessions)')
    expect(home).toContain("t('{n} failed in the past 7 days'")
    expect(home).not.toMatch(/safeSessions\.filter\(\(s\) => s && s\.status === 'error'\)/)
  })

  // A read that failed handed the card an empty list, which counted as nothing
  // failed and could leave the card saying "Nothing needs you."
  test('the Next card says a failed read of the runs, and pressing the row reads them again', () => {
    const home = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Home.tsx'), 'utf8')
    expect(home).toContain('const { sessions, error: unread, reload } = useSessions({ limit: 100 })')
    expect(home).toContain("say: say(unread, t('your runs'), 'read', t), press: reload")
  })
})
