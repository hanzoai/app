/**
 * The shapes of `/v1/sources` (HIP-1350). Usage is Hanzo Dev's usage model
 * (`@hanzodev/usage` schema.ts) plus the registry's own fields.
 */

export type SourceKind = 'desktop' | 'browser'
export type SourceState = 'online' | 'offline' | 'revoked'
export type AccountKind = 'login' | 'key'

/** What a provider account may be used for. `local` is the fail-closed default. */
export type RouteClass = 'local' | 'desktop' | 'key' | 'cell'

/** Where a person is looking from. `web` is hanzo.app, hanzo.team and hanzo.bot. */
export type Surface = 'extension' | 'desktop' | 'web'

export interface ProviderState {
  provider: string
  instance: string
  kind: AccountKind
  state: string
  plan?: string
  shared?: boolean
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

/** A login a desktop or browser detected, or a key held in Hanzo KMS: `GET /v1/sources/accounts`. */
export interface Account {
  id: string
  provider: string
  kind: AccountKind
  label?: string
  fingerprint?: string
  created?: string
  classes: RouteClass[]
  sourceId?: string
  instance?: string
  state?: string
  plan?: string
  shared?: boolean
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

/** Whether an account can run a session here, and the one line that says why not (or how). */
export interface Availability {
  usable: boolean
  reason?: string
}

/** What choosing an account returns: `/v1/dev`'s `execution` field (HIP-1350, Routing). */
export type Choice =
  | { via: 'cell' }
  | { via: 'key'; account: string }
  | { via: 'desktop'; source: string; instance: string }
