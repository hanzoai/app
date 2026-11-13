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

export type MessagePart =
  | { kind: 'prose'; text: string }
  | { kind: 'doc'; name: string; size?: string; href?: string; ext: string }
  | { kind: 'image'; alt: string; src: string }

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)}MB`
  if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`
  return `${bytes}B`
}

const DOC_EXT = /\.(pdf|pptx?|docx?|xlsx?|csv|zip|md|json|txt)$/i

/** Splits a message into prose blocks, standalone document cards, and standalone preview images. */
export function partsOf(raw: string): MessagePart[] {
  const out: MessagePart[] = []
  const prose: string[] = []
  const flush = () => {
    const joined = prose.join('\n').trim()
    if (joined) out.push({ kind: 'prose', text: joined })
    prose.length = 0
  }

  const fenceRe = /^(`{3,})([^\n`]+\.[a-z0-9]{2,5})\n([\s\S]*?)\n\1$/gm
  let cursor = 0
  for (const match of raw.matchAll(fenceRe)) {
    const before = raw.slice(cursor, match.index ?? 0)
    parseLines(before, out, prose, flush)
    flush()
    const name = match[2].trim()
    const ext = (name.split('.').pop() ?? '').toLowerCase()
    out.push({ kind: 'doc', name, size: formatBytes(new TextEncoder().encode(match[3]).length), ext })
    cursor = (match.index ?? 0) + match[0].length
  }
  parseLines(raw.slice(cursor), out, prose, flush)
  flush()
  return out.length ? out : [{ kind: 'prose', text: raw }]
}

function parseLines(chunk: string, out: MessagePart[], prose: string[], flush: () => void) {
  for (const line of chunk.split('\n')) {
    const trimmed = line.trim()
    const img = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed)
    if (img) {
      flush()
      out.push({ kind: 'image', alt: img[1], src: img[2] })
      continue
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(trimmed)
    if (link) {
      const label = link[1].trim()
      const parts = label.split(/\s*[·•|]\s*/)
      const filePart = parts[0].trim()
      const extMatch = DOC_EXT.exec(filePart)
      if (extMatch) {
        flush()
        out.push({
          kind: 'doc',
          name: filePart,
          size: parts[1]?.trim(),
          href: link[2].trim(),
          ext: extMatch[1].toLowerCase(),
        })
        continue
      }
    }
    prose.push(line)
  }
}

