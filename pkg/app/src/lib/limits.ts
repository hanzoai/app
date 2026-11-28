'use client'

/**
 * The plan's usage, as @hanzo/ui holds it: `GET /v1/ai/limits` read as whoever
 * holds the bearer in this browser's organization, kept current by every AI
 * call `observed` (lib/served.ts) hands to `observe`. Shares only.
 *
 * Same base URL and headers as every billing read (lib/hanzo/tier.ts): the
 * bearer is the subject and `X-Org-Id` the organization this browser works in.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ways } from '@hanzo/dev/plan'
import { useLimits as useHeld, type UseLimits } from '@hanzo/ui/product/useLimits'
import {
  paidPlan,
  type ClassLimit,
  type LimitAction,
  type LimitClass,
  type LimitNotice,
  type Limits,
  type LimitState,
  type LimitWindow,
} from '@hanzo/ui/product/limits'
import { english, format, type Format, type Say } from '@hanzo/i18n'
import { api } from './api'
import { payUrl } from './pay'
import { org, scope } from './session'

/** Free weekly usage reset allowance reported by `GET /v1/ai/limits`. */
export interface LimitResetAllowance {
  available: boolean
  used?: number
  limit?: number
  next_at?: string | null
  resets_at?: string | null
  last_at?: string | null
}

/** Class limit extended with `unbounded` (e.g. `enterprise` / `unlimited` Hanzo models). */
export interface ExtendedClassLimit extends ClassLimit {
  unbounded?: boolean
}

/** Limits extended with top-level `session`, `day`, `reset`, and per-class `unbounded`. */
export interface ExtendedLimits extends Omit<Limits, 'session' | 'day' | 'reset'> {
  classes: Partial<Record<LimitClass, ExtendedClassLimit>>
  session?: LimitWindow | null
  day?: LimitWindow | null
  reset?: LimitResetAllowance | null
}

/** `UseLimits` carrying the extended fields parsed from the raw `/v1/ai/limits` body. */
export interface UseExtendedLimits extends Omit<UseLimits, 'limits'> {
  limits: ExtendedLimits | null
}

const LIMIT_STATES: readonly LimitState[] = ['ok', 'near', 'limited']

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function asPercent(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : null
}

function asState(v: unknown): LimitState | null {
  return typeof v === 'string' && (LIMIT_STATES as readonly string[]).includes(v) ? (v as LimitState) : null
}

