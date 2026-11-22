import { describe, expect, test } from 'vitest'
import { conversation, localRead, partOf } from './local'

const silent = new Set(['…', 'Stopped.'])

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
    const img = partOf('dot.png', { image: 'data:image/png;base64,AA==' })
    expect(conversation([], 'What?', silent, [img, partOf('a.txt', { text: 'hi' })])).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'What?' }, img, { type: 'text', text: 'a.txt:\nhi' }] },
    ])
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
