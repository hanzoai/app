import { describe, expect, it, vi } from 'vitest'
import type { Agent, AgentRun } from '@hanzo/ai'
import { lines, partsOf } from './said'
import { GRID, isStarredBot, lastWord, policyBadge, sortGroupsByLayer, split } from './grid'
import {
  findBotComputer,
  groupNameOf,
  isGroupRef,
  make,
  opened,
  toGroupRef,
  updateBotMeta,
  type BotAgent,
  type BotGroup,
  type Client,
} from './api'
import { nextPeriod, nextWeek, recordedRun, refusal } from './refusal'
import { compose, fence, fits, MAX, texty } from './carry'

// This browser works in one organization, which every pay address names.
vi.mock('../lib/session', async (real) => ({ ...(await real<typeof import('../lib/session')>()), org: () => 'acme' }))

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

  it('marks a run another bot asked for as that bot’s message, its words first, and never as yours', () => {
    const runs: AgentRun[] = [
      { id: 'a', status: 'ok', input: 'post it', output: 'posted', actor: 'acme/agt_dev', createdAt: at('2026-11-12T11:00:00') },
    ]
    const said = lines(runs, bots, 'Mark', null, NOW, 'en-US', t)
    expect(said.map((l) => l.kind)).toEqual(['stamp', 'from', 'other', 'theirs'])
    expect(said[1]).toMatchObject({ kind: 'from', bot: { name: 'Dev' } })
    expect(said[2]).toMatchObject({ text: 'post it' })
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

  it('orders core Hanzo personas by seat so Vi leads the 3x4 grid ahead of non-lead crew', () => {
    const seeded = ['art', 'cyber', 'su', 'sci', 'sal', 'mark', 'huma', 'fin', 'des', 'dev', 'mana', 'opera', 'vi', 'doc'].map((id) =>
      bot(id, '2026-10-01T09:00:00'),
    )
    const { grid, rows } = split(seeded, new Map())
    expect(grid.map((b) => b.name)).toEqual(['vi', 'opera', 'mana', 'dev', 'des', 'fin', 'huma', 'mark', 'sal', 'sci', 'su', 'cyber'])
    expect(rows.map((b) => b.name)).toEqual(['art', 'doc'])
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
    expect(refusal(e, 'Mark', NOW, t)).toEqual({
      message: 'Weekly usage limit reached.',
      resets: '2026-11-15T19:30:00Z',
      actions: [{ kind: 'upgrade', label: 'See plans', url: 'https://hanzo.ai/pricing' }],
    })
  })

  it('says an empty balance in its own words and sends Add credits to pay’s amount step, never the console page the 402 names', () => {
    const e = Object.assign(new Error('402'), {
      status: 402,
      body: { error: { code: 'insufficient_balance', message: 'Add credits at https://console.hanzo.ai/billing/credits', billingUrl: 'https://console.hanzo.ai/billing/credits' } },
    })
    const no = refusal(e, 'Mark', NOW, t)!
    expect(no.message).toBe('Your balance is empty.')
    expect(no.resets).toBeNull()
    expect(no.actions).toHaveLength(1)
    const [add] = no.actions
    expect(add.kind).toBe('topup')
    expect(add.label).toBe('Add credits')
    const url = new URL(add.url!)
    expect(url.origin + url.pathname).toBe('https://hanzo.ai/pay/amount/card')
    expect(url.searchParams.get('org')).toBe('acme')
    expect(url.searchParams.get('returnUrl')).toBe(typeof window === 'undefined' ? null : window.location.href)
  })

  it('reads the zip problem shape the same way, and the meter’s billing envelope too', () => {
    const problem = Object.assign(new Error('402'), {
      status: 402,
      body: { status: 402, code: 'insufficient_balance', message: 'Add credits at https://console.hanzo.ai/billing/credits', billingUrl: 'https://console.hanzo.ai/billing/credits' },
    })
    const meter = Object.assign(new Error('402'), {
      status: 402,
      body: { error: { message: 'Insufficient balance. Please add credits at console.hanzo.ai', type: 'billing_error', code: 'insufficient_balance' } },
    })
    for (const e of [problem, meter]) {
      const no = refusal(e, 'Mark', NOW, t)!
      expect(no.message).toBe('Your balance is empty.')
      expect(no.actions.map((a) => new URL(a.url!).pathname)).toEqual(['/pay/amount/card'])
    }
  })

  it('offers Add credits for no plan and no credit, and for a spent Free allowance with when it comes back', () => {
    const unpaid = Object.assign(new Error('402'), {
      status: 402,
      body: { error: 'payment_required', reason: 'unpaid', code: 'payment_required', message: 'no active subscription and no prepaid credit; subscribe or add credits at https://console.hanzo.ai/billing', billingUrl: 'https://console.hanzo.ai/billing' },
    })
    expect(refusal(unpaid, 'Mark', NOW, t)?.message).toBe('Your balance is empty.')
    expect(refusal(unpaid, 'Mark', NOW, t)?.actions.map((a) => a.label)).toEqual(['Add credits'])
    const spent = Object.assign(new Error('429'), {
      status: 429,
      body: { code: 'allowance_spent', message: 'Add credits at https://console.hanzo.ai/billing/credits', resets_at: '2026-11-13T00:00:00Z' },
    })
    expect(refusal(spent, 'Mark', NOW, t)).toMatchObject({ message: 'Usage reached.', resets: '2026-11-13T00:00:00Z' })
    expect(refusal(spent, 'Mark', NOW, t)?.actions.map((a) => new URL(a.url!).pathname)).toEqual(['/pay/amount/card'])
  })

  it('says billing that could not be checked as the platform does, with no money asked for', () => {
    const e = Object.assign(new Error('402'), {
      status: 402,
      body: { error: 'payment_required', reason: 'unresolved', code: 'payment_required', message: 'billing could not be verified; retry shortly' },
    })
    expect(refusal(e, 'Mark', NOW, t)).toEqual({ message: 'billing could not be verified; retry shortly', resets: null, actions: [] })
  })

  it('names the console as platform.hanzo.ai, and a spend cap’s page as what it is', () => {
    const e = Object.assign(new Error('402'), {
      status: 402,
      body: { code: 'spend_cap_exceeded', message: 'Spend cap reached for this scope. Raise it at https://console.hanzo.ai/billing/budgets', billingUrl: 'https://console.hanzo.ai/billing/budgets' },
    })
    expect(refusal(e, 'Mark', NOW, t)).toEqual({
      message: 'Spend cap reached for this scope. Raise it at https://platform.hanzo.ai/billing/budgets',
      resets: null,
      actions: [{ kind: 'upgrade', label: 'Raise the spend cap', url: 'https://platform.hanzo.ai/billing/budgets' }],
    })
  })

  it('sends a top-up the gateway offers to pay as well', () => {
    const e = Object.assign(new Error('429'), {
      status: 429,
      body: {
        error: {
          type: 'rate_limit_error',
          code: 'usage_cap_exceeded',
          message: 'Weekly usage limit reached.',
          actions: [{ kind: 'topup', label: 'Add credits', url: 'https://console.hanzo.ai/billing/credits' }],
        },
      },
    })
    expect(refusal(e, 'Mark', NOW, t)?.actions.map((a) => new URL(a.url!).pathname)).toEqual(['/pay/amount/card'])
  })

  it('offers no address that is not one of ours', () => {
    const e = Object.assign(new Error('402'), {
      status: 402,
      body: { error: { code: 'spend_cap_exceeded', message: 'Pay here', billingUrl: 'https://evil.example/pay' } },
    })
    expect(refusal(e, 'Mark', NOW, t)?.actions).toEqual([])
  })

  it('says a bot’s own weekly budget is spent, and that it comes back on Monday', () => {
    const e = Object.assign(new Error('402'), {
      status: 402,
      body: { status: 402, code: 'budget_exceeded', detail: 'agent budget exceeded: this call would cost up to 900 micro-USD and 12 remain' },
    })
    const no = refusal(e, 'Mark', Date.UTC(2026, 10, 12, 19, 30), t)
    expect(no).toEqual({ message: 'Mark has spent this week’s budget.', resets: '2026-11-16T00:00:00.000Z', actions: [] })
  })

  it('says a daily or monthly budget by its own period', () => {
    const e = Object.assign(new Error('402'), { status: 402, body: { code: 'budget_exceeded' } })
    expect(refusal(e, 'Mark', Date.UTC(2026, 10, 12, 19, 30), t, 'month')).toEqual({ message: 'Mark has spent this month’s budget.', resets: '2026-12-01T00:00:00.000Z', actions: [] })
    expect(nextPeriod(Date.UTC(2026, 10, 12, 19, 30), 'day')).toBe('2026-11-13T00:00:00.000Z')
  })

  it('counts a week from Monday 00:00 UTC, and a Monday as the start of the next', () => {
    expect(nextWeek(Date.UTC(2026, 10, 15, 23, 59))).toBe('2026-11-16T00:00:00.000Z')
    expect(nextWeek(Date.UTC(2026, 10, 16, 0, 1))).toBe('2026-11-23T00:00:00.000Z')
  })

  it('is not a notice for any other failure', () => {
    expect(refusal(Object.assign(new Error('502'), { status: 502 }), 'Mark', NOW, t)).toBeNull()
    expect(refusal(new Error('failed to fetch'), 'Mark', NOW, t)).toBeNull()
  })
})

