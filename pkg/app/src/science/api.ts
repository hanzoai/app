import { api } from '../lib/api'
import { bearer, org } from '../lib/session'
import {
  canonicalJson,
  classifyVerdict,
  inferMachineBackends,
  inferOpportunityAxis,
  parseTargets,
  resolveTaskQueue,
  sha256CanonicalJson,
  sha256HexBytes,
  type ArtifactRecord,
  type BenchmarkRecord,
  type CloudLeaseInfo,
  type ComparisonResult,
  type EvidenceRecord,
  type ExperimentMeta,
  type ExperimentRecord,
  type ExperimentVersionRecord,
  type GpuDeviceSpec,
  type HanzodWorkerState,
  type LinkedMachine,
  type MeasurePoint,
  type OpportunityAxis,
  type OpportunityItem,
  type ResearchSummaryData,
  type RunRecord,
  type ScheduleRecentAction,
  type ScheduleRecord,
  type StudyRecord,
  type VerdictClass,
  type VerifiedArtifactBlob,
  type WorkflowActivity,
  type WorkflowSseEvent,
} from './types'

export const DEFAULT_HANZOD_ORIGIN = 'http://127.0.0.1:3690'
export const GPU_JOBS_NAMESPACE = 'gpu-jobs'

export const DEFAULT_RETRY_POLICY = {
  initialInterval: '5s',
  backoffCoefficient: 2.0,
  maximumInterval: '60s',
  maximumAttempts: 8,
} as const

const ONLINE_STATES = new Set(['online', 'ready', 'idle', 'busy', 'running', 'active'])

export function resolveLocalHanzodOrigin(): string {
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      __hanzoLocalHost?: { origin?: string }
      __HANZO_SPA_CONFIG__?: { hanzodHost?: string }
    }
    const candidate = win.__hanzoLocalHost?.origin || win.__HANZO_SPA_CONFIG__?.hanzodHost
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().replace(/\/+$/, '')
    }
  }
  return DEFAULT_HANZOD_ORIGIN
}

/**
 * Only probe local `hanzod` (`http://127.0.0.1:3690`) in Desktop / loopback / explicitly
 * configured local environments. On hosted HTTPS Web (`https://hanzo.app`), Science uses
 * the Cloud API directly without violating the page's `connect-src` CSP.
 */
export function canProbeLocalHanzod(isDesktop = false): boolean {
  if (isDesktop) return true
  if (typeof window === 'undefined') return false
  const win = window as unknown as {
    __hanzoLocalHost?: { origin?: string }
    __HANZO_SPA_CONFIG__?: { hanzodHost?: string }
    __TAURI_INTERNALS__?: unknown
  }
  if (win.__TAURI_INTERNALS__) return true
  const candidate = win.__hanzoLocalHost?.origin || win.__HANZO_SPA_CONFIG__?.hanzodHost
  if (typeof candidate === 'string' && candidate.trim()) return true
  const proto = window.location?.protocol ?? ''
  const host = (window.location?.hostname ?? '').toLowerCase()
  if (proto === 'tauri:' || proto === 'file:') return true
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === 'tauri.localhost'
}

export function activeProject(): string {
  const tok = bearer()
  if (!tok) return 'default'
  try {
    const part = tok.split('.')[1]
    if (!part) return 'default'
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
    const p = typeof claims.project === 'string' ? claims.project.trim() : ''
    return p || 'default'
  } catch {
    return 'default'
  }
}

export function scienceHeaders(options: {
  json?: boolean
  accept?: string
  extra?: Record<string, string>
} = {}): Record<string, string> {
  const h: Record<string, string> = {
    Accept: options.accept ?? 'application/json',
  }
  const tok = bearer()
  if (tok) h.Authorization = `Bearer ${tok}`
  const activeOrg = org()
  if (activeOrg) h['X-Org-Id'] = activeOrg
  const proj = activeProject()
  if (proj) h['X-Project-Id'] = proj
  if (options.json) h['Content-Type'] = 'application/json'
  if (options.extra) Object.assign(h, options.extra)
  return h
}

function buildQuery(params?: Record<string, string | number | boolean | null | undefined>): string {
  if (!params) return ''
  const pairs: string[] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  return pairs.length > 0 ? `?${pairs.join('&')}` : ''
}

function asObj(val: unknown): Record<string, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, unknown>) : {}
}

function asArr(val: unknown): unknown[] {
  return Array.isArray(val) ? val : []
}

function asStr(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : fallback
}

function asNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function parseMemBytes(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return Math.max(0, Math.floor(val))
  if (typeof val !== 'string') return 0
  const m = /^([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]*)$/.exec(val.trim())
  if (!m) return 0
  const num = Number(m[1])
  const unit = (m[2] ?? '').toLowerCase()
  if (unit === 'tib' || unit === 'tb') return Math.floor(num * 1024 ** 4)
  if (unit === 'gib' || unit === 'gb' || unit === 'g') return Math.floor(num * 1024 ** 3)
  if (unit === 'mib' || unit === 'mb' || unit === 'm') return Math.floor(num * 1024 ** 2)
  if (unit === 'kib' || unit === 'kb' || unit === 'k') return Math.floor(num * 1024)
  return Math.floor(num)
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

export async function requestScienceJson<T>(
  pathOrUrl: string,
  init: RequestInit & { query?: Record<string, string | number | boolean | null | undefined>; base?: string } = {},
): Promise<T> {
  const { query, base, ...fetchInit } = init
  const isAbsolute = /^https?:\/\//.test(pathOrUrl)
  const root = (base ?? api()).replace(/\/+$/, '')
  const url = `${isAbsolute ? pathOrUrl : `${root}${pathOrUrl}`}${buildQuery(query)}`
  const method = (fetchInit.method ?? 'GET').toUpperCase()
  const hasBody = fetchInit.body !== undefined && fetchInit.body !== null

  const waits = [400, 1000]
  while (true) {
    const res = await fetch(url, {
      cache: 'no-store',
      ...fetchInit,
      method,
      headers: {
        ...scienceHeaders({ json: hasBody }),
        ...(fetchInit.headers as Record<string, string> | undefined),
      },
    })
    if (res.status === 503 && waits.length > 0 && !fetchInit.signal?.aborted) {
      await sleep(waits.shift()!)
      continue
    }
    if (res.status === 204) {
      return {} as T
    }
    const text = await res.text()
    let parsed: unknown = {}
    if (text) {
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = { error: text.slice(0, 300) }
      }
    }
    if (!res.ok) {
      const errObj = asObj(parsed)
      const msg =
        (typeof errObj.error === 'string' && errObj.error) ||
        (typeof errObj.detail === 'string' && errObj.detail) ||
        (typeof errObj.message === 'string' && errObj.message) ||
        `HTTP ${res.status} (${method} ${pathOrUrl})`
      throw new Error(msg)
    }
    return parsed as T
  }
}

// ── Desktop / Local hanzod Transport & Reconnect Probe ───────────────────────

export interface HanzodProbeResult {
  connected: boolean
  origin: string
  version?: string
  sandbox?: string
  hanzo_vm_available?: boolean
  worker: HanzodWorkerState | null
  error?: string
}

