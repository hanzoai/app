// The runtime behind Dev for this person: one interface, `DevRuntime` (@hanzo/dev-core),
// resolved in order.
//
//   local    the host's own Dev (where().runtime): Hanzo Desktop's computer.
//   machine  a computer they linked with `hanzo link` (Hanzo Connect): the first of
//            GET /v1/agents/targets that is online and publishes an endpoint.
//   cell     their cloud sandbox: POST /v1/dev/sessions leases it and answers
//            { id, label, zap, sandbox } (HIP-1330); DELETE /v1/dev/sessions/:id
//            releases it. A lease creates state, so it is asked for only when no
//            machine is linked. Refused or unavailable is no cell, never an error.
//   null     neither: the shell keeps drawing @hanzo/build's Builder.
//
// Both are reached over ZAP (WebTransport) with the person's Hanzo IAM bearer.

import { useEffect, useState } from 'react'
import type { DevRuntime } from '@hanzo/dev-core'
import { api } from './lib/api'
import { bearer } from './lib/session'
import { where } from './where'

interface Target {
  id: string
  label?: string
  host?: string
  status?: string
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

/** The linked machines, online. Reads only; nothing is leased. */
export async function machines(signal: AbortSignal): Promise<readonly DevRuntime[]> {
  const found = await call<{ targets?: Target[] }>('GET', '/v1/agents/targets', signal)
  return (found?.targets ?? [])
    .filter((m) => m.host && m.status === 'online')
    .map((m) => ({ kind: 'machine', id: m.id, label: m.label ?? m.id, zap: origin(m.host as string), token }))
}

/** The host's own Dev first, then a linked machine, else a leased cloud cell, else null. */
export async function resolveRuntime(signal: AbortSignal): Promise<DevRuntime | null> {
  const local = await where().runtime?.().catch(() => null)
  if (local) return local
  const linked = (await machines(signal))[0]
  if (linked) return linked
  const lease = await call<Lease>('POST', '/v1/dev/sessions', signal)
  return lease?.zap
    ? { kind: 'cell', id: lease.id, label: lease.label ?? 'Hanzo cloud', zap: origin(lease.zap), token, sandbox: lease.sandbox }
    : null
}

/** Gives a cell back; a machine is never ours to release. */
export const release = (runtime: DevRuntime): Promise<unknown> =>
  runtime.kind === 'cell' ? call('DELETE', `/v1/dev/sessions/${encodeURIComponent(runtime.id)}`) : Promise.resolve()

/** undefined while it is being found, null when there is none. */
export function useDevRuntime(on: boolean): DevRuntime | null | undefined {
  const [runtime, setRuntime] = useState<DevRuntime | null | undefined>(undefined)
  useEffect(() => {
    if (!on) return
    const ctl = new AbortController()
    let found: DevRuntime | null = null
    void resolveRuntime(ctl.signal).then((r) => {
      found = r
      if (!ctl.signal.aborted) setRuntime(r)
      else if (r) void release(r)
    })
    return () => {
      ctl.abort()
      if (found) void release(found)
    }
  }, [on])
  return runtime
}
