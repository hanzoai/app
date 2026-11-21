import { describe, expect, test } from 'vitest'
import { ELSE, NEW_FOR, ROLES, SKILLS, SKIP, answered, fresh, listed, nameOf, picked, recommended, role, tool } from './roles'

// The catalogue's name rule (cloud apps/tools NAME, @hanzo/build api/skills NAME).
const NAME = /^[a-z0-9][a-z0-9_-]{0,63}$/

describe('the role → skills map (hanzo-inc/app issue 323)', () => {
  test('offers Director, Marketing and Education among its roles, then Something else', () => {
    const ids = ROLES.map((r) => r.id)
    expect(ids).toEqual(expect.arrayContaining(['director', 'marketing', 'education']))
    expect(new Set([...ids, ELSE.id]).size).toBe(ids.length + 1)
    expect(ids).not.toContain(SKIP)
    expect(ELSE.label).toBe('Something else')
  })

  test('every role recommends a handful of skills, each named once, each with a label', () => {
    for (const r of [...ROLES, ELSE]) {
      expect(r.label, r.id).toBeTruthy()
      expect(r.line, r.id).toBeTruthy()
      expect(r.skills.length, r.id).toBeGreaterThanOrEqual(4)
      expect(r.skills.length, r.id).toBeLessThanOrEqual(10)
      expect(new Set(r.skills).size, r.id).toBe(r.skills.length)
      for (const n of r.skills) expect(SKILLS[n], `${r.id}: ${n}`).toBeTruthy()
    }
  })

  test('names catalogue skills: a service and a thing, by the catalogue’s own rule, never a built-in or the + shelf’s list', () => {
    for (const n of recommended()) {
      expect(n).toMatch(NAME)
      expect(n, n).toMatch(/^[a-z0-9]+_[a-z0-9_]+$/)
    }
    // Every label is for a skill a role recommends: no orphans to keep in step.
    expect(Object.keys(SKILLS).sort()).toEqual(recommended().sort())
  })

  test('reads an answer back: a role, Something else, Skip, or none', () => {
    expect(role('marketing')?.id).toBe('marketing')
    expect(role('else')).toBe(ELSE)
    expect(role(SKIP)).toBeNull()
    expect(role('')).toBeNull()
    expect(role('astronaut')).toBeNull()
    expect(role(undefined)).toBeNull()
    expect(answered('director')).toBe(true)
    expect(answered('else')).toBe(true)
    expect(answered(SKIP)).toBe(true)
    expect(answered('')).toBe(false)
    expect(answered('retired-role')).toBe(false)
  })

  test('a skill is switched on by its tool, skill_<name>', () => {
    expect(tool('marketing_campaigns')).toBe('skill_marketing_campaigns')
    expect(nameOf('skill_marketing_campaigns')).toBe('marketing_campaigns')
    expect(nameOf('cloud_get_ping')).toBe('')
  })
})

describe('what one click adds', () => {
  const marketing = role('marketing')!

  test('lists every recommended skill until the tool plane answers, then only the ones it lists', () => {
    expect(listed(marketing, null)).toEqual([...marketing.skills])
    const plane = new Set(marketing.skills.filter((n) => n !== 'email_stats'))
    expect(listed(marketing, plane)).toEqual(marketing.skills.filter((n) => n !== 'email_stats'))
    expect(listed(marketing, new Set())).toEqual([])
  })

  test('adds what is shown, less what the person unticked and what is already on', () => {
    const shown = listed(marketing, null)
    expect(picked(shown, new Set())).toEqual(shown)
    expect(picked(shown, new Set(['social_posts', 'ad_summary']))).toEqual(shown.filter((n) => n !== 'social_posts'))
    expect(picked(shown, new Set(['social_posts']), new Set(['marketing_campaigns']))).toEqual(
      shown.filter((n) => n !== 'social_posts' && n !== 'marketing_campaigns'),
    )
    expect(picked(shown, new Set(shown))).toEqual([])
  })
})

describe('who the card asks', () => {
  const now = Date.parse('2026-11-21T00:00:00Z')

  test('an account made in the last two weeks', () => {
    expect(fresh('2026-11-20T23:00:00Z', now)).toBe(true)
    expect(fresh(new Date(now - NEW_FOR + 60_000).toISOString(), now)).toBe(true)
    // A clock a little ahead of IAM's still reads a new account as new.
    expect(fresh('2026-11-21T00:02:00Z', now)).toBe(true)
  })

  test('never an older account, or one whose age is unknown', () => {
    expect(fresh(new Date(now - NEW_FOR - 60_000).toISOString(), now)).toBe(false)
    expect(fresh('2025-01-01T00:00:00Z', now)).toBe(false)
    expect(fresh(undefined, now)).toBe(false)
    expect(fresh('', now)).toBe(false)
    expect(fresh('not a date', now)).toBe(false)
  })
})
