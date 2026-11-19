import { describe, expect, it } from 'vitest'
import { landing } from './landing'

describe('landing', () => {
  it('waits until there is a bucket to open', () => {
    expect(landing(false, null, null)).toEqual({ done: false, open: null })
  })
  it('opens the first bucket on arrival', () => {
    expect(landing(false, null, 'files')).toEqual({ done: true, open: 'files' })
  })
  it('does not open again once the reader has gone back to the root list', () => {
    expect(landing(true, null, 'files')).toEqual({ done: true, open: null })
  })
  it('leaves a bucket the reader already opened alone', () => {
    expect(landing(false, 'mine', 'files')).toEqual({ done: true, open: null })
  })
})
