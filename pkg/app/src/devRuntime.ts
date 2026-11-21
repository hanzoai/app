// The runtime behind Dev for this person: one interface, `DevRuntime`
// (@hanzo/dev/runtime), resolved in order.
//
//   machine  a computer they linked with `hanzo link` (Hanzo Connect): the first
//            of GET /v1/agents/targets that is online and publishes a host.
//   cell     their cloud sandbox: GET /v1/dev/cell -> { id, label, host, sandbox }
//            (HIP-1330). Not found or refused is no cell, never an error.
//   null     neither: the shell keeps drawing @hanzo/build's Builder.
//
// Both speak the Dev environment protocol at `host`, authenticated with the
// person's Hanzo IAM bearer.

import { useEffect, useState } from 'react'
import type { DevRuntime } from '@hanzo/dev/runtime'
import { api } from './lib/api'
import { bearer } from './lib/session'

interface Target {
  id: string
  label?: string
  host?: string
  status?: string
}

interface Cell {
  id: string
  label?: string
  host: string
  sandbox?: string
}

const origin = (host: string): string => (/^https?:\/\//.test(host) ? host : `https://${host}`)

async function read<T>(path: string, signal: AbortSignal): Promise<T | null> {
  const token = bearer()
  if (!token) return null
  try {
    const res = await fetch(`${api()}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

const token = async (): Promise<string> => bearer() ?? ''

export async function listRuntimes(signal: AbortSignal): Promise<readonly DevRuntime[]> {
  const [targets, cell] = await Promise.all([
    read<{ targets?: Target[] }>('/v1/agents/targets', signal),
    read<Cell>('/v1/dev/cell', signal),
  ])
  const machines: DevRuntime[] = (targets?.targets ?? [])
    .filter((m) => m.host && m.status === 'online')
    .map((m) => ({ kind: 'machine', id: m.id, label: m.label ?? m.id, host: origin(m.host as string), token }))
  const cloud: DevRuntime[] = cell?.host
    ? [{ kind: 'cell', id: cell.id, label: cell.label ?? 'Hanzo cloud', host: origin(cell.host), token, sandbox: cell.sandbox }]
    : []
  return [...machines, ...cloud]
}

/** A linked machine first, else the cloud cell, else null. */
export async function resolveRuntime(signal: AbortSignal): Promise<DevRuntime | null> {
  return (await listRuntimes(signal))[0] ?? null
}

/** undefined while it is being found, null when there is none. */
export function useDevRuntime(on: boolean): DevRuntime | null | undefined {
  const [runtime, setRuntime] = useState<DevRuntime | null | undefined>(undefined)
  useEffect(() => {
    if (!on) return
    const ctl = new AbortController()
    void resolveRuntime(ctl.signal).then((r) => !ctl.signal.aborted && setRuntime(r))
    return () => ctl.abort()
  }, [on])
  return runtime
}
