// Design and Flow (@hanzo/studio, patched in patches/@hanzo__studio@0.1.12.patch) draw no control that pretends:
// no "Save Python component" that kept nothing, no "Publish" that published nothing, no "Copy link" to an
// address nobody else can open; and a Flow edit outlives leaving the page, as the page says.
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, tap, type Mounted } from '../vitest.real'
import { FlowStudio, flowNav } from '@hanzo/studio'
import { Desk } from '../node_modules/@hanzo/studio/lib/desk.js'
import { StudioHost } from '../node_modules/@hanzo/studio/lib/host.js'

let at: Mounted
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async () => json({})))
})
afterEach(async () => {
  await at?.done()
  vi.unstubAllGlobals()
})

const host = { name: 'Flow', api: 'https://api.test', token: () => 't', org: 'acme', person: { name: 'Ada', email: 'a@x', avatar: '' }, admin: false, path: '', go: () => undefined, open: () => undefined, links: { github: '', customize: '', settings: '', home: '' }, spend: async () => true }
const words = () => document.body.textContent ?? ''
const buttons = () => [...document.querySelectorAll<HTMLElement>('button, [role="button"], [role="tab"]')].map((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim())

describe('Flow', () => {
  test('has no Python editor and no Publish, in the page or the sidebar', async () => {
    at = await mount()
    await at.draw(createElement(FlowStudio, { host } as never))
    expect(words()).not.toContain('Save Python component')
    expect(words()).not.toContain('Edit Python')
    expect(buttons().filter((b) => /publish|python/i.test(b))).toEqual([])
    const links = flowNav(host as never, () => undefined).flatMap((g) => g.links.map((l) => l.id))
    expect(links).not.toContain('code')
    expect(links).not.toContain('publish')
  })

  test('an edit is kept in this browser and is there when Flow opens again', async () => {
    at = await mount()
    await at.draw(createElement(FlowStudio, { host } as never))
    expect(words()).toContain('Your flows are kept in this browser.')
    const count = () => document.querySelectorAll('[data-flow-node], [data-slot="flow-node"]').length || (words().match(/(\d+) nodes \(/)?.[1] ?? '')
    const before = count()
    const add = [...document.querySelectorAll<HTMLElement>('button')].find((b) => (b.textContent ?? '').startsWith('+ '))!
    await tap(add)
    const after = count()
    expect(after).not.toBe(before)
    await at.done()
    at = await mount()
    await at.draw(createElement(FlowStudio, { host } as never))
    expect(count()).toBe(after)
  })
})

describe("Design's Export", () => {
  test('offers no Copy link', async () => {
    const made = {
      id: 'm1',
      kind: 'image',
      title: 'Cup',
      at: 0,
      versions: [{ id: 'v1', at: 1, spec: { prompt: 'a cup', aspect: '1:1' }, files: [{ key: 'files/image/c/m1/v1/image-1.png', mime: 'image/png', name: 'image-1.png' }], note: 'a cup', by: 'Iro 1' }],
    }
    at = await mount()
    await at.draw(
      createElement(StudioHost, { host } as never, createElement(Desk, { made, wire: { api: 'https://api.test', engine: '', token: () => 't', org: 'acme' }, others: [], onPick: () => undefined, onEdit: () => undefined, busy: false } as never)),
    )
    const exporting = [...document.querySelectorAll<HTMLElement>('[aria-label="Export"]')][0]
    expect(exporting).toBeTruthy()
    await tap(exporting)
    expect(buttons()).toContain('Download')
    expect(buttons().filter((b) => /copy link|link copied/i.test(b))).toEqual([])
  })
})
