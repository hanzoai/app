import { api } from './api'
import { bearer, org } from './session'

export const DEFAULT_LOCAL_HANZOD = 'http://127.0.0.1:3690'

export interface HypothesisBudget {
  max_compute_seconds: number
  max_cost_usd: number
}

export interface HypothesisRecord {
  project: string
  hypothesis_id: string
  statement: string
  null_hypothesis: string
  gate_ref: string
  dataset_refs: string[]
  budget: HypothesisBudget
  proposer: string
  registered_at: string
  seq: number
}

export interface ResearchMeasure {
  category: string
  metric: string
  value: number
  lo?: number
  hi?: number
}

export interface ResearchRun {
  project?: string
  id: string
  benchmark: string
  split?: string
  system?: string
  commit?: string
  questions?: number | null
  answered?: number | null
  completion?: string
  when?: string
  ended?: string
  facts_digest?: string
  notes?: string
  measures?: ResearchMeasure[]
}

export interface ClaimReplication {
  run_id: string
  verifier: string
  value: number
  agreed: boolean
  replicated_at: string
}

export interface ResearchClaim {
  project: string
  claim_id: string
  hypothesis_id?: string
  run_id: string
  candidate_ref?: string
  mode: 'confirmatory' | 'exploratory'
  metric: string
  value: number
  effect_size: number
  proposer: string
  status: 'unreplicated' | 'replicated' | 'retracted'
  was_replicated: boolean
  replications: ClaimReplication[]
  counter_evidence?: {
    evidence_ref: string
    run_id?: string
    summary: string
    filed_by: string
    filed_at: string
  }
  seq: number
  created_at: string
  updated_at: string
}

export interface ProductFitness {
  verified_success: number
  cost_per_success_usd: number
  latency_p50_ms: number
  latency_p95_ms: number
  robustness: number
  safety: number
}

export interface EvolutionCandidate {
  project: string
  candidate_id: string
  parent_ids: string[]
  spec_version: string
  mutation_surface: 'harness.policy' | 'engine.strategy' | 'router.cascade' | 'model.adapter' | 'research.protocol'
  artifact_digest: string
  diff_ref: string
  proposer: string
  gate_ref: string
  evidence_refs: string[]
  product_fitness?: ProductFitness
  status: 'proposed' | 'qualified' | 'promoted' | 'retired' | 'retracted'
  qualified_by?: string
  rollback_target?: string
  retracted_by?: string
  seq: number
  created_at: string
}

export interface XPBalance {
  principal: string
  total_xp: number
  domains: Record<string, number>
}

export interface XPProjection {
  projection_id: string
  principal: string
  domain: string
  delta: number
  reason: string
  evidence_ref: string
  candidate_ref?: string
  rule_version: string
  effective_at: string
  retracted_by?: string
}

export interface XPResponse {
  rule_version: string
  non_transferable: boolean
  balances: XPBalance[]
  projections: XPProjection[]
}

export interface HanzodResearchHealth {
  ok: boolean
  sandbox: string
  hanzo_vm_available: boolean
  hanzo_vm_bin?: string | null
  runs_total: number
  runs_running: number
}

export interface LocalExecutionResult {
  id: string
  benchmark: string
  split: string
  system: string
  sandbox: string
  status: string
  completion: string
  questions: number
  answered: number
  duration_ms: number
  measures: ResearchMeasure[]
  artifacts: { path: string; kind: string; sha256: string; ref: string; bytes: number }[]
  cloud_synced: boolean
  error?: string
}

function authHeaders(includeJson = false): Record<string, string> {
  const h: Record<string, string> = {}
  const tok = bearer()
  if (tok) h.Authorization = `Bearer ${tok}`
  const activeOrg = org()
  if (activeOrg) h['X-Org-Id'] = activeOrg
  if (includeJson) h['Content-Type'] = 'application/json'
  return h
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init })
  const text = await res.text()
  const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  if (!res.ok) {
    const msg = typeof parsed.error === 'string' ? parsed.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return parsed as T
}

export async function listHypotheses(project?: string): Promise<HypothesisRecord[]> {
  const q = project ? `?project=${encodeURIComponent(project)}` : ''
  const out = await requestJson<{ data?: HypothesisRecord[] }>(`${api()}/v1/research/hypotheses${q}`, {
    headers: authHeaders(),
  })
  return out.data ?? []
}

