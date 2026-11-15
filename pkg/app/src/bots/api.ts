'use client'

// The routes the Bots app calls that the SDK has no method for, named once.
//
// `@hanzo/ai` owns the agent verbs (list, get, update, run, runs), the sandbox
// verbs and the transport list, and those are called through it. What is here is
// the remainder: bootstrapping the org's Primary Bot (`hanzo`), creating a bot
// with full computer/MCP tools and budget, multi-layer Bot Groups & consensus
// policies (Leader, Lux Quasar, Majority, Weighted, Unanimous, Kai, Custom),
// Slack workspace sync & channel routing, and desktop sandbox computer control.

import type { Agent } from '@hanzo/ai'
import { api } from '../lib/api'
import { scope } from '../lib/session'
import type { useAi } from '../lib/ai'

export type Client = NonNullable<ReturnType<typeof useAi>['client']>

/** The platform's word for a bot that runs on its own schedule. */
export const ALWAYS = 'long-running'
export const ONCE = 'one-shot'

/** Default Primary Bot name for every workspace on hanzo.bot. */
export const PRIMARY_BOT = 'hanzo'

/** Prefix used in `?bot=group:<name>` to address a Bot Group in the roster. */
export const GROUP_PREFIX = 'group:'

export const isGroupRef = (ref: string | null | undefined): boolean =>
  Boolean(ref && ref.startsWith(GROUP_PREFIX) && ref.length > GROUP_PREFIX.length)

export const groupNameOf = (ref: string): string =>
  ref.startsWith(GROUP_PREFIX) ? ref.slice(GROUP_PREFIX.length) : ref

export const toGroupRef = (name: string): string =>
  name.startsWith(GROUP_PREFIX) ? name : `${GROUP_PREFIX}${name}`

/** A bot's name, as the agents route accepts one in a path. */
export const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

/** The address names the open bot (`?bot=`), so a reload, a link and Share all reopen it. */
export const PARAM = 'bot'

/** One US dollar in the platform's unit of money. */
export const DOLLAR = 1_000_000

/** Agent record extended with hierarchy and desktop computer fields returned by `/v1/agent`. */
export interface BotAgent extends Agent {
  isPrimary?: boolean
  groupId?: string
  layer?: number
  computeRef?: string
  tools?: string[]
  period?: string
}

export type PolicyKind = 'leader' | 'quasar' | 'majority' | 'weighted' | 'unanimous' | 'kai' | 'custom'
export type QuasarProfile = 'polaris' | 'aurora' | 'pulsar'

export interface GroupPolicy {
  kind: PolicyKind
  leader?: string
  quasarProfile?: QuasarProfile
  sampleK?: number
  alpha?: number
  beta?: number
  weights?: Record<string, number>
  minConfidence?: number
  customPrompt?: string
  adjudicatorModel?: string
  escalateToPrimary?: boolean
}

export interface BotGroup {
  id: string
  org?: string
  name: string
  description?: string
  layer: number
  parentGroupId?: string
  members: string[]
  policy: GroupPolicy
  createdAt?: string
  updatedAt?: string
}

export interface GroupProposal {
  agent: string
  layer: number
  output: string
  verdict: string
  confidence: number
  error?: string
  durationMs?: number
  runId?: string
}

export interface QuasarCert {
  profile: string
  sampleK: number
  alpha: number
  beta: number
  rounds: number
  finalized: boolean
  support: number
  winnerDigest: string
  thresholdCommitment: string
  checkpointDigest: string
  escalated?: boolean
}

export interface GroupRunResult {
  group: string
  layer: number
  policy: PolicyKind
  leader?: string
  output: string
  proposals: GroupProposal[]
  quasar?: QuasarCert
  escalatedTo?: string
  durationMs: number
}

/** What a person states to make a bot: who it is, what it does, what it may spend a week. */
export interface Draft {
  name: string
  instructions: string
  model: string
  /** Whole US dollars a week. */
  weekly: number
  isPrimary?: boolean
  groupId?: string
  layer?: number
  computeRef?: string
}

/**
 * Makes a bot with full tool access (`tools: ['*']`) — including Desktop Sandbox
 * Computer Use (`computer_in_sandbox`), bash/files, Connectors, and Bot Coordination.
 */
