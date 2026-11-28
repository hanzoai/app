'use client'

import { useEffect, useState } from 'react'
import type { Client } from './client'
import type { Account, Machine, Range, Usage } from './types'

const NONE: Usage = { rows: [], snapshots: [] }

export interface Loaded {
  machines: Machine[]
  accounts: Account[]
  provider: Usage
  model: Usage
  machine: Usage
  at: Date
}

export type Read = { is: 'loading' } | { is: 'error'; status: number } | ({ is: 'ready' } & Loaded)

/**
 * Reads the machine registry, provider accounts and totals, again when `range` or `bump`
 * change, and not at all while no token is held. `all: false` is the picker's read: no per-model or per-machine totals.
 */
export function useRead(client: Client, range: Range, bump: number, all = true): Read {
  const enabled = client.signedIn()
  const [read, set] = useState<Read>({ is: 'loading' })
  useEffect(() => {
    if (!enabled) return
    const abort = new AbortController()
    const now = new Date()
    set({ is: 'loading' })
    const s = abort.signal
    Promise.all([
      client.machines(s),
      client.accounts(s),
      client.usage('provider', range, now, s),
      all ? client.usage('model', range, now, s) : NONE,
      all ? client.usage('machine', range, now, s) : NONE,
    ])
      .then(([machines, accounts, provider, model, machine]) => set({ is: 'ready', machines, accounts, provider, model, machine, at: now }))
      .catch((e: Error) => {
        if (e.name !== 'AbortError') set({ is: 'error', status: (e as { status?: number }).status ?? 0 })
      })
    return () => abort.abort()
  }, [client, range, bump, all, enabled])
  return read
}
