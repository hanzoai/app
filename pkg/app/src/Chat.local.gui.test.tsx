// @vitest-environment happy-dom
// A signed-out turn on a host with its own engine (`configure({ local })`): Chat sends the whole
// conversation to the host, and never to the public gateway.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Mounted } from '../vitest.real'
import { ask, drawChat, platform, settle, shown, type Platform } from '../vitest.chat'
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
  configure(before)
  await at?.done()
  at = undefined
  vi.unstubAllGlobals()
})

describe('a host answers signed-out turns with its own engine', () => {
  test('each turn goes to local.chat with the whole conversation, and nothing goes to the public gateway', async () => {
    const sent: { role: string; content: string }[][] = []
    const chat = vi.fn(async ({ messages }: { messages: { role: string; content: string }[] }) => {
      sent.push(messages.map((m) => ({ ...m })))
      return sent.length === 1 ? 'Paris.' : 'About two million.'
    })
    configure({ local: { chat } })
    at = await drawChat(undefined, { anonymous: true })
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
})
