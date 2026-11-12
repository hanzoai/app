// A refusal about money, read from what the platform answered.

import { billed } from '../failure'
import type { LimitAction } from '@hanzo/ui/product/limits'

/** A refusal the platform gave before a run: what it said, when it lifts, the ways past it. */
export interface Notice {
  message: string
  resets: string | null
  actions: readonly LimitAction[]
}

/**
 * A refusal about money, as a notice: the platform's billing envelope (its
 * message, when it lifts, its ways past), or the run's own 402/429 with the
 * address it names for credits. Any other failure is not a notice.
 */
export function refusal(e: unknown, t: (s: string) => string): Notice | null {
  const no = billed(e)
  if (no) return { message: no.message, resets: no.resets_at, actions: no.actions }
  const status = (e as { status?: unknown } | null)?.status
  if (status !== 402 && status !== 429) return null
  const body = (e as { body?: { error?: { message?: unknown; resets_at?: unknown; billingUrl?: unknown } } }).body?.error
  const message = typeof body?.message === 'string' && body.message ? body.message : e instanceof Error ? e.message : ''
  const url = typeof body?.billingUrl === 'string' ? body.billingUrl : ''
  return {
    message,
    resets: typeof body?.resets_at === 'string' ? body.resets_at : null,
    actions: url ? [{ kind: 'topup', label: t('Add credits'), url }] : [],
  }
}