export async function probeHanzodState(
  origin = resolveLocalHanzodOrigin(),
  signal?: AbortSignal,
): Promise<HanzodProbeResult> {
  const cleanOrigin = origin.replace(/\/+$/, '')
  const headers = scienceHeaders()

  const probeOne = async (path: string): Promise<{ ok: boolean; data: Record<string, unknown> | null }> => {
    try {
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), 1800)
      if (signal) {
        signal.addEventListener('abort', () => ctl.abort(), { once: true })
      }
      const res = await fetch(`${cleanOrigin}${path}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
        signal: ctl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) return { ok: false, data: null }
      const json = (await res.json().catch(() => ({}))) as unknown
      return { ok: true, data: asObj(json) }
    } catch {
      return { ok: false, data: null }
    }
  }

  const [manifestRes, workerRes, researchRes] = await Promise.all([
    probeOne('/v1/hanzod'),
    probeOne('/v1/hanzod/worker'),
    probeOne('/v1/research/health'),
  ])

  if (!manifestRes.ok && !workerRes.ok && !researchRes.ok) {
    return {
      connected: false,
      origin: cleanOrigin,
      worker: null,
      error: `hanzod unreachable at ${cleanOrigin}`,
    }
  }

  const manifest = manifestRes.data ?? {}
  const research = researchRes.data ?? {}
  const w = workerRes.data

  const worker: HanzodWorkerState | null = w
    ? {
        ok: w.ok !== false,
        enabled: Boolean(w.enabled ?? true),
        linked: Boolean(w.linked),
        sse_connected: Boolean(w.sse_connected),
        worker_id: asStr(w.worker_id, asStr(w.hostname, 'local-hanzod')),
        hostname: asStr(w.hostname, 'localhost'),
        cloud_api: asStr(w.cloud_api, api()),
        queues: asArr(w.queues).map((q) => String(q)),
        capabilities: asArr(w.capabilities).map((c) => String(c)),
        os: asStr(w.os),
        arch: asStr(w.arch),
        cpus: asNum(w.cpus, 0),
        cpu_model: asStr(w.cpu_model),
        memory: asNum(w.memory, 0),
        gpus: asArr(w.gpus).map((g) => {
          const go = asObj(g)
          return {
            name: asStr(go.name),
            arch: asStr(go.arch) || undefined,
            vendor: asStr(go.vendor) || undefined,
            memoryTotal: asStr(go.memoryTotal) || undefined,
            unified: Boolean(go.unified),
          }
        }),
        backends: asArr(w.backends).map((b) => String(b)),
        busy: Boolean(w.busy),
        busy_reason: typeof w.busy_reason === 'string' ? w.busy_reason : null,
        gpu_util_pct: typeof w.gpu_util_pct === 'number' ? w.gpu_util_pct : null,
        when_idle_only: Boolean(w.when_idle_only ?? true),
        targeted_only: Boolean(w.targeted_only),
        max_gpu_util_pct: asNum(w.max_gpu_util_pct, 25),
        active_dev_sessions: asNum(w.active_dev_sessions, 0),
        active_research_runs: asNum(w.active_research_runs, 0),
        last_heartbeat: typeof w.last_heartbeat === 'string' ? w.last_heartbeat : null,
        last_error: typeof w.last_error === 'string' ? w.last_error : null,
      }
    : null

  return {
    connected: true,
    origin: cleanOrigin,
    version: asStr(manifest.version) || undefined,
    sandbox: asStr(research.sandbox) || undefined,
    hanzo_vm_available: typeof research.hanzo_vm_available === 'boolean' ? research.hanzo_vm_available : undefined,
    worker,
  }
}

export interface HanzodWorkerPatch {
  enabled?: boolean
  when_idle_only?: boolean
  targeted_only?: boolean
  max_gpu_util_pct?: number
  force_busy_reason?: string | null
}

/**
 * Configure local `hanzod` worker (`PATCH /v1/hanzod/worker`, falling back cleanly
 * to `PUT /v1/hanzod/worker` when talking directly to the Rust `hanzod` daemon).
 */
export async function configureHanzodWorker(
  patch: HanzodWorkerPatch,
  origin = resolveLocalHanzodOrigin(),
): Promise<HanzodWorkerState> {
  const cleanOrigin = origin.replace(/\/+$/, '')
  const body = JSON.stringify(patch)
  const headers = scienceHeaders({ json: true })

  let res = await fetch(`${cleanOrigin}/v1/hanzod/worker`, {
    method: 'PATCH',
    headers,
    body,
    cache: 'no-store',
  })
  if (res.status === 405) {
    res = await fetch(`${cleanOrigin}/v1/hanzod/worker`, {
      method: 'PUT',
      headers,
      body,
      cache: 'no-store',
    })
  }
  const text = await res.text()
  const parsed = text ? asObj(JSON.parse(text)) : {}
  if (!res.ok) {
    throw new Error(asStr(parsed.error, `hanzod worker update failed (HTTP ${res.status})`))
  }
  return {
    ok: parsed.ok !== false,
    enabled: Boolean(parsed.enabled ?? patch.enabled ?? true),
    linked: Boolean(parsed.linked),
    sse_connected: Boolean(parsed.sse_connected),
    worker_id: asStr(parsed.worker_id, 'local-hanzod'),
    hostname: asStr(parsed.hostname, 'localhost'),
    cloud_api: asStr(parsed.cloud_api, api()),
    queues: asArr(parsed.queues).map(String),
    capabilities: asArr(parsed.capabilities).map(String),
    os: asStr(parsed.os),
    arch: asStr(parsed.arch),
    cpus: asNum(parsed.cpus, 0),
    cpu_model: asStr(parsed.cpu_model),
    memory: asNum(parsed.memory, 0),
    gpus: asArr(parsed.gpus).map((g) => {
      const go = asObj(g)
      return {
        name: asStr(go.name),
        arch: asStr(go.arch) || undefined,
        memoryTotal: asStr(go.memoryTotal) || undefined,
      }
    }),
    backends: asArr(parsed.backends).map(String),
    busy: Boolean(parsed.busy),
    busy_reason: typeof parsed.busy_reason === 'string' ? parsed.busy_reason : null,
    gpu_util_pct: typeof parsed.gpu_util_pct === 'number' ? parsed.gpu_util_pct : null,
    when_idle_only: Boolean(parsed.when_idle_only ?? patch.when_idle_only ?? true),
    targeted_only: Boolean(parsed.targeted_only ?? patch.targeted_only ?? false),
    max_gpu_util_pct: asNum(parsed.max_gpu_util_pct, patch.max_gpu_util_pct ?? 25),
    active_dev_sessions: asNum(parsed.active_dev_sessions, 0),
    active_research_runs: asNum(parsed.active_research_runs, 0),
  }
}

export async function listLocalHanzodRuns(origin = resolveLocalHanzodOrigin()): Promise<RunRecord[]> {
  try {
    const cleanOrigin = origin.replace(/\/+$/, '')
    const res = await fetch(`${cleanOrigin}/v1/research/runs`, {
      headers: scienceHeaders(),
      cache: 'no-store',
    })
    if (!res.ok) return []
    const json = asObj(await res.json().catch(() => ({})))
    return asArr(json.data).map((raw): RunRecord => {
      const r = asObj(raw)
      return {
        id: asStr(r.id),
        benchmark: asStr(r.benchmark),
        split: asStr(r.split, 'test'),
        system: asStr(r.system, 'hanzod-local'),
        commit: asStr(r.commit_sha || r.commit),
        questions: typeof r.questions === 'number' ? r.questions : null,
        answered: typeof r.answered === 'number' ? r.answered : null,
        completion: asStr(r.completion, asStr(r.status)),
        when: asStr(r.started_at || r.when),
        ended: asStr(r.ended_at || r.ended),
        measures: asArr(r.measures).map((m) => {
          const mo = asObj(m)
          return {
            category: asStr(mo.category, 'all'),
            metric: asStr(mo.metric),
            value: asNum(mo.value, 0),
            lo: typeof mo.lo === 'number' ? mo.lo : null,
            hi: typeof mo.hi === 'number' ? mo.hi : null,
          }
        }),
        notes: asStr(r.notes),
        source_plane: 'hanzod',
        sandbox: asStr(r.sandbox) || undefined,
        duration_ms: typeof r.duration_ms === 'number' ? r.duration_ms : undefined,
      }
    })
  } catch {
    return []
  }
}

// ── Cloud /v1/research Record & Experiment Planes ────────────────────────────

export async function listStudies(project?: string, signal?: AbortSignal): Promise<StudyRecord[]> {
  const out = await requestScienceJson<{ data?: unknown[] }>('/v1/research/studies', {
    query: { project },
    signal,
  })
  return asArr(out.data).map((raw) => {
    const s = asObj(raw)
    return {
      project: asStr(s.project, 'default'),
      id: asStr(s.id),
      title: asStr(s.title, asStr(s.id)),
      question: asStr(s.question),
      method: asStr(s.method),
      runs: asArr(s.runs).map(String),
      finding: asStr(s.finding),
      limits: asStr(s.limits),
      revision: asStr(s.revision, 'original'),
      canonical: s.canonical !== false,
      when: asStr(s.when),
    }
  })
}

export async function listBenchmarks(project?: string, signal?: AbortSignal): Promise<BenchmarkRecord[]> {
  const out = await requestScienceJson<{ data?: unknown[] }>('/v1/research/benchmarks', {
    query: { project },
    signal,
  })
  return asArr(out.data).map((raw) => {
    const b = asObj(raw)
    return {
      project: asStr(b.project, 'default'),
      id: asStr(b.id),
      title: asStr(b.title, asStr(b.id)),
      version: asStr(b.version),
      dataset: asStr(b.dataset),
      license: asStr(b.license),
      origin: asStr(b.origin),
      splits: asArr(b.splits).map((sp) => {
        const so = asObj(sp)
        return {
          name: asStr(so.name),
          items: asNum(so.items, 0),
          definition: asStr(so.definition),
        }
      }),
      metric: asStr(b.metric),
      metrics: asArr(b.metrics).map(String),
      citation: asStr(b.citation),
      notes: asStr(b.notes),
      revision: asStr(b.revision, 'original'),
      canonical: b.canonical !== false,
      when: asStr(b.when),
    }
  })
}

export async function listRuns(
  params: {
    study?: string
    benchmark?: string
    completion?: string
    project?: string
    includeLocalHanzod?: boolean
    localOrigin?: string
    signal?: AbortSignal
  } = {},
): Promise<RunRecord[]> {
  const [cloudOut, localRuns] = await Promise.all([
    requestScienceJson<{ data?: unknown[] }>('/v1/research/runs', {
      query: {
        study: params.study,
        benchmark: params.benchmark,
        completion: params.completion,
        project: params.project,
      },
      signal: params.signal,
    }).catch(() => ({ data: [] })),
    params.includeLocalHanzod ? listLocalHanzodRuns(params.localOrigin) : Promise.resolve([]),
  ])

  const byId = new Map<string, RunRecord>()
  for (const raw of asArr(cloudOut.data)) {
    const r = asObj(raw)
    const id = asStr(r.id)
    if (!id) continue
    byId.set(id, {
      project: asStr(r.project, 'default'),
      id,
      benchmark: asStr(r.benchmark),
      split: asStr(r.split),
      system: asStr(r.system),
      version: asStr(r.version),
      baseline: Boolean(r.baseline),
      study: asStr(r.study),
      embedder: asStr(r.embedder),
      reader: asStr(r.reader),
      k: typeof r.k === 'number' ? r.k : null,
      temperature: typeof r.temperature === 'number' ? r.temperature : null,
      max_tokens: typeof r.max_tokens === 'number' ? r.max_tokens : null,
      prompt: asStr(r.prompt),
      prompt_digest: asStr(r.prompt_digest),
      dataset_digest: asStr(r.dataset_digest),
      store_digest: asStr(r.store_digest),
      facts_digest: asStr(r.facts_digest),
      commit: asStr(r.commit),
      questions: typeof r.questions === 'number' ? r.questions : null,
      answered: typeof r.answered === 'number' ? r.answered : null,
      when: asStr(r.when),
      ended: asStr(r.ended),
      by: asStr(r.by),
      completion: asStr(r.completion, 'unknown'),
      measures: asArr(r.measures).map((m): MeasurePoint => {
        const mo = asObj(m)
        return {
          category: asStr(mo.category),
          metric: asStr(mo.metric),
          value: asNum(mo.value, 0),
          lo: typeof mo.lo === 'number' ? mo.lo : null,
          hi: typeof mo.hi === 'number' ? mo.hi : null,
          n: typeof mo.n === 'number' ? mo.n : null,
          of: typeof mo.of === 'number' ? mo.of : null,
        }
      }),
      notes: asStr(r.notes),
      revision: asStr(r.revision, 'original'),
      canonical: r.canonical !== false,
      visibility: asStr(r.visibility, 'private'),
      trainable: Boolean(r.trainable),
      publishable: Boolean(r.publishable),
      source_plane: 'cloud',
    })
  }

  for (const lr of localRuns) {
    if (lr.id && !byId.has(lr.id)) {
      byId.set(lr.id, lr)
    }
  }

  return [...byId.values()]
}

export async function compareRuns(a: string, b: string, project?: string): Promise<ComparisonResult> {
  const out = await requestScienceJson<Record<string, unknown>>('/v1/research/compare', {
    query: { a: a.trim(), b: b.trim(), project },
  })
  return {
    a: out.a ? (asObj(out.a) as unknown as RunRecord) : null,
    b: out.b ? (asObj(out.b) as unknown as RunRecord) : null,
    comparable: Boolean(out.comparable),
    blocks: asArr(out.blocks).map(String),
    config: asArr(out.config ?? out.differences).map((d) => {
      const row = asObj(d)
      return {
        field: asStr(row.field),
        a: asStr(row.a),
        b: asStr(row.b),
      }
    }),
    deltas: asArr(out.deltas).map((d) => {
      const row = asObj(d)
      return {
        category: asStr(row.category),
        metric: asStr(row.metric),
        a: asNum(row.a, 0),
        b: asNum(row.b, 0),
        change: asNum(row.change, 0),
        overlap: typeof row.overlap === 'boolean' ? row.overlap : null,
      }
    }),
  }
}

export interface ExperimentFilterOptions {
  project?: string
  kind?: string
  study?: string
  verdict?: 'all' | VerdictClass
  backend?: string
  search?: string
  includeHistoricalRetracted?: boolean
  signal?: AbortSignal
}

export function filterExperiments(
  records: readonly ExperimentRecord[],
  filters: Omit<ExperimentFilterOptions, 'project' | 'signal'> = {},
): ExperimentRecord[] {
  const wantKind = filters.kind && filters.kind !== 'all' ? filters.kind.trim().toLowerCase() : ''
  const wantStudy = filters.study && filters.study !== 'all' ? filters.study.trim().toLowerCase() : ''
  const wantVerdict = filters.verdict && filters.verdict !== 'all' ? filters.verdict : ''
  const wantBackend = filters.backend && filters.backend !== 'all' ? filters.backend.trim().toLowerCase() : ''
  const tokens = (filters.search ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const showHistorical = Boolean(filters.includeHistoricalRetracted)

  return records.filter((rec) => {
    const meta = rec.meta ?? {}
    const isHistoricalOrRetracted = Boolean(meta.historical) || rec.revision === 'retracted' || rec.canonical === false
    if (!showHistorical && isHistoricalOrRetracted) {
      return false
    }
    if (wantKind && rec.kind.toLowerCase() !== wantKind) {
      return false
    }
    if (wantStudy) {
      const studyVal = `${meta.study ?? ''} ${rec.task ?? ''}`.toLowerCase()
      if (!studyVal.includes(wantStudy)) return false
    }
    if (wantVerdict) {
      const v = classifyVerdict(rec)
      if (v !== wantVerdict) return false
    }
    if (wantBackend) {
      const backendVal = `${meta.backend ?? ''} ${meta.gpu ?? ''} ${rec.subject ?? ''}`.toLowerCase()
      if (!backendVal.includes(wantBackend)) return false
    }
    if (tokens.length > 0) {
      const hay = `${rec.id} ${rec.subject} ${rec.task} ${rec.metric} ${rec.git_sha} ${JSON.stringify(meta)}`.toLowerCase()
      if (!tokens.every((tok) => hay.includes(tok))) return false
    }
    return true
  })
}

export async function listExperiments(options: ExperimentFilterOptions = {}): Promise<ExperimentRecord[]> {
  const serverKind = options.kind && options.kind !== 'all' ? options.kind : undefined
  const out = await requestScienceJson<{ data?: unknown[] }>('/v1/research/experiments', {
    query: { project: options.project, kind: serverKind },
    signal: options.signal,
  })

  const loaded: ExperimentRecord[] = asArr(out.data).map((raw) => {
    const e = asObj(raw)
    let metaObj: ExperimentMeta = {}
    if (typeof e.meta === 'string') {
      try {
        metaObj = asObj(JSON.parse(e.meta)) as ExperimentMeta
      } catch {
        metaObj = {}
      }
    } else if (e.meta && typeof e.meta === 'object') {
      metaObj = e.meta as ExperimentMeta
    }

    let libs: Record<string, string> = {}
    if (typeof e.lib_versions === 'string') {
      try {
        libs = asObj(JSON.parse(e.lib_versions)) as Record<string, string>
      } catch {
        libs = {}
      }
    } else if (e.lib_versions && typeof e.lib_versions === 'object') {
      libs = e.lib_versions as Record<string, string>
    }

    return {
      project: asStr(e.project, 'default'),
      id: asStr(e.id),
      seq: typeof e.seq === 'number' ? e.seq : undefined,
      content_hash: asStr(e.content_hash) || undefined,
      revision: asStr(e.revision, 'original'),
      status: asStr(e.status, 'complete'),
      canonical: e.canonical !== false,
      visibility: asStr(e.visibility, 'private'),
      trainable: Boolean(e.trainable),
      publishable: Boolean(e.publishable),
      kind: asStr(e.kind, 'experiment-v2'),
      subject: asStr(e.subject),
      task: asStr(e.task),
      metric: asStr(e.metric),
      value: asNum(e.value, 0),
      n: asNum(e.n, 0),
      n_total: asNum(e.n_total, 0),
      cost_usd: asNum(e.cost_usd, 0),
      meta: metaObj,
      git_sha: asStr(e.git_sha),
      git_branch: asStr(e.git_branch),
      git_dirty: Boolean(e.git_dirty),
      lib_versions: libs,
      ts: asNum(e.ts, 0),
      tags: asArr(e.tags).map(String),
      received_at: typeof e.received_at === 'number' ? e.received_at : undefined,
    }
  })

  return filterExperiments(loaded, options)
}

export async function listExperimentVersions(id: string, project?: string): Promise<ExperimentVersionRecord[]> {
  try {
    const out = await requestScienceJson<{ versions?: unknown[] }>('/v1/research/experiments/versions', {
      query: { id, project },
    })
    return asArr(out.versions).map((v) => {
      const row = asObj(v)
      return {
        seq: asNum(row.seq, 0),
        received_at: asNum(row.received_at, 0),
        ts: asNum(row.ts, 0),
        content_hash: asStr(row.content_hash),
        revision: asStr(row.revision, 'original'),
        status: asStr(row.status, 'complete'),
        canonical: Boolean(row.canonical),
        value: asNum(row.value, 0),
        n: asNum(row.n, 0),
        meta: asObj(row.meta) as ExperimentMeta,
        git_sha: asStr(row.git_sha),
        tags: asArr(row.tags).map(String),
      }
    })
  } catch {
    const out = await requestScienceJson<{ versions?: unknown[] }>(
      `/v1/research/experiments/${encodeURIComponent(id)}/versions`,
      { query: { project } },
    )
    return asArr(out.versions).map((v) => {
      const row = asObj(v)
      return {
        seq: asNum(row.seq, 0),
        received_at: asNum(row.received_at, 0),
        ts: asNum(row.ts, 0),
        content_hash: asStr(row.content_hash),
        revision: asStr(row.revision, 'original'),
        status: asStr(row.status, 'complete'),
        canonical: Boolean(row.canonical),
        value: asNum(row.value, 0),
        n: asNum(row.n, 0),
        meta: asObj(row.meta) as ExperimentMeta,
        git_sha: asStr(row.git_sha),
        tags: asArr(row.tags).map(String),
      }
    })
  }
}

// ── Versioned Evidence & Content-Addressed Artifacts ─────────────────────────

function parseEvidenceRow(raw: unknown): EvidenceRecord {
  const e = asObj(raw)
  const src = asObj(e.source)
  return {
    id: asStr(e.id),
    uri: asStr(e.uri),
    hash: asStr(e.hash),
    kind: asStr(e.kind, 'analysis'),
    source: {
      system: asStr(src.system, 'hanzo-science'),
      revision: asStr(src.revision) || undefined,
    },
    links: asArr(e.links).map((l) => {
      const lo = asObj(l)
      return { rel: asStr(lo.rel), uri: asStr(lo.uri) }
    }),
    content: e.content,
    time: asStr(e.time) || undefined,
    version: asNum(e.version, 0),
    by: asStr(e.by) || undefined,
  }
}

export async function listEvidenceByUri(uri: string, signal?: AbortSignal): Promise<EvidenceRecord[]> {
  const out = await requestScienceJson<{ data?: unknown[] }>('/v1/research/evidence', {
    query: { uri: uri.trim() },
    signal,
  })
  return asArr(out.data).map(parseEvidenceRow)
}

export async function getEvidenceById(id: string, signal?: AbortSignal): Promise<EvidenceRecord> {
  const out = await requestScienceJson<unknown>(`/v1/research/evidence/${encodeURIComponent(id.trim())}`, {
    signal,
  })
  return parseEvidenceRow(out)
}

export async function fileEvidence(
  input: {
    uri: string
    kind: 'requirement' | 'analysis' | 'element' | 'verification' | string
    content: Record<string, unknown>
    links?: { rel: string; uri: string }[]
    revision?: string
  },
  idempotencyKey?: string,
): Promise<EvidenceRecord> {
  const hash = await sha256CanonicalJson(input.content)
  const extraHeaders: Record<string, string> = {}
  if (idempotencyKey) extraHeaders['Idempotency-Key'] = idempotencyKey

  const out = await requestScienceJson<unknown>('/v1/research/evidence', {
    method: 'POST',
    headers: scienceHeaders({ json: true, extra: extraHeaders }),
    body: JSON.stringify({
      uri: input.uri,
      hash,
      kind: input.kind,
      source: {
        system: 'hanzo-science',
        ...(input.revision ? { revision: input.revision } : {}),
      },
      links: input.links ?? [],
      content: input.content,
    }),
  })
  return parseEvidenceRow(out)
}

export interface PreregistrationInput {
  study: string
  hypothesis: string
  nullHypothesis: string
  metric: string
  targetDelta: number
  higherIsBetter: boolean
  manifestSha256: string
  evidenceKind: 'requirement' | 'analysis'
  screeningSamples: number
  qualificationSamples: number
  maxComputeSeconds: number
  maxCostUsd: number
  anytimeValid: boolean
  relatedOpportunityId?: string
}

export async function filePreregistration(input: PreregistrationInput): Promise<EvidenceRecord> {
  const slug = input.study
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'general'
  const ts = new Date().toISOString()
  const content: Record<string, unknown> = {
    schema: 'hanzo.science.preregistration.v1',
    study: input.study.trim(),
    statement: input.hypothesis.trim(),
    null_hypothesis: input.nullHypothesis.trim(),
    metric: input.metric.trim(),
    target_delta: input.targetDelta,
    higher_is_better: input.higherIsBetter,
    manifest_sha256: input.manifestSha256.trim(),
    progressive_screening: {
      screening_samples: input.screeningSamples,
      qualification_samples: input.qualificationSamples,
      anytime_valid: input.anytimeValid,
      promote_rule: 'never_promote_screening_without_qualification',
    },
    budget: {
      max_compute_seconds: input.maxComputeSeconds,
      max_cost_usd: input.maxCostUsd,
    },
    registered_at: ts,
  }
  const digest = await sha256CanonicalJson(content)
  const uri = `research://hypotheses/${slug}/${digest.slice(0, 16)}`
  const links = input.relatedOpportunityId
    ? [{ rel: 'addresses', uri: `research://opportunities/${slug}/${input.relatedOpportunityId}` }]
    : []
  return fileEvidence(
    {
      uri,
      kind: input.evidenceKind,
      content: { ...content, hypothesis_id: `sha256:${digest}` },
      links,
    },
    `prereg-${digest.slice(0, 24)}`,
  )
}

export async function listArtifacts(runId?: string, project?: string): Promise<ArtifactRecord[]> {
  const out = await requestScienceJson<{ data?: unknown[] }>('/v1/research/artifacts', {
    query: { run: runId, project },
  })
  return asArr(out.data).map((raw) => {
    const a = asObj(raw)
    return {
      sha256: asStr(a.sha256),
      kind: asStr(a.kind, 'report'),
      ref: asStr(a.ref) || undefined,
      run_id: asStr(a.run_id),
      project: asStr(a.project) || undefined,
      visibility: asStr(a.visibility) || undefined,
      git_sha: asStr(a.git_sha) || undefined,
      git_branch: asStr(a.git_branch) || undefined,
      git_dirty: Boolean(a.git_dirty),
      media_type: asStr(a.media_type) || undefined,
      uncompressed_size: typeof a.uncompressed_size === 'number' ? a.uncompressed_size : undefined,
      ts: typeof a.ts === 'number' ? a.ts : undefined,
    }
  })
}

export async function fetchAndVerifyArtifact(sha256: string, project?: string): Promise<VerifiedArtifactBlob> {
  const cleanHash = sha256.trim().replace(/^sha256:/i, '').toLowerCase()
  const root = api().replace(/\/+$/, '')
  const url = `${root}/v1/research/artifacts/${encodeURIComponent(cleanHash)}${buildQuery({ project })}`
  const res = await fetch(url, {
    method: 'GET',
    headers: scienceHeaders({ accept: '*/*' }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(errText ? `Artifact fetch failed (${res.status}): ${errText.slice(0, 160)}` : `Artifact HTTP ${res.status}`)
  }
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const arrayBuf = await res.arrayBuffer()
  const bytes = new Uint8Array(arrayBuf)
  const computedSha256 = await sha256HexBytes(bytes)
  const verified = computedSha256.toLowerCase() === cleanHash

  let previewText: string | null = null
  let dataUrl: string | null = null

  if (contentType.startsWith('image/')) {
    let bin = ''
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]!)
    }
    if (typeof btoa === 'function') {
      dataUrl = `data:${contentType};base64,${btoa(bin)}`
    }
  } else if (bytes.length <= 256 * 1024) {
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    try {
      previewText = JSON.stringify(JSON.parse(decoded), null, 2)
    } catch {
      previewText = decoded
    }
  }

  return {
    expectedSha256: cleanHash,
    computedSha256,
    verified,
    byteLength: bytes.byteLength,
    contentType,
    previewText,
    dataUrl,
    bytes,
  }
}

