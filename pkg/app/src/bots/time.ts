// When things happened, in the words the thread and the panel have room for.

import { english, type Say } from '@hanzo/i18n'

const DAY = 86_400_000

/** Midnight of the day `at` falls on, in the reader's zone. */
const midnight = (at: number): number => {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * The stamp a thread centres above a message: "Today 11:23 AM", "Yesterday
 * 12:11 AM", "Mon, Nov 9 4:47 PM", and the year once it is not this one.
 */
export function stamp(at: number, now: number, locale: string, t: Say = english): string {
  const time = new Date(at).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
  const days = Math.round((midnight(now) - midnight(at)) / DAY)
  if (days === 0) return t('Today {time}', { time })
  if (days === 1) return t('Yesterday {time}', { time })
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear()
  const date = new Date(at).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  return `${date} ${time}`
}

/** A message more than this long after the one before it gets its own stamp. */
export const BREAK = 30 * 60_000

/** An instant from the platform's RFC 3339 string, or null. */
export const instant = (iso: string | undefined): number | null => {
  if (!iso) return null
  const n = Date.parse(iso)
  return Number.isNaN(n) ? null : n
}

const WEEKDAYS = '1-5'

/** "9:00 AM" for an hour and minute, in the reader's locale. */
const clock = (hour: number, minute: number, locale: string): string =>
  new Date(2000, 0, 1, hour, minute).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })

/** A whole number from a cron field, or null where the field is anything else. */
const whole = (field: string): number | null => (/^\d+$/.test(field) ? Number(field) : null)

/** The step of a `*\/n` field, or null. */
const step = (field: string): number | null => {
  const m = /^\*\/(\d+)$/.exec(field)
  return m ? Number(m[1]) : null
}

/**
 * A 5-field cron as a person reads it. The common shapes are said in words —
 * every n minutes, every n hours, daily or on weekdays at a time — and any other
 * shape is shown as the expression itself rather than guessed at.
 */
export function cron(expr: string, locale: string, t: Say = english): string {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return expr
  const [minute, hour, dom, month, dow] = parts
  if (dom !== '*' || month !== '*') return expr
  const weekdays = dow === WEEKDAYS
  if (dow !== '*' && !weekdays) return expr

  const everyMinutes = step(minute)
  if (everyMinutes !== null && hour === '*') {
    return weekdays
      ? t('Every {n} minutes on weekdays', { n: everyMinutes })
      : t('Every {n} minutes', { n: everyMinutes })
  }

  const m = whole(minute)
  if (m === null) return expr
  if (hour === '*') return weekdays ? t('Every hour on weekdays') : t('Every hour')
  const everyHours = step(hour)
  if (everyHours !== null) {
    return weekdays
      ? t('Every {n} hours on weekdays', { n: everyHours })
      : t('Every {n} hours', { n: everyHours })
  }
  const h = whole(hour)
  if (h === null || h > 23 || m > 59) return expr
  const at = clock(h, m, locale)
  return weekdays ? t('Weekdays at {time}', { time: at }) : t('Every day at {time}', { time: at })
}
