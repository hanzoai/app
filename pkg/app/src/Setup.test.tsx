import { createElement, type ReactNode, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

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

import { Setup } from './Setup'
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
