import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { page, place, resume, SCIENCE, science } from '../lib/host'
import { wordmark } from '../where'
import {
  buildResearchSummary,
  cancelWorkflowActivity,
  compareRuns,
  configureHanzodWorker,
  createSchedule,
  deleteSchedule,
  describeSchedule,
  dispatchResearchActivities,
  fetchAndVerifyArtifact,
  filePreregistration,
  listExperiments,
  listLinkedMachines,
  listOpportunities,
  listSchedules,
  pauseSchedule,
  probeHanzodState,
  resumeSchedule,
  subscribeWorkflowEvents,
  triggerSchedule,
} from './api'
import { scienceNav } from './nav'
import {
  classifyVerdict,
  inferMachineBackends,
  parseScienceTab,
  provenanceLinks,
  resolveTaskQueue,
  SCIENCE_TABS,
  sha256HexBytes,
} from './types'

const state = vi.hoisted(() => ({
  apiBase: 'https://api.hanzo.ai',
  token: [
    btoa(JSON.stringify({ alg: 'RS256' })),
    btoa(JSON.stringify({ sub: 'u-1', project: 'ml-lab' })),
    'sig',
  ].join('.'),
  org: 'hanzo',
}))

vi.mock('../lib/api', () => ({ api: () => state.apiBase }))
vi.mock('../lib/session', () => ({ bearer: () => state.token, org: () => state.org }))
vi.mock('@hanzo/gui', () => ({ XStack: 'div', YStack: 'div', Text: 'span' }))
vi.mock('@hanzo/ui', () => ({ Button: 'button', Input: 'input', Switch: 'input', Spinner: 'span', Text: 'span' }))
vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))

