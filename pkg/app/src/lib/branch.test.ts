import { describe, expect, it } from 'vitest'
import { branched } from './branch'

const chat = [
  { id: 'u1', role: 'user', content: 'hi' },
  { id: 'a1', role: 'assistant', content: 'hello' },
  { id: 'u2', role: 'user', content: 'more' },
  { id: 's', role: 'system', content: 'x' },
]
const text = (m: (typeof chat)[number]) => m.content

describe('branched', () => {
  it('keeps the chat up to the answer, user and assistant turns only', () => {
    expect(branched(chat, 'a1', text, true)).toEqual([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }])
  })
  it('saves nothing for an anonymous or private chat', () => {
    expect(branched(chat, 'a1', text, false)).toBeNull()
  })
  it('saves nothing for an empty chat', () => {
    expect(branched([{ id: 's', role: 'system', content: 'x' }], 's', text, true)).toBeNull()
  })
})
