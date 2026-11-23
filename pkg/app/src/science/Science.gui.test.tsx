// @vitest-environment happy-dom
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, tap, type Mounted } from '../../vitest.real'
import { sha256HexBytes } from './types'

const state = vi.hoisted(() => ({
  path: '/science',
  hanzodOnline: false,
  pushed: [] as string[],
}))

vi.mock('../host', () => ({
  useHost: () => ({
    path: state.path,
    router: {
      push: (to: string) => {
        state.path = to
        state.pushed.push(to)
      },
      replace: (to: string) => {
        state.path = to
      },
      back: () => {},
      forward: () => {},
    },
  }),
}))

vi.mock('../lib/api', () => ({ api: () => 'https://api.hanzo.ai' }))
vi.mock('../lib/session', () => ({ bearer: () => 'tok-gui-test', org: () => 'hanzo' }))

import { Science } from './Science'

let at: Mounted
afterEach(async () => {
  await at?.done()
})

describe('Hanzo Science native @hanzo/gui experience', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    state.path = '/science'
    state.hanzodOnline = false
    state.pushed = []
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('renders exact header, 5 tabs, strict proven vs promising vs refuted separation, run compare, SHA-256 verification, and Desktop hanzod reconnect recovery', async () => {
    const reportBytes = new TextEncoder().encode(JSON.stringify({ tok_s: 312.4, kernel: 'flash_decode_v3' }))
    const reportSha = await sha256HexBytes(reportBytes)

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? 'GET').toUpperCase()

      if (url.startsWith('http://127.0.0.1:3690/')) {
        if (!state.hanzodOnline) {
          throw new Error('ECONNREFUSED')
        }
        if (url.endsWith('/v1/hanzod')) {
          return new Response(JSON.stringify({ name: 'hanzod', version: '0.9.1' }), { status: 200 })
        }
        if (url.endsWith('/v1/hanzod/worker')) {
          return new Response(
            JSON.stringify({
              ok: true,
              enabled: true,
              linked: true,
              sse_connected: true,
              worker_id: 'dgx-hanzod',
              hostname: 'dgx',
              queues: ['gpu:dgx-hanzod', 'gpu-jobs'],
              capabilities: ['research.bench', 'research.tick'],
              os: 'linux',
              arch: 'aarch64',
              cpus: 20,
              memory: 137438953472,
              gpus: [{ name: 'NVIDIA GB10', arch: 'sm_121', memoryTotal: '128 GiB' }],
              backends: ['CUDA'],
              busy: false,
              when_idle_only: true,
              targeted_only: false,
              max_gpu_util_pct: 25,
            }),
            { status: 200 },
          )
        }
        if (url.endsWith('/v1/research/health')) {
          return new Response(JSON.stringify({ ok: true, sandbox: 'hanzo-vm', hanzo_vm_available: true }), {
            status: 200,
          })
        }
        if (url.endsWith('/v1/research/runs')) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 })
        }
      }

      if (url.includes('/v1/research/studies')) {
        return new Response(
          JSON.stringify({
            data: [{ id: 'decode-throughput', title: 'Decode Throughput Scaling', runs: ['run-a', 'run-b'] }],
          }),
          { status: 200 },
        )
      }
      if (url.includes('/v1/research/benchmarks')) {
        return new Response(
          JSON.stringify({
            data: [{ id: 'enso-decode-32k', title: 'Enso 32k Decode', metric: 'tok_s', splits: [] }],
          }),
          { status: 200 },
        )
      }
      if (url.includes('/v1/research/runs')) {
        return new Response(
          JSON.stringify({
            data: [
              { id: 'run-a', benchmark: 'enso-decode-32k', system: 'engine-v1', completion: 'complete', measures: [{ category: 'all', metric: 'tok_s', value: 250 }] },
              { id: 'run-b', benchmark: 'enso-decode-32k', system: 'engine-v2', completion: 'complete', measures: [{ category: 'all', metric: 'tok_s', value: 312.4 }] },
            ],
          }),
          { status: 200 },
        )
      }
      if (url.includes('/v1/research/experiments') && !url.includes('/versions')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'exp-qualified-1',
                kind: 'kernel-perf',
                subject: 'hanzoai/engine',
                task: 'decode-throughput',
                metric: 'tok_s',
                value: 312.4,
                n: 128,
                cost_usd: 3.2,
                git_sha: 'abcdef0123456789',
                meta: {
                  repo: 'hanzoai/engine',
                  verdict: 'proven',
                  backend: 'CUDA',
                  gpu: 'NVIDIA GB10',
                  conclusion: '24.9% faster decode at 32k context',
                  next_hypothesis: 'Port split-K kernel to gfx1151 ROCm',
                  artifact_hashes: { benchmark_report: reportSha },
                },
              },
              {
                id: 'exp-screening-lead-1',
                kind: 'kernel-perf',
                subject: 'hanzoai/engine',
                task: 'decode-throughput',
                metric: 'tok_s',
                value: 295.0,
                n: 16,
                cost_usd: 0.4,
                git_sha: '1122334455667788',
                meta: {
                  repo: 'hanzoai/engine',
                  verdict: 'promising_inconclusive',
                  backend: 'ROCM',
                  conclusion: 'Screening lift on n=16; awaiting full 128-sample qualification',
                },
              },
              {
                id: 'exp-dead-end-1',
                kind: 'ablation',
                subject: 'hanzoai/engine',
                task: 'decode-throughput',
                metric: 'tok_s',
                value: 190.0,
                n: 64,
                cost_usd: 1.5,
                git_sha: '9988776655443322',
                meta: {
                  repo: 'hanzoai/engine',
                  verdict: 'refuted',
                  failure_diagnosis: 'Shared memory bank conflict on 8-wave tile',
                },
              },
            ],
          }),
          { status: 200 },
        )
      }
      if (url.includes('/v1/research/experiments') && url.includes('versions')) {
        return new Response(
          JSON.stringify({
            versions: [{ seq: 1, status: 'complete', revision: 'original', value: 312.4, n: 128, content_hash: reportSha }],
          }),
          { status: 200 },
        )
      }
      if (url.includes('/v1/research/compare')) {
        return new Response(
          JSON.stringify({
            comparable: true,
            blocks: [],
            config: [{ field: 'system', a: 'engine-v1', b: 'engine-v2' }],
            deltas: [{ category: 'all', metric: 'tok_s', a: 250, b: 312.4, change: 62.4, overlap: false }],
          }),
          { status: 200 },
        )
      }
      if (url.includes(`/v1/research/artifacts/${reportSha}`)) {
        return new Response(reportBytes, { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (url.includes('/v1/research/artifacts')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/v1/research/evidence')) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      if (url.includes('/v1/compute/fleet/workers')) {
        return new Response(
          JSON.stringify({
            workers: [
              {
                id: 'evo',
                hostname: 'evo',
                status: 'online',
                os: 'linux',
                arch: 'x86_64',
                gpus: [{ name: 'AMD Ryzen AI Max+ 395', arch: 'gfx1151' }],
                capabilities: ['research.bench', 'research.tick'],
                busy: true,
                busy_reason: 'local_gpu_lock_held',
              },
            ],
          }),
          { status: 200 },
        )
      }
      if (url.includes('/v1/workflow/namespaces/gpu-jobs/schedules') && method === 'GET') {
        return new Response(
          JSON.stringify({
            schedules: [
              {
                scheduleId: 'nightly-bench',
                namespace: 'gpu-jobs',
                spec: { interval: [{ interval: '6h' }] },
                action: { taskQueue: 'gpu-jobs', activityType: { name: 'research.tick' }, input: { when_idle_only: true } },
                state: { paused: false, note: '' },
                info: { nextActionTimes: ['2026-11-23T08:00:00Z'], recentActions: [] },
              },
            ],
          }),
          { status: 200 },
        )
      }
      if (url.includes('/v1/workflow/events')) {
        return new Response(null, { status: 404 })
      }
      return new Response(JSON.stringify({ data: [], activities: [] }), { status: 200 })
    }) as typeof fetch

    at = await mount()
    const onNavigate = (to: string) => {
      state.path = to
      state.pushed.push(to)
    }

    // 1. Mount on Desktop while local hanzod is offline/restarting -> shows reconnect banner without blocking UI
    await at.draw(createElement(Science, { desktopHint: true, onNavigate }))
    await new Promise((r) => setTimeout(r, 150))

    expect(document.querySelector('[data-slot="science-title"]')?.textContent).toBe('Hanzo Science')
    expect(document.querySelector('[data-slot="science-subtitle"]')?.textContent).toBe(
      'Research, discovery, experimentation and autonomous evolution',
    )
    expect(document.querySelector('[data-slot="science-workspace-strip"]')?.textContent).toContain(
      'Research workspace',
    )
    expect(document.querySelector('[data-slot="science-workspace-strip"]')?.textContent).toContain(
      'One interface across Web, Desktop and Cloud',
    )
    expect(document.querySelector('[data-slot="hanzod-reconnect-banner"]')).not.toBeNull()

    const tabLabels = [...document.querySelectorAll('[role="tab"]')].map((el) =>
      el.textContent?.replace(/[0-9]+$/, '').trim(),
    )
    expect(tabLabels).toEqual(['Overview', 'Studies', 'Autonomy', 'Machines', 'Schedules'])

    // Verify strict epistemic counts on Overview
    expect(document.querySelector('[data-slot="metric-qualified-wins"]')?.textContent).toContain('1')
    expect(document.querySelector('[data-slot="metric-promising-leads"]')?.textContent).toContain('1')
    expect(document.querySelector('[data-slot="metric-refutations"]')?.textContent).toContain('1')

    // 2. Navigate to Studies -> run live comparison + inspect reproducibility & client-side SHA-256 verification
    await tap(document.querySelector('[data-slot="science-tab-studies"]')!)
    await at.draw(createElement(Science, { desktopHint: true, onNavigate }))
    expect(state.path).toBe('/science/studies')

    await tap(document.querySelector('[data-slot="compare-submit"]')!)
    await new Promise((r) => setTimeout(r, 120))
    expect(document.querySelector('[data-slot="compare-results"]')?.textContent).toContain('Non-overlapping CI')

    await tap(document.querySelector('[data-slot="experiment-item-exp-qualified-1"]')!)
    await new Promise((r) => setTimeout(r, 120))
    const drawerText = document.querySelector('[data-slot="reproducibility-drawer"]')?.textContent ?? ''
    expect(drawerText).toContain('ci.hanzo.ai')
    expect(drawerText).toContain('cd.hanzo.ai')

    await tap(document.querySelector(`[data-slot="verify-artifact-${reportSha.slice(0, 12)}"]`)!)
    await new Promise((r) => setTimeout(r, 120))
    expect(document.querySelector('[data-slot="sha256-badge"]')?.textContent).toContain('SHA-256 Verified')

    // 3. Recover local `hanzod` while standing in Studies -> banner clears without losing `/science/studies`!
    state.hanzodOnline = true
    await tap(document.querySelector('[data-slot="hanzod-reconnect-now"]')!)
    await new Promise((r) => setTimeout(r, 150))
    expect(document.querySelector('[data-slot="hanzod-reconnect-banner"]')).toBeNull()
    expect(document.querySelector('[data-slot="hanzod-transport-pill"]')?.textContent).toContain('dgx-hanzod')
    expect(state.path).toBe('/science/studies')

    // 4. Navigate to Machines -> verify both `dgx-hanzod` (NVIDIA GB10) and `evo` (gfx1151, busy_reason) render
    await tap(document.querySelector('[data-slot="science-tab-machines"]')!)
    await at.draw(createElement(Science, { desktopHint: true, onNavigate }))
    expect(state.path).toBe('/science/machines')
    expect(document.querySelector('[data-slot="local-hanzod-worker-controls"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="machine-card-evo"]')?.textContent).toContain('local_gpu_lock_held')

    // 5. Navigate to Schedules -> verify `nightly-bench` schedule renders with nextActionTime
    await tap(document.querySelector('[data-slot="science-tab-schedules"]')!)
    await at.draw(createElement(Science, { desktopHint: true, onNavigate }))
    expect(state.path).toBe('/science/schedules')
    expect(document.querySelector('[data-slot="schedule-item-nightly-bench"]')?.textContent).toContain(
      '2026-11-23T08:00:00Z',
    )
  })
})
