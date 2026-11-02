import { describe, expect, it, vi } from 'vitest'
import { format } from '@hanzo/i18n'
import type { LimitNotice } from '@hanzo/ui/product/limits'
import { paused, resets, spends, ultra } from './limits'

// This browser works in one organization, which every pay address names.
vi.mock('./session', async (real) => ({ ...(await real<typeof import('./session')>()), org: () => 'acme' }))

const NOW = Date.parse('2026-10-07T12:00:00Z')
const PAY = 'https://hanzo.ai/pay'
const UP = { kind: 'upgrade' as const, label: 'Upgrade to Max 20x', plan: 'max-20x', url: `${PAY}/cart?plan=max-20x` }
const CREDITS = { kind: 'credits' as const, label: 'Claim a free Ultra', url: '/v1/ai/limits' }
const TOPUP = { kind: 'topup' as const, label: 'Add prepaid credit', url: PAY }
const FREE = { plan: 'free' }
const MAX = { plan: 'max-5x' }
const ULTRA = { plan: 'ultra' }
const en = format('en-US')

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

/** ICU sets a narrow no-break space before AM/PM; the words are what is compared. */
const plain = (s: string) => s.replace(/[  ]/g, ' ')

/** The banner's words for a reset on this machine's clock, as `resets` words it (its own cases are below, each in a named zone). */
function said(iso: string, now = NOW): string {
  const b = resets(iso, now, en)!
  if (b.date) return b.time ? `Usage reached. Resets ${b.date} at ${b.time}.` : `Usage reached. Resets ${b.date} at midnight.`
  return b.time ? `Usage reached. Resets at ${b.time}.` : 'Usage reached. Resets at midnight.'
}

/** No clock says midnight in figures: not 0:00, 00:00, 24:00 or 12:00 AM. */
const FIGURED = /\b0?0:00\b|\b24:00\b|12:00\sAM/i

