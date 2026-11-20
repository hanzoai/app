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

/** Sidebar column count for the Pinned Bots grid (1 → 2 → 3). */
export type RosterColumns = 1 | 2 | 3

/** User column preference: responsive width-driven (`auto`) or an explicit 1–3 column lock. */
export type RosterColumnPref = 'auto' | RosterColumns

/** Default, minimum, and maximum widths (px) for the drag-resizable Bots sidebar. */
export const ROSTER_WIDTH_DEFAULT = 256
export const ROSTER_WIDTH_MIN = 180
export const ROSTER_WIDTH_MAX = 400

/** Width breakpoints (px): <= 220 = 1 col, 221–295 = 2 cols, >= 296 = 3 cols. */
export const ROSTER_COL_2_MIN = 221
export const ROSTER_COL_3_MIN = 296

/** Maps a sidebar width (px) to 1, 2, or 3 pinned-bot grid columns. */
export function columnsForWidth(width: number): RosterColumns {
  if (width >= ROSTER_COL_3_MIN) return 3
  if (width >= ROSTER_COL_2_MIN) return 2
  return 1
}

/** Resolves effective column count from sidebar width and optional explicit column preference. */
export function resolveColumns(width: number, pref: RosterColumnPref = 'auto'): RosterColumns {
  return pref === 'auto' ? columnsForWidth(width) : pref
}

/** Four user-selectable avatar density sizes for the Pinned Bots sidebar. */
export type BotIconSize = 'xs' | 'sm' | 'md' | 'lg'

export const BOT_ICON_SIZES: readonly BotIconSize[] = ['xs', 'sm', 'md', 'lg'] as const

export const BOT_AVATAR_PX: Record<BotIconSize, number> = {
  xs: 24,
  sm: 32,
  md: 44,
  lg: 56,
}

export function isBotIconSize(value: unknown): value is BotIconSize {
  return value === 'xs' || value === 'sm' || value === 'md' || value === 'lg'
}

/** Pixel diameter for a bot avatar at the chosen density step. */
export function avatarSizePx(size: BotIconSize): number {
  return BOT_AVATAR_PX[size]
}

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

/** Default pinned bot names (lowercase) before the user customizes their pinned grid. */
export function defaultPinnedNames(bots: readonly Agent[]): string[] {
  return split(bots, new Map()).grid.map((b) => b.name.toLowerCase())
}

/** Toggles a bot's membership in the pinned list (case-insensitive by name). */
export function togglePinnedBot(current: readonly string[], name: string): string[] {
  const key = name.trim().toLowerCase()
  if (!key) return [...current]
  const normalized = current.map((n) => n.trim().toLowerCase()).filter(Boolean)
  if (normalized.includes(key)) {
    return normalized.filter((n) => n !== key)
  }
  return [...normalized, key]
}

/**
 * Partitions real bots into top Pinned Bots (`pinned`) and normal vertical rows (`unpinned`).
 * When `pinnedNames` is `null`, falls back to the default `split()` grid/rows ordering.
 * When `pinnedNames` is an explicit list, pinned bots stay above the hairline in pin/primary order
 * and all remaining bots appear below sorted by latest activity, then rank/creation order.
 */
export function partitionPinned(
  bots: readonly Agent[],
  last: ReadonlyMap<string, AgentRun>,
  pinnedNames: readonly string[] | null,
): { pinned: Agent[]; unpinned: Agent[] } {
  if (pinnedNames === null) {
    const { grid, rows } = split(bots, last)
    return { pinned: grid, unpinned: rows }
  }
  const order = new Map<string, number>()
  pinnedNames.forEach((n, idx) => {
    const key = n.trim().toLowerCase()
    if (key && !order.has(key)) order.set(key, idx)
  })
  const pinned: Agent[] = []
  const unpinned: Agent[] = []
  for (const bot of bots) {
    if (order.has(bot.name.toLowerCase())) pinned.push(bot)
    else unpinned.push(bot)
  }
  pinned.sort((a, b) => {
    const oa = order.get(a.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER
    const ob = order.get(b.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER
    if (oa !== ob) return oa - ob
    return rankOf(a) - rankOf(b)
  })
  unpinned.sort((a, b) => {
    const dt = (instant(last.get(b.name)?.createdAt) ?? 0) - (instant(last.get(a.name)?.createdAt) ?? 0)
    if (dt !== 0) return dt
    const dr = rankOf(a) - rankOf(b)
    if (dr !== 0) return dr
    return (instant(a.createdAt) ?? 0) - (instant(b.createdAt) ?? 0)
  })
  return { pinned, unpinned }
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
