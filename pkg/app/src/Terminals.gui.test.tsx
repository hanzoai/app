// @vitest-environment happy-dom
// Tabs, with the real kit AND the real @hanzo/tabs Workspace: only the fleet (the network) is stood in.
// A cloud machine is billed while it runs, so each test counts the questions and the starts.
import { act, createElement } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { Refusal } from '@hanzo/tabs/api'
import { mount, tap, type Mounted } from '../vitest.real'

type Host = { machine: string; sandbox?: string; status: string; screen?: boolean }
const fleet = vi.hoisted(() => ({
  hosts: [] as Host[],
  account: 'ada' as string | null,
  launch: vi.fn(async (kind: string, _o?: { temporary?: boolean }) => `cloud-${kind}`),
  stop: vi.fn(async (_h: unknown) => {}),
}))
vi.mock('@hanzo/tabs', async (real) => ({
  ...(await real<typeof import('@hanzo/tabs')>()),
  useFleet: () => ({
    hosts: fleet.hosts,
    streams: 2,
    read: true,
    error: null,
    mint: vi.fn(async () => 'about:blank'),
    launch: fleet.launch,
    stop: fleet.stop,
    agent: vi.fn(),
    refresh: vi.fn(),
    account: fleet.account,
  }),
}))
vi.mock('@hanzo/dev/names', async (real) => ({ ...(await real<typeof import('@hanzo/dev/names')>()), useDeviceNames: () => ({}) }))
vi.mock('./lib/dev-mode', () => ({ useDevMode: () => [false] }))
vi.mock('./lib/session', async (real) => ({ ...(await real<typeof import('./lib/session')>()), bearer: () => 'tk', subject: () => 'ada', org: () => 'acme' }))
vi.mock('./lib/api', () => ({ api: () => 'https://api.test' }))

const { default: Terminals } = await import('./Terminals')

let at: Mounted
beforeEach(() => {
  localStorage.clear()
  fleet.hosts = []
  fleet.account = 'ada'
  fleet.launch.mockReset()
  fleet.launch.mockImplementation(async (kind: string) => `cloud-${kind}`)
  fleet.stop.mockClear()
})
afterEach(() => at?.done())

const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`) as HTMLElement | null
const questions = () => document.querySelectorAll('[data-slot="confirm"]').length
const button = (words: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === words) as HTMLElement | undefined
const draw = async () => {
  at = await mount()
  await at.draw(createElement(Terminals))
}

describe('starting a cloud machine from the Workspace', () => {
  test("the toolbar's start asks one question, ours; Cancel starts nothing, yes starts it", async () => {
    fleet.hosts = [{ machine: 'box', sandbox: 'sb-box', status: 'online' }]
    await draw()
    await tap(button('New cloud computer')!)
    expect(questions()).toBe(1)
    expect(document.querySelector('[role="alertdialog"]'), "the Workspace asks nothing of its own").toBeNull()
    expect(slot('confirm-remember'), 'a start the person will see may be remembered').not.toBeNull()
    await tap(slot('confirm-cancel')!)
    expect(fleet.launch).not.toHaveBeenCalled()
    await tap(button('New cloud computer')!)
    expect(questions()).toBe(1)
    await tap(slot('confirm-yes')!)
    expect(fleet.launch.mock.calls).toEqual([['dev', { temporary: false }]])
  })

  test('with no account, Don\'t ask again is not offered', async () => {
    fleet.account = null
    fleet.hosts = [{ machine: 'box', sandbox: 'sb-box', status: 'online' }]
    await draw()
    await tap(button('New cloud computer')!)
    expect(questions()).toBe(1)
    expect(slot('confirm-remember')).toBeNull()
  })

  test('"Start a temporary one" says its files are lost, offers no Don\'t ask again, and reaches the fleet as temporary', async () => {
    fleet.hosts = [{ machine: 'box', sandbox: 'sb-box', status: 'online' }]
    fleet.launch.mockImplementationOnce(async () => {
      throw new Refusal(402, 'insufficient_balance', 'Your balance is too low.')
    })
    await draw()
    await tap(button('New cloud computer')!)
    await tap(slot('confirm-yes')!)
    await tap(button('Start a temporary one (files will not be kept)')!)
    expect(questions()).toBe(1)
    expect(slot('confirm')!.textContent).toContain('everything on it is lost when it stops')
    expect(slot('confirm-remember')).toBeNull()
    await tap(slot('confirm-yes')!)
    expect(fleet.launch.mock.calls.at(-1)).toEqual(['dev', { temporary: true }])
  })

  test('closing the last pane on a machine it started offers Stop, which stops it through the fleet', async () => {
    fleet.hosts = [
      { machine: 'box', sandbox: 'sb-box', status: 'online' },
      { machine: 'cloud-dev', sandbox: 'sb-dev', status: 'online' },
    ]
    await draw()
    const panes = () => [...document.querySelectorAll('[title="Close pane"], [aria-label="Close pane"]')] as HTMLElement[]
    const before = panes().length
    await tap(button('New cloud computer')!)
    await tap(slot('confirm-yes')!)
    expect(panes().length).toBe(before + 1)
    await tap(panes().at(-1)!)
    await tap(button('Stop it')!)
    expect(fleet.stop).toHaveBeenCalledTimes(1)
    expect((fleet.stop.mock.calls[0]![0] as Host).machine).toBe('cloud-dev')
  })
})

describe("starting one from the sidebar, outside the Workspace", () => {
  test('asks one question, and starts on yes', async () => {
    await draw()
    await act(async () => void window.dispatchEvent(new CustomEvent('hanzo:tabs-action', { detail: { kind: 'shell' } })))
    await act(async () => void (await new Promise((r) => setTimeout(r, 150))))
    expect(questions()).toBe(1)
    await tap(slot('confirm-yes')!)
    expect(fleet.launch.mock.calls).toEqual([['dev', { temporary: false }]])
  })
})
