// @vitest-environment happy-dom
// A DOM, so Setup's effects run where a test mounts it (what it reads, and
// GitHub changing on the page); the rest draw it to markup once.
import { act, createElement, type ReactNode, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { part, store } = vi.hoisted(() => {
  type Part = {
    children?: ReactNode
    render?: ReactElement | string
    'aria-label'?: string
    'data-slot'?: string
    role?: string
    onClick?: () => void
  }
  const part = ({ children, render, 'aria-label': label, 'data-slot': slot, role, onClick }: Part) => {
    return createElement(
      typeof render === 'string' ? render : 'div',
      { 'data-slot': slot, 'aria-label': label, role, onClick },
      children,
    )
  }
  const store = new Map<string, any>()
  return { part, store }
})

vi.mock('./kept', () => ({
  useKept: (key: string, initial: any) => {
    const val = store.has(key) ? store.get(key) : initial
    const set = (v: any) => store.set(key, v)
    return [val, set]
  },
}))

vi.mock('./pref', () => ({
  usePref: (key: string, initial: any) => {
    const val = store.has(key) ? store.get(key) : initial
    const set = (v: any) => store.set(key, v)
    return [val, set, true]
  },
}))

vi.mock('@hanzo/ui', () => ({
  Box: part,
  Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
    open ? createElement('div', { 'data-slot': 'dialog' }, children) : null,
  DialogContent: part,
  DialogTitle: part,
  Input: (props: any) => createElement('input', props),
  SizableText: part,
  Text: part,
  XStack: part,
  YStack: part,
}))

vi.mock('@hanzo/i18n/react', () => ({
  useI18n: () => ({ t: (str: string, vars?: any) => (vars ? str.replace(/{(\w+)}/g, (_, k) => vars[k] ?? '') : str) }),
}))

vi.mock('@hanzo/iam/react', () => ({
  useIam: () => ({
    isAuthenticated: true,
    accessToken: 'mock-token',
  }),
}))

vi.mock('./ProviderMark', () => ({
  ProviderMark: ({ org }: { org: string }) => createElement('span', { 'data-mark': org }, org),
}))

vi.mock('./lib/api', () => ({
  api: () => 'https://api.hanzo.ai',
  CLIENT: 'hanzo-app',
}))

vi.mock('./lib/session', () => ({
  scope: () => ({ Authorization: 'Bearer mock-token' }),
}))

vi.mock('./where', () => ({
  brand: () => 'Hanzo',
  site: (p: string) => `https://hanzo.ai${p}`,
}))

// The private beta `workspace` opens for a reader the cloud lets in (or staff).
vi.mock('./Betas', () => ({
  useBetas: () => ({ open: (id: string) => store.get(`beta.${id}`) === true }),
}))

vi.mock('./host', () => ({
  useHost: () => ({ path: null }),
}))

import { GITHUB_CHANGED, Setup, leaving, linked } from './Setup'
import { GOOGLE_KEY, GOOGLE_ACCOUNTS_KEY, GOOGLE_WORKSPACE_SCOPES, buildGoogleWorkspaceAuthorizeUrl } from './lib/gmail'

describe('Setup 1-2-3 in-app onboarding', () => {
  beforeEach(() => {
    store.clear()
  })

  test('renders Step 1 (Connect GitHub) in sidebar by default', () => {
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toContain('data-slot="setup"')
    expect(html).toContain('1. Connect GitHub')
    expect(html).toContain('Connect GitHub')
  })

  test('a connected GitHub can be disconnected from step 1; an unconnected one cannot', () => {
    expect(renderToStaticMarkup(createElement(Setup))).not.toContain('Disconnect')
    store.set('hanzo.onboarding.github', true)
    store.set('hanzo.onboarding.step', 1)
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toContain('Connected')
    expect(html).toContain('Reconnect')
    expect(html).toContain('Disconnect')
  })

  test('advances to Step 2 (Slack) when GitHub is connected', () => {
    store.set('hanzo.onboarding.github', true)
    store.set('hanzo.onboarding.step', 2)
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toContain('2. Connect Slack')
    expect(html).toContain('Connect Slack')
  })

  test('step 3 is the plugin step for an ordinary reader, with no Google connect', () => {
    store.set('hanzo.onboarding.step', 3)
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toContain('3. Connect a plugin')
    expect(html).toContain('Step 3: Connect a plugin')
    expect(html).toContain('build a plugin or add an MCP server in Customize')
    expect(html).not.toContain('Connect Google')
    expect(html).not.toContain('data-slot="setup-workspace"')
    expect(html).not.toContain('1. Connect GitHub')
  })

  test('step 3 says Connected once the org has a plugin or an MCP server', () => {
    store.set('hanzo.onboarding.step', 3)
    store.set('hanzo.onboarding.plugin', true)
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toContain('3. Connect a plugin')
    expect(html).toContain('Connected')
    expect(html).toContain('Open plugins')
    expect(html).toContain('Done')
  })

  test('the Google Workspace card appears on step 3 only for a reader the workspace beta opens for', () => {
    store.set('hanzo.onboarding.step', 3)
    store.set('beta.workspace', true)
    store.set(GOOGLE_ACCOUNTS_KEY, ['z@hanzo.ai', 'personal@gmail.com'])
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toContain('3. Connect a plugin')
    expect(html).toContain('data-slot="setup-workspace"')
    expect(html).toContain('Google Workspace')
    expect(html).toContain('2 connected')
    expect(html).toContain('z@hanzo.ai')
    expect(html).toContain('+ Add Google account')
  })

  test('a connected Google account does not count as step 3, and is hidden outside the beta', () => {
    store.set('hanzo.onboarding.github', true)
    store.set('hanzo.onboarding.slack', true)
    store.set(GOOGLE_KEY, true)
    store.set(GOOGLE_ACCOUNTS_KEY, ['z@hanzo.ai'])
    store.set('hanzo.onboarding.step', 3)
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toContain('Quick setup (2/3)')
    expect(html).not.toContain('z@hanzo.ai')
    expect(html).not.toContain('Connect Google')
  })

  test('shows completion when GitHub, Slack and a plugin are in, with Add Google account only for the beta', () => {
    store.set('hanzo.onboarding.github', true)
    store.set('hanzo.onboarding.slack', true)
    store.set('hanzo.onboarding.plugin', true)
    const plain = renderToStaticMarkup(createElement(Setup))
    expect(plain).toContain('GitHub, Slack &amp; a plugin connected')
    expect(plain).not.toContain('Add Google account')
    expect(plain).toContain('Done')
    store.set('beta.workspace', true)
    store.set(GOOGLE_ACCOUNTS_KEY, ['z@hanzo.ai'])
    const beta = renderToStaticMarkup(createElement(Setup))
    expect(beta).toContain('z@hanzo.ai')
    expect(beta).toContain('Add Google account')
  })

  test('builds Google Workspace authorize URL with Drive/Docs/Sheets/Gmail/Calendar scopes and select_account consent', () => {
    const raw = buildGoogleWorkspaceAuthorizeUrl('https://hanzo.ai', 'test-client-id', 'gws_test')
    const u = new URL(raw)
    expect(u.origin).toBe('https://accounts.google.com')
    expect(u.searchParams.get('client_id')).toBe('test-client-id')
    expect(u.searchParams.get('redirect_uri')).toBe('https://hanzo.ai/v1/iam/oauth/callback')
    expect(u.searchParams.get('response_type')).toBe('token')
    expect(u.searchParams.get('prompt')).toBe('select_account consent')
    expect(u.searchParams.get('include_granted_scopes')).toBe('true')
    expect(u.searchParams.get('scope')).toBe(GOOGLE_WORKSPACE_SCOPES)
    expect(GOOGLE_WORKSPACE_SCOPES.split(' ')).toEqual([
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
    ])
  })

  test('is hidden when dismissed (later)', () => {
    store.set('hanzo.onboarding.later', true)
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toBe('')
  })
})

// GitHub as Projects reads it: the org's App, or the reader's own link. The
// answers are the platform's shapes, as hanzo.ai read them.
describe('what Setup reads as connected', () => {
  const own = { connections: [{ id: 'github-user:default', provider: 'github-user', label: 'default', account: 'octo' }] }
  const none = { providers: [{ id: 'github', connected: false }, { id: 'slack', connected: false }] }

  test('the reader’s own GitHub link is GitHub connected, theirs to drop', () => {
    const found = linked(none, own)
    expect(found?.github).toBe(true)
    expect(found?.own).toBe(true)
    expect(found?.whole).toBe(true)
  })

  test('the org’s App is GitHub connected, and not the reader’s own', () => {
    const found = linked({ providers: [{ id: 'github', connected: true }] }, { connections: [] })
    expect(found?.github).toBe(true)
    expect(found?.own).toBe(false)
  })

  test('with both answered and nothing connected, GitHub is not connected', () => {
    const found = linked(none, { connections: [] })
    expect(found?.github).toBe(false)
    expect(found?.whole).toBe(true)
  })

  test('one answer alone is not whole, so it cannot say GitHub is gone', () => {
    expect(linked(none, null)?.whole).toBe(false)
    expect(linked(null, own)?.github).toBe(true)
    expect(linked(null, null)).toBeNull()
  })

  test('/v1/connection is read by its connections; a connectors list is not', () => {
    expect(linked(null, { connectors: [{ provider: 'github-user' }] })).toBeNull()
  })

  test('Slack and Google addresses come from either answer', () => {
    const found = linked(
      { providers: [{ id: 'slack', connected: true }, { id: 'google', connected: true, connection: { account: 'Z@Hanzo.ai ' } }] },
      { connections: [{ provider: 'google', account: 'me@gmail.com' }] },
    )
    expect(found?.ids.has('slack')).toBe(true)
    expect(found?.google).toEqual(['z@hanzo.ai', 'me@gmail.com'])
  })

  test('Disconnect lets go of the reader’s own link, else the org’s App accounts', () => {
    expect(leaving(true)).toBe('/v1/provider/github/user/disconnect')
    expect(leaving(false)).toBe('/v1/provider/github/disconnect')
  })
})

// Projects and Settings (@hanzo/build) say a GitHub change on the window as
// `hanzo:github`, and hear it; Setup says and hears the same name.
describe('GitHub changed on the page', () => {
  const answers: Record<string, unknown> = {
    '/v1/provider': { providers: [{ id: 'github', connected: false }] },
    '/v1/connection': { connections: [{ provider: 'github-user', account: 'octo' }] },
  }
  let calls: { path: string; method: string }[]
  let root: Root
  let box: HTMLElement

  beforeEach(() => {
    store.clear()
    calls = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: { method?: string }) => {
        const path = url.replace('https://api.hanzo.ai', '')
        calls.push({ path, method: init?.method ?? 'GET' })
        return { ok: true, status: 200, json: async () => answers[path] ?? {} }
      }),
    )
    box = document.createElement('div')
    document.body.appendChild(box)
    root = createRoot(box)
  })

  afterEach(() => {
    act(() => root.unmount())
    box.remove()
    vi.unstubAllGlobals()
  })

  const reads = () => calls.filter((c) => c.path === '/v1/connection').length
  const settle = () =>
    act(async () => {
      for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
    })

  test('Setup reads GitHub again when Projects says it changed', async () => {
    expect(GITHUB_CHANGED).toBe('hanzo:github')
    act(() => root.render(createElement(Setup)))
    await settle()
    expect(reads()).toBe(1)
    act(() => {
      window.dispatchEvent(new Event('hanzo:github'))
    })
    await settle()
    expect(reads()).toBe(2)
  })

  test('Setup’s Disconnect says GitHub changed, so Projects reads it again, and Setup does too', async () => {
    store.set('hanzo.onboarding.github', true)
    store.set('hanzo.onboarding.step', 1)
    const heard: string[] = []
    const hear = (e: Event) => heard.push(e.type)
    window.addEventListener(GITHUB_CHANGED, hear)
    try {
      act(() => root.render(createElement(Setup)))
      await settle()
      const off = () => Array.from(box.querySelectorAll('button')).find((b) => /disconnect/i.test(b.textContent ?? ''))!
      // The first press asks; the second lets go of the reader's own link.
      act(() => off().click())
      expect(heard).toEqual([])
      act(() => off().click())
      await settle()
      expect(calls).toContainEqual({ path: '/v1/provider/github/user/disconnect', method: 'POST' })
      expect(heard).toEqual(['hanzo:github'])
      expect(reads()).toBe(2)
    } finally {
      window.removeEventListener(GITHUB_CHANGED, hear)
    }
  })
})
