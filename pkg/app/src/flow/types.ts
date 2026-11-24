/**
 * Canonical Flow graph, node, schedule, and run-history schema.
 *
 * Mirrors `@hanzo/ui/flow`'s graph/node/edge/schedule contract so `@hanzo/app`
 * can swap directly onto `@hanzo/ui/flow` primitives once published without
 * migrating stored workflows or API payloads.
 */

export type FlowView = 'canvas' | 'scheduled' | 'runs' | 'templates'

export type FlowNodeKind = 'trigger' | 'agent' | 'condition' | 'action' | 'schedule'

export type FlowNodeSubtype =
  | 'manual'
  | 'webhook'
  | 'schedule'
  | 'event'
  | 'enso_agent'
  | 'llm_prompt'
  | 'research_agent'
  | 'if_condition'
  | 'router'
  | 'http_request'
  | 'webhook_send'
  | 'email'
  | 'sms'
  | 'crm_update'
  | 'cron_schedule'

export interface FlowPosition {
  x: number
  y: number
}

export interface FlowNodeConfig {
  /** Enso / LLM model identifier (e.g. `enso`, `zen-4`, `zen-4-pro`). */
  model?: string
  /** Instruction or prompt template supporting `{{input}}` interpolation. */
  prompt?: string
  /** System instruction for Enso agent nodes. */
  systemPrompt?: string
  /** Sampling temperature (0-1). */
  temperature?: number
  /** HTTP / webhook endpoint URL. */
  url?: string
  /** HTTP method for request / webhook actions. */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Optional JSON request body template. */
  body?: string
  /** Recipient for email or SMS actions. */
  to?: string
  /** Subject line for email actions. */
  subject?: string
  /** Message body template for email / SMS / webhook actions. */
  message?: string
  /** CRM object / entity type (e.g. `contact`, `deal`, `lead`). */
  crmEntity?: string
  /** CRM action (e.g. `upsert_note`, `update_stage`, `create_task`). */
  crmAction?: string
  /** Condition expression evaluated against previous step output. */
  expression?: string
  /** 5-field cron expression (`min hour dom mon dow`). */
  cron?: string
  /** IANA timezone for scheduled runs. */
  timezone?: string
  /** Optional sample payload for manual/webhook test runs. */
  sampleInput?: string
}

export interface FlowNode {
  id: string
  kind: FlowNodeKind
  subtype: FlowNodeSubtype
  title: string
  description?: string
  position: FlowPosition
  config: FlowNodeConfig
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  label?: string
}

export interface FlowSchedule {
  enabled: boolean
  cron: string
  timezone: string
  lastRunAt?: string
  nextRunAt?: string
}

export type FlowStatus = 'active' | 'draft' | 'paused'

export interface FlowDefinition {
  id: string
  name: string
  description: string
  status: FlowStatus
  templateId?: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  schedule?: FlowSchedule
  createdAt: string
  updatedAt: string
}

export type FlowStepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped'

export interface FlowStepResult {
  nodeId: string
  nodeTitle: string
  kind: FlowNodeKind
  status: FlowStepStatus
  output?: string
  error?: string
  durationMs?: number
  startedAt?: string
}

export interface FlowRunRecord {
  id: string
  flowId: string
  flowName: string
  trigger: 'manual' | 'schedule' | 'webhook'
  status: 'running' | 'completed' | 'failed'
  startedAt: string
  finishedAt?: string
  durationMs?: number
  steps: FlowStepResult[]
  summary?: string
}

export interface FlowRouteState {
  view: FlowView
  flowId: string | null
  createNew: boolean
}

export const FLOW_STUDIO_URL = 'https://flow.hanzo.ai'

export const FLOW_MODELS: readonly { id: string; label: string }[] = [
  { id: 'enso', label: 'Enso' },
  { id: 'enso-auto', label: 'Enso Auto' },
  { id: 'enso-pro', label: 'Enso Pro' },
  { id: 'enso-max', label: 'Enso Max' },
  { id: 'enso-flash', label: 'Enso Flash' },
  { id: 'enso-ultra', label: 'Enso Ultra' },
  { id: 'zen6', label: 'Zen 6' },
  { id: 'zen6-coder', label: 'Zen 6 Coder' },
  { id: 'zen6-flash', label: 'Zen 6 Flash' },
  { id: 'zen6-max', label: 'Zen 6 Max' },
]

export const CRON_PRESETS: readonly { label: string; cron: string }[] = [
  { label: 'Every 15 min', cron: '*/15 * * * *' },
  { label: 'Hourly', cron: '0 * * * *' },
  { label: 'Daily 08:00', cron: '0 8 * * *' },
  { label: 'Weekdays 09:00', cron: '0 9 * * 1-5' },
  { label: 'Weekly Mon 09:00', cron: '0 9 * * 1' },
]

export function flowPath(sub?: string): string {
  const clean = (sub ?? '').replace(/^\/+|\/+$/g, '')
  return !clean || clean === 'canvas' || clean === 'flows' ? '/flow' : `/flow/${clean}`
}

