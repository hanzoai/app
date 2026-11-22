// @vitest-environment happy-dom
// A cloud machine is billed while it runs: each test counts the leases the Tabs page asks the fleet for.
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const fleet = vi.hoisted(() => ({
  launch: vi.fn(async (kind: string, _o?: { temporary?: boolean }) => `cloud-${kind}`),
  stop: vi.fn(async () => {}),
  read: true,
  error: null as string | null,
  streams: 2 as number | null,
  workspace: [] as Record<string, unknown>[],
  toast: vi.fn(),
}))

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string, v?: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? '')) }) }))
vi.mock('@hanzo/tabs', () => ({
  useFleet: () => ({ hosts: [], streams: fleet.streams, read: fleet.read, error: fleet.error, mint: vi.fn(), launch: fleet.launch, stop: fleet.stop, agent: vi.fn(), refresh: vi.fn(), account: 'ada' }),
  Workspace: (props: Record<string, unknown>) => {
    fleet.workspace.push(props)
    return createElement('div', { 'data-slot': 'workspace' })
  },
}))
vi.mock('@hanzo/build/names', () => ({ useDeviceNames: () => ({}) }))
vi.mock('./lib/dev-mode', () => ({ useDevMode: () => [false] }))
vi.mock('./lib/devices', () => ({ showDevice: () => ({ title: '', detail: '' }) }))
vi.mock('./lib/info-hint', () => ({ InfoHint: () => null }))
vi.mock('./slow', () => ({ Loading: () => null }))
vi.mock('./lib/session', () => ({ bearer: () => 'tk', subject: () => 'ada', org: () => 'acme', named: () => null }))
vi.mock('./lib/api', () => ({ api: () => 'https://api.test' }))
vi.mock('./lib/destination', () => ({ enter: vi.fn(), LOGIN: '/login' }))
vi.mock('@hanzo/ui', () => {
  const el =
    (tag: string) =>
    ({ children, onPress, onClick, 'data-slot': slot, disabled }: { children?: ReactNode; onPress?: () => void; onClick?: () => void; 'data-slot'?: string; disabled?: boolean }) =>
      createElement(tag, { 'data-slot': slot, onClick: onPress ?? onClick, disabled }, children)
  return {
    Button: el('button'),
    Skeleton: () => null,
    Text: el('span'),
    View: el('div'),
    XStack: el('div'),
    YStack: el('div'),
    SizableText: el('p'),
    Label: el('label'),
    Checkbox: ({ 'data-slot': slot }: { 'data-slot'?: string }) => createElement('input', { type: 'checkbox', 'data-slot': slot }),
    Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) => (open ? createElement('div', { role: 'dialog' }, children) : null),
    DialogContent: el('div'),
    DialogTitle: el('h2'),
    DialogDescription: el('h2'),
    toast: fleet.toast,
  }
})

import Terminals from './Terminals'
import { configure } from './where'

let root: Root
let host: HTMLElement
const click = (slot: string) => act(async () => (host.querySelector(`[data-slot="${slot}"]`) as HTMLElement).click())