describe('paused', () => {
  it('says usage reached, when it resets on the reader’s clock, then the model chatting on', () => {
    const b = paused(notice({ fallback: 'enso' }), MAX, () => 'Enso', NOW)!
    expect(b.message).toBe(`${said('2026-10-07T17:00:00Z')} You’re chatting on Enso.`)
    expect(b.message).not.toMatch(/UTC|max-5x|\b\d+ (calls|requests)\b/)
  })

  it('offers the upgrade first, then credits in our words, then trying again later', () => {
    expect(paused(notice({}), MAX, undefined, NOW)!.actions.map((a) => [a.kind, a.label, a.url])).toEqual([
      ['upgrade', 'Upgrade to continue', UP.url],
      ['credits', 'Continue with credits', CREDITS.url],
      ['later', 'Try again later', undefined],
    ])
  })

  it('adds credits on pay’s amount step and upgrades on pay’s plans, for this organization, where the server names neither', () => {
    const b = paused(notice({ reason: 'allowance_spent', classes: [], message: 'Usage reached', actions: [] }), FREE, undefined, NOW)!
    expect(b.message).toBe(said('2026-10-07T17:00:00Z'))
    expect(b.actions.map((a) => a.kind)).toEqual(['upgrade', 'topup', 'later'])
    const [upgrade, topup] = b.actions.map((a) => new URL(a.url ?? 'https://x.invalid'))
    expect(upgrade.pathname).toBe('/pay/cart')
    expect(topup.pathname).toBe('/pay/amount/card')
    expect(b.actions[1].label).toBe('Add credits')
    for (const url of [upgrade, topup]) expect(url.searchParams.get('org')).toBe('acme')
  })

  it('says a spent request window the same way, never with the raw instant or address the gateway wrote', () => {
    const raw = "You've used 5-hour requests on your plan. They reset at 2026-10-07T17:00:00Z. Upgrade for more at https://hanzo.ai/pay/cart?plan=max-10x"
    const b = paused(notice({ reason: 'usage_cap_exceeded', classes: [], message: raw, actions: [UP] }), MAX, undefined, NOW)!
    expect(b.message).toBe(said('2026-10-07T17:00:00Z'))
    expect(b.message).not.toMatch(/2026-|https?:|UTC/)
  })

  it('says no time when the server names none, or one passed, or one that is not an instant', () => {
    for (const resets_at of [null, '', '2026-10-07T11:59:00Z', '2026-10-07T12:00:00Z', 'soon', '2', '1793638800', '2026-10-07T17:00:00', '2026-10-08'])
      expect(paused(notice({ resets_at }), MAX, undefined, NOW)!.message).toBe('Usage reached.')
  })

  it('tells an Ultra reader the balance is empty, with credits the one way on, for every spent reason', () => {
    for (const reason of ['plan_allowance_used', 'usage_cap_exceeded', 'allowance_spent', 'free_plan_cap']) {
      const b = paused(notice({ reason }), ULTRA, undefined, NOW)!
      expect(b.message).toBe('Your balance is empty.')
      expect(b.actions.map((a) => [a.kind, a.label])).toEqual([['topup', 'Add credits']])
      expect(new URL(b.actions[0].url!).searchParams.get('org')).toBe('acme')
    }
    expect(paused(notice({ fallback: 'enso' }), ULTRA, () => 'Enso', NOW)!.message).toBe('Your balance is empty. You’re chatting on Enso.')
  })

  it('knows Ultra by its id alone, as paidPlan knows a paid plan', () => {
    expect(ultra(ULTRA)).toBe(true)
    for (const plan of ['Ultra', 'ultra-annual', 'ultra-lite', 'ultramax', 'hanzo-ultra', ' ultra', '', 'free']) expect(ultra({ plan })).toBe(false)
    expect(ultra(null)).toBe(false)
    // A plan whose name merely starts with "ultra" is any other paid plan: told of its window, with the upgrade.
    expect(paused(notice({ reason: 'usage_cap_exceeded' }), { plan: 'ultra-lite' }, undefined, NOW)!.actions[0].kind).toBe('upgrade')
  })

  it('offers no upgrade before the plan is read, since it could be Ultra', () => {
    const b = paused(notice({ reason: 'allowance_spent', classes: [], actions: [] }), null, undefined, NOW)!
    expect(b.message).toBe(said('2026-10-07T17:00:00Z'))
    expect(b.actions.map((a) => a.kind)).toEqual(['topup', 'later'])
  })

  it('keeps the server’s words for any other refusal', () => {
    expect(paused(notice({ reason: 'paid_plan_required', message: 'This model needs a paid plan.' }), FREE, undefined, NOW)!.message).toBe('This model needs a paid plan.')
  })

  it('says every word through t', () => {
    const t = (s: string) => `«${s}»`
    const b = paused(notice({ resets_at: null }), MAX, undefined, NOW, t as never)!
    expect(b.message).toBe('«Usage reached.»')
    expect(b.actions.map((a) => a.label)).toEqual(['«Upgrade to continue»', '«Continue with credits»', '«Try again later»'])
    expect(paused(notice({}), MAX, undefined, NOW, t as never)!.message).toMatch(/^«Usage reached\. Resets (\{date\} )?at (\{time\}|midnight)\.»$/)
    const u = paused(notice({}), ULTRA, undefined, NOW, t as never)!
    expect([u.message, ...u.actions.map((a) => a.label)]).toEqual(['«Your balance is empty.»', '«Add credits»'])
  })

  it('names the reasons that are usage spent until a reset, which are said in our words', () => {
    for (const code of ['plan_allowance_used', 'usage_cap_exceeded', 'allowance_spent', 'free_plan_cap']) expect(spends(code)).toBe(true)
    for (const code of ['paid_plan_required', 'insufficient_balance', 'constructor', '']) expect(spends(code)).toBe(false)
  })
})

