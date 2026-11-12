// A refusal about money, read from what the platform answered.

import { english, type Say } from '@hanzo/i18n'
import type { LimitAction } from '@hanzo/ui/product/limits'
import { billed, ours, say } from '../failure'

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

type Body = { code?: unknown; message?: unknown; resets_at?: unknown; billingUrl?: unknown }

/**
 * A refusal about money, as a notice: the gateway's billing envelope (its
 * message, when it lifts, its ways past), the bot's own weekly budget spent, or
 * the run's 402 for an org with no balance with the credits page it names (when
 * that page is one of ours). Any other failure is not a notice.
 */
export function refusal(e: unknown, name: string, now: number, t: Say = english): Notice | null {
  const no = billed(e)
  if (no) return { message: no.message || say(e, t('your message to {name}', { name }), 'save', t), resets: no.resets_at, actions: no.actions }
  const status = (e as { status?: unknown } | null)?.status
  if (status !== 402 && status !== 429) return null
  const raw = (e as { body?: { error?: unknown; code?: unknown } } | null)?.body
  const body: Body = raw && typeof raw.error === 'object' && raw.error ? (raw.error as Body) : (raw as Body) ?? {}
  if (body.code === BUDGET) {
    return { message: t('{name} has spent this week’s budget.', { name }), resets: nextWeek(now), actions: [] }
  }
  const url = ours(body.billingUrl)
  return {
    message: typeof body.message === 'string' && body.message ? body.message : say(e, t('your message to {name}', { name }), 'save', t),
    resets: typeof body.resets_at === 'string' ? body.resets_at : null,
    actions: url ? [{ kind: 'topup', label: t('Add credits'), url }] : [],
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