export async function registerHypothesis(input: {
  statement: string
  null_hypothesis: string
  gate_ref: string
  dataset_refs?: string[]
  budget?: HypothesisBudget
}): Promise<HypothesisRecord> {
  return requestJson<HypothesisRecord>(`${api()}/v1/research/hypotheses`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      statement: input.statement,
      null_hypothesis: input.null_hypothesis,
      gate_ref: input.gate_ref,
      dataset_refs: input.dataset_refs ?? [],
      budget: input.budget ?? { max_compute_seconds: 600, max_cost_usd: 25 },
    }),
  })
}

export async function listResearchRuns(): Promise<ResearchRun[]> {
  const out = await requestJson<{ data?: ResearchRun[] }>(`${api()}/v1/research/runs`, {
    headers: authHeaders(),
  })
  return out.data ?? []
}

export async function recordResearchRun(run: ResearchRun): Promise<{ recorded: number; canonical: number }> {
  return requestJson<{ recorded: number; canonical: number }>(`${api()}/v1/research/runs`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ runs: [run] }),
  })
}

export async function listClaims(): Promise<ResearchClaim[]> {
  const out = await requestJson<{ data?: ResearchClaim[] }>(`${api()}/v1/research/claims`, {
    headers: authHeaders(),
  })
  return out.data ?? []
}

export async function fileClaim(input: {
  hypothesis_id?: string
  run_id: string
  candidate_ref?: string
  mode: 'confirmatory' | 'exploratory'
  metric: string
  effect_size: number
}): Promise<ResearchClaim> {
  return requestJson<ResearchClaim>(`${api()}/v1/research/claims`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(input),
  })
}

export async function replicateClaim(claimId: string, runId: string): Promise<ResearchClaim> {
  return requestJson<ResearchClaim>(`${api()}/v1/research/claims/${encodeURIComponent(claimId)}/replicate`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ run_id: runId }),
  })
}

export async function retractClaim(claimId: string, evidenceRef: string, summary: string): Promise<ResearchClaim> {
  return requestJson<ResearchClaim>(`${api()}/v1/research/claims/${encodeURIComponent(claimId)}/retract`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ evidence_ref: evidenceRef, summary }),
  })
}

export async function listCandidates(): Promise<EvolutionCandidate[]> {
  const out = await requestJson<{ data?: EvolutionCandidate[] }>(`${api()}/v1/research/candidates`, {
    headers: authHeaders(),
  })
  return out.data ?? []
}

export async function listCandidateFrontier(): Promise<EvolutionCandidate[]> {
  const out = await requestJson<{ data?: EvolutionCandidate[] }>(`${api()}/v1/research/candidates/frontier`, {
    headers: authHeaders(),
  })
  return out.data ?? []
}

export async function proposeCandidate(input: {
  parent_ids: string[]
  mutation_surface: EvolutionCandidate['mutation_surface']
  artifact_digest: string
  diff_ref: string
  gate_ref: string
  product_fitness?: ProductFitness
}): Promise<EvolutionCandidate> {
  return requestJson<EvolutionCandidate>(`${api()}/v1/research/candidates`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      ...input,
      spec_version: '1.0.0',
    }),
  })
}

export async function qualifyCandidate(
  candidateId: string,
  input: {
    evidence_refs: string[]
    product_fitness: ProductFitness
    promote?: boolean
  },
): Promise<EvolutionCandidate> {
  return requestJson<EvolutionCandidate>(`${api()}/v1/research/candidates/${encodeURIComponent(candidateId)}/qualify`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(input),
  })
}

export async function fetchXP(domain?: string): Promise<XPResponse> {
  const q = domain ? `?domain=${encodeURIComponent(domain)}` : ''
  return requestJson<XPResponse>(`${api()}/v1/research/xp${q}`, {
    headers: authHeaders(),
  })
}

export async function probeLocalHanzod(origin = DEFAULT_LOCAL_HANZOD, signal?: AbortSignal): Promise<HanzodResearchHealth | null> {
  try {
    const res = await fetch(`${origin.replace(/\/+$/, '')}/v1/research/health`, { cache: 'no-store', signal })
    if (!res.ok) return null
    return (await res.json()) as HanzodResearchHealth
  } catch {
    return null
  }
}

export async function executeOnLocalHanzod(
  input: {
    id?: string
    hypothesis_id?: string
    candidate_id?: string
    benchmark: string
    split?: string
    system?: string
    command: string
    max_compute_seconds?: number
    questions?: number
  },
  origin = DEFAULT_LOCAL_HANZOD,
): Promise<LocalExecutionResult> {
  return requestJson<LocalExecutionResult>(`${origin.replace(/\/+$/, '')}/v1/research/runs`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({
      ...input,
      cloud_api: api(),
      sync_cloud: true,
    }),
  })
}
