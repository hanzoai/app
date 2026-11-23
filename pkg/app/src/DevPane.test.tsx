// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

const captured = vi.hoisted(() => ({
  onConversation: null as ((id: string | null) => void) | null,
  onOpenChat: null as ((id: string | null) => void) | null,
  onOpenDev: null as ((id: string | null) => void) | null,
  navigated: [] as { address: string; replace?: boolean }[],
}))

vi.mock('@hanzo/tabs', () => ({ frameUrl: async () => '' }))
vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/ui', () => ({ Button: 'button', Text: 'span', XStack: 'div', YStack: 'div' }))
vi.mock('./core', () => ({
  DevHome: (props: { onConversation?: (id: string | null) => void }) => {
    captured.onConversation = props.onConversation ?? null
    return createElement('div', { 'data-slot': 'mock-dev-home' })
  },
  DevChatList: (props: { onOpen?: (id: string | null) => void }) => {
    captured.onOpenChat = props.onOpen ?? null
    return createElement('div', { 'data-slot': 'mock-chat-list' })
  },
  DevThreadList: (props: { onOpen?: (id: string | null) => void }) => {
    captured.onOpenDev = props.onOpen ?? null
    return createElement('div', { 'data-slot': 'mock-dev-list' })
  },
  DevWorkspace: () => createElement('div', { 'data-slot': 'mock-workspace' }),
  DevProvider: ({ children }: { children?: unknown }) => children,
}))
vi.mock('./lib/api', () => ({ api: () => 'https://api.test' }))
let session = true
vi.mock('./lib/session', () => ({ bearer: () => 't', org: () => 'hanzo', hasSession: () => session }))
vi.mock('./lib/host', () => ({
  app: (p: string) => (p ? `/dev/${p}` : '/dev'),
  talk: (id?: string) => (id ? `/chat/${encodeURIComponent(id)}` : '/chat'),
  go: (address: string, replace = false) => {
    captured.navigated.push({ address, replace })
  },
}))

import { ChatList, DevInterior, DevList, environmentsOf, guestChat, Scope } from './DevPane'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  captured.onConversation = null
  captured.onOpenChat = null
  captured.onOpenDev = null
  captured.navigated.length = 0
  session = true
})

const host = { go: () => {}, path: '/dev' } as never
const mac = (id: string) => ({ kind: 'machine', id, label: id, zap: `https://${id}.test`, token: async () => 't' }) as never
const dev = (runtime: unknown) => ({ runtime, environments: [], environment: 'cloud', choose: () => {}, handoff: () => {}, fail: () => {} }) as never
const draw = (value: unknown, el = createElement(DevInterior, { host, path: '/dev' })) =>
  renderToStaticMarkup(createElement(Scope.Provider, { value: value as never }, el))

describe('Dev and Chat interior', () => {
  test('nothing is drawn before the scope is there', () => {
    expect(draw(undefined)).toBe('')
  })
  test('the thread list nests under Dev only once a Mac is in use; before that the shell lists its own', () => {
    expect(draw(dev(null), createElement(DevList, { host, path: '/dev' }))).toBe('')
  })
})

describe('guestChat', () => {
  test('a guest at Chat gets the Chat surface, not the Dev core: the core sends a turn on the account, and a guest has none', () => {
    session = false
    expect(guestChat('chat')).toBe(true)
  })
  test('a signed-in reader keeps the Dev core at Chat', () => {
    session = true
    expect(guestChat('chat')).toBe(false)
  })
  test('Dev keeps the core for everyone, guest or not', () => {
    session = false
    expect(guestChat('dev')).toBe(false)
    session = true
    expect(guestChat('dev')).toBe(false)
  })
})

describe('environments', () => {
  const t = (s: string) => s
  test('Cloud is first and says it is not available yet; each linked Mac follows, available', () => {
    const list = environmentsOf(t, [mac('mac1'), mac('mac2')], new Set())
    expect(list.map((e) => e.id)).toEqual(['cloud', 'mac1', 'mac2'])
    expect(list[0]).toMatchObject({ kind: 'cloud', available: false, note: 'Not available yet' })
    expect(list[1]).toMatchObject({ kind: 'machine', available: true })
  })
  test('a Mac that would not pair is not offered again', () => {
    expect(environmentsOf(t, [mac('mac1'), mac('mac2')], new Set(['mac1'])).map((e) => e.id)).toEqual(['cloud', 'mac2'])
  })
  test('no linked Mac leaves Cloud alone, so the composer is still there', () => {
    expect(environmentsOf(t, [], new Set()).map((e) => e.id)).toEqual(['cloud'])
  })
})

describe('chat thread navigation (hanzo-inc/app issue 528)', () => {
  const THREAD = 't-mwsfr4dak3eyk3x0'

  async function mount(el: ReturnType<typeof createElement>) {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(createElement(Scope.Provider, { value: dev(null) }, el))
      await Promise.resolve()
      await Promise.resolve()
    })
    return () => {
      act(() => root.unmount())
      container.remove()
    }
  }

  test('posting or opening a chat thread from /, /chat, or /dev/projects/... navigates to /chat/<id>, never via host.go into /dev/projects/chat/<id>', async () => {
    for (const fromPath of ['/', '/chat', '/dev/projects/hanzo/circle']) {
      captured.navigated.length = 0
      const hostGo = vi.fn()
      const testHost = { go: hostGo, path: fromPath } as never
      const unmountHome = await mount(createElement(DevInterior, { host: testHost, path: fromPath, mode: 'chat' }))
      expect(captured.onConversation, fromPath).toBeTypeOf('function')
      act(() => captured.onConversation!(THREAD))
      expect(captured.navigated, fromPath).toEqual([{ address: `/chat/${THREAD}`, replace: false }])
      expect(hostGo, `host.go must never wrap chat thread ${fromPath}`).not.toHaveBeenCalled()
      unmountHome()

      captured.navigated.length = 0
      const unmountList = await mount(createElement(ChatList, { host: testHost, path: fromPath }))
      expect(captured.onOpenChat, fromPath).toBeTypeOf('function')
      act(() => captured.onOpenChat!(THREAD))
      expect(captured.navigated, `ChatList from ${fromPath}`).toEqual([{ address: `/chat/${THREAD}`, replace: false }])
      expect(hostGo, `ChatList host.go must never wrap chat thread ${fromPath}`).not.toHaveBeenCalled()
      unmountList()
    }
  })

  test('landing on a misrouted /dev/projects/chat/t-... URL replaces it with /chat/t-...', async () => {
    const hostGo = vi.fn()
    const testHost = { go: hostGo, path: `chat/${THREAD}` } as never
    const unmount = await mount(createElement(DevInterior, { host: testHost, path: `/dev/projects/chat/${THREAD}`, mode: 'dev' }))
    expect(captured.navigated).toEqual([{ address: `/chat/${THREAD}`, replace: true }])
    expect(hostGo).not.toHaveBeenCalled()
    unmount()
  })
})