function asText(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

function parseWindow(v: unknown): LimitWindow | null {
  const o = asRecord(v)
  const percent = asPercent(o?.percent)
  if (percent === null) return null
  return {
    percent,
    state: asState(o?.state) ?? (percent >= 80 ? 'near' : 'ok'),
    resets_at: asText(o?.resets_at),
  }
}

function parseReset(v: unknown): LimitResetAllowance | null {
  const o = asRecord(v)
  if (!o) return null
  const available =
    typeof o.available === 'boolean'
      ? o.available
      : typeof o.remaining === 'number'
        ? o.remaining > 0
        : typeof o.limit === 'number' && typeof o.used === 'number'
          ? o.used < o.limit
          : false
  return {
    available,
    ...(typeof o.used === 'number' ? { used: o.used } : {}),
    ...(typeof o.limit === 'number' ? { limit: o.limit } : {}),
    ...(o.next_at !== undefined ? { next_at: asText(o.next_at) } : {}),
    ...(o.resets_at !== undefined ? { resets_at: asText(o.resets_at) } : {}),
    ...(o.last_at !== undefined ? { last_at: asText(o.last_at) } : {}),
  }
}

/**
 * Preserves top-level `session`, `day`, `reset`, and per-class `unbounded` fields from the raw
 * `GET /v1/ai/limits` response alongside `@hanzo/ui`'s parsed `Limits`.
 */
export function enrichLimits(parsed: Limits | null, raw: unknown): ExtendedLimits | null {
  if (!parsed) return null
  const o = asRecord(raw)
  const rawClasses = asRecord(o?.classes)
  const classes: Partial<Record<LimitClass, ExtendedClassLimit>> = {}
  for (const key of ['ours', 'premium', 'free'] as const) {
    const base = parsed.classes[key]
    const rawClass = asRecord(rawClasses?.[key])
    const isUnbounded = rawClass?.unbounded === true || (key === 'ours' && parsed.plan === 'unlimited')
    if (base) {
      classes[key] = isUnbounded ? { ...base, unbounded: true } : { ...base }
    } else if (isUnbounded) {
      classes[key] = {
        percent: 0,
        state: 'ok',
        resets_at: asText(rawClass?.resets_at),
        paying: 'plan',
        unbounded: true,
      }
    }
  }
  const session = parseWindow(o?.session)
  const day = parseWindow(o?.day)
  const reset = parseReset(o?.reset)
  return {
    ...parsed,
    classes,
    ...(session ? { session } : {}),
    ...(day ? { day } : {}),
    ...(reset ? { reset } : {}),
  }
}

/** Reads the limits as whoever holds the bearer, in this browser's organization. */
export async function readLimits(signal: AbortSignal): Promise<unknown> {
  const res = await fetch(`${api()}/v1/ai/limits`, { headers: scope(), signal })
  if (!res.ok) throw Object.assign(new Error(`Limits answered ${res.status}`), { status: res.status })
  return res.json()
}

/**
 * Claims the organization's 1×/week free usage reset (`POST /v1/ai/limits/reset`).
 * Throws with the server's message if unavailable or refused.
 */
export async function resetUsageLimits(): Promise<unknown> {
  const res = await fetch(`${api()}/v1/ai/limits/reset`, {
    method: 'POST',
    headers: { ...scope(), 'Content-Type': 'application/json' },
  })
  if (res.ok) return res.json().catch(() => null)
  const body = (await res.json().catch(() => null)) as { error?: { message?: unknown } | string; message?: unknown } | null
  const said =
    typeof body?.error === 'string'
      ? body.error
      : typeof body?.error?.message === 'string'
        ? body.error.message
        : typeof body?.message === 'string'
          ? body.message
          : ''
  throw Object.assign(new Error(said || `Usage reset answered ${res.status}`), { status: res.status })
}

/**
 * The org's choice to keep paying from credits once included usage runs out —
 * `PUT /v1/ai/limits`, org admins only. A refusal throws with the server's own
 * words, so the reader is told why.
 */
export async function setCreditsAfterAllowance(on: boolean): Promise<void> {
  const res = await fetch(`${api()}/v1/ai/limits`, {
    method: 'PUT',
    headers: { ...scope(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ creditsAfterAllowance: on }),
  })
  if (res.ok) return
  const body = (await res.json().catch(() => null)) as { error?: { message?: unknown } | string; message?: unknown } | null
  const said = typeof body?.error === 'string' ? body.error : typeof body?.error?.message === 'string' ? body.error.message : typeof body?.message === 'string' ? body.message : ''
  throw Object.assign(new Error(said || (res.status === 403 ? 'Only an organization admin can turn on credits.' : `Credits answered ${res.status}`)), { status: res.status })
}

/**
 * The limits for a signed-in reader, in organization `org`; `name` turns a
 * fallback model id into the name the reader knows. Signed out reads nothing,
 * and still hears a refusal from a served call.
 */
export function useLimits(enabled = true, orgId: string | null = null, name?: (id: string) => string): UseExtendedLimits {
  const rawRef = useRef<{ org: string | null; body: unknown }>({ org: orgId, body: null })
  useEffect(() => {
    if (rawRef.current.org !== orgId) {
      rawRef.current = { org: orgId, body: null }
    }
  }, [orgId])
  const read = useCallback(
    async (signal: AbortSignal) => {
      const body = await readLimits(signal)
      rawRef.current = { org: orgId, body }
      return body
    },
    [orgId],
  )
  const held = useHeld(enabled ? read : null, orgId, name)
  const enriched = useMemo(
    () => enrichLimits(held.limits, rawRef.current.org === orgId ? rawRef.current.body : null),
    [held.limits, orgId],
  )
  return useMemo(() => ({ ...held, limits: enriched }), [held, enriched])
}

/**
 * Whether a reader's dollar spend may be shown: their limits came back and name no
 * paid plan, or could not be read. A plan holder sees usage as shares, never money.
 */
export const spendShown = ({ limits, answered }: Pick<UseLimits | UseExtendedLimits, 'limits' | 'answered'>): boolean =>
  answered && !paidPlan(limits)

export { paidPlan }

/**
 * Whether the plan has no caps: Unlimited, with no windows and no included-usage
 * limit. Its id, compared as `paidPlan` compares it. Ultra has Go's windows x25,
 * so it is capped like any paid plan.
 */
export const uncapped = (l: Pick<Limits, 'plan'> | null | undefined): boolean => l?.plan === 'unlimited'

/** An instant as the server writes one: RFC 3339, with its offset. Anything else names no instant. */
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i

/**
 * When a spent allowance comes back, on the reader's own clock, or null when the
 * server names no instant still ahead (none, one not RFC 3339, or one passed).
 * `date` is '' when that is today where the reader is, and carries the year only
 * when it is not this year. `time` is null at midnight, which is said as the
 * word, never as 0:00, 00:00 or 12:00 AM; a midnight's date is the day it ends,
 * so tonight's is today. `f` writes both (@hanzo/i18n `format`: the reader's
 * locale, set apart in right-to-left prose), in `zone`, the browser's own unless
 * a caller names one.
 */
export function resets(iso: string | null, now: number, f: Format, zone?: string): { date: string; time: string | null } | null {
  const at = iso && INSTANT.test(iso) ? Date.parse(iso) : NaN
  if (!(at > now)) return null
  const midnight = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(at) === '00:00'
  const ends = midnight ? at - 1 : at
  const part = (instant: number, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, ...o }).format(instant)
  const today = part(ends, { year: 'numeric', month: '2-digit', day: '2-digit' }) === part(now, { year: 'numeric', month: '2-digit', day: '2-digit' })
  const year = part(ends, { year: 'numeric' }) !== part(now, { year: 'numeric' })
  return {
    date: today ? '' : f.date(ends, { timeZone: zone, month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) }),
    time: midnight ? null : f.date(at, { timeZone: zone, hour: 'numeric', minute: '2-digit' }),
  }
}

