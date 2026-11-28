// The Recents list as data: each mode's rows, the views a menu offers, and the
// list a view makes of them (both Standard mode and `≡` Priority / Day-by-Day mode).
// No React, so a spec reads it as it is. Every label and heading is authored English
// written through `phrase`, so Recents.tsx draws it through `t`; a heading that is a
// project's name is data and drawn as is.

import { phrase, english, type Say } from '@hanzo/i18n'

export type Mode = 'chat' | 'dev' | 'design' | 'studio'

/** Row density: 1 = compact single-line, 2 = title + 1 context line, 3 = title + 2 context lines. */
export type Density = 1 | 2 | 3

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
  /** Repository slug (e.g. `hanzoai/app`), for Dev runs. */
  repo?: string
  /** Working git branch, for Dev runs. */
  branch?: string
  /** Base git branch, for Dev runs. */
  base?: string
  /** Run mode (`build` | `plan`) or media kind for Design/Studio. */
  mode?: string
  /** Pull request URL opened by a Dev run, when present. */
  pr?: string
  /** Context snippet (last message / latest step / prompt) for 2-line and 3-line modes. */
  preview?: string
  /** Secondary compact metadata line (e.g. git/work status or asset count). */
  meta?: string
  /** Whether this row has unread activity needing attention. */
  unread?: boolean
  /** A conversation its person pinned: listed first, under Pinned. */
  pinned?: boolean
}

export type Status = 'all' | 'running' | 'paused' | 'done' | 'error' | 'stopped' | 'archived'
export type Since = 'any' | 'day' | 'week' | 'month'
export type Group = 'date' | 'state' | 'project' | 'none'
export type Sort = 'activity' | 'created' | 'title'

/** How the list is narrowed, grouped, sorted, and sized. */
export interface View {
  status: Status
  since: Since
  group: Group
  sort: Sort
  density?: Density
}

export const PLAIN: View = { status: 'all', since: 'any', group: 'none', sort: 'activity' }

export type Option<T> = { id: T; label: string }

export const DENSITIES: Option<Density>[] = [
  { id: 1, label: phrase('1 line') },
  { id: 2, label: phrase('2 lines') },
  { id: 3, label: phrase('3 lines') },
]

/** Default row density for a mode when the reader has not explicitly chosen one. */
export function defaultDensity(mode: Mode, priorityMode = false): Density {
  if (priorityMode) return 3
  return mode === 'dev' ? 2 : 1
}

/** Resolved row density in force for the current view and priority mode. */
export function densityOf(mode: Mode, view: View, priorityMode = false, priorityDensity?: Density): Density {
  if (priorityMode) return priorityDensity ?? defaultDensity(mode, true)
  return view.density ?? defaultDensity(mode, false)
}

const DEV_STATUSES: Option<Status>[] = [
  { id: 'all', label: phrase('Active') },
  { id: 'running', label: phrase('Running') },
  { id: 'paused', label: phrase('Paused') },
  { id: 'done', label: phrase('Done') },
  { id: 'error', label: phrase('Failed') },
  { id: 'stopped', label: phrase('Stopped') },
  { id: 'archived', label: phrase('Archived') },
]

const ACTIVE_ARCHIVED: Option<Status>[] = [
  { id: 'all', label: phrase('Active') },
  { id: 'archived', label: phrase('Archived') },
]

export const SINCE: Option<Since>[] = [
  { id: 'any', label: phrase('Any time') },
  { id: 'day', label: phrase('Today') },
  { id: 'week', label: phrase('Past 7 days') },
  { id: 'month', label: phrase('Past 30 days') },
]

