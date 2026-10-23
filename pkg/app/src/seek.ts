// The palette's decisions (Palette.tsx draws them): which rows a query keeps,
// in what order, under which heading, and which key press opens it. No React,
// so a spec reads them as they are.

import { phrase } from '@hanzo/i18n'
import type { Press } from './chord'

/** A row the palette can list. */
export interface Hit {
  id: string
  label: string
  /** Other words it is found by: a project's slug and repository, a skill's description. */
  keywords?: string[]
  /** When it last changed, ISO: the newest lead Recent chats. */
  at?: string
}

export interface Group<T extends Hit = Hit> {
  id: string
  label: string
  items: T[]
}

/** The most rows one group shows for a query. */
export const CAP = 5
/** The rows Recent lists on an empty field. */
export const RECENT = 6

/** Whether `term`'s letters stand in `word` in order: "sttngs" in "settings". */
const spelled = (word: string, term: string): boolean => {
  let i = 0
  for (const c of word) if (c === term[i]) i++
  return i === term.length
}

/**
 * How well a row answers a query: 0 drops it, more ranks it higher. Every word
 * of the query must be found, in the label or the row's other words; each counts
 * most where the label starts with it, then where a word of the label does, then
 * anywhere in the label, then in the other words, then spelled out in order
 * within a word of the label (a typo's fuzz). The label read whole outranks
 * everything.
 */
export function fit(row: Hit, query: string): number {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return 1
  const label = row.label.toLowerCase()
  const words = label.split(/[^\p{L}\p{N}]+/u)
  const more = (row.keywords ?? []).join(' ').toLowerCase()
  let total = label === terms.join(' ') ? 10 : 0
  for (const t of terms) {
    const s = label.startsWith(t)
      ? 4
      : words.some((w) => w.startsWith(t))
        ? 3
        : label.includes(t)
          ? 2
          : more.includes(t)
            ? 1
            : t.length > 2 && words.some((w) => w[0] === t[0] && spelled(w, t))
              ? 0.5
              : 0
    if (!s) return 0
    total += s
  }
  return total
}

/** The rows a query keeps, best first, ties in the order they came, at most `cap`. */
export function rank<T extends Hit>(rows: T[], query: string, cap = CAP): T[] {
  return rows
    .map((row, i) => ({ row, i, score: fit(row, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, cap)
    .map((x) => x.row)
}

/**
 * What the palette lists. An empty field: the newest `RECENT` of `recent` under
 * Recent, then `idle` as it is. A query: every group of `all` cut to its best
 * `CAP`, a group with nothing left out, and the group with the best answer
 * first, ties in the order given.
 */
export function find<T extends Hit>(query: string, recent: T[], idle: Group<T>[], all: Group<T>[]): Group<T>[] {
  if (!query.trim()) {
    const newest = [...recent].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? '')).slice(0, RECENT)
    // Authored English, drawn through `t` where the palette draws it.
    return [{ id: 'recent', label: phrase('Recent'), items: newest }, ...idle].filter((g) => g.items.length)
  }
  return all
    .map((g) => ({ ...g, items: rank(g.items, query) }))
    .filter((g) => g.items.length)
    .map((g, i) => ({ g, i, best: fit(g.items[0], query) }))
    .sort((a, b) => b.best - a.best || a.i - b.i)
    .map((x) => x.g)
}

/** Whether a key press opens the palette: ⌘K or Ctrl+K, once a press, from anywhere, a field included. */
export const summons = (e: Press): boolean =>
  (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && !e.repeat && !e.isComposing && (e.key ?? '').toLowerCase() === 'k'
