/**
 * Canonical Flow Studio schema, 9-category component catalog, typed ports,
 * schedule/cron utilities, topological ordering, and Playground session types.
 */

export type FlowView = 'canvas' | 'knowledge' | 'scheduled' | 'runs' | 'templates'

export type FlowNodeCategory =
  | 'Input & Output'
  | 'Data Sources'
  | 'Models & Agents'
  | 'LLM Operations'
  | 'Files & Knowledge'
  | 'Processing'
  | 'Flow Control'
  | 'Utilities'
  | 'Hanzo'

export const FLOW_NODE_CATEGORIES: readonly FlowNodeCategory[] = [
  'Input & Output',
  'Data Sources',
  'Models & Agents',
  'LLM Operations',
  'Files & Knowledge',
  'Processing',
  'Flow Control',
  'Utilities',
  'Hanzo',
]

export type FlowNodeKind =
  | 'trigger'
  | 'agent'
  | 'condition'
  | 'action'
  | 'schedule'
  | 'data'
  | 'llm'
  | 'knowledge'
  | 'processing'
  | 'control'
  | 'utility'
  | 'hanzo'
  | 'note'

export type FlowNodeSubtype =
  // Input & Output
  | 'chat_input'
  | 'chat_output'
  | 'text_input'
  | 'text_output'
  | 'webhook'
  | 'cron_schedule'
  // Data Sources
  | 'api_request'
  | 'web_search'
  | 'url_fetch'
  | 'sql_query'
  | 'hanzo_base'
  // Models & Agents
  | 'enso_agent'
  | 'language_model'
  | 'structured_output'
  | 'multi_agent_supervisor'
  | 'sub_flow'
  // LLM Operations
  | 'prompt_template'
  | 'embeddings'
  | 'reranker'
  | 'conversation_memory'
  | 'guardrail'
  // Files & Knowledge
  | 'file_loader'
  | 'knowledge_ingestion'
  | 'knowledge_retrieval'
  | 'text_splitter'
  | 'vector_store'
  // Processing
  | 'sandbox_code'
  | 'json_transform'
  | 'text_parser'
  | 'merge_combine'
  // Flow Control
  | 'if_condition'
  | 'switch_router'
  | 'loop_batch'
  | 'delay_wait'
  // Utilities
  | 'sticky_note'
  | 'http_response'
  | 'variable_store'
  // Hanzo
  | 'hanzo_enso_router'
  | 'hanzo_kms_secret'
  | 'hanzo_post'
  | 'hanzo_mail'
  | 'crm_update'
  // Legacy & shorthand aliases retained for stored flow compatibility
  | 'embedding'
  | 'knowledge_ingest'
  | 'knowledge_search'
  | 'retriever'
  | 'manual'
  | 'schedule'
  | 'event'
  | 'llm_prompt'
  | 'research_agent'
  | 'router'
  | 'http_request'
  | 'webhook_send'
  | 'email'
  | 'sms'

export type FlowPortId = 'input' | 'output' | 'tools' | 'true' | 'false'

export interface FlowPortSpec {
  id: FlowPortId
  label: string
}

export interface FlowPosition {
  x: number
  y: number
}