// ── Opportunities Queue ──────────────────────────────────────────────────────

export async function listOpportunities(params: {
  studies?: readonly StudyRecord[]
  experiments?: readonly ExperimentRecord[]
  runs?: readonly RunRecord[]
  signal?: AbortSignal
} = {}): Promise<OpportunityItem[]> {
  const byId = new Map<string, OpportunityItem>()

  // 1. Read versioned opportunity records stored in `/v1/research/evidence`
  const uris = ['research://opportunities/default']
  for (const st of (params.studies ?? []).slice(0, 5)) {
    if (st.id) uris.push(`research://opportunities/${st.id}`)
  }

  const evLists = await Promise.all(
    uris.map((u) => listEvidenceByUri(u, params.signal).catch(() => [] as EvidenceRecord[])),
  )

  for (const versions of evLists) {
    if (versions.length === 0) continue
    const latest = versions.reduce((best, cur) => (cur.version >= best.version ? cur : best), versions[0]!)
    let full = latest
    if ((!full.content || typeof full.content !== 'object') && full.id) {
      full = await getEvidenceById(full.id, params.signal).catch(() => latest)
    }
    const content = asObj(full.content)
    const items = Array.isArray(full.content)
      ? full.content
      : Array.isArray(content.opportunities)
        ? content.opportunities
        : content.opportunity_id
          ? [content]
          : []

    for (const raw of items) {
      const o = asObj(raw)
      const id = asStr(o.opportunity_id || o.id)
      if (!id) continue
      const gain = asNum(o.expected_improvement ?? o.expected_gain, 0.15)
      const cost = Math.max(0.01, asNum(o.compute_cost, 1.0))
      const approach = asStr(o.proposed_approach || o.hypothesis || o.objective)
      const explicitAxis = asStr(o.axis) as OpportunityAxis
      const axis: OpportunityAxis =
        explicitAxis === 'model_scale' ||
        explicitAxis === 'context_len' ||
        explicitAxis === 'gpu_arch' ||
        explicitAxis === 'workload'
          ? explicitAxis
          : inferOpportunityAxis(`${id} ${asStr(o.domain)} ${approach}`)
      const statusRaw = asStr(o.status, 'open').toLowerCase()
      const status: OpportunityItem['status'] =
        statusRaw === 'leased' ||
        statusRaw === 'running' ||
        statusRaw === 'completed' ||
        statusRaw === 'refuted' ||
        statusRaw === 'skipped'
          ? statusRaw
          : 'open'

      byId.set(id, {
        opportunity_id: id,
        domain: asStr(o.domain, 'general'),
        objective: asStr(o.objective, `${asStr(o.domain, 'general')}:followup`),
        axis,
        current_best: asNum(o.current_best, 0),
        proposed_approach: approach,
        expected_improvement: gain,
        compute_cost: cost,
        priority_score: gain / cost,
        related_experiments: asArr(o.related_experiments).map(String),
        trigger_rule: asStr(o.trigger_rule, 'evidence_queue'),
        status,
        evidence_uri: full.uri,
        evidence_version: full.version,
      })
    }
  }

  // 2. Synthesize follow-up opportunities from canonical experiments (`meta.next_hypothesis`)
  for (const exp of params.experiments ?? []) {
    const nxt = asStr(exp.meta?.next_hypothesis).trim()
    if (!nxt) continue
    const opId = `${exp.id}->followup`
    if (byId.has(opId)) continue
    const verdict = classifyVerdict(exp)
    const gain = verdict === 'proven' ? 0.2 : verdict === 'promising_inconclusive' ? 0.14 : 0.1
    const cost = Math.max(0.1, exp.cost_usd > 0 ? exp.cost_usd : 1.0)
    const domain = asStr(exp.meta?.study || exp.task, 'general')
    byId.set(opId, {
      opportunity_id: opId,
      domain,
      objective: `${domain}:followup`,
      axis: inferOpportunityAxis(`${domain} ${nxt} ${exp.subject}`),
      current_best: exp.value,
      proposed_approach: nxt,
      expected_improvement: gain,
      compute_cost: cost,
      priority_score: gain / cost,
      related_experiments: [exp.id],
      trigger_rule: `experiment_next_hypothesis:${exp.id}`,
      status: 'open',
    })
  }

  // 3. Synthesize follow-ups from run JSON notes (`next_hypothesis`)
  for (const run of params.runs ?? []) {
    if (!run.notes || !run.notes.trim().startsWith('{')) continue
    try {
      const notes = asObj(JSON.parse(run.notes))
      const nxt = asStr(notes.next_hypothesis).trim()
      if (!nxt) continue
      const opId = `${run.id}->followup`
      if (byId.has(opId)) continue
      const dom = run.study || run.benchmark || 'general'
      const bestVal = run.measures?.[0]?.value ?? 0
      byId.set(opId, {
        opportunity_id: opId,
        domain: dom,
        objective: `${dom}:followup`,
        axis: inferOpportunityAxis(`${dom} ${nxt} ${run.system ?? ''}`),
        current_best: bestVal,
        proposed_approach: nxt,
        expected_improvement: 0.15,
        compute_cost: 1.0,
        priority_score: 0.15,
        related_experiments: [run.id],
        trigger_rule: `run_notes:${run.id}`,
        status: 'open',
      })
    } catch {
      // Non-JSON run notes carry no structured follow-up.
    }
  }

  return [...byId.values()].sort((a, b) => b.priority_score - a.priority_score || a.opportunity_id.localeCompare(b.opportunity_id))
}

