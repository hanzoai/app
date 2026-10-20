import { describe, expect, test } from 'vitest'
import { carrying, compose, said } from './attach'

describe('carrying', () => {
  test('a plugin’s words ride the turn and are drawn as the words alone', () => {
    const sent = carrying('Compare the two decks', 'Research notes: [1] example.com')
    expect(sent).toContain('Research notes')
    expect(said(sent)).toEqual({ text: 'Compare the two decks', carried: { attached: [], reused: [] }, cites: [] })
  })
  test('with files, one block holds the files and the plugin’s words', () => {
    const f = { id: 'f1', name: 'a.pdf', type: 'application/pdf', size: 10 }
    const sent = compose('What is it?', { attached: [f], reused: [] }, null, 'still indexing', undefined, 'PDF text: hello')
    expect(sent.match(/workspace files>/g)?.length ?? 0).toBeLessThanOrEqual(2)
    expect(said(sent).text).toBe('What is it?')
    expect(sent).toContain('PDF text: hello')
  })
})
