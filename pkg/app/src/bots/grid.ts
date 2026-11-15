// Which bots are faces in the grid and which are rows, how Bot Groups sort across
// layers, and how coordination policies describe themselves. Pure, so the roster's
// order is tested as data.

import type { Agent, AgentRun } from '@hanzo/ai'
import { member } from '../team'
import type { BotAgent, BotGroup, GroupPolicy } from './api'
import { PRIMARY_BOT } from './api'
import { instant } from './time'

/** How many bots the grid holds before the rest become rows. */
export const GRID = 12

const LEAD_ORDER = new Map(
  ['vi', 'opera', 'mana', 'dev', 'des', 'fin', 'huma', 'mark', 'sal', 'sci', 'su', 'cyber'].map((id, i) => [id, i]),
)

function rankOf(bot: Agent): number {
  const ext = bot as BotAgent
  if (ext.isPrimary) return -2
  const lower = bot.name.toLowerCase()
  if (lower === PRIMARY_BOT) return -1
  const lead = LEAD_ORDER.get(lower)
  if (lead !== undefined) return lead
  const seat = member(bot.name)?.seat
  return seat !== undefined ? 100 + seat : Number.MAX_SAFE_INTEGER
}

/** Whether a bot wears the Primary / Lead star badge in the roster grid. */
export function isStarredBot(bot: Agent): boolean {
  const ext = bot as BotAgent
  if (ext.isPrimary || bot.name.toLowerCase() === PRIMARY_BOT) return true
  return member(bot.name)?.seat === 1
}

/** What a row says under a bot's name: its newest run's last word. */
export function lastWord(run: AgentRun | undefined): string {
  if (!run) return ''
  return (run.output || run.error || run.input || '').replace(/\s+/g, ' ').trim()
}

/** The bots in the grid (Primary Bot first, lead seat order next, then creation order) and the rest in rows. */
export function split(bots: readonly Agent[], last: ReadonlyMap<string, AgentRun>): { grid: Agent[]; rows: Agent[] } {
  const made = [...bots].sort((a, b) => {
    const sa = rankOf(a)
    const sb = rankOf(b)
    if (sa !== sb) return sa - sb
    return (instant(a.createdAt) ?? 0) - (instant(b.createdAt) ?? 0)
  })
  const grid = made.slice(0, GRID)
  const rows = made
    .slice(GRID)
    .sort((a, b) => (instant(last.get(b.name)?.createdAt) ?? 0) - (instant(last.get(a.name)?.createdAt) ?? 0))
  return { grid, rows }
}

/** Orders Bot Groups by layer ascending (`Layer 1`, `Layer 2`, ...), then alphabetically. */
export function sortGroupsByLayer(groups: readonly BotGroup[]): BotGroup[] {
  return [...groups].sort((a, b) => {
    const la = a.layer || 1
    const lb = b.layer || 1
    if (la !== lb) return la - lb
    return a.name.localeCompare(b.name)
  })
}

/** Compact human-readable badge for a group's consensus or leadership policy. */
export function policyBadge(policy: GroupPolicy | undefined): string {
  if (!policy) return 'Leader'
  switch (policy.kind) {
    case 'quasar': {
      const prof = policy.quasarProfile ? policy.quasarProfile.charAt(0).toUpperCase() + policy.quasarProfile.slice(1) : 'Aurora'
      return `Lux Quasar · ${prof}`
    }
    case 'leader':
      return policy.leader ? `Leader · ${policy.leader}` : 'Leader'
    case 'majority':
      return 'Majority'
    case 'weighted':
      return 'Weighted'
    case 'unanimous':
      return 'Unanimous'
    case 'kai':
      return 'Kai Consensus'
    case 'custom':
      return 'Custom Policy'
    default:
      return 'Leader'
  }
}