/** What each mode's menu offers, section by section. */
export const MENUS: Record<Mode, { status: Option<Status>[]; group: Option<Group>[]; sort: Option<Sort>[] }> = {
  chat: {
    status: ACTIVE_ARCHIVED,
    group: [
      { id: 'project', label: phrase('Project') },
      { id: 'date', label: phrase('Date') },
      { id: 'none', label: phrase('In one list') },
    ],
    sort: [
      { id: 'activity', label: phrase('Activity') },
      { id: 'title', label: phrase('Title') },
    ],
  },
  dev: {
    status: DEV_STATUSES,
    group: [
      { id: 'project', label: phrase('Project') },
      { id: 'date', label: phrase('Date') },
      { id: 'state', label: phrase('State') },
      { id: 'none', label: phrase('In one list') },
    ],
    sort: [
      { id: 'activity', label: phrase('Activity') },
      { id: 'created', label: phrase('Created') },
      { id: 'title', label: phrase('Title') },
    ],
  },
  design: {
    status: ACTIVE_ARCHIVED,
    group: [
      { id: 'project', label: phrase('Project') },
      { id: 'date', label: phrase('Date') },
      { id: 'none', label: phrase('In one list') },
    ],
    sort: [
      { id: 'activity', label: phrase('Activity') },
      { id: 'title', label: phrase('Title') },
    ],
  },
  studio: {
    status: ACTIVE_ARCHIVED,
    group: [
      { id: 'project', label: phrase('Project') },
      { id: 'date', label: phrase('Date') },
      { id: 'none', label: phrase('In one list') },
    ],
    sort: [
      { id: 'activity', label: phrase('Activity') },
      { id: 'title', label: phrase('Title') },
    ],
  },
}

/** A kept view as this mode may hold it: anything a menu does not offer reads as the plain view's. */
export function viewOf(mode: Mode, kept: unknown): View {
  const k = (kept && typeof kept === 'object' ? kept : {}) as Partial<Record<keyof View, unknown>>
  const m = MENUS[mode]
  const pick = <T,>(v: unknown, from: Option<T>[], fallback: T): T => from.find((o) => o.id === v)?.id ?? fallback
  const density = k.density === 1 || k.density === 2 || k.density === 3 ? k.density : undefined
  return {
    status: pick(k.status, m.status, PLAIN.status),
    since: pick(k.since, SINCE, PLAIN.since),
    group: pick(k.group, m.group, PLAIN.group),
    sort: pick(k.sort, m.sort, PLAIN.sort),
    ...(density !== undefined ? { density } : {}),
  }
}

const PROJECT_TAG = /^\[([^\]]{1,40})\]\s*/

/** Extract a `[Project]` prefix tag written by Organize, if any. */
export function projectTagOf(title: string | undefined): { project: string; title: string } {
  if (!title) return { project: '', title: '' }
  const m = PROJECT_TAG.exec(title)
  if (!m) return { project: '', title }
  return { project: m[1]!.trim(), title: title.slice(m[0].length).trim() || title }
}

