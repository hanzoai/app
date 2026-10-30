// The Recents list as data: each mode's rows, the views a menu offers, and the
// list a view makes of them. No React, so a spec reads it as it is. Every label
// and heading is authored English written through `phrase`, so Recents.tsx draws
// it through `t`; a heading that is a project's name is data and drawn as is.

import { phrase, english, type Say } from '@hanzo/i18n'

export type Mode = 'chat' | 'dev'

export interface Recent {
  kind: Mode
  id: string
  title: string
  /** When it was last spoken in, as an ISO time. */
  at: string
  /** When it began, as an ISO time. */
  began: string
  status?: string
  project?: string
  /** A conversation its person pinned: listed first, under Pinned. */
  pinned?: boolean
}

export type Status = 'all' | 'running' | 'paused' | 'done' | 'error' | 'stopped' | 'archived'
export type Since = 'any' | 'day' | 'week' | 'month'
export type Group = 'date' | 'state' | 'project' | 'none'
export type Sort = 'activity' | 'created' | 'title'

/** How the list is narrowed, grouped and sorted. */
export interface View {
  status: Status
  since: Since
  group: Group
  sort: Sort
}

export const PLAIN: View = { status: 'all', since: 'any', group: 'none', sort: 'activity' }

export type Option<T> = { id: T; label: string }

const STATUSES: Option<Status>[] = [
  { id: 'all', label: phrase('All') },
  { id: 'running', label: phrase('Running') },
  { id: 'paused', label: phrase('Paused') },
  { id: 'done', label: phrase('Done') },
  { id: 'error', label: phrase('Failed') },
  { id: 'stopped', label: phrase('Stopped') },
]
export const SINCE: Option<Since>[] = [
  { id: 'any', label: phrase('Any time') },
  { id: 'day', label: phrase('Today') },
  { id: 'week', label: phrase('Past 7 days') },
  { id: 'month', label: phrase('Past 30 days') },
]

/** What each mode's menu offers, section by section, as Claude's Recents menu does. */
export const MENUS: Record<Mode, { status: Option<Status>[]; group: Option<Group>[]; sort: Option<Sort>[] }> = {
  // A chat's status is whether it is archived: the store lists the two apart.
  chat: {
    status: [
      { id: 'all', label: phrase('Active') },
      { id: 'archived', label: phrase('Archived') },
    ],
    group: [
      { id: 'date', label: phrase('Date') },
      { id: 'none', label: phrase('None') },
    ],
    sort: [
      { id: 'activity', label: phrase('Activity') },
      { id: 'title', label: phrase('Title') },
    ],
  },
  dev: {
    status: STATUSES,
    group: [
      { id: 'date', label: phrase('Date') },
      { id: 'state', label: phrase('State') },
      { id: 'project', label: phrase('Project') },
      { id: 'none', label: phrase('None') },
    ],
    sort: [
      { id: 'activity', label: phrase('Activity') },
      { id: 'created', label: phrase('Created') },
      { id: 'title', label: phrase('Title') },
    ],
  },
}

/** A kept view as this mode may hold it: anything a menu does not offer reads as the plain view's. */
export function viewOf(mode: Mode, kept: unknown): View {
  const k = (kept && typeof kept === 'object' ? kept : {}) as Partial<Record<keyof View, unknown>>
  const m = MENUS[mode]
  const pick = <T,>(v: unknown, from: Option<T>[], fallback: T): T => from.find((o) => o.id === v)?.id ?? fallback
  return {
    status: pick(k.status, m.status, PLAIN.status),
    since: pick(k.since, SINCE, PLAIN.since),
    group: pick(k.group, m.group, PLAIN.group),
    sort: pick(k.sort, m.sort, PLAIN.sort),
  }
}

/** Chat's conversations as rows: an archived one's status says so. */
export function chats(threads: { id: string; title?: string; updatedAt?: string; pinned?: boolean; archived?: boolean }[]): Recent[] {
  return threads.map((t) => ({
    kind: 'chat',
    id: t.id,
    title: t.title || UNTITLED,
    at: t.updatedAt ?? '',
    began: t.updatedAt ?? '',
    ...(t.archived ? { status: 'archived' } : {}),
    ...(t.pinned ? { pinned: true } : {}),
  }))
}