describe('a run that reached its model and failed', () => {
  it('is the run a 502 carries, and nothing a 502 from anything in front of it says', () => {
    const run = { id: 'run_1', status: 'error', error: 'the model refused', input: 'hi' }
    expect(recordedRun(Object.assign(new Error('502'), { status: 502, body: run }))).toEqual(run)
    expect(recordedRun(Object.assign(new Error('502'), { status: 502, body: '<html>Bad gateway</html>' }))).toBeNull()
    expect(recordedRun(Object.assign(new Error('500'), { status: 500, body: run }))).toBeNull()
  })
})

describe('a text file with a message', () => {
  it('is fenced under its name, after the words', () => {
    expect(compose('read this', { name: 'notes.md', text: 'one\ntwo\n' })).toBe('read this\n\n```notes.md\none\ntwo\n```')
    expect(compose('  ', null)).toBe('')
  })

  it('cannot be closed early by a fence inside it, or a name that breaks the line', () => {
    const f = fence({ name: 'a`b\nc.md', text: 'x\n````\ny' })
    expect(f.startsWith('`````a b c.md\n')).toBe(true)
    expect(f.endsWith('\n`````')).toBe(true)
  })

  it('is text, and a message fits what a bot reads at once', () => {
    expect(texty('plain')).toBe(true)
    expect(texty('bin\u0000ary')).toBe(false)
    expect(fits('a'.repeat(MAX))).toBe(true)
    expect(fits('é'.repeat(MAX / 2 + 1))).toBe(false)
  })

  it('splits structured attachment cards and preview images cleanly from prose', () => {
    const raw = [
      "I'm building the new comparables page.",
      '[Hanzo Bloomingdale.pdf · 2.9MB](https://hanzo.ai/brief.pdf)',
      'The brief now has 9 pages.',
      '![Comparables preview](/preview.png)',
    ].join('\n\n')
    expect(partsOf(raw)).toEqual([
      { kind: 'prose', text: "I'm building the new comparables page." },
      { kind: 'doc', name: 'Hanzo Bloomingdale.pdf', size: '2.9MB', href: 'https://hanzo.ai/brief.pdf', ext: 'pdf' },
      { kind: 'prose', text: 'The brief now has 9 pages.' },
      { kind: 'image', alt: 'Comparables preview', src: '/preview.png' },
    ])
  })
})

