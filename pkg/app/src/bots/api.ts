'use client'

// The routes the Bots app calls that the SDK has no method for, named once.
//
// `@hanzo/ai` owns the agent verbs (list, get, update, run, runs), the sandbox
// verbs and the transport list, and those are called through it. What is here is
// the remainder: bootstrapping the org's Primary Bot (`hanzo`), creating a bot
// with full computer/MCP tools and budget, multi-layer Bot Groups & consensus
// policies (Leader, Lux Quasar, Majority, Weighted, Unanimous, Kai, Custom),
// Slack workspace sync & channel routing, resumable Desktop Sandbox Computers
// (including Free-tier persistent `disk: true` fallback + KMS autofill), and
// Scheduled + Event-Driven Automations (`/v1/auto/automations`).

import type { Agent, Sandbox } from '@hanzo/ai'
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
 * Computer Use (`computer_in_sandbox`), bash/files, Connectors, KMS Autofill, and Bot Coordination.
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
        'You are hanzo, the Primary Bot (Layer 0) for this workspace. Direct worker bots and Bot Groups across layers, operate your resumable Desktop Sandbox Computer (including secure KMS login autofill), and answer across Slack and connected tools.',
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
    return (j.channels ?? [])
      .map((ch) => ({
        id: String(ch.id ?? ''),
        name: String(ch.name ?? ''),
        isMember: Boolean(ch.is_member ?? ch.isMember),
        isPrivate: Boolean(ch.is_private ?? ch.isPrivate),
      }))
      .filter((ch) => Boolean(ch.id && ch.name))
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

/**
 * Where a grant opens: its address on the API host, and for a screen whether it
 * opens to watch or to control. Cloud answers a PATH
 * (`/v1/sandbox/<id>/screen?ticket=…`, cloud apps/sandbox `ticketGrant`), and the
 * API's host serves it, never the page's: on hanzo.bot the page's own host is the
 * static site, which answers that path with a page that refuses to be framed, and
 * a bot's computer read "hanzo.bot refused to connect".
 */
export function opened(url: string, viewOnly?: boolean): string {
  const u = new URL(url, `${api()}/`)
  if (viewOnly !== undefined) u.searchParams.set('viewOnly', viewOnly ? '1' : '0')
  return u.toString()
}

function bestSandbox(boxes: readonly Sandbox[]): Sandbox | null {
  return (
    boxes.find((b) => b.status === 'running') ??
    boxes.find((b) => b.status === 'pending') ??
    boxes.find((b) => (b.status as string) === 'paused' || (b.status as string) === 'parked') ??
    boxes[0] ??
    null
  )
}

/**
 * Finds the bot's existing desktop sandbox across both named project disks (`bot-<name>`)
 * and Free-tier persistent `disk: true` sandboxes bound via `bot.computeRef`.
 */
export async function findBotComputer(c: Client, bot: BotAgent, signal?: AbortSignal): Promise<Sandbox | null> {
  const opts = signal ? { signal } : undefined
  try {
    const byProject = await c.sandboxes.list({ project: disk(bot.name) }, opts)
    const found = bestSandbox(byProject)
    if (found) return found
  } catch {
    // continue to computeRef lookup
  }
  if (bot.computeRef) {
    try {
      const all = await c.sandboxes.list(undefined, opts)
      const exact = all.find((b) => b.id === bot.computeRef)
      if (exact) return exact
    } catch {
      // ignore
    }
  }
  return null
}

function statusOfError(err: unknown): number {
  if (!err || typeof err !== 'object') return 0
  const rec = err as Record<string, unknown>
  if (typeof rec.status === 'number') return rec.status
  if (typeof rec.statusCode === 'number') return rec.statusCode
  return 0
}

/**
 * Boots or resumes the bot's persistent Desktop Sandbox Computer:
 * 1. If a parked/existing sandbox id is known (`existing?.id` or `bot.computeRef`), resumes it in place.
 * 2. Otherwise leases `{ class: 'desktop', project: 'bot-<name>', disk: true }`.
 * 3. On `402` or `409` (e.g., Free-tier $0 account where named project volumes require balance),
 *    seamlessly falls back to `{ class: 'desktop', disk: true }` (admitted on the Free daily allowance
 *    with a persistent 2 GiB resumable disk!).
 */
export async function bootOrResumeComputer(
  c: Client,
  bot: BotAgent,
  existing?: Sandbox | null,
): Promise<Sandbox> {
  const resumeId = existing?.id || bot.computeRef
  let leased: Sandbox | null = null

  if (resumeId) {
    try {
      leased = await c.http.json<Sandbox>({
        method: 'POST',
        path: '/v1/sandbox/lease',
        body: { id: resumeId, class: 'desktop', disk: true },
      })
    } catch {
      leased = null
    }
  }

  if (!leased) {
    try {
      leased = await c.http.json<Sandbox>({
        method: 'POST',
        path: '/v1/sandbox/lease',
        body: { class: 'desktop', project: disk(bot.name), disk: true },
      })
    } catch (err) {
      const code = statusOfError(err)
      if (code === 402 || code === 409) {
        leased = await c.http.json<Sandbox>({
          method: 'POST',
          path: '/v1/sandbox/lease',
          body: { class: 'desktop', disk: true },
        })
      } else {
        throw err
      }
    }
  }

  if (leased?.id && (bot.computeRef !== leased.id || !bot.tools?.length)) {
    await updateBotMeta(c, bot.name, { computeRef: leased.id, tools: ['*'] }).catch(() => null)
  }
  return leased
}

