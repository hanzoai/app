import type { Say } from '@hanzo/i18n'
import type { SessionEvent } from '@hanzo/ai'

/** What a finished run said and what it cost, read from its recorded turns. */
export interface Result {
  text: string
  error: string
  meta: string
}

/** A turn's payload as an object; the platform stores it as JSON text. */
function body(e: SessionEvent): Record<string, unknown> {
  let p: unknown = e.payload
  if (typeof p === 'string') {
    try {
      p = JSON.parse(p)
    } catch {
      return { text: p }
    }
  }
  return p && typeof p === 'object' ? (p as Record<string, unknown>) : {}
}

export function resultOf(events: SessionEvent[], t: Say): Result | null {
  const ordered = [...events].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
  const message = [...ordered].reverse().find((e) => e.kind === 'message')
  const log = [...ordered].reverse().find((e) => e.kind === 'log')
  const m = message ? body(message) : {}
  const l = log ? body(log) : {}
  const ms = typeof l.durationMs === 'number' ? l.durationMs : 0
  const meta = [
    typeof l.model === 'string' ? l.model : '',
    ms ? t('{seconds}s', { seconds: (ms / 1000).toFixed(1) }) : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const text = typeof m.text === 'string' ? m.text : ''
  const error = typeof l.error === 'string' ? l.error : ''
  return text || error || meta ? { text, error, meta } : null
}

