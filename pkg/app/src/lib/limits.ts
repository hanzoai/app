'use client'

/**
 * The plan's usage, as @hanzo/ui holds it: `GET /v1/ai/limits` read as whoever
 * holds the bearer in this browser's organization, kept current by every AI
 * call `observed` (lib/served.ts) hands to `observe`. Shares only.
 *
 * Same base URL and headers as every billing read (lib/hanzo/tier.ts): the
 * bearer is the subject and `X-Org-Id` the organization this browser works in.
 */

import { ways } from '@hanzo/build/plan'
import { useLimits as useHeld, type UseLimits } from '@hanzo/ui/product/useLimits'
import { paidPlan, type LimitAction, type LimitNotice } from '@hanzo/ui/product/limits'
import { english, type Say } from '@hanzo/i18n'
import { api } from './api'
import { payUrl } from './pay'
import { scope } from './session'

/** Reads the limits as whoever holds the bearer, in this browser's organization. */
export async function readLimits(signal: AbortSignal): Promise<unknown> {
  const res = await fetch(`${api()}/v1/ai/limits`, { headers: scope(), signal })
  if (!res.ok) throw Object.assign(new Error(`Limits answered ${res.status}`), { status: res.status })
  return res.json()
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
export const useLimits = (enabled = true, org: string | null = null, name?: (id: string) => string): UseLimits =>
  useHeld(enabled ? readLimits : null, org, name)

/**
 * Whether a reader's dollar spend may be shown: their limits came back and name no
 * paid plan, or could not be read. A plan holder sees usage as shares, never money.
 */
export const spendShown = ({ limits, answered }: Pick<UseLimits, 'limits' | 'answered'>): boolean =>
  answered && !paidPlan(limits)

export { paidPlan }

/**
 * When a spent allowance or window comes back, on the reader's own clock: the
 * time alone when that is today where the reader is ("5:00 PM"), else the date
 * with it ("Nov 3, 5:00 PM"). Never UTC's: the server sends an instant
 * (`resets_at`, RFC 3339) and the words are the reader's. `zone` is the
 * browser's own unless a caller names one; '' for no instant.
 */
export function resets(iso: string, now: number = Date.now(), locale?: string, zone?: string): string {
  const at = iso ? Date.parse(iso) : NaN
  if (Number.isNaN(at)) return ''
  const day = (instant: number) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
  const time: Intl.DateTimeFormatOptions = { timeZone: zone, hour: 'numeric', minute: '2-digit' }
  return new Intl.DateTimeFormat(locale, day(at) === day(now) ? time : { ...time, month: 'short', day: 'numeric' }).format(at)
}

/**
 * The refusals that are usage spent until a reset: a paid plan's included
 * usage, its request window, the Free plan's cap and its allowance's window.
 * The windows are what Ultra has none of (`WINDOWS`).
 */
const SPENT = new Set(['plan_allowance_used', 'usage_cap_exceeded', 'free_plan_cap', 'allowance_spent'])
const WINDOWS = new Set(['usage_cap_exceeded', 'free_plan_cap', 'allowance_spent'])

/**
 * What the banner over the composer says once the reader is turned away, and
 * the ways on, or null when it says nothing. Usage spent until a reset reads
 * `Usage reached. Resets at 5:00 PM.` (`resets`: the
 * reader's clock, never a ceiling), with three ways: the upgrade (the server's
 * own, else pay's plans, coming back here), credits (the server's Continue with
 * credits where the org holds some, else pay's amount step to add some, coming
 * back here), and Try again later, which the host takes as putting the banner
 * away. An Ultra reader is never told of a spent window: Ultra has none. Any
 * other refusal is the server's own words and ways (@hanzo/build `ways`).
 * Everything said goes through `t`.
 */
export function paused(
  n: LimitNotice,
  plan: string,
  name: (id: string) => string = (id) => id,
  now: number = Date.now(),
  t: Say = english,
): { message: string; actions: LimitAction[] } | null {
  const on = n.fallback ? t(' You’re chatting on {model}.', { model: name(n.fallback) }) : ''
  if (!SPENT.has(n.reason) && (n.reason || n.classes.length === 0)) return { message: n.message, actions: ways(n.actions, t) }
  if (WINDOWS.has(n.reason) && /^ultra\b/i.test(plan)) return null
  const time = resets(n.resets_at ?? '', now)
  const message = (time ? t('Usage reached. Resets at {time}.', { time }) : t('Usage reached.')) + on
  const here = typeof window === 'undefined' ? undefined : window.location.href
  const upgrade = n.actions.find((a) => a.kind === 'upgrade')
  const credits = n.actions.find((a) => a.kind === 'credits')
  return {
    message,
    actions: [
      { kind: 'upgrade', label: t('Upgrade to continue'), url: upgrade?.url ?? payUrl('/cart', { returnUrl: here }) },
      credits ?? { kind: 'topup', label: t('Add credits'), url: payUrl('/amount/card', { returnUrl: here }) },
      { kind: 'later', label: t('Try again later') },
    ],
  }
}

/** Whether a catalog family is one of Hanzo's chat families, Enso or Zen, whose turns carry the live web. */
export const house = (family: string | undefined): boolean => family === 'enso' || family === 'zen'

/**
 * Whether a model can answer a chat turn: it names no outputs, or names text
 * among them. `zen-scribe` (a transcript) and `zen-voice-mini` (audio) are
 * Zen ids the catalog lists, and neither answers a question.
 */
export const chats = (model: { id: string; outputs?: unknown }): boolean =>
  !Array.isArray(model.outputs) || model.outputs.includes('text')
