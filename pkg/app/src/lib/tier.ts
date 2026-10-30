'use client'

/**
 * WHAT THIS ACCOUNT IS ON, AND WHAT IT MAY SPEND.
 *
 * Two reads, one question each. `GET /v1/billing/tier` names the plan and its
 * term. `GET /v1/billing/balance` is the money: it reads the ledger the model
 * gate admits against and every metered call is debited from, so its
 * `available` is the one figure a person's spend is compared to. The tier's own
 * `effectiveAvailable` is computed from commerce's store, which a top-up reaches
 * and a usage debit does not, so it stays at the top-up after the ledger has
 * spent it — and for the ecosystem orgs it is a $1,000 floor the gate never
 * reads. The balance replaces it here; nothing adds the two.
 *
 * WHAT IT DOES NOT DO IS GUESS. The server answers 502 rather than 0 for a
 * balance it could not read — "unknown is not broke" — and this keeps that
 * distinction all the way to the screen: a failed read resolves to an error, an
 * error renders as a sentence, and no path in this file produces a number that
 * did not come from a response.
 *
 * The failure carries `status` because that is what `workspace/failure.ts`
 * reads first, so a refusal here already speaks the vocabulary every room uses.
 * A second Refusal class would be a second vocabulary for the same event.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { bearer, org, orgs, scope } from './session'
import { list } from './list'
import { money } from './pay'
import { english, type Say } from '@hanzo/i18n'

/** A period's end as a sentence states it — "Oct 30, 2026" — or '' for none. Periods end on UTC days. */
function date(iso: string | null | undefined, locale = 'en-US'): string {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? '' : new Date(t).toLocaleDateString(locale, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })
}

/** The plan, as billing names it. */
export interface TierLimits {
  name: string
  displayName: string
  dailyCreditsCents: number
  maxAgents: number
  /** MaxAgents 0 means "no ceiling" rather than "no agents" — the reading a
   *  bare zero cannot carry. The server publishes it because the zero is
   *  ambiguous, so nothing here re-derives it. */
  unlimitedAgents: boolean
  allowedModels?: string[]
}

/** Whole USD cents, every field. */
export interface TierBalance {
  currency: string
  prepaidAvailable: number
  creditsRemaining: number
  dailyRemaining: number
  /** THE ONE FIGURE TO COMPARE AGAINST ZERO: the ledger's `available`, which
   *  `readTier` states from GET /v1/billing/balance. */
  effectiveAvailable: number
  /** The account that figure is the balance OF, as billing resolved the payer —
   *  the org's own pool, or a member's wallet inside it. Never derived here. */
  account?: string
}

/** A rate term — "10 requests per minute, 3 left, resets at …". */
export interface TierWindow {
  span: string
  limit: number
  used: number
  remaining: number
  resets: string
}

export interface Tier {
  user: string
  /** The catalog rung the subject is served as — a plan slug like "max-20x",
   *  or "" where the account holds no subscription. `tier` is the coarser
   *  class (free/dev/enterprise) that slug is served under; this is the row
   *  `lib/plans.ts` names, and the one a menu should print. */
  plan: string
  tier: TierLimits
  balance: TierBalance
  windows?: TierWindow[]
}

/** An error that names the status, for `say()` to turn into a sentence. */
const refusal = (status: number, message: string): Error =>
  Object.assign(new Error(message), { status })