export interface FlowNodeConfig {
  /** Enso / Zen model identifier (e.g. `enso`, `enso-pro`, `zen6`). */
  model?: string
  /** Instruction or prompt template supporting `{{input}}` / `{{context}}` interpolation. */
  prompt?: string
  /** System instruction for Enso agent and language model nodes. */
  systemPrompt?: string
  /** Sampling temperature (0-1). */
  temperature?: number
  /** JSON schema or structured fields spec for Structured Output nodes. */
  schema?: string
  /** HTTP / webhook / fetch endpoint URL. */
  url?: string
  /** HTTP method for API Request / webhook nodes. */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Optional JSON request headers template. */
  headers?: string
  /** Optional JSON request body template. */
  body?: string
  /** When true, node acts as a callable tool feeding an Enso Agent Tools port. */
  toolMode?: boolean
  /** SQL query template for SQL Query nodes. */
  query?: string
  /** Collection or knowledge base name for Hanzo Base / Vector Store / Knowledge nodes. */
  collection?: string
  /** File path or inline source text for File Loader nodes. */
  filePath?: string
  /** Chunk size for Text Splitter nodes. */
  chunkSize?: number
  /** Chunk overlap for Text Splitter nodes. */
  chunkOverlap?: number
  /** Top-K count for Reranker / Vector Store / Knowledge Retrieval. */
  topK?: number
  /** Conversation memory message window. */
  memoryWindow?: number
  /** Code snippet for Sandbox Code Exec nodes. */
  code?: string
  /** JSON path or transform expression for JSON Transform nodes. */
  transform?: string
  /** Parser template or pattern for Text Parser nodes. */
  pattern?: string
  /** Delimiter for Merge / Combine or Loop / Batch nodes. */
  delimiter?: string
  /** Delay duration in milliseconds for Delay / Wait nodes. */
  delayMs?: number
  /** Recipient for email / Hanzo Mail / SMS actions. */
  to?: string
  /** Subject line for email / Hanzo Mail actions. */
  subject?: string
  /** Channel or destination for Hanzo Post / notifications. */
  channel?: string
  /** Message body template for output / delivery actions. */
  message?: string
  /** CRM object / entity type (e.g. `contact`, `deal`, `lead`). */
  crmEntity?: string
  /** CRM action (e.g. `upsert_note`, `update_stage`, `create_task`). */
  crmAction?: string
  /** KMS secret path reference (path only, never secret value). */
  secretPath?: string
  /** Variable key for Variable Store nodes. */
  variableKey?: string
  /** Variable default value for Variable Store nodes. */
  variableValue?: string
  /** Target sub-flow ID or name for Sub-Flow nodes. */
  subFlowId?: string
  /** HTTP response status code for HTTP Response nodes. */
  statusCode?: number
  /** Condition or guardrail expression evaluated against upstream output. */
  expression?: string
  /** 5-field cron expression (`min hour dom mon dow`). */
  cron?: string
  /** IANA timezone for scheduled runs. */
  timezone?: string
  /** Optional sample payload for manual/webhook/chat test runs. */
  sampleInput?: string
  /** Sticky Note (README) markdown text rendered directly on the canvas. */
  noteBody?: string
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
  /** Server UUID assigned by `/v1/flow/workflows` when synced to Hanzo Flow. */
  remoteId?: string
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
  subtype?: FlowNodeSubtype
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
  trigger: 'manual' | 'schedule' | 'webhook' | 'playground'
  status: 'running' | 'completed' | 'failed'
  startedAt: string
  finishedAt?: string
  durationMs?: number
  steps: FlowStepResult[]
  summary?: string
  finalOutput?: string
}

export interface PlaygroundMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  model?: string
  steps?: FlowStepResult[]
  error?: string
  streaming?: boolean
}

export interface PlaygroundSession {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  messages: PlaygroundMessage[]
}

export interface FlowRouteState {
  view: FlowView
  flowId: string | null
  createNew: boolean
}

export interface FlowComponentSpec {
  subtype: FlowNodeSubtype
  kind: FlowNodeKind
  category: FlowNodeCategory
  label: string
  description: string
  inputs: readonly FlowPortSpec[]
  outputs: readonly FlowPortSpec[]
  defaultConfig: FlowNodeConfig
  isNote?: boolean
}

export const FLOW_STUDIO_URL = 'https://flow.hanzo.ai'

/** Canonical Hanzo Enso & Zen model catalog. */
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

export const EMBEDDING_MODELS: readonly { id: 'zen-embedding-3' | 'zen-embedding'; label: string }[] = [
  { id: 'zen-embedding-3', label: 'Zen Embedding 3' },
  { id: 'zen-embedding', label: 'Zen Embedding' },
]

export type EmbeddingModelId = (typeof EMBEDDING_MODELS)[number]['id']

/** Normalizes any embedding model identifier to a live Hanzo Cloud embedding model (defaults to `zen-embedding-3`). */
export function normalizeEmbeddingModel(model?: string | null): EmbeddingModelId {
  const clean = (model ?? '').trim().toLowerCase()
  if (clean === 'zen-embedding') return 'zen-embedding'
  return 'zen-embedding-3'
}

/** Canonical slug for MCP server registration (`hanzo-<slug>`). */
export function flowMcpSlug(name: string, fallbackId?: string): string {
  const raw = (name || fallbackId || 'flow')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
  return raw || 'flow'
}

