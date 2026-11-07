// The agents a conversation can hold, and the figures a new one can start from.
// Pure: the composer's Agents shelf (crew.tsx `useAgentShelf`), the crew strip
// and the New agent sheet read these, and the tests run them in Node.

import type { Host } from '@hanzo/build'
import { TEAM, after } from './team'

export type { Link, Shelf, ShelfRow as Row } from '@hanzo/ui/chat'

/**
 * The model that draws an agent's face: Hanzo's own image SKU (hanzo-inc/zen
 * catalog.yaml `zen-image`), named on every call, because the endpoint takes
 * none by default.
 */
export const PAINTER = 'zen-image'

/** The words every drawn face is asked for after its description. */
export const MEMOJI = 'memoji style 3D emoji portrait, head and shoulders, centered, plain background'

type Cast = NonNullable<Host['cast']>[number]

/**
 * How each seat after the first twelve runs once it is made: autonomously,
 * 24/7, woken on its schedule (5-field cron) and by its triggers. Keyed by the
 * seat's id; the first twelve, the leads, run when asked.
 */
export const RUNS: Readonly<Record<string, Required<Pick<Cast, 'schedule' | 'triggers'>>>> = {
  data: { schedule: '*/15 * * * *', triggers: ['webhook', 'watch'] },
  lang: { schedule: '0 * * * *', triggers: ['git', 'webhook', 'channel'] },
  edu: { schedule: '0 9 * * *', triggers: ['channel', 'webhook'] },
  art: { schedule: '0 * * * *', triggers: ['webhook', 'channel'] },
  rev: { schedule: '*/15 * * * *', triggers: ['webhook', 'watch'] },
  law: { schedule: '0 9 * * 1-5', triggers: ['webhook', 'channel'] },
  vid: { schedule: '0 * * * *', triggers: ['webhook', 'channel'] },
  biz: { schedule: '0 9 * * 1-5', triggers: ['webhook', 'channel'] },
  mu: { schedule: '0 * * * *', triggers: ['webhook', 'channel'] },
  doc: { schedule: '0 * * * *', triggers: ['git', 'webhook'] },
  gov: { schedule: '0 9 * * 1-5', triggers: ['watch', 'channel'] },
  cust: { schedule: '*/15 * * * *', triggers: ['webhook', 'channel', 'watch'] },
  com: { schedule: '*/15 * * * *', triggers: ['git', 'channel', 'webhook'] },
  it: { schedule: '*/15 * * * *', triggers: ['webhook', 'watch'] },
  qa: { schedule: '*/15 * * * *', triggers: ['git', 'webhook', 'watch'] },
  auto: { schedule: '*/5 * * * *', triggers: ['webhook', 'git', 'channel', 'watch'] },
  proc: { schedule: '0 9 * * 1-5', triggers: ['webhook', 'watch'] },
  supply: { schedule: '0 * * * *', triggers: ['webhook', 'watch'] },
  corp: { schedule: '0 9 * * 1', triggers: ['watch', 'channel'] },
  comp: { schedule: '0 * * * *', triggers: ['git', 'webhook', 'watch'] },
  risk: { schedule: '0 * * * *', triggers: ['webhook', 'watch'] },
  audit: { schedule: '0 9 * * *', triggers: ['git', 'watch'] },
}

/**
 * The default agents (Customize › Agents, @hanzo/build `cast`): the team
 * hanzoai/personas publishes, one per seat in seat order, each as its file writes
 * it, wearing its memoji and naming who it is drawn from (`after`). The twelve leads are offered under Team; every
 * other seat is a Bot, offered to run 24/7 on its `RUNS`. An org starts with
 * none of them and loads none until it adds them.
 */
export const CAST: NonNullable<Host['cast']> = TEAM.map((one) => ({
  name: one.id,
  title: one.name,
  category: one.lead ? 'Team' : 'Bot',
  description: `${one.name} — ${one.role}`,
  model: one.model,
  instructions: one.instructions,
  avatar: `/agents/${one.id}.png`,
  after: after(one),
  tools: one.tools,
  ...(one.lead ? {} : { executionMode: 'long-running' as const, ...RUNS[one.id] }),
}))

const RANK = new Map(TEAM.map((one, i) => [one.id, i]))

/**
 * The org's own agents, the team's first in seat order, then the rest as
 * listed. Nothing stands in for a member the org has not added: an org
 * with no agents has none to show.
 */
export function ordered<T extends { name: string }>(agents: readonly T[] | null | undefined): T[] {
  const list: T[] = Array.isArray(agents) ? [...agents] : []
  const rank = (one: { name: string }) => RANK.get(one.name?.toLowerCase() ?? '') ?? Infinity
  return list.sort((a, b) => rank(a) - rank(b))
}

/**
 * One figure of @hanzo/personas' roster, as assets/personas/index.json lists it
 * (scripts/team.mjs). `called`, `about` and `based` are its PERSONA.md's
 * `name`, `description` and `based_on`, present only where one is written.
 */
export interface Figure {
  slug: string
  name: string
  category: string
  called?: string
  about?: string
  based?: string
}

/** Where a host serves the roster: the list, and each written figure's PERSONA.md. */
export const FIGURES = '/personas'

/** The name a person reads for a figure: who it is based on, else its own name. */
export const title = (f: Figure): string => f.based?.replace(/\s*\(.*\)\s*$/, '') ?? f.called ?? f.name

/** A figure's one line: its PERSONA.md's description, else what it was. */
export const line = (f: Figure): string => f.about ?? f.category.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

/**
 * A name the agents API takes (cloud apps/agents `nameRE`): letters, digits, dots,
 * dashes and underscores, from a letter or digit, up to 64. Accents are dropped
 * and any other run becomes a dash: "Spärck Jones" is Sparck-Jones.
 */
export const handle = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^[^A-Za-z0-9]+/, '')
    .slice(0, 64)
    .replace(/-+$/, '')

/** What the New agent sheet is filled with from a figure. */
export interface Draft {
  name: string
  /** The instructions. */
  does: string
  /** The face to draw. */
  look: string
}

/**
 * A figure as an agent: its PERSONA.md's name and its prompt word for word
 * (the text under the front matter); a figure with none written is told who it
 * is in one paragraph. The face is described by who it is and its one line.
 */
export function draft(f: Figure, md: string | null): Draft {
  const who = title(f)
  const prompt = md?.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
  return {
    name: handle(f.called ?? who),
    does:
      prompt ||
      `You are ${who}. Answer as ${who} would, in your own voice and from what you wrote and did. When a question is past what you could have known, say so.`,
    look: `${who}, ${line(f).replace(/^./, (c) => c.toLowerCase())}`,
  }
}
