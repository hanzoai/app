import { describe, expect, test } from 'vitest'
import { followUp, restores, showCalmEmpty } from './terminalsState'

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

describe('a saved layout the Workspace restores instead of opening a shell', () => {
  const layout = (bind: Record<string, unknown>) => JSON.stringify({ tree: { id: 'p0' }, bind, seq: 1 })
  const live = new Set(['cloud-2'])

  test('a saved browser pane is restored, so the new machine\'s terminal is still asked for', () => {
    const saved = layout({ p0: { kind: 'page', url: 'https://example.com' } })
    expect(restores(saved, live)).toBe(true)
    expect(followUp({ kind: 'shell', machine: 'cloud-2' }, restores(saved, live))).toEqual({ kind: 'shell', machine: 'cloud-2' })
  })

  test('no layout, a corrupt one, or one whose panes are all on machines that are gone: the Workspace opens the shell itself', () => {
    expect(restores(null, live)).toBe(false)
    expect(restores('{not json', live)).toBe(false)
    expect(restores(layout({ p0: { kind: 'shell', shell: { machine: 'cloud-1', name: 'shell-1' } }, p1: { kind: 'screen', machine: 'cloud-1' } }), live)).toBe(false)
    expect(followUp({ kind: 'shell', machine: 'cloud-2' }, false)).toBeNull()
  })

  test('a pane on a machine that is still live is restored', () => {
    expect(restores(layout({ p0: { kind: 'shell', shell: { machine: 'cloud-2', name: 'shell-1' } } }), live)).toBe(true)
  })
})
