/**
 * Linked sources and their usage (HIP-1350): every desktop and browser a person
 * linked to Hanzo, what each can reach, and what it used. A client of the cloud:
 * `GET /v1/sources`, `DELETE /v1/sources/{id}`, `GET /v1/sources/usage`. What is
 * read is metadata (counts, cost, limit windows); no prompt or code is reported.
 *
 * The shapes are Hanzo Dev's usage model (`@hanzodev/usage` schema.ts) plus the
 * registry's own. This module is data and arithmetic; Sources.tsx draws it.
 */
import { english, type Say } from '@hanzo/i18n'
import { api } from './api'
import { scope } from './session'

export type SourceKind = 'desktop' | 'browser'
export type SourceState = 'online' | 'offline' | 'revoked'
export type AccountKind = 'login' | 'key'

export interface ProviderState {
  provider: string
  instance: string
  kind: AccountKind
  state: string
  plan?: string
}

export interface Source {
  id: string
  kind: SourceKind
  name: string
  os: string
  arch?: string
  version?: string
  state: SourceState
  last_seen?: string
  linked_at: string
  zap?: string
  providers: ProviderState[]
}

export interface Window {
  kind: 'session' | 'daily' | 'weekly' | 'monthly' | 'credits' | 'other'
  label: string
  usedPercent: number
  windowMinutes?: number
  resetsAt?: string
}

export interface Snapshot {
  sourceId: string
  provider: string
  fetchedAt: string
  source: string
  plan?: string
  windows: Window[]
  credits?: { currency: string; balance?: number; spent?: number; limit?: number }
  status?: { indicator: string; description?: string }
  error?: string
}

export interface Row {
  key: string
  inputTokens: number
  outputTokens: number
  cacheTokens: number
  costUsd: number
}

export interface Usage {
  rows: Row[]
  snapshots: Snapshot[]
}

export type By = 'source' | 'provider' | 'model' | 'user'

/** The ranges the view offers, in days. */
export const RANGES = [7, 30] as const
export type Range = (typeof RANGES)[number]

/** A read the cloud refused or could not answer. `status` is 0 for a network failure. */
export class SourcesError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function call<T>(path: string, init: RequestInit & { signal?: AbortSignal } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${api()}${path}`, { ...init, headers: { ...scope(), ...init.headers } })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new SourcesError('Could not reach Hanzo.', 0)
  }
  if (!res.ok) throw new SourcesError(`Hanzo answered ${res.status}.`, res.status)
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** `GET /v1/sources`, the caller's own, newest heartbeat first. */
export async function listSources(signal?: AbortSignal): Promise<Source[]> {
  const body = await call<{ sources?: Source[] }>('/v1/sources', { signal })
  return (body.sources ?? []).map((s) => ({ ...s, providers: s.providers ?? [] }))
}

/** `DELETE /v1/sources/{id}`: the cloud drops its routes and answers 410 to its next heartbeat. */
export async function revokeSource(id: string): Promise<void> {
  await call<void>(`/v1/sources/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** The window a range reads: the last `days` days up to `now`. */
export function span(days: number, now = new Date()): { from: string; to: string } {
  return { from: new Date(now.getTime() - days * 86_400_000).toISOString(), to: now.toISOString() }
}

/** `GET /v1/sources/usage?by=`. Counts the cloud sent that are not numbers read as 0. */
export async function readUsage(by: By, range: Range, now = new Date(), signal?: AbortSignal): Promise<Usage> {
  const { from, to } = span(range, now)
  const q = new URLSearchParams({ by, from, to })
  const body = await call<{ rows?: Row[]; snapshots?: Snapshot[] }>(`/v1/sources/usage?${q}`, { signal })
  return {
    rows: (body.rows ?? []).map((r) => ({
      key: String(r.key),
      inputTokens: num(r.inputTokens),
      outputTokens: num(r.outputTokens),
      cacheTokens: num(r.cacheTokens),
      costUsd: num(r.costUsd),
    })),
    snapshots: (body.snapshots ?? []).map((s) => ({ ...s, windows: s.windows ?? [] })),
  }
}

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

/**
 * How a provider account is reached. A subscription login stays on the machine
 * that holds it; a key is held in Hanzo KMS (HIP-1350, "credentials do not move").
 */
export function route(kind: AccountKind, t: Say = english): string {
  return kind === 'key' ? t('API key') : t('On this device only')
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

/** Every provider named by a total or a snapshot, in the order the totals weigh them. */
export function providers(usage: Usage): string[] {
  const seen = heaviest(usage.rows).map((r) => r.key)
  for (const s of usage.snapshots) if (!seen.includes(s.provider)) seen.push(s.provider)
  return seen
}

/** A source's name from its id, for a snapshot's heading; the id when it was revoked and unlisted. */
export const named = (sources: Source[], id: string): string => sources.find((s) => s.id === id)?.name ?? id
