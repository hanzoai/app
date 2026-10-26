// @vitest-environment happy-dom
// The pane that frames a hosted app: who sees the frame, what it loads, what the
// host tells it and hears from it, and what a frame that never loads says.
import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

// `act` is the way these tests let React settle.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const state = vi.hoisted(() => ({
  betas: { ready: true as boolean, open: (_id: string): boolean => true },
  pref: { theme: 'dark', accent: 'blue', density: 'compact' } as Record<string, string>,
  org: { id: 'hanzo' } as { id?: string },
  went: [] as string[],
  moved: [] as [string, boolean | undefined][],
}))

// The drawing libraries are not under test: each stands in as the element it renders.
const draw = ({ render, children, 'data-slot': slot, 'data-app': app }: { render?: ReactElement | string; children?: ReactNode; 'data-slot'?: string; 'data-app'?: string }) =>
  isValidElement(render)
    ? cloneElement(render, undefined, children)
    : createElement(typeof render === 'string' ? render : 'div', { 'data-slot': slot, 'data-app': app }, children)
vi.mock('@hanzo/gui', () => ({ View: draw }))
vi.mock('@hanzo/ui', () => ({
  Button: ({ children, onPress, 'aria-label': label, 'data-slot': slot }: { children?: ReactNode; onPress?: () => void; 'aria-label'?: string; 'data-slot'?: string }) =>
    createElement('button', { 'aria-label': label, 'data-slot': slot, onClick: onPress }, children),
  Spinner: () => createElement('span', { 'data-spinner': '' }),
  Text: draw,
  XStack: draw,
  YStack: draw,
}))
vi.mock('@hanzo/i18n/react', () => ({
  useI18n: () => ({ t: (s: string, v?: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => v?.[k] ?? '') }),
}))
vi.mock('@hanzo/appearance', () => ({ current: () => ({ pref: state.pref }), dark: (theme: string) => theme === 'dark' }))
vi.mock('./Betas', () => ({ useBetas: () => state.betas, Ask: () => createElement('button', { 'data-slot': 'ask' }) }))
vi.mock('./help', () => ({ out: (href: string) => state.went.push(href) }))
vi.mock('./host', () => ({ useOrg: () => state.org }))
vi.mock('./lib/host', async (original) => ({ ...(await original<typeof import('./lib/host')>()), go: (address: string, replace?: boolean) => state.moved.push([address, replace]) }))

const { HostedPane, PATIENCE } = await import('./Hosted')

// The environment would fetch a frame's page the moment `src` is set, and there is no network here: the
// address a frame is given is kept on the element and never loaded, so what a test reads is what was asked for.
// Nor does the environment get to say a frame has loaded: only a test does (`load`), as a real frame
// that never answers never does.
const sources = new WeakMap<Element, string>()
const setAttribute = HTMLIFrameElement.prototype.setAttribute
const getAttribute = HTMLIFrameElement.prototype.getAttribute
const dispatchEvent = HTMLIFrameElement.prototype.dispatchEvent
let manual = false
beforeAll(() => {
  HTMLIFrameElement.prototype.dispatchEvent = function (e: Event) {
    return e.type === 'load' && !manual ? false : dispatchEvent.call(this, e)
  }
  HTMLIFrameElement.prototype.setAttribute = function (name: string, value: string) {
    if (name === 'src') sources.set(this, value)
    else setAttribute.call(this, name, value)
  }
  HTMLIFrameElement.prototype.getAttribute = function (name: string) {
    return name === 'src' ? (sources.get(this) ?? null) : getAttribute.call(this, name)
  }
})
afterAll(() => {
  HTMLIFrameElement.prototype.setAttribute = setAttribute
  HTMLIFrameElement.prototype.getAttribute = getAttribute
  HTMLIFrameElement.prototype.dispatchEvent = dispatchEvent
})