// ── Linked Machines, Cloud Leases & Fleet Discovery ──────────────────────────

function extractBusy(source: Record<string, unknown>): { busy: boolean; reason: string } {
  const reason = asStr(source.busyReason || source.busy_reason || source.lastBusyReason).trim()
  if (typeof source.busy === 'boolean') {
    return { busy: source.busy, reason }
  }
  if (typeof source.running === 'number' && source.running > 0) {
    return { busy: true, reason: reason || `active_sessions:${source.running}` }
  }
  const st = asStr(source.status || source.state).trim().toLowerCase()
  if (st === 'busy') {
    return { busy: true, reason: reason || 'busy' }
  }
  if (reason) {
    return { busy: true, reason }
  }
  return { busy: false, reason: '' }
}

export async function listActiveCloudLeases(
  campaigns: readonly string[] = ['default'],
  signal?: AbortSignal,
): Promise<CloudLeaseInfo[]> {
  const uris = new Set<string>(['research://leases', 'research://leases/default'])
  for (const c of campaigns) {
    if (c.trim()) uris.add(`research://leases/${c.trim()}`)
  }
  const results = await Promise.all(
    [...uris].map((uri) => listEvidenceByUri(uri, signal).catch(() => [] as EvidenceRecord[])),
  )

  const leases: CloudLeaseInfo[] = []
  const seenUris = new Set<string>()
  for (const rows of results) {
    for (const ev of rows) {
      if (seenUris.has(ev.uri)) continue
      seenUris.add(ev.uri)
      const c = asObj(ev.content)
      const state = asStr(c.state)
      if (!state && !c.owner_worker_id) continue
      leases.push({
        uri: ev.uri,
        campaign: asStr(c.campaign, 'default'),
        opportunity_id: asStr(c.opportunity_id),
        fencing_token: ev.version || asNum(c.expected_prev_version, 0) + 1,
        owner_worker_id: asStr(c.owner_worker_id),
        host: asStr(c.host),
        acquired_at_unix: asNum(c.acquired_at_unix, 0),
        expires_at_unix: asNum(c.expires_at_unix, 0),
        reclaimed_from: asStr(c.reclaimed_from) || undefined,
        state: state || 'held',
      })
    }
  }
  return leases
}

