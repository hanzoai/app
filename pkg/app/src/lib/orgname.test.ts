import { describe, expect, test } from 'vitest'
import { LONGEST, matches, refusal, slugify } from './orgname'

describe('an organization name', () => {
  test('a display name suggests the slug IAM onboarding makes of it', () => {
    expect(slugify('Acme Inc.')).toBe('acme-inc')
    expect(slugify('  --Hanzo   AI--  ')).toBe('hanzo-ai')
    expect(slugify('Zoo Labs 2')).toBe('zoo-labs-2')
    expect(slugify('Café')).toBe('caf')
    expect(slugify('日本')).toBe('')
    expect(slugify('a'.repeat(54) + ' b')).toBe('a'.repeat(54))
    expect(slugify('x'.repeat(80))).toHaveLength(LONGEST)
  })

  test('a slug IAM keeps as typed is taken; anything else is refused, never folded', () => {
    expect(refusal('acme')).toBeNull()
    expect(refusal('acme-inc-2')).toBeNull()
    expect(refusal('a')).not.toBeNull()
    expect(refusal('Acme')).not.toBeNull()
    expect(refusal('acme inc')).not.toBeNull()
    expect(refusal('-acme')).not.toBeNull()
    expect(refusal('acme-')).not.toBeNull()
    expect(refusal('acme--inc')).not.toBeNull()
    expect(refusal('acme_inc')).not.toBeNull()
    expect(refusal('x'.repeat(LONGEST + 1))).not.toBeNull()
    // Every suggestion of a name long enough is one IAM keeps as it is.
    for (const name of ['Acme Inc.', 'Hanzo AI', 'zoo-labs', 'Pars 2026']) expect(refusal(slugify(name))).toBeNull()
  })

  test('a search matches the slug or the display name, in any case', () => {
    const webby = { name: 'webby-ai', display: 'Webby AI' }
    expect(matches(webby, '')).toBe(true)
    expect(matches(webby, 'WEBBY')).toBe(true)
    expect(matches(webby, 'by-a')).toBe(true)
    expect(matches(webby, 'by a')).toBe(true)
    expect(matches(webby, 'zoo')).toBe(false)
  })
})
