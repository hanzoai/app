// The thread as lines: what each recorded run said, stamped where the
// conversation paused. Pure, so the order a reader sees is tested as data.

import type { Agent, AgentRun } from '@hanzo/ai'
import { BREAK, instant, stamp } from './time'

/** A message that went out and has not come back yet. */
export interface Pending {
  input: string
  at: number
}

/** One line of the thread, in the order it happened. */
export type Line =
  | { kind: 'stamp'; key: string; text: string }
  | { kind: 'from'; key: string; bot: Agent }
  | { kind: 'mine'; key: string; text: string }
  | { kind: 'theirs'; key: string; text: string; failed?: boolean }
  | { kind: 'other'; key: string; text: string }
  | { kind: 'thinking'; key: string }

/** The bot a run's actor names, when another bot asked for it. */
function asker(run: AgentRun, bots: readonly Agent[], self: string): Agent | undefined {
  const who = run.actor?.split('/').pop()
  if (!who) return undefined
  return bots.find((b) => b.name !== self && (b.name === who || b.id === who || b.serviceAccountId === who))
}

/** The thread as lines: stamps where it paused, each run as the messages it holds. */
export function lines(
  runs: readonly AgentRun[],
  bots: readonly Agent[],
  self: string,
  pending: Pending | null,
  now: number,
  locale: string,
  t: (s: string, v?: Record<string, unknown>) => string,
): Line[] {
  const out: Line[] = []
  let prev: number | null = null
  const mark = (at: number, key: string) => {
    if (prev === null || at - prev > BREAK) out.push({ kind: 'stamp', key: `s-${key}`, text: stamp(at, now, locale, t) })
    prev = at
  }
  for (const r of runs) {
    const at = instant(r.createdAt) ?? now
    mark(at, r.id)
    // A run another bot asked for opens with that bot's words, marked as its
    // message; any other run's input is yours.
    const from = asker(r, bots, self)
    if (from) {
      out.push({ kind: 'from', key: `f-${r.id}`, bot: from })
      if (r.input) out.push({ kind: 'other', key: `i-${r.id}`, text: r.input })
    } else if (r.input) out.push({ kind: 'mine', key: `i-${r.id}`, text: r.input })
    const said = r.output || r.error
    if (said) out.push({ kind: 'theirs', key: `o-${r.id}`, text: said, failed: !r.output && Boolean(r.error) })
  }
  if (pending) {
    mark(pending.at, 'pending')
    out.push({ kind: 'mine', key: 'pending', text: pending.input })
    out.push({ kind: 'thinking', key: 'thinking' })
  }
  return out
}

