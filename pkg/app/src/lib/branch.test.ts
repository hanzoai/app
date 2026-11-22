import { describe, expect, it } from 'vitest'
import { branchName, branched } from './branch'

const chat = [
  { id: 'u1', role: 'user', content: 'hi' },
  { id: 'a1', role: 'assistant', content: 'hello' },
  { id: 'u2', role: 'user', content: 'more' },
  { id: 's', role: 'system', content: 'x' },
]
const text = (m: (typeof chat)[number]) => m.content

describe('branched', () => {
  it('keeps the chat up to the answer, user and assistant turns only', () => {
    expect(branched(chat, 'a1', text, {})).toEqual([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }])
  })
  it('saves nothing for an anonymous chat, or a private one', () => {
    expect(branched(chat, 'a1', text, { anonymous: true })).toBeNull()
    expect(branched(chat, 'a1', text, { forgetful: true })).toBeNull()
  })
  it('saves nothing for an empty chat', () => {
    expect(branched([{ id: 's', role: 'system', content: 'x' }], 's', text, {})).toBeNull()
  })
})

describe('a branch', () => {
  it('is named as a branch of its chat, never the same title', () => {
    expect(branchName('Murphy quote')).toBe('Murphy quote (branch)')
    expect(branchName('Murphy quote')).not.toBe('Murphy quote')
  })
})