/** Parks a running desktop sandbox while preserving its persistent home volume (`disk: true`). */
export async function parkComputer(c: Client, id: string): Promise<void> {
  try {
    await c.http.json<unknown>({
      method: 'POST',
      path: `/v1/sandbox/${encodeURIComponent(id)}/pause`,
      body: {},
    })
  } catch {
    await c.http.json<unknown>({
      method: 'POST',
      path: '/v1/sandbox/park',
      body: { id },
    })
  }
}

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
    | 'autofill'
    | 'save_credential'
  x?: number
  y?: number
  toX?: number
  toY?: number
  dx?: number
  dy?: number
  text?: string
  keys?: string
  key?: string
  url?: string
  command?: string
  seconds?: number
  ms?: number
  credential?: string
  field?: 'login' | 'login_totp' | 'username' | 'password' | 'totp' | 'secret'
  submit?: boolean
}

export interface ComputerActionOut {
  ok?: boolean
  text?: string
  action?: string
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

// ── Scheduled & Event-Driven Automations (`/v1/auto/automations`) ───────────

export interface AutomationSchedule {
  kind: 'manual' | 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'cron' | 'once'
  at?: string
  day?: string
  cron?: string
  tz?: string
}

export interface AutomationEventTrigger {
  source: string
  name: string
}

export interface BotAutomation {
  id: string
  name: string
  instructions: string
  schedule: AutomationSchedule
  event?: AutomationEventTrigger | null
  permissions: 'auto' | 'ask'
  notify: boolean
  enabled: boolean
  source: string
  next?: string | null
  last?: { id: string; status: string; at: string; summary: string } | null
  created: string
  updated: string
}

export async function listBotAutomations(
  c: Client,
  botName?: string,
  signal?: AbortSignal,
): Promise<BotAutomation[]> {
  try {
    const res = await c.http.json<{ data?: BotAutomation[] }>({
      path: '/v1/auto/automations',
      signal,
    })
    const all = res.data ?? []
    if (!botName) return all
    const tag = `[bot:${botName.toLowerCase()}]`
    return all.filter((a) => {
      const lower = `${a.name} ${a.instructions}`.toLowerCase()
      if (lower.includes('[bot:')) return lower.includes(tag)
      return a.source === 'chat'
    })
  } catch {
    return []
  }
}

export async function parseAutomationWhen(
  c: Client,
  phrase: string,
  tz?: string,
): Promise<AutomationSchedule | null> {
  try {
    const zone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const res = await c.http.json<{ schedule?: AutomationSchedule }>({
      method: 'POST',
      path: '/v1/auto/when',
      body: { when: phrase, tz: zone },
    })
    return res.schedule ?? null
  } catch {
    return null
  }
}

export interface CreateBotAutomationIn {
  botName: string
  name: string
  instructions: string
  mode: 'schedule' | 'event'
  schedule?: AutomationSchedule
  event?: AutomationEventTrigger
  model?: string
  notify?: boolean
}

export async function createBotAutomation(c: Client, input: CreateBotAutomationIn): Promise<BotAutomation> {
  const prefix = `[bot:${input.botName}]`
  const taggedInstructions = input.instructions.includes(prefix)
    ? input.instructions
    : `${prefix} Acting as bot "${input.botName}", carry out this automation using your tools, connectors, and resumable desktop sandbox computer when needed:\n\n${input.instructions}`

  const body: Record<string, unknown> = {
    name: input.name.trim(),
    instructions: taggedInstructions,
    permissions: 'auto',
    notify: input.notify ?? true,
    enabled: true,
    source: 'chat',
  }
  if (input.model) body.model = input.model
  if (input.mode === 'event' && input.event) {
    body.event = input.event
    body.schedule = { kind: 'manual' }
  } else {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    body.schedule = input.schedule ?? { kind: 'daily', at: '09:00', tz: zone }
  }

  return c.http.json<BotAutomation>({
    method: 'POST',
    path: '/v1/auto/automations',
    body,
  })
}

export const toggleBotAutomation = (c: Client, id: string, enabled: boolean) =>
  c.http.json<BotAutomation>({
    method: 'PATCH',
    path: `/v1/auto/automations/${encodeURIComponent(id)}`,
    body: { enabled },
  })

export const runBotAutomation = (c: Client, id: string) =>
  c.http.json<{ run: { id: string; status: string } }>({
    method: 'POST',
    path: `/v1/auto/automations/${encodeURIComponent(id)}/run`,
    body: {},
  })

export const deleteBotAutomation = (c: Client, id: string) =>
  c.http.json<unknown>({
    method: 'DELETE',
    path: `/v1/auto/automations/${encodeURIComponent(id)}`,
  })