/** Dev's runs as rows. */
export function runs(sessions: { id: string; title: string; status: string; project?: string; repo?: string; createdAt: string; updatedAt: string }[]): Recent[] {
  return sessions.map((r) => ({
    kind: 'dev',
    id: r.id,
    title: r.title || UNTITLED_RUN,
    at: r.updatedAt || r.createdAt,
    began: r.createdAt,
    status: r.status,
    project: r.project || r.repo?.split('/').pop() || '',
  }))
}

const DAY = 86_400_000
const SPAN: Record<Since, number> = { any: Infinity, day: DAY, week: 7 * DAY, month: 30 * DAY }
const STATE: Record<string, string> = { running: phrase('Running'), paused: phrase('Paused'), done: phrase('Done'), error: phrase('Failed'), stopped: phrase('Stopped') }

/** The date headings, in the order they read. */
const DAYS = [phrase('Today'), phrase('Yesterday'), phrase('Past 7 days'), phrase('Past 30 days'), phrase('Older')]

/** Which date heading an instant falls under, counted in the reader's own days. */
function day(at: string, now: Date): string {
  const t = new Date(at)
  if (Number.isNaN(t.getTime())) return 'Older'
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (t.getTime() >= midnight) return 'Today'
  if (t.getTime() >= midnight - DAY) return 'Yesterday'
  if (t.getTime() >= midnight - 7 * DAY) return 'Past 7 days'
  if (t.getTime() >= midnight - 30 * DAY) return 'Past 30 days'
  return 'Older'
}

const newest = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0)

/**
 * The list as drawn: the rows the view admits, sorted, and cut into
 * headed groups in the order they read. Pinned rows come first, under Pinned,
 * whatever the grouping; a view grouped by None holds the rest in one group with
 * no heading.
 */
export function arrange(rows: Recent[], view: View, now = new Date()): { title: string; rows: Recent[] }[] {
  const kept = rows.filter(
    (r) =>
      (view.status === 'all' || r.status === view.status) &&
      (view.since === 'any' || now.getTime() - new Date(r.at).getTime() <= SPAN[view.since]),
  )
  kept.sort((a, b) =>
    view.sort === 'title' ? a.title.localeCompare(b.title) : view.sort === 'created' ? newest(a.began, b.began) : newest(a.at, b.at),
  )
  const headOf = (r: Recent): string => {
    switch (view.group) {
      case 'date':
        return day(view.sort === 'created' ? r.began : r.at, now)
      case 'state':
        return STATE[r.status ?? ''] ?? phrase('Other')
      case 'project':
        return r.project || UNFILED
      default:
        return ''
    }
  }
  const groups: { title: string; rows: Recent[] }[] = []
  for (const r of kept) {
    if (r.pinned) continue
    const title = headOf(r)
    const g = groups.find((one) => one.title === title)
    if (g) g.rows.push(r)
    else groups.push({ title, rows: [r] })
  }
  if (view.group === 'date') groups.sort((a, b) => DAYS.indexOf(a.title) - DAYS.indexOf(b.title))
  const pinned = kept.filter((r) => r.pinned)
  return pinned.length ? [{ title: PINNED, rows: pinned }, ...groups] : groups
}

/** The heading pinned rows read under, first in every view. */
export const PINNED = phrase('Pinned')

/** The heading of runs with no project, in a list grouped by project, where every other heading is a project's name. */
export const UNFILED = phrase('No project')

/** What a conversation and a run with no title are called. */
export const UNTITLED = phrase('Untitled')
export const UNTITLED_RUN = phrase('Untitled run')


/**
 * How long ago a row was last active, as a list reads it at a glance: `now`,
 * `12m`, `3h`, `2d`, `5w`, `4mo`, `2y`, in the reader's language through `t`.
 * '' for an instant that is not one.
 */
export function ago(at: string, now = new Date(), t: Say = english): string {
  const then = new Date(at).getTime()
  if (Number.isNaN(then)) return ''
  const m = Math.max(0, Math.floor((now.getTime() - then) / 60_000))
  if (m < 1) return t('now')
  if (m < 60) return t('{n}m', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('{n}h', { n: h })
  const d = Math.floor(h / 24)
  if (d < 7) return t('{n}d', { n: d })
  if (d < 30) return t('{n}w', { n: Math.floor(d / 7) })
  if (d < 365) return t('{n}mo', { n: Math.floor(d / 30) })
  return t('{n}y', { n: Math.floor(d / 365) })
}
