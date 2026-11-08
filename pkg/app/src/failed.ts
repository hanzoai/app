// The runs Home's Next card says failed: the ones that are still news. No React,
// so a spec reads it as it is.
//
// The card counted every run marked `error` among the org's last 100, with no
// window and a fan-out's sub-runs each counted on their own, so a failure stayed
// on the card ("14 failed", hanzo-inc/app#202) until a hundred newer runs pushed
// it off the page, however long ago it happened. A failure is news for the same
// 7 days the Recents menu calls "Past 7 days", and a tree is one run.

import type { Session } from '@hanzo/ai'

/** How long a failure stays on the card: the Recents menu's "Past 7 days". */
export const FRESH = 7 * 86_400_000

/** When a run stopped: its end, else its last activity, else its start. */
const when = (s: Session): number => Date.parse(s.endedAt || s.updatedAt || s.createdAt || '')

/** The top of a tree: no parent, and the root it names, if any, is itself. */
const top = (s: Session): boolean => !s.parentSessionId && (!s.rootSessionId || s.rootSessionId === s.id)

/**
 * The failed runs worth the card, newest first.
 *
 * Only a tree's root counts: a sub-run that failed under a root is the root's
 * business, and a root that failed is one failure however many of its sub-runs
 * failed with it. A run with no time on it is left out, since nothing says it
 * is recent.
 */
export function failed(sessions: readonly (Session | null | undefined)[], now: number = Date.now()): Session[] {
  return sessions
    .filter((s): s is Session => !!s && s.status === 'error' && top(s))
    .filter((s) => now - when(s) <= FRESH)
    .sort((a, b) => when(b) - when(a))
}
