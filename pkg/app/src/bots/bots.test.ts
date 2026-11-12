import { describe, expect, it } from 'vitest'
import type { Agent, AgentRun } from '@hanzo/ai'
import { lines } from './said'
import { GRID, lastWord, split } from './grid'
import { refusal } from './refusal'

const t = (s: string, v?: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? ''))
const NOW = new Date('2026-11-12T11:30:00').getTime()
const at = (s: string) => new Date(s).toISOString()

const bot = (name: string, made: string, extra: Partial<Agent> = {}): Agent => ({
  id: `agt_${name.toLowerCase()}`,
  name,
  model: 'enso',
  createdAt: at(made),
  ...extra,
})

describe('the thread', () => {
  const bots = [bot('Mark', '2026-10-01T09:00:00'), bot('Dev', '2026-10-02T09:00:00')]

  it('draws each run as your words and its answer, with a stamp where the conversation paused', () => {
    const runs: AgentRun[] = [
      { id: 'a', status: 'ok', input: 'hi', output: 'hello', createdAt: at('2026-11-12T11:00:00') },
      { id: 'b', status: 'ok', input: 'again', output: 'yes', createdAt: at('2026-11-12T11:05:00') },
      { id: 'c', status: 'ok', input: 'later', output: 'sure', createdAt: at('2026-11-12T11:20:00') },
    ]
    const said = lines(runs, bots, 'Mark', null, NOW, 'en-US', t)
    expect(said.map((l) => l.kind)).toEqual(['stamp', 'mine', 'theirs', 'mine', 'theirs', 'mine', 'theirs'])
    expect(said[0]).toMatchObject({ kind: 'stamp', text: 'Today 11:00 AM' })
  })

  it('stamps again after half an hour of quiet', () => {
    const runs: AgentRun[] = [
      { id: 'a', status: 'ok', input: 'hi', output: 'hello', createdAt: at('2026-11-12T10:00:00') },
      { id: 'b', status: 'ok', input: 'again', output: 'yes', createdAt: at('2026-11-12T10:31:00') },
    ]
    expect(lines(runs, bots, 'Mark', null, NOW, 'en-US', t).filter((l) => l.kind === 'stamp')).toHaveLength(2)
  })

  it('marks a run another bot asked for as that bot’s message, and never as yours', () => {
    const runs: AgentRun[] = [
      { id: 'a', status: 'ok', input: 'post it', output: 'posted', actor: 'acme/agt_dev', createdAt: at('2026-11-12T11:00:00') },
    ]
    const said = lines(runs, bots, 'Mark', null, NOW, 'en-US', t)
    expect(said.map((l) => l.kind)).toEqual(['stamp', 'from', 'theirs'])
    expect(said[1]).toMatchObject({ kind: 'from', bot: { name: 'Dev' } })
  })

  it('draws the error a run recorded in place of an answer it never gave', () => {
    const runs: AgentRun[] = [{ id: 'a', status: 'error', input: 'hi', error: 'the model refused', createdAt: at('2026-11-12T11:00:00') }]
    expect(lines(runs, bots, 'Mark', null, NOW, 'en-US', t).at(-1)).toMatchObject({ kind: 'theirs', text: 'the model refused', failed: true })
  })

  it('stands your words at once while the run is out, the bot working under them', () => {
    const said = lines([], bots, 'Mark', { input: 'are you there?', at: NOW }, NOW, 'en-US', t)
    expect(said.map((l) => l.kind)).toEqual(['stamp', 'mine', 'thinking'])
  })
})

describe('the roster', () => {
  it('keeps twelve faces in the order they were made, and lists the rest by their last word', () => {
    const bots = Array.from({ length: 14 }, (_, i) => bot(`B${i}`, `2026-10-${String(i + 1).padStart(2, '0')}T09:00:00`))
    const last = new Map<string, AgentRun>([
      ['B12', { id: 'x', status: 'ok', output: 'older', createdAt: at('2026-11-01T09:00:00') }],
      ['B13', { id: 'y', status: 'ok', output: 'newer', createdAt: at('2026-11-02T09:00:00') }],
    ])
    const { grid, rows } = split([...bots].reverse(), last)
    expect(grid).toHaveLength(GRID)
    expect(grid.map((b) => b.name)).toEqual(bots.slice(0, GRID).map((b) => b.name))
    expect(rows.map((b) => b.name)).toEqual(['B13', 'B12'])
  })

  it('says a bot’s last word on one line: what it answered, else its error, else what it was asked', () => {
    expect(lastWord({ id: 'a', status: 'ok', input: 'q', output: 'line one\nline two' })).toBe('line one line two')
    expect(lastWord({ id: 'a', status: 'error', input: 'q', error: 'refused' })).toBe('refused')
    expect(lastWord(undefined)).toBe('')
  })
})

describe('a refusal about money', () => {
  it('reads the billing envelope: its words, when it lifts, the ways past it', () => {
    const e = Object.assign(new Error('429'), {
      status: 429,
      body: {
        error: {
          type: 'rate_limit_error',
          code: 'usage_cap_exceeded',
          message: 'Weekly usage limit reached.',
          resets_at: '2026-11-15T19:30:00Z',
          actions: [{ kind: 'upgrade', label: 'See plans', url: 'https://hanzo.ai/pricing' }],
        },
      },
    })
    expect(refusal(e, t)).toEqual({
      message: 'Weekly usage limit reached.',
      resets: '2026-11-15T19:30:00Z',
      actions: [{ kind: 'upgrade', label: 'See plans', url: 'https://hanzo.ai/pricing' }],
    })
  })

  it('reads the run’s own 402 and offers the credits address it names', () => {
    const e = Object.assign(new Error('402'), {
      status: 402,
      body: { error: { code: 'insufficient_balance', message: 'Add credits at https://console.hanzo.ai/billing/credits', billingUrl: 'https://console.hanzo.ai/billing/credits' } },
    })
    expect(refusal(e, t)).toEqual({
      message: 'Add credits at https://console.hanzo.ai/billing/credits',
      resets: null,
      actions: [{ kind: 'topup', label: 'Add credits', url: 'https://console.hanzo.ai/billing/credits' }],
    })
  })

  it('is not a notice for any other failure', () => {
    expect(refusal(Object.assign(new Error('502'), { status: 502 }), t)).toBeNull()
    expect(refusal(new Error('failed to fetch'), t)).toBeNull()
  })
})
