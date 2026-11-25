import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const sessionState = vi.hoisted(() => ({ token: null as string | null, org: 'hanzo' as string | null }))

vi.mock('../lib/session', () => ({
  bearer: () => sessionState.token,
  org: () => sessionState.org,
}))
vi.mock('../lib/api', () => ({
  api: () => 'https://api.hanzo.ai',
}))

import {
  askFacultyTutor,
  buildVerifiableCredentialPreview,
  computeStartupReadinessPct,
  fetchCourseScienceExperiments,
  invokeKaiDecision,
  launchLabSandbox,
  releaseLabSandbox,
  submitKaiCapabilityTrain,
  validateKaiDecisionPayload,
  validateKaiTrainPayload,
  verifyCapstoneSubmission,
} from './api'
import {
  ADVENTURE_GOALS,
  buildFacultySystemPrompt,
  CERTIFICATION_TRACKS,
  computeCourseCompletionPct,
  COURSE_BY_SLUG,
  COURSES,
  FACULTY_BOTS,
  FACULTY_BY_ID,
  getCourse,
  KAI_301_LAB_STEPS,
  KAI_CALIBRATION_CHECKLIST,
  recommendAdventureTrack,
  SCHOOLS,
  STARTUP_BUILDER_STAGES,
} from './catalog'
import { learnPath, parseLearnRoute } from './types'

const CANONICAL_SLUGS_AND_CODES: ReadonlyArray<readonly [string, string]> = [
  ['continuous-improvement', 'AUTO 101'],
  ['kai-decision-intelligence', 'KAI 201'],
  ['kai-training-decision-models', 'KAI 301'],
  ['enso-adaptive-intelligence', 'ENS 201'],
  ['enso-training-orchestrators', 'ENS 301'],
  ['zen-model-engineering', 'ZEN 201'],
  ['zen-native-training', 'ZEN 301'],
  ['ml-systems', 'ML 401'],
  ['agentic-coding', 'ENG 100'],
  ['reinforcement-learning', 'RL 101'],
  ['systems-engineering', 'SYS 103'],
  ['science-discovery', 'SCI 101'],
  ['autonomous-research', 'SCI 201'],
  ['research-autopilot', 'SCI 301'],
  ['recursive-improvement', 'SCI 401'],
  ['ai-security-fundamentals', 'CYB 101'],
  ['agentic-cybersecurity', 'CYB 201'],
  ['autonomous-secops', 'CYB 301'],
  ['sovereign-zero-trust-ai', 'CYB 401'],
  ['business-autopilot', 'AUTO 201'],
  ['autonomous-organizations', 'AUTO 301'],
  ['build-your-ai-company', 'ENT 401'],
  ['agentic-marketing', 'MKT 102'],
  ['ai-practitioner', 'PRA 104'],
  ['ai-architect', 'ARC 105'],
]