export async function listLinkedMachines(options: {
  localWorker?: HanzodWorkerState | null
  leases?: readonly CloudLeaseInfo[]
  signal?: AbortSignal
} = {}): Promise<LinkedMachine[]> {
  const [fleetResp, targetsResp] = await Promise.all([
    requestScienceJson<unknown>('/v1/compute/fleet/workers', { signal: options.signal }).catch(() => ({ workers: [] })),
    requestScienceJson<unknown>('/v1/agent/targets', { signal: options.signal }).catch(() => ({ targets: [] })),
  ])

  const fleetObj = asObj(fleetResp)
  const fleetRows = Array.isArray(fleetResp) ? fleetResp : asArr(fleetObj.workers ?? fleetObj.data)

  const targetObj = asObj(targetsResp)
  const targetRows = Array.isArray(targetsResp) ? targetsResp : asArr(targetObj.targets ?? targetObj.data)

  const byKey = new Map<string, LinkedMachine>()
  const aliasToKey = new Map<string, string>()

  for (const raw of fleetRows) {
    const item = asObj(raw)
    const mid = asStr(item.id || item.hostname).trim()
    if (!mid) continue
    const hostname = asStr(item.hostname, mid).trim()
    const status = asStr(item.status, 'online').trim()
    const online = ONLINE_STATES.has(status.toLowerCase())
    const { busy, reason } = extractBusy(item)
    const gpus: GpuDeviceSpec[] = asArr(item.gpus).map((g) => {
      const go = asObj(g)
      return {
        name: asStr(go.name),
        arch: asStr(go.arch) || undefined,
        vendor: asStr(go.vendor) || undefined,
        memoryTotal: asStr(go.memoryTotal) || undefined,
        unified: Boolean(go.unified),
      }
    })
    let memBytes = parseMemBytes(item.memory)
    if (memBytes === 0 && gpus.length > 0) {
      memBytes = Math.max(...gpus.map((g) => parseMemBytes(g.memoryTotal)))
    }
    const memGb = memBytes > 0 ? Math.round((memBytes / 1024 ** 3) * 100) / 100 : 0
    const caps = asArr(item.capabilities).map(String).filter(Boolean)
    const backends = inferMachineBackends({
      os: asStr(item.os),
      capabilities: caps,
      backends: asArr(item.backends).map(String),
      capacity: asStr(item.capacity),
      label: asStr(item.label),
      cpuModel: asStr(item.cpuModel),
      gpus,
    })
    const queue = asStr(item.jobQueue || item.taskQueue).trim() || resolveTaskQueue(mid)

    const machine: LinkedMachine = {
      id: mid,
      hostname,
      status,
      online,
      os: asStr(item.os),
      arch: asStr(item.arch),
      cpus: asNum(item.cpus, 0),
      memory_bytes: memBytes,
      memory_gb: memGb,
      capacity: asStr(item.capacity),
      gpus,
      capabilities: caps.length > 0 ? caps : ['research.bench', 'research.tick', 'hanzod.run'],
      backends,
      task_queue: queue,
      busy,
      busy_reason: reason,
      gpu_util_pct: typeof item.gpu_util_pct === 'number' ? item.gpu_util_pct : null,
    }
    const key = mid.toLowerCase()
    byKey.set(key, machine)
    aliasToKey.set(key, key)
    aliasToKey.set(hostname.toLowerCase(), key)
    if (key.endsWith('-hanzod')) {
      aliasToKey.set(key.slice(0, -'-hanzod'.length), key)
    }
  }

  for (const raw of targetRows) {
    const item = asObj(raw)
    const label = asStr(item.label).trim()
    const host = asStr(item.host || item.hostname).trim()
    const rawId = asStr(item.id).trim()
    const handle = label && /^[a-zA-Z0-9._-]+$/.test(label) ? label : host || rawId || label
    if (!handle) continue

    const existingKey =
      aliasToKey.get(handle.toLowerCase()) ||
      (host ? aliasToKey.get(host.toLowerCase()) : undefined) ||
      (rawId ? aliasToKey.get(rawId.toLowerCase()) : undefined)

    const spec = asObj(item.spec)
    const gpus: GpuDeviceSpec[] = asArr(spec.gpus ?? item.gpus).map((g) => {
      const go = asObj(g)
      return {
        name: asStr(go.name),
        arch: asStr(go.arch) || undefined,
        vendor: asStr(go.vendor) || undefined,
        memoryTotal: asStr(go.memoryTotal) || undefined,
      }
    })
    const { busy, reason } = extractBusy(item)
    const backends = inferMachineBackends({
      os: asStr(spec.os || item.os),
      capabilities: asArr(item.capabilities).map(String),
      backends: asArr(item.backends).map(String),
      capacity: asStr(item.capacity),
      label,
      gpus,
    })

    if (existingKey && byKey.has(existingKey)) {
      const existing = byKey.get(existingKey)!
      if (!existing.gpus.length && gpus.length) existing.gpus = gpus
      if (!existing.busy && busy) {
        existing.busy = true
        existing.busy_reason = reason
      }
      for (const b of backends) {
        if (!existing.backends.includes(b)) existing.backends.push(b)
      }
      continue
    }

    const status = asStr(item.status, 'offline').trim()
    const memBytes = parseMemBytes(spec.memory ?? item.memory)
    const key = handle.toLowerCase()
    byKey.set(key, {
      id: handle,
      hostname: host || handle,
      status,
      online: ONLINE_STATES.has(status.toLowerCase()),
      os: asStr(spec.os || item.os),
      arch: asStr(spec.arch || item.arch),
      cpus: asNum(spec.cpus ?? item.cpus, 0),
      memory_bytes: memBytes,
      memory_gb: memBytes > 0 ? Math.round((memBytes / 1024 ** 3) * 100) / 100 : 0,
      capacity: asStr(item.capacity),
      gpus,
      capabilities: asArr(item.capabilities).map(String).filter(Boolean).length
        ? asArr(item.capabilities).map(String).filter(Boolean)
        : ['research.bench', 'research.tick', 'hanzod.run'],
      backends,
      task_queue: resolveTaskQueue(handle),
      busy,
      busy_reason: reason,
    })
    aliasToKey.set(key, key)
  }

  // Merge Desktop / local `hanzod` worker state directly
  const lw = options.localWorker
  if (lw) {
    const wid = (lw.worker_id || lw.hostname || 'local-hanzod').trim()
    const existingKey = aliasToKey.get(wid.toLowerCase()) || aliasToKey.get(lw.hostname.toLowerCase())
    const memGb = lw.memory > 0 ? Math.round((lw.memory / 1024 ** 3) * 100) / 100 : 0
    const backends = inferMachineBackends({
      os: lw.os,
      capabilities: lw.capabilities,
      backends: lw.backends,
      cpuModel: lw.cpu_model,
      gpus: lw.gpus,
    })
    if (existingKey && byKey.has(existingKey)) {
      const m = byKey.get(existingKey)!
      m.online = true
      m.status = lw.busy ? 'busy' : 'online'
      m.is_local_hanzod = true
      m.busy = lw.busy
      m.busy_reason = lw.busy_reason ?? m.busy_reason
      m.gpu_util_pct = lw.gpu_util_pct ?? m.gpu_util_pct
      m.when_idle_only = lw.when_idle_only
      m.targeted_only = lw.targeted_only
      m.max_gpu_util_pct = lw.max_gpu_util_pct
      if (!m.gpus.length && lw.gpus.length) m.gpus = lw.gpus
      if (!m.os && lw.os) m.os = lw.os
      if (!m.arch && lw.arch) m.arch = lw.arch
    } else {
      byKey.set(wid.toLowerCase(), {
        id: wid,
        hostname: lw.hostname || wid,
        status: lw.busy ? 'busy' : 'online',
        online: true,
        os: lw.os,
        arch: lw.arch,
        cpus: lw.cpus,
        memory_bytes: lw.memory,
        memory_gb: memGb,
        capacity: `${lw.cpus} CPU · ${memGb} GB`,
        gpus: lw.gpus,
        capabilities: lw.capabilities.length ? lw.capabilities : ['research.bench', 'research.tick', 'hanzod.run'],
        backends,
        task_queue: lw.queues.find((q) => q.startsWith('gpu:')) ?? resolveTaskQueue(wid),
        busy: lw.busy,
        busy_reason: lw.busy_reason ?? '',
        gpu_util_pct: lw.gpu_util_pct ?? null,
        is_local_hanzod: true,
        when_idle_only: lw.when_idle_only,
        targeted_only: lw.targeted_only,
        max_gpu_util_pct: lw.max_gpu_util_pct,
      })
    }
  }

  // Attach active Cloud leases by owner_worker_id / host
  const nowSec = Math.floor(Date.now() / 1000)
  for (const lease of options.leases ?? []) {
    if (lease.state !== 'held' || (lease.expires_at_unix > 0 && lease.expires_at_unix < nowSec)) continue
    for (const m of byKey.values()) {
      if (
        m.id.toLowerCase() === lease.owner_worker_id.toLowerCase() ||
        m.hostname.toLowerCase() === lease.host.toLowerCase()
      ) {
        m.active_lease = lease
      }
    }
  }

  return [...byKey.values()].sort((a, b) => Number(b.online) - Number(a.online) || a.id.localeCompare(b.id))
}

