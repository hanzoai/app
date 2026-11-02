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
import { paidPlan, type LimitAction, type LimitNotice, type Limits } from '@hanzo/ui/product/limits'
import { english, format, type Format, type Say } from '@hanzo/i18n'
import { api } from './api'
import { payUrl } from './pay'
import { org, scope } from './session'

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

/** Whether the plan is Ultra: its id, compared as `paidPlan` compares it. */
export const ultra = (l: Pick<Limits, 'plan'> | null | undefined): boolean => l?.plan === 'ultra'

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
 * plan could be Ultra. Ultra has no allowance to spend, so what turns it away is
 * an empty balance, said as that, and its one way on is credits. Any other
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
  const on = n.fallback ? t(' You’re chatting on {model}.', { model: name(n.fallback) }) : ''
  if (!SPENT.has(n.reason) && (n.reason || n.classes.length === 0)) return { message: n.message, actions: ways(n.actions, t) }
  const here = typeof window === 'undefined' ? undefined : window.location.href
  const topup: LimitAction = { kind: 'topup', label: t('Add credits'), url: payUrl('/amount/card', { org: org(), returnUrl: here }) }
  if (ultra(limits)) return { message: t('Your balance is empty.') + on, actions: [topup] }
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
 * Whether a model can answer a chat turn: it names no outputs, or names text
 * among them. `zen-scribe` (a transcript) and `zen-voice-mini` (audio) are
 * Zen ids the catalog lists, and neither answers a question.
 */
export const chats = (model: { id: string; outputs?: unknown }): boolean =>
  !Array.isArray(model.outputs) || model.outputs.includes('text')
