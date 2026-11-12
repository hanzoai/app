// Which bots are faces in the grid and which are rows, and what a row says.
// Pure, so the roster's order is tested as data.

import type { Agent, AgentRun } from '@hanzo/ai'
import { instant } from './time'

/** How many bots the grid holds before the rest become rows. */
export const GRID = 12

/** What a row says under a bot's name: its newest run's last word. */
export function lastWord(run: AgentRun | undefined): string {
  if (!run) return ''
  return (run.output || run.error || run.input || '').replace(/\s+/g, ' ').trim()
}

/** The bots in the grid and the bots in rows. */
export function split(bots: readonly Agent[], last: ReadonlyMap<string, AgentRun>): { grid: Agent[]; rows: Agent[] } {
  const made = [...bots].sort((a, b) => (instant(a.createdAt) ?? 0) - (instant(b.createdAt) ?? 0))
  const grid = made.slice(0, GRID)
  const rows = made
    .slice(GRID)
    .sort((a, b) => (instant(last.get(b.name)?.createdAt) ?? 0) - (instant(last.get(a.name)?.createdAt) ?? 0))
  return { grid, rows }
}