// ── hanzoai/tasks Workflow Activities & Live SSE Events ──────────────────────

function parseWorkflowActivity(raw: unknown, fallbackId = ''): WorkflowActivity {
  const a = asObj(raw)
  const exec = asObj(a.execution)
  const actTypeObj = asObj(a.activityType)
  const id = asStr(exec.workflowId || a.activityId || a.id, fallbackId)
  const runId = asStr(exec.runId || a.runId, id)
  const typeName = asStr(actTypeObj.name || a.type || a.activityType, 'research.bench')
  const started = asStr(a.startedTime || a.startTime) || undefined
  const closed = asStr(a.closedTime || a.closeTime) || undefined
  let durationMs: number | null = null
  if (started && closed) {
    const t0 = Date.parse(started)
    const t1 = Date.parse(closed)
    if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) {
      durationMs = t1 - t0
    }
  }

  let failureText = ''
  if (typeof a.failure === 'string') {
    failureText = a.failure
  } else if (a.failure && typeof a.failure === 'object') {
    failureText = asStr(asObj(a.failure).message || asObj(a.failure).cause, JSON.stringify(a.failure))
  } else if (typeof a.cause === 'string') {
    failureText = a.cause
  }

  return {
    id,
    activityId: id,
    runId,
    activityType: typeName,
    taskQueue: asStr(a.taskQueue || a.task_queue, 'gpu-jobs'),
    status: asStr(a.status || a.state, 'ACTIVITY_TASK_STATE_SCHEDULED'),
    attempt: Math.max(1, asNum(a.attempt, 1)),
    deferCount: asNum(a.deferCount, 0),
    lastBusyReason: asStr(a.lastBusyReason || a.busy_reason),
    workerIdentity: asStr(a.workerIdentity || a.identity),
    scheduledTime: asStr(a.scheduledTime || a.scheduleTime) || undefined,
    startedTime: started,
    closedTime: closed,
    durationMs,
    input: a.input && typeof a.input === 'object' ? (a.input as Record<string, unknown>) : undefined,
    result: a.result,
    failure: failureText || undefined,
  }
}

export async function ensureWorkflowNamespace(namespace = GPU_JOBS_NAMESPACE): Promise<void> {
  const ns = namespace.trim() || GPU_JOBS_NAMESPACE
  try {
    await requestScienceJson('/v1/workflow/namespaces', {
      method: 'POST',
      body: JSON.stringify({
        name: ns,
        namespaceInfo: {
          name: ns,
          state: 'NAMESPACE_STATE_REGISTERED',
          description: 'Hanzo autonomous research and GPU task queue',
        },
        config: { workflowExecutionRetentionTtl: '720h' },
        isActive: true,
      }),
    })
  } catch {
    // Namespace already registered or managed by linked workers.
  }
}

export async function listWorkflowActivities(
  namespace = GPU_JOBS_NAMESPACE,
  pageSize = 50,
  signal?: AbortSignal,
): Promise<WorkflowActivity[]> {
  const ns = encodeURIComponent(namespace.trim() || GPU_JOBS_NAMESPACE)
  const out = await requestScienceJson<{ activities?: unknown[]; data?: unknown[] }>(
    `/v1/workflow/namespaces/${ns}/activities`,
    { query: { pageSize }, signal },
  )
  return asArr(out.activities ?? out.data).map((row) => parseWorkflowActivity(row))
}

export async function describeWorkflowActivity(
  activityId: string,
  runId?: string,
  namespace = GPU_JOBS_NAMESPACE,
): Promise<WorkflowActivity> {
  const ns = encodeURIComponent(namespace.trim() || GPU_JOBS_NAMESPACE)
  const aid = encodeURIComponent(activityId.trim())
  const rid = encodeURIComponent((runId || activityId).trim())
  const out = await requestScienceJson<unknown>(`/v1/workflow/namespaces/${ns}/activities/${aid}/${rid}`)
  return parseWorkflowActivity(out, activityId)
}

export interface DispatchActivityInput {
  targets: string | readonly string[]
  activityType?: 'research.bench' | 'research.tick' | 'hanzod.run' | string
  command?: string
  benchmark?: string
  study?: string
  hypothesisId?: string
  whenIdleOnly?: boolean
  requiredBackend?: string
  maxComputeSeconds?: number
  extraInput?: Record<string, unknown>
  namespace?: string
}

export async function dispatchResearchActivities(input: DispatchActivityInput): Promise<WorkflowActivity[]> {
  const ns = (input.namespace ?? GPU_JOBS_NAMESPACE).trim() || GPU_JOBS_NAMESPACE
  const actType = (input.activityType ?? 'research.bench').trim() || 'research.bench'
  const whenIdleOnly = input.whenIdleOnly ?? true
  const rawTargets = parseTargets(input.targets)
  const targets = rawTargets.length > 0 ? rawTargets : ['any']

  const dispatched: WorkflowActivity[] = []
  for (let idx = 0; idx < targets.length; idx++) {
    const rawTarget = targets[idx]!
    const isTargeted = rawTarget.toLowerCase() !== 'any' && rawTarget !== 'gpu-jobs'
    const cleanMachine = isTargeted ? rawTarget.replace(/^gpu:/, '') : 'any'
    const taskQueue = resolveTaskQueue(rawTarget)
    const scheduleToCloseTimeout = isTargeted ? '72h' : '24h'

    const payload: Record<string, unknown> = {
      ...(input.extraInput ?? {}),
      when_idle_only: whenIdleOnly,
      allow_when_busy: !whenIdleOnly,
    }
    if (isTargeted) payload.target_machine = cleanMachine
    if (input.command?.trim()) payload.command = input.command.trim()
    if (input.benchmark?.trim()) payload.benchmark = input.benchmark.trim()
    if (input.study?.trim()) payload.study = input.study.trim()
    if (input.hypothesisId?.trim()) payload.hypothesis_id = input.hypothesisId.trim()
    if (input.requiredBackend?.trim() && input.requiredBackend !== 'any') {
      payload.required_backend = input.requiredBackend.trim().toUpperCase()
    }
    if (input.maxComputeSeconds && input.maxComputeSeconds > 0) {
      payload.max_compute_seconds = Math.floor(input.maxComputeSeconds)
    }

    const seed = await sha256CanonicalJson({
      namespace: ns,
      taskQueue,
      activityType: actType,
      idx,
      input: payload,
      ts: Date.now(),
    })
    const jobId = `job-${Date.now()}-${seed.slice(0, 10)}${targets.length > 1 && isTargeted ? `-${cleanMachine}` : ''}`
    const reqId = `req-${seed.slice(0, 24)}`

    const body = {
      id: jobId,
      activityId: jobId,
      runId: jobId,
      type: actType,
      activityType: { name: actType },
      taskQueue,
      input: payload,
      retryPolicy: { ...DEFAULT_RETRY_POLICY },
      heartbeatTimeout: '60s',
      startToCloseTimeout: input.maxComputeSeconds ? `${Math.max(60, Math.floor(input.maxComputeSeconds))}s` : '1800s',
      scheduleToCloseTimeout,
      requestId: reqId,
    }

    const resp = await requestScienceJson<unknown>(
      `/v1/workflow/namespaces/${encodeURIComponent(ns)}/activities`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    )
    const parsed = parseWorkflowActivity(resp, jobId)
    if (!parsed.input) parsed.input = payload
    dispatched.push(parsed)
  }

  return dispatched
}