export const CRON_PRESETS: readonly { label: string; cron: string }[] = [
  { label: 'Every 15 min', cron: '*/15 * * * *' },
  { label: 'Hourly', cron: '0 * * * *' },
  { label: 'Daily 08:00', cron: '0 8 * * *' },
  { label: 'Weekdays 09:00', cron: '0 9 * * 1-5' },
  { label: 'Weekly Mon 09:00', cron: '0 9 * * 1' },
]

const P_IN: readonly FlowPortSpec[] = [{ id: 'input', label: 'Input' }]
const P_OUT: readonly FlowPortSpec[] = [{ id: 'output', label: 'Output' }]
const P_IN_TOOLS: readonly FlowPortSpec[] = [
  { id: 'input', label: 'Input' },
  { id: 'tools', label: 'Tools' },
]
const P_OUT_TOOLS: readonly FlowPortSpec[] = [
  { id: 'output', label: 'Output' },
  { id: 'tools', label: 'Tools' },
]
const P_TRUE_FALSE: readonly FlowPortSpec[] = [
  { id: 'true', label: 'True' },
  { id: 'false', label: 'False' },
]
const P_NONE: readonly FlowPortSpec[] = []

/** Full searchable component library (42 nodes across 9 categories). */
export const FLOW_COMPONENT_CATALOG: readonly FlowComponentSpec[] = [
  // ── Input & Output (6) ─────────────────────────────────────────────────
  {
    subtype: 'chat_input',
    kind: 'trigger',
    category: 'Input & Output',
    label: 'Chat Input',
    description: 'Receives user messages from the Playground or /v1/workflow chat runs',
    inputs: P_NONE,
    outputs: P_OUT,
    defaultConfig: { sampleInput: 'Tell me about Pikachu' },
  },
  {
    subtype: 'chat_output',
    kind: 'action',
    category: 'Input & Output',
    label: 'Chat Output',
    description: 'Streams the final assistant response back into the Playground transcript',
    inputs: P_IN,
    outputs: P_NONE,
    defaultConfig: { message: '{{input}}' },
  },
  {
    subtype: 'text_input',
    kind: 'trigger',
    category: 'Input & Output',
    label: 'Text Input',
    description: 'Static or parameterized text input for prompt pipelines',
    inputs: P_NONE,
    outputs: P_OUT,
    defaultConfig: { sampleInput: 'Provide a concise technical summary.' },
  },
  {
    subtype: 'text_output',
    kind: 'action',
    category: 'Input & Output',
    label: 'Text Output',
    description: 'Emits plain text or markdown output from a pipeline',
    inputs: P_IN,
    outputs: P_NONE,
    defaultConfig: { message: '{{input}}' },
  },
  {
    subtype: 'webhook',
    kind: 'trigger',
    category: 'Input & Output',
    label: 'Webhook Trigger',
    description: 'Starts the workflow on POST /v1/workflow/hooks/inbound',
    inputs: P_NONE,
    outputs: P_OUT,
    defaultConfig: {
      sampleInput: '{"event":"lead.created","company":"Northstar Labs","priority":"high"}',
    },
  },
  {
    subtype: 'cron_schedule',
    kind: 'schedule',
    category: 'Input & Output',
    label: 'Cron Schedule',
    description: 'Triggers the workflow automatically on a recurring cron schedule',
    inputs: P_NONE,
    outputs: P_OUT,
    defaultConfig: { cron: '0 8 * * 1-5', timezone: 'UTC', sampleInput: 'Daily scheduled run' },
  },

  // ── Data Sources (5) ───────────────────────────────────────────────────
  {
    subtype: 'api_request',
    kind: 'data',
    category: 'Data Sources',
    label: 'API Request',
    description: 'Calls an HTTP REST API directly or exposes it as an Agent tool',
    inputs: P_IN,
    outputs: P_OUT_TOOLS,
    defaultConfig: {
      method: 'GET',
      url: 'https://pokeapi.co/api/v2/pokemon/{{query}}',
      toolMode: true,
    },
  },
  {
    subtype: 'web_search',
    kind: 'data',
    category: 'Data Sources',
    label: 'Web Search',
    description: 'Searches live web sources and returns grounded snippets',
    inputs: P_IN,
    outputs: P_OUT_TOOLS,
    defaultConfig: { query: '{{input}}', topK: 5, toolMode: true },
  },
  {
    subtype: 'url_fetch',
    kind: 'data',
    category: 'Data Sources',
    label: 'URL Fetch',
    description: 'Fetches and extracts readable content from one or more URLs',
    inputs: P_IN,
    outputs: P_OUT_TOOLS,
    defaultConfig: { url: 'https://hanzo.ai/docs', toolMode: false },
  },
  {
    subtype: 'sql_query',
    kind: 'data',
    category: 'Data Sources',
    label: 'SQL Query',
    description: 'Executes a parameterized read query against a configured SQL source',
    inputs: P_IN,
    outputs: P_OUT_TOOLS,
    defaultConfig: { query: 'SELECT id, name, status FROM records LIMIT 20;' },
  },
  {
    subtype: 'hanzo_base',
    kind: 'data',
    category: 'Data Sources',
    label: 'Hanzo Base',
    description: 'Queries or writes org-scoped records in Hanzo Base',
    inputs: P_IN,
    outputs: P_OUT_TOOLS,
    defaultConfig: { collection: 'flow_records', query: '{{input}}' },
  },

  // ── Models & Agents (5) ────────────────────────────────────────────────
  {
    subtype: 'enso_agent',
    kind: 'agent',
    category: 'Models & Agents',
    label: 'Enso Agent',
    description: 'Autonomous agent powered by Hanzo Enso with tool-calling support',
    inputs: P_IN_TOOLS,
    outputs: P_OUT,
    defaultConfig: {
      model: 'enso',
      systemPrompt: 'You are a helpful Hanzo Enso agent. Use connected tools and respond clearly.',
      prompt: '{{input}}',
      temperature: 0.3,
    },
  },
  {
    subtype: 'language_model',
    kind: 'agent',
    category: 'Models & Agents',
    label: 'Language Model',
    description: 'Direct Enso or Zen completion node for fast deterministic prompting',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: {
      model: 'enso',
      systemPrompt: 'You are a concise assistant powered by Hanzo Enso.',
      prompt: '{{input}}',
      temperature: 0.3,
    },
  },
  {
    subtype: 'structured_output',
    kind: 'agent',
    category: 'Models & Agents',
    label: 'Structured Output',
    description: 'Extracts typed JSON matching your schema using Enso',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: {
      model: 'enso-pro',
      systemPrompt: 'Return ONLY valid JSON matching the requested schema. No markdown fences.',
      schema: '{"summary":"string","key_points":["string"],"confidence":"number"}',
      prompt: 'Extract structured fields from:\n\n{{input}}',
      temperature: 0.1,
    },
  },
  {
    subtype: 'multi_agent_supervisor',
    kind: 'agent',
    category: 'Models & Agents',
    label: 'Multi-Agent Supervisor',
    description: 'Coordinates specialist sub-agents and merges their outputs',
    inputs: P_IN_TOOLS,
    outputs: P_OUT,
    defaultConfig: {
      model: 'enso-pro',
      systemPrompt: 'Coordinate specialist perspectives (Research, Planning, Critique) and produce one unified answer.',
      prompt: 'Objective:\n{{input}}',
      temperature: 0.3,
    },
  },
  {
    subtype: 'sub_flow',
    kind: 'agent',
    category: 'Models & Agents',
    label: 'Sub-Flow',
    description: 'Invokes another reusable Hanzo Flow pipeline as a step',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { subFlowId: 'basic-prompting', prompt: '{{input}}' },
  },

  // ── LLM Operations (5) ─────────────────────────────────────────────────
  {
    subtype: 'prompt_template',
    kind: 'llm',
    category: 'LLM Operations',
    label: 'Prompt Template',
    description: 'Formats variables like {{input}} and {{context}} into a clean prompt',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: {
      prompt: 'Analyze the following input and provide clear, actionable insights:\n\n{{input}}',
    },
  },
  {
    subtype: 'embeddings',
    kind: 'llm',
    category: 'LLM Operations',
    label: 'Embeddings',
    description: 'Generates live semantic float vectors via POST /v1/embeddings (zen-embedding-3)',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { model: 'zen-embedding-3' },
  },
  {
    subtype: 'reranker',
    kind: 'llm',
    category: 'LLM Operations',
    label: 'Reranker',
    description: 'Re-scores retrieved passages by semantic relevance and keeps Top-K',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { topK: 5 },
  },
  {
    subtype: 'conversation_memory',
    kind: 'llm',
    category: 'LLM Operations',
    label: 'Conversation Memory',
    description: 'Retains recent session turns and injects context downstream',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { memoryWindow: 10 },
  },
  {
    subtype: 'guardrail',
    kind: 'llm',
    category: 'LLM Operations',
    label: 'Guardrail',
    description: 'Validates safety, policy, or formatting constraints before continuing',
    inputs: P_IN,
    outputs: P_TRUE_FALSE,
    defaultConfig: { expression: 'non-empty' },
  },

  // ── Files & Knowledge (5) ──────────────────────────────────────────────
  {
    subtype: 'file_loader',
    kind: 'knowledge',
    category: 'Files & Knowledge',
    label: 'File Loader',
    description: 'Loads PDF, Markdown, CSV, or plain text documents into the graph',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: {
      filePath: 'quarterly-report.md',
      sampleInput: 'Q4 Revenue: $14.2M (+34% YoY). Gross Margin: 78%. Operating Income: $3.1M.',
    },
  },
  {
    subtype: 'knowledge_ingestion',
    kind: 'knowledge',
    category: 'Files & Knowledge',
    label: 'Knowledge Ingestion',
    description: 'Indexes documents into Hanzo Cloud Knowledge via POST /v1/knowledge/import',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { collection: 'workspace-kb', model: 'zen-embedding-3' },
  },
  {
    subtype: 'knowledge_retrieval',
    kind: 'knowledge',
    category: 'Files & Knowledge',
    label: 'Knowledge Retrieval',
    description: 'Hybrid semantic + full-text search via POST /v1/knowledge/search and files/retrieve',
    inputs: P_IN,
    outputs: P_OUT_TOOLS,
    defaultConfig: { collection: 'workspace-kb', topK: 5 },
  },
  {
    subtype: 'text_splitter',
    kind: 'knowledge',
    category: 'Files & Knowledge',
    label: 'Text Splitter',
    description: 'Splits long documents into overlapping chunks for RAG indexing',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { chunkSize: 800, chunkOverlap: 120 },
  },
  {
    subtype: 'vector_store',
    kind: 'knowledge',
    category: 'Files & Knowledge',
    label: 'Vector Store',
    description: 'Queries Hanzo Cloud Knowledge + cosine similarity vectors via zen-embedding-3',
    inputs: P_IN,
    outputs: P_OUT_TOOLS,
    defaultConfig: { collection: 'hanzo-vectors', model: 'zen-embedding-3', topK: 6 },
  },

  // ── Processing (4) ─────────────────────────────────────────────────────
  {
    subtype: 'sandbox_code',
    kind: 'processing',
    category: 'Processing',
    label: 'Sandbox Code Exec',
    description: 'Runs deterministic data transformations or sandboxed script logic',
    inputs: P_IN,
    outputs: P_OUT_TOOLS,
    defaultConfig: { code: 'return input.trim()' },
  },
  {
    subtype: 'json_transform',
    kind: 'processing',
    category: 'Processing',
    label: 'JSON Transform',
    description: 'Extracts keys or formats structured JSON payloads cleanly',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { transform: 'pretty' },
  },
  {
    subtype: 'text_parser',
    kind: 'processing',
    category: 'Processing',
    label: 'Text Parser',
    description: 'Formats or extracts patterns from upstream text messages',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { pattern: '{{input}}' },
  },
  {
    subtype: 'merge_combine',
    kind: 'processing',
    category: 'Processing',
    label: 'Merge / Combine',
    description: 'Combines multiple upstream branches into one structured input',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { delimiter: '\n\n---\n\n' },
  },

  // ── Flow Control (4) ───────────────────────────────────────────────────
  {
    subtype: 'if_condition',
    kind: 'condition',
    category: 'Flow Control',
    label: 'Condition (If/Else)',
    description: 'Branches execution to True or False ports based on a rule',
    inputs: P_IN,
    outputs: P_TRUE_FALSE,
    defaultConfig: { expression: 'non-empty' },
  },
  {
    subtype: 'switch_router',
    kind: 'condition',
    category: 'Flow Control',
    label: 'Switch / Router',
    description: 'Routes payloads dynamically based on keyword or expression match',
    inputs: P_IN,
    outputs: P_TRUE_FALSE,
    defaultConfig: { expression: 'contains:urgent' },
  },
  {
    subtype: 'loop_batch',
    kind: 'control',
    category: 'Flow Control',
    label: 'Loop / Batch',
    description: 'Iterates over line-delimited or JSON array items in sequence',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { delimiter: '\n' },
  },
  {
    subtype: 'delay_wait',
    kind: 'control',
    category: 'Flow Control',
    label: 'Delay / Wait',
    description: 'Pauses pipeline execution for a configured interval',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { delayMs: 250 },
  },

  // ── Utilities (3) ──────────────────────────────────────────────────────
  {
    subtype: 'sticky_note',
    kind: 'note',
    category: 'Utilities',
    label: 'Sticky Note (README)',
    description: 'Editable documentation card placed directly on the canvas',
    inputs: P_NONE,
    outputs: P_NONE,
    isNote: true,
    defaultConfig: {
      noteBody: 'README\n\nExplain how this flow works and what prompts to try in Playground.',
    },
  },
  {
    subtype: 'http_response',
    kind: 'action',
    category: 'Utilities',
    label: 'HTTP Response',
    description: 'Returns a JSON or text HTTP response to webhook callers',
    inputs: P_IN,
    outputs: P_NONE,
    defaultConfig: { statusCode: 200, message: '{{input}}' },
  },
  {
    subtype: 'variable_store',
    kind: 'utility',
    category: 'Utilities',
    label: 'Variable Store',
    description: 'Reads or writes reusable flow-scoped state variables',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { variableKey: 'context', variableValue: '{{input}}' },
  },

  // ── Hanzo (5) ──────────────────────────────────────────────────────────
  {
    subtype: 'hanzo_enso_router',
    kind: 'hanzo',
    category: 'Hanzo',
    label: 'Hanzo Enso Router',
    description: 'Routes prompts across Enso Auto, Pro, Flash, and Zen models dynamically',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: {
      model: 'enso-auto',
      systemPrompt: 'Route and answer with maximum quality-to-latency efficiency.',
      prompt: '{{input}}',
      temperature: 0.25,
    },
  },
  {
    subtype: 'hanzo_kms_secret',
    kind: 'hanzo',
    category: 'Hanzo',
    label: 'Hanzo KMS Secret',
    description: 'Resolves a secret reference path from Hanzo KMS at runtime',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { secretPath: '/prod/flow/WEBHOOK_SIGNING_KEY' },
  },
  {
    subtype: 'hanzo_post',
    kind: 'hanzo',
    category: 'Hanzo',
    label: 'Hanzo Post',
    description: 'Publishes updates to Hanzo channels, social feeds, or webhooks',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { channel: '#updates', message: '{{input}}' },
  },
  {
    subtype: 'hanzo_mail',
    kind: 'hanzo',
    category: 'Hanzo',
    label: 'Hanzo Mail',
    description: 'Dispatches transactional digests or outreach via Hanzo Mail',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { to: 'team@hanzo.ai', subject: 'Hanzo Flow update', message: '{{input}}' },
  },
  {
    subtype: 'crm_update',
    kind: 'hanzo',
    category: 'Hanzo',
    label: 'CRM Action',
    description: 'Creates or updates contacts, deals, notes, and follow-ups in Hanzo CRM',
    inputs: P_IN,
    outputs: P_OUT,
    defaultConfig: { crmEntity: 'contact', crmAction: 'upsert_note', message: '{{input}}' },
  },
]