beforeEach(() => {
  sessionState.token = null
  sessionState.org = 'hanzo'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Hanzo University 25-course canonical catalog integrity', () => {
  test('contains all 25 exact canonical course slugs and codes matching hanzo.university and docs.hanzo.ai', () => {
    expect(COURSES).toHaveLength(25)
    expect(new Set(COURSES.map((c) => c.slug)).size).toBe(25)
    expect(new Set(COURSES.map((c) => c.code)).size).toBe(25)

    for (const [slug, code] of CANONICAL_SLUGS_AND_CODES) {
      const found = getCourse(slug)
      expect(found, `missing course ${slug}`).not.toBeNull()
      expect(found!.code).toBe(code)
    }

    expect(getCourse('continuous-improvement')?.isFree).toBe(true)
    expect(getCourse('continuous-improvement')?.pricingTier).toBe('Free')
    expect(SCHOOLS).toHaveLength(5) // Free Foundation + 4 Schools
    expect(CERTIFICATION_TRACKS).toHaveLength(6)
  })

  test('all prerequisite slugs, certification track refs, and reading links are valid with zero /api/ routes or mock keys', () => {
    for (const course of COURSES) {
      for (const pre of course.prerequisites) {
        expect(COURSE_BY_SLUG[pre], `${course.slug} prereq ${pre}`).toBeDefined()
      }
      expect(course.lectures.length).toBeGreaterThanOrEqual(4)
      expect(course.docsGuides.length).toBeGreaterThanOrEqual(2)
      for (const guide of course.docsGuides) {
        expect(guide.url.startsWith('https://docs.hanzo.ai/')).toBe(true)
      }
      for (const step of course.labSteps) {
        expect(step.snippet).not.toContain('/api/')
        expect(step.snippet).not.toContain('HANZO_API_KEY')
        expect(step.snippet).not.toContain('sk-')
        if (step.endpoint) {
          expect(step.endpoint).toContain('/v1/')
          expect(step.endpoint).not.toContain('/api/')
        }
      }
    }

    for (const track of CERTIFICATION_TRACKS) {
      expect(COURSE_BY_SLUG[track.capstoneSlug]).toBeDefined()
      for (const slug of track.requiredSlugs) {
        expect(COURSE_BY_SLUG[slug], `${track.id} course ${slug}`).toBeDefined()
      }
    }
  })

  test('route parser and path builder round-trip /learn, sections, courses, and tabs cleanly', () => {
    expect(parseLearnRoute('/learn')).toEqual({
      slug: null,
      tab: 'overview',
      section: 'launchpad',
      schoolFilter: 'all',
    })
    expect(parseLearnRoute('/learn?view=startup&school=business')).toEqual({
      slug: null,
      tab: 'overview',
      section: 'startup',
      schoolFilter: 'business',
    })
    expect(parseLearnRoute('/learn/kai-training-decision-models', '?tab=experiments')).toEqual({
      slug: 'kai-training-decision-models',
      tab: 'experiments',
      section: 'launchpad',
      schoolFilter: 'all',
    })
    expect(parseLearnRoute('/learn/build-your-ai-company/capstone')).toEqual({
      slug: 'build-your-ai-company',
      tab: 'capstone',
      section: 'launchpad',
      schoolFilter: 'all',
    })
    expect(learnPath()).toBe('/learn')
    expect(learnPath('kai-training-decision-models', { tab: 'experiments' })).toBe(
      '/learn/kai-training-decision-models?tab=experiments',
    )
  })
})

describe('Choose-Your-Adventure recommendation engine', () => {
  test('generates a complete track with free AUTO 101 starter, core courses, certification, docs, and first lab for all 6 goals', () => {
    expect(ADVENTURE_GOALS).toHaveLength(6)
    for (const goal of ADVENTURE_GOALS) {
      const rec = recommendAdventureTrack(goal.id)
      expect(rec.starter.slug).toBe('continuous-improvement')
      expect(rec.starter.code).toBe('AUTO 101')
      expect(rec.coreCourses.length).toBeGreaterThanOrEqual(3)
      expect(rec.certification.id).toBe(goal.certificationId)
      expect(rec.firstLabHref).toBe(`/learn/${rec.firstLabCourse.slug}?tab=experiments`)
      expect(rec.docsLinks.length).toBeGreaterThanOrEqual(2)
    }

    const aiCo = recommendAdventureTrack('ai-company')
    expect(aiCo.firstLabCourse.slug).toBe('build-your-ai-company')
    expect(aiCo.certification.badgeCode).toBe('HCU-ENT')

    const kai = recommendAdventureTrack('decision-service')
    expect(kai.firstLabCourse.slug).toBe('kai-training-decision-models')
  })
})

