import { describe, expect, it } from 'vitest'
import type { LimitNotice } from '@hanzo/ui/product/limits'
import { paused, resets } from './limits'

const NOW = Date.parse('2026-10-07T12:00:00Z')
const PAY = 'https://hanzo.ai/pay'
const UP = { kind: 'upgrade' as const, label: 'Upgrade to Max 20x', plan: 'max-20x', url: `${PAY}/cart?plan=max-20x` }
const CREDITS = { kind: 'credits' as const, label: 'Continue with credits', url: '/v1/ai/limits' }
const TOPUP = { kind: 'topup' as const, label: 'Add prepaid credit', url: PAY }

const notice = (o: Partial<LimitNotice>): LimitNotice => ({
  reason: 'plan_allowance_used',
  classes: ['premium'],
  message: 'Premium models are paused until Nov 1.',
  actions: [UP, CREDITS, TOPUP],
  resets_at: '2026-10-07T17:00:00Z',
  fallback: null,
  refused: false,
  ...o,
})

/** The banner's words with the reset as this machine's clock words it, for the cases that do not pin a zone. */
const reached = (iso: string) => `Usage reached. Resets at ${resets(iso, NOW)}.`

describe('paused', () => {
  it('says usage reached, when it resets on the reader’s clock, and the upgrade, then the model chatting on', () => {
    const b = paused(notice({ fallback: 'enso' }), 'max-5x', () => 'Enso', NOW)!
    expect(b.message).toBe(`${reached('2026-10-07T17:00:00Z')} You’re chatting on Enso.`)
    expect(b.message).not.toMatch(/UTC|00:00|max-5x|\b\d+ (calls|requests)\b/)
  })

  it('offers the upgrade first, then credits, then trying again later', () => {
    expect(paused(notice({}), 'max-5x', undefined, NOW)!.actions.map((a) => [a.kind, a.label, a.url])).toEqual([
      ['upgrade', 'Upgrade to continue', UP.url],
      ['credits', 'Continue with credits', CREDITS.url],
      ['later', 'Try again later', undefined],
    ])
  })

  it('adds credits on pay’s amount step, and upgrades on pay’s plans, where the server names neither', () => {
    const b = paused(notice({ reason: 'allowance_spent', classes: [], message: 'Usage reached', actions: [] }), 'free', undefined, NOW)!
    expect(b.message).toBe(reached('2026-10-07T17:00:00Z'))
    expect(b.actions.map((a) => a.kind)).toEqual(['upgrade', 'topup', 'later'])
    expect(b.actions[0].url).toMatch(/\/pay\/cart(\?|$)/)
    expect(b.actions[1]).toMatchObject({ label: 'Add credits' })
    expect(b.actions[1].url).toMatch(/\/pay\/amount\/card(\?|$)/)
  })

  it('says a spent request window the same way, never with the raw instant or address the gateway wrote', () => {
    const b = paused(
      notice({
        reason: 'usage_cap_exceeded',
        classes: [],
        message: "You've used session requests on your plan. They reset at 2026-11-01T00:00:00Z. Upgrade for more at https://hanzo.ai/pay/cart?plan=max-20x",
        actions: [UP],
      }),
      'max-5x',
      undefined,
      NOW,
    )!
    expect(b.message).toBe(reached('2026-10-07T17:00:00Z'))
    expect(b.message).not.toContain('2026-11-01T00:00:00Z')
  })

  it('says it without a time when the server names no reset', () => {
    expect(paused(notice({ resets_at: null }), 'dev', undefined, NOW)!.message).toBe('Usage reached.')
  })

  it('never tells an Ultra reader of a spent window, which Ultra has none of', () => {
    for (const reason of ['usage_cap_exceeded', 'allowance_spent', 'free_plan_cap']) expect(paused(notice({ reason }), 'ultra', undefined, NOW)).toBeNull()
    // A window on any other plan is said.
    expect(paused(notice({ reason: 'usage_cap_exceeded' }), 'max-10x', undefined, NOW)).not.toBeNull()
  })

  it('keeps the server’s words for any other refusal', () => {
    expect(paused(notice({ reason: 'paid_plan_required', message: 'This model needs a paid plan.' }), 'free', undefined, NOW)!.message).toBe('This model needs a paid plan.')
  })

  it('says every word through t', () => {
    const t = (s: string, v?: Record<string, unknown>) => `«${s}»${v?.time ? `@${String(v.time)}` : ''}`
    const b = paused(notice({}), 'dev', undefined, NOW, t as never)!
    expect(b.message.startsWith('«Usage reached. Resets at {time}.»')).toBe(true)
    expect(b.actions.map((a) => a.label)).toEqual(['«Upgrade to continue»', 'Continue with credits', '«Try again later»'])
  })
})

describe('resets', () => {
  // 17:00 UTC on 7 Oct 2026, seen from three clocks. ICU sets a narrow no-break space before AM/PM; the words are what is compared.
  const AT = '2026-10-07T17:00:00Z'
  const plain = (...a: Parameters<typeof resets>) => resets(...a).replace(/\u202f/g, ' ')

  it('is the time alone when the reset falls today where the reader is', () => {
    expect(plain(AT, NOW, 'en-US', 'America/Los_Angeles')).toBe('10:00 AM')
    expect(plain(AT, NOW, 'en-US', 'Europe/London')).toBe('6:00 PM')
    expect(plain(AT, NOW, 'en-GB', 'Europe/London')).toBe('18:00')
  })

  it('carries the date when the reset falls on another day where the reader is', () => {
    // 22:30 on 7 Oct in Kolkata is already the next day's 04:00 at the reset.
    expect(plain('2026-10-07T22:30:00Z', NOW, 'en-US', 'Asia/Kolkata')).toBe('Oct 8, 4:00 AM')
    // Midnight UTC is the evening before in Los Angeles: today, not tomorrow.
    expect(plain('2026-10-08T00:00:00Z', NOW, 'en-US', 'America/Los_Angeles')).toBe('5:00 PM')
  })

  it('follows a clock across a daylight-saving change', () => {
    // US clocks fall back at 2:00 on 1 Nov 2026: 9:00 UTC is 5:00 AM the day before, and 10:00 UTC is 5:00 AM after it.
    const before = Date.parse('2026-10-31T12:00:00Z')
    expect(plain('2026-10-31T09:00:00Z', before, 'en-US', 'America/New_York')).toBe('5:00 AM')
    expect(plain('2026-11-01T10:00:00Z', before, 'en-US', 'America/New_York')).toBe('Nov 1, 5:00 AM')
    // Europe fell back a week earlier, on 25 Oct: 17:00 UTC is 6:00 PM in London before it and 5:00 PM after.
    expect(plain('2026-10-24T17:00:00Z', Date.parse('2026-10-24T08:00:00Z'), 'en-US', 'Europe/London')).toBe('6:00 PM')
    expect(plain('2026-10-26T17:00:00Z', Date.parse('2026-10-26T08:00:00Z'), 'en-US', 'Europe/London')).toBe('5:00 PM')
  })

  it('is empty for no instant or one that does not parse', () => {
    expect(plain('', NOW)).toBe('')
    expect(plain('soon', NOW)).toBe('')
  })
})
