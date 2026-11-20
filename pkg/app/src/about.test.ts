import { describe, expect, test } from 'vitest'
import { ABOUT, about } from './about'
import { TEAM } from './team'

const text = about('Hanzo', TEAM)

describe('what Chat tells the model about the app', () => {
  test('names every agent with its role and what it owns, the leads apart from the rest (issue 441)', () => {
    for (const one of TEAM) expect(text).toContain(`- ${one.name} (${one.role}): ${one.owns}`)
    const leads = text.indexOf('These lead the team')
    const rest = text.indexOf('These can also run on their own')
    expect(leads).toBeGreaterThan(0)
    expect(rest).toBeGreaterThan(leads)
    for (const one of TEAM) {
      const at = text.indexOf(`- ${one.name} (`)
      expect(one.lead ? at > leads && at < rest : at > rest).toBe(true)
    }
    // The ones zeekay asked about, by name.
    for (const name of ['Dev', 'Des', 'Vi']) expect(text).toContain(`- ${name} (`)
  })

  test('answers the product question rather than refusing it (issue 441)', () => {
    expect(text).toMatch(/^You are answering in Hanzo Chat\./)
    expect(text).toContain('never say you have no access to it')
  })

  test('calls the place a page opens the Preview, and nothing else (issue 443)', () => {
    expect(text).toContain('Call that place "the Preview"')
    expect(text).toContain('Never send the person to a panel, tab or button by any other name')
    expect(text).not.toMatch(/Output panel/)
  })

  test('asks before a large build nobody described (issue 442)', () => {
    expect(text).toContain('Ask one or two short questions first')
    expect(text).toMatch(/what it is for, who it is for, or what it should contain/)
  })

  test('speaks of the host by its own name', () => {
    expect(about('Hanzo Team', TEAM)).toMatch(/^You are answering in Hanzo Team Chat\./)
    expect(ABOUT).toBe('about')
  })
})
