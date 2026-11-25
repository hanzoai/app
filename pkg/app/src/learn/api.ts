/**
 * Live `/v1/` API clients, persistent per-org progress helpers, KAI 301 schema
 * validators, Lab Terminal sandbox lease (`/v1/dev/sessions`), Science comparison
 * loader (`/v1/research/*`), AI Faculty Tutor (`/v1/chat/completions`), and
 * W3C Verifiable Credential v2.0 capstone preview builder.
 *
 * Strict Hanzo rules:
 * - ZERO `/api/` routes — `/v1/` ONLY (`${api()}/v1/...`).
 * - ZERO bespoke auth or mock keys — uses Hanzo IAM bearer (`bearer()`, `org()`).
 * - ZERO silent fake live telemetry — clearly tags illustrative previews.
 */

import { api } from '../lib/api'
import { bearer, org as currentOrg } from '../lib/session'
import { buildFacultySystemPrompt, STARTUP_BUILDER_STAGES } from './catalog'
import type {
  CapstoneSubmission,
  CourseSpec,
  FacultyBot,
  FacultyMessage,
  KaiPlaygroundResult,
  LearnProgressStore,
  SandboxSessionState,
  ScienceComparisonRow,
} from './types'

const STORAGE_PREFIX = 'hanzo.learn.progress.v1.'
export const LEARN_PREF_KEY_PREFIX = 'hanzo.learn.progress.v1'

export function learnScopeKey(orgId?: string | null): string {
  const clean = (orgId ?? currentOrg() ?? 'guest').trim().toLowerCase()
  return clean || 'guest'
}

export function learnPrefKey(orgId?: string | null): string {
  const clean = (orgId ?? currentOrg() ?? '').trim().toLowerCase()
  return clean ? `${LEARN_PREF_KEY_PREFIX}:${clean}` : LEARN_PREF_KEY_PREFIX
}

export function createEmptyProgressStore(): LearnProgressStore {
  return {
    version: 1,
    selectedGoal: 'decision-service',
    courses: {},
    startup: {
      companyName: '',
      vertical: 'legal-discovery',
      architecture: 'kai-decisions',
      customDomain: '',
      completedStages: [],
    },
  }
}

export function normalizeProgressStore(raw: unknown): LearnProgressStore {
  const base = createEmptyProgressStore()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Partial<LearnProgressStore>
  return {
    version: 1,
    selectedGoal: obj.selectedGoal ?? base.selectedGoal,
    courses: obj.courses && typeof obj.courses === 'object' ? obj.courses : {},
    startup: {
      ...base.startup,
      ...(obj.startup && typeof obj.startup === 'object' ? obj.startup : {}),
      completedStages: Array.isArray(obj.startup?.completedStages)
        ? obj.startup.completedStages.filter((s): s is string => typeof s === 'string')
        : [],
    },
  }
}

export function readLocalProgress(orgId?: string | null): LearnProgressStore {
  if (typeof window === 'undefined') return createEmptyProgressStore()
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${learnScopeKey(orgId)}`)
    if (!raw) return createEmptyProgressStore()
    return normalizeProgressStore(JSON.parse(raw))
  } catch {
    return createEmptyProgressStore()
  }
}

export function writeLocalProgress(store: LearnProgressStore, orgId?: string | null): boolean {
  if (typeof window === 'undefined') return false
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${learnScopeKey(orgId)}`, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

export function learnHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json' }
  const tok = bearer()
  if (tok) h.Authorization = `Bearer ${tok}`
  const orgId = currentOrg()
  if (orgId) h['X-Org-Id'] = orgId
  if (json) h['Content-Type'] = 'application/json'
  return h
}

// ── KAI 301 Schema Validators & Live Playground (/v1/decisions, /v1/capabilities/{name}/train) ──

export interface ValidationOutcome {
  valid: boolean
  errors: string[]
  warnings: string[]
  parsed?: Record<string, unknown>
}

const SLUG_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/i