export function parseFlowRoute(pathname: string): FlowRouteState {
  const clean = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  if (clean === '/flow' || clean === '/') {
    return { view: 'canvas', flowId: null, createNew: false }
  }
  const rest = clean.startsWith('/flow/') ? clean.slice('/flow/'.length) : ''
  const [first] = rest.split('/')
  const seg = (first ?? '').toLowerCase()
  if (!seg || seg === 'canvas' || seg === 'flows') {
    return { view: 'canvas', flowId: null, createNew: false }
  }
  if (seg === 'new') {
    return { view: 'canvas', flowId: null, createNew: true }
  }
  if (seg === 'scheduled' || seg === 'schedules') {
    return { view: 'scheduled', flowId: null, createNew: false }
  }
  if (seg === 'runs' || seg === 'history') {
    return { view: 'runs', flowId: null, createNew: false }
  }
  if (seg === 'templates' || seg === 'gallery') {
    return { view: 'templates', flowId: null, createNew: false }
  }
  return { view: 'canvas', flowId: decodeURIComponent(first ?? ''), createNew: false }
}

const CRON_FIELD = /^(\*|\d+(-\d+)?(,\d+(-\d+)?)*)(\/\d+)?$/

export function describeCron(expr: string): { valid: boolean; human: string } {
  const trimmed = expr.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length !== 5 || parts.some((p) => !CRON_FIELD.test(p))) {
    return { valid: false, human: 'Expected 5 cron fields (min hour day month weekday)' }
  }
  const [min, hour, dom, mon, dow] = parts as [string, string, string, string, string]
  if (min.startsWith('*/') && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return { valid: true, human: `Every ${min.slice(2)} minutes` }
  }
  if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return { valid: true, human: 'Every hour on the hour' }
  }
  if (min === '0' && hour.startsWith('*/') && dom === '*' && mon === '*' && dow === '*') {
    return { valid: true, human: `Every ${hour.slice(2)} hours` }
  }
  const pad = (v: string) => v.padStart(2, '0')
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*' && mon === '*') {
    const time = `${pad(hour)}:${pad(min)}`
    if (dow === '*') return { valid: true, human: `Daily at ${time}` }
    if (dow === '1-5') return { valid: true, human: `Weekdays at ${time}` }
    if (dow === '0,6' || dow === '6,0') return { valid: true, human: `Weekends at ${time}` }
    const days: Record<string, string> = {
      '0': 'Sundays',
      '1': 'Mondays',
      '2': 'Tuesdays',
      '3': 'Wednesdays',
      '4': 'Thursdays',
      '5': 'Fridays',
      '6': 'Saturdays',
      '7': 'Sundays',
    }
    if (days[dow]) return { valid: true, human: `${days[dow]} at ${time}` }
  }
  return { valid: true, human: `Cron: ${trimmed}` }
}

/**
 * Deterministic topological ordering for workflow execution.
 * Disconnected nodes and cycles fall back cleanly in left-to-right canvas order.
 */
export function topologicalSort(nodes: readonly FlowNode[], edges: readonly FlowEdge[]): FlowNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adj.set(n.id, [])
  }
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target) || e.source === e.target) continue
    adj.get(e.source)!.push(e.target)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }
  const byPos = (a: string, b: string) => {
    const na = byId.get(a)!
    const nb = byId.get(b)!
    return na.position.x - nb.position.x || na.position.y - nb.position.y
  }
  const queue = [...inDegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id)
    .sort(byPos)
  const ordered: FlowNode[] = []
  const visited = new Set<string>()
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    ordered.push(byId.get(id)!)
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, deg)
      if (deg === 0) {
        queue.push(next)
        queue.sort(byPos)
      }
    }
  }
  if (ordered.length < nodes.length) {
    const rest = nodes
      .filter((n) => !visited.has(n.id))
      .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
    ordered.push(...rest)
  }
  return ordered
}

export function createNodeId(prefix = 'node'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

export function createFlowId(): string {
  return `flow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export function makeDefaultNode(kind: FlowNodeKind, index: number): FlowNode {
  const x = 48 + (index % 4) * 288
  const y = 64 + Math.floor(index / 4) * 176
  switch (kind) {
    case 'trigger':
      return {
        id: createNodeId('trig'),
        kind: 'trigger',
        subtype: 'webhook',
        title: 'Webhook trigger',
        description: 'Starts when an event or manual test arrives',
        position: { x, y },
        config: {
          sampleInput: '{"event":"lead.created","company":"Acme Labs","note":"Interested in enterprise plan"}',
        },
      }
    case 'schedule':
      return {
        id: createNodeId('sched'),
        kind: 'schedule',
        subtype: 'cron_schedule',
        title: 'Cron schedule',
        description: 'Runs automatically on a recurring cadence',
        position: { x, y },
        config: {
          cron: '0 8 * * 1-5',
          timezone: 'UTC',
          sampleInput: 'Scheduled tick',
        },
      }
    case 'agent':
      return {
        id: createNodeId('agent'),
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso AI agent',
        description: 'Routes reasoning and synthesis through Enso',
        position: { x, y },
        config: {
          model: 'enso',
          systemPrompt: 'You are a concise Hanzo automation agent. Produce structured, actionable output.',
          prompt: 'Analyze the incoming payload and write the next step:\n\n{{input}}',
          temperature: 0.3,
        },
      }
    case 'condition':
      return {
        id: createNodeId('cond'),
        kind: 'condition',
        subtype: 'if_condition',
        title: 'Condition check',
        description: 'Continues only when the upstream output matches',
        position: { x, y },
        config: {
          expression: 'non-empty',
        },
      }
    case 'action':
      return {
        id: createNodeId('act'),
        kind: 'action',
        subtype: 'http_request',
        title: 'HTTP / Webhook action',
        description: 'Delivers the agent result to an external endpoint or channel',
        position: { x, y },
        config: {
          method: 'POST',
          url: 'https://api.hanzo.ai/v1/workflow/hooks/notify',
          message: '{{input}}',
        },
      }
  }
}