const CATALOG_BY_SUBTYPE = new Map<FlowNodeSubtype, FlowComponentSpec>(
  FLOW_COMPONENT_CATALOG.map((spec) => [spec.subtype, spec]),
)

const LEGACY_SUBTYPE_MAP: Partial<Record<FlowNodeSubtype, FlowNodeSubtype>> = {
  embedding: 'embeddings',
  knowledge_ingest: 'knowledge_ingestion',
  knowledge_search: 'knowledge_retrieval',
  retriever: 'knowledge_retrieval',
  manual: 'chat_input',
  event: 'webhook',
  schedule: 'cron_schedule',
  llm_prompt: 'language_model',
  research_agent: 'enso_agent',
  router: 'switch_router',
  http_request: 'api_request',
  webhook_send: 'hanzo_post',
  email: 'hanzo_mail',
  sms: 'hanzo_post',
}

export function componentSpecFor(
  nodeOrSubtype: Pick<FlowNode, 'kind' | 'subtype'> | FlowNodeSubtype,
): FlowComponentSpec {
  const subtype = typeof nodeOrSubtype === 'string' ? nodeOrSubtype : nodeOrSubtype.subtype
  const direct = CATALOG_BY_SUBTYPE.get(subtype)
  if (direct) return direct
  const mapped = LEGACY_SUBTYPE_MAP[subtype]
  if (mapped && CATALOG_BY_SUBTYPE.has(mapped)) return CATALOG_BY_SUBTYPE.get(mapped)!
  if (typeof nodeOrSubtype !== 'string') {
    if (nodeOrSubtype.kind === 'note') return CATALOG_BY_SUBTYPE.get('sticky_note')!
    if (nodeOrSubtype.kind === 'schedule') return CATALOG_BY_SUBTYPE.get('cron_schedule')!
    if (nodeOrSubtype.kind === 'condition') return CATALOG_BY_SUBTYPE.get('if_condition')!
    if (nodeOrSubtype.kind === 'agent') return CATALOG_BY_SUBTYPE.get('enso_agent')!
    if (nodeOrSubtype.kind === 'trigger') return CATALOG_BY_SUBTYPE.get('chat_input')!
  }
  return CATALOG_BY_SUBTYPE.get('chat_output')!
}

