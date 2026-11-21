import { describe, expect, test } from 'vitest'
import { followUp, showCalmEmpty } from './terminalsState'

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

describe('after the page starts a cloud machine', () => {
  test('a terminal is not asked for twice: the workspace already opens the new machine\'s shell', () => {
    expect(followUp({ kind: 'shell', machine: 'cloud-1' })).toBeNull()
  })

  test('a browser or desktop is still asked for', () => {
    expect(followUp({ kind: 'page', machine: 'b-1' })).toEqual({ kind: 'page', machine: 'b-1' })
    expect(followUp({ kind: 'desktop', machine: 'd-1' })).toEqual({ kind: 'desktop', machine: 'd-1' })
  })
})
