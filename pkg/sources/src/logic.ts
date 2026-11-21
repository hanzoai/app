/** Aggregation, formatting and the availability rule (HIP-1350): pure, no React, no fetch. */
import { english, type Say } from '@hanzo/i18n'
import type { Account, Availability, Choice, Row, Snapshot, Source, Surface, Usage } from './types'

/** Input, output and cache tokens together. */
export const tokens = (r: Pick<Row, 'inputTokens' | 'outputTokens' | 'cacheTokens'>): number =>
  r.inputTokens + r.outputTokens + r.cacheTokens

/** The sum of rows: what a heading over them says. */
export function total(rows: Row[]): Row {
  return rows.reduce<Row>(
    (a, r) => ({
      key: 'total',
      inputTokens: a.inputTokens + r.inputTokens,
      outputTokens: a.outputTokens + r.outputTokens,
      cacheTokens: a.cacheTokens + r.cacheTokens,
      costUsd: a.costUsd + r.costUsd,
    }),
    { key: 'total', inputTokens: 0, outputTokens: 0, cacheTokens: 0, costUsd: 0 },
  )
}

/** Rows by tokens, heaviest first; equal weight keeps the key's order so a redraw never shuffles. */
export const heaviest = (rows: Row[]): Row[] =>
  [...rows].sort((a, b) => tokens(b) - tokens(a) || a.key.localeCompare(b.key))

/** 950, 1.2K, 3.4M, 1.1B: what a count looks like in a column. */
export function compact(n: number): string {
  const v = Math.max(0, Math.round(n))
  if (v < 1000) return String(v)
  const units = ['K', 'M', 'B']
  let x = v / 1000
  let i = 0
  while (Math.round(x * 10) / 10 >= 1000 && i < units.length - 1) {
    x /= 1000
    i++
  }
  return `${x >= 100 ? Math.round(x) : Math.round(x * 10) / 10}${units[i]}`
}

/** Dollars in the reader's locale; cents under $100, whole dollars above. */
export function dollars(n: number, locale = 'en-US'): string {
  const big = Math.abs(n) >= 100
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: big ? 0 : 2,
    maximumFractionDigits: big ? 0 : 2,
  }).format(n)
}

/** An amount in the currency a provider reported; a code Intl does not know is printed as it came. */
export function money(n: number, currency: string, locale = 'en-US'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n)
  } catch {
    return `${n} ${currency}`
  }
}

/** A used share clamped to a bar: 0..100, whole numbers. */
export const percent = (n: number): number => (Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0)

/** Where a limit sits: `high` from 90%, `warn` from 75%. The view colours by it. */
export const level = (used: number): 'ok' | 'warn' | 'high' => (used >= 90 ? 'high' : used >= 75 ? 'warn' : 'ok')

/** When a window resets, relative: `in 3h`, `in 2d`, or '' when unknown or past. */
export function resets(at: string | undefined, now = new Date(), t: Say = english): string {
  if (!at) return ''
  const ms = new Date(at).getTime() - now.getTime()
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const m = Math.ceil(ms / 60_000)
  if (m < 60) return t('in {n}m', { n: m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('in {n}h', { n: h })
  return t('in {n}d', { n: Math.floor(h / 24) })
}

/** How long ago: `now`, `12m`, `3h`, `2d`, `5w`, `4mo`, `2y`. '' for an instant that is not one. */
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

/** Sources as a list reads them: online first, then by the latest heartbeat; revoked last. */
export function ordered(sources: Source[]): Source[] {
  const rank = (s: Source) => (s.state === 'online' ? 0 : s.state === 'offline' ? 1 : 2)
  const seen = (s: Source) => (s.last_seen ? new Date(s.last_seen).getTime() || 0 : 0)
  return [...sources].sort((a, b) => rank(a) - rank(b) || seen(b) - seen(a) || a.name.localeCompare(b.name))
}

/** A provider's latest snapshots, one per source that reported it, freshest first. */
export function snapshotsFor(usage: Usage, provider: string): Snapshot[] {
  return usage.snapshots
    .filter((s) => s.provider === provider)
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt) || a.sourceId.localeCompare(b.sourceId))
}

