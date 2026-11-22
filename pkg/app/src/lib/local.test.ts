import { describe, expect, test } from 'vitest'
import { conversation } from './local'

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
})
