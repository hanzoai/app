import { api } from '../lib/api'
import { bearer, org as currentOrg } from '../lib/session'
import { seedInitialFlows } from './templates'
import {
  topologicalSort,
  type FlowDefinition,
  type FlowNode,
  type FlowRunRecord,
  type FlowStepResult,
} from './types'

const STORAGE_FLOWS_PREFIX = 'hanzo.flow.definitions.v1.'
const STORAGE_RUNS_PREFIX = 'hanzo.flow.runs.v1.'
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

function interpolate(template: string, input: string): string {
  return template.replace(/\{\{\s*input\s*\}\}/gi, input)
}

function evaluateCondition(expression: string | undefined, input: string): { passed: boolean; reason: string } {
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

async function runEnsoAgentNode(
  node: FlowNode,
  upstreamOutput: string,
  signal?: AbortSignal,
): Promise<string> {
  const model = (node.config.model || 'enso').trim()
  const systemPrompt = (node.config.systemPrompt || 'You are a concise Hanzo Flow automation agent.').trim()
  const userPrompt = interpolate(node.config.prompt || '{{input}}', upstreamOutput)
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
  const res = await fetch(`${api()}/v1/chat/completions`, {
    method: 'POST',
    headers: flowHeaders(true),
    body: JSON.stringify({
      model,
      messages,
      temperature: typeof node.config.temperature === 'number' ? node.config.temperature : 0.3,
      max_tokens: 600,
    }),
    signal,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Enso gateway returned HTTP ${res.status}${errText ? `: ${errText.slice(0, 140)}` : ''}`)
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    output?: string
  }
  const content = data.choices?.[0]?.message?.content ?? data.output
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Enso returned an empty completion')
  }
  return content.trim()
}

export interface ExecuteFlowOptions {
  trigger?: 'manual' | 'schedule' | 'webhook'
  sampleInput?: string
  signal?: AbortSignal
  onStepUpdate?: (steps: FlowStepResult[]) => void
}

/**
 * Executes a workflow graph topologically.
 * Enso AI Agent nodes invoke `POST ${api()}/v1/chat/completions` live.
 * Side-effect actions (webhook/HTTP/email/SMS/CRM) emit a validated dry-run payload
 * receipt in Test Run mode so testing never unexpectedly pages or emails recipients.
 */
export async function executeFlow(
  flow: FlowDefinition,
  options: ExecuteFlowOptions = {},
): Promise<FlowRunRecord> {
  const startedMs = Date.now()
  const startedAt = new Date(startedMs).toISOString()
  const ordered = topologicalSort(flow.nodes, flow.edges)
  const steps: FlowStepResult[] = ordered.map((node) => ({
    nodeId: node.id,
    nodeTitle: node.title,
    kind: node.kind,
    status: 'pending',
  }))
  options.onStepUpdate?.([...steps])

  const outputs = new Map<string, string>()
  let failed = false
  let haltedByCondition = false
  let lastOutput = options.sampleInput ?? ''

  const upstreamOf = (nodeId: string): string => {
    const incoming = flow.edges.filter((e) => e.target === nodeId)
    if (incoming.length === 0) return lastOutput
    const parts = incoming
      .map((e) => outputs.get(e.source))
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
    return parts.length > 0 ? parts.join('\n\n') : lastOutput
  }

  for (let i = 0; i < ordered.length; i++) {
    const node = ordered[i]!
    const step = steps[i]!
    if (failed || haltedByCondition) {
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
      } else if (node.kind === 'agent') {
        const input = upstreamOf(node.id)
        const reply = await runEnsoAgentNode(node, input, options.signal)
        outputs.set(node.id, reply)
        lastOutput = reply
        step.output = reply
        step.status = 'success'
      } else if (node.kind === 'condition') {
        const input = upstreamOf(node.id)
        const verdict = evaluateCondition(node.config.expression, input)
        outputs.set(node.id, input)
        step.output = verdict.reason
        step.status = 'success'
        if (!verdict.passed) {
          haltedByCondition = true
        }
      } else {
        // Action step: render resolved dry-run delivery payload
        const input = upstreamOf(node.id)
        const rendered = interpolate(node.config.message || node.config.body || '{{input}}', input)
        const target =
          node.subtype === 'email'
            ? `Email → ${node.config.to || '(recipient unset)'} · Subject: ${node.config.subject || flow.name}`
            : node.subtype === 'sms'
              ? `SMS → ${node.config.to || '(number unset)'}`
              : node.subtype === 'crm_update'
                ? `CRM ${node.config.crmEntity || 'contact'}.${node.config.crmAction || 'upsert_note'}`
                : `${node.config.method || 'POST'} ${node.config.url || '(url unset)'}`
        const output = `[Test preview] ${target}\n${rendered.slice(0, 320)}`
        outputs.set(node.id, output)
        lastOutput = output
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
  }
}