describe('Hanzo Science routes, epistemic rigor, and full transport', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('registers /science and all 5 sub-routes cleanly across Web & Desktop', () => {
    expect(SCIENCE).toBe('/science')
    expect(SCIENCE_TABS).toEqual(['overview', 'studies', 'autonomy', 'machines', 'schedules'])
    expect(wordmark('research')).toBe('Science')

    expect(science()).toBe('/science')
    expect(science('overview')).toBe('/science')
    expect(science('studies')).toBe('/science/studies')
    expect(science('autonomy')).toBe('/science/autonomy')
    expect(science('machines')).toBe('/science/machines')
    expect(science('schedules')).toBe('/science/schedules')

    expect(place('/science')).toEqual({ mode: 'research' })
    expect(place('/science/studies')).toEqual({ mode: 'research', tab: 'studies' })
    expect(place('/science/autonomy')).toEqual({ mode: 'research', tab: 'autonomy' })
    expect(place('/science/machines')).toEqual({ mode: 'research', tab: 'machines' })
    expect(place('/science/schedules')).toEqual({ mode: 'research', tab: 'schedules' })
    expect(page('/science/studies')).toBe('/science/studies')

    expect(parseScienceTab('/science')).toBe('overview')
    expect(parseScienceTab('/science/studies')).toBe('studies')
    expect(parseScienceTab('/science/autonomy')).toBe('autonomy')
    expect(parseScienceTab('/science/machines')).toBe('machines')
    expect(parseScienceTab('/science/schedules')).toBe('schedules')
    expect(parseScienceTab('/science', '?tab=machines')).toBe('machines')

    const nav = scienceNav('studies', () => {})
    expect(nav[0]?.links.slice(1).map((l) => l.label)).toEqual([
      'Overview',
      'Studies',
      'Autonomy',
      'Machines',
      'Schedules',
    ])
    expect(nav[0]?.links.find((l) => l.id === 'studies')?.active).toBe(true)

    vi.stubGlobal('window', {
      location: { hostname: 'hanzo.app' },
      localStorage: { getItem: () => 'science' },
    })
    expect(resume()).toBe('/science')
    vi.unstubAllGlobals()
  })

  test('strictly separates proven wins vs promising_inconclusive screening lifts vs refuted findings', async () => {
    expect(classifyVerdict('proven')).toBe('proven')
    expect(classifyVerdict('promising_inconclusive')).toBe('promising_inconclusive')
    expect(classifyVerdict('refuted')).toBe('refuted')
    expect(classifyVerdict('inconclusive')).toBe('inconclusive')

    // A screening-stage or unqualified run claiming "proven"/"win" MUST be demoted to promising_inconclusive!
    expect(
      classifyVerdict({
        status: 'complete',
        meta: { verdict: 'proven', stage: 'screening' },
      }),
    ).toBe('promising_inconclusive')
    expect(
      classifyVerdict({
        status: 'complete',
        meta: { verdict: 'win', qualification: 'unqualified' },
      }),
    ).toBe('promising_inconclusive')
    expect(
      classifyVerdict({
        status: 'complete',
        meta: { verdict: 'inconclusive', delta: 0.08 },
      }),
    ).toBe('promising_inconclusive')
    expect(
      classifyVerdict({
        status: 'complete',
        meta: { verdict: 'proven', qualification: 'qualified' },
      }),
    ).toBe('proven')

    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 404 })) as typeof fetch
    const summary = await buildResearchSummary({
      studies: [],
      benchmarks: [],
      runs: [],
      machines: [],
      activities: [],
      experiments: [
        {
          project: 'ml-lab',
          id: 'exp-proven-1',
          revision: 'original',
          status: 'complete',
          canonical: true,
          visibility: 'org',
          trainable: false,
          publishable: false,
          kind: 'kernel-perf',
          subject: 'hanzo-engine/CUDA',
          task: 'decode',
          metric: 'tok_s',
          value: 245,
          n: 128,
          n_total: 128,
          cost_usd: 4.5,
          meta: { verdict: 'proven', gpu_time_sec: 1800 },
          git_sha: 'a1b2c3d4',
          git_branch: 'main',
          git_dirty: false,
          lib_versions: {},
          ts: 1700000000,
        },
        {
          project: 'ml-lab',
          id: 'exp-promising-1',
          revision: 'original',
          status: 'complete',
          canonical: true,
          visibility: 'org',
          trainable: false,
          publishable: false,
          kind: 'kernel-perf',
          subject: 'hanzo-engine/ROCM',
          task: 'decode',
          metric: 'tok_s',
          value: 198,
          n: 16,
          n_total: 128,
          cost_usd: 0.75,
          meta: { verdict: 'proven', stage: 'screening', gpu_time_sec: 1800 },
          git_sha: 'b2c3d4e5',
          git_branch: 'main',
          git_dirty: false,
          lib_versions: {},
          ts: 1700000100,
        },
        {
          project: 'ml-lab',
          id: 'exp-refuted-1',
          revision: 'original',
          status: 'complete',
          canonical: true,
          visibility: 'org',
          trainable: false,
          publishable: false,
          kind: 'ablation',
          subject: 'hanzo-ml/CUDA',
          task: 'prefill',
          metric: 'tok_s',
          value: 90,
          n: 64,
          n_total: 64,
          cost_usd: 2.25,
          meta: { verdict: 'refuted', failure_diagnosis: 'Register spill > 64 regs/thread' },
          git_sha: 'c3d4e5f6',
          git_branch: 'main',
          git_dirty: false,
          lib_versions: {},
          ts: 1700000200,
        },
      ],
    })

    expect(summary.qualifiedWins).toBe(1)
    expect(summary.promisingLeads).toBe(1)
    expect(summary.refutedCount).toBe(1)
    expect(summary.totalCostUsd).toBe(7.5)
    expect(summary.totalGpuHours).toBe(1)
  })

  test('generates separate ci.hanzo.ai and cd.hanzo.ai provenance links (never cicd.hanzo.ai)', () => {
    const links = provenanceLinks({ repo: 'hanzoai/engine', commit: 'deadbeef1234' })
    expect(links.ciUrl).toBe('https://ci.hanzo.ai/hanzoai/engine?commit=deadbeef1234')
    expect(links.cdUrl).toBe('https://cd.hanzo.ai/applications?search=engine')
    expect(links.ciUrl).not.toContain('cicd.hanzo.ai')
    expect(links.cdUrl).not.toContain('cicd.hanzo.ai')
  })

  test('sends org-scoped headers, compares runs, verifies SHA-256 artifacts client-side, and files pre-registrations', async () => {
    const artifactPayload = JSON.stringify({ benchmark: 'swe-bench', pass_at_1: 0.84 })
    const artifactBytes = new TextEncoder().encode(artifactPayload)
    const realHash = await sha256HexBytes(artifactBytes)

    const seen: { url: string; method: string; headers: Record<string, string>; body?: unknown }[] = []
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      const headers = (init?.headers ?? {}) as Record<string, string>
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
      seen.push({ url, method, headers, body })

      if (url.startsWith('https://api.hanzo.ai/v1/research/compare')) {
        return new Response(
          JSON.stringify({
            comparable: true,
            blocks: [],
            config: [{ field: 'version', a: 'v1', b: 'v2' }],
            deltas: [{ category: 'all', metric: 'pass@1', a: 0.78, b: 0.84, change: 0.06, overlap: false }],
          }),
          { status: 200 },
        )
      }
      if (url.startsWith(`https://api.hanzo.ai/v1/research/artifacts/${realHash}`)) {
        return new Response(artifactBytes, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.startsWith('https://api.hanzo.ai/v1/research/artifacts/00000000')) {
        return new Response(artifactBytes, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url === 'https://api.hanzo.ai/v1/research/evidence' && method === 'POST') {
        const b = body as Record<string, unknown>
        return new Response(
          JSON.stringify({
            id: 'ev-101',
            uri: b.uri,
            hash: b.hash,
            kind: b.kind,
            source: b.source,
            links: b.links,
            content: b.content,
            version: 1,
          }),
          { status: 200 },
        )
      }
      if (url.startsWith('https://api.hanzo.ai/v1/research/experiments')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'exp-1',
                kind: 'kernel-perf',
                subject: 'engine/CUDA',
                task: 'attention',
                metric: 'tok_s',
                value: 310,
                n: 64,
                meta: { verdict: 'proven', backend: 'CUDA', next_hypothesis: 'Test FP8 KV cache on GB10' },
                git_sha: '11223344',
              },
            ],
          }),
          { status: 200 },
        )
      }
      if (url.startsWith('https://api.hanzo.ai/v1/research/evidence?uri=')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({}), { status: 404 })
    }) as typeof fetch

    const cmp = await compareRuns('run-base', 'run-cand')
    expect(cmp.comparable).toBe(true)
    expect(cmp.deltas[0]).toMatchObject({ metric: 'pass@1', change: 0.06, overlap: false })
    expect(seen[0]?.headers).toMatchObject({
      Authorization: `Bearer ${state.token}`,
      'X-Org-Id': 'hanzo',
      'X-Project-Id': 'ml-lab',
    })

    const verified = await fetchAndVerifyArtifact(realHash)
    expect(verified.verified).toBe(true)
    expect(verified.computedSha256).toBe(realHash)
    expect(verified.previewText).toContain('"swe-bench"')

    const tampered = await fetchAndVerifyArtifact('0000000000000000000000000000000000000000000000000000000000000000')
    expect(tampered.verified).toBe(false)

    const prereg = await filePreregistration({
      study: 'kernel-attention',
      hypothesis: 'FP8 KV cache improves GB10 decode throughput >= 15%',
      nullHypothesis: 'Throughput delta < 15%',
      metric: 'tok_s',
      targetDelta: 0.15,
      higherIsBetter: true,
      manifestSha256: realHash,
      evidenceKind: 'requirement',
      screeningSamples: 16,
      qualificationSamples: 128,
      maxComputeSeconds: 600,
      maxCostUsd: 20,
      anytimeValid: true,
    })
    expect(prereg.uri).toMatch(/^research:\/\/hypotheses\/kernel-attention\//)
    expect(prereg.kind).toBe('requirement')
    expect(prereg.version).toBe(1)

    const exps = await listExperiments({ verdict: 'proven', backend: 'CUDA' })
    expect(exps).toHaveLength(1)
    const ops = await listOpportunities({ experiments: exps })
    expect(ops[0]?.proposed_approach).toBe('Test FP8 KV cache on GB10')
    expect(ops[0]?.axis).toBe('context_len')
  })

  test('merges fleet machines (dgx GB10 + evo gfx1151), configures local hanzod (PATCH -> PUT fallback), dispatches fan-out, and runs full schedule CRUD', async () => {
    expect(resolveTaskQueue('any')).toBe('gpu-jobs')
    expect(resolveTaskQueue('dgx')).toBe('gpu:dgx')
    expect(
      inferMachineBackends({
        os: 'linux',
        gpus: [{ name: 'NVIDIA GB10', arch: 'sm_121' }],
      }),
    ).toContain('CUDA')
    expect(
      inferMachineBackends({
        os: 'linux',
        gpus: [{ name: 'AMD Ryzen AI Max+ 395', arch: 'gfx1151' }],
      }),
    ).toEqual(expect.arrayContaining(['ROCM', 'VULKAN']))

    const calls: { method: string; url: string; body?: unknown }[] = []
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()
      const body = typeof init?.body === 'string' && init.body ? JSON.parse(init.body) : undefined
      calls.push({ method, url, body })

      if (url === 'http://127.0.0.1:3690/v1/hanzod') {
        return new Response(JSON.stringify({ name: 'hanzod', version: '0.9.0' }), { status: 200 })
      }
      if (url === 'http://127.0.0.1:3690/v1/hanzod/worker' && method === 'GET') {
        return new Response(
          JSON.stringify({
            ok: true,
            enabled: true,
            linked: true,
            sse_connected: true,
            worker_id: 'dgx-hanzod',
            hostname: 'dgx',
            queues: ['gpu:dgx-hanzod', 'gpu-jobs'],
            capabilities: ['research.bench', 'research.tick', 'hanzod.run'],
            os: 'linux',
            arch: 'aarch64',
            cpus: 20,
            memory: 128 * 1024 ** 3,
            gpus: [{ name: 'NVIDIA GB10', arch: 'sm_121', memoryTotal: '128 GiB' }],
            backends: ['CUDA', 'CPU'],
            busy: false,
            when_idle_only: true,
            targeted_only: false,
            max_gpu_util_pct: 25,
          }),
          { status: 200 },
        )
      }
      if (url === 'http://127.0.0.1:3690/v1/research/health') {
        return new Response(JSON.stringify({ ok: true, sandbox: 'hanzo-vm', hanzo_vm_available: true }), {
          status: 200,
        })
      }
      if (url === 'http://127.0.0.1:3690/v1/hanzod/worker' && method === 'PATCH') {
        // Real Rust hanzod answers 405 on PATCH and expects PUT — verify seamless fallback!
        return new Response(JSON.stringify({ error: 'GET or PUT /v1/hanzod/worker' }), { status: 405 })
      }
      if (url === 'http://127.0.0.1:3690/v1/hanzod/worker' && method === 'PUT') {
        const b = body as Record<string, unknown>
        return new Response(
          JSON.stringify({
            ok: true,
            enabled: true,
            linked: true,
            sse_connected: true,
            worker_id: 'dgx-hanzod',
            hostname: 'dgx',
            when_idle_only: b.when_idle_only,
            max_gpu_util_pct: b.max_gpu_util_pct,
          }),
          { status: 200 },
        )
      }
      if (url === 'https://api.hanzo.ai/v1/compute/fleet/workers') {
        return new Response(
          JSON.stringify({
            workers: [
              {
                id: 'evo',
                hostname: 'evo',
                status: 'online',
                os: 'linux',
                arch: 'x86_64',
                cpus: 32,
                memory: '128 GiB',
                gpus: [{ name: 'AMD Ryzen AI Max+ 395', arch: 'gfx1151', memoryTotal: '96 GiB' }],
                capabilities: ['research.bench', 'research.tick'],
                busy: true,
                busy_reason: 'gpu_utilization_high',
              },
            ],
          }),
          { status: 200 },
        )
      }
      if (url === 'https://api.hanzo.ai/v1/agent/targets') {
        return new Response(JSON.stringify({ targets: [] }), { status: 200 })
      }
      if (url === 'https://api.hanzo.ai/v1/workflow/namespaces' && method === 'POST') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      if (url === 'https://api.hanzo.ai/v1/workflow/namespaces/gpu-jobs/activities' && method === 'POST') {
        const b = body as Record<string, unknown>
        return new Response(
          JSON.stringify({
            activityId: b.activityId,
            runId: b.runId,
            activityType: b.activityType,
            taskQueue: b.taskQueue,
            status: 'ACTIVITY_TASK_STATE_SCHEDULED',
            attempt: 1,
            input: b.input,
          }),
          { status: 200 },
        )
      }
      if (url.endsWith('/cancel') && method === 'POST') {
        return new Response(
          JSON.stringify({
            activityId: 'job-1',
            runId: 'job-1',
            status: 'ACTIVITY_TASK_STATE_CANCELED',
          }),
          { status: 200 },
        )
      }
      if (url === 'https://api.hanzo.ai/v1/workflow/namespaces/gpu-jobs/schedules' && method === 'POST') {
        return new Response(JSON.stringify(body), { status: 200 })
      }
      if (url === 'https://api.hanzo.ai/v1/workflow/namespaces/gpu-jobs/schedules' && method === 'GET') {
        return new Response(
          JSON.stringify({
            schedules: [
              {
                scheduleId: 'sweep-evo',
                namespace: 'gpu-jobs',
                spec: { interval: [{ interval: '2h' }] },
                action: {
                  taskQueue: 'gpu:evo',
                  activityType: { name: 'research.tick' },
                  input: { when_idle_only: true, max_compute_seconds: 900 },
                },
                state: { paused: false, note: '' },
                info: { nextActionTimes: ['2026-11-23T04:00:00Z'], recentActions: [] },
              },
            ],
          }),
          { status: 200 },
        )
      }
      if (url === 'https://api.hanzo.ai/v1/workflow/namespaces/gpu-jobs/schedules/sweep-evo' && method === 'GET') {
        return new Response(
          JSON.stringify({
            scheduleId: 'sweep-evo',
            namespace: 'gpu-jobs',
            spec: { interval: [{ interval: '2h' }] },
            action: { taskQueue: 'gpu:evo', activityType: { name: 'research.tick' }, input: { when_idle_only: true } },
            state: { paused: true, note: 'maintenance' },
            info: { nextActionTimes: ['2026-11-23T06:00:00Z'], recentActions: [] },
          }),
          { status: 200 },
        )
      }
      if (url.endsWith('/pause') || url.endsWith('/unpause') || url.endsWith('/trigger')) {
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      }
      if (url === 'https://api.hanzo.ai/v1/workflow/namespaces/gpu-jobs/schedules/sweep-evo' && method === 'DELETE') {
        return new Response(JSON.stringify({ status: 'deleted' }), { status: 200 })
      }
      if (url === 'https://api.hanzo.ai/v1/workflow/events') {
        const ssePayload = [
          'event: activity.completed',
          'data: {"kind":"activity.completed","namespace":"gpu-jobs","activityId":"job-sse-1","runId":"job-sse-1"}',
          '',
          '',
        ].join('\n')
        return new Response(new TextEncoder().encode(ssePayload), {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        })
      }
      return new Response(JSON.stringify({}), { status: 404 })
    }) as typeof fetch

    const probe = await probeHanzodState()
    expect(probe.connected).toBe(true)
    expect(probe.worker?.worker_id).toBe('dgx-hanzod')

    const updatedWorker = await configureHanzodWorker({ when_idle_only: false, max_gpu_util_pct: 40 })
    expect(updatedWorker.when_idle_only).toBe(false)
    expect(updatedWorker.max_gpu_util_pct).toBe(40)
    expect(calls.some((c) => c.method === 'PATCH' && c.url.endsWith('/v1/hanzod/worker'))).toBe(true)
    expect(calls.some((c) => c.method === 'PUT' && c.url.endsWith('/v1/hanzod/worker'))).toBe(true)

    const machines = await listLinkedMachines({ localWorker: probe.worker })
    expect(machines.map((m) => m.id)).toEqual(['dgx-hanzod', 'evo'])
    expect(machines.find((m) => m.id === 'evo')?.busy_reason).toBe('gpu_utilization_high')

    // Multi-machine fan-out (`evo,dgx`)
    const fanout = await dispatchResearchActivities({
      targets: 'evo,dgx',
      activityType: 'research.bench',
      command: 'hanzo-research bench',
      whenIdleOnly: true,
    })
    expect(fanout).toHaveLength(2)
    expect(fanout.map((f) => f.taskQueue)).toEqual(['gpu:evo', 'gpu:dgx'])

    const canceled = await cancelWorkflowActivity(fanout[0]!.activityId, fanout[0]!.runId)
    expect(canceled.status).toBe('ACTIVITY_TASK_STATE_CANCELED')

    // Schedules CRUD
    const created = await createSchedule({
      scheduleId: 'sweep',
      interval: '2h',
      target: 'evo,dgx',
      activityType: 'research.tick',
      whenIdleOnly: true,
      maxComputeSeconds: 900,
      command: 'hanzo-research tick',
    })
    expect(created.map((c) => c.scheduleId)).toEqual(['sweep-evo', 'sweep-dgx'])

    const listed = await listSchedules()
    expect(listed[0]?.nextActionTime).toBe('2026-11-23T04:00:00Z')

    await pauseSchedule('sweep-evo', 'maintenance')
    const desc = await describeSchedule('sweep-evo')
    expect(desc.paused).toBe(true)
    await resumeSchedule('sweep-evo')
    await triggerSchedule('sweep-evo')
    await deleteSchedule('sweep-evo')

    // Live SSE stream consumption
    const receivedEvents: string[] = []
    const ctl = new AbortController()
    await subscribeWorkflowEvents({
      signal: ctl.signal,
      onEvent: (ev) => {
        receivedEvents.push(`${ev.kind}:${ev.activityId}`)
        ctl.abort()
      },
    })
    expect(receivedEvents).toEqual(['activity.completed:job-sse-1'])
  })
})
