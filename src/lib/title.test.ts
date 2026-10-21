import { describe, expect, test } from 'vitest'
import { given, tidy } from './title'

describe('tidy', () => {
  test('a plain title stays, trimmed and single-spaced', () => {
    expect(tidy('  what is   hanzo ai? ')).toBe('what is hanzo ai?')
  })
  test('a first message that opened with workspace markup shows its words alone', () => {
    expect(tidy('<workspace-files> {"attached":[{"id":"ff69b19e","name":"app.jpg"}]} </workspace-files> look at this')).toBe('look at this')
    expect(tidy('<workspace-files>{"attached":[]}</workspace-files>')).toBe('Untitled')
  })
  test('a leading JSON object goes whole, nested braces included', () => {
    expect(tidy('{"a":{"b":1},"c":"}"} then the question')).toBe('then the question')
  })
  test('a long title is cut with an ellipsis at the limit', () => {
    const t = tidy('x'.repeat(100), 20)
    expect(t).toHaveLength(20)
    expect(t.endsWith('…')).toBe(true)
  })
  test('nothing readable is the fallback', () => {
    expect(tidy('')).toBe('Untitled')
    expect(tidy(null, 40, 'Untitled run')).toBe('Untitled run')
  })
})

describe('given', () => {
  test('the first word of a display name, its first letter capitalised', () => {
    expect(given('z')).toBe('Z')
    expect(given(' ada lovelace ')).toBe('Ada')
    expect(given('Zach Kelling')).toBe('Zach')
    expect(given('')).toBe('')
    expect(given('   ')).toBe('')
  })
})
