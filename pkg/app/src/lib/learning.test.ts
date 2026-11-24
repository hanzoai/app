import { afterEach, describe, expect, test, vi } from 'vitest'
import { LEARNING_PATHS, learningCompare, learningCreate, learningExperimentVersions, learningRead } from './learning'

vi.mock('./api', () => ({ api: () => 'https://api.test' }))
vi.mock('./session', () => ({ scope: () => ({ Authorization: 'Bearer test-session', 'X-Org-Id': 'acme' }) }))

afterEach(() => vi.unstubAllGlobals())

describe('native learning transport', () => {
  test('reads retained experiment versions from /v1/research and compares measured pairs without starting a model', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          versions: [
            { seq: 2, id: 'kernel-perf:exp-1', revision: 'amendment-1', status: 'complete', canonical: true, metric: 'bw_gbps', value: 182.5, git_sha: 'abcdef1234' },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ n_common: 0 }) })
    vi.stubGlobal('fetch', fetcher)
    const versions = await learningExperimentVersions('kernel-perf:exp-1')
    const compared = await learningCompare('gpqa_diamond', 'system-a', 'system-b')
    expect(fetcher.mock.calls[0][0]).toBe('https://api.test/v1/research/experiments/versions?id=kernel-perf%3Aexp-1')
    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({ id: 'kernel-perf:exp-1', revision: 'amendment-1', canonical: true, metric: 'bw_gbps', value: 182.5 })
    expect(fetcher.mock.calls[1][0]).toBe('https://api.test/v1/benchmark/compare?benchmark=gpqa_diamond&a=system-a&b=system-b')
    expect(compared.n_common).toBe(0)
    expect(fetcher.mock.calls.every(([url]) => !url.includes('/v1/experiment/') && !url.includes('/decide'))).toBe(true)
  })
  test('reads the canonical /v1/research ledger surfaces (never feature-flag /v1/experiment) with the current scope', async () => {
    expect(LEARNING_PATHS.experiments).toBe('/v1/research/experiments')
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'kernel-perf:sdpa:gb10/run-1',
              project: 'hanzo-ml',
              kind: 'kernel-perf',
              subject: 'torch-sdpa-decode-gb10',
              metric: 'bw_ratio',
              value: 0.958,
              status: 'complete',
              git_sha: '63b377a',
              meta: JSON.stringify({ verdict: 'refuted', study: 'm1-gb10-splitkv-32k' }),
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
    vi.stubGlobal('fetch', fetcher)
    await learningRead('studies')
    const experiments = await learningRead('experiments')
    await learningRead('benchmarks')
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://api.test/v1/research/studies',
      'https://api.test/v1/research/experiments',
      'https://api.test/v1/benchmark/catalog',
    ])
    expect(experiments).toHaveLength(1)
    expect(experiments[0]).toMatchObject({
      id: 'kernel-perf:sdpa:gb10/run-1',
      project: 'hanzo-ml',
      kind: 'kernel-perf',
      subject: 'torch-sdpa-decode-gb10',
      metric: 'bw_ratio',
      value: 0.958,
      meta: { verdict: 'refuted', study: 'm1-gb10-splitkv-32k' },
    })
    for (const [, init] of fetcher.mock.calls) expect(init.headers['X-Org-Id']).toBe('acme')
  })

  test('shows only native findings and propagates refusal rather than inventing empty results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'native', action: { rule: 'research.improvement.v1' } }, { id: 'other', action: { rule: 'unrelated' } }] }) }))
    expect((await learningRead('reviews')).map((row) => row.id)).toEqual(['native'])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    expect(await learningRead('studies')).toEqual([])
    expect(await learningRead('reviews')).toEqual([])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    await expect(learningRead('studies')).rejects.toMatchObject({ status: 403 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    await expect(learningRead('studies')).rejects.toThrow('data array')
  })

  test('creates an explicit study policy without asserting a tenant, executing a model or promoting a winner', async () => {
    const fetcher = vi.fn().mockImplementation(async (_url, init) => ({ ok: true, json: async () => ({ data: JSON.parse(fetcher.mock.calls[0][1].body).studies }) }))
    vi.stubGlobal('fetch', fetcher)
    await learningCreate({ title: 'Recovery', question: 'Does the new recovery improve correctness?', baseline: 'measured-baseline', target: 'hanzoai/dev', metric: 'accuracy', category: 'held-out', direction: 'higher', minQuestions: 40, minGain: 2 }, 'study-1')
    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.test/v1/research/studies')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body).not.toHaveProperty('org')
    expect(body.studies[0].improvement).toEqual({ baseline: 'measured-baseline', target: 'hanzoai/dev', min_questions: 40, require_intervals: false, metrics: [{ category: 'held-out', metric: 'accuracy', direction: 'higher', min_gain: 2, max_regression: 0 }] })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})


test('never reports automatic review enabled when an older cloud drops the policy', async () => {
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({data:[{id:'old'}]}) }))
 await expect(learningCreate({title:'x',question:'x',baseline:'b',target:'dev',metric:'accuracy',category:'all',direction:'higher',minQuestions:2,minGain:1}, 'old')).rejects.toMatchObject({status:503})
})
