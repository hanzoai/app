import { afterEach, describe, expect, test, vi } from 'vitest'
import { learningAnalyze, learningCompare, learningCreate, learningRead } from './learning'

vi.mock('./lib/api', () => ({ api: () => 'https://api.test' }))
vi.mock('./lib/session', () => ({ scope: () => ({ Authorization: 'Bearer test-session', 'X-Org-Id': 'acme' }) }))

afterEach(() => vi.unstubAllGlobals())

describe('native learning transport', () => {
  test('analyzes outcomes without promoting a rollout and compares measured pairs without starting a model', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ n_common: 0 }) })
    vi.stubGlobal('fetch', fetcher)
    await learningAnalyze('trial-one')
    const compared = await learningCompare('gpqa_diamond', 'system-a', 'system-b')
    expect(fetcher.mock.calls[0][0]).toBe('https://api.test/v1/experiment/trial-one/analyze')
    expect(fetcher.mock.calls[0][1].method).toBe('POST')
    expect(fetcher.mock.calls[1][0]).toBe('https://api.test/v1/benchmark/compare?benchmark=gpqa_diamond&a=system-a&b=system-b')
    expect(compared.n_common).toBe(0)
    expect(fetcher.mock.calls.every(([url]) => !url.includes('/decide') && !url.includes('/runs'))).toBe(true)
  })
  test('reads the three canonical cloud surfaces with the current scope', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    vi.stubGlobal('fetch', fetcher)
    await learningRead('studies'); await learningRead('experiments'); await learningRead('benchmarks')
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['https://api.test/v1/research/studies', 'https://api.test/v1/experiment', 'https://api.test/v1/benchmark/catalog'])
    for (const [, init] of fetcher.mock.calls) expect(init.headers['X-Org-Id']).toBe('acme')
  })

  test('shows only native findings and propagates refusal rather than inventing empty results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: 'native', action: { rule: 'research.improvement.v1' } }, { id: 'other', action: { rule: 'unrelated' } }] }) }))
    expect((await learningRead('reviews')).map((row) => row.id)).toEqual(['native'])
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
