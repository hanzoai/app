/**
 * Why a question has no answer, as the chat says it: the person stopped it, the model sent
 * nothing until the turn was ended, it answered with nothing, or it was refused. One place
 * decides, so Stop is never told as the model's silence.
 */

/** What an unanswered question met. */
export interface Failed {
  error: Error | null
  empty?: boolean
  stalled?: boolean
  /** The person pressed Stop before a word came: theirs to ask again, never the model's fault. */
  stopped?: boolean
}

/** What a turn that just ended left its question, or null when it answered (or is still answering). */
export function ended(turn: { was: boolean; streaming: boolean; error: Error | null; blank: boolean; stopping: boolean }): Failed | null {
  if (!turn.was || turn.streaming || turn.error || !turn.blank) return null
  return turn.stopping ? { error: null, stopped: true } : { error: null, empty: true }
}

/** Which sentence the chat says for an unanswered question. */
export function why(failed: Failed | undefined): 'gone' | 'stopped' | 'stalled' | 'empty' | 'refused' {
  if (!failed) return 'gone'
  if (failed.stopped) return 'stopped'
  if (failed.stalled) return 'stalled'
  if (failed.empty) return 'empty'
  return 'refused'
}