beforeEach(() => {
  localStorage.clear()
  fleet.launch.mockClear()
  fleet.stop.mockClear()
  fleet.workspace.length = 0
  fleet.read = true
  fleet.error = null
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('Tabs takes what the host states of the workspace', () => {
  test('a configured `tabs` reaches the Workspace as props, and unset adds none', async () => {
    fleet.read = false
    fleet.error = 'timeout'
    await act(async () => root.render(createElement(Terminals)))
    expect(fleet.workspace.at(-1)).not.toHaveProperty('shortcuts')
    expect(fleet.workspace.at(-1)).not.toHaveProperty('minPane')
    configure({ tabs: { shortcuts: true, minPane: 420 } })
    try {
      await act(async () => root.render(createElement(Terminals, { key: 'again' })))
      expect(fleet.workspace.at(-1)).toMatchObject({ shortcuts: true, minPane: 420 })
    } finally {
      configure({ tabs: undefined })
    }
  })
})

describe('Tabs leases a cloud machine', () => {
  test('a card starts nothing until the person says yes, and nothing when they cancel', async () => {
    await act(async () => root.render(createElement(Terminals)))
    await click('terminals-empty-cta')
    expect(fleet.launch).not.toHaveBeenCalled()
    await click('confirm-cancel')
    expect(fleet.launch).not.toHaveBeenCalled()
    await click('terminals-launch-browser')
    await click('confirm-yes')
    expect(fleet.launch.mock.calls).toEqual([['browser', { temporary: false }]])
  })

  test("with the machine list failed, a sidebar action is the Workspace's alone, and the Workspace's one asker is this page's question", async () => {
    fleet.read = false
    fleet.error = 'timeout'
    await act(async () => root.render(createElement(Terminals)))
    await act(async () => void window.dispatchEvent(new CustomEvent('hanzo:tabs-action', { detail: { kind: 'shell' } })))
    expect(host.querySelector('[role="dialog"]'), 'the page itself does not answer').toBeNull()
    const ws = fleet.workspace.at(-1)!
    // The Workspace starts and stops through the fleet itself, and asks only through `confirmLease`.
    expect(ws.onLaunch).toBe(fleet.launch)
    expect(ws.onStop).toBe(fleet.stop)
    expect(ws.account).toBe('ada')
    expect(ws.streams).toBe(2)
    const confirm = ws.confirmLease as (a: Record<string, unknown>) => Promise<boolean>
    let yes: Promise<boolean> | undefined
    await act(async () => void (yes = confirm({ kind: 'dev', temporary: false, beyond: true, limit: 2, from: 'button' })))
    expect(host.textContent).toContain('Your plan streams 2 tabs at once and they are all open')
    expect(host.querySelector('[data-slot="confirm-remember"]'), 'a start past the limit runs unseen: never remembered').toBeNull()
    await click('confirm-yes')
    expect(await yes).toBe(true)
    expect(fleet.launch, 'the Workspace starts it, not the question').not.toHaveBeenCalled()
    await act(async () => void (yes = confirm({ kind: 'dev', temporary: false, beyond: false, limit: 2, from: 'split' })))
    expect(host.querySelector('[data-slot="confirm-remember"]')).not.toBeNull()
    await click('confirm-cancel')
    expect(await yes).toBe(false)
  })

  test("a remembered yes covers its own class of machine alone, and never a temporary start or one past the plan's limit", async () => {
    fleet.read = false
    fleet.error = 'timeout'
    localStorage.setItem('hanzo.spend.trusted.ada.acme.tabs-dev', '1')
    await act(async () => root.render(createElement(Terminals)))
    const confirm = fleet.workspace.at(-1)!.confirmLease as (a: Record<string, unknown>) => Promise<boolean>
    expect(await confirm({ kind: 'dev', temporary: false, beyond: false, limit: 2, from: 'button' }), 'a start the person will see goes').toBe(true)
    let yes: Promise<boolean> | undefined
    // A yes kept for terminals is the terminals' alone: a desktop and a browser still ask.
    for (const kind of ['desktop', 'browser']) {
      await act(async () => void (yes = confirm({ kind, temporary: false, beyond: false, limit: 2, from: 'button' })))
      expect(host.querySelector('[role="dialog"]'), kind).not.toBeNull()
      await click('confirm-cancel')
      expect(await yes).toBe(false)
    }
    await act(async () => void (yes = confirm({ kind: 'desktop', temporary: true, beyond: false, limit: 2, from: 'button' })))
    expect(host.querySelector('[role="dialog"]'), 'a temporary one is asked').not.toBeNull()
    await click('confirm-cancel')
    expect(await yes).toBe(false)
    await act(async () => void (yes = confirm({ kind: 'dev', temporary: false, beyond: true, limit: 2, from: 'button' })))
    expect(host.querySelector('[role="dialog"]'), 'one past the limit is asked').not.toBeNull()
    await click('confirm-cancel')
    expect(await yes).toBe(false)
  })

  test('the question closes itself when the Workspace stops waiting: a yes just before starts, and at the deadline nothing starts and the toast says so', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      fleet.read = false
      fleet.error = 'timeout'
      await act(async () => root.render(createElement(Terminals)))
      const confirm = fleet.workspace.at(-1)!.confirmLease as (a: Record<string, unknown>) => Promise<boolean>
      const ask = (expires: number) => ({ kind: 'dev', temporary: true, beyond: false, limit: 2, from: 'button', expires })

      let yes: Promise<boolean> | undefined
      await act(async () => void (yes = confirm(ask(Date.now() + 120_000))))
      await act(async () => void vi.advanceTimersByTime(119_999))
      expect(host.querySelector('[role="dialog"]'), 'still asking just before').not.toBeNull()
      await click('confirm-yes')
      expect(await yes).toBe(true)

      fleet.toast.mockClear()
      await act(async () => void (yes = confirm(ask(Date.now() + 120_000))))
      await act(async () => void vi.advanceTimersByTime(120_000))
      expect(host.querySelector('[role="dialog"]'), 'gone at the deadline: no yes can be given').toBeNull()
      expect(await yes).toBe(false)
      expect(fleet.toast).toHaveBeenCalledTimes(1)
      expect(fleet.toast).toHaveBeenCalledWith('Nothing was started, because the question timed out.')
      expect(fleet.launch).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