export async function cancelWorkflowActivity(
  activityId: string,
  runId?: string,
  reason = 'Canceled from Hanzo Science',
  namespace = GPU_JOBS_NAMESPACE,
): Promise<WorkflowActivity> {
  const ns = encodeURIComponent(namespace.trim() || GPU_JOBS_NAMESPACE)
  const aid = encodeURIComponent(activityId.trim())
  const rid = encodeURIComponent((runId || activityId).trim())
  const out = await requestScienceJson<unknown>(
    `/v1/workflow/namespaces/${ns}/activities/${aid}/${rid}/cancel`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  )
  return parseWorkflowActivity(out, activityId)
}

/**
 * Subscribe to `/v1/workflow/events` SSE stream with auth + org headers and
 * automatic exponential-backoff reconnect until `signal` aborts.
 */
export async function subscribeWorkflowEvents(options: {
  signal: AbortSignal
  namespace?: string
  onEvent: (ev: WorkflowSseEvent) => void
  onConnectionChange?: (state: 'connected' | 'reconnecting' | 'unsupported') => void
}): Promise<void> {
  const targetNs = (options.namespace ?? GPU_JOBS_NAMESPACE).trim()
  let attempt = 0

  while (!options.signal.aborted) {
    try {
      const root = api().replace(/\/+$/, '')
      const res = await fetch(`${root}/v1/workflow/events`, {
        method: 'GET',
        headers: {
          ...scienceHeaders({ accept: 'text/event-stream' }),
          'Cache-Control': 'no-cache',
        },
        signal: options.signal,
      })

      if (res.status === 404 || res.status === 405 || res.status === 501) {
        options.onConnectionChange?.('unsupported')
        return
      }
      if (!res.ok || !res.body) {
        throw new Error(`SSE HTTP ${res.status}`)
      }

      attempt = 0
      options.onConnectionChange?.('connected')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventKind = ''
      let dataLines: string[] = []

      while (!options.signal.aborted) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith(':')) continue
          if (line === '') {
            if (dataLines.length > 0) {
              const rawTxt = dataLines.join('\n')
              dataLines = []
              try {
                const evObj = asObj(JSON.parse(rawTxt))
                const kind = asStr(evObj.kind, eventKind || 'workflow.event')
                const evNs = asStr(evObj.namespace, targetNs)
                const actId = asStr(evObj.workflow_id || evObj.activityId || evObj.id)
                const runId = asStr(evObj.run_id || evObj.runId, actId)
                const evData = asObj(evObj.data)
                if (!targetNs || !evNs || evNs === targetNs) {
                  options.onEvent({
                    kind,
                    namespace: evNs,
                    activityId: actId,
                    runId,
                    timestamp: asStr(evObj.timestamp || evObj.time, new Date().toISOString()),
                    deferCount: typeof evData.deferCount === 'number' ? evData.deferCount : undefined,
                    raw: evObj,
                  })
                }
              } catch {
                // Ignore malformed SSE comment/heartbeat frames.
              }
            }
            eventKind = ''
            continue
          }
          if (line.startsWith('event:')) {
            eventKind = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trimStart())
          }
        }
      }
    } catch {
      if (options.signal.aborted) return
    }

    if (options.signal.aborted) return
    attempt += 1
    options.onConnectionChange?.('reconnecting')
    const backoffMs = Math.min(12_000, 350 * 2 ** Math.min(attempt, 5))
    await sleep(backoffMs)
  }
}

// ── hanzoai/tasks Schedules CRUD (`/v1/workflow/namespaces/gpu-jobs/schedules`) ─

function parseScheduleRecord(raw: unknown, fallbackId = ''): ScheduleRecord {
  const s = asObj(raw)
  const spec = asObj(s.spec)
  const action = asObj(s.action)
  const state = asObj(s.state)
  const info = asObj(s.info)
  const input = asObj(action.input)
  const actType = asObj(action.activityType)
  const wfType = asObj(action.workflowType)

  const intervals = asArr(spec.interval)
    .map((iv) => (typeof iv === 'string' ? iv : asStr(asObj(iv).interval)))
    .filter(Boolean)
  const cronStrings = asArr(spec.cronString ?? spec.cronExpressions).map(String).filter(Boolean)

  const nextTimes = asArr(info.nextActionTimes ?? s.nextActionTimes).map(String).filter(Boolean)
  const nextSingle = asStr(info.nextActionTime ?? s.nextActionTime) || nextTimes[0] || null

  const recentRaw = asArr(info.recentActions ?? s.recentActions)
  const recentActions: ScheduleRecentAction[] = recentRaw.map((r) => {
    const ro = asObj(r)
    const exec = asObj(ro.startWorkflowResult ?? ro.execution)
    return {
      scheduledTime: asStr(ro.scheduleTime || ro.scheduledTime) || undefined,
      actualTime: asStr(ro.actualTime) || undefined,
      workflowId: asStr(exec.workflowId || ro.workflowId || ro.activityId) || undefined,
      runId: asStr(exec.runId || ro.runId) || undefined,
      status: asStr(ro.status) || undefined,
    }
  })

  const taskQueue = asStr(action.taskQueue, 'gpu-jobs')
  const targetMachine =
    asStr(input.target_machine) || (taskQueue.startsWith('gpu:') ? taskQueue.slice(4) : 'any')

  return {
    scheduleId: asStr(s.scheduleId || s.id, fallbackId),
    namespace: asStr(s.namespace, GPU_JOBS_NAMESPACE),
    intervals,
    cronStrings,
    taskQueue,
    activityType: asStr(actType.name, 'research.tick'),
    workflowType: asStr(wfType.name) || undefined,
    whenIdleOnly: input.when_idle_only !== false,
    maxComputeSeconds: typeof input.max_compute_seconds === 'number' ? input.max_compute_seconds : null,
    command: asStr(input.command) || undefined,
    campaign: asStr(input.campaign) || undefined,
    targetMachine,
    paused: Boolean(state.paused ?? s.paused),
    note: asStr(state.note ?? s.note),
    nextActionTime: nextSingle,
    recentActions,
    raw: s,
  }
}

export async function listSchedules(namespace = GPU_JOBS_NAMESPACE, signal?: AbortSignal): Promise<ScheduleRecord[]> {
  const ns = encodeURIComponent(namespace.trim() || GPU_JOBS_NAMESPACE)
  const out = await requestScienceJson<{ schedules?: unknown[]; data?: unknown[] }>(
    `/v1/workflow/namespaces/${ns}/schedules`,
    { signal },
  )
  return asArr(out.schedules ?? out.data).map((r) => parseScheduleRecord(r))
}

export async function describeSchedule(
  scheduleId: string,
  namespace = GPU_JOBS_NAMESPACE,
): Promise<ScheduleRecord> {
  const ns = encodeURIComponent(namespace.trim() || GPU_JOBS_NAMESPACE)
  const sid = encodeURIComponent(scheduleId.trim())
  const out = await requestScienceJson<unknown>(`/v1/workflow/namespaces/${ns}/schedules/${sid}`)
  const parsed = parseScheduleRecord(out, scheduleId)
  if (!parsed.nextActionTime && !parsed.paused) {
    try {
      const mt = await requestScienceJson<{ matchingTimes?: string[] }>(
        `/v1/workflow/namespaces/${ns}/schedules/${sid}/matching-times`,
      )
      if (mt.matchingTimes && mt.matchingTimes.length > 0) {
        parsed.nextActionTime = mt.matchingTimes[0] ?? null
      }
    } catch {
      // Optional matching-times enrichment.
    }
  }
  return parsed
}

export interface UpsertScheduleInput {
  scheduleId: string
  interval?: string
  cron?: string
  target?: string
  activityType?: string
  whenIdleOnly?: boolean
  maxComputeSeconds?: number
  command?: string
  campaign?: string
  requiredBackend?: string
  paused?: boolean
  note?: string
  namespace?: string
}

