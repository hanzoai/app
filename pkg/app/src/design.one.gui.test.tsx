// One way to each place (@hanzo/studio, patched in patches/@hanzo__studio@0.1.12.patch): Design keeps no
// Library of its own (the app's one Library lists what it made), Flow has one canvas behind one link, and
// Flow's way back is to Design, the screen Studio was a second name for.
import { createElement } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount, tap, type Mounted } from '../vitest.real'
import { FlowStudio, flowNav, nav, route } from '@hanzo/studio'

let at: Mounted
afterEach(async () => {
  await at?.done()
  vi.unstubAllGlobals()
})

const host = (open = vi.fn()) => ({ name: 'Design', api: 'https://api.test', token: () => 't', org: 'acme', person: { name: 'Ada', email: 'a@x', avatar: '' }, admin: false, path: '', go: () => undefined, open, links: { github: '', customize: '', settings: '', home: '' } })

describe("Design's places", () => {
  test('list no Library, and no address of Design is a Library', () => {
    const links = nav(host() as never, () => undefined).flatMap((g) => g.links.map((l) => l.id))
    expect(links).not.toContain('library')
    expect(route('library')).toEqual({ kind: 'new' })
  })
})

describe('Flow', () => {
  test('has one link, its canvas', () => {
    expect(flowNav(host() as never, () => undefined).flatMap((g) => g.links.map((l) => l.id))).toEqual(['canvas'])
  })

  test('draws no second strip of the same sections, and goes back to Design', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { headers: { 'content-type': 'application/json' } })))
    const open = vi.fn()
    at = await mount()
    await at.draw(createElement(FlowStudio, { host: host(open) } as never))
    expect(document.querySelector('[aria-label="Flow sections"]')).toBeNull()
    await tap(document.querySelector('[aria-label="Back to Design"]')!)
    expect(open).toHaveBeenCalledWith('/design')
  })
})
