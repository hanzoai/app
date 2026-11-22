// @vitest-environment happy-dom
// A signed-out turn on a host with its own engine (`configure({ local })`): Chat sends the whole
// conversation to the host, and never to the public gateway.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Mounted } from '../vitest.real'
import { ask, button, drawChat, field, platform, press, settle, shown, type Platform } from '../vitest.chat'
import type { Turn } from './lib/local'
import { configure, where } from './where'

let at: Mounted | undefined
let api: Platform
const before = { ...where() }

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  api = platform()
  api.on('GET /v1/models', { status: 200, body: { object: 'list', data: [{ id: 'enso-auto', object: 'model', owned_by: 'hanzo', name: 'Enso Auto' }, { id: 'llama-local', object: 'model', owned_by: 'this computer', name: 'Llama Local' }, { id: 'qwen-local', object: 'model', owned_by: 'this computer', name: 'Qwen Local' }] } })
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

  /** Waits, a poll at a time, until `ready` holds: the window reads a file on its own time. */
  const until = async (ready: () => boolean) => {
    for (let i = 0; i < 100 && !ready(); i++) await settle(50)
    expect(ready()).toBe(true)
  }
  const attach = async (...files: File[]) => {
    await act(async () => {
      const paste = new Event('paste', { bubbles: true, cancelable: true })
      Object.defineProperty(paste, 'clipboardData', { value: { files, items: [], getData: () => '' } })
      field().dispatchEvent(paste)
    })
  }
  const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'dot.png', { type: 'image/png' })
  const note = () => new File(['hello from the file'], 'notes.txt', { type: 'text/plain' })
  const called = (chat: { mock: { calls: unknown[][] } }, n: number) => (chat.mock.calls[n]![0] as { messages: Turn[]; model?: string }).messages

  test('a picture and a text file attached signed out are read here and go to local.chat as parts, and nothing is uploaded', async () => {
    const chat = vi.fn(async (_turn: { messages: Turn[] }) => 'A red dot, and a note.')
    configure({ local: { chat } })
    at = await drawChat()
    await attach(png(), note())
    await until(() => (document.body.textContent ?? '').includes('notes.txt') && (document.body.textContent ?? '').includes('dot.png'))
    await ask('What are these?')
    await until(() => chat.mock.calls.length === 1)
    await until(() => shown().includes('A red dot, and a note.'))
    const last = called(chat, 0).at(-1)!
    expect(last.role).toBe('user')
    expect(last.content).toMatchObject([
      { type: 'text', text: 'What are these?' },
      { type: 'image_url', image_url: { url: expect.stringMatching(/^data:image\/png;base64,/) } },
      { type: 'text', text: 'notes.txt:\nhello from the file' },
    ])
    expect(shown()).toContain('A red dot, and a note.')
    // No upload and no public-gateway turn (the page's own reads and its usage beacon are not what is under test).
    expect(api.calls.filter((c) => c.method === 'PUT' || /file|workspace|upload|bucket|chat\/public/.test(c.path)).map((c) => `${c.method} ${c.path}`)).toEqual([])
  })

  test('the files stay in the conversation: the bubble names them, and the next question carries them again', async () => {
    const chat = vi.fn(async (_turn: { messages: Turn[] }) => 'Noted.')
    configure({ local: { chat } })
    at = await drawChat()
    await attach(png(), note())
    await until(() => (document.body.textContent ?? '').includes('notes.txt'))
    await ask('Look at these.')
    await until(() => chat.mock.calls.length === 1)
    await settle(100)
    expect(shown()).toContain('dot.png')
    expect(shown()).toContain('notes.txt')
    expect(shown()).not.toContain('hello from the file')
    await ask('And again?')
    await until(() => chat.mock.calls.length === 2)
    const earlier = called(chat, 1)[0]!
    expect(earlier.content).toMatchObject([{ type: 'text', text: 'Look at these.' }, { type: 'image_url' }, { type: 'text', text: 'notes.txt:\nhello from the file' }])
  })

  test('Regenerate asks again with the same files', async () => {
    const chat = vi.fn(async (_turn: { messages: Turn[] }) => 'An answer.')
    configure({ local: { chat } })
    at = await drawChat()
    await attach(png(), note())
    await until(() => (document.body.textContent ?? '').includes('notes.txt'))
    await ask('Look at these.')
    await until(() => shown().includes('An answer.'))
    await act(async () => {
      document.querySelector('[data-turn-role="assistant"]')?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    await press(/regenerate/i)
    await until(() => chat.mock.calls.length === 2)
    expect(called(chat, 1).at(-1)!.content).toMatchObject([
      { type: 'text', text: 'Look at these.' },
      { type: 'image_url', image_url: { url: expect.stringMatching(/^data:image\/png;base64,/) } },
      { type: 'text', text: 'notes.txt:\nhello from the file' },
    ])
  })

  test('a file that cannot be read signed out says why on its chip and is not sent', async () => {
    const chat = vi.fn(async (_turn: { messages: Turn[] }) => 'Fine.')
    configure({ local: { chat } })
    at = await drawChat()
    await attach(new File(['%PDF'], 'report.pdf', { type: 'application/pdf' }))
    // The chip says failed, and its title says why.
    await until(() => document.body.innerHTML.includes('Sign in to attach report.pdf: without an account only pictures and text files can be read here.'))
    expect(document.body.textContent).toContain('failed')
    await ask('Read it.')
    await until(() => chat.mock.calls.length === 1)
    expect(called(chat, 0).at(-1)!.content).toBe('Read it.')
  })

  test('the signed-out picker lists the host’s models (the catalog also lists Enso), names no Enso, and the chosen one goes to local.chat', async () => {
    const chat = vi.fn(async (_turn: { messages: Turn[]; model?: string }) => 'Hi.')
    configure({ local: { chat } })
    at = await drawChat()
    await settle(200)
    expect(document.querySelector('[data-slot="host-model"]')?.textContent).toMatch(/Llama Local|Qwen Local/)
    expect((document.body.textContent ?? '').match(/.{30}enso.{30}/i)?.[0]).toBeUndefined()
    await ask('Hello?')
    await until(() => chat.mock.calls.length === 1)
    expect(['llama-local', 'qwen-local']).toContain((chat.mock.calls[0]![0] as { model?: string }).model)
  })

  test('a refusal says why in the engine’s own words, offers Settings, and is not sent as part of the conversation', async () => {
    const chat = vi.fn(async (_turn: { messages: Turn[] }): Promise<string> => {
      if (chat.mock.calls.length === 1) throw new Error('No model is loaded.')
      return 'Now it works.'
    })
    configure({ local: { chat } })
    const doors: Event[] = []
    const door = (e: Event) => doors.push(e)
    window.addEventListener('hanzo:anon-settings', door)
    try {
      at = await drawChat()
      await ask('Hello?')
      await until(() => shown().includes('No model is loaded.'))
      expect(shown()).toContain('Your local model did not answer. Try again.')
      await press('Open settings')
      expect(doors).toHaveLength(1)
      await ask('Again?')
      await until(() => shown().includes('Now it works.'))
      expect(called(chat, 1).map((m) => (typeof m.content === 'string' ? m.content : ''))).toEqual(['Hello?', 'Again?'])
    } finally {
      window.removeEventListener('hanzo:anon-settings', door)
    }
  })
})