export function validateKaiDecisionPayload(rawJson: string): ValidationOutcome {
  const errors: string[] = []
  const warnings: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch (err) {
    return {
      valid: false,
      errors: [`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`],
      warnings,
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, errors: ['Payload must be a JSON object.'], warnings }
  }
  const obj = parsed as Record<string, unknown>
  if (typeof obj.capability !== 'string' || !SLUG_RE.test(obj.capability.trim())) {
    errors.push('Field "capability" must be a non-empty slug (letters, digits, "-", "_", ".").')
  }
  if (!obj.input || typeof obj.input !== 'object' || Array.isArray(obj.input)) {
    errors.push('Field "input" must be a JSON object containing the decision features.')
  }
  const hasChoices = Array.isArray(obj.choices) && obj.choices.length >= 2
  const hasSchema = Boolean(obj.schema && typeof obj.schema === 'object' && !Array.isArray(obj.schema))
  if (!hasChoices && !hasSchema) {
    errors.push('Provide either "choices" (array of >= 2 strings) or a structured "schema" object.')
  }
  if (Array.isArray(obj.choices)) {
    const uniq = new Set(obj.choices.map((c) => String(c).trim()).filter(Boolean))
    if (uniq.size !== obj.choices.length) {
      errors.push('Field "choices" must contain unique non-empty labels.')
    }
  }
  if (obj.dry_run === true) {
    warnings.push('dry_run is enabled: validates schema and capability routing without mutating state.')
  }
  return { valid: errors.length === 0, errors, warnings, parsed: obj }
}

export function validateKaiTrainPayload(rawJson: string): ValidationOutcome {
  const errors: string[] = []
  const warnings: string[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch (err) {
    return {
      valid: false,
      errors: [`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`],
      warnings,
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, errors: ['Training payload must be a JSON object.'], warnings }
  }
  const obj = parsed as Record<string, unknown>
  if (typeof obj.capability !== 'string' || !SLUG_RE.test(obj.capability.trim())) {
    errors.push('Field "capability" must be a valid slug (e.g., "acme-lead-triage").')
  }
  const hasUri = typeof obj.dataset_uri === 'string' && obj.dataset_uri.trim().length > 0
  const hasExamples = Array.isArray(obj.examples) && obj.examples.length >= 2
  if (!hasUri && !hasExamples) {
    errors.push('Provide either "dataset_uri" or inline "examples" (>= 2 labeled examples).')
  }
  const thresh = obj.preregistered_threshold as Record<string, unknown> | undefined
  if (!thresh || typeof thresh !== 'object') {
    errors.push('Include "preregistered_threshold" (min_accuracy, max_ece) before starting training.')
  } else {
    const minAcc = Number(thresh.min_accuracy)
    const maxEce = Number(thresh.max_ece)
    if (!Number.isFinite(minAcc) || minAcc <= 0 || minAcc > 1) {
      errors.push('preregistered_threshold.min_accuracy must be in (0, 1].')
    }
    if (!Number.isFinite(maxEce) || maxEce <= 0 || maxEce > 0.5) {
      errors.push('preregistered_threshold.max_ece must be in (0, 0.5].')
    }
  }
  if (!obj.base_model || typeof obj.base_model !== 'string') {
    warnings.push('No "base_model" specified — Hanzo Kai will default to the org’s active base model.')
  }
  return { valid: errors.length === 0, errors, warnings, parsed: obj }
}

async function runKaiPost(
  endpointPath: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<KaiPlaygroundResult> {
  const ranAt = new Date().toISOString()
  if (!bearer()) {
    return {
      endpoint: endpointPath,
      ok: false,
      status: 401,
      latencyMs: 0,
      body: null,
      error: 'Sign in with Hanzo IAM to execute live requests against https://api.hanzo.ai/v1/.',
      ranAt,
    }
  }
  const started = Date.now()
  try {
    const res = await fetch(`${api()}${endpointPath}`, {
      method: 'POST',
      headers: learnHeaders(true),
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal,
    })
    const latencyMs = Math.max(1, Date.now() - started)
    const text = await res.text()
    let body: unknown = null
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = { raw: text.slice(0, 600) }
      }
    }
    if (!res.ok) {
      const errObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
      const msg =
        (typeof errObj.error === 'string' && errObj.error) ||
        (typeof errObj.message === 'string' && errObj.message) ||
        (typeof errObj.detail === 'string' && errObj.detail) ||
        `HTTP ${res.status} from ${endpointPath}`
      return { endpoint: endpointPath, ok: false, status: res.status, latencyMs, body, error: msg, ranAt }
    }
    return { endpoint: endpointPath, ok: true, status: res.status, latencyMs, body, ranAt }
  } catch (err) {
    return {
      endpoint: endpointPath,
      ok: false,
      status: 0,
      latencyMs: Math.max(1, Date.now() - started),
      body: null,
      error: err instanceof Error ? err.message : String(err),
      ranAt,
    }
  }
}

