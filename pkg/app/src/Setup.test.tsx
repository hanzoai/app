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

import {
  Setup,
  GOOGLE_KEY,
  GOOGLE_ACCOUNTS_KEY,
  GOOGLE_WORKSPACE_SCOPES,
  buildGoogleWorkspaceAuthorizeUrl,
} from './Setup'

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

  test('advances to Step 2 (Slack) when GitHub is connected', () => {
    store.set('hanzo.onboarding.github', true)
    store.set('hanzo.onboarding.step', 2)
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toContain('2. Connect Slack')
    expect(html).toContain('Connect Slack')
  })

  test('stays on Step 3 (Connect Google) without looping back to Step 1 even if Google is connected and GitHub/Slack were skipped', () => {
    store.set('hanzo.onboarding.github', false)
    store.set('hanzo.onboarding.slack', false)
    store.set(GOOGLE_KEY, true)
    store.set('hanzo.onboarding.step', 3)
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toContain('3. Connect Google')
    expect(html).toContain('+ Add Google account')
    expect(html).toContain('Done')
    expect(html).not.toContain('1. Connect GitHub')
  })

  test('renders multiple connected Google accounts across personal and business orgs on Step 3', () => {
    store.set('hanzo.onboarding.step', 3)
    store.set(GOOGLE_ACCOUNTS_KEY, ['z@hanzo.ai', 'personal@gmail.com'])
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toContain('3. Connect Google')
    expect(html).toContain('2 connected')
    expect(html).toContain('z@hanzo.ai')
    expect(html).toContain('personal@gmail.com')
    expect(html).toContain('+ Add Google account')
  })

  test('shows completion state with Add Google account option when all 3 are finished', () => {
    store.set('hanzo.onboarding.github', true)
    store.set('hanzo.onboarding.slack', true)
    store.set(GOOGLE_KEY, true)
    store.set(GOOGLE_ACCOUNTS_KEY, ['z@hanzo.ai'])
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toContain('GitHub, Slack &amp; Google connected')
    expect(html).toContain('z@hanzo.ai')
    expect(html).toContain('Add Google account')
    expect(html).toContain('Done')
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
    expect(GOOGLE_WORKSPACE_SCOPES).toContain('https://www.googleapis.com/auth/drive')
    expect(GOOGLE_WORKSPACE_SCOPES).toContain('https://www.googleapis.com/auth/documents')
    expect(GOOGLE_WORKSPACE_SCOPES).toContain('https://www.googleapis.com/auth/spreadsheets')
    expect(GOOGLE_WORKSPACE_SCOPES).toContain('https://www.googleapis.com/auth/gmail.modify')
    expect(GOOGLE_WORKSPACE_SCOPES).toContain('https://www.googleapis.com/auth/calendar')
  })

  test('is hidden when dismissed (later)', () => {
    store.set('hanzo.onboarding.later', true)
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toBe('')
  })
})
