// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://hanzo.ai/"}
// A DOM at a production origin: on a developer's own machine every app opens, which is not what is under test.
import { createElement, type ReactNode } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({ token: 't1' }))

// The drawing libraries are not under test and do not load outside a bundler: each
// element draws its children and keeps its data-* marks, which is what is read.
const draw = ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
  createElement('div', Object.fromEntries(Object.entries(props).filter(([k]) => k.startsWith('data-'))), children)
vi.mock('@hanzo/ui', () => ({
  Button: draw,
  Dialog: draw,
  DialogContent: draw,
  DialogTitle: draw,
  Text: draw,
  XStack: draw,
  YStack: draw,
}))
vi.mock('lucide-react', () => ({ ArrowUpRight: () => null, Compass: () => null, FlaskConical: () => null }))
vi.mock('@hanzo/iam/react', () => ({ useIam: () => ({ accessToken: state.token }) }))
vi.mock('./lib/api', () => ({ api: () => 'https://api.test' }))
vi.mock('./lib/session', () => ({ bearer: () => state.token, scope: () => ({ Authorization: `Bearer ${state.token}` }), superAdmin: () => false }))

/** The cloud, as these routes answer: one switch on, one ask on file, and which betas are public. */
const cloud = (flags: Record<string, boolean>, opted: { on: boolean; blocked: boolean; public: string[] }) =>
  vi.fn(async (url: string) => {
    const path = new URL(url).pathname
    const json = path === '/v1/flag/platform' ? { flags } : path === '/v1/marketing/beta' ? { betas: ['crm'] } : path === '/v1/flag/optin' ? opted : {}
    return { ok: true, status: 200, json: async () => json }
  })

const row = (id: string) => document.querySelector(`[data-beta="${id}"]`)?.textContent ?? ''

async function draws() {
  const { BetasList } = await import('./Betas')
  const at = document.createElement('div')
  document.body.append(at)
  const root = createRoot(at)
  await act(async () => root.render(createElement(BetasList)))
  await act(async () => new Promise((r) => setTimeout(r, 0)))
  return async () => {
    await act(async () => root.unmount())
    at.remove()
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('the Betas list', () => {
  test('a public beta reads as one, is in for an opted-in reader the cloud opened it to, and a private one keeps Request access', async () => {
    state.token = 't1'
    vi.stubGlobal('fetch', cloud({ 'beta.koma': true }, { on: true, blocked: false, public: ['koma', 'iro'] }))
    const done = await draws()
    expect(row('koma')).toContain('Public beta')
    expect(row('koma')).toContain('You’re in')
    // Public, but the cloud has not opened it for this reader: how to turn it on, never a request.
    expect(row('iro')).toContain('Public beta')
    expect(row('iro')).toContain('Turn on experimental features in Settings')
    expect(row('iro')).not.toContain('Request access')
    expect(row('crm')).toContain('Requested')
    expect(row('erp')).toContain('Request access')
    expect(row('erp')).not.toContain('Public beta')
    await done()
  })

  test('an organization that turned experimental features off is said so on a public beta', async () => {
    state.token = 't2'
    vi.stubGlobal('fetch', cloud({}, { on: false, blocked: true, public: ['mori'] }))
    const done = await draws()
    expect(row('mori')).toContain('Public beta')
    expect(row('mori')).toContain('Turned off by your organization')
    await done()
  })
})
