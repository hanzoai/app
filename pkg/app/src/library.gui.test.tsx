// The one Library (@hanzo/build's, the rail's) with an item the platform sent with no file type: it is
// listed, by its name, and nothing crashes. (Design's own Library, which called `mime.startsWith` on the raw
// row and took the whole Design screen down, is deleted; lib/library `read` gives a missing type as ''.)
import { createElement } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount, type Mounted } from '../vitest.real'
import { HostProvider, Library } from '@hanzo/dev/builder'
import { read } from './lib/library'

let at: Mounted
afterEach(async () => {
  await at?.done()
  vi.unstubAllGlobals()
})

const host = { name: 'Hanzo', api: 'https://api.test', token: () => 't', org: 'acme', person: { name: 'Ada', email: 'a@x', avatar: '' }, admin: false, path: '-/artifacts', go: () => undefined, open: () => undefined, links: { github: '', customize: '', settings: '', home: '' } }
const UNTYPED = { id: 'lib_1', kind: 'image', source: 'studio', name: 'Cup with no type' }

describe('an item with no file type', () => {
  test("is read with its type as '' by the app", () => {
    expect(read(UNTYPED)?.mime).toBe('')
  })

  test('is listed in the Library, and the Library still draws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = new URL(url).pathname
        const body = path === '/v1/library' ? { data: [UNTYPED], next: '' } : {}
        return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
      }),
    )
    at = await mount()
    await at.draw(createElement(HostProvider, { host } as never, createElement(Library)))
    await new Promise((r) => setTimeout(r, 200))
    expect(document.body.textContent).toContain('Cup with no type')
  })
})
