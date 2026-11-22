// @vitest-environment happy-dom
// A signed-out turn on a host with its own engine (`configure({ local })`): Chat sends the whole
// conversation to the host, and never to the public gateway.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Mounted } from '../vitest.real'
import { ask, drawChat, field, platform, settle, shown, type Platform } from '../vitest.chat'
import type { Turn } from './lib/local'
import { configure, where } from './where'

let at: Mounted | undefined
let api: Platform
const before = { ...where() }

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  api = platform()
})
afterEach(async () => {
  configure({ ...before, local: undefined })
  await at?.done()
  at = undefined
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('a host answers signed-out turns with its own engine', () => {
  test('each turn goes to local.chat with the whole conversation, and nothing goes to the public gateway', async () => {
    const sent: Turn[][] = []
    const chat = vi.fn(async ({ messages }: { messages: Turn[] }) => {
      sent.push(messages.map((m) => ({ ...m })))
      return sent.length === 1 ? 'Paris.' : 'About two million.'
    })
    configure({ local: { chat } })
    at = await drawChat()
    await ask('Capital of France?')
    await settle(60)
    expect(shown()).toContain('Paris.')
    await ask('And its population?')
    await settle(60)
    expect(shown()).toContain('About two million.')
    expect(sent).toEqual([
      [{ role: 'user', content: 'Capital of France?' }],
      [
        { role: 'user', content: 'Capital of France?' },
        { role: 'assistant', content: 'Paris.' },
        { role: 'user', content: 'And its population?' },
      ],
    ])
    expect(api.calls.some((c) => c.path.includes('/chat/public'))).toBe(false)
  })

  test('the fourth question is answered with no sign-in gate, past the free lane\'s limit of three', async () => {
    const chat = vi.fn(async () => 'Sure.')
    configure({ local: { chat } })
    at = await drawChat()
    for (const q of ['One?', 'Two?', 'Three?', 'Four?']) {
      await ask(q)
      await settle(60)
    }
    expect(chat).toHaveBeenCalledTimes(4)
    expect(shown()).toContain('Four?')
    expect(document.body.textContent).not.toMatch(/sign in to keep going|create a free account/i)
    expect(document.body.textContent).not.toMatch(/enso/i)
  })

  test('when the engine throws, the turn says so truthfully, with no connection claim and no sign-in gate', async () => {
    const chat = vi.fn(async () => {
      throw new Error('refused')
    })
    configure({ local: { chat } })
    at = await drawChat()
    await ask('Hello?')
    await settle(60)
    expect(shown()).toContain('Your local model did not answer. Try again.')
    expect(shown()).not.toContain('connection dropped')
    expect(document.body.textContent).not.toMatch(/sign in to keep going/i)
    expect(api.calls.some((c) => c.path.includes('/chat/public'))).toBe(false)
  })

  test('a slow on-device model is not cut off at the gateway\'s minute', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] })
    const chat = vi.fn(({ signal }: { signal: AbortSignal }) => new Promise<string>((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')))
      setTimeout(() => resolve('Worth the wait.'), 90_000)
    }))
    configure({ local: { chat } })
    at = await drawChat()
    await ask('Think hard.')
    await act(async () => void vi.advanceTimersByTime(95_000))
    await settle(60)
    expect(shown()).toContain('Worth the wait.')
    vi.useRealTimers()
  })

  test('a picture and a text file attached signed out are read here and go to local.chat as parts, and nothing is uploaded', async () => {
    const chat = vi.fn(async (_turn: { messages: Turn[] }) => 'A red dot, and a note.')
    configure({ local: { chat } })
    at = await drawChat()
    const png = new File([new Uint8Array([137, 80, 78, 71])], 'dot.png', { type: 'image/png' })
    const note = new File(['hello from the file'], 'notes.txt', { type: 'text/plain' })
    await act(async () => {
      const paste = new Event('paste', { bubbles: true, cancelable: true })
      Object.defineProperty(paste, 'clipboardData', { value: { files: [png, note], items: [], getData: () => '' } })
      field().dispatchEvent(paste)
      await new Promise((r) => setTimeout(r, 200))
    })
    await ask('What are these?')
    await settle(200)
    expect(chat).toHaveBeenCalledTimes(1)
    const last = chat.mock.calls[0]![0].messages.at(-1)!
    expect(last.role).toBe('user')
    expect(last.content).toEqual([
      { type: 'text', text: 'What are these?' },
      { type: 'image_url', image_url: { url: expect.stringMatching(/^data:image\/png;base64,/) } },
      { type: 'text', text: 'notes.txt:\nhello from the file' },
    ])
    expect(shown()).toContain('A red dot, and a note.')
    // Only the page's own reads went out: no upload, no workspace, no chat.
    expect(api.calls.filter((c) => c.method !== 'GET' || /file|workspace|upload|chat/.test(c.path))).toEqual([])
  })
})
