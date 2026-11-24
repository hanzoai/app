import { api } from '../lib/api'
import { bearer, org as currentOrg } from '../lib/session'
import { seedInitialFlows } from './templates'
import {
  isModelExecutionNode,
  isStickyNoteNode,
  topologicalSort,
  type FlowDefinition,
  type FlowNode,
  type FlowRunRecord,
  type FlowStepResult,
  type PlaygroundSession,
} from './types'

const STORAGE_FLOWS_PREFIX = 'hanzo.flow.definitions.v2.'
const STORAGE_RUNS_PREFIX = 'hanzo.flow.runs.v1.'
const STORAGE_PLAYGROUND_PREFIX = 'hanzo.flow.playground.v1.'
const MAX_STORED_RUNS = 50

function scopeKey(orgId?: string | null): string {
  const id = (orgId ?? currentOrg() ?? 'personal').trim().toLowerCase()
  return id || 'personal'
}

export function flowHeaders(json = true): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = bearer()
  if (token) headers.Authorization = `Bearer ${token}`
  const orgId = currentOrg()
  if (orgId) headers['X-Org-Id'] = orgId
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

export function readLocalFlows(orgId?: string | null): FlowDefinition[] {
  if (typeof window === 'undefined') return seedInitialFlows()
  try {
    const raw = window.localStorage.getItem(`${STORAGE_FLOWS_PREFIX}${scopeKey(orgId)}`)
    if (!raw) {
      const seeded = seedInitialFlows()
      writeLocalFlows(seeded, orgId)
      return seeded
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as FlowDefinition[]
    }
  } catch {
    // storage unavailable or corrupted; seed cleanly
  }
  return seedInitialFlows()
}

export function writeLocalFlows(flows: readonly FlowDefinition[], orgId?: string | null): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(`${STORAGE_FLOWS_PREFIX}${scopeKey(orgId)}`, JSON.stringify(flows))
    return true
  } catch {
    return false
  }
}

export function readLocalRuns(orgId?: string | null): FlowRunRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(`${STORAGE_RUNS_PREFIX}${scopeKey(orgId)}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as FlowRunRecord[]) : []
  } catch {
    return []
  }
}

export function writeLocalRuns(runs: readonly FlowRunRecord[], orgId?: string | null): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(
      `${STORAGE_RUNS_PREFIX}${scopeKey(orgId)}`,
      JSON.stringify(runs.slice(0, MAX_STORED_RUNS)),
    )
    return true
  } catch {
    return false
  }
}

export function createDefaultPlaygroundSession(name = 'Default Session'): PlaygroundSession {
  const now = new Date().toISOString()
  return {
    id: `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
}