export function invokeKaiDecision(
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<KaiPlaygroundResult> {
  return runKaiPost('/v1/decisions', payload, signal)
}

export function submitKaiCapabilityTrain(
  capabilityName: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<KaiPlaygroundResult> {
  const safeName = encodeURIComponent(capabilityName.trim() || 'custom-capability')
  return runKaiPost(`/v1/capabilities/${safeName}/train`, payload, signal)
}

// ── Lab Terminal Isolated Sandbox Lease (`POST /v1/dev/sessions`) ────────────

export async function launchLabSandbox(
  courseSlug: string,
  signal?: AbortSignal,
): Promise<{ session: SandboxSessionState | null; error?: string }> {
  if (!bearer()) {
    return {
      session: null,
      error: 'Sign in with Hanzo IAM to lease an isolated MicroVM/Visor sandbox via POST /v1/dev/sessions.',
    }
  }
  try {
    const res = await fetch(`${api()}/v1/dev/sessions`, {
      method: 'POST',
      headers: learnHeaders(true),
      body: JSON.stringify({
        runtime: 'sandbox',
        metadata: { source: 'hanzo-learn', course: courseSlug },
      }),
      cache: 'no-store',
      signal,
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return {
        session: null,
        error: `Sandbox lease unavailable (HTTP ${res.status})${errText ? `: ${errText.slice(0, 140)}` : ''}`,
      }
    }
    const data = (await res.json().catch(() => null)) as {
      id?: string
      label?: string
      zap?: string
      sandbox?: string
    } | null
    if (!data?.id) {
      return { session: null, error: 'POST /v1/dev/sessions returned no session id.' }
    }
    const rawZap = data.zap ?? ''
    const zap = rawZap ? (/^https?:\/\//.test(rawZap) ? rawZap : `https://${rawZap}`) : ''
    return {
      session: {
        id: data.id,
        label: data.label ?? `Hanzo Sandbox (${courseSlug})`,
        zap,
        sandbox: data.sandbox,
        courseSlug,
        createdAt: new Date().toISOString(),
      },
    }
  } catch (err) {
    return {
      session: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function releaseLabSandbox(sessionId: string): Promise<boolean> {
  if (!bearer() || !sessionId) return false
  try {
    const res = await fetch(`${api()}/v1/dev/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: learnHeaders(false),
      cache: 'no-store',
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Science Experiment Comparison (`/v1/research/experiments`) ───────────────

export const ILLUSTRATIVE_SCIENCE_ROWS: readonly ScienceComparisonRow[] = [
  {
    id: 'preview-acc',
    metric: 'Holdout Accuracy (Macro)',
    baseline: 0.784,
    candidate: 0.902,
    thresholdDelta: 0.05,
    unit: '%',
    higherIsBetter: true,
    nSamples: 400,
    passed: true,
    source: 'preview',
  },
  {
    id: 'preview-ece',
    metric: 'Expected Calibration Error (ECE)',
    baseline: 0.089,
    candidate: 0.031,
    thresholdDelta: -0.02,
    unit: '',
    higherIsBetter: false,
    nSamples: 400,
    passed: true,
    source: 'preview',
  },
  {
    id: 'preview-p95',
    metric: 'Inference Latency (p95)',
    baseline: 245,
    candidate: 162,
    thresholdDelta: -20,
    unit: 'ms',
    higherIsBetter: false,
    nSamples: 400,
    passed: true,
    source: 'preview',
  },
]

export async function fetchCourseScienceExperiments(
  signal?: AbortSignal,
): Promise<{ source: 'live' | 'preview'; rows: ScienceComparisonRow[]; liveCount: number }> {
  if (!bearer()) {
    return { source: 'preview', rows: [...ILLUSTRATIVE_SCIENCE_ROWS], liveCount: 0 }
  }
  try {
    const res = await fetch(`${api()}/v1/research/experiments`, {
      method: 'GET',
      headers: learnHeaders(false),
      cache: 'no-store',
      signal,
    })
    if (!res.ok) {
      return { source: 'preview', rows: [...ILLUSTRATIVE_SCIENCE_ROWS], liveCount: 0 }
    }
    const body = (await res.json().catch(() => ({}))) as { data?: Array<Record<string, unknown>> }
    const list = Array.isArray(body.data) ? body.data : []
    if (list.length === 0) {
      return { source: 'preview', rows: [...ILLUSTRATIVE_SCIENCE_ROWS], liveCount: 0 }
    }
    const rows: ScienceComparisonRow[] = list.slice(0, 6).map((item, idx) => {
      const val = typeof item.value === 'number' ? item.value : 0
      const meta = (item.meta && typeof item.meta === 'object' ? item.meta : {}) as Record<string, unknown>
      const baseVal = typeof meta.baseline === 'number' ? meta.baseline : val
      const minDelta = typeof meta.min_gain === 'number' ? meta.min_gain : 0.01
      const delta = val - baseVal
      return {
        id: typeof item.id === 'string' ? item.id : `exp-${idx}`,
        metric: `${String(item.task || item.subject || 'experiment')} · ${String(item.metric || 'score')}`,
        baseline: baseVal,
        candidate: val,
        thresholdDelta: minDelta,
        unit: '',
        higherIsBetter: true,
        nSamples: typeof item.n === 'number' ? item.n : 0,
        passed: delta >= minDelta || String(item.status || '') === 'qualified',
        source: 'live',
      }
    })
    return { source: 'live', rows, liveCount: list.length }
  } catch {
    return { source: 'preview', rows: [...ILLUSTRATIVE_SCIENCE_ROWS], liveCount: 0 }
  }
}

// ── AI Faculty Tutor Chat (`POST /v1/chat/completions`, model: "enso") ───────

export async function askFacultyTutor(params: {
  bot: FacultyBot
  course: CourseSpec
  activeTab: string
  activeStepTitle?: string
  history: readonly FacultyMessage[]
  prompt: string
  signal?: AbortSignal
}): Promise<{ reply: string; model: string; error?: string }> {
  if (!bearer()) {
    return {
      reply: '',
      model: 'enso',
      error: `Sign in with Hanzo IAM to chat live with ${params.bot.handle} via POST /v1/chat/completions.`,
    }
  }
  const systemPrompt = buildFacultySystemPrompt(
    params.bot,
    params.course,
    params.activeTab,
    params.activeStepTitle,
  )
  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...params.history
      .filter((m) => !m.error)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: params.prompt },
  ]
  try {
    const res = await fetch(`${api()}/v1/chat/completions`, {
      method: 'POST',
      headers: learnHeaders(true),
      body: JSON.stringify({
        model: 'enso',
        temperature: 0.3,
        messages: chatMessages,
      }),
      cache: 'no-store',
      signal: params.signal,
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      if (res.status === 401) {
        return { reply: '', model: 'enso', error: 'Your Hanzo IAM session expired. Sign in again to continue.' }
      }
      if (res.status === 402) {
        return { reply: '', model: 'enso', error: 'Insufficient credits — add credits in Settings → Billing to continue.' }
      }
      return {
        reply: '',
        model: 'enso',
        error: `Enso returned HTTP ${res.status}${errText ? `: ${errText.slice(0, 140)}` : ''}`,
      }
    }
    const data = (await res.json()) as {
      model?: string
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content?.trim() ?? ''
    if (!content) {
      return { reply: '', model: data.model ?? 'enso', error: 'Enso returned an empty assistant response.' }
    }
    return { reply: content, model: data.model ?? 'enso' }
  } catch (err) {
    return {
      reply: '',
      model: 'enso',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── Capstone Verification & W3C Verifiable Credential v2.0 Preview ───────────

export interface CapstoneVerificationReport {
  passed: boolean
  scorePct: number
  checks: readonly { id: string; label: string; ok: boolean; hint: string }[]
}

export function verifyCapstoneSubmission(
  course: CourseSpec,
  submission: CapstoneSubmission,
): CapstoneVerificationReport {
  const checks = [
    {
      id: 'dataset-manifest',
      label: 'Dataset manifest / SHA-256 provenance recorded',
      ok: submission.datasetManifest.trim().length >= 8,
      hint: 'Provide a dataset URI, repo path, or SHA-256 digest.',
    },
    {
      id: 'eval-metrics',
      label: 'Baseline vs candidate evaluation metrics documented',
      ok: submission.evalMetrics.trim().length >= 12,
      hint: 'Include baseline and candidate numbers (e.g., accuracy, ECE, latency, or business KPI).',
    },
    {
      id: 'artifact-ref',
      label: 'Reproducible artifact ID, checkpoint, PR, or live URL',
      ok: submission.artifactRef.trim().length >= 6,
      hint: `Link the deliverable for ${course.code}: checkpoint ID, Git PR, Flow ID, or live HTTPS URL.`,
    },
    {
      id: 'preregistered-threshold',
      label: 'Pre-registered acceptance threshold verified',
      ok: Boolean(submission.preregisteredMet),
      hint: 'Confirm your candidate beat the pre-registered threshold on a locked holdout set.',
    },
    {
      id: 'regression-free',
      label: 'Regression audit passed with zero silent regressions',
      ok: Boolean(submission.regressionFree) && submission.regressionReport.trim().length >= 8,
      hint: 'Record your regression verification notes and confirm zero critical regressions.',
    },
  ]
  const okCount = checks.filter((c) => c.ok).length
  const scorePct = Math.round((okCount / checks.length) * 100)
  return {
    passed: okCount === checks.length,
    scorePct,
    checks,
  }
}

export function buildVerifiableCredentialPreview(
  course: CourseSpec,
  submission: CapstoneSubmission,
  holderName: string,
  orgId: string | null,
): Record<string, unknown> {
  const report = verifyCapstoneSubmission(course, submission)
  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://hanzo.university/contexts/practical-credential-v1.jsonld',
    ],
    id: `urn:hanzo:university:preview:${course.slug}`,
    type: ['VerifiableCredential', 'HanzoUniversityPracticalCredential'],
    credentialStatus: {
      status: report.passed ? 'preview_ready_for_practical_review' : 'incomplete_draft',
      note: 'Practical certification preview — cryptographically signed and issued only after verified capstone review.',
    },
    issuer: {
      id: 'did:web:hanzo.university',
      name: 'Hanzo University',
    },
    validFrom: submission.submittedAt ?? new Date().toISOString(),
    credentialSubject: {
      holder: holderName || 'Hanzo Learner',
      organization: orgId || 'personal',
      courseCode: course.code,
      courseSlug: course.slug,
      courseTitle: course.title,
      school: course.schoolName,
      deliverable: course.capstoneDeliverable,
      evidence: {
        datasetManifest: submission.datasetManifest.trim() || null,
        evalMetrics: submission.evalMetrics.trim() || null,
        artifactRef: submission.artifactRef.trim() || null,
        preregisteredMet: submission.preregisteredMet,
        regressionFree: submission.regressionFree,
      },
      verificationReadinessPct: report.scorePct,
    },
  }
}

export function computeStartupReadinessPct(completedStages: readonly string[]): number {
  if (STARTUP_BUILDER_STAGES.length === 0) return 0
  const done = STARTUP_BUILDER_STAGES.filter((s) => completedStages.includes(s.id)).length
  return Math.round((done / STARTUP_BUILDER_STAGES.length) * 100)
}