describe('primary bot, full computer-use tools, and layered bot groups', () => {
  it('pins Primary Bot hanzo to slot #1 in the roster grid with a star badge', () => {
    const dev = bot('dev', '2026-10-01T09:00:00')
    const viBot = bot('vi', '2026-10-01T09:00:00')
    const primary: BotAgent = { ...bot('hanzo', '2026-10-15T09:00:00'), isPrimary: true, layer: 0 }
    const { grid } = split([dev, viBot, primary], new Map())
    expect(grid[0].name).toBe('hanzo')
    expect(isStarredBot(primary)).toBe(true)
  })

  it('creates new bots with tools: ["*"] so Desktop Computer Use and connectors work immediately', async () => {
    const json = vi.fn().mockResolvedValue({ id: 'agt_1', name: 'ops', model: 'enso', tools: ['*'] })
    const fakeClient = { http: { json } } as unknown as Client
    await make(fakeClient, { name: 'ops', instructions: 'Run QA checks on desktop', model: 'enso', weekly: 15, layer: 2 })
    expect(json).toHaveBeenCalledTimes(1)
    expect(json.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      path: '/v1/agents',
      body: {
        name: 'ops',
        tools: ['*'],
        layer: 2,
        cap_micro_usd: 15_000_000,
      },
    })
  })

  it('sorts Bot Groups by layer ascending and formats Lux Quasar & Leader badges cleanly', () => {
    const groups: BotGroup[] = [
      { id: 'g3', name: 'qa-exec', layer: 3, members: ['cyber'], policy: { kind: 'majority' } },
      { id: 'g1', name: 'core-eng', layer: 1, members: ['dev', 'des', 'opera'], policy: { kind: 'quasar', quasarProfile: 'pulsar' } },
      { id: 'g2', name: 'design-pod', layer: 2, members: ['des', 'mark'], policy: { kind: 'leader', leader: 'des' } },
    ]
    const sorted = sortGroupsByLayer(groups)
    expect(sorted.map((g) => g.name)).toEqual(['core-eng', 'design-pod', 'qa-exec'])
    expect(policyBadge(sorted[0].policy)).toBe('Lux Quasar · Pulsar')
    expect(policyBadge(sorted[1].policy)).toBe('Leader · des')
    expect(policyBadge(sorted[2].policy)).toBe('Majority')
    expect(isGroupRef(toGroupRef('core-eng'))).toBe(true)
    expect(groupNameOf('group:core-eng')).toBe('core-eng')
  })
})

