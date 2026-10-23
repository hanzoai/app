import { describe, expect, test } from 'vitest'
import { hold, standing, transient, type Tier } from './tier'

const live = { tier: { name: 'dev', displayName: 'Pro' } } as unknown as Tier
const status = (n: number) => Object.assign(new Error(`Billing answered ${n}`), { status: n })
const offline = new TypeError('Failed to fetch')

describe('a failed read that may answer otherwise next time', () => {
  test('no answer at all, a timeout, or billing failing is transient', () => {
    for (const e of [offline, status(408), status(429), status(500), status(502), status(503), status(504)]) expect(transient(e), String(e)).toBe(true)
  })

  test("billing's refusal stands", () => {
    for (const n of [401, 403, 404]) expect(transient(status(n)), String(n)).toBe(false)
  })
})

describe('the tier a read leaves held', () => {
  const read = { org: 'acme', tier: live }

  test('a read that answers is the tier, and the one a later failure falls back on', () => {
    expect(hold(null, 'acme', { tier: live })).toEqual({ tier: live, wrong: null, last: read })
  })

  test('a re-read that fails for a moment after a live plan keeps the plan', () => {
    for (const wrong of [offline, status(429), status(502), status(503)]) expect(hold(read, 'acme', { wrong })).toEqual({ tier: live, wrong: null, last: read })
  })

  test("billing's refusal on a re-read shuts the gate, whatever was read before", () => {
    for (const n of [401, 403, 404]) {
      const wrong = status(n)
      expect(hold(read, 'acme', { wrong })).toEqual({ tier: null, wrong, last: null })
    }
  })

  test('a refusal is not undone by a failure after it: 200, then 403, then offline holds nothing', () => {
    let last = hold(null, 'acme', { tier: live }).last
    const refused = hold(last, 'acme', { wrong: status(403) })
    last = refused.last
    expect(refused.tier).toBeNull()
    const after = hold(last, 'acme', { wrong: offline })
    expect(after).toEqual({ tier: null, wrong: offline, last: null })
  })

  test('a read that fails with nothing read yet holds nothing, and says why', () => {
    expect(hold(null, 'acme', { wrong: offline })).toEqual({ tier: null, wrong: offline, last: null })
  })

  test("another organization's plan is never kept for this one", () => {
    expect(hold(read, 'beta', { wrong: offline }).tier).toBeNull()
  })
})

describe('the tier shown is the organization in use', () => {
  test("what was read for this organization is shown", () => {
    expect(standing({ org: 'acme', tier: live, wrong: null }, 'acme')).toEqual({ tier: live, wrong: null })
  })

  test('a switch to another organization shows nothing until it is read', () => {
    expect(standing({ org: 'acme', tier: live, wrong: null }, 'free-team')).toEqual({ tier: null, wrong: null })
    expect(standing({ org: 'acme', tier: null, wrong: status(502) }, 'free-team')).toEqual({ tier: null, wrong: null })
  })

  test('nothing read shows nothing', () => {
    expect(standing(null, 'acme')).toEqual({ tier: null, wrong: null })
  })
})