let root: Root
let host: HTMLElement
const frames = () => [...host.querySelectorAll('iframe')]
const show = async (id = 'crm') => {
  await act(async () => root.render(createElement(HostedPane, { id, go: () => {} })))
}
/** The frame says it has loaded. */
const load = (frame: HTMLIFrameElement) =>
  act(async () => {
    manual = true
    frame.dispatchEvent(new Event('load'))
    manual = false
  })
/** A frame whose window is a stand-in that records what the host posts to it. */
const stand = (frame: HTMLIFrameElement) => {
  const posted: [unknown, string][] = []
  const win = { postMessage: (m: unknown, to: string) => posted.push([m, to]) }
  Object.defineProperty(frame, 'contentWindow', { configurable: true, value: win })
  return { win, posted }
}
const say = (data: unknown, from: { origin: string; source: unknown }) =>
  act(async () => {
    const e = new MessageEvent('message', { data })
    Object.defineProperty(e, 'origin', { value: from.origin })
    Object.defineProperty(e, 'source', { value: from.source })
    window.dispatchEvent(e)
  })

beforeEach(() => {
  state.betas = { ready: true, open: () => true }
  state.pref = { theme: 'dark', accent: 'blue', density: 'compact' }
  state.org = { id: 'hanzo' }
  state.went = []
  state.moved = []
  window.history.replaceState(null, '', '/apps/crm')
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
})

describe('who sees the frame', () => {
  test('a reader the switch is on for sees the app\'s live host with embed=1, and no other frame', async () => {
    await show('crm')
    expect(frames().map((f) => f.getAttribute('src'))).toEqual(['https://crm.hanzo.ai/?embed=1'])
    expect(frames()[0].getAttribute('title')).toBe('CRM')
  })

  test('each app frames its own host and nothing else', async () => {
    const seen: Record<string, string | null> = {}
    for (const id of ['crm', 'commerce', 'cms', 'analytics', 'insights']) {
      await show(id)
      seen[id] = frames()[0]?.getAttribute('src') ?? null
    }
    expect(seen).toEqual({
      crm: 'https://crm.hanzo.ai/?embed=1',
      commerce: 'https://commerce-admin.hanzo.ai/admin/?embed=1',
      cms: 'https://cms.hanzo.ai/admin?embed=1',
      analytics: 'https://analytics.hanzo.ai/?embed=1',
      insights: 'https://insights.hanzo.ai/?embed=1',
    })
  })

  test('a reader the switch is off for is shown the request path, never a frame', async () => {
    state.betas.open = () => false
    await show('crm')
    expect(frames()).toHaveLength(0)
    expect(host.querySelector('[data-slot="hosted-request"]')).not.toBeNull()
    expect(host.querySelector('[data-slot="ask"]')).not.toBeNull()
    expect(host.textContent).toContain('CRM')
  })

  test('while the switches are being read there is a loader, and no frame', async () => {
    state.betas.ready = false
    await show('crm')
    expect(frames()).toHaveLength(0)
    expect(host.querySelector('[data-slot="hosted-loading"]')).not.toBeNull()
  })

  test('an id that is no hosted app draws nothing', async () => {
    await show('erp')
    expect(host.innerHTML).toBe('')
  })

  test('the address\'s own page inside the app is where the frame opens', async () => {
    window.history.replaceState(null, '', '/apps/crm?at=%2Fcompanies')
    await show('crm')
    expect(frames()[0].getAttribute('src')).toBe('https://crm.hanzo.ai/companies?embed=1')
  })
})