export const make = (c: Client, d: Draft) =>
  c.http.json<BotAgent>({
    method: 'POST',
    path: '/v1/agents',
    body: {
      name: d.name,
      model: d.model,
      instructions: d.instructions,
      description: d.instructions.split('\n')[0].slice(0, 200),
      tools: ['*'],
      isPrimary: Boolean(d.isPrimary),
      groupId: d.groupId || undefined,
      layer: d.layer ?? (d.isPrimary ? 0 : 1),
      computeRef: d.computeRef || undefined,
      cap_micro_usd: d.weekly * DOLLAR,
      max_task_micro_usd: d.weekly * DOLLAR,
      period: 'week',
    },
  })

/**
 * Idempotently ensures the org's Primary Bot (default `"hanzo"`, Layer 0, max 1 primary)
 * exists and is ready to direct subordinate bots and groups. Falls back gracefully if
 * `/v1/agent/bootstrap` has not rolled out to an edge node yet.
 */
export async function bootstrapPrimary(
  c: Client,
  name = PRIMARY_BOT,
  model = 'enso',
): Promise<{ agent: BotAgent; created: boolean }> {
  try {
    return await c.http.json<{ agent: BotAgent; created: boolean }>({
      method: 'POST',
      path: '/v1/agent/bootstrap',
      body: { name, model },
    })
  } catch {
    const existing = (await c.agents.list()) as BotAgent[]
    const primary = existing.find((b) => b.isPrimary) ?? existing.find((b) => b.name.toLowerCase() === name.toLowerCase())
    if (primary) return { agent: primary, created: false }
    const created = await make(c, {
      name,
      model,
      weekly: 25,
      isPrimary: true,
      layer: 0,
      instructions:
        'You are hanzo, the Primary Bot (Layer 0) for this workspace. Direct worker bots and Bot Groups across layers, operate your Desktop Sandbox Computer, and answer across Slack and connected tools.',
    })
    return { agent: created, created: true }
  }
}

/** Atomically promotes `ref` to be the org's sole Primary Bot (Layer 0). */
export const setPrimaryBot = (c: Client, ref: string) =>
  c.http.json<BotAgent>({
    method: 'PUT',
    path: `/v1/agents/${encodeURIComponent(ref)}`,
    body: { isPrimary: true, layer: 0 },
  })

/** Updates hierarchy metadata (`groupId`, `layer`, `computeRef`, `tools`) on an existing bot. */
export const updateBotMeta = (
  c: Client,
  ref: string,
  patch: { isPrimary?: boolean; groupId?: string; layer?: number; computeRef?: string; tools?: string[] },
) =>
  c.http.json<BotAgent>({
    method: 'PUT',
    path: `/v1/agents/${encodeURIComponent(ref)}`,
    body: patch,
  })

/** Lists all Bot Groups in the caller's org, ordered by layer. */
export async function listGroups(c: Client, signal?: AbortSignal): Promise<BotGroup[]> {
  try {
    const res = await c.http.json<{ groups?: BotGroup[] }>({ path: '/v1/agent/groups', signal })
    return res.groups ?? []
  } catch {
    return []
  }
}

export interface GroupDraft {
  name: string
  description?: string
  layer: number
  parentGroupId?: string
  members: string[]
  policy: GroupPolicy
}

export const createGroup = (c: Client, body: GroupDraft) =>
  c.http.json<BotGroup>({
    method: 'POST',
    path: '/v1/agent/groups',
    body,
  })

export const updateGroup = (c: Client, ref: string, body: Partial<GroupDraft>) =>
  c.http.json<BotGroup>({
    method: 'PUT',
    path: `/v1/agent/groups/${encodeURIComponent(groupNameOf(ref))}`,
    body,
  })

export const deleteGroup = (c: Client, ref: string) =>
  c.http.json<{ deleted: boolean }>({
    method: 'DELETE',
    path: `/v1/agent/groups/${encodeURIComponent(groupNameOf(ref))}`,
  })

