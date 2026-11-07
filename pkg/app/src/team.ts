// The agent team, as hanzoai/personas publishes it.
//
// Each member's file is who they are and what the model is told, word for word:
// the front matter names them (`Dev`), gives their part (`Development`) and their
// seat, and the body is the system prompt. The files are read from the pinned
// package at build (scripts/team.mjs), so the apps keep no copy of a persona:
// moving the pin is how a persona changes.
//
// Every member the package publishes, in seat order: this is the default cast.

import { parse, type Member } from '@hanzo/personas/team.js'
import { FILES, NAMES } from './team.gen'

export type { Member }

export const TEAM: readonly Member[] = Object.entries(FILES)
  .map(([id, text]) => parse(id, text))
  .sort((a, b) => a.seat - b.seat)

const BY_ID = new Map(TEAM.map((one) => [one.id, one]))

/** Who a member is drawn from, by the names they go by: Mark is after Ogilvy, Bernbach and Burnett. */
export const after = (one: Member): string[] => one.exemplars.map((id) => NAMES[id]!)

/** The core member an agent name refers to, whatever its case, or undefined. */
export const member = (name: string | undefined): Member | undefined => BY_ID.get(name?.toLowerCase() ?? '')

/**
 * The name a person reads for an agent. A core member's row keeps its lower-case
 * handle (`dev`), because tools, channel bindings and activations key on it, and
 * is drawn by the member's name (`Dev`); any other agent is drawn as named.
 */
export const called = (name: string): string => member(name)?.name ?? name
