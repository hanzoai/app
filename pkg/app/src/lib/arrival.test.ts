import { describe, expect, it } from 'vitest'
import { arrival } from './arrival'

describe('arrival', () => {
  it('waits until there is a bucket to open', () => {
    expect(arrival(false, null, null)).toEqual({ done: false, open: null })
  })
  it('opens the first bucket on arrival', () => {
    expect(arrival(false, null, 'files')).toEqual({ done: true, open: 'files' })
  })
  it('does not open again once the reader has gone back to the root list', () => {
    expect(arrival(true, null, 'files')).toEqual({ done: true, open: null })
  })
  it('leaves a bucket the reader already opened alone', () => {
    expect(arrival(false, 'mine', 'files')).toEqual({ done: true, open: null })
  })
})
