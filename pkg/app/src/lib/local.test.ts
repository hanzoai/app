import { describe, expect, test } from 'vitest'
import { conversation, localRead, partOf } from './local'

const quiet = new Set(['…', 'Stopped.'])
const silent = (said: string) => quiet.has(said)
const file = (name: string) => ({ id: name, name, type: 'text/plain', size: 2 })

describe('the conversation a host engine is asked to continue', () => {
  test('is every turn that said something, then the new question', () => {
    const held = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: [{ type: 'text', text: 'Hello' }, { type: 'text', text: ' there' }] },
      { role: 'user', content: 'Stop me' },
      { role: 'assistant', content: 'Stopped.' },
      { role: 'user', content: 'Again' },
      { role: 'assistant', content: '…' },
      { role: 'system', content: 'ignored' },
    ]
    expect(conversation(held, 'What now?', silent)).toEqual([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello there' },
      { role: 'user', content: 'Stop me' },
      { role: 'user', content: 'Again' },
      { role: 'user', content: 'What now?' },
    ])
  })

  test('a first question is the whole conversation', () => {
    expect(conversation([], 'Hi', silent)).toEqual([{ role: 'user', content: 'Hi' }])
  })

  test('files that came with the question join it as parts', () => {
    const img = partOf(file('dot.png'), { image: 'data:image/png;base64,AA==' })
    expect(conversation([], 'What?', silent, [img, partOf(file('a.txt'), { text: 'hi' })])).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'What?' }, img, { type: 'text', text: 'a.txt:\nhi', file: file('a.txt') }] },
    ])
  })
})

describe('files in the conversation', () => {
  test('an earlier question keeps its files, and a long text file says it was cut', () => {
    const had = [{ type: 'text', text: 'Read this' }, partOf(file('a.txt'), { text: 'x'.repeat(100_001) })]
    const turns = conversation([{ role: 'user', content: had }, { role: 'assistant', content: 'Done.' }], 'And?', silent)
    expect(turns[0]).toEqual({ role: 'user', content: had })
    expect(had[1]).toMatchObject({ text: expect.stringMatching(/^a\.txt \(first 100,000 characters\):\n/) })
    expect((had[1] as { text: string }).text.length).toBeLessThan(100_100)
    expect(partOf(file('b.txt'), { text: 'short' })).toMatchObject({ text: 'b.txt:\nshort' })
  })
})

describe('what a signed-out reader can attach', () => {
  test('pictures and text are read here, anything else says to sign in, and big ones say too large', () => {
    expect(localRead({ name: 'a.png', type: 'image/png', size: 10 })).toBe('image')
    expect(localRead({ name: 'a.md', type: '', size: 10 })).toBe('text')
    expect(localRead({ name: 'a.pdf', type: 'application/pdf', size: 10 })).toMatch(/^Sign in to attach a\.pdf/)
    expect(localRead({ name: 'a.txt', type: 'text/plain', size: 2 * 1024 * 1024 })).toMatch(/too large/)
  })
})
