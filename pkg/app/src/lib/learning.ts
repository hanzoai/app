import { api } from './api'
import { scope } from './session'

export interface LearningStudy {
  id: string
  project: string
  title: string
  question: string
  improvement?: { baseline: string; target: string; min_questions: number; require_intervals: boolean; metrics: { category: string; metric: string; direction: string; min_gain: number; max_regression: number }[] }
}

export interface LearningReview {
  id: string
  status: string
  action: {
    rule?: string
    description?: string
    review?: { target: string; candidate: string; baseline: string; status: string; blocks: string[] }
  }
}

export interface LearningExperimentMeta {
  verdict?: string
  hypothesis?: string
  study?: string
  backend?: string
  gpu?: string
  [key: string]: unknown
}

export interface LearningExperiment {
  id: string
  project?: string
  kind?: string
  subject?: string
  task?: string
  metric?: string
  value?: number
  status?: string
  revision?: string
  canonical?: boolean
  git_sha?: string
  ts?: number
  meta?: LearningExperimentMeta
}

export interface LearningExperimentVersion {
  seq?: number
  id: string
  revision: string
  status: string
  canonical: boolean
  metric?: string
  value?: number
  git_sha?: string
  ts?: number
  content_hash?: string
}

export interface LearningRows {
  studies: LearningStudy[]
  reviews: LearningReview[]
  experiments: LearningExperiment[]
  benchmarks: { id: string; name: string; direction: string }[]
}

export type LearningPart = keyof LearningRows
export const LEARNING_PATHS: Record<LearningPart, string> = {
  studies: '/v1/research/studies',
  reviews: '/v1/research/actions',
  experiments: '/v1/research/experiments',
  benchmarks: '/v1/benchmark/catalog',
}

function parseMeta(raw: unknown): LearningExperimentMeta | undefined {
  if (!raw) return undefined
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? (parsed as LearningExperimentMeta) : undefined
    } catch {
      return undefined
    }
  }
  return typeof raw === 'object' ? (raw as LearningExperimentMeta) : undefined
}

/** Every read uses the same IAM/org headers as the rest of the workspace. */
export async function learningRead<K extends LearningPart>(part: K, signal?: AbortSignal): Promise<LearningRows[K]> {
  const r = await fetch(`${api()}${LEARNING_PATHS[part]}`, { headers: scope(), signal })
  if (r.status === 404) return [] as unknown as LearningRows[K]
  if (!r.ok) throw Object.assign(new Error(`${r.status}`), { status: r.status })
  const body = await r.json() as { data?: unknown }
  if (!Array.isArray(body.data)) throw new Error('Learning response is missing its data array')
  if (part === 'reviews') {
    return body.data.filter((row: LearningReview) => row.action?.rule === 'research.improvement.v1') as LearningRows[K]
  }
  if (part === 'experiments') {
    return body.data.map((raw: Record<string, unknown>) => ({
      id: String(raw.id ?? ''),
      project: typeof raw.project === 'string' ? raw.project : undefined,
      kind: typeof raw.kind === 'string' ? raw.kind : undefined,
      subject: typeof raw.subject === 'string' ? raw.subject : undefined,
      task: typeof raw.task === 'string' ? raw.task : undefined,
      metric: typeof raw.metric === 'string' ? raw.metric : undefined,
      value: typeof raw.value === 'number' ? raw.value : undefined,
      status: typeof raw.status === 'string' ? raw.status : 'complete',
      revision: typeof raw.revision === 'string' ? raw.revision : undefined,
      canonical: raw.canonical !== false,
      git_sha: typeof raw.git_sha === 'string' ? raw.git_sha : undefined,
      ts: typeof raw.ts === 'number' ? raw.ts : undefined,
      meta: parseMeta(raw.meta),
    })) as LearningRows[K]
  }
  return body.data as LearningRows[K]
}

export interface LearningProposal {
  title: string
  question: string
  baseline: string
  target: string
  metric: string
  category: string
  direction: 'higher' | 'lower'
  minQuestions: number
  minGain: number
}

/** Creating a study arms deterministic evaluation; it starts no model or rollout. */
export async function learningCreate(proposal: LearningProposal, id: string): Promise<void> {
  const headers = { 'Content-Type': 'application/json', ...scope() }
  const policy = { baseline: proposal.baseline, target: proposal.target, min_questions: proposal.minQuestions,
    require_intervals: false, metrics: [{ category: proposal.category, metric: proposal.metric, direction: proposal.direction, min_gain: proposal.minGain, max_regression: 0 }] }
  const r = await fetch(`${api()}/v1/research/studies`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ studies: [{ id, title: proposal.title, question: proposal.question, improvement: policy }] }),
  })
  if (!r.ok) throw Object.assign(new Error(`${r.status}`), { status: r.status })
  // Older cloud versions accept unknown JSON fields. Verify that the policy
  // actually persisted before telling the person automatic review is armed.
  const check = await fetch(`${api()}/v1/research/studies`, { headers })
  if (!check.ok) throw Object.assign(new Error(`${check.status}`), { status: check.status })
  const body = await check.json() as { data?: LearningStudy[] }
  const saved = body.data?.find((study) => study.id === id)?.improvement
  const metric = saved?.metrics?.[0]
  if (!saved || saved.baseline !== policy.baseline || saved.target !== policy.target ||
    saved.min_questions !== policy.min_questions || saved.require_intervals !== policy.require_intervals ||
    saved.metrics.length !== 1 || !metric || Object.entries(policy.metrics[0]).some(([key, value]) => metric[key as keyof typeof metric] !== value)) {
    throw Object.assign(new Error('Cloud has not enabled automatic study review'), { status: 503 })
  }
}

export interface LearningComparison {
  a: string
  b: string
  n_common: number
  a_correct: number
  b_correct: number
  mcnemar_p: number
}

/** Read retained experiment lineage from the /v1/research ledger. */
export async function learningExperimentVersions(id: string): Promise<LearningExperimentVersion[]> {
  const query = new URLSearchParams({ id })
  const r = await fetch(`${api()}/v1/research/experiments/versions?${query}`, { headers: scope() })
  if (r.status === 404) return []
  if (!r.ok) throw Object.assign(new Error(`${r.status}`), { status: r.status })
  const body = await r.json() as { versions?: unknown; data?: unknown }
  const rawList = Array.isArray(body.versions) ? body.versions : Array.isArray(body.data) ? body.data : []
  return rawList.map((raw) => {
    const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    return {
      seq: typeof row.seq === 'number' ? row.seq : undefined,
      id: String(row.id ?? id),
      revision: typeof row.revision === 'string' ? row.revision : 'original',
      status: typeof row.status === 'string' ? row.status : 'complete',
      canonical: row.canonical !== false,
      metric: typeof row.metric === 'string' ? row.metric : undefined,
      value: typeof row.value === 'number' ? row.value : undefined,
      git_sha: typeof row.git_sha === 'string' ? row.git_sha : undefined,
      ts: typeof row.ts === 'number' ? row.ts : undefined,
      content_hash: typeof row.content_hash === 'string' ? row.content_hash : undefined,
    }
  })
}

/** Pair actual completed items. Zero common items is displayed as no evidence. */
export async function learningCompare(benchmark: string, a: string, b: string): Promise<LearningComparison> {
  const query = new URLSearchParams({ benchmark, a, b })
  const r = await fetch(`${api()}/v1/benchmark/compare?${query}`, { headers: scope() })
  if (!r.ok) throw Object.assign(new Error(`${r.status}`), { status: r.status })
  return await r.json() as LearningComparison
}
