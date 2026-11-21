// Design's words (@hanzo/studio, patched in patches/@hanzo__studio@0.1.12.patch): an upload that failed is one
// plain sentence (never the server's text) about a file that was left out, and Upload image attaches the
// picture without writing a request of its own into the composer.
import { createElement } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount, tap, type Mounted } from '../vitest.real'
import { uploadFailure } from '../node_modules/@hanzo/studio/lib/attach.js'
import { Home } from '../node_modules/@hanzo/studio/lib/home.js'
import { StudioHost } from '../node_modules/@hanzo/studio/lib/host.js'

let at: Mounted
afterEach(async () => {
  await at?.done()
})

describe('a failed upload', () => {
  test('is one sentence that names the file and says it was left out', () => {
    expect(uploadFailure([])).toBe('')
    const said = uploadFailure(['cup.png'])
    expect(said).toBe('“cup.png” could not be attached, so it was left out: attach it again to retry.')
    expect(said.split(/[.!?](\s|$)/).filter((p) => p.trim()).length).toBe(1)
    expect(uploadFailure(['a.png', 'b.png'])).toMatch(/^2 files could not be attached/)
  })
})

describe('Upload image', () => {
  test('attaches a picture and fills in no request', async () => {
    const onUpload = vi.fn()
    at = await mount()
    const host = { name: 'Design', api: 'https://api.test', token: () => 't', org: 'acme', person: null, admin: false, path: '', go: () => undefined, open: () => undefined, links: { github: '', customize: '', settings: '', home: '' } }
    await at.draw(createElement(StudioHost, { host } as never, createElement(Home, { available: { fleet: null, models: [] }, onStart: () => undefined, onUpload } as never)))
    const trigger = [...document.querySelectorAll<HTMLElement>('button, [role="button"]')].find((b) => b.textContent?.trim() === 'Upload')!
    await tap(trigger)
    const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((m) => m.textContent?.includes('Upload image'))!
    expect(item.textContent).toContain('Attach a picture to your message')
    await tap(item)
    expect(onUpload).toHaveBeenCalledTimes(1)
    const [accept, prompt, kind] = onUpload.mock.calls[0]
    expect(accept).toContain('image/*')
    expect(prompt).toBeUndefined()
    expect(kind).toBeUndefined()
  })
})
