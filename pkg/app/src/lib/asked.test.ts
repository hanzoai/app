import { describe, expect, test } from 'vitest'
import { questionOf } from './asked'

const turns = [
  { id: 'q1', role: 'user', content: 'Summarise the Murphy quote' },
  { id: 'a1', role: 'assistant', content: 'The quote is 6 kW for €9,400.' },
  { id: 'q2', role: 'user', content: [{ type: 'text', text: 'Draft the follow-up email' }] },
  { id: 'a2', role: 'assistant', content: 'Hi Mary, …' },
]

describe('Schedule… opens on the question', () => {
  test("an answer's Schedule takes the question just before that answer, never the answer", () => {
    expect(questionOf(turns, 'a1')).toBe('Summarise the Murphy quote')
    expect(questionOf(turns, 'a2')).toBe('Draft the follow-up email')
  })
  test("the header's Schedule takes the last question", () => {
    expect(questionOf(turns)).toBe('Draft the follow-up email')
  })
  test('with no question before it, there is nothing to schedule', () => {
    expect(questionOf(turns.slice(1), 'a1')).toBe('')
  })
})