export function readPlaygroundSessions(flowId: string, orgId?: string | null): PlaygroundSession[] {
  if (typeof window === 'undefined') return [createDefaultPlaygroundSession()]
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PLAYGROUND_PREFIX}${scopeKey(orgId)}.${flowId}`)
    if (!raw) return [createDefaultPlaygroundSession()]
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as PlaygroundSession[]
  } catch {
    // ignore corrupted session storage
  }
  return [createDefaultPlaygroundSession()]
}

export function writePlaygroundSessions(
  flowId: string,
  sessions: readonly PlaygroundSession[],
  orgId?: string | null,
): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(
      `${STORAGE_PLAYGROUND_PREFIX}${scopeKey(orgId)}.${flowId}`,
      JSON.stringify(sessions.slice(0, 25)),
    )
    return true
  } catch {
    return false
  }
}

export interface FlowSyncResult {
  flows: FlowDefinition[]
  source: 'remote' | 'local'
}

/**
 * Loads workflows from localStorage immediately and merges remote `/v1/workflow`
 * definitions when authenticated. Never throws on missing remote backend.
 */
export async function syncLoadFlows(orgId?: string | null, signal?: AbortSignal): Promise<FlowSyncResult> {
  const local = readLocalFlows(orgId)
  if (!bearer()) return { flows: local, source: 'local' }
  try {
    const res = await fetch(`${api()}/v1/workflow`, {
      method: 'GET',
      headers: flowHeaders(false),
      signal,
    })
    if (!res.ok) return { flows: local, source: 'local' }
    const body = (await res.json().catch(() => null)) as
      | FlowDefinition[]
      | { workflows?: FlowDefinition[]; data?: FlowDefinition[] }
      | null
    const remoteList = Array.isArray(body)
      ? body
      : Array.isArray(body?.workflows)
        ? body.workflows
        : Array.isArray(body?.data)
          ? body.data
          : []
    const validRemote = remoteList.filter(
      (f): f is FlowDefinition =>
        Boolean(f && typeof f.id === 'string' && typeof f.name === 'string' && Array.isArray(f.nodes)),
    )
    if (validRemote.length === 0) return { flows: local, source: 'local' }
    const byId = new Map<string, FlowDefinition>()
    for (const f of local) byId.set(f.id, f)
    for (const r of validRemote) {
      const existing = byId.get(r.id)
      if (!existing || (r.updatedAt && r.updatedAt > existing.updatedAt)) {
        byId.set(r.id, r)
      }
    }
    const merged = [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    writeLocalFlows(merged, orgId)
    return { flows: merged, source: 'remote' }
  } catch {
    return { flows: local, source: 'local' }
  }
}

/**
 * Saves one flow to localStorage and best-effort persists it to `/v1/workflow`.
 */
export async function persistFlow(
  flow: FlowDefinition,
  allFlows: readonly FlowDefinition[],
  orgId?: string | null,
): Promise<'synced' | 'local'> {
  writeLocalFlows(allFlows, orgId)
  if (!bearer()) return 'local'
  try {
    const res = await fetch(`${api()}/v1/workflow`, {
      method: 'POST',
      headers: flowHeaders(true),
      body: JSON.stringify(flow),
    })
    if (res.ok) return 'synced'
  } catch {
    // offline or backend route not provisioned; localStorage copy is authoritative
  }
  return 'local'
}

export async function removeRemoteFlow(flowId: string): Promise<void> {
  if (!bearer()) return
  try {
    await fetch(`${api()}/v1/workflow/${encodeURIComponent(flowId)}`, {
      method: 'DELETE',
      headers: flowHeaders(false),
    })
  } catch {
    // best-effort cleanup
  }
}

const STOP_WORDS = new Set([
  'tell',
  'me',
  'about',
  'what',
  'is',
  'are',
  'the',
  'a',
  'an',
  'for',
  'of',
  'to',
  'in',
  'on',
  'and',
  'or',
  'with',
  'please',
  'show',
  'find',
  'look',
  'up',
  'search',
  'get',
  'pokemon',
  'pokémon',
  'stats',
  'types',
  'abilities',
  'base',
  'info',
  'details',
  'summarize',
  'compare',
  'signature',
  'battle',
  'strengths',
])

/** Extracts a clean URL slug/query token from natural language input (e.g. "Tell me about Pikachu" -> "pikachu"). */
export function extractQuerySlug(raw: string): string {
  const cleaned = raw.trim()
  if (!cleaned) return 'pikachu'
  const words = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
  return words[0] ?? cleaned.toLowerCase().replace(/[^a-z0-9-]/g, '') ?? 'pikachu'
}

function interpolate(template: string, input: string, vars?: ReadonlyMap<string, string>): string {
  let out = template
    .replace(/\{\{\s*input\s*\}\}/gi, input)
    .replace(/\{\{\s*query\s*\}\}/gi, encodeURIComponent(extractQuerySlug(input)))
  if (vars) {
    out = out.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key: string) => {
      const val = vars.get(key)
      return val !== undefined ? val : match
    })
  }
  return out
}

export function evaluateCondition(expression: string | undefined, input: string): { passed: boolean; reason: string } {
  const expr = (expression ?? 'non-empty').trim()
  if (!expr || expr.toLowerCase() === 'non-empty') {
    const ok = input.trim().length > 0
    return { passed: ok, reason: ok ? 'Output is non-empty' : 'Output was empty' }
  }
  const lower = expr.toLowerCase()
  if (lower.startsWith('contains:')) {
    const needle = expr.slice('contains:'.length).trim().toLowerCase()
    const ok = input.toLowerCase().includes(needle)
    return {
      passed: ok,
      reason: ok ? `Matched "${needle}"` : `Did not contain "${needle}"`,
    }
  }
  if (lower.startsWith('!contains:')) {
    const needle = expr.slice('!contains:'.length).trim().toLowerCase()
    const ok = !input.toLowerCase().includes(needle)
    return {
      passed: ok,
      reason: ok ? `Excluded "${needle}"` : `Contained forbidden "${needle}"`,
    }
  }
  const lenMatch = /^length\s*([><=]+)\s*(\d+)$/i.exec(expr)
  if (lenMatch) {
    const op = lenMatch[1]
    const n = Number(lenMatch[2])
    const len = input.trim().length
    const ok = op === '>' ? len > n : op === '>=' ? len >= n : op === '<' ? len < n : op === '<=' ? len <= n : len === n
    return { passed: ok, reason: `Length ${len} ${op} ${n} → ${ok ? 'true' : 'false'}` }
  }
  const ok = input.toLowerCase().includes(lower)
  return { passed: ok, reason: ok ? `Matched "${expr}"` : `No match for "${expr}"` }
}

/** Compacts verbose public REST JSON (like PokéAPI) into a crisp token-efficient summary for Enso. */
function compactApiPayload(url: string, rawText: string): string {
  try {
    const parsed = JSON.parse(rawText) as Record<string, unknown>
    if (url.includes('pokeapi.co') && parsed && typeof parsed === 'object' && 'stats' in parsed) {
      const compact = {
        id: parsed.id,
        name: parsed.name,
        height_dm: parsed.height,
        weight_hg: parsed.weight,
        base_experience: parsed.base_experience,
        types: Array.isArray(parsed.types)
          ? parsed.types.map((t: { type?: { name?: string } }) => t?.type?.name).filter(Boolean)
          : [],
        abilities: Array.isArray(parsed.abilities)
          ? parsed.abilities
              .map((a: { ability?: { name?: string }; is_hidden?: boolean }) =>
                a?.ability?.name ? `${a.ability.name}${a.is_hidden ? ' (hidden)' : ''}` : null,
              )
              .filter(Boolean)
          : [],
        stats: Array.isArray(parsed.stats)
          ? Object.fromEntries(
              parsed.stats.map((s: { stat?: { name?: string }; base_stat?: number }) => [
                s?.stat?.name ?? 'stat',
                s?.base_stat ?? 0,
              ]),
            )
          : {},
      }
      return JSON.stringify(compact, null, 2)
    }
    return JSON.stringify(parsed, null, 2).slice(0, 3600)
  } catch {
    return rawText.slice(0, 3600)
  }
}

async function runApiRequestNode(
  node: FlowNode,
  upstreamOutput: string,
  vars: ReadonlyMap<string, string>,
  signal?: AbortSignal,
): Promise<string> {
  const rawUrl = (node.config.url || '').trim()
  if (!rawUrl) return '[API Request] No URL configured'
  const resolvedUrl = interpolate(rawUrl, upstreamOutput, vars)
  const method = node.config.method || 'GET'
  const headers: Record<string, string> = { Accept: 'application/json, text/plain' }
  if (node.config.headers?.trim()) {
    try {
      const parsedHeaders = JSON.parse(node.config.headers) as Record<string, string>
      for (const [k, v] of Object.entries(parsedHeaders)) {
        if (typeof v === 'string') headers[k] = interpolate(v, upstreamOutput, vars)
      }
    } catch {
      // ignore invalid custom header JSON
    }
  }
  const init: RequestInit = { method, headers, signal }
  if (method !== 'GET' && node.config.body) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
    init.body = interpolate(node.config.body, upstreamOutput, vars)
  }
  const res = await fetch(resolvedUrl, init)
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`API Request ${method} ${resolvedUrl} returned HTTP ${res.status}${errText ? `: ${errText.slice(0, 120)}` : ''}`)
  }
  const text = await res.text()
  return compactApiPayload(resolvedUrl, text)
}

interface EnsoCallOptions {
  modelOverride?: string
  toolContext?: string
  conversationHistory?: readonly { role: 'user' | 'assistant'; content: string }[]
  signal?: AbortSignal
  onToken?: (delta: string, accumulated: string) => void
}

async function runEnsoModelNode(
  node: FlowNode,
  upstreamOutput: string,
  vars: ReadonlyMap<string, string>,
  opts: EnsoCallOptions = {},
): Promise<string> {
  const model = (opts.modelOverride || node.config.model || 'enso').trim()
  let systemPrompt = (node.config.systemPrompt || 'You are a concise Hanzo Flow automation agent.').trim()
  if (node.subtype === 'structured_output' && node.config.schema) {
    systemPrompt += `\n\nReturn valid JSON conforming to this schema:\n${node.config.schema}`
  }
  const userPrompt = interpolate(node.config.prompt || '{{input}}', upstreamOutput, vars)
  const composedUser = opts.toolContext
    ? `${userPrompt}\n\n[Connected tool data]\n${opts.toolContext}`
    : userPrompt

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]
  if (opts.conversationHistory && opts.conversationHistory.length > 0) {
    for (const turn of opts.conversationHistory.slice(-10)) {
      messages.push({ role: turn.role, content: turn.content })
    }
  }
  messages.push({ role: 'user', content: composedUser })

  const wantStream = Boolean(opts.onToken)
  const res = await fetch(`${api()}/v1/chat/completions`, {
    method: 'POST',
    headers: flowHeaders(true),
    body: JSON.stringify({
      model,
      messages,
      temperature: typeof node.config.temperature === 'number' ? node.config.temperature : 0.3,
      max_tokens: 1024,
      ...(wantStream ? { stream: true } : {}),
    }),
    signal: opts.signal,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    const hint =
      res.status === 401
        ? 'Sign in to run Enso models (HTTP 401).'
        : res.status === 402
          ? 'Insufficient balance — top up credits to continue (HTTP 402).'
          : `Enso gateway returned HTTP ${res.status}${errText ? `: ${errText.slice(0, 160)}` : ''}`
    throw new Error(hint)
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (wantStream && contentType.includes('text/event-stream') && res.body) {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulated = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line || !line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const chunk = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
            error?: { message?: string }
          }
          if (chunk.error?.message) throw new Error(chunk.error.message)
          const delta = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? ''
          if (delta) {
            accumulated += delta
            opts.onToken?.(delta, accumulated)
          }
        } catch (err) {
          if (err instanceof Error && !err.message.includes('JSON')) throw err
        }
      }
    }
    if (!accumulated.trim()) {
      throw new Error('Enso stream completed with an empty response.')
    }
    return accumulated.trim()
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    output?: string
    error?: { message?: string }
  }
  if (data.error?.message) throw new Error(data.error.message)
  const content = data.choices?.[0]?.message?.content ?? data.output
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Enso returned an empty completion')
  }
  const trimmed = content.trim()
  opts.onToken?.(trimmed, trimmed)
  return trimmed
}

export interface ExecuteFlowOptions {
  trigger?: 'manual' | 'schedule' | 'webhook' | 'playground'
  sampleInput?: string
  modelOverride?: string
  conversationHistory?: readonly { role: 'user' | 'assistant'; content: string }[]
  signal?: AbortSignal
  onStepUpdate?: (steps: FlowStepResult[]) => void
  onToken?: (delta: string, accumulated: string, nodeId: string) => void
}

/**
 * Executes a workflow graph topologically (skipping Sticky Note documentation cards).
 * - Data Source `api_request` nodes invoke live HTTP requests and feed downstream inputs or Agent `Tools` ports.
 * - Enso / Zen model & agent nodes invoke `POST ${api()}/v1/chat/completions` live (with SSE streaming when `onToken` is provided).
 * - Condition / Guardrail / Switch nodes evaluate expressions and route True/False edges accurately.
 * - Side-effect outbound actions (mail/post/CRM) emit validated preview receipts in Test Run & Playground mode.
 */
export async function executeFlow(
  flow: FlowDefinition,
  options: ExecuteFlowOptions = {},
): Promise<FlowRunRecord> {
  const startedMs = Date.now()
  const startedAt = new Date(startedMs).toISOString()
  const runnableNodes = flow.nodes.filter((n) => !isStickyNoteNode(n))
  const ordered = topologicalSort(runnableNodes, flow.edges)

  const steps: FlowStepResult[] = ordered.map((node) => ({
    nodeId: node.id,
    nodeTitle: node.title,
    kind: node.kind,
    subtype: node.subtype,
    status: 'pending',
  }))
  options.onStepUpdate?.([...steps])

  const outputs = new Map<string, string>()
  const conditionBranch = new Map<string, 'true' | 'false'>()
  const vars = new Map<string, string>()
  let failed = false
  let haltedByCondition = false
  let lastOutput = options.sampleInput ?? ''
  let finalOutput = ''

  const incomingEdgesOf = (nodeId: string) => flow.edges.filter((e) => e.target === nodeId)

  const isBlockedByBranch = (nodeId: string): boolean => {
    const incoming = incomingEdgesOf(nodeId)
    if (incoming.length === 0) return false
    // If all incoming edges come from condition nodes whose chosen branch does not match, skip this node.
    const branchEdges = incoming.filter((e) => conditionBranch.has(e.source))
    if (branchEdges.length === 0) return false
    const anyAllowed = branchEdges.some((e) => {
      const verdict = conditionBranch.get(e.source)!
      const handle = (e.sourceHandle || e.label || '').trim().toLowerCase()
      if (!handle) return verdict === 'true'
      if (handle === 'false' || handle === 'fail' || handle === 'else') return verdict === 'false'
      return verdict === 'true'
    })
    return !anyAllowed
  }

  const upstreamOf = (nodeId: string, onlyTools = false): string => {
    const incoming = incomingEdgesOf(nodeId).filter((e) => {
      const isToolEdge = e.targetHandle === 'tools' || e.sourceHandle === 'tools'
      return onlyTools ? isToolEdge : !isToolEdge
    })
    if (incoming.length === 0) return onlyTools ? '' : lastOutput
    const parts = incoming
      .map((e) => outputs.get(e.source))
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
    if (parts.length > 0) return parts.join('\n\n')
    return onlyTools ? '' : lastOutput
  }

  for (let i = 0; i < ordered.length; i++) {
    const node = ordered[i]!
    const step = steps[i]!
    if (failed || haltedByCondition || isBlockedByBranch(node.id)) {
      step.status = 'skipped'
      options.onStepUpdate?.([...steps])
      continue
    }

    const t0 = Date.now()
    step.status = 'running'
    step.startedAt = new Date(t0).toISOString()
    options.onStepUpdate?.([...steps])

    try {
      if (node.kind === 'trigger' || node.kind === 'schedule') {
        const payload = options.sampleInput?.trim() || node.config.sampleInput?.trim() || `Triggered ${flow.name}`
        const output =
          node.kind === 'schedule'
            ? `[Schedule ${node.config.cron || '0 8 * * *'} ${node.config.timezone || 'UTC'}] ${payload}`
            : payload
        outputs.set(node.id, output)
        lastOutput = output
        step.output = output
        step.status = 'success'
      } else if (node.subtype === 'api_request' || node.subtype === 'http_request') {
        const input = upstreamOf(node.id)
        const responseText = await runApiRequestNode(node, input, vars, options.signal)
        outputs.set(node.id, responseText)
        if (!node.config.toolMode) lastOutput = responseText
        step.output = responseText
        step.status = 'success'
      } else if (node.subtype === 'prompt_template') {
        const input = upstreamOf(node.id)
        const rendered = interpolate(node.config.prompt || '{{input}}', input, vars)
        outputs.set(node.id, rendered)
        lastOutput = rendered
        step.output = rendered
        step.status = 'success'
      } else if (node.subtype === 'conversation_memory') {
        const input = upstreamOf(node.id)
        const historySummary =
          options.conversationHistory && options.conversationHistory.length > 0
            ? options.conversationHistory
                .slice(-(node.config.memoryWindow ?? 10))
                .map((m) => `${m.role}: ${m.content}`)
                .join('\n')
            : '(new session)'
        const combined = `History:\n${historySummary}\n\nLatest input:\n${input}`
        outputs.set(node.id, combined)
        lastOutput = combined
        step.output = `Loaded ${options.conversationHistory?.length ?? 0} prior turn(s)`
        step.status = 'success'
      } else if (node.kind === 'condition' || node.subtype === 'guardrail') {
        const input = upstreamOf(node.id)
        const verdict = evaluateCondition(node.config.expression, input)
        outputs.set(node.id, input)
        conditionBranch.set(node.id, verdict.passed ? 'true' : 'false')
        step.output = verdict.reason
        step.status = 'success'
        // If no explicit False edge exists on the graph, halt downstream when condition fails (preserves legacy behavior).
        const hasFalseBranch = flow.edges.some(
          (e) =>
            e.source === node.id &&
            ['false', 'fail', 'else'].includes((e.sourceHandle || e.label || '').trim().toLowerCase()),
        )
        if (!verdict.passed && !hasFalseBranch) {
          haltedByCondition = true
        }
      } else if (isModelExecutionNode(node)) {
        const input = upstreamOf(node.id, false)
        const toolContext = upstreamOf(node.id, true)
        const reply = await runEnsoModelNode(node, input, vars, {
          modelOverride: options.modelOverride,
          toolContext: toolContext || undefined,
          conversationHistory: options.conversationHistory,
          signal: options.signal,
          onToken: options.onToken
            ? (delta, accumulated) => options.onToken?.(delta, accumulated, node.id)
            : undefined,
        })
        outputs.set(node.id, reply)
        lastOutput = reply
        finalOutput = reply
        step.output = reply
        step.status = 'success'
      } else if (node.subtype === 'chat_output' || node.subtype === 'text_output' || node.subtype === 'http_response') {
        const input = upstreamOf(node.id)
        const rendered = interpolate(node.config.message || '{{input}}', input, vars)
        outputs.set(node.id, rendered)
        lastOutput = rendered
        finalOutput = rendered
        step.output = rendered
        step.status = 'success'
      } else if (node.subtype === 'file_loader') {
        const content = node.config.sampleInput?.trim() || `[Loaded file: ${node.config.filePath || 'document.md'}]`
        outputs.set(node.id, content)
        lastOutput = content
        step.output = content
        step.status = 'success'
      } else if (node.subtype === 'text_splitter') {
        const input = upstreamOf(node.id)
        const size = Math.max(100, node.config.chunkSize ?? 800)
        const chunks: string[] = []
        for (let idx = 0; idx < input.length; idx += size) {
          chunks.push(input.slice(idx, idx + size))
        }
        const out = chunks.length > 0 ? chunks.join('\n\n') : input
        outputs.set(node.id, out)
        lastOutput = out
        step.output = `Split into ${Math.max(1, chunks.length)} chunk(s) (${size} chars)`
        step.status = 'success'
      } else if (node.subtype === 'json_transform') {
        const input = upstreamOf(node.id)
        let transformed = input
        try {
          const match = input.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
          const parsed = JSON.parse(match ? match[0] : input)
          transformed = JSON.stringify(parsed, null, 2)
        } catch {
          transformed = input.trim()
        }
        outputs.set(node.id, transformed)
        lastOutput = transformed
        finalOutput = transformed
        step.output = transformed
        step.status = 'success'
      } else if (node.subtype === 'text_parser' || node.subtype === 'merge_combine') {
        const incoming = incomingEdgesOf(node.id)
          .map((e) => outputs.get(e.source))
          .filter((v): v is string => Boolean(v))
        const joined =
          node.subtype === 'merge_combine'
            ? incoming.join(node.config.delimiter ?? '\n\n---\n\n')
            : interpolate(node.config.pattern || '{{input}}', upstreamOf(node.id), vars)
        const resText = joined || lastOutput
        outputs.set(node.id, resText)
        lastOutput = resText
        step.output = resText
        step.status = 'success'
      } else if (node.subtype === 'variable_store') {
        const input = upstreamOf(node.id)
        const key = (node.config.variableKey || 'context').trim()
        const val = interpolate(node.config.variableValue || '{{input}}', input, vars)
        vars.set(key, val)
        outputs.set(node.id, val)
        lastOutput = val
        step.output = `Set {{${key}}} (${val.length} chars)`
        step.status = 'success'
      } else if (node.subtype === 'delay_wait') {
        const ms = Math.min(2000, Math.max(0, node.config.delayMs ?? 200))
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, ms)
          options.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer)
              reject(new Error('Execution aborted'))
            },
            { once: true },
          )
        })
        const input = upstreamOf(node.id)
        outputs.set(node.id, input)
        step.output = `Waited ${ms}ms`
        step.status = 'success'
      } else if (
        node.subtype === 'web_search' ||
        node.subtype === 'url_fetch' ||
        node.subtype === 'sql_query' ||
        node.subtype === 'hanzo_base' ||
        node.subtype === 'embeddings' ||
        node.subtype === 'reranker' ||
        node.subtype === 'knowledge_ingestion' ||
        node.subtype === 'knowledge_retrieval' ||
        node.subtype === 'vector_store' ||
        node.subtype === 'sandbox_code' ||
        node.subtype === 'loop_batch' ||
        node.subtype === 'hanzo_kms_secret' ||
        node.subtype === 'sub_flow'
      ) {
        const input = upstreamOf(node.id)
        const summary =
          node.subtype === 'embeddings'
            ? `[${node.config.model || 'zen-embedding-3'}] Embedded ${input.length} chars`
            : node.subtype === 'reranker'
              ? `[Reranker Top-${node.config.topK ?? 5}] ${input.slice(0, 400)}`
              : node.subtype === 'web_search'
                ? `[Web Search · top ${node.config.topK ?? 5}] Query: "${interpolate(node.config.query || '{{input}}', input, vars)}"`
                : node.subtype === 'url_fetch'
                  ? `[URL Fetch] Source: ${node.config.url || 'https://hanzo.ai'}`
                  : node.subtype === 'knowledge_ingestion'
                    ? `[Knowledge Base "${node.config.collection || 'workspace-kb'}"] Indexed ${input.length} chars`
                    : node.subtype === 'knowledge_retrieval' || node.subtype === 'vector_store'
                      ? `[Retrieved from "${node.config.collection || 'workspace-kb'}" · top ${node.config.topK ?? 5}] ${input.slice(0, 400)}`
                      : node.subtype === 'hanzo_kms_secret'
                        ? `[KMS Reference] ${node.config.secretPath || '/prod/flow/SECRET'} (resolved at deploy runtime)`
                        : `[${node.title}] ${input.slice(0, 400)}`
        outputs.set(node.id, summary)
        if (!node.config.toolMode) lastOutput = input || summary
        step.output = summary
        step.status = 'success'
      } else {
        // Delivery / Hanzo channel actions (mail, post, webhook, CRM)
        const input = upstreamOf(node.id)
        const rendered = interpolate(node.config.message || node.config.body || '{{input}}', input, vars)
        const target =
          node.subtype === 'email' || node.subtype === 'hanzo_mail'
            ? `Email → ${node.config.to || '(recipient unset)'} · Subject: ${node.config.subject || flow.name}`
            : node.subtype === 'sms'
              ? `SMS → ${node.config.to || '(number unset)'}`
              : node.subtype === 'crm_update'
                ? `CRM ${node.config.crmEntity || 'contact'}.${node.config.crmAction || 'upsert_note'}`
                : node.subtype === 'hanzo_post'
                  ? `Hanzo Post → ${node.config.channel || '#updates'}`
                  : `${node.config.method || 'POST'} ${node.config.url || '(url unset)'}`
        const output = `[Test preview] ${target}\n${rendered.slice(0, 320)}`
        outputs.set(node.id, output)
        lastOutput = rendered
        finalOutput = finalOutput || rendered
        step.output = output
        step.status = 'success'
      }
      step.durationMs = Math.max(1, Date.now() - t0)
    } catch (err) {
      failed = true
      step.status = 'error'
      step.error = err instanceof Error ? err.message : String(err)
      step.durationMs = Math.max(1, Date.now() - t0)
    }

    options.onStepUpdate?.([...steps])
  }

  const finishedMs = Date.now()
  const finishedAt = new Date(finishedMs).toISOString()
  const completedCount = steps.filter((s) => s.status === 'success').length
  const summary = failed
    ? `Failed at ${steps.find((s) => s.status === 'error')?.nodeTitle ?? 'step'}`
    : haltedByCondition
      ? `Stopped at condition (${completedCount}/${steps.length} steps)`
      : `Completed ${completedCount}/${steps.length} steps`

  return {
    id: `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    flowId: flow.id,
    flowName: flow.name,
    trigger: options.trigger ?? 'manual',
    status: failed ? 'failed' : 'completed',
    startedAt,
    finishedAt,
    durationMs: Math.max(1, finishedMs - startedMs),
    steps,
    summary,
    finalOutput: finalOutput || lastOutput,
  }
}
