import { api } from '../lib/api'
import { bearer, org as currentOrg } from '../lib/session'
import { seedInitialFlows } from './templates'
import {
  FLOW_STUDIO_URL,
  flowMcpSlug,
  isEmbeddingNode,
  isKnowledgeIngestionNode,
  isKnowledgeRetrievalNode,
  isModelExecutionNode,
  isStickyNoteNode,
  normalizeEmbeddingModel,
  topologicalSort,
  type EmbeddingModelId,
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
const MAX_SESSION_VECTORS = 256

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

function formatCloudError(surface: string, status: number, errText: string): Error {
  if (status === 401) {
    return new Error(`Sign in via Hanzo IAM to use ${surface} (HTTP 401).`)
  }
  if (status === 402) {
    return new Error(`Insufficient balance — top up credits to continue using ${surface} (HTTP 402).`)
  }
  if (status === 403) {
    return new Error(`Hanzo IAM denied access to ${surface} for this org (HTTP 403).`)
  }
  const detail = errText.trim().slice(0, 180)
  return new Error(`${surface} returned HTTP ${status}${detail ? `: ${detail}` : ''}`)
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

const FLOW_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RemoteFlowRecord {
  id?: string
  name?: string
  description?: string
  updated_at?: string
  data?: {
    hanzoStudio?: boolean
    localId?: string
    status?: FlowDefinition['status']
    templateId?: string
    schedule?: FlowDefinition['schedule']
    createdAt?: string
    nodes?: FlowNode[]
    edges?: FlowDefinition['edges']
  } | null
}

function toRemotePayload(flow: FlowDefinition) {
  return {
    name: flow.name,
    description: flow.description,
    data: {
      hanzoStudio: true,
      localId: flow.id,
      status: flow.status,
      templateId: flow.templateId,
      schedule: flow.schedule,
      createdAt: flow.createdAt,
      nodes: flow.nodes,
      edges: flow.edges,
    },
  }
}

function fromRemoteRecord(rec: RemoteFlowRecord): FlowDefinition | null {
  if (!rec || typeof rec.id !== 'string' || typeof rec.name !== 'string') return null
  const data = rec.data
  if (!data || !Array.isArray(data.nodes)) return null
  // Only adopt Hanzo Studio-shaped nodes (which carry `subtype` & `config`).
  const studioNodes = data.nodes.filter(
    (n): n is FlowNode => Boolean(n && typeof n.id === 'string' && typeof n.subtype === 'string'),
  )
  if (data.nodes.length > 0 && studioNodes.length === 0) return null
  const updatedAt = rec.updated_at || new Date().toISOString()
  return {
    id: typeof data.localId === 'string' && data.localId ? data.localId : rec.id,
    remoteId: rec.id,
    name: rec.name,
    description: typeof rec.description === 'string' ? rec.description : '',
    status: data.status ?? 'active',
    templateId: data.templateId,
    nodes: studioNodes,
    edges: Array.isArray(data.edges) ? data.edges : [],
    schedule: data.schedule,
    createdAt: data.createdAt || updatedAt,
    updatedAt,
  }
}

export interface FlowCloudStatus {
  reachable: boolean
  version?: string
}

/** Probes live `GET /v1/flow/status` on Hanzo Cloud (`api.hanzo.ai/v1`). */
export async function getFlowCloudStatus(signal?: AbortSignal): Promise<FlowCloudStatus> {
  if (!bearer()) return { reachable: false }
  try {
    const res = await fetch(`${api()}/v1/flow/status`, {
      method: 'GET',
      headers: flowHeaders(false),
      signal,
    })
    if (!res.ok) return { reachable: false }
    const body = (await res.json().catch(() => null)) as FlowCloudStatus | null
    return { reachable: Boolean(body?.reachable), version: body?.version }
  } catch {
    return { reachable: false }
  }
}

/**
 * Loads workflows from localStorage immediately and merges remote
 * `GET /v1/flow/workflows` definitions when authenticated via Hanzo IAM.
 * Never throws on offline or unauthenticated sessions.
 */
export async function syncLoadFlows(orgId?: string | null, signal?: AbortSignal): Promise<FlowSyncResult> {
  const local = readLocalFlows(orgId)
  if (!bearer()) return { flows: local, source: 'local' }
  try {
    const res = await fetch(`${api()}/v1/flow/workflows?page=1&size=100`, {
      method: 'GET',
      headers: flowHeaders(false),
      signal,
    })
    if (!res.ok) return { flows: local, source: 'local' }
    const body = (await res.json().catch(() => null)) as
      | RemoteFlowRecord[]
      | { items?: RemoteFlowRecord[]; workflows?: RemoteFlowRecord[]; data?: RemoteFlowRecord[] }
      | null
    const rawList = Array.isArray(body)
      ? body
      : Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body?.workflows)
          ? body.workflows
          : Array.isArray(body?.data)
            ? body.data
            : []
    const validRemote = rawList
      .map((rec) => fromRemoteRecord(rec))
      .filter((f): f is FlowDefinition => f !== null)
    if (validRemote.length === 0) return { flows: local, source: 'remote' }
    const byId = new Map<string, FlowDefinition>()
    for (const f of local) byId.set(f.id, f)
    for (const r of validRemote) {
      const existing = byId.get(r.id)
      if (!existing || (r.updatedAt && r.updatedAt > existing.updatedAt)) {
        byId.set(r.id, r)
      } else if (existing && !existing.remoteId && r.remoteId) {
        byId.set(r.id, { ...existing, remoteId: r.remoteId })
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
 * Saves one flow to localStorage and persists it live to `/v1/flow/workflows`
 * (`PATCH /v1/flow/workflows/:id` when a server UUID exists, `POST /v1/flow/workflows`
 * on first sync).
 */
export async function persistFlow(
  flow: FlowDefinition,
  allFlows: readonly FlowDefinition[],
  orgId?: string | null,
): Promise<'synced' | 'local'> {
  writeLocalFlows(allFlows, orgId)
  if (!bearer()) return 'local'
  const payload = JSON.stringify(toRemotePayload(flow))
  const existingUuid =
    (flow.remoteId && FLOW_UUID_RE.test(flow.remoteId) && flow.remoteId) ||
    (FLOW_UUID_RE.test(flow.id) ? flow.id : null)
  try {
    if (existingUuid) {
      const patchRes = await fetch(`${api()}/v1/flow/workflows/${encodeURIComponent(existingUuid)}`, {
        method: 'PATCH',
        headers: flowHeaders(true),
        body: payload,
      })
      if (patchRes.ok) return 'synced'
      if (patchRes.status !== 404) return 'local'
    }
    const postRes = await fetch(`${api()}/v1/flow/workflows`, {
      method: 'POST',
      headers: flowHeaders(true),
      body: payload,
    })
    if (!postRes.ok) return 'local'
    const created = (await postRes.json().catch(() => null)) as { id?: string } | null
    if (created?.id && FLOW_UUID_RE.test(created.id)) {
      const withRemoteId = allFlows.map((f) => (f.id === flow.id ? { ...f, remoteId: created.id } : f))
      writeLocalFlows(withRemoteId, orgId)
    }
    return 'synced'
  } catch {
    // offline or transient upstream fault; localStorage copy stays intact
  }
  return 'local'
}

export async function removeRemoteFlow(flowId: string, remoteId?: string): Promise<void> {
  if (!bearer()) return
  const targetUuid =
    (remoteId && FLOW_UUID_RE.test(remoteId) && remoteId) ||
    (FLOW_UUID_RE.test(flowId) ? flowId : null)
  if (!targetUuid) return
  try {
    await fetch(`${api()}/v1/flow/workflows/${encodeURIComponent(targetUuid)}`, {
      method: 'DELETE',
      headers: flowHeaders(false),
    })
  } catch {
    // best-effort cleanup
  }
}

// ── Native Hanzo Cloud Embeddings (`POST /v1/embeddings`) ───────────────────

export interface EmbeddingResult {
  model: EmbeddingModelId
  vectors: number[][]
  dimensions: number
  promptTokens: number
  totalTokens: number
}

/**
 * Calls `POST ${api()}/v1/embeddings` live via Hanzo IAM Bearer auth.
 * Defaults to `zen-embedding-3` and supports `zen-embedding`.
 */
export async function createEmbeddings(
  input: string | readonly string[],
  model?: string | null,
  signal?: AbortSignal,
): Promise<EmbeddingResult> {
  const resolvedModel = normalizeEmbeddingModel(model)
  const inputs = Array.isArray(input)
    ? input.map((s) => String(s).trim()).filter(Boolean)
    : [String(input).trim()].filter(Boolean)
  if (inputs.length === 0) {
    throw new Error('Embeddings node received empty input text.')
  }

  const res = await fetch(`${api()}/v1/embeddings`, {
    method: 'POST',
    headers: flowHeaders(true),
    body: JSON.stringify({
      model: resolvedModel,
      input: inputs.length === 1 ? inputs[0] : inputs,
    }),
    signal,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw formatCloudError('Hanzo Embeddings (/v1/embeddings)', res.status, errText)
  }

  const data = (await res.json()) as {
    model?: string
    data?: Array<{ index?: number; embedding?: number[] }>
    usage?: { prompt_tokens?: number; total_tokens?: number }
    error?: { message?: string }
  }
  if (data.error?.message) throw new Error(data.error.message)

  const sorted = [...(data.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  const vectors = sorted
    .map((item) => item.embedding)
    .filter((vec): vec is number[] => Array.isArray(vec) && vec.length > 0)

  if (vectors.length === 0) {
    throw new Error('Hanzo Embeddings returned no float vectors.')
  }

  const dimensions = vectors[0]!.length
  const promptTokens = data.usage?.prompt_tokens ?? 0
  const totalTokens = data.usage?.total_tokens ?? promptTokens

  return {
    model: normalizeEmbeddingModel(data.model ?? resolvedModel),
    vectors,
    dimensions,
    promptTokens,
    totalTokens,
  }
}

/** Exact cosine similarity between two equal-length embedding vectors in [-1, 1]. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const len = Math.min(a.length, b.length)
  if (len === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < len; i++) {
    const x = a[i]!
    const y = b[i]!
    dot += x * y
    normA += x * x
    normB += y * y
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export interface SessionVectorEntry {
  id: string
  collection: string
  title: string
  text: string
  model: EmbeddingModelId
  vector: number[]
  createdAt: string
}

const sessionVectorStore = new Map<string, SessionVectorEntry[]>()

export function upsertSessionVectors(
  collection: string,
  entries: ReadonlyArray<Omit<SessionVectorEntry, 'collection' | 'createdAt'>>,
): number {
  const key = (collection || 'workspace-kb').trim().toLowerCase()
  const existing = sessionVectorStore.get(key) ?? []
  const now = new Date().toISOString()
  const next = [...existing]
  for (const item of entries) {
    const idx = next.findIndex((e) => e.id === item.id)
    const full: SessionVectorEntry = { ...item, collection: key, createdAt: now }
    if (idx >= 0) next[idx] = full
    else next.push(full)
  }
  sessionVectorStore.set(key, next.slice(-MAX_SESSION_VECTORS))
  return entries.length
}

export function searchSessionVectors(
  collection: string,
  queryVector: readonly number[],
  topK = 5,
): Array<SessionVectorEntry & { score: number }> {
  const key = (collection || 'workspace-kb').trim().toLowerCase()
  const bucket = sessionVectorStore.get(key) ?? []
  const pool =
    bucket.length > 0
      ? bucket
      : [...sessionVectorStore.values()].flat()
  return pool
    .filter((entry) => entry.vector.length === queryVector.length)
    .map((entry) => ({ ...entry, score: cosineSimilarity(queryVector, entry.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, topK))
}

export function clearSessionVectors(collection?: string): void {
  if (!collection) {
    sessionVectorStore.clear()
    return
  }
  sessionVectorStore.delete(collection.trim().toLowerCase())
}

// ── Native Hanzo Cloud Knowledge Base (`/v1/knowledge/*` & `/v1/crawl`) ─────

export interface KnowledgeFile {
  id: string
  name: string
  bucket: string
  key: string
  type?: string
  size?: number
  status: string
  stage?: string
  chars?: number
  sections?: number
  passages?: number
  embedded?: number
  project?: string
  error?: string
  note?: string
  created?: number
  updated?: number
}

export interface KnowledgeHit {
  doctype: string
  name: string
  title?: string
  score: number
  project?: string
  provider?: string
  url?: string
}

export interface KnowledgeSearchResponse {
  hits: KnowledgeHit[]
  degraded?: boolean
}

export interface KnowledgeCitedPassage {
  cite: string
  text: string
  score: number
  via?: string
  why?: string
  part?: number
  file?: { id: string; name: string; bucket?: string; key?: string; type?: string }
  section?: { id: number; title: string; path: string }
}

export interface KnowledgeRetrieveResponse {
  passages: KnowledgeCitedPassage[]
  sections?: Array<{
    file?: { id: string; name: string }
    section?: { id: number; title: string; path: string }
    summary?: string
  }>
  picked?: string
  degraded?: boolean
}

export interface KnowledgeFileSearchResponse {
  passages: KnowledgeCitedPassage[]
  degraded?: boolean
}

export interface KnowledgeGraphNode {
  id: string
  name: string
  title: string
  type: string
  project?: string
}

export interface KnowledgeGraphEdge {
  from: string
  to: string
  kind: string
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
  degraded?: boolean
}

export interface KnowledgeImportResult {
  format: string
  imported: number
  pages: string[]
  title: string
  project?: string
  sourceUrl?: string
  chars: number
}

export interface CrawlDocumentResult {
  url: string
  title: string
  markdown: string
}

/** Fetches a single URL via Hanzo Cloud `POST /v1/crawl` and returns clean Markdown. */
export async function crawlUrl(url: string, signal?: AbortSignal): Promise<CrawlDocumentResult> {
  const target = url.trim()
  if (!/^https?:\/\//i.test(target)) {
    throw new Error('URL must start with http:// or https://')
  }
  const res = await fetch(`${api()}/v1/crawl`, {
    method: 'POST',
    headers: flowHeaders(true),
    body: JSON.stringify({ url: target }),
    signal,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw formatCloudError('Hanzo Crawl (/v1/crawl)', res.status, errText)
  }
  const body = (await res.json()) as {
    success?: boolean
    error?: string
    data?: { url?: string; title?: string; markdown?: string }
  }
  if (body.success === false || !body.data?.markdown) {
    throw new Error(body.error || `Could not extract readable content from ${target}`)
  }
  return {
    url: body.data.url || target,
    title: body.data.title || target,
    markdown: body.data.markdown,
  }
}

/** Lists workspace files indexed in Hanzo Cloud Knowledge (`GET /v1/knowledge/files`). */
export async function listKnowledgeFiles(options: {
  bucket?: string
  limit?: number
  signal?: AbortSignal
} = {}): Promise<KnowledgeFile[]> {
  const params = new URLSearchParams()
  if (options.bucket?.trim()) params.set('bucket', options.bucket.trim())
  if (options.limit) params.set('limit', String(options.limit))
  const qs = params.toString()
  const res = await fetch(`${api()}/v1/knowledge/files${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: flowHeaders(false),
    signal: options.signal,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw formatCloudError('Hanzo Knowledge Files (/v1/knowledge/files)', res.status, errText)
  }
  const body = (await res.json().catch(() => ({}))) as { files?: KnowledgeFile[] }
  return Array.isArray(body.files) ? body.files : []
}

/** Removes a file from the Hanzo Cloud Knowledge index (`DELETE /v1/knowledge/files/:id`). */
export async function deleteKnowledgeFile(fileId: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`${api()}/v1/knowledge/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: flowHeaders(false),
    signal,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw formatCloudError('Hanzo Knowledge Forget (/v1/knowledge/files)', res.status, errText)
  }
}

/** Loads the org's knowledge graph (`GET /v1/knowledge/graph`). */
export async function getKnowledgeGraph(options: {
  project?: string
  signal?: AbortSignal
} = {}): Promise<KnowledgeGraph> {
  const params = new URLSearchParams()
  if (options.project?.trim()) params.set('project', options.project.trim())
  const qs = params.toString()
  const res = await fetch(`${api()}/v1/knowledge/graph${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: flowHeaders(false),
    signal: options.signal,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw formatCloudError('Hanzo Knowledge Graph (/v1/knowledge/graph)', res.status, errText)
  }
  const body = (await res.json().catch(() => ({}))) as Partial<KnowledgeGraph>
  return {
    nodes: Array.isArray(body.nodes) ? body.nodes : [],
    edges: Array.isArray(body.edges) ? body.edges : [],
    degraded: body.degraded,
  }
}

/**
 * Ingests text, markdown, or a URL into Hanzo Cloud Knowledge via `POST /v1/knowledge/import?format=roam`.
 * Automatically installs the `kb` framework module once if the org has not initialized it yet.
 */
export async function importKnowledgeDocument(
  input: {
    title?: string
    content?: string
    url?: string
    project?: string
  },
  signal?: AbortSignal,
): Promise<KnowledgeImportResult> {
  let resolvedTitle = (input.title ?? '').trim()
  let resolvedContent = (input.content ?? '').trim()
  let sourceUrl: string | undefined

  if (input.url?.trim()) {
    const crawled = await crawlUrl(input.url.trim(), signal)
    sourceUrl = crawled.url
    if (!resolvedTitle) resolvedTitle = crawled.title
    resolvedContent = resolvedContent
      ? `${resolvedContent}\n\nSource: ${crawled.url}\n\n${crawled.markdown}`
      : `Source: ${crawled.url}\n\n${crawled.markdown}`
  }

  if (!resolvedContent) {
    throw new Error('Provide text content or a URL to import into Hanzo Knowledge.')
  }
  if (!resolvedTitle) {
    resolvedTitle = resolvedContent.split('\n')[0]?.slice(0, 72).trim() || 'Flow Document'
  }

  const lines = resolvedContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const roamPayload = [
    {
      title: resolvedTitle,
      children: lines.length > 0 ? lines.map((line) => ({ string: line })) : [{ string: resolvedContent }],
    },
  ]

  const params = new URLSearchParams({ format: 'roam' })
  const project = (input.project ?? '').trim()
  if (project) params.set('project', project)
  const endpoint = `${api()}/v1/knowledge/import?${params.toString()}`

  const postImport = () =>
    fetch(endpoint, {
      method: 'POST',
      headers: flowHeaders(true),
      body: JSON.stringify(roamPayload),
      signal,
    })

  let res = await postImport()
  if (res.status === 400) {
    const errText = await res.text().catch(() => '')
    if (/modules\/kb\/install|install the kb module/i.test(errText)) {
      const installRes = await fetch(`${api()}/v1/framework/modules/kb/install`, {
        method: 'POST',
        headers: flowHeaders(true),
        body: JSON.stringify({}),
        signal,
      })
      if (installRes.ok) {
        res = await postImport()
      } else {
        const installErr = await installRes.text().catch(() => '')
        throw formatCloudError('Hanzo Knowledge Module Install (/v1/framework/modules/kb/install)', installRes.status, installErr)
      }
    } else {
      throw formatCloudError('Hanzo Knowledge Import (/v1/knowledge/import)', res.status, errText)
    }
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw formatCloudError('Hanzo Knowledge Import (/v1/knowledge/import)', res.status, errText)
  }

  const body = (await res.json().catch(() => ({}))) as {
    format?: string
    imported?: number
    pages?: string[]
  }
  return {
    format: body.format || 'roam',
    imported: body.imported ?? (Array.isArray(body.pages) ? body.pages.length : 1),
    pages: Array.isArray(body.pages) ? body.pages : [],
    title: resolvedTitle,
    project: project || undefined,
    sourceUrl,
    chars: resolvedContent.length,
  }
}

/** Hybrid semantic + lexical search over the org's knowledge (`POST /v1/knowledge/search`). */
export async function searchKnowledge(
  input: {
    query: string
    limit?: number
    project?: string
    doctypes?: string[]
  },
  signal?: AbortSignal,
): Promise<KnowledgeSearchResponse> {
  const query = input.query.trim()
  if (!query) throw new Error('Knowledge search query is required.')
  const body: Record<string, unknown> = { query }
  if (input.limit) body.limit = Math.min(50, Math.max(1, input.limit))
  if (input.project?.trim()) body.project = input.project.trim()
  if (input.doctypes && input.doctypes.length > 0) body.doctypes = input.doctypes

  const res = await fetch(`${api()}/v1/knowledge/search`, {
    method: 'POST',
    headers: flowHeaders(true),
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw formatCloudError('Hanzo Knowledge Search (/v1/knowledge/search)', res.status, errText)
  }
  const out = (await res.json().catch(() => ({}))) as Partial<KnowledgeSearchResponse>
  return {
    hits: Array.isArray(out.hits) ? out.hits : [],
    degraded: out.degraded,
  }
}

/** ToC-first grounded passage retrieval across workspace files (`POST /v1/knowledge/files/retrieve`). */
export async function retrieveKnowledgeFiles(
  input: {
    query: string
    files?: string[]
    limit?: number
    project?: string
  },
  signal?: AbortSignal,
): Promise<KnowledgeRetrieveResponse> {
  const query = input.query.trim()
  if (!query) throw new Error('Knowledge retrieve query is required.')
  const body: Record<string, unknown> = { query }
  if (input.files && input.files.length > 0) body.files = input.files
  if (input.limit) body.limit = Math.min(24, Math.max(1, input.limit))
  if (input.project?.trim()) body.project = input.project.trim()

  const res = await fetch(`${api()}/v1/knowledge/files/retrieve`, {
    method: 'POST',
    headers: flowHeaders(true),
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw formatCloudError('Hanzo Knowledge Retrieve (/v1/knowledge/files/retrieve)', res.status, errText)
  }
  const out = (await res.json().catch(() => ({}))) as Partial<KnowledgeRetrieveResponse>
  return {
    passages: Array.isArray(out.passages) ? out.passages : [],
    sections: Array.isArray(out.sections) ? out.sections : [],
    picked: out.picked,
    degraded: out.degraded,
  }
}

/** Direct passage search across workspace files (`POST /v1/knowledge/files/search`). */
export async function searchKnowledgeFiles(
  input: {
    query: string
    files?: string[]
    limit?: number
    project?: string
  },
  signal?: AbortSignal,
): Promise<KnowledgeFileSearchResponse> {
  const query = input.query.trim()
  if (!query) throw new Error('Knowledge file search query is required.')
  const body: Record<string, unknown> = { query }
  if (input.files && input.files.length > 0) body.files = input.files
  if (input.limit) body.limit = Math.min(50, Math.max(1, input.limit))
  if (input.project?.trim()) body.project = input.project.trim()

  const res = await fetch(`${api()}/v1/knowledge/files/search`, {
    method: 'POST',
    headers: flowHeaders(true),
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw formatCloudError('Hanzo Knowledge File Search (/v1/knowledge/files/search)', res.status, errText)
  }
  const out = (await res.json().catch(() => ({}))) as Partial<KnowledgeFileSearchResponse>
  return {
    passages: Array.isArray(out.passages) ? out.passages : [],
    degraded: out.degraded,
  }
}

// ── Canonical Flow MCP Server Config (Streamable HTTP + Hanzo IAM Bearer) ───

export interface FlowMcpServerConfig {
  serverName: string
  slug: string
  transport: 'http'
  endpointUrl: string
  studioMcpUrl: string
  cloudMcpUrl: string
  runUrl: string
  orgId: string
  clientJson: string
  curlExample: string
}

/**
 * Generates canonical Streamable HTTP MCP configuration for a Flow using
 * `hanzo-<flow_slug>` naming and Hanzo IAM Bearer authentication.
 */
export function buildFlowMcpConfig(flow: FlowDefinition, orgId?: string | null): FlowMcpServerConfig {
  const slug = flowMcpSlug(flow.name, flow.id)
  const serverName = `hanzo-${slug}`
  const apiBase = api()
  const org = scopeKey(orgId)
  const endpointUrl = `${apiBase}/v1/flow/workflows/${encodeURIComponent(flow.id)}/mcp`
  const studioMcpUrl = `${FLOW_STUDIO_URL}/v1/mcp/${slug}`
  const cloudMcpUrl = `${apiBase}/v1/mcp`
  const runUrl = `${apiBase}/v1/flow/runs`

  const configObj = {
    mcpServers: {
      [serverName]: {
        type: 'http',
        url: endpointUrl,
        headers: {
          Authorization: 'Bearer <hanzo-iam-token>',
          'X-Org-Id': org,
        },
      },
    },
  }

  const sampleInput =
    flow.nodes.find((n) => n.config.sampleInput)?.config.sampleInput ?? `Run ${flow.name}`

  const curlExample = [
    `curl -sS -X POST "${runUrl}" \\`,
    `  -H "Authorization: Bearer <hanzo-iam-token>" \\`,
    `  -H "X-Org-Id: ${org}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify({ workflow: flow.id, input: sampleInput })}'`,
  ].join('\n')

  return {
    serverName,
    slug,
    transport: 'http',
    endpointUrl,
    studioMcpUrl,
    cloudMcpUrl,
    runUrl,
    orgId: org,
    clientJson: JSON.stringify(configObj, null, 2),
    curlExample,
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

interface NodeEmbeddingArtifact {
  texts: string[]
  vectors: number[][]
  model: EmbeddingModelId
  dimensions: number
  totalTokens: number
}

function formatVectorPreview(vec: readonly number[]): string {
  const sample = vec
    .slice(0, 4)
    .map((n) => Number(n).toFixed(4))
    .join(', ')
  return `[${sample}${vec.length > 4 ? ', …' : ''}]`
}

function rerankBlocks(raw: string, query: string, topK: number): string {
  const blocks = raw
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
  if (blocks.length <= topK) return raw
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2)
  const scored = blocks.map((block, index) => {
    const scoreMatch = /score[:=\s]+(-?\d+(?:\.\d+)?)/i.exec(block)
    const explicitScore = scoreMatch ? Number(scoreMatch[1]) : 0
    const lower = block.toLowerCase()
    const termHits = terms.reduce((acc, term) => acc + (lower.includes(term) ? 1 : 0), 0)
    return { block, index, rank: explicitScore * 10 + termHits }
  })
  return scored
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .slice(0, Math.max(1, topK))
    .map((item) => item.block)
    .join('\n\n')
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
 * - Data Source `api_request` and `url_fetch` nodes execute live HTTP / `/v1/crawl` calls.
 * - `embeddings` nodes invoke `POST ${api()}/v1/embeddings` live with `zen-embedding-3` / `zen-embedding`.
 * - `knowledge_ingestion`, `knowledge_retrieval`, and `vector_store` nodes execute live against
 *   `${api()}/v1/knowledge/*` + real cosine similarity vector scoring via Hanzo IAM.
 * - Enso / Zen model & agent nodes invoke `POST ${api()}/v1/chat/completions` live with SSE streaming.
 * - Condition / Guardrail / Switch nodes evaluate expressions and route True/False edges accurately.
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
  const sourceTexts = new Map<string, string>()
  const embeddingsByNode = new Map<string, NodeEmbeddingArtifact>()
  const conditionBranch = new Map<string, 'true' | 'false'>()
  const vars = new Map<string, string>()
  let failed = false
  let haltedByCondition = false
  let lastOutput = options.sampleInput ?? ''
  let lastQuery = options.sampleInput ?? ''
  let finalOutput = ''

  const incomingEdgesOf = (nodeId: string) => flow.edges.filter((e) => e.target === nodeId)

  const isBlockedByBranch = (nodeId: string): boolean => {
    const incoming = incomingEdgesOf(nodeId)
    if (incoming.length === 0) return false
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

  const upstreamSemanticTextOf = (nodeId: string): string => {
    const incoming = incomingEdgesOf(nodeId)
    const parts = incoming
      .map((e) => sourceTexts.get(e.source) ?? outputs.get(e.source))
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
    return parts.length > 0 ? parts.join('\n\n') : lastOutput
  }

  const upstreamEmbeddingOf = (nodeId: string): NodeEmbeddingArtifact | undefined => {
    for (const edge of incomingEdgesOf(nodeId)) {
      const found = embeddingsByNode.get(edge.source)
      if (found) return found
    }
    return undefined
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
        sourceTexts.set(node.id, payload)
        lastOutput = output
        lastQuery = payload
        step.output = output
        step.status = 'success'
      } else if (node.subtype === 'api_request' || node.subtype === 'http_request') {
        const input = upstreamOf(node.id)
        const responseText = await runApiRequestNode(node, input, vars, options.signal)
        outputs.set(node.id, responseText)
        sourceTexts.set(node.id, responseText)
        if (!node.config.toolMode) lastOutput = responseText
        step.output = responseText
        step.status = 'success'
      } else if (node.subtype === 'url_fetch') {
        const input = upstreamOf(node.id)
        const targetUrl = interpolate(node.config.url || input || 'https://hanzo.ai/docs', input, vars)
        const crawled = await crawlUrl(targetUrl, options.signal)
        const docText = `# ${crawled.title}\nSource: ${crawled.url}\n\n${crawled.markdown}`
        outputs.set(node.id, docText)
        sourceTexts.set(node.id, docText)
        if (!node.config.toolMode) lastOutput = docText
        step.output = `Fetched ${crawled.url} (${crawled.markdown.length} chars markdown)`
        step.status = 'success'
      } else if (node.subtype === 'prompt_template') {
        const input = upstreamOf(node.id)
        const rendered = interpolate(node.config.prompt || '{{input}}', input, vars)
        outputs.set(node.id, rendered)
        sourceTexts.set(node.id, rendered)
        lastOutput = rendered
        step.output = rendered
        step.status = 'success'
      } else if (isEmbeddingNode(node)) {
        const rawText = upstreamSemanticTextOf(node.id)
        const chunks = rawText
          .split(/\n{2,}/)
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, 16)
        const inputs = chunks.length > 0 ? chunks : [rawText.trim()]
        const result = await createEmbeddings(inputs, node.config.model, options.signal)
        embeddingsByNode.set(node.id, {
          texts: inputs,
          vectors: result.vectors,
          model: result.model,
          dimensions: result.dimensions,
          totalTokens: result.totalTokens,
        })
        const summary = `${result.model} · ${result.vectors.length} vector${result.vectors.length === 1 ? '' : 's'} · ${result.dimensions}d · ${result.totalTokens} tokens · ${formatVectorPreview(result.vectors[0]!)}`
        outputs.set(node.id, rawText)
        sourceTexts.set(node.id, rawText)
        lastOutput = rawText
        step.output = summary
        step.status = 'success'
      } else if (isKnowledgeIngestionNode(node)) {
        const textToIngest = upstreamSemanticTextOf(node.id)
        const project = (node.config.collection || '').trim()
        const upstreamEmbed = upstreamEmbeddingOf(node.id)
        const docTitle = (node.config.filePath || '').trim() || `${flow.name} — ${node.title}`
        const imported = await importKnowledgeDocument(
          {
            title: docTitle,
            content: textToIngest,
            project: project || undefined,
          },
          options.signal,
        )
        if (upstreamEmbed && upstreamEmbed.vectors.length > 0) {
          upsertSessionVectors(
            project || 'workspace-kb',
            upstreamEmbed.vectors.map((vec, idx) => ({
              id: `${imported.pages[0] ?? flow.id}#${idx}`,
              title: `${docTitle}${upstreamEmbed.vectors.length > 1 ? ` #${idx + 1}` : ''}`,
              text: upstreamEmbed.texts[idx] ?? textToIngest,
              model: upstreamEmbed.model,
              vector: vec,
            })),
          )
        }
        const receipt = `Indexed ${imported.imported} page(s) into Hanzo Knowledge${project ? ` (${project})` : ''}: ${imported.pages.join(', ') || imported.title} (${imported.chars} chars)`
        outputs.set(node.id, receipt)
        sourceTexts.set(node.id, textToIngest)
        lastOutput = receipt
        finalOutput = receipt
        step.output = receipt
        step.status = 'success'
      } else if (isKnowledgeRetrievalNode(node)) {
        const query = interpolate(node.config.query || '{{input}}', upstreamSemanticTextOf(node.id), vars).trim()
        const topK = Math.min(24, Math.max(1, node.config.topK ?? 5))
        const project = (node.config.collection || '').trim()
        const upstreamEmbed = upstreamEmbeddingOf(node.id)

        const [kbRes, filesRes] = await Promise.allSettled([
          searchKnowledge({ query, limit: topK, project: project || undefined }, options.signal),
          retrieveKnowledgeFiles({ query, limit: topK, project: project || undefined }, options.signal),
        ])

        // If project-scoped search found nothing, also search org-wide knowledge cleanly.
        let kbHits = kbRes.status === 'fulfilled' ? kbRes.value.hits : []
        let filePassages = filesRes.status === 'fulfilled' ? filesRes.value.passages : []
        if (project && kbHits.length === 0 && filePassages.length === 0 && (kbRes.status === 'fulfilled' || filesRes.status === 'fulfilled')) {
          const [wideKb, wideFiles] = await Promise.allSettled([
            searchKnowledge({ query, limit: topK }, options.signal),
            retrieveKnowledgeFiles({ query, limit: topK }, options.signal),
          ])
          if (wideKb.status === 'fulfilled') kbHits = wideKb.value.hits
          if (wideFiles.status === 'fulfilled') filePassages = wideFiles.value.passages
        }

        // Compute real cosine similarity against any vectors embedded in this session.
        let vectorMatches: Array<SessionVectorEntry & { score: number }> = []
        if (upstreamEmbed?.vectors[0]) {
          vectorMatches = searchSessionVectors(project || 'workspace-kb', upstreamEmbed.vectors[0], topK)
        } else if (node.subtype === 'vector_store' && sessionVectorStore.size > 0) {
          const queryEmb = await createEmbeddings(query, node.config.model, options.signal)
          vectorMatches = searchSessionVectors(project || 'workspace-kb', queryEmb.vectors[0]!, topK)
        }

        if (kbRes.status === 'rejected' && filesRes.status === 'rejected' && vectorMatches.length === 0) {
          throw kbRes.reason instanceof Error ? kbRes.reason : new Error(String(kbRes.reason))
        }

        const sections: string[] = []
        for (const match of vectorMatches) {
          sections.push(
            `[Vector match · ${match.model} · score ${match.score.toFixed(3)}] ${match.title}\n${match.text.slice(0, 600)}`,
          )
        }
        for (const passage of filePassages.slice(0, topK)) {
          sections.push(
            `[File · ${passage.cite} · score ${passage.score.toFixed(3)}]\n${passage.text.slice(0, 600)}`,
          )
        }
        for (const hit of kbHits.slice(0, topK)) {
          const meta = [hit.doctype, hit.provider, hit.project].filter(Boolean).join(' · ')
          sections.push(
            `[Knowledge · ${meta} · score ${hit.score.toFixed(3)}] ${hit.title || hit.name}${hit.url ? ` (${hit.url})` : ''}`,
          )
        }

        const formatted =
          sections.length > 0
            ? `Query: ${query}\n\n${sections.join('\n\n')}`
            : `Query: ${query}\n\nNo matching passages indexed yet in Hanzo Cloud Knowledge${project ? ` (${project})` : ''}.`

        outputs.set(node.id, formatted)
        sourceTexts.set(node.id, query)
        if (!node.config.toolMode) lastOutput = formatted
        step.output =
          sections.length > 0
            ? `Retrieved ${sections.length} grounded match(es) (${filePassages.length} file passages, ${kbHits.length} knowledge hits${vectorMatches.length ? `, ${vectorMatches.length} vector matches` : ''})`
            : `Searched Hanzo Cloud Knowledge${project ? ` (${project})` : ''} · 0 matches`
        step.status = 'success'
      } else if (node.subtype === 'reranker') {
        const input = upstreamOf(node.id)
        const topK = Math.max(1, node.config.topK ?? 5)
        const ranked = rerankBlocks(input, lastQuery, topK)
        outputs.set(node.id, ranked)
        sourceTexts.set(node.id, ranked)
        lastOutput = ranked
        step.output = `Reranked top ${topK} passage(s) (${ranked.length} chars)`
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
        sourceTexts.set(node.id, reply)
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
        sourceTexts.set(node.id, content)
        lastOutput = content
        step.output = content
        step.status = 'success'
      } else if (node.subtype === 'text_splitter') {
        const input = upstreamSemanticTextOf(node.id)
        const size = Math.max(100, node.config.chunkSize ?? 800)
        const overlap = Math.min(Math.floor(size / 2), Math.max(0, node.config.chunkOverlap ?? 0))
        const stepSize = Math.max(50, size - overlap)
        const chunks: string[] = []
        for (let idx = 0; idx < input.length; idx += stepSize) {
          chunks.push(input.slice(idx, idx + size))
          if (idx + size >= input.length) break
        }
        const out = chunks.length > 0 ? chunks.join('\n\n') : input
        outputs.set(node.id, out)
        sourceTexts.set(node.id, out)
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
        sourceTexts.set(node.id, resText)
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
        node.subtype === 'sql_query' ||
        node.subtype === 'hanzo_base' ||
        node.subtype === 'sandbox_code' ||
        node.subtype === 'loop_batch' ||
        node.subtype === 'hanzo_kms_secret' ||
        node.subtype === 'sub_flow'
      ) {
        const input = upstreamOf(node.id)
        const summary =
          node.subtype === 'web_search'
            ? `[Web Search · top ${node.config.topK ?? 5}] Query: "${interpolate(node.config.query || '{{input}}', input, vars)}"`
            : node.subtype === 'hanzo_kms_secret'
              ? `[KMS Reference] ${node.config.secretPath || '/prod/flow/SECRET'} (resolved at deploy runtime)`
              : `[${node.title}] ${input.slice(0, 400)}`
        outputs.set(node.id, summary)
        if (!node.config.toolMode) lastOutput = input || summary
        step.output = summary
        step.status = 'success'
      } else {
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