/** GETs `path` as whoever holds the bearer, in this browser's organization. */
async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${api()}${path}`, {
    headers: scope(),
    signal,
  })
  if (!res.ok) {
    // The body is RFC 7807 here — `detail` is the server's own sentence, which
    // is better than any rewording of it. Where there is none, the status is
    // still a fact and `say()` knows what to do with it.
    let detail = ''
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? ''
    } catch {
      // an HTML error page proves nothing worth showing
    }
    throw refusal(res.status, detail || `Billing answered ${res.status}`)
  }
  return (await res.json()) as T
}

/** Reads the tier and the balance for whoever holds the bearer. The requests
 *  name no subject — the credential is the scope — so there is no id to get wrong. */
export async function readTier(signal?: AbortSignal): Promise<Tier> {
  const token = bearer()
  if (!token) throw refusal(401, 'Sign in to see your plan')
  const [data, ledger] = await Promise.all([
    read<Tier>('/v1/billing/tier', signal),
    read<{ available: number; account?: string }>('/v1/billing/balance', signal),
  ])
  data.balance = { ...data.balance, effectiveAvailable: ledger.available, account: ledger.account }
  return data
}

/**
 * Whether a tier answer is a paid plan: billing names a paid plan the account's
 * subscription is on, or serves it a paid tier — `pro`, which a plan recorded
 * outside checkout confers, or `enterprise` (the platform org, a partner org).
 * A trial nobody paid for is `starter` and names no plan.
 */
export function paid(t: { plan?: string; tier?: { name?: string } } | null | undefined): boolean {
  return Boolean((t?.plan && t.plan !== 'free') || t?.tier?.name === 'pro' || t?.tier?.name === 'enterprise')
}

/** A plan the org subscribes to, as GET /v1/billing/subscriptions lists it. Money in whole cents. */
export interface Subscription {
  id: string
  status: string
  quantity: number
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  plan: { id: string; name: string; price: number; currency: string; interval: string }
}

/** The states in which a subscription is the plan the org is on. */
const LIVE: ReadonlySet<string> = new Set(['active', 'trialing'])

/**
 * The org's live subscription, or null where it holds none — being on no plan
 * is an answer, and a refusal is not: that throws, the way the tier read does.
 */
export async function readSubscription(signal?: AbortSignal): Promise<Subscription | null> {
  const got = await read<{ subscriptions?: unknown }>('/v1/billing/subscriptions', signal)
  return list<Subscription>(got?.subscriptions).find((s) => LIVE.has(s?.status) && typeof s?.plan?.price === 'number') ?? null
}

/**
 * The term as a sentence, through `t`: "$200/month subscription, renews Oct 30, 2026". The
 * price is per seat, so it is the seats times it; a cancelled term ends rather
 * than renews.
 */
export function renewal(s: Subscription, t: Say = english, locale = 'en-US'): string {
  const each = money((s.plan.price * Math.max(1, s.quantity || 1)) / 100, locale)
  const when = date(s.currentPeriodEnd, locale)
  const interval = s.plan.interval || 'month'
  // A term the catalogue names other than a month or a year is drawn as it names it.
  const price = interval === 'month' ? t('{price}/month', { price: each }) : interval === 'year' ? t('{price}/year', { price: each }) : `${each}/${interval}`
  if (!when) return t('{price} subscription', { price })
  return s.cancelAtPeriodEnd ? t('{price} subscription, ends {date}', { price, date: when }) : t('{price} subscription, renews {date}', { price, date: when })
}

/** The live subscription, held: null while unknown, refused, or on no plan. */
export function useSubscription(enabled = true, org: string | null = null): Subscription | null {
  const [sub, setSub] = useState<Subscription | null>(null)
  useEffect(() => {
    if (!enabled) return
    const stop = new AbortController()
    readSubscription(stop.signal)
      .then((got) => {
        if (!stop.signal.aborted) setSub(got)
      })
      .catch(() => {
        if (!stop.signal.aborted) setSub(null)
      })
    return () => stop.abort()
  }, [enabled, org])
  return sub
}

/** How long a sign-in waits on billing before it offers the plans. */
const PATIENCE = 5000

/** `signal`, cut off at PATIENCE, on a browser that can combine the two; else PATIENCE alone. */
function within(signal?: AbortSignal): AbortSignal | undefined {
  const limit = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(PATIENCE) : undefined
  if (!signal || !limit) return limit ?? signal
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, limit]) : limit
}

/**
 * Whether this account pays for a plan where it works: in the organization it
 * acts in, or, before it has picked one, in any organization its token names.
 * A read that fails or takes longer than PATIENCE counts as no plan, so the
 * plans are offered rather than the app withheld. At most ten organizations
 * are asked.
 */
export async function paying(signal?: AbortSignal): Promise<boolean> {
  const token = bearer()
  if (!token) return false
  const acting = org()
  const where: (string | null)[] = acting ? [acting] : orgs().slice(0, 10)
  const reads = await Promise.allSettled(
    (where.length ? where : [null]).map(async (o) => {
      const res = await fetch(`${api()}/v1/billing/tier`, {
        headers: { Authorization: `Bearer ${token}`, ...(o ? { 'X-Org-Id': o } : {}) },
        signal: within(signal),
      })
      return res.ok ? ((await res.json()) as Tier) : null
    }),
  )
  return reads.some((r) => r.status === 'fulfilled' && paid(r.value))
}

/** The last tier an organization was read at. */
export type Read = { org: string | null; tier: Tier }

/** What a read left held, and for which organization. */
export type Held = { org: string | null; tier: Tier | null; wrong: unknown }

/**
 * Whether a failed read may answer otherwise on the next try: no answer at all
 * (the network, a timeout), too many asks (429) or billing's own failure (a
 * 5xx). A 401, 403 or 404 is billing's answer, and stands.
 */
export function transient(e: unknown): boolean {
  const status = (e as { status?: unknown } | null)?.status
  return typeof status !== 'number' || status === 408 || status === 429 || status >= 500
}

/**
 * What a read of the tier leaves held, and the tier the next read falls back
 * on. A read that answers is the tier. One that fails for a moment
 * (`transient`) keeps the tier this organization was last read at, so a reader
 * is not swapped out of a room they pay for by a re-read that did not answer
 * (the gate reads again on focus and on return). Billing's refusal, or a
 * failure with nothing read for it yet, holds nothing and says why, which keeps
 * every gate shut; a refusal also forgets the tier read before it, so no later
 * failure brings it back.
 */
export function hold(
  last: Read | null,
  org: string | null,
  read: { tier: Tier } | { wrong: unknown },
): { tier: Tier | null; wrong: unknown; last: Read | null } {
  if ('tier' in read) return { tier: read.tier, wrong: null, last: { org, tier: read.tier } }
  const mine = last && last.org === org ? last : null
  if (transient(read.wrong) && mine) return { tier: mine.tier, wrong: null, last: mine }
  return { tier: null, wrong: read.wrong, last: transient(read.wrong) ? last : null }
}

/**
 * The tier and the refusal held for `org`, and nothing for any other: what was
 * read for the organization a reader just left is never the one they are in,
 * so a switch from a paid organization to a team on Free shows no room while
 * the new one is read.
 */
export function standing(held: Held | null, org: string | null): { tier: Tier | null; wrong: unknown } {
  return held && held.org === org ? { tier: held.tier, wrong: held.wrong } : { tier: null, wrong: null }
}

/**
 * The tier, held. `null` while unknown — which is BOTH "still asking" and
 * "asked and was refused", so `wrong` is kept beside it rather than swallowed:
 * a row cannot choose between saying nothing and saying why without it. A
 * re-read that fails keeps the last tier read (`hold`).
 */
export function useTier(enabled = true, org: string | null = null): {
  tier: Tier | null
  wrong: unknown
  reload: () => void
} {
  const [held, setHeld] = useState<Held | null>(null)
  const [nonce, setNonce] = useState(0)
  const last = useRef<Read | null>(null)

  useEffect(() => {
    if (!enabled) return
    const stop = new AbortController()
    // Asking again: the refusal the last read gave is no longer the answer.
    setHeld((h) => (h && h.org === org ? { ...h, wrong: null } : h))
    const settle = (read: { tier: Tier } | { wrong: unknown }) => {
      if (stop.signal.aborted) return
      const next = hold(last.current, org, read)
      last.current = next.last
      setHeld({ org, tier: next.tier, wrong: next.wrong })
    }
    readTier(stop.signal).then(
      (got) => settle({ tier: got }),
      (e: unknown) => settle({ wrong: e }),
    )
    return () => stop.abort()
  }, [enabled, nonce, org])

  return { ...standing(held, org), reload: useCallback(() => setNonce((n) => n + 1), []) }
}

/**
 * Whether an organization is its owner's personal one, off IAM's own row.
 *
 * The token's `orgs` claim names an organization and the reader's role in it
 * and says nothing of its kind; IAM keeps that on the row (`isPersonal`), and
 * `GET /v1/iam/organizations` answers the rows the caller belongs to. `null`
 * until it is answered for this organization. A refusal reads as `false`, so a
 * room that needs a plan goes on asking for one.
 */
export function usePersonal(org: string | null, enabled = true): boolean | null {
  const [read, setRead] = useState<{ org: string; personal: boolean } | null>(null)

  useEffect(() => {
    if (!enabled || !org) return
    const stop = new AbortController()
    fetch(`${api()}/v1/iam/organizations?${new URLSearchParams({ q: org })}`, {
      headers: scope(),
      signal: stop.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { organizations?: unknown } | null) => {
        const row = list<{ name?: string; isPersonal?: boolean }>(body?.organizations).find((o) => o?.name === org)
        if (!stop.signal.aborted) setRead({ org, personal: Boolean(row?.isPersonal) })
      })
      .catch(() => {
        if (!stop.signal.aborted) setRead({ org, personal: false })
      })
    return () => stop.abort()
  }, [enabled, org])

  return read && read.org === org ? read.personal : null
}
