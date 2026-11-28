/**
 * The cloud client: `GET /v1/machines`, `GET /v1/machines/usage`,
 * `GET|POST|DELETE /v1/machines/accounts`, `DELETE /v1/machines/{id}`. The host
 * names the gateway and holds the IAM token; nothing here signs anyone in.
 */
import type { Account, By, Machine, Range, Usage } from './types'

export interface ClientOptions {
  /** The gateway's origin, e.g. https://api.hanzo.ai. */
  apiBase: string
  /** The IAM bearer, or a function that reads it when a request is made. */
  token: string | null | (() => string | null)
  /** The organization the person works in, sent as X-Org-Id. */
  org?: string | null | (() => string | null)
  fetch?: typeof fetch
}

/** A read the cloud refused or could not answer. `status` is 0 for a network failure. */
export class MachinesError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const read = <T,>(v: T | (() => T)): T => (typeof v === 'function' ? (v as () => T)() : v)

/** The window a range reads: the last `days` days up to `now`. */
export function span(days: number, now = new Date()): { from: string; to: string } {
  return { from: new Date(now.getTime() - days * 86_400_000).toISOString(), to: now.toISOString() }
}

export function createClient(opts: ClientOptions) {
  const base = opts.apiBase.replace(/\/+$/, '')
  const get = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))

  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) }
    const token = read(opts.token)
    if (token) headers.Authorization = `Bearer ${token}`
    const org = read(opts.org ?? null)
    if (org) headers['X-Org-Id'] = org
    let res: Response
    try {
      res = await get(`${base}${path}`, { ...init, headers })
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      throw new MachinesError('Could not reach Hanzo.', 0)
    }
    if (!res.ok) throw new MachinesError(`Hanzo answered ${res.status}.`, res.status)
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
  }

  return {
    /** Whether a token is held: the view asks before it reads. */
    signedIn: (): boolean => Boolean(read(opts.token)),

    /** The caller's machines (linked devices + cloud compute), newest heartbeat first. */
    async machines(signal?: AbortSignal): Promise<Machine[]> {
      const body = await call<{ machines?: Machine[]; sources?: Machine[] }>('/v1/machines', { signal })
      return (body.machines ?? body.sources ?? []).map((m) => ({ ...m, providers: m.providers ?? [] }))
    },

    /** Revoke a linked machine: the cloud drops its routes and answers 410 to the next heartbeat. */
    async revoke(id: string): Promise<void> {
      await call<void>(`/v1/machines/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },

    /** Every provider login the caller's machines detected and every key in KMS. A missing class list is `local`. */
    async accounts(signal?: AbortSignal): Promise<Account[]> {
      const body = await call<{ accounts?: Account[] }>('/v1/machines/accounts', { signal })
      return (body.accounts ?? []).map((a) => ({ ...a, classes: a.classes?.length ? a.classes : ['local'] }))
    },

    /** Seal a key into KMS. The value is sent once and never returned. */
    async addKey(key: { provider: string; label: string; value: string }): Promise<Account> {
      return call<Account>('/v1/machines/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...key, kind: 'key' }),
      })
    },

    /** Delete a key (its KMS secret first, then the row). */
    async removeAccount(id: string): Promise<void> {
      await call<void>(`/v1/machines/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' })
    },

    /** Totals by `by`, and the latest snapshot per (machine, provider). Counts that are not numbers read as 0. */
    async usage(by: By, range: Range, now = new Date(), signal?: AbortSignal): Promise<Usage> {
      const { from, to } = span(range, now)
      const q = new URLSearchParams({ by, from, to })
      const body = await call<Partial<Usage>>(`/v1/machines/usage?${q}`, { signal })
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
    },
  }
}

export type Client = ReturnType<typeof createClient>
