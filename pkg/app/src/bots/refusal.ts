// A refusal about money, read from what the platform answered.

import { english, type Say } from '@hanzo/i18n'
import type { LimitAction } from '@hanzo/ui/product/limits'
import { billed, ours, say } from '../failure'
import { payUrl } from '../lib/pay'
import { org } from '../lib/session'

/** A refusal the platform gave before a run: what it said, when it lifts, the ways past it. */
export interface Notice {
  message: string
  resets: string | null
  actions: readonly LimitAction[]
}

/** The agents route's code for a bot whose own period cap is spent (apps/agents budget.go). */
const BUDGET = 'budget_exceeded'

/** Monday 00:00 UTC after `now`: a weekly cap's period is the calendar week in UTC. */
export function nextWeek(now: number): string {
  const d = new Date(now)
  const day = d.getUTCDay() // 0 Sunday … 6 Saturday
  const ahead = ((8 - day) % 7) || 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + ahead)).toISOString()
}

/** When a cap's period after `now` begins: calendar-aligned in UTC, as the platform counts it. */
export function nextPeriod(now: number, period = 'week'): string {
  const d = new Date(now)
  if (period === 'day') return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)).toISOString()
  if (period === 'month') return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString()
  return nextWeek(now)
}

type Body = { code?: unknown; reason?: unknown; message?: unknown; resets_at?: unknown; billingUrl?: unknown }

/**
 * The refusals money clears (cloud sdk/errmap.go `funded`): no balance, no
 * subscription with no credit, and a spent Free-plan allowance. The platform
 * says each with its console's credits page in the sentence and as
 * `billingUrl`; a reader is told in the app's own words instead, with the one
 * way past it, adding credit.
 */
const EMPTY = new Set(['insufficient_balance', 'payment_required'])
const SPENT = 'allowance_spent'

/**
 * Where a reader adds credit: pay's amount step, for this browser's
 * organization, coming back to this page — the address every other Add credits
 * in the app opens (lib/limits.ts), and never the console page the platform
 * names. Read at the moment of the refusal, since the organization moves with
 * the switcher.
 */
export function topup(t: Say = english): LimitAction {
  const here = typeof window === 'undefined' ? undefined : window.location.href
  return { kind: 'topup', label: t('Add credits'), url: payUrl('/amount/card', { org: org(), returnUrl: here }) }
}

/**
 * Hanzo's console, as a reader reaches it: platform.hanzo.ai. The platform
 * names console.hanzo.ai in the pages its refusals send a person to, in the
 * sentence and as `billingUrl`; both are read with the host a reader knows.
 */
const platform = (s: string): string => s.replace(/https:\/\/console\.hanzo\.ai(?=[/?#\s.,;)]|$)/g, 'https://platform.hanzo.ai')

/** What an out-of-money refusal says, and its way past, or null for any other code. */
function broke(code: unknown, reason: unknown, resets: string | null, t: Say): Notice | null {
  // An unresolved 402 is billing that could not be checked, not money missing: its cure is a retry.
  if (typeof code !== 'string' || reason === 'unresolved') return null
  if (EMPTY.has(code)) return { message: t('Your balance is empty.'), resets: null, actions: [topup(t)] }
  if (code === SPENT) return { message: t('Usage reached.'), resets, actions: [topup(t)] }
  return null
}

/**
 * A refusal about money, as a notice: no money (an empty balance, no plan and
 * no credit, a spent Free allowance) in the app's words with pay's Add credits,
 * the gateway's billing envelope (its message, when it lifts, its ways past,
 * any top-up among them sent to pay), or the bot's own weekly budget spent.
 * Any other failure is not a notice.
 */
export function refusal(e: unknown, name: string, now: number, t: Say = english, period = 'week'): Notice | null {
  const no = billed(e)
  // The gateway's envelope keeps its own words and ways, save an empty balance
  // (whose sentence names the console) and a top-up, which is pay's.
  if (no)
    return EMPTY.has(no.code)
      ? broke(no.code, undefined, no.resets_at, t)
      : {
          message: no.message ? platform(no.message) : say(e, t('your message to {name}', { name }), 'save', t),
          resets: no.resets_at,
          actions: no.actions.map((a) => (a.kind === 'topup' ? { ...a, url: topup(t).url } : a)),
        }
  const status = (e as { status?: unknown } | null)?.status
  if (status !== 402 && status !== 429) return null
  const raw = (e as { body?: { error?: unknown; code?: unknown } } | null)?.body
  const body: Body = raw && typeof raw.error === 'object' && raw.error ? (raw.error as Body) : (raw as Body) ?? {}
  const resets = typeof body.resets_at === 'string' ? body.resets_at : null
  const money = broke(body.code, body.reason, resets, t)
  if (money) return money
  if (body.code === BUDGET) {
    const spent =
      period === 'day'
        ? t('{name} has spent today’s budget.', { name })
        : period === 'month'
          ? t('{name} has spent this month’s budget.', { name })
          : t('{name} has spent this week’s budget.', { name })
    return { message: spent, resets: nextPeriod(now, period), actions: [] }
  }
  // Any other refusal is the platform's own words, and the console page it names
  // (a spend cap's budgets) is offered as what it is, never as Add credits.
  const url = ours(body.billingUrl)
  return {
    message: typeof body.message === 'string' && body.message ? platform(body.message) : say(e, t('your message to {name}', { name }), 'save', t),
    resets,
    actions: url ? [{ kind: 'upgrade', label: body.code === 'spend_cap_exceeded' ? t('Raise the spend cap') : t('Open billing'), url: platform(url) }] : [],
  }
}

/**
 * The run a 502 carries: the agents route answers a run that reached its model
 * and failed with the recorded run as the body. A 502 from anything in front of
 * it carries no run, and nothing was recorded.
 */
export function recordedRun<T extends { id: string; status: string }>(e: unknown): T | null {
  if ((e as { status?: unknown } | null)?.status !== 502) return null
  const body = (e as { body?: unknown }).body as Partial<T> | undefined
  return body && typeof body.id === 'string' && typeof body.status === 'string' ? (body as T) : null
}