function buildScheduleWireBody(
  scheduleId: string,
  singleTarget: string | undefined,
  input: UpsertScheduleInput,
): Record<string, unknown> {
  const ns = (input.namespace ?? GPU_JOBS_NAMESPACE).trim() || GPU_JOBS_NAMESPACE
  const isTargeted = Boolean(
    singleTarget && singleTarget.toLowerCase() !== 'any' && singleTarget !== 'gpu-jobs',
  )
  const spec: Record<string, unknown> = {}
  if (input.cron?.trim()) spec.cronString = [input.cron.trim()]
  if (input.interval?.trim()) spec.interval = [{ interval: input.interval.trim() }]

  const actInput: Record<string, unknown> = {
    when_idle_only: input.whenIdleOnly ?? true,
  }
  if (isTargeted && singleTarget) {
    actInput.target_machine = singleTarget.replace(/^gpu:/, '')
  }
  if (input.command?.trim()) actInput.command = input.command.trim()
  if (input.campaign?.trim()) actInput.campaign = input.campaign.trim()
  if (input.maxComputeSeconds && input.maxComputeSeconds > 0) {
    actInput.max_compute_seconds = Math.floor(input.maxComputeSeconds)
  }
  if (input.requiredBackend?.trim() && input.requiredBackend !== 'any') {
    actInput.required_backend = input.requiredBackend.trim().toUpperCase()
  }

  const actType = (input.activityType ?? 'research.tick').trim() || 'research.tick'
  return {
    scheduleId,
    namespace: ns,
    spec,
    action: {
      taskQueue: resolveTaskQueue(singleTarget),
      activityType: { name: actType },
      input: actInput,
      retryPolicy: { ...DEFAULT_RETRY_POLICY },
      heartbeatTimeout: '60s',
      startToCloseTimeout: input.maxComputeSeconds
        ? `${Math.max(60, Math.floor(input.maxComputeSeconds))}s`
        : '1800s',
      scheduleToCloseTimeout: isTargeted ? '72h' : '24h',
    },
    state: {
      paused: Boolean(input.paused),
      note: input.note?.trim() ?? '',
    },
  }
}

export async function createSchedule(input: UpsertScheduleInput): Promise<ScheduleRecord[]> {
  const sid = input.scheduleId.trim()
  if (!sid) throw new Error('Schedule ID is required')
  if (!input.interval?.trim() && !input.cron?.trim()) {
    throw new Error('Schedule requires an interval (e.g. 30m) or cron expression (e.g. 0 */2 * * *)')
  }
  const ns = (input.namespace ?? GPU_JOBS_NAMESPACE).trim() || GPU_JOBS_NAMESPACE
  await ensureWorkflowNamespace(ns)

  const targets = parseTargets(input.target)
  const list = targets.length > 0 ? targets : ['any']
  const created: ScheduleRecord[] = []

  for (const t of list) {
    const cleanT = t.replace(/^gpu:/, '')
    const effectiveId = list.length > 1 && cleanT !== 'any' ? `${sid}-${cleanT}` : sid
    const body = buildScheduleWireBody(effectiveId, t, input)
    const out = await requestScienceJson<unknown>(
      `/v1/workflow/namespaces/${encodeURIComponent(ns)}/schedules`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    )
    created.push(parseScheduleRecord(out, effectiveId))
  }
  return created
}

export async function updateSchedule(input: UpsertScheduleInput): Promise<ScheduleRecord> {
  const sid = input.scheduleId.trim()
  const ns = (input.namespace ?? GPU_JOBS_NAMESPACE).trim() || GPU_JOBS_NAMESPACE
  const targets = parseTargets(input.target)
  const singleTarget = targets[0] ?? 'any'
  const body = buildScheduleWireBody(sid, singleTarget, input)

  try {
    const out = await requestScienceJson<unknown>(
      `/v1/workflow/namespaces/${encodeURIComponent(ns)}/schedules/${encodeURIComponent(sid)}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    )
    return parseScheduleRecord(out, sid)
  } catch {
    await deleteSchedule(sid, ns).catch(() => {})
    const recreated = await createSchedule({ ...input, target: singleTarget })
    return recreated[0]!
  }
}

export async function pauseSchedule(
  scheduleId: string,
  note = 'Paused from Hanzo Science',
  namespace = GPU_JOBS_NAMESPACE,
): Promise<{ status: string }> {
  const ns = encodeURIComponent(namespace.trim() || GPU_JOBS_NAMESPACE)
  const sid = encodeURIComponent(scheduleId.trim())
  return requestScienceJson<{ status: string }>(
    `/v1/workflow/namespaces/${ns}/schedules/${sid}/pause`,
    {
      method: 'POST',
      body: JSON.stringify({ note }),
    },
  )
}

export async function resumeSchedule(
  scheduleId: string,
  namespace = GPU_JOBS_NAMESPACE,
): Promise<{ status: string }> {
  const ns = encodeURIComponent(namespace.trim() || GPU_JOBS_NAMESPACE)
  const sid = encodeURIComponent(scheduleId.trim())
  return requestScienceJson<{ status: string }>(
    `/v1/workflow/namespaces/${ns}/schedules/${sid}/unpause`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  )
}

export async function triggerSchedule(
  scheduleId: string,
  namespace = GPU_JOBS_NAMESPACE,
): Promise<{ status: string; execution?: unknown }> {
  const ns = encodeURIComponent(namespace.trim() || GPU_JOBS_NAMESPACE)
  const sid = encodeURIComponent(scheduleId.trim())
  return requestScienceJson<{ status: string; execution?: unknown }>(
    `/v1/workflow/namespaces/${ns}/schedules/${sid}/trigger`,
    {
      method: 'POST',
      body: JSON.stringify({ requestId: `trig-${scheduleId.trim()}-${Date.now()}` }),
    },
  )
}

export async function deleteSchedule(
  scheduleId: string,
  namespace = GPU_JOBS_NAMESPACE,
): Promise<{ status: string }> {
  const ns = encodeURIComponent(namespace.trim() || GPU_JOBS_NAMESPACE)
  const sid = encodeURIComponent(scheduleId.trim())
  return requestScienceJson<{ status: string }>(`/v1/workflow/namespaces/${ns}/schedules/${sid}`, {
    method: 'DELETE',
  })
}

// ── Live Overview Summary Aggregation ────────────────────────────────────────

export async function buildResearchSummary(params: {
  studies: readonly StudyRecord[]
  benchmarks: readonly BenchmarkRecord[]
  runs: readonly RunRecord[]
  experiments: readonly ExperimentRecord[]
  machines: readonly LinkedMachine[]
  activities: readonly WorkflowActivity[]
  localRunningRuns?: number
  signal?: AbortSignal
}): Promise<ResearchSummaryData> {
  // Query `/v1/research/summary` and `/v1/research/totals` if available, then enforce strict
  // client-side epistemic separation (`proven` vs `promising_inconclusive` vs `refuted`).
  const [summaryResp, totalsResp] = await Promise.all([
    requestScienceJson<Record<string, unknown>>('/v1/research/summary', { signal: params.signal }).catch(
      () => null,
    ),
    requestScienceJson<Record<string, unknown>>('/v1/research/totals', { signal: params.signal }).catch(
      () => null,
    ),
  ])

  let qualifiedWins = 0
  let promisingLeads = 0
  let inconclusiveCount = 0
  let refutedCount = 0
  let expCost = 0
  let gpuSec = 0
  let runningExps = 0

  for (const exp of params.experiments) {
    if (exp.revision === 'retracted') continue
    const v = classifyVerdict(exp)
    if (v === 'proven') qualifiedWins += 1
    else if (v === 'promising_inconclusive') promisingLeads += 1
    else if (v === 'refuted') refutedCount += 1
    else inconclusiveCount += 1
    expCost += exp.cost_usd || 0
    gpuSec += asNum(exp.meta?.gpu_time_sec, 0)
    if (exp.status === 'running' || exp.status === 'planning') runningExps += 1
  }

  const runningActivities = params.activities.filter(
    (a) =>
      a.status === 'ACTIVITY_TASK_STATE_SCHEDULED' ||
      a.status === 'ACTIVITY_TASK_STATE_STARTED' ||
      a.status === 'SCHEDULED' ||
      a.status === 'STARTED',
  ).length

  const partialRuns = params.runs.filter((r) => r.completion === 'partial').length
  const activeRuns =
    asNum(summaryResp?.active_runs, 0) ||
    runningExps + runningActivities + (params.localRunningRuns ?? 0) + partialRuns

  const totalExperiments = Math.max(
    params.experiments.length,
    asNum(totalsResp?.experiments ?? summaryResp?.total_experiments, 0),
  )
  const retainedExperiments = Math.max(
    totalExperiments,
    asNum(totalsResp?.experiments_retained ?? summaryResp?.experiments_retained, totalExperiments),
  )
  const totalCostUsd = Math.max(
    expCost,
    asNum(totalsResp?.cost_usd ?? summaryResp?.cost_usd, expCost),
  )

  const onlineMachines = params.machines.filter((m) => m.online).length
  const busyMachines = params.machines.filter((m) => m.online && m.busy).length
  const totalGpus = params.machines.reduce((acc, m) => acc + m.gpus.length, 0)

  return {
    activeRuns,
    totalExperiments,
    retainedExperiments,
    totalStudies: Math.max(params.studies.length, asNum(summaryResp?.studies, 0)),
    totalBenchmarks: Math.max(
      params.benchmarks.length,
      asNum(totalsResp?.benchmarks ?? summaryResp?.benchmarks, 0),
    ),
    totalRuns: params.runs.length,
    qualifiedWins,
    promisingLeads,
    inconclusiveCount,
    refutedCount,
    totalCostUsd: Math.round(totalCostUsd * 100) / 100,
    totalGpuHours: Math.round((gpuSec / 3600) * 100) / 100,
    onlineMachines,
    busyMachines,
    totalGpus,
  }
}