/** The snapshot an account reads its windows and credits from: its own source's, for its own provider. */
export const snapshotOf = (usage: Usage, a: Pick<Account, 'provider' | 'sourceId'>): Snapshot | undefined =>
  usage.snapshots.find((s) => s.provider === a.provider && s.sourceId === a.sourceId)

/** Every provider named by a total or a snapshot, in the order the totals weigh them. */
export function providers(usage: Usage): string[] {
  const seen = heaviest(usage.rows).map((r) => r.key)
  for (const s of usage.snapshots) if (!seen.includes(s.provider)) seen.push(s.provider)
  return seen
}

/** A source's name from its id, for a heading; the id when it was revoked and unlisted. */
export const named = (sources: Source[], id: string): string => sources.find((s) => s.id === id)?.name ?? id

/**
 * Accounts as a picker lists them: those usable here first, then by provider and
 * label, so a redraw never shuffles. Greyed accounts stay in view with their reason.
 */
export function listed(accounts: Account[], sources: Source[], surface: Surface, deviceId?: string): Account[] {
  const usable = (a: Account) => (availability(a, sources.find((s) => s.id === a.sourceId), surface, deviceId).usable ? 0 : 1)
  return [...accounts].sort(
    (a, b) => usable(a) - usable(b) || a.provider.localeCompare(b.provider) || (a.label ?? a.instance ?? '').localeCompare(b.label ?? b.instance ?? '') || a.id.localeCompare(b.id),
  )
}

/**
 * Whether `account` can run a session on `surface`, and why not: one pure
 * function of the account, its source, the surface and the account's classes
 * from cloud (HIP-1350, "One view, one picker, four surfaces"). `deviceId` is the
 * source id of the device the surface runs on, when it is a linked source.
 * The reasons are the table's one-line strings, `<device>` filled in.
 */
export function availability(account: Account, source: Source | undefined, surface: Surface, deviceId?: string, t: Say = english): Availability {
  const classes = account.classes?.length ? account.classes : ['local']
  const device = source?.name ?? t('this device')

  if (account.kind === 'key') {
    if (surface === 'extension') return { usable: false, reason: t('Runs from Hanzo Dev or hanzo.app') }
    return { usable: true }
  }

  if (!source || source.state === 'revoked') return { usable: false, reason: t('{device} was unlinked', { device }) }
  if (source.kind === 'browser') return { usable: false, reason: t('Browser accounts are view-only') }
  if (deviceId && source.id === deviceId) return { usable: true }

  if (classes.includes('desktop')) {
    if (surface === 'extension') return { usable: false, reason: t('Runs from Hanzo Dev or hanzo.app') }
    if (source.state !== 'online') return { usable: false, reason: t('{device} is offline', { device }) }
    if (!account.shared) return { usable: false, reason: t('Turn on Share on {device}', { device }) }
    return { usable: true, reason: t('Run on {device}', { device }) }
  }
  return { usable: false, reason: t('Stays on {device}: its terms do not allow remote use', { device }) }
}

/** What choosing an account returns, or null when it is not usable here. */
export function choose(account: Account, source: Source | undefined, surface: Surface, deviceId?: string): Choice | null {
  if (!availability(account, source, surface, deviceId).usable) return null
  if (account.kind === 'key') return { via: 'key', account: account.id }
  // A login on this very device runs in the desktop app itself, not through a route.
  if (deviceId && source?.id === deviceId) return null
  return { via: 'desktop', source: source!.id, instance: account.instance ?? '' }
}

/** The default: a cloud cell on Hanzo's own models, which needs no account. */
export const CELL: Choice = { via: 'cell' }