describe('KAI 301 9-step Lab 01, schema validators, and live /v1/ API calls', () => {
  test('has 9 structured lab steps and 5 calibration checks', () => {
    const course = getCourse('kai-training-decision-models')!
    expect(course.labKind).toBe('kai-301')
    expect(course.labSteps).toHaveLength(9)
    expect(KAI_301_LAB_STEPS.map((s) => s.stepNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(KAI_CALIBRATION_CHECKLIST).toHaveLength(5)
  })

  test('validates POST /v1/decisions and POST /v1/capabilities/{name}/train payloads strictly', () => {
    const okDec = validateKaiDecisionPayload(
      JSON.stringify({
        capability: 'acme-lead-triage',
        input: { seats: 120 },
        choices: ['enterprise', 'self_serve'],
        dry_run: true,
      }),
    )
    expect(okDec.valid).toBe(true)
    expect(okDec.warnings.length).toBeGreaterThan(0)

    const dupDec = validateKaiDecisionPayload(
      JSON.stringify({ capability: 'acme', input: { a: 1 }, choices: ['yes', 'yes'] }),
    )
    expect(dupDec.valid).toBe(false)

    const badJson = validateKaiDecisionPayload('{not json')
    expect(badJson.valid).toBe(false)

    const okTrain = validateKaiTrainPayload(
      JSON.stringify({
        capability: 'acme-lead-triage',
        dataset_uri: 'hanzo://datasets/triage/v1',
        preregistered_threshold: { min_accuracy: 0.88, max_ece: 0.04 },
      }),
    )
    expect(okTrain.valid).toBe(true)

    const badTrain = validateKaiTrainPayload(
      JSON.stringify({
        capability: 'acme-lead-triage',
        dataset_uri: 'hanzo://datasets/triage/v1',
      }),
    )
    expect(badTrain.valid).toBe(false)
    expect(badTrain.errors.join(' ')).toContain('preregistered_threshold')
  })

  test('requires IAM bearer signed in and calls real /v1/decisions & /v1/capabilities/{name}/train endpoints when authenticated', async () => {
    const signedOut = await invokeKaiDecision({ capability: 'acme', input: {}, choices: ['a', 'b'] })
    expect(signedOut.ok).toBe(false)
    expect(signedOut.status).toBe(401)

    sessionState.token = 'iam_tok_live'
    const calls: Array<{ url: string; headers: Record<string, string> }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> })
        return new Response(JSON.stringify({ decision: 'enterprise', confidence: 0.94 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    const decRes = await invokeKaiDecision({ capability: 'acme-lead-triage', input: { seats: 100 }, choices: ['enterprise', 'self_serve'] })
    expect(decRes.ok).toBe(true)
    expect(calls[0]!.url).toBe('https://api.hanzo.ai/v1/decisions')
    expect(calls[0]!.headers.Authorization).toBe('Bearer iam_tok_live')
    expect(calls[0]!.headers['X-Org-Id']).toBe('hanzo')

    const trainRes = await submitKaiCapabilityTrain('acme-lead-triage', { capability: 'acme-lead-triage' })
    expect(trainRes.ok).toBe(true)
    expect(calls[1]!.url).toBe('https://api.hanzo.ai/v1/capabilities/acme-lead-triage/train')
  })
})

describe('ENT 401 Startup Builder, AI Faculty routing, Sandbox lease, and Capstone VC', () => {
  test('ENT 401 has 6 stages wired to real internal & Hanzo platform deep-links', () => {
    expect(STARTUP_BUILDER_STAGES).toHaveLength(6)
    const hrefs = STARTUP_BUILDER_STAGES.flatMap((s) => [s.actionHref, s.secondaryHref].filter(Boolean))
    expect(hrefs).toContain('/flow')
    expect(hrefs).toContain('/science')
    expect(hrefs).toContain('/settings')
    expect(hrefs).toContain('https://console.hanzo.ai')
    expect(hrefs).toContain('https://hanzo.ai/pay')

    expect(computeStartupReadinessPct([])).toBe(0)
    expect(computeStartupReadinessPct(['ent-stage-1', 'ent-stage-2', 'ent-stage-3'])).toBe(50)
    expect(computeStartupReadinessPct(STARTUP_BUILDER_STAGES.map((s) => s.id))).toBe(100)
  })

  test('8 AI Faculty personas route to POST /v1/chat/completions (model: enso) with active course & threshold discipline', async () => {
    expect(FACULTY_BOTS.map((b) => b.handle)).toEqual([
      '@Edu',
      '@Sci',
      '@Dev',
      '@Cyber',
      '@Data',
      '@Doc',
      '@QA',
      '@Lang',
    ])
    const course = getCourse('kai-training-decision-models')!
    const eduPrompt = buildFacultySystemPrompt(FACULTY_BY_ID.edu, course, 'experiments', '7. Evaluate Calibration')
    expect(eduPrompt).toContain('KAI 301')
    expect(eduPrompt).toContain('pre-registered accuracy and calibration thresholds')
    expect(eduPrompt).toContain('https://api.hanzo.ai/v1/')

    const unauth = await askFacultyTutor({
      bot: FACULTY_BY_ID.edu,
      course,
      activeTab: 'experiments',
      history: [],
      prompt: 'Ready to promote?',
    })
    expect(unauth.error).toContain('Sign in with Hanzo IAM')

    sessionState.token = 'iam_tok_live'
    let capturedBody: Record<string, unknown> = {}
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        return new Response(
          JSON.stringify({
            model: 'enso',
            choices: [{ message: { role: 'assistant', content: 'Did you verify ECE <= 0.04 on holdout?' } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }),
    )

    const live = await askFacultyTutor({
      bot: FACULTY_BY_ID.edu,
      course,
      activeTab: 'experiments',
      activeStepTitle: '7. Evaluate Calibration',
      history: [],
      prompt: 'My throughput doubled!',
    })
    expect(live.error).toBeUndefined()
    expect(live.reply).toContain('ECE <= 0.04')
    expect(capturedBody.model).toBe('enso')
    expect(Array.isArray(capturedBody.messages)).toBe(true)
  })

  test('Lab Terminal leases and releases isolated sandboxes via /v1/dev/sessions and Science falls back cleanly to preview', async () => {
    const preview = await fetchCourseScienceExperiments()
    expect(preview.source).toBe('preview')
    expect(preview.rows.every((r) => r.source === 'preview')).toBe(true)

    const unauthBox = await launchLabSandbox('continuous-improvement')
    expect(unauthBox.session).toBeNull()

    sessionState.token = 'iam_tok_live'
    const methods: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        methods.push(`${init?.method ?? 'GET'} ${url}`)
        if (init?.method === 'POST') {
          return new Response(
            JSON.stringify({ id: 'sess_sbx_1', label: 'Visor Cell', zap: 'cell.hanzo.ai', sandbox: 'sbx_1' }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        return new Response(null, { status: 204 })
      }),
    )

    const leased = await launchLabSandbox('kai-training-decision-models')
    expect(leased.session?.id).toBe('sess_sbx_1')
    expect(leased.session?.zap).toBe('https://cell.hanzo.ai')
    const released = await releaseLabSandbox('sess_sbx_1')
    expect(released).toBe(true)
    expect(methods).toEqual([
      'POST https://api.hanzo.ai/v1/dev/sessions',
      'DELETE https://api.hanzo.ai/v1/dev/sessions/sess_sbx_1',
    ])
  })

  test('Capstone verification checks all 5 receipts and builds W3C Verifiable Credential v2.0 preview', () => {
    const course = getCourse('kai-training-decision-models')!
    const completeSub = {
      datasetManifest: 'hanzo://datasets/lead-triage/v1 sha256:abcdef1234',
      evalMetrics: 'Baseline acc 0.78 -> Candidate 0.91, ECE 0.029',
      artifactRef: 'ckpt_kai_triage_v1',
      regressionReport: 'Holdout n=400 verified; zero minority slice regressions.',
      preregisteredMet: true,
      regressionFree: true,
      submittedAt: '2026-11-25T00:00:00Z',
    }
    const report = verifyCapstoneSubmission(course, completeSub)
    expect(report.passed).toBe(true)
    expect(report.scorePct).toBe(100)

    const vc = buildVerifiableCredentialPreview(course, completeSub, 'Ada Lovelace', 'acme')
    expect(vc['@context']).toContain('https://www.w3.org/ns/credentials/v2')
    expect((vc.credentialStatus as { status: string }).status).toBe('preview_ready_for_practical_review')

    const pct = computeCourseCompletionPct(course, {
      completedLectures: course.lectures.map((l) => l.id),
      completedLabSteps: course.labSteps.map((s) => s.id),
      kaiChecklist: [],
      capstone: completeSub,
      updatedAt: '2026-11-25T00:00:00Z',
    })
    expect(pct).toBe(100)
  })
})
