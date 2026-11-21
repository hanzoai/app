// The runtime behind Dev for this person: one interface, `DevRuntime` (@hanzo/dev-core),
// resolved in order.
//
//   local    the host's own Dev (where().runtime): Hanzo Desktop's computer.
//   machine  a computer they linked with `hanzo link` (Hanzo Link): the first of
//            GET /v1/sources that is online and publishes a ZAP endpoint.
//   cell     their cloud sandbox: POST /v1/dev/sessions leases it and answers
//            { id, label, zap, sandbox } (HIP-1330); DELETE /v1/dev/sessions/:id
//            releases it. A lease creates state and is billed while held, so resolving
//            never takes one: only an explicit action of the person's calls `cell`.
//            Refused or unavailable is no cell, never an error.
//   null     neither: Dev's own start state.
//
// Both are reached over ZAP (WebTransport) with the person's Hanzo IAM bearer.

import { useEffect, useState } from 'react'
import type { DevRuntime } from '@hanzo/dev-core'
import { api } from './lib/api'
import { bearer } from './lib/session'
import { where } from './where'

/** A linked computer, as `GET /v1/sources` lists it (Hanzo Link). */
interface Source {
  id: string
  kind: string
  name?: string
  state?: string
  zap?: string
}

interface Lease {
  id: string
  label?: string
  zap: string
  sandbox?: string
}

const origin = (host: string): string => (/^https?:\/\//.test(host) ? host : `https://${host}`)

const headers = (): HeadersInit | null => {
  const token = bearer()
  return token ? { Authorization: `Bearer ${token}` } : null
}

async function call<T>(method: string, path: string, signal?: AbortSignal): Promise<T | null> {
  const auth = headers()
  if (!auth) return null
  try {
    const res = await fetch(`${api()}${path}`, { method, headers: auth, cache: 'no-store', signal })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

const token = async (): Promise<string> => bearer() ?? ''

/** The linked machines, online, that a browser can reach over ZAP (https; WebTransport has no plain http). Reads only; nothing is leased. */
export async function machines(signal: AbortSignal): Promise<readonly DevRuntime[]> {
  const found = await call<{ sources?: Source[] }>('GET', '/v1/sources', signal)
  return (found?.sources ?? [])
    .filter((m) => m.zap && m.state === 'online' && origin(m.zap).startsWith('https:'))
    .map((m) => ({ kind: 'machine', id: m.id, label: m.name ?? m.id, zap: origin(m.zap as string), token }))
}

/** The host's own Dev first, then a linked machine, else null; never a cloud cell, which only an explicit action leases (`cell`). `skip` names runtimes that would not pair this session. */
export async function resolveRuntime(signal: AbortSignal, skip: ReadonlySet<string> = new Set()): Promise<DevRuntime | null> {
  const local = await where().runtime?.().catch(() => null)
  if (local && !skip.has(local.id)) return local
  const linked = (await machines(signal)).find((m) => !skip.has(m.id))
  return linked ?? null
}

/** A cloud cell, leased: null when `/v1/dev/sessions` is not there or refuses. */
export async function cell(signal: AbortSignal): Promise<DevRuntime | null> {
  const lease = await call<Lease>('POST', '/v1/dev/sessions', signal)
  return lease?.zap
    ? { kind: 'cell', id: lease.id, label: lease.label ?? 'Hanzo cloud', zap: origin(lease.zap), token, sandbox: lease.sandbox }
    : null
}

/** Gives a cell back; a machine is never ours to release. */
export const release = (runtime: DevRuntime): Promise<unknown> =>
  runtime.kind === 'cell' ? call('DELETE', `/v1/dev/sessions/${encodeURIComponent(runtime.id)}`) : Promise.resolve()

/**
 * `runtime` is undefined while it is being found, null when there is none. `fail` is for a runtime
 * that would not pair: it is not tried again this session, and the next (a machine, else none:
 * Dev's start state) takes its place.
 */
export function useDevRuntime(on: boolean): { runtime: DevRuntime | null | undefined; fail: (r: DevRuntime) => void } {
  const [runtime, setRuntime] = useState<DevRuntime | null | undefined>(undefined)
  const [skip, setSkip] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    if (!on) return
    const ctl = new AbortController()
    let found: DevRuntime | null = null
    void resolveRuntime(ctl.signal, skip).then((r) => {
      found = r
      if (!ctl.signal.aborted) setRuntime(r)
      else if (r) void release(r)
    })
    return () => {
      ctl.abort()
      if (found) void release(found)
    }
  }, [on, skip])
  const fail = (r: DevRuntime) => setSkip((prev) => new Set(prev).add(r.id))
  return { runtime, fail }
}