// A bot's computer opens on the API host, never on the page's: cloud's grant is a
// path, and on hanzo.bot the page's own host answers it with a page that refuses
// to be framed ("hanzo.bot refused to connect").
describe('opened', () => {
  const at = (origin: string) => {
    const u = new URL(origin)
    vi.stubGlobal('window', { location: { hostname: u.hostname, origin: u.origin } })
  }
  const path = '/v1/sandbox/sbx_1/screen?ticket=t1'

  it('opens a screen on api.hanzo.ai from hanzo.bot, hanzo.ai and hanzo.team', () => {
    for (const origin of ['https://hanzo.bot', 'https://hanzo.ai', 'https://hanzo.team']) {
      at(origin)
      expect(opened(path, true)).toBe('https://api.hanzo.ai/v1/sandbox/sbx_1/screen?ticket=t1&viewOnly=1')
      expect(opened(path, false)).toBe('https://api.hanzo.ai/v1/sandbox/sbx_1/screen?ticket=t1&viewOnly=0')
      vi.unstubAllGlobals()
    }
  })

  it('opens a terminal with no mode, and keeps an address that already names its host', () => {
    at('https://hanzo.bot')
    expect(opened('/v1/sandbox/sbx_1/terminal?ticket=t2')).toBe('https://api.hanzo.ai/v1/sandbox/sbx_1/terminal?ticket=t2')
    expect(opened('https://api-dev.hanzo.ai/v1/sandbox/sbx_1/screen?ticket=t3', true)).toBe(
      'https://api-dev.hanzo.ai/v1/sandbox/sbx_1/screen?ticket=t3&viewOnly=1',
    )
    vi.unstubAllGlobals()
  })

  it('stays on a dev server’s own origin, where its proxy reaches the API', () => {
    at('http://localhost:3000')
    expect(opened(path, true)).toBe('http://localhost:3000/v1/sandbox/sbx_1/screen?ticket=t1&viewOnly=1')
    vi.unstubAllGlobals()
  })

  it('patches /v1/agent/:ref and prefers an actively running desktop over a stale stopped computeRef', async () => {
    const json = vi.fn().mockResolvedValue({ id: 'agt_hanzo', name: 'hanzo', computeRef: 'm_live' })
    const list = vi.fn().mockImplementation((query?: { project?: string }) => {
      if (query?.project) return Promise.resolve([])
      return Promise.resolve([
        { id: 'm_old', class: 'desktop', status: 'stopped' },
        { id: 'm_live', class: 'desktop', status: 'running' },
      ])
    })
    const fakeClient = { http: { json }, sandboxes: { list } } as unknown as Client

    await updateBotMeta(fakeClient, 'hanzo', { computeRef: 'm_live' })
    expect(json).toHaveBeenCalledWith({
      method: 'PATCH',
      path: '/v1/agent/hanzo',
      body: { computeRef: 'm_live' },
    })

    const primary: BotAgent = { ...bot('hanzo', '2026-10-15T09:00:00'), isPrimary: true, computeRef: 'm_old' }
    const picked = await findBotComputer(fakeClient, primary)
    expect(picked?.id).toBe('m_live')
  })
})
