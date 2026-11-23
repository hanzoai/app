/**
 * Wire types, pure epistemic verdict classification, SHA-256 verification, and
 * canonical JSON helpers for Hanzo Science (`/science`).
 */

export const SCIENCE_TABS = ['overview', 'studies', 'autonomy', 'machines', 'schedules'] as const
export type ScienceTab = (typeof SCIENCE_TABS)[number]

export const SCIENCE_TAB_LABELS: Readonly<Record<ScienceTab, string>> = {
  overview: 'Overview',
  studies: 'Studies',
  autonomy: 'Autonomy',
  machines: 'Machines',
  schedules: 'Schedules',
}

export function parseScienceTab(pathname: string, search = ''): ScienceTab {
  const clean = (pathname.split(/[?#]/)[0] || '').replace(/\/+$/, '')
  const rest = clean.startsWith('/science/')
    ? clean.slice('/science/'.length)
    : clean.startsWith('/research/')
      ? clean.slice('/research/'.length)
      : ''
  const seg = rest.split('/')[0]?.trim().toLowerCase() ?? ''
  if (seg === 'studies' || seg === 'autonomy' || seg === 'machines' || seg === 'schedules' || seg === 'overview') {
    return seg
  }
  if (search) {
    const qs = search.startsWith('?') ? search.slice(1) : search
    const tabParam = new URLSearchParams(qs).get('tab')?.trim().toLowerCase()
    if (
      tabParam === 'studies' ||
      tabParam === 'autonomy' ||
      tabParam === 'machines' ||
      tabParam === 'schedules' ||
      tabParam === 'overview'
    ) {
      return tabParam
    }
  }
  return 'overview'
}

export function sciencePath(tab: ScienceTab = 'overview', base: '/science' | '/research' = '/science'): string {
  return tab === 'overview' ? base : `${base}/${tab}`
}

/**
 * Epistemic verdict classes enforced across Hanzo Science:
 * - `proven`: Benchmark-qualified, statistically replicated / anytime-valid win.
 * - `promising_inconclusive`: Directional development / screening lift that has NOT passed
 *   benchmark qualification — NEVER mislabeled or counted as a qualified win.
 * - `inconclusive`: Noise / CI overlap with no directional claim.
 * - `refuted`: First-class negative finding preserved so dead ends are never re-chased.
 */
export type VerdictClass = 'proven' | 'promising_inconclusive' | 'inconclusive' | 'refuted'

export interface StudyRecord {
  project: string
  id: string
  title: string
  question: string
  method: string
  runs: string[]
  finding: string
  limits: string
  revision: string
  canonical: boolean
  when: string
}

export interface BenchmarkSplit {
  name: string
  items: number
  definition: string
}

export interface BenchmarkRecord {
  project: string
  id: string
  title: string
  version: string
  dataset: string
  license: string
  origin: string
  splits: BenchmarkSplit[]
  metric: string
  metrics: string[]
  citation: string
  notes: string
  revision: string
  canonical: boolean
  when: string
}

export interface MeasurePoint {
  category: string
  metric: string
  value: number
  lo?: number | null
  hi?: number | null
  n?: number | null
  of?: number | null
}

export interface RunRecord {
  project?: string
  id: string
  benchmark: string
  split?: string
  system?: string
  version?: string
  baseline?: boolean
  study?: string
  embedder?: string
  reader?: string
  k?: number | null
  temperature?: number | null
  max_tokens?: number | null
  prompt?: string
  prompt_digest?: string
  dataset_digest?: string
  store_digest?: string
  facts_digest?: string
  commit?: string
  questions?: number | null
  answered?: number | null
  when?: string
  ended?: string
  by?: string
  completion?: string
  measures?: MeasurePoint[]
  notes?: string
  revision?: string
  canonical?: boolean
  visibility?: string
  trainable?: boolean
  publishable?: boolean
  source_plane?: 'cloud' | 'hanzod'
  sandbox?: string
  duration_ms?: number
}

export interface ExperimentMeta {
  study?: string
  repo?: string
  backend?: string
  gpu?: string
  architecture?: string
  driver?: string
  compiler?: string
  precision?: string
  shapes?: string[]
  hypothesis?: string
  hypothesis_id?: string
  null_hypothesis?: string
  predict?: string
  verdict?: string
  promising_inconclusive?: boolean
  promising?: boolean
  qualification?: string
  stage?: string
  delta?: number
  baseline_mean?: number
  candidate_mean?: number
  baseline_ci95?: number | null
  candidate_ci95?: number | null
  p_value?: number | null
  anytime_valid?: boolean
  because?: string
  conclusion?: string
  failure_diagnosis?: string
  next_hypothesis?: string
  parent_experiment?: string
  parent_ids?: string[]
  historical?: boolean
  dataset_digest?: string
  model_digest?: string
  manifest_sha256?: string
  config_digest?: string
  artifact_hashes?: Record<string, string>
  ci_run_id?: string
  cd_deploy_id?: string
  gpu_time_sec?: number
  [key: string]: unknown
}

export interface ExperimentRecord {
  project: string
  id: string
  seq?: number
  content_hash?: string
  revision: string
  status: string
  canonical: boolean
  visibility: string
  trainable: boolean
  publishable: boolean
  kind: string
  subject: string
  task: string
  metric: string
  value: number
  n: number
  n_total: number
  cost_usd: number
  meta: ExperimentMeta
  git_sha: string
  git_branch: string
  git_dirty: boolean
  lib_versions: Record<string, string>
  ts: number
  tags?: string[]
  received_at?: number
}

export interface ExperimentVersionRecord {
  seq: number
  received_at: number
  ts: number
  content_hash: string
  revision: string
  status: string
  canonical: boolean
  value: number
  n: number
  meta?: ExperimentMeta
  git_sha: string
  tags?: string[]
}

export interface ComparisonDifference {
  field: string
  a: string
  b: string
}

export interface ComparisonDelta {
  category: string
  metric: string
  a: number
  b: number
  change: number
  overlap?: boolean | null
}

export interface ComparisonResult {
  a?: RunRecord | null
  b?: RunRecord | null
  comparable: boolean
  blocks: string[]
  config: ComparisonDifference[]
  deltas: ComparisonDelta[]
}

export interface EvidenceLink {
  rel: string
  uri: string
}

export interface EvidenceSource {
  system: string
  revision?: string
}

export interface EvidenceRecord {
  id: string
  uri: string
  hash: string
  kind: string
  source: EvidenceSource
  links: EvidenceLink[]
  content?: unknown
  time?: string
  version: number
  by?: string
}

export interface ArtifactRecord {
  sha256: string
  kind: string
  ref?: string
  run_id: string
  project?: string
  visibility?: string
  git_sha?: string
  git_branch?: string
  git_dirty?: boolean
  lib_versions?: Record<string, string>
  ts?: number
  artifact_id?: string
  content_sha256?: string
  media_type?: string
  canonicalization?: string
  compression?: string
  uncompressed_size?: number
}

export interface VerifiedArtifactBlob {
  expectedSha256: string
  computedSha256: string
  verified: boolean
  byteLength: number
  contentType: string
  previewText: string | null
  dataUrl: string | null
  bytes: Uint8Array
}

export type OpportunityAxis = 'model_scale' | 'context_len' | 'gpu_arch' | 'workload'

export interface OpportunityItem {
  opportunity_id: string
  domain: string
  objective: string
  axis: OpportunityAxis
  current_best: number
  proposed_approach: string
  expected_improvement: number
  compute_cost: number
  priority_score: number
  related_experiments: string[]
  trigger_rule: string
  status: 'open' | 'leased' | 'running' | 'completed' | 'refuted' | 'skipped'
  evidence_uri?: string
  evidence_version?: number
}

export interface GpuDeviceSpec {
  name: string
  arch?: string
  vendor?: string
  memoryTotal?: string
  unified?: boolean
}

export interface CloudLeaseInfo {
  uri: string
  campaign: string
  opportunity_id: string
  fencing_token: number
  owner_worker_id: string
  host: string
  acquired_at_unix: number
  expires_at_unix: number
  reclaimed_from?: string
  state: string
}

export interface LinkedMachine {
  id: string
  hostname: string
  status: string
  online: boolean
  os: string
  arch: string
  cpus: number
  memory_bytes: number
  memory_gb: number
  capacity: string
  gpus: GpuDeviceSpec[]
  capabilities: string[]
  backends: string[]
  task_queue: string
  busy: boolean
  busy_reason: string
  gpu_util_pct?: number | null
  is_local_hanzod?: boolean
  when_idle_only?: boolean
  targeted_only?: boolean
  max_gpu_util_pct?: number
  active_lease?: CloudLeaseInfo | null
}

export interface HanzodWorkerMetrics {
  polls: number
  busy_skips: number
  jobs_claimed: number
  jobs_completed: number
  jobs_failed: number
  deferred_busy: number
  heartbeats: number
  sse_events: number
}

export interface HanzodWorkerState {
  ok: boolean
  enabled: boolean
  linked: boolean
  sse_connected: boolean
  worker_id: string
  hostname: string
  cloud_api: string
  queues: string[]
  capabilities: string[]
  os: string
  arch: string
  cpus: number
  cpu_model: string
  memory: number
  gpus: GpuDeviceSpec[]
  backends: string[]
  busy: boolean
  busy_reason?: string | null
  gpu_util_pct?: number | null
  when_idle_only: boolean
  targeted_only: boolean
  max_gpu_util_pct: number
  active_dev_sessions: number
  active_research_runs: number
  last_heartbeat?: string | null
  last_error?: string | null
  metrics?: HanzodWorkerMetrics
}

export interface HanzodConnectionSnapshot {
  origin: string
  mode: 'web-cloud' | 'connected' | 'reconnecting'
  version?: string
  sandbox?: string
  hanzo_vm_available?: boolean
  worker: HanzodWorkerState | null
  reconnectAttempts: number
  lastConnectedAt?: number | null
  lastError?: string | null
}

export interface WorkflowActivity {
  id: string
  activityId: string
  runId: string
  activityType: string
  taskQueue: string
  status: string
  attempt: number
  deferCount: number
  lastBusyReason: string
  workerIdentity: string
  scheduledTime?: string
  startedTime?: string
  closedTime?: string
  durationMs?: number | null
  input?: Record<string, unknown>
  result?: unknown
  failure?: string
}

export interface WorkflowSseEvent {
  kind: string
  namespace: string
  activityId: string
  runId: string
  timestamp: string
  deferCount?: number
  raw: Record<string, unknown>
}

export interface ScheduleRecentAction {
  scheduledTime?: string
  actualTime?: string
  workflowId?: string
  runId?: string
  status?: string
}

export interface ScheduleRecord {
  scheduleId: string
  namespace: string
  intervals: string[]
  cronStrings: string[]
  taskQueue: string
  activityType: string
  workflowType?: string
  whenIdleOnly: boolean
  maxComputeSeconds?: number | null
  command?: string
  campaign?: string
  targetMachine?: string
  paused: boolean
  note: string
  nextActionTime?: string | null
  recentActions: ScheduleRecentAction[]
  raw: Record<string, unknown>
}

export interface ResearchSummaryData {
  activeRuns: number
  totalExperiments: number
  retainedExperiments: number
  totalStudies: number
  totalBenchmarks: number
  totalRuns: number
  qualifiedWins: number
  promisingLeads: number
  inconclusiveCount: number
  refutedCount: number
  totalCostUsd: number
  totalGpuHours: number
  onlineMachines: number
  busyMachines: number
  totalGpus: number
}

/**
 * Strictly classify an experiment's epistemic verdict.
 * Development screening lifts (`promising_inconclusive`, `stage === 'screening'`,
 * `qualification === 'unqualified'`, or positive-delta `inconclusive`) are NEVER
 * promoted to `proven`.
 */
export function classifyVerdict(exp: Pick<ExperimentRecord, 'meta' | 'status'> | string | null | undefined): VerdictClass {
  if (typeof exp === 'string') {
    const raw = exp.trim().toLowerCase()
    if (raw === 'promising_inconclusive' || raw === 'promising' || raw === 'dev_lift' || raw === 'screening_lift') {
      return 'promising_inconclusive'
    }
    if (raw === 'proven' || raw === 'win') return 'proven'
    if (raw === 'refuted' || raw === 'loss') return 'refuted'
    return 'inconclusive'
  }
  if (exp == null) {
    return 'inconclusive'
  }

  const meta = exp.meta ?? {}
  const rawVerdict = String(meta.verdict ?? '').trim().toLowerCase()
  if (rawVerdict === 'refuted' || rawVerdict === 'loss') {
    return 'refuted'
  }
  if (
    rawVerdict === 'promising_inconclusive' ||
    rawVerdict === 'promising' ||
    rawVerdict === 'dev_lift' ||
    rawVerdict === 'screening_lift' ||
    meta.promising_inconclusive === true ||
    meta.promising === true
  ) {
    return 'promising_inconclusive'
  }

  const stage = String(meta.stage ?? '').trim().toLowerCase()
  const qualification = String(meta.qualification ?? '').trim().toLowerCase()
  const isUnqualifiedStage =
    stage === 'screening' ||
    stage === 'dev' ||
    stage === 'exploratory' ||
    qualification === 'unqualified' ||
    qualification === 'screening'

  if (rawVerdict === 'proven' || rawVerdict === 'win') {
    // Guardrail: an explicitly unqualified / screening-only lift cannot count as a proven benchmark win.
    return isUnqualifiedStage ? 'promising_inconclusive' : 'proven'
  }

  const delta = typeof meta.delta === 'number' ? meta.delta : null
  if ((delta !== null && delta > 0 && Number.isFinite(delta)) || isUnqualifiedStage) {
    if (rawVerdict === 'inconclusive' || rawVerdict === '') {
      return delta !== null && delta > 0 ? 'promising_inconclusive' : 'inconclusive'
    }
  }

  return 'inconclusive'
}

export function verdictLabel(v: VerdictClass): string {
  switch (v) {
    case 'proven':
      return 'Proven · Qualified Win'
    case 'promising_inconclusive':
      return 'Promising · Unqualified Lead'
    case 'refuted':
      return "Refuted · Don't Re-Chase"
    case 'inconclusive':
      return 'Inconclusive'
  }
}

export function parseTargets(target: string | readonly string[] | null | undefined): string[] {
  if (!target) return []
  const list = typeof target === 'string' ? [target] : target
  const out: string[] = []
  for (const item of list) {
    for (const part of String(item).split(',')) {
      const cleaned = part.trim()
      if (cleaned && !out.includes(cleaned)) out.push(cleaned)
    }
  }
  return out
}

export function resolveTaskQueue(target?: string | null): string {
  const cleaned = (target ?? '').trim()
  if (!cleaned || cleaned.toLowerCase() === 'any' || cleaned === 'gpu-jobs') {
    return 'gpu-jobs'
  }
  return cleaned.startsWith('gpu:') ? cleaned : `gpu:${cleaned}`
}

export function inferMachineBackends(row: {
  os?: string
  capabilities?: readonly string[]
  backends?: readonly string[]
  capacity?: string
  label?: string
  cpuModel?: string
  gpus?: readonly GpuDeviceSpec[]
}): string[] {
  const found = new Set<string>(['CPU'])
  for (const b of row.backends ?? []) {
    const up = String(b).trim().toUpperCase()
    if (up) found.add(up)
  }
  const osName = (row.os ?? '').trim().toLowerCase()
  const hint = [
    ...(row.capabilities ?? []),
    row.capacity ?? '',
    row.label ?? '',
    row.cpuModel ?? '',
  ]
    .join(' ')
    .toLowerCase()

  if (/(cuda|nvidia|gb10|gh200|h100|h200|a100|b200|rtx|sm_)/.test(hint)) found.add('CUDA')
  if (/metal/.test(hint) || osName === 'darwin' || osName === 'macos' || /apple m[1-9]/.test(hint)) found.add('METAL')
  if (/(rocm|hip|strix|gfx11|radeon|instinct|ryzen ai max)/.test(hint)) found.add('ROCM')
  if (/(vulkan|strix|gfx11|radeon|ryzen ai max)/.test(hint)) found.add('VULKAN')

  for (const g of row.gpus ?? []) {
    const blob = `${g.name ?? ''} ${g.arch ?? ''} ${g.vendor ?? ''}`.toLowerCase()
    if (/(nvidia|cuda|gb10|gh200|h100|h200|a100|b200|rtx|geforce|tesla|sm_)/.test(blob)) found.add('CUDA')
    if (/(apple|metal|\bm[1-9]\b)/.test(blob)) found.add('METAL')
    if (/(amd|radeon|instinct|rocm|gfx|mi2|mi3|strix)/.test(blob)) found.add('ROCM')
    if (/(vulkan|radeon|gfx|strix)/.test(blob)) found.add('VULKAN')
  }

  const order = ['CUDA', 'ROCM', 'METAL', 'VULKAN', 'CPU']
  return [
    ...order.filter((b) => found.has(b)),
    ...[...found].filter((b) => !order.includes(b)).sort(),
  ]
}

export function inferOpportunityAxis(text: string): OpportunityAxis {
  const s = text.toLowerCase()
  if (/(70b|32b|14b|8b|7b|param|scale|size|zen-|llama|qwen)/.test(s)) return 'model_scale'
  if (/(context|seq_len|kv|prefill|decode|128k|32k|8k|rope|attention)/.test(s)) return 'context_len'
  if (/(gb10|sm_121|gfx1151|rocm|cuda|metal|vulkan|dgx|evo|tensor|warp|wave)/.test(s)) return 'gpu_arch'
  return 'workload'
}

/**
 * Provenance links to Hanzo CI (`https://ci.hanzo.ai`) and Hanzo CD (`https://cd.hanzo.ai`)
 * — always two separate domains, never `cicd.hanzo.ai`.
 */
export function provenanceLinks(meta: {
  repo?: string
  commit?: string
  ciRunId?: string
  cdDeployId?: string
}): { ciUrl: string; cdUrl: string } {
  const cleanRepo = (meta.repo ?? '').trim().replace(/^\/+|\/+$/g, '')
  const ciUrl = meta.ciRunId
    ? `https://ci.hanzo.ai/runs/${encodeURIComponent(meta.ciRunId)}`
    : cleanRepo && cleanRepo.includes('/')
      ? `https://ci.hanzo.ai/${cleanRepo}${meta.commit ? `?commit=${encodeURIComponent(meta.commit)}` : ''}`
      : 'https://ci.hanzo.ai'
  const cdUrl = meta.cdDeployId
    ? `https://cd.hanzo.ai/applications/${encodeURIComponent(meta.cdDeployId)}`
    : cleanRepo
      ? `https://cd.hanzo.ai/applications?search=${encodeURIComponent(cleanRepo.split('/').pop() ?? cleanRepo)}`
      : 'https://cd.hanzo.ai'
  return { ciUrl, cdUrl }
}

/** Canonical deterministic JSON stringifier (sorted object keys, RFC 8785 compatible subset). */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`
}

/** Pure-TypeScript SHA-256 fallback for environments where `crypto.subtle` is unavailable (e.g. non-secure test runners). */
function sha256Pure(bytes: Uint8Array): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ])
  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19

  const bitLenHi = Math.floor((bytes.length * 8) / 0x100000000)
  const bitLenLo = (bytes.length * 8) >>> 0
  const padLen = ((bytes.length + 9 + 63) >> 6) << 6
  const padded = new Uint8Array(padLen)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padLen - 8, bitLenHi, false)
  view.setUint32(padLen - 4, bitLenLo, false)

  const w = new Uint32Array(64)
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false)
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3)
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10)
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    let f = h5
    let g = h6
    let h = h7

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[i]! + w[i]!) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + h) >>> 0
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map((v) => v.toString(16).padStart(8, '0')).join('')
}

export async function sha256HexBytes(bytes: Uint8Array): Promise<string> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    try {
      const buf = new Uint8Array(bytes.byteLength)
      buf.set(bytes)
      const digest = await globalThis.crypto.subtle.digest('SHA-256', buf.buffer)
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    } catch {
      return sha256Pure(bytes)
    }
  }
  return sha256Pure(bytes)
}

export async function sha256CanonicalJson(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(canonicalJson(value))
  return sha256HexBytes(encoded)
}
