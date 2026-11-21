'use client'

import { useEffect, useState } from 'react'
import type { Client } from './client'
import type { Account, Range, Source, Usage } from './types'

const NONE: Usage = { rows: [], snapshots: [] }

export interface Loaded {
  sources: Source[]
  accounts: Account[]
  provider: Usage
  model: Usage
  source: Usage
  at: Date
}

export type Read = { is: 'loading' } | { is: 'error'; status: number } | ({ is: 'ready' } & Loaded)

/**
 * Reads the registry, the accounts and the totals, again when `range` or `bump`
 * change, and not at all while no token is held. `all: false` is the picker's read: no per-model or per-source totals.
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
      client.sources(s),
      client.accounts(s),
      client.usage('provider', range, now, s),
      all ? client.usage('model', range, now, s) : NONE,
      all ? client.usage('source', range, now, s) : NONE,
    ])
      .then(([sources, accounts, provider, model, source]) => set({ is: 'ready', sources, accounts, provider, model, source, at: now }))
      .catch((e: Error) => {
        if (e.name !== 'AbortError') set({ is: 'error', status: (e as { status?: number }).status ?? 0 })
      })
    return () => abort.abort()
  }, [client, range, bump, all, enabled])
  return read
}
