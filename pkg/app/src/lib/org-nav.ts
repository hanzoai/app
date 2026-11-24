'use client'

import { useEffect, useState } from 'react'
import { api } from './api'
import { org as currentOrg, scope } from './session'

/** Product slug under `/v1/settings/:product` that stores an organization's default sidebar app list & order. */
export const ORG_NAV_PRODUCT = 'app-nav'

/** Per-org preference key so a reader's sidebar customization is kept separately for each organization. */
export function orgNavKey(baseKey: string, orgId: string | null | undefined): string {
  const clean = (orgId ?? '').trim().toLowerCase()
  return clean ? `${baseKey}:${clean}` : baseKey
}

function cleanIds(list: unknown): string[] | null {
  if (!Array.isArray(list)) return null
  const out = [
    ...new Set(
      list
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .map((id) => (id === 'research' ? 'science' : id.trim())),
    ),
  ]
  return out.length ? out : null
}

/**
 * Precedence for a reader's sidebar apps in an organization:
 * 1. Reader's own per-org customization (`userOrgPins`), if saved.
 * 2. Organization default apps (`orgDefaults` from `GET /v1/settings/app-nav`) — so every new
 *    member of the org starts with the org's configured apps & exact order.
 * 3. Legacy global pins (`legacyPins`), if any.
 */
export function resolveNavSeed(
  userOrgPins: unknown,
  orgDefaults: readonly string[] | null,
  legacyPins: unknown,
): string[] {
  if (Array.isArray(userOrgPins)) {
    return cleanIds(userOrgPins) ?? []
  }
  if (Array.isArray(orgDefaults) && orgDefaults.length > 0) {
    return cleanIds(orgDefaults) ?? []
  }
  if (Array.isArray(legacyPins)) {
    return cleanIds(legacyPins) ?? []
  }
  return []
}

type CacheEntry = { key: string; promise: Promise<string[] | null> }
let cache: CacheEntry | null = null
const listeners = new Set<() => void>()

function authOrgKey(auth: Record<string, string>): string {
  return auth.Authorization ? `${auth.Authorization}:${auth['X-Org-Id'] ?? ''}` : ''
}

function notify(): void {
  for (const fn of listeners) fn()
}

/** Reads the active organization's default sidebar apps from `GET /v1/settings/app-nav`. */
export function readOrgNavDefaults(): Promise<string[] | null> {
  const auth = scope()
  if (!auth.Authorization) return Promise.resolve(null)
  const key = authOrgKey(auth)
  if (cache?.key !== key) {
    cache = {
      key,
      promise: fetch(`${api()}/v1/settings/${ORG_NAV_PRODUCT}`, { headers: auth })
        .then((r) => (r.ok ? (r.json() as Promise<{ config?: { apps?: unknown } }>) : null))
        .then((body) => cleanIds(body?.config?.apps))
        .catch(() => null),
    }
  }
  return cache.promise
}

/** Saves the organization's default sidebar apps & order (`PUT /v1/settings/app-nav`). */
export async function saveOrgNavDefaults(apps: readonly string[]): Promise<boolean> {
  const auth = scope()
  if (!auth.Authorization) return false
  const cleaned = cleanIds(apps) ?? []
  try {
    const res = await fetch(`${api()}/v1/settings/${ORG_NAV_PRODUCT}`, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { apps: cleaned } }),
    })
    if (!res.ok) return false
    const key = authOrgKey(auth)
    cache = { key, promise: Promise.resolve(cleaned.length ? cleaned : null) }
    notify()
    return true
  } catch {
    return false
  }
}

/** Subscribes to the active organization's configured default sidebar apps. */
export function useOrgNavDefaults(): {
  orgId: string | null
  defaults: string[] | null
  save: (apps: readonly string[]) => Promise<boolean>
} {
  const auth = scope()
  const signed = Boolean(auth.Authorization)
  const orgId = currentOrg()
  const key = authOrgKey(auth)
  const [defaults, setDefaults] = useState<string[] | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const onChange = () => setTick((n) => n + 1)
    listeners.add(onChange)
    return () => {
      listeners.delete(onChange)
    }
  }, [])

  useEffect(() => {
    if (!signed) {
      setDefaults(null)
      return
    }
    let live = true
    void readOrgNavDefaults().then((apps) => {
      if (live) setDefaults(apps)
    })
    return () => {
      live = false
    }
  }, [signed, key, tick])

  return { orgId, defaults, save: saveOrgNavDefaults }
}

/** Test-only helper to clear the in-memory org-nav cache between test cases. */
export function resetOrgNavCache(): void {
  cache = null
}