/** "Usage reached." and, when the server names one still ahead, when it comes back. */
function reached(back: ReturnType<typeof resets>, t: Say): string {
  if (!back) return t('Usage reached.')
  if (back.date) return back.time ? t('Usage reached. Resets {date} at {time}.', { date: back.date, time: back.time }) : t('Usage reached. Resets {date} at midnight.', { date: back.date })
  return back.time ? t('Usage reached. Resets at {time}.', { time: back.time }) : t('Usage reached. Resets at midnight.')
}

/**
 * The refusals that are usage spent until a reset: a paid plan's included
 * usage, its request window, the Free plan's cap and its allowance's window.
 */
const SPENT = new Set(['plan_allowance_used', 'usage_cap_exceeded', 'free_plan_cap', 'allowance_spent'])

/** Whether a refusal's code is usage spent until a reset, which is said in our words and never the server's. */
export const spends = (code: string): boolean => SPENT.has(code)

/**
 * What the banner over the composer says once the reader is turned away, and
 * the ways on, or null when it says nothing. Usage spent until a reset reads
 * `Usage reached. Resets at 5:00 PM.` (`resets`: the reader's clock, never a
 * ceiling), with three ways: the upgrade (the server's own, else pay's plans),
 * credits (the server's Continue with credits where the org holds some, else
 * pay's amount step to add some), both for this browser's organization and
 * coming back here, and Try again later, which the host takes as putting the
 * banner away. Until the plan is read (`limits` null) there is no upgrade: the
 * plan could be Unlimited. Unlimited has no allowance to spend, so what turns it
 * away is an empty balance, said as that, and its one way on is credits. Any other
 * refusal is the server's own words and ways (@hanzo/build `ways`). Everything
 * said goes through `t`, and the time through `f`.
 */
export function paused(
  n: LimitNotice,
  limits: Pick<Limits, 'plan'> | null,
  name: (id: string) => string = (id) => id,
  now: number = Date.now(),
  t: Say = english,
  f: Format = format('en-US'),
): { message: string; actions: LimitAction[] } | null {
  if (!SPENT.has(n.reason) && !n.refused && n.fallback) return null
  const on = n.fallback ? t(' You’re chatting on {model}.', { model: name(n.fallback) }) : ''
  if (!SPENT.has(n.reason) && (n.reason || n.classes.length === 0)) return { message: n.message, actions: ways(n.actions, t) }
  const here = typeof window === 'undefined' ? undefined : window.location.href
  const topup: LimitAction = { kind: 'topup', label: t('Add credits'), url: payUrl('/amount/card', { org: org(), returnUrl: here }) }
  if (uncapped(limits)) return { message: t('Your balance is empty.') + on, actions: [topup] }
  const credits = n.actions.find((a) => a.kind === 'credits')
  const way = credits ? { ...credits, label: t('Continue with credits') } : topup
  const later: LimitAction = { kind: 'later', label: t('Try again later') }
  const message = reached(resets(n.resets_at, now, f), t) + on
  if (!limits) return { message, actions: [way, later] }
  const upgrade = n.actions.find((a) => a.kind === 'upgrade')
  return {
    message,
    actions: [{ kind: 'upgrade', label: t('Upgrade to continue'), url: upgrade?.url ?? payUrl('/cart', { org: org(), returnUrl: here }) }, way, later],
  }
}

/** Whether a catalog family is one of Hanzo's chat families, Enso or Zen, whose turns carry the live web. */
export const house = (family: string | undefined): boolean => family === 'enso' || family === 'zen'

/**
 * Whether a model writes replies: it names text among its outputs (or names none), and its
 * endpoint is not the decisions endpoint. `zen-scribe` (a transcript), `zen-voice-mini`
 * (audio) and the Kai decision models (`outputs: ["decision"]`, `/v1/decisions`) are listed
 * by the catalog and none answers a question; decision models stay usable inside the product
 * (gate scoring, routing), they are just never the model that writes the reply. One predicate
 * for the picker, the default and the fallback.
 */
export const chats = (model: { id: string; outputs?: unknown; endpoint?: unknown }): boolean =>
  model.endpoint !== '/v1/decisions' && (!Array.isArray(model.outputs) || model.outputs.includes('text'))
