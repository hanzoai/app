import { describe, expect, test } from 'vitest'
import { ended, why } from './unanswered'

describe('a question left without an answer', () => {
  const turn = { was: true, streaming: false, error: null, blank: true, stopping: false }
  test('after Stop is the person\'s stop, never "answered with nothing"', () => {
    const left = ended({ ...turn, stopping: true })
    expect(left).toEqual({ error: null, stopped: true })
    expect(why(left!)).toBe('stopped')
  })
  test('with no Stop, an empty answer is the model\'s', () => {
    expect(why(ended(turn)!)).toBe('empty')
  })
  test('a turn that answered, still streams, or was refused leaves nothing to say here', () => {
    for (const t of [{ ...turn, blank: false }, { ...turn, streaming: true }, { ...turn, was: false }, { ...turn, error: new Error('no') }]) expect(ended(t)).toBeNull()
  })
  test('each other reason keeps its sentence', () => {
    expect(why(undefined)).toBe('gone')
    expect(why({ error: null, stalled: true })).toBe('stalled')
    expect(why({ error: new Error('refused') })).toBe('refused')
  })
})
