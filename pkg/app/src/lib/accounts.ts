'use client'

/**
 * THE PEOPLE SIGNED IN ON THIS BROWSER, and the way to be any one of them.
 *
 * IAM's session cookie holds one session per person (GET /v1/iam/accounts lists
 * them, most recent first; it answers the browser that holds them and no other).
 * Being one of them is the ordinary sign-in with a `login_hint` naming the person:
 * IAM continues as that account and nobody types anything. Adding another is the
 * sign-in with `prompt=login`, which asks for credentials and keeps the sessions
 * already held. Neither ends a session. Signing OUT is IAM's, and it ends every
 * session the browser holds (internal/oidc/logout.go), so no row here offers to
 * end just one.
 *
 * Both go through the page's own IAM client (`useClient`), so the authorize
 * address is the one this site signs in at, and both write the page down first
 * (`rememberDestination`), so the sign-in returns here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useIam } from '@hanzo/iam/react'
import { rememberDestination } from './destination'
import { named } from './session'
import { here, useClient } from './signout'

/** One person signed in on this browser: enough to recognise them, and to name them in a `login_hint`. */
export interface Account {
  sub: string
  owner: string
  name: string
  displayName: string
  email: string
  avatar: string
}

const PATH = '/v1/iam/accounts'

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** One row of IAM's answer, or nothing for a row that cannot be named. Only an https picture is kept. */
function clean(raw: unknown): Account | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const sub = text(r.sub)
  const name = text(r.name)
  if (!sub || !name) return null
  const avatar = text(r.avatar)
  return {
    sub,
    owner: text(r.owner),
    name,
    displayName: text(r.displayName),
    email: text(r.email).toLowerCase(),
    avatar: avatar.startsWith('https://') ? avatar : '',
  }
}

/** The accounts IAM holds for this browser, read from `base`. An answer that is not a list, or none, is nobody. */
export async function read(base: string, signal?: AbortSignal): Promise<Account[]> {
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}${PATH}`, { credentials: 'include', headers: { Accept: 'application/json' }, signal })
    if (!res.ok) return []
    const body = (await res.json()) as unknown
    const rows = Array.isArray(body) ? body : (body as { data?: unknown } | null)?.data
    const seen = new Set<string>()
    return (Array.isArray(rows) ? rows : [])
      .map(clean)
      .filter((a): a is Account => a !== null && !seen.has(a.sub) && !!seen.add(a.sub))
  } catch {
    return []
  }
}

/** What the page knows of the reader, to tell which account is theirs. */
export interface Who {
  email?: string
  name?: string
  sub?: string
}

/** Whether `account` is the reader: the same subject, else the same address, else the same username. */
export function is(account: Account, who: Who): boolean {
  if (who.sub && account.sub === who.sub) return true
  if (who.email && account.email && account.email === who.email.trim().toLowerCase()) return true
  return !who.email && !!who.name && account.name === who.name
}

/** The line a row says: the display name, else the username; and the address when it adds something. */
export function label(account: Account): { title: string; line: string } {
  const title = account.displayName || account.name
  return { title, line: account.email && account.email !== title ? account.email : '' }
}

/**
 * The accounts signed in here, which is the reader's, and the two ways to leave
 * for another: `switchTo` an account in the list, and `add` one. Signed out it
 * reads nothing.
 */
export function useAccounts(): { accounts: Account[]; current: Account | null; switchTo: (a: Account) => Promise<void>; add: () => Promise<void> } {
  const { config, user, isAuthenticated } = useIam()
  const client = useClient()
  const [accounts, setAccounts] = useState<Account[]>([])
  const base = here() ? window.location.origin : (config as { serverUrl?: string }).serverUrl || ''

  useEffect(() => {
    if (!isAuthenticated || !base) return
    const ctl = new AbortController()
    void read(base, ctl.signal).then((list) => {
      if (!ctl.signal.aborted) setAccounts(list)
    })
    return () => ctl.abort()
  }, [base, isAuthenticated])

  const claimed = named()
  const u = user as { email?: string; name?: string; sub?: string; id?: string } | null
  const who: Who = { sub: u?.sub ?? u?.id, email: u?.email || claimed?.email, name: u?.name || claimed?.name }
  const current = useMemo(() => accounts.find((a) => is(a, who)) ?? null, [accounts, who.sub, who.email, who.name]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback(
    async (extra: Parameters<typeof client.getSigninUrl>[0]) => {
      rememberDestination()
      window.location.replace(await client.getSigninUrl(extra))
    },
    [client],
  )
  const switchTo = useCallback((a: Account) => go({ additionalParams: { login_hint: a.sub } }), [go])
  const add = useCallback(() => go({ additionalParams: { prompt: 'login' } }), [go])
  return { accounts, current, switchTo, add }
}
