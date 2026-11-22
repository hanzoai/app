import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { page, place, RESEARCH } from './host'
import {
  executeOnLocalHanzod,
  fetchXP,
  fileClaim,
  listCandidateFrontier,
  probeLocalHanzod,
  registerHypothesis,
  replicateClaim,
} from './research'

vi.mock('./api', () => ({ api: () => 'https://api.hanzo.ai' }))
vi.mock('./session', () => ({ bearer: () => 'tok-test-123', org: () => 'acme' }))

describe('Hanzo Dō research routes & typed client', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('resolves /research and /science paths natively to research mode', () => {
    expect(RESEARCH).toBe('/research')
    expect(place('/research')).toEqual({ mode: 'research' })
    expect(place('/science')).toEqual({ mode: 'research' })
    expect(page('/research')).toBe('/research')
    expect(page('/science')).toBe('/research')
  })

  test('pre-registers hypothesis, executes on local hanzod with Cloud sync, replicates claim, and reads XP', async () => {
    const calls: { url: string; method: string; body?: unknown; headers?: unknown }[] = []
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
      calls.push({ url, method, body, headers: init?.headers })

      if (url === 'http://127.0.0.1:3690/v1/research/health') {
        return new Response(
          JSON.stringify({ ok: true, sandbox: 'hanzo-vm', hanzo_vm_available: true, runs_total: 1, runs_running: 0 }),
          { status: 200 },
        )
      }
      if (url === 'https://api.hanzo.ai/v1/research/hypotheses' && method === 'POST') {
        return new Response(
          JSON.stringify({
            project: 'default',
            hypothesis_id: 'sha256:hyp001',
            statement: (body as { statement: string }).statement,
            null_hypothesis: 'null',
            gate_ref: 'swe-bench-verified',
            dataset_refs: [],
            budget: { max_compute_seconds: 300, max_cost_usd: 10 },
            proposer: 'did:hanzo:alice',
            registered_at: '2026-11-22T10:00:00Z',
            seq: 1,
          }),
          { status: 200 },
        )
      }
      if (url === 'http://127.0.0.1:3690/v1/research/runs' && method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 'exp-local-1',
            benchmark: 'swe-bench-verified',
            split: 'test',
            system: 'gen-local',
            sandbox: 'hanzo-vm',
            status: 'complete',
            completion: 'complete',
            questions: 1,
            answered: 1,
            duration_ms: 42,
            measures: [{ category: 'all', metric: 'pass@1', value: 0.85 }],
            artifacts: [{ path: 'execution.log', kind: 'report', sha256: 'abc', ref: 'sha256:abc', bytes: 16 }],
            cloud_synced: true,
          }),
          { status: 200 },
        )
      }
      if (url === 'https://api.hanzo.ai/v1/research/claims' && method === 'POST') {
        return new Response(
          JSON.stringify({
            project: 'default',
            claim_id: 'sha256:claim001',
            hypothesis_id: 'sha256:hyp001',
            run_id: 'exp-local-1',
            mode: 'confirmatory',
            metric: 'pass@1',
            value: 0.85,
            effect_size: 0.05,
            proposer: 'did:hanzo:alice',
            status: 'unreplicated',
            was_replicated: false,
            replications: [],
            seq: 3,
            created_at: '2026-11-22T10:01:00Z',
            updated_at: '2026-11-22T10:01:00Z',
          }),
          { status: 200 },
        )
      }
      if (url.endsWith('/replicate')) {
        return new Response(
          JSON.stringify({
            project: 'default',
            claim_id: 'sha256:claim001',
            status: 'replicated',
            was_replicated: true,
            replications: [{ run_id: 'rep-bob-1', verifier: 'did:hanzo:bob', value: 0.84, agreed: true, replicated_at: '2026-11-22T10:02:00Z' }],
          }),
          { status: 200 },
        )
      }
      if (url === 'https://api.hanzo.ai/v1/research/candidates/frontier') {
        return new Response(JSON.stringify({ data: [], total: 0 }), { status: 200 })
      }
      if (url === 'https://api.hanzo.ai/v1/research/xp') {
        return new Response(
          JSON.stringify({
            rule_version: '1.0.0',
            non_transferable: true,
            balances: [{ principal: 'did:hanzo:alice', total_xp: 100, domains: { science: 100 } }],
            projections: [],
          }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 })
    }) as typeof fetch

    const health = await probeLocalHanzod()
    expect(health?.hanzo_vm_available).toBe(true)

    const hyp = await registerHypothesis({
      statement: 'Sandbox tree-search improves pass@1',
      null_hypothesis: 'No lift',
      gate_ref: 'swe-bench-verified',
    })
    expect(hyp.hypothesis_id).toBe('sha256:hyp001')

    const run = await executeOnLocalHanzod({
      id: 'exp-local-1',
      hypothesis_id: hyp.hypothesis_id,
      benchmark: 'swe-bench-verified',
      command: 'echo ok',
    })
    expect(run.sandbox).toBe('hanzo-vm')
    expect(run.cloud_synced).toBe(true)
    expect(calls[2]?.body).toMatchObject({ cloud_api: 'https://api.hanzo.ai', sync_cloud: true })

    const cl = await fileClaim({
      hypothesis_id: hyp.hypothesis_id,
      run_id: run.id,
      mode: 'confirmatory',
      metric: 'pass@1',
      effect_size: 0.05,
    })
    expect(cl.status).toBe('unreplicated')

    const rep = await replicateClaim(cl.claim_id, 'rep-bob-1')
    expect(rep.status).toBe('replicated')

    const fr = await listCandidateFrontier()
    expect(fr).toEqual([])

    const xp = await fetchXP()
    expect(xp.non_transferable).toBe(true)
    expect(xp.balances[0]?.total_xp).toBe(100)
  })
})
