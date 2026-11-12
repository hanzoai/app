'use client'

// The routes the Bots app calls that the SDK has no method for, named once.
//
// `@hanzo/ai` owns the agent verbs (list, get, update, run, runs), the sandbox
// verbs and the transport list, and those are called through it. What is here is
// the remainder: creating a bot with the budget the platform requires, asking
// which bot answers on a transport, and minting a window onto a bot's computer.

import type { Agent } from '@hanzo/ai'
import type { useAi } from '../lib/ai'

export type Client = NonNullable<ReturnType<typeof useAi>['client']>

/** The platform's word for a bot that runs on its own schedule. */
export const ALWAYS = 'long-running'
export const ONCE = 'one-shot'

/** A bot's name, as the agents route accepts one in a path. */
export const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

/** The address names the open bot (`?bot=`), so a reload, a link and Share all reopen it. */
export const PARAM = 'bot'

/** One US dollar in the platform's unit of money. */
export const DOLLAR = 1_000_000

/** What a person states to make a bot: who it is, what it does, what it may spend a week. */
export interface Draft {
  name: string
  instructions: string
  model: string
  /** Whole US dollars a week. */
  weekly: number
}

/**
 * Makes a bot.
 *
 * The platform refuses an agent without a budget — `cap_micro_usd`,
 * `max_task_micro_usd` and `period`, every field required — and the SDK's create
 * names none of them, so the call is made here. The week's budget is also the
 * ceiling for one run: a single message may use what the week allows, and the
 * cap is what stops it.
 */
export const make = (c: Client, d: Draft) =>
  c.http.json<Agent>({
    method: 'POST',
    path: '/v1/agents',
    body: {
      name: d.name,
      model: d.model,
      instructions: d.instructions,
      description: d.instructions.split('\n')[0].slice(0, 200),
      cap_micro_usd: d.weekly * DOLLAR,
      max_task_micro_usd: d.weekly * DOLLAR,
      period: 'week',
    },
  })

/** The sandbox project that is a bot's own disk: the same name finds the same disk. */
export const disk = (name: string) => `bot-${name}`

/** Which bot answers on a transport: the org default and any channel bound past it. */
export interface Answering {
  transport: string
  default?: string
  channels?: Record<string, string>
}

export const answering = (c: Client, transport: string, signal?: AbortSignal) =>
  c.http.json<Answering>({ path: '/v1/transport/agent', query: { transport }, signal })

/** A short-lived grant to open a bot computer's screen or terminal. */
export interface Grant {
  url?: string
  ticket?: string
  expiresIn?: number
}

export const grant = (c: Client, id: string, kind: 'terminal' | 'screen') =>
  c.http.json<Grant>({ method: 'POST', path: `/v1/sandbox/${encodeURIComponent(id)}/${kind}/ticket` })