export function isStickyNoteNode(node: Pick<FlowNode, 'kind' | 'subtype'>): boolean {
  return node.kind === 'note' || node.subtype === 'sticky_note'
}

export function isModelExecutionNode(node: Pick<FlowNode, 'kind' | 'subtype'>): boolean {
  return (
    node.kind === 'agent' ||
    node.subtype === 'enso_agent' ||
    node.subtype === 'language_model' ||
    node.subtype === 'structured_output' ||
    node.subtype === 'multi_agent_supervisor' ||
    node.subtype === 'hanzo_enso_router' ||
    node.subtype === 'llm_prompt' ||
    node.subtype === 'research_agent'
  )
}

export function isEmbeddingNode(node: Pick<FlowNode, 'subtype'>): boolean {
  return node.subtype === 'embeddings' || node.subtype === 'embedding'
}

export function isKnowledgeIngestionNode(node: Pick<FlowNode, 'subtype'>): boolean {
  return node.subtype === 'knowledge_ingestion' || node.subtype === 'knowledge_ingest'
}

export function isKnowledgeRetrievalNode(node: Pick<FlowNode, 'subtype'>): boolean {
  return (
    node.subtype === 'knowledge_retrieval' ||
    node.subtype === 'knowledge_search' ||
    node.subtype === 'retriever' ||
    node.subtype === 'vector_store'
  )
}

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
  if (seg === 'knowledge' || seg === 'kb') {
    return { view: 'knowledge', flowId: null, createNew: false }
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

export function makeNodeFromComponent(
  subtype: FlowNodeSubtype,
  index: number,
  position?: FlowPosition,
): FlowNode {
  const spec = componentSpecFor(subtype)
  const pos = position ?? {
    x: 64 + (index % 4) * 304,
    y: 96 + Math.floor(index / 4) * 192,
  }
  return {
    id: createNodeId(spec.subtype.slice(0, 6)),
    kind: spec.kind,
    subtype: spec.subtype,
    title: spec.label,
    description: spec.description,
    position: pos,
    config: { ...spec.defaultConfig },
  }
}

export function makeDefaultNode(kind: FlowNodeKind, index: number, position?: FlowPosition): FlowNode {
  switch (kind) {
    case 'trigger':
      return makeNodeFromComponent('webhook', index, position)
    case 'schedule':
      return makeNodeFromComponent('cron_schedule', index, position)
    case 'agent':
      return makeNodeFromComponent('enso_agent', index, position)
    case 'condition':
      return makeNodeFromComponent('if_condition', index, position)
    case 'data':
      return makeNodeFromComponent('api_request', index, position)
    case 'llm':
      return makeNodeFromComponent('prompt_template', index, position)
    case 'knowledge':
      return makeNodeFromComponent('knowledge_retrieval', index, position)
    case 'processing':
      return makeNodeFromComponent('json_transform', index, position)
    case 'control':
      return makeNodeFromComponent('loop_batch', index, position)
    case 'utility':
      return makeNodeFromComponent('variable_store', index, position)
    case 'hanzo':
      return makeNodeFromComponent('hanzo_enso_router', index, position)
    case 'note':
      return makeNodeFromComponent('sticky_note', index, position)
    case 'action':
    default:
      return makeNodeFromComponent('chat_output', index, position)
  }
}
