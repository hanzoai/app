import { describe, expect, it } from 'vitest'
import { cron, instant, stamp } from './time'

const at = (s: string) => new Date(s).getTime()
const NOW = at('2026-11-12T11:30:00')

describe('stamp', () => {
  it('says today and yesterday by the reader’s calendar, not by 24 hours', () => {
    expect(stamp(at('2026-11-12T11:23:00'), NOW, 'en-US')).toBe('Today 11:23 AM')
    expect(stamp(at('2026-11-11T00:11:00'), NOW, 'en-US')).toBe('Yesterday 12:11 AM')
    expect(stamp(at('2026-11-11T23:59:00'), at('2026-11-12T00:01:00'), 'en-US')).toBe('Yesterday 11:59 PM')
  })

  it('names the day and date further back, and the year only once it changes', () => {
    expect(stamp(at('2026-11-09T16:47:00'), NOW, 'en-US')).toBe('Mon, Nov 9 4:47 PM')
    expect(stamp(at('2025-11-09T16:47:00'), NOW, 'en-US')).toBe('Sun, Nov 9, 2025 4:47 PM')
  })
})

describe('cron', () => {
  it('says the common shapes in words', () => {
    expect(cron('0 8 * * *', 'en-US')).toBe('Every day at 8:00 AM')
    expect(cron('0 9 * * 1-5', 'en-US')).toBe('Weekdays at 9:00 AM')
    expect(cron('0 */2 * * 1-5', 'en-US')).toBe('Every 2 hours on weekdays')
    expect(cron('*/15 * * * *', 'en-US')).toBe('Every 15 minutes')
    expect(cron('5 * * * *', 'en-US')).toBe('Every hour')
  })

  it('shows any other shape as written rather than guessing', () => {
    expect(cron('0 9 1 * *', 'en-US')).toBe('0 9 1 * *')
    expect(cron('0 9 * * 0,6', 'en-US')).toBe('0 9 * * 0,6')
    expect(cron('0 25 * * *', 'en-US')).toBe('0 25 * * *')
    expect(cron('@daily', 'en-US')).toBe('@daily')
  })
})

describe('instant', () => {
  it('reads an RFC 3339 string and refuses anything else', () => {
    expect(instant('2026-11-12T19:30:00Z')).toBe(Date.UTC(2026, 10, 12, 19, 30))
    expect(instant('not a date')).toBeNull()
    expect(instant(undefined)).toBeNull()
  })
})
