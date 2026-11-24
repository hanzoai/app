import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({ cyberOpen: false }))

const part = ({ children, 'data-slot': slot }: { children?: ReactNode; 'data-slot'?: string }) =>
  createElement('div', { 'data-slot': slot }, children)

vi.mock('@hanzo/gui', () => ({ Input: part, XStack: part, YStack: part }))
vi.mock('@hanzo/ui', () => ({ Button: part, Text: part }))
vi.mock('../Betas', () => ({ useBetas: () => ({ open: (id: string) => id === 'cyber' && state.cyberOpen }) }))
vi.mock('../lib/session', () => ({ bearer: () => 'tok_test', org: () => 'hanzo' }))

const { CyberPane } = await import('./CyberPane')

describe('CyberPane alpha gate and native console', () => {
  test('blocks unauthorized users behind the Alpha Gate', () => {
    state.cyberOpen = false
    const html = renderToStaticMarkup(createElement(CyberPane, { path: '/cyber' }))
    expect(html).toContain('data-slot="cyber-alpha-gate"')
    expect(html).toContain('ALPHA')
    expect(html).not.toContain('data-slot="cyber-pane"')
  })

  test('renders native Hanzo Cyber console when beta.cyber is enabled', () => {
    state.cyberOpen = true
    const html = renderToStaticMarkup(createElement(CyberPane, { path: '/cyber/findings' }))
    expect(html).toContain('data-slot="cyber-pane"')
    expect(html).toContain('Hanzo Cyber')
    expect(html).toContain('ALPHA')
    expect(html).toContain('Seed MDTF Lab')
  })
})