export const runGroup = (c: Client, ref: string, input: string, model?: string) =>
  c.http.json<GroupRunResult>({
    method: 'POST',
    path: `/v1/agent/groups/${encodeURIComponent(groupNameOf(ref))}/run`,
    body: { input, model: model || undefined },
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

export const setAnswering = (
  c: Client,
  body: { transport: string; default?: string; channels?: Record<string, string>; unbind?: string[] },
) =>
  c.http.json<Answering>({
    method: 'PUT',
    path: '/v1/transport/agent',
    body,
  })

export interface SlackChannel {
  id: string
  name: string
  isMember?: boolean
  isPrivate?: boolean
}

export async function slackStatus(signal?: AbortSignal): Promise<{ connected: boolean; account?: string; available?: boolean }> {
  try {
    const r = await fetch(`${api()}/v1/provider`, { headers: scope(), signal })
    if (!r.ok) return { connected: false }
    const j = (await r.json()) as { providers?: Array<Record<string, unknown>> }
    const slack = j.providers?.find((p) => String(p.id ?? '').toLowerCase() === 'slack')
    if (!slack) return { connected: false }
    const conn = (slack.connection ?? {}) as Record<string, unknown>
    return {
      connected: Boolean(slack.connected),
      available: Boolean(slack.available),
      account: String(conn.account ?? conn.label ?? ''),
    }
  } catch {
    return { connected: false }
  }
}

export async function slackAuthorizeUrl(): Promise<string | null> {
  const r = await fetch(`${api()}/v1/provider/slack/connect`, {
    method: 'POST',
    headers: { ...scope(), 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!r.ok) return null
  const j = (await r.json()) as { authorizeUrl?: string }
  return j.authorizeUrl ?? null
}

export async function slackSyncChannels(): Promise<{ joined?: number; ok: boolean }> {
  const r = await fetch(`${api()}/v1/provider/slack/join`, {
    method: 'POST',
    headers: { ...scope(), 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!r.ok) return { ok: false }
  const j = (await r.json().catch(() => ({}))) as { joined?: unknown[]; count?: number }
  const count = Array.isArray(j.joined) ? j.joined.length : typeof j.count === 'number' ? j.count : undefined
  return { ok: true, joined: count }
}

export async function slackChannels(signal?: AbortSignal): Promise<SlackChannel[]> {
  try {
    const r = await fetch(`${api()}/v1/provider/slack/channels?types=public_channel`, { headers: scope(), signal })
    if (!r.ok) return []
    const j = (await r.json()) as { channels?: Array<Record<string, unknown>> }
    return (j.channels ?? []).map((ch) => ({
      id: String(ch.id ?? ''),
      name: String(ch.name ?? ''),
      isMember: Boolean(ch.is_member ?? ch.isMember),
      isPrivate: Boolean(ch.is_private ?? ch.isPrivate),
    })).filter((ch) => Boolean(ch.id && ch.name))
  } catch {
    return []
  }
}

/** A short-lived grant to open a bot computer's screen or terminal. */
export interface Grant {
  url?: string
  ticket?: string
  expiresIn?: number
}

export const grant = (c: Client, id: string, kind: 'terminal' | 'screen') =>
  c.http.json<Grant>({ method: 'POST', path: `/v1/sandbox/${encodeURIComponent(id)}/${kind}/ticket` })

export const parkComputer = (c: Client, id: string) =>
  c.http.json<unknown>({ method: 'POST', path: `/v1/sandbox/${encodeURIComponent(id)}/park`, body: {} })

export interface ComputerActionIn {
  id: string
  action:
    | 'screenshot'
    | 'click'
    | 'double_click'
    | 'right_click'
    | 'middle_click'
    | 'move'
    | 'drag'
    | 'scroll'
    | 'type'
    | 'key'
    | 'navigate'
    | 'wait'
    | 'shell'
  x?: number
  y?: number
  toX?: number
  toY?: number
  dx?: number
  dy?: number
  text?: string
  key?: string
  url?: string
  command?: string
  ms?: number
}

export interface ComputerActionOut {
  action: string
  stdout?: string
  stderr?: string
  exitCode?: number
  image?: string
  mimeType?: string
  width?: number
  height?: number
}

export const actComputer = (c: Client, body: ComputerActionIn) =>
  c.http.json<ComputerActionOut>({
    method: 'POST',
    path: '/v1/sandbox/computer',
    body,
  })
