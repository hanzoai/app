import { describe, expect, test } from 'vitest'
import { answersActions, followUp, showCalmEmpty } from './terminalsState'

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
  const listed = [
    { machine: 'b-1', screen: true },
    { machine: 'd-1', screen: true },
  ]

  test('a terminal is not asked for twice: the workspace already opens the new machine\'s shell', () => {
    expect(followUp({ kind: 'shell', machine: 'cloud-1' }, listed)).toBeNull()
  })

  test('a browser or desktop is asked for as the new machine\'s screen, never as a page (which starts another machine)', () => {
    expect(followUp({ kind: 'page', machine: 'b-1' }, listed)).toEqual({ kind: 'desktop', machine: 'b-1' })
    expect(followUp({ kind: 'desktop', machine: 'd-1' }, listed)).toEqual({ kind: 'desktop', machine: 'd-1' })
  })

  test('until the new machine is listed with its screen, nothing is asked for (an unlisted one starts another)', () => {
    expect(followUp({ kind: 'page', machine: 'b-2' }, listed)).toBe('wait')
    expect(followUp({ kind: 'desktop', machine: 'd-1' }, [{ machine: 'd-1' }])).toBe('wait')
  })
})

describe('a sidebar Tabs action', () => {
  test('is the page\'s to answer only while no Workspace is drawn, so one press leases one machine', () => {
    expect(answersActions({ calm: true, read: true, error: false })).toBe(true)
    expect(answersActions({ calm: false, read: false, error: false })).toBe(true)
    expect(answersActions({ calm: false, read: true, error: false })).toBe(false)
    expect(answersActions({ calm: false, read: false, error: true }), 'the machine list failed: the Workspace answers').toBe(false)
  })
})
