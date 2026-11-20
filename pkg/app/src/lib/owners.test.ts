import { describe, expect, it } from 'vitest'
import { owners } from './owners'

describe('owners', () => {
  it('lets only the first mounted answer, so a trigger opens one dialog', () => {
    const o = owners()
    const left = o.claim('shell')
    o.claim('chat')
    expect(o.owns('shell')).toBe(true)
    expect(o.owns('chat')).toBe(false)
    left()
    expect(o.owns('chat')).toBe(true)
  })
})
