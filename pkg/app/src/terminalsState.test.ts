import { describe, expect, test } from 'vitest'
import { showCalmEmpty } from './terminalsState'

describe('the Tabs page before its workspace', () => {
  const base = { token: 'tk', read: false, error: false, hosts: 0, opened: false }

  test('signed out always shows the signed-out screen, even after a workspace was opened', () => {
    expect(showCalmEmpty({ ...base, token: null })).toBe(true)
    expect(showCalmEmpty({ ...base, token: null, opened: true })).toBe(true)
  })

  test('signed in: empty machines show it until a workspace is opened; loading shows neither', () => {
    expect(showCalmEmpty({ ...base, read: true })).toBe(true)
    expect(showCalmEmpty({ ...base, read: true, opened: true })).toBe(false)
    expect(showCalmEmpty(base)).toBe(false)
    expect(showCalmEmpty({ ...base, read: true, error: true })).toBe(false)
  })
})
