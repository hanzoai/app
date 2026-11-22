// Flow (@hanzo/studio's FlowStudio, patched in patches/@hanzo__studio@0.1.12.patch), drawn with the real kit.
// Run queues paid GPU work and Mutate sends a model request: each asks the app's one spend confirm
// (`host.spend`) first, a no sends nothing, and Run pressed twice queues one job.
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, tap, type Mounted } from '../vitest.real'
import { FlowStudio } from '@hanzo/studio'

let at: Mounted
let sent: string[]

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

beforeEach(() => {
  localStorage.clear()
  sent = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url, 'https://studio.test').pathname
      sent.push(`${init?.method ?? 'GET'} ${path}`)
      if (path === '/v1/prompt') return json({ prompt_id: 'p1' })
      if (path === '/v1/worklog') return json({ items: [{ prompt_id: 'p1', status: 'queued' }] })
      return json({})
    }),
  )
})
afterEach(async () => {
  await at?.done()
  vi.unstubAllGlobals()
})

function host(spend: (kind: string, asked?: unknown) => Promise<boolean>) {
  return { name: 'Flow', api: 'https://api.test', token: () => 't', org: 'acme', person: { name: 'Ada', email: 'a@x', avatar: '' }, admin: false, path: '', go: () => undefined, open: () => undefined, links: { github: '', customize: '', settings: '', home: '' }, spend }
}

const button = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('button, [role="button"]')].find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim().startsWith(label)) ?? null
const queued = () => sent.filter((s) => s === 'POST /v1/prompt').length

describe('Run flow', () => {
  test('asks first, and a no queues nothing', async () => {
    const spend = vi.fn(async (_kind: string, _asked?: unknown) => false)
    at = await mount()
    await at.draw(createElement(FlowStudio, { host: host(spend) } as never))
    await tap(button('Run flow')!)
    expect(spend).toHaveBeenCalledTimes(1)
    expect(spend.mock.calls[0][0]).toBe('flow-run')
    expect(queued()).toBe(0)
  })

  test('pressed twice queues one job, and stays one while it is queued', async () => {
    let yes: (v: boolean) => void = () => undefined
    // The first ask waits for the person; any later one would say yes at once, so a second job could only be stopped by Flow.
    const spend = vi.fn(async (_kind: string, _asked?: unknown) => true).mockImplementationOnce(() => new Promise<boolean>((r) => (yes = r)))
    at = await mount()
    await at.draw(createElement(FlowStudio, { host: host(spend) } as never))
    const run = button('Run flow')!
    await tap(run)
    await tap(run)
    expect(spend).toHaveBeenCalledTimes(1)
    yes(true)
    await tap(run)
    await new Promise((r) => setTimeout(r, 50))
    await tap(button('Run flow') ?? run)
    expect(queued()).toBe(1)
  })
})

describe('Mutate flow', () => {
  test('asks first, and a no sends no model request', async () => {
    const spend = vi.fn(async (_kind: string, _asked?: unknown) => false)
    at = await mount()
    await at.draw(createElement(FlowStudio, { host: host(spend) } as never))
    const box = document.querySelector<HTMLInputElement>('[aria-label="Flow Copilot instruction"]')!
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(box), 'value')!.set!
    set.call(box, 'add a sampler')
    box.dispatchEvent(new Event('input', { bubbles: true }))
    await tap(button('Mutate flow')!)
    expect(spend).toHaveBeenCalledWith('flow-mutate')
    expect(sent.filter((s) => s === 'POST /v1/chat/completions')).toEqual([])
  })
})
