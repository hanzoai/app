import { describe, expect, test } from 'vitest'
import { buildNote, CLARIFY_NOTE, DEMO_NOTE, isInteractiveDemo, isUnderspecifiedBuild } from './demo'

describe('buildNote (issue 442)', () => {
  test('the reported repro asks first instead of building', () => {
    const note = buildNote('Build a landing page with Dev')
    expect(note).toBe(CLARIFY_NOTE)
    expect(note).toContain('Ask one or two short questions first')
    expect(note).not.toContain('Hanzo AI platform showcase')
    expect(note).not.toContain('Build a complete, self-contained')
  })

  test('a bare build request asks first', () => {
    expect(isUnderspecifiedBuild('Build a landing page')).toBe(true)
    expect(isUnderspecifiedBuild('Make a website')).toBe(true)
    expect(buildNote('Build a landing page')).toBe(CLARIFY_NOTE)
  })

  test('naming only the brand is still not a brief', () => {
    expect(isUnderspecifiedBuild('Build a landing page for Hanzo AI')).toBe(true)
    expect(buildNote('Build a landing page for Hanzo AI')).toBe(CLARIFY_NOTE)
  })

  test('a described build still gets the build note', () => {
    const note = buildNote('Build a landing page for my bakery, with menu, hours, and contact')
    expect(note).toBe(DEMO_NOTE)
    expect(note).toContain('single-file HTML')
  })

  test('a dashboard with a subject still gets the build note', () => {
    expect(buildNote('Build an interactive dashboard showing weekly sales by region')).toBe(DEMO_NOTE)
  })

  test('a described Hanzo showcase still gets the build note', () => {
    expect(buildNote('Build a Hanzo AI showcase with Enso, Zen, Dev and MCP tabs')).toBe(DEMO_NOTE)
  })

  test('the thing being built is not its own description', () => {
    expect(buildNote('Build a dashboard')).toBe(CLARIFY_NOTE)
    expect(buildNote('Make a showcase')).toBe(CLARIFY_NOTE)
    expect(buildNote('Create a web app with Dev please')).toBe(CLARIFY_NOTE)
  })

  test('the question is put once: a conversation that already has an answer builds', () => {
    expect(buildNote('anything, just build a landing page')).toBe(CLARIFY_NOTE)
    expect(buildNote('anything, just build a landing page', true)).toBe(DEMO_NOTE)
    expect(buildNote('Tell me about hanzo agents', true)).toBe('')
  })

  test('a non-build turn gets no note', () => {
    expect(isInteractiveDemo('Tell me about hanzo agents')).toBe(false)
    expect(buildNote('Tell me about hanzo agents')).toBe('')
  })
})