function cleanSnippet(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

/** Chat's conversations as rows: extracts `[Project]` tags and optional previews. */
export function chats(
  threads: {
    id: string
    title?: string
    updatedAt?: string
    pinned?: boolean
    archived?: boolean
    project?: string
    preview?: string
    snippet?: string
    summary?: string
    lastMessage?: string
  }[],
): Recent[] {
  return threads.map((t) => {
    const rawTitle = t.title || ''
    const tagged = projectTagOf(rawTitle)
    const project = t.project || tagged.project || ''
    const preview = cleanSnippet(t.preview ?? t.summary ?? t.snippet ?? t.lastMessage)
    return {
      kind: 'chat',
      id: t.id,
      title: rawTitle || UNTITLED,
      at: t.updatedAt ?? '',
      began: t.updatedAt ?? '',
      ...(project ? { project } : {}),
      ...(preview ? { preview } : {}),
      ...(t.archived ? { status: 'archived' } : {}),
      ...(t.pinned ? { pinned: true } : {}),
    }
  })
}

/**
 * Whether a conversation moved on since its reader last saw it (`seenAt`, its
 * time per id): never the one the pane holds, nor one this browser has not
 * seen yet.
 */
export function hasUnreadUpdate(
  rowId: string,
  updatedAt: string | number | undefined,
  activeId: string | null,
  seenAt: Record<string, number>,
): boolean {
  if (!updatedAt || rowId === activeId) return false
  const stamp = typeof updatedAt === 'number' ? updatedAt : Date.parse(updatedAt)
  if (!Number.isFinite(stamp) || stamp <= 0) return false
  const seen = seenAt[rowId]
  return typeof seen === 'number' && stamp > seen
}

/**
 * Design & Studio conversations as rows, as @hanzo/studio's `useRecent` lists them:
 * one at work reads Running and one whose last turn failed Failed, as a run's
 * would; `updated` is Unix milliseconds.
 */
export function designs(
  rows: { id: string; title?: string; updated?: number; state?: string; count?: number; preview?: string; prompt?: string }[],
  kind: 'design' | 'studio' = 'design',
): Recent[] {
  return rows.map((r) => {
    const when = new Date(typeof r.updated === 'number' ? r.updated : Number.NaN)
    const at = Number.isNaN(when.getTime()) ? '' : when.toISOString()
    const rawTitle = r.title || ''
    const tagged = projectTagOf(rawTitle)
    const status = r.state === 'making' ? 'running' : r.state === 'failed' ? 'error' : 'done'
    const countLabel = typeof r.count === 'number' && r.count > 0 ? `${r.count} ${r.count === 1 ? 'asset' : 'assets'}` : ''
    const stateLabel = status === 'running' ? 'Rendering' : status === 'error' ? 'Failed' : 'Ready'
    const meta = [countLabel, stateLabel].filter(Boolean).join(' · ')
    const preview = cleanSnippet(r.preview ?? r.prompt)
    return {
      kind,
      id: r.id,
      title: rawTitle || UNTITLED,
      at,
      began: at,
      status,
      ...(tagged.project ? { project: tagged.project } : {}),
      ...(meta ? { meta } : {}),
      ...(preview ? { preview } : {}),
    }
  })
}

/** Dev's runs as rows, preserving repo, branch, git work status, PR, and latest event preview. */
export function runs(
  sessions: {
    id: string
    title: string
    status: string
    project?: string
    repo?: string
    branch?: string
    base?: string
    mode?: string
    host?: string
    cwd?: string
    pr?: string
    events?: number
    lastEvent?: { preview?: string; kind?: string }
    createdAt: string
    updatedAt?: string
    pinned?: boolean
  }[],
): Recent[] {
  return sessions.map((r) => {
    const rawTitle = r.title || ''
    const tagged = projectTagOf(rawTitle)
    const project = r.project || r.repo?.split('/').pop() || tagged.project || ''
    const repoShort = r.repo ? r.repo.replace(/^https?:\/\/[^/]+\//, '').replace(/\.git$/, '') : project
    const branchInfo = r.branch && r.base && r.branch !== r.base ? `${r.branch} → ${r.base}` : r.branch || ''
    const metaParts = [repoShort, branchInfo, r.pr ? 'PR open' : r.mode || ''].filter(Boolean)
    const meta = metaParts.join(' · ')
    const eventPreview = cleanSnippet(r.lastEvent?.preview)
    const fallbackPreview = !eventPreview
      ? [
          r.status === 'running' ? 'Active coding run' : r.status === 'paused' ? 'Waiting for input' : r.status === 'error' ? 'Needs attention' : r.status === 'done' ? 'Completed' : '',
          r.host ? `on ${r.host}` : '',
          r.cwd ? r.cwd.split('/').slice(-2).join('/') : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : ''
    const preview = eventPreview || fallbackPreview
    return {
      kind: 'dev',
      id: r.id,
      title: rawTitle || UNTITLED_RUN,
      at: r.updatedAt || r.createdAt,
      began: r.createdAt,
      status: r.status,
      project,
      ...(r.repo ? { repo: r.repo } : {}),
      ...(r.branch ? { branch: r.branch } : {}),
      ...(r.base ? { base: r.base } : {}),
      ...(r.mode ? { mode: r.mode } : {}),
      ...(r.pr ? { pr: r.pr } : {}),
      ...(meta ? { meta } : {}),
      ...(preview ? { preview } : {}),
      ...(r.pinned ? { pinned: true } : {}),
    }
  })
}

const DAY = 86_400_000
const SPAN: Record<Since, number> = { any: Infinity, day: DAY, week: 7 * DAY, month: 30 * DAY }
const STATE: Record<string, string> = {
  running: phrase('Running'),
  paused: phrase('Paused'),
  done: phrase('Done'),
  error: phrase('Failed'),
  stopped: phrase('Stopped'),
  archived: phrase('Archived'),
}

/** The date headings for standard grouping, in the order they read. */
const DAYS = [phrase('Today'), phrase('Yesterday'), phrase('Past 7 days'), phrase('Past 30 days'), phrase('Older')]

/** Weekday names for day-by-day priority timeline grouping (past 6 days). */
const WEEKDAYS = [
  phrase('Sunday'),
  phrase('Monday'),
  phrase('Tuesday'),
  phrase('Wednesday'),
  phrase('Thursday'),
  phrase('Friday'),
  phrase('Saturday'),
] as const

/** Which date heading an instant falls under (standard mode). */
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

/**
 * Day-by-day chronological bucket for `≡` Priority / Timeline mode:
 * `Today`, `Yesterday`, exact weekday names for 2–6 days ago, then `Older`.
 */
export function dayTimeline(at: string, now: Date): { title: string; rank: number } {
  const t = new Date(at)
  if (Number.isNaN(t.getTime())) return { title: phrase('Older'), rank: 99 }
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const rowStart = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  const diffDays = Math.round((todayStart - rowStart) / DAY)
  if (diffDays <= 0) return { title: phrase('Today'), rank: 0 }
  if (diffDays === 1) return { title: phrase('Yesterday'), rank: 1 }
  if (diffDays < 7) return { title: WEEKDAYS[t.getDay()]!, rank: diffDays }
  return { title: phrase('Older'), rank: 99 }
}

/** Whether a row belongs in the top `Priority` group when `≡` Priority mode is active. */
export function isPriorityRow(r: Recent): boolean {
  return Boolean(
    r.pinned ||
      r.unread ||
      r.status === 'running' ||
      r.status === 'paused' ||
      r.status === 'error',
  )
}

const newest = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0)

function filterAndSort(rows: Recent[], view: View, now: Date): Recent[] {
  const kept = rows.filter(
    (r) =>
      (view.status === 'all' || r.status === view.status) &&
      (view.since === 'any' || now.getTime() - new Date(r.at).getTime() <= SPAN[view.since]),
  )
  kept.sort((a, b) =>
    view.sort === 'title' ? a.title.localeCompare(b.title) : view.sort === 'created' ? newest(a.began, b.began) : newest(a.at, b.at),
  )
  return kept
}

/**
 * Standard list arrangement: the rows the view admits, sorted, and cut into
 * headed groups in the order they read. Pinned rows come first, under Pinned,
 * whatever the grouping; a view grouped by None holds the rest in one group with
 * no heading.
 */
export function arrange(rows: Recent[], view: View, now = new Date()): { title: string; rows: Recent[] }[] {
  const kept = filterAndSort(rows, view, now)
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

/**
 * Priority / Day-by-Day timeline arrangement (active when `≡` filter-triangle toggle is ON):
 * `Priority` section at top (running / paused / error / unread / pinned), followed by
 * chronological day-by-day sections (`Today`, `Yesterday`, exact weekdays for past 6 days, `Older`).
 */
export function arrangePriority(rows: Recent[], view: View, now = new Date()): { title: string; rows: Recent[] }[] {
  const kept = filterAndSort(rows, view, now)
  const priority: Recent[] = []
  const byBucket = new Map<string, { title: string; rank: number; rows: Recent[] }>()
  for (const r of kept) {
    if (isPriorityRow(r)) {
      priority.push(r)
      continue
    }
    const stamp = view.sort === 'created' ? r.began : r.at
    const bucket = dayTimeline(stamp, now)
    const existing = byBucket.get(bucket.title)
    if (existing) existing.rows.push(r)
    else byBucket.set(bucket.title, { title: bucket.title, rank: bucket.rank, rows: [r] })
  }
  const dayGroups = [...byBucket.values()]
    .sort((a, b) => a.rank - b.rank)
    .map(({ title, rows: bucketRows }) => ({ title, rows: bucketRows }))
  return priority.length ? [{ title: PRIORITY, rows: priority }, ...dayGroups] : dayGroups
}

/** Named project groups for the collapsible `Projects` section in Standard mode. */
export function projectGroups(rows: Recent[]): { name: string; rows: Recent[] }[] {
  const map = new Map<string, Recent[]>()
  for (const r of rows) {
    const name = r.project?.trim()
    if (!name) continue
    const list = map.get(name)
    if (list) list.push(r)
    else map.set(name, [r])
  }
  return [...map.entries()]
    .map(([name, groupRows]) => ({
      name,
      rows: [...groupRows].sort((a, b) => newest(a.at, b.at)),
    }))
    .sort((a, b) => newest(a.rows[0]?.at ?? '', b.rows[0]?.at ?? ''))
}

/** The heading pinned rows read under, first in standard views. */
export const PINNED = phrase('Pinned')

/** The heading priority rows read under, first in `≡` Priority timeline mode. */
export const PRIORITY = phrase('Priority')

/** The heading for the collapsible Projects section in standard views. */
export const PROJECTS = phrase('Projects')

/** The heading of rows with no project, in a list grouped by project. */
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
