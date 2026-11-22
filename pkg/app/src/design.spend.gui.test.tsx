// Design and Flow (@hanzo/studio, patched in patches/@hanzo__studio@0.1.12.patch) ask the app's one
// spend confirm (`host.spend`, Confirm.tsx `useMaking`) where each paid call starts, naming how many
// pictures it makes. A no starts nothing: no request leaves, and the turn ends without asking the model
// to try something else.
import { afterEach, describe, expect, test, vi } from 'vitest'
import { picture } from '../node_modules/@hanzo/studio/lib/kinds/image.js'
import { video } from '../node_modules/@hanzo/studio/lib/kinds/video.js'
import { turn } from '../node_modules/@hanzo/studio/lib/chat/turn.js'
import { blank } from '../node_modules/@hanzo/studio/lib/made.js'

const wire = { api: 'https://api.test', engine: '', token: () => 't', org: 'o' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const PNG = btoa('png')

function work(spend: (kind: string, asked?: { title?: string; what?: string }) => Promise<boolean>, extra: Record<string, unknown> = {}) {
  const kept: string[] = []
  return {
    kept,
    w: {
      wire,
      signal: new AbortController().signal,
      doing: () => undefined,
      missed: () => undefined,
      keep: async (name: string) => {
        kept.push(name)
        return { key: name, mime: 'image/png', name }
      },
      picture: async () => '',
      find: () => null,
      brand: null,
      fleet: null,
      models: [],
      writer: 'w',
      spend,
      ...extra,
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('a picture', () => {
  test('asks once before drawing, says how many it makes, and draws that many on a yes', async () => {
    const fetch = vi.fn(async () => json({ data: [{ b64_json: PNG }] }))
    vi.stubGlobal('fetch', fetch)
    const spend = vi.fn(async (_kind: string, _asked?: unknown) => true)
    const { w, kept } = work(spend)
    await picture(w as never, { prompt: 'a cup', aspect: '1:1', model: 'iro', count: 4 })
    expect(spend).toHaveBeenCalledTimes(1)
    expect(spend).toHaveBeenCalledWith('design-image', { title: 'Make 4 pictures?', what: 'This makes 4 pictures.' })
    expect(kept).toHaveLength(4)
  })

  test('a no draws nothing and sends nothing', async () => {
    const fetch = vi.fn(async () => json({}))
    vi.stubGlobal('fetch', fetch)
    const { w, kept } = work(async () => false)
    await expect(picture(w as never, { prompt: 'a cup', aspect: '1:1', model: 'iro', count: 1 })).rejects.toMatchObject({ name: 'Declined' })
    expect(fetch).not.toHaveBeenCalled()
    expect(kept).toEqual([])
  })

  test("a picture on the org's GPU is the GPU's kind, which is asked every time", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({})))
    const spend = vi.fn(async (_kind: string, _asked?: unknown) => false)
    const { w } = work(spend, { fleet: { nodes: [{ id: 'g', online: true, lanes: ['image.zen'] }] } })
    await expect(picture(w as never, { prompt: 'a cup', aspect: '1:1', model: 'auto', count: 1 })).rejects.toMatchObject({ name: 'Declined' })
    expect(spend.mock.calls[0][0]).toBe('design-gpu')
  })
})

describe('a clip', () => {
  test("from the gateway is the video kind, and a no sends nothing", async () => {
    const fetch = vi.fn(async () => json({}))
    vi.stubGlobal('fetch', fetch)
    const spend = vi.fn(async (_kind: string, _asked?: unknown) => false)
    const { w } = work(spend, { models: [{ id: 'sora', name: 'Sora', inputs: ['text'], outputs: ['video'] }] })
    await expect(video.make(w as never, { title: 'Cup', prompt: 'a cup turning', seconds: 4 })).rejects.toMatchObject({ name: 'Declined' })
    expect(spend.mock.calls[0][0]).toBe('design-video')
    expect(spend.mock.calls[0][1]).toMatchObject({ what: expect.stringContaining('4-second clip') })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('Send, Redraw and Try again', () => {
  test('a no to the picture ends the turn on "Not started." and the model is not asked again', async () => {
    const seen: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = new URL(url).pathname
        seen.push(path)
        return json({
          model: 'brain',
          choices: [{ message: { content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'make_image', arguments: JSON.stringify({ prompt: 'a cup', title: 'Cup', count: 4 }) } }] } }],
        })
      }),
    )
    const spend = vi.fn(async (_kind: string, _asked?: unknown) => false)
    const end = await turn(blank(), { text: 'a cup', attached: [] }, {
      wire,
      brain: 'brain',
      writer: 'w',
      fleet: null,
      models: [],
      order: () => [],
      show: () => undefined,
      changed: () => undefined,
      signal: new AbortController().signal,
      spend,
    } as never)
    expect(spend).toHaveBeenCalledWith('design-image', { title: 'Make 4 pictures?', what: 'This makes 4 pictures.' })
    const said = end.turns.at(-1)
    expect(said.text).toBe('Not started.')
    expect(said.failed).toBeUndefined()
    expect(end.made).toEqual([])
    expect(seen).toEqual(['/v1/chat/completions'])
  })
})

