import { api } from './lib/api'
import { scope } from './lib/session'

export interface LearningStudy {
  id: string
  project: string
  title: string
  question: string
  improvement?: { baseline: string; target: string }
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

export interface LearningRows {
  studies: LearningStudy[]
  reviews: LearningReview[]
  experiments: { id: string; name: string; status: string; winner?: string }[]
  benchmarks: { id: string; name: string; direction: string }[]
}

export type LearningPart = keyof LearningRows
export const LEARNING_PATHS: Record<LearningPart, string> = {
  studies: '/v1/research/studies',
  reviews: '/v1/research/actions',
  experiments: '/v1/experiment',
  benchmarks: '/v1/benchmark/catalog',
}

/** Every read uses the same IAM/org headers as the rest of the workspace. */
export async function learningRead<K extends LearningPart>(part: K, signal?: AbortSignal): Promise<LearningRows[K]> {
  const r = await fetch(`${api()}${LEARNING_PATHS[part]}`, { headers: scope(), signal })
  if (!r.ok) throw Object.assign(new Error(`${r.status}`), { status: r.status })
  const body = await r.json() as { data?: unknown }
  if (!Array.isArray(body.data)) throw new Error('Learning response is missing its data array')
  return (part === 'reviews' ? body.data.filter((row: LearningReview) => row.action?.rule === 'research.improvement.v1') : body.data) as LearningRows[K]
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
  const r = await fetch(`${api()}/v1/research/studies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...scope() },
    body: JSON.stringify({ studies: [{ id, title: proposal.title, question: proposal.question,
      improvement: { baseline: proposal.baseline, target: proposal.target, min_questions: proposal.minQuestions,
        require_intervals: false, metrics: [{ category: proposal.category, metric: proposal.metric, direction: proposal.direction, min_gain: proposal.minGain, max_regression: 0 }] },
    }] }),
  })
  if (!r.ok) throw Object.assign(new Error(`${r.status}`), { status: r.status })
}

export interface LearningAnalysis {
  winner: string
  results: { variant: string; exposed: number; converted: number; rate: number; significant: boolean }[]
}

export interface LearningComparison {
  a: string
  b: string
  n_common: number
  a_correct: number
  b_correct: number
  mcnemar_p: number
}

/** Analyze measured outcomes; this never calls the live-rollout decide route. */
export async function learningAnalyze(id: string): Promise<LearningAnalysis> {
  const r = await fetch(`${api()}/v1/experiment/${encodeURIComponent(id)}/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...scope() }, body: '{}',
  })
  if (!r.ok) throw Object.assign(new Error(`${r.status}`), { status: r.status })
  return await r.json() as LearningAnalysis
}

/** Pair actual completed items. Zero common items is displayed as no evidence. */
export async function learningCompare(benchmark: string, a: string, b: string): Promise<LearningComparison> {
  const query = new URLSearchParams({ benchmark, a, b })
  const r = await fetch(`${api()}/v1/benchmark/compare?${query}`, { headers: scope() })
  if (!r.ok) throw Object.assign(new Error(`${r.status}`), { status: r.status })
  return await r.json() as LearningComparison
}