describe('resets', () => {
  // 17:00 UTC on 7 Oct 2026, seen from three clocks.
  const AT = '2026-10-07T17:00:00Z'
  const words = (iso: string, now: number, locale: string, zone: string) => {
    const b = resets(iso, now, format(locale), zone)
    return b && { date: plain(b.date), time: b.time && plain(b.time) }
  }

  it('is the time alone when the reset falls today where the reader is', () => {
    expect(words(AT, NOW, 'en-US', 'America/Los_Angeles')).toEqual({ date: '', time: '10:00 AM' })
    expect(words(AT, NOW, 'en-US', 'Europe/London')).toEqual({ date: '', time: '6:00 PM' })
    expect(words(AT, NOW, 'en-GB', 'Europe/London')).toEqual({ date: '', time: '18:00' })
  })

  it('carries the date when the reset falls on another day where the reader is, and the year when another year', () => {
    // 22:30 on 7 Oct UTC is already 8 Oct, 04:00 in Kolkata.
    expect(words('2026-10-07T22:30:00Z', NOW, 'en-US', 'Asia/Kolkata')).toEqual({ date: 'Oct 8', time: '4:00 AM' })
    // Midnight UTC is the evening before in Los Angeles: today, not tomorrow.
    expect(words('2026-10-08T00:00:00Z', NOW, 'en-US', 'America/Los_Angeles')).toEqual({ date: '', time: '5:00 PM' })
    expect(words('2027-01-01T15:00:00Z', Date.parse('2026-12-31T20:00:00Z'), 'en-US', 'UTC')).toEqual({ date: 'Jan 1, 2027', time: '3:00 PM' })
  })

  it('follows a clock across a daylight-saving change', () => {
    // US clocks fall back at 2:00 on 1 Nov 2026: 9:00 UTC on 31 Oct is 5:00 AM before it, and 10:00 UTC on 1 Nov is 5:00 AM after it.
    const before = Date.parse('2026-10-31T04:00:00Z')
    expect(words('2026-10-31T09:00:00Z', before, 'en-US', 'America/New_York')).toEqual({ date: '', time: '5:00 AM' })
    expect(words('2026-11-01T10:00:00Z', before, 'en-US', 'America/New_York')).toEqual({ date: 'Nov 1', time: '5:00 AM' })
    // Europe fell back a week earlier, on 25 Oct: 17:00 UTC is 6:00 PM in London before it and 5:00 PM after.
    expect(words('2026-10-24T17:00:00Z', Date.parse('2026-10-24T08:00:00Z'), 'en-US', 'Europe/London')).toEqual({ date: '', time: '6:00 PM' })
    expect(words('2026-10-26T17:00:00Z', Date.parse('2026-10-26T08:00:00Z'), 'en-US', 'Europe/London')).toEqual({ date: '', time: '5:00 PM' })
  })

  it('says midnight as the word in every locale, tonight’s as today, never in figures', () => {
    const evening = Date.parse('2026-11-02T20:00:00Z')
    for (const [locale, zone, at] of [
      ['en-GB', 'Europe/London', '2026-11-03T00:00:00Z'],
      ['en-US', 'Europe/London', '2026-11-03T00:00:00Z'],
      ['de-DE', 'Europe/Berlin', '2026-11-02T23:00:00Z'],
      ['fr-FR', 'Europe/Paris', '2026-11-02T23:00:00Z'],
      ['pt-PT', 'Europe/Lisbon', '2026-11-03T00:00:00Z'],
      ['ja-JP', 'Asia/Tokyo', '2026-11-03T15:00:00Z'],
    ] as const) {
      const now = zone === 'Asia/Tokyo' ? Date.parse('2026-11-03T10:00:00Z') : evening
      expect(words(at, now, locale, zone), `${locale} ${zone}`).toEqual({ date: '', time: null })
      // A midnight two nights on carries the day it ends.
      const later = new Date(Date.parse(at) + 86_400_000).toISOString()
      const b = words(later, now, locale, zone)!
      expect(b.time).toBeNull()
      expect(b.date).not.toBe('')
      expect(`${b.date} ${b.time ?? ''}`).not.toMatch(FIGURED)
    }
    // A minute either side is a time, and still never midnight's figures.
    for (const [locale, zone] of [['en-GB', 'Europe/London'], ['de-DE', 'UTC'], ['fr-FR', 'UTC'], ['pt-PT', 'UTC'], ['ja-JP', 'UTC'], ['en-US', 'UTC']] as const) {
      for (const at of ['2026-11-02T23:59:00Z', '2026-11-03T00:01:00Z']) {
        const b = words(at, evening, locale, zone)!
        expect(b.time, `${locale} ${at}`).not.toBeNull()
        expect(`${b.date} ${b.time}`).not.toMatch(FIGURED)
      }
    }
  })

  it('sets the time apart in right-to-left prose', () => {
    const b = resets('2026-11-02T17:00:00Z', Date.parse('2026-11-02T13:00:00Z'), format('ar-EG'), 'Africa/Cairo')!
    expect(b.time).toMatch(/^⁨.+⁩$/)
  })

  it('is null for no instant, one passed, or one that is not RFC 3339 with its offset', () => {
    for (const iso of [null, '', 'soon', '2', '12', 'soon 3', '1793638800', '2026-10-07T17:00:00', '2026-10-08', 'Wed, 07 Oct 2026 17:00:00 GMT', '+275761-01-01T00:00:00Z'])
      expect(resets(iso, NOW, en), String(iso)).toBeNull()
    expect(resets('2026-10-07T11:00:00Z', NOW, en)).toBeNull()
    expect(resets('2026-10-07T12:00:00Z', NOW, en)).toBeNull()
  })
})
