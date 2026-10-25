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
}))

vi.mock('./lib/session', () => ({
  scope: () => ({ Authorization: 'Bearer mock-token' }),
}))

vi.mock('./where', () => ({
  brand: () => 'Hanzo',
  site: (p: string) => `https://hanzo.ai${p}`,
}))

import { Setup } from './Setup'

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

  test('advances to Step 3 (Google Workspace) when GitHub and Slack are connected', () => {
    store.set('hanzo.onboarding.github', true)
    store.set('hanzo.onboarding.slack', true)
    store.set('hanzo.onboarding.step', 3)
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toContain('3. Connect Google')
    expect(html).toContain('Connect Google')
    expect(html).toContain('Skip')
  })

  test('shows completion state when all 3 are finished', () => {
    store.set('hanzo.onboarding.github', true)
    store.set('hanzo.onboarding.slack', true)
    store.set('hanzo.onboarding.google', true)
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toContain('GitHub, Slack &amp; Google connected')
    expect(html).toContain('Done')
  })

  test('is hidden when dismissed (later)', () => {
    store.set('hanzo.onboarding.later', true)
    const html = renderToStaticMarkup(createElement(Setup))
    expect(html).toBe('')
  })
})