describe('what the host tells the frame, and what it hears', () => {
  test('theme, accent, density and organization go to the app\'s origin once the frame has loaded', async () => {
    await show('crm')
    const { posted } = stand(frames()[0])
    await load(frames()[0])
    expect(posted).toEqual([[{ type: 'hanzo:host', theme: 'dark', accent: 'blue', density: 'compact', org: 'hanzo' }, 'https://crm.hanzo.ai']])
  })

  test('a change of organization is told again', async () => {
    await show('crm')
    const { posted } = stand(frames()[0])
    await load(frames()[0])
    state.org = { id: 'zoo' }
    await show('crm')
    expect(posted.at(-1)).toEqual([expect.objectContaining({ type: 'hanzo:host', org: 'zoo' }), 'https://crm.hanzo.ai'])
  })

  test('where the frame says it is is kept in this address, in place of the last', async () => {
    await show('crm')
    const { win } = stand(frames()[0])
    await say({ type: 'hanzo:navigate', href: 'https://crm.hanzo.ai/people?embed=1&q=a' }, { origin: 'https://crm.hanzo.ai', source: win })
    expect(state.moved).toEqual([['/apps/crm?at=%2Fpeople%3Fq%3Da', true]])
  })

  test('the frame at the start page is the bare address', async () => {
    await show('crm')
    const { win } = stand(frames()[0])
    await say({ type: 'hanzo:navigate', href: 'https://crm.hanzo.ai/' }, { origin: 'https://crm.hanzo.ai', source: win })
    expect(state.moved).toEqual([['/apps/crm', true]])
  })

  test('a message from another origin, another window or about another host is not heard', async () => {
    await show('crm')
    const { win } = stand(frames()[0])
    await say({ type: 'hanzo:navigate', href: 'https://crm.hanzo.ai/people' }, { origin: 'https://evil.example', source: win })
    await say({ type: 'hanzo:navigate', href: 'https://crm.hanzo.ai/people' }, { origin: 'https://crm.hanzo.ai', source: {} })
    await say({ type: 'hanzo:navigate', href: 'https://evil.example/people' }, { origin: 'https://crm.hanzo.ai', source: win })
    await say({ type: 'hanzo:navigate', href: 42 }, { origin: 'https://crm.hanzo.ai', source: win })
    expect(state.moved).toEqual([])
  })
})

describe('the toolbar and the failure', () => {
  test('Reload loads the page the frame was last on, in a new frame', async () => {
    await show('crm')
    const first = frames()[0]
    const { win } = stand(first)
    await say({ type: 'hanzo:navigate', href: 'https://crm.hanzo.ai/people' }, { origin: 'https://crm.hanzo.ai', source: win })
    await act(async () => void (host.querySelector('[data-slot="hosted-reload"]') as HTMLElement).click())
    expect(frames()).toHaveLength(1)
    expect(frames()[0]).not.toBe(first)
    expect(frames()[0].getAttribute('src')).toBe('https://crm.hanzo.ai/people?embed=1')
  })

  test('Open in a tab opens the app on its own host, at the page it is on, without the embed flag', async () => {
    await show('crm')
    const { win } = stand(frames()[0])
    await act(async () => void (host.querySelector('[data-slot="hosted-tab"]') as HTMLElement).click())
    await say({ type: 'hanzo:navigate', href: 'https://crm.hanzo.ai/deals' }, { origin: 'https://crm.hanzo.ai', source: win })
    await act(async () => void (host.querySelector('[data-slot="hosted-tab"]') as HTMLElement).click())
    expect(state.went).toEqual(['https://crm.hanzo.ai/', 'https://crm.hanzo.ai/deals'])
  })

  test('a frame that has not loaded after the patience says so, with the way out', async () => {
    vi.useFakeTimers()
    await show('crm')
    expect(host.querySelector('[data-slot="hosted-failed"]')).toBeNull()
    await act(async () => void vi.advanceTimersByTime(PATIENCE + 1))
    const failed = host.querySelector('[data-slot="hosted-failed"]')!
    expect(failed.textContent).toContain('CRM did not open here.')
    await act(async () => void (failed.querySelector('button') as HTMLElement).click())
    expect(state.went).toEqual(['https://crm.hanzo.ai/'])
  })

  test('a frame that loads in time never says it failed', async () => {
    vi.useFakeTimers()
    await show('crm')
    stand(frames()[0])
    await load(frames()[0])
    await act(async () => void vi.advanceTimersByTime(PATIENCE * 2))
    expect(host.querySelector('[data-slot="hosted-failed"]')).toBeNull()
    expect(host.querySelector('[data-slot="hosted-loading"]')).toBeNull()
  })
})
