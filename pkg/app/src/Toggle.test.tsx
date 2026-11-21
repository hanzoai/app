import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s, dir: 'ltr', locale: 'en' }) }))
vi.mock('@hanzo/gui', () => {
  const box = (tag: string) => ({ children, 'aria-label': label, 'data-slot': slot, width, height, render: _r }: Record<string, unknown>) =>
    createElement(tag, { 'aria-label': label, 'data-slot': slot, 'data-w': width, 'data-h': height }, children as ReactNode)
  return { XStack: box('button'), YStack: box('div'), Text: box('span') }
})
vi.mock('@hanzo/ui', () => ({ Tooltip: ({ children }: { children: ReactNode }) => children, TooltipTrigger: ({ children }: { children: ReactNode }) => children, TooltipContent: () => null }))

vi.mock('./host', () => ({ useHost: () => ({ path: '/dev' }) }))

import { Toggle, TOGGLE } from './Toggle'

describe('sidebar Toggle', () => {
  test('the open and the folded state draw the same 28px PanelLeft button', () => {
    const open = renderToStaticMarkup(createElement(Toggle, { open: true, onPress: () => {} }))
    const folded = renderToStaticMarkup(createElement(Toggle, { open: false, tooltip: true, onPress: () => {} }))
    for (const html of [open, folded]) {
      expect(html).toContain('data-slot="sidebar-toggle"')
      expect(html).toContain(`data-w="${TOGGLE}"`)
      expect(html).toContain('lucide-panel-left')
      expect(html).toContain('width="16"')
    }
    expect(TOGGLE).toBe(28)
  })

  test('the label names what a press does, in the one component', () => {
    const labelled = (open: boolean) => renderToStaticMarkup(createElement(Toggle, { open, tooltip: true, onPress: () => {} }))
    expect(labelled(true)).toContain('aria-label="Close sidebar"')
    expect(labelled(false)).toContain('aria-label="Open sidebar"')
  })

  test('a press and a move both dismiss the tooltip (the Tooltip is controlled)', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('./Toggle.tsx', import.meta.url), 'utf8')
    expect(src).toContain('open={shown}')
    expect(src).toContain('setShown(false)\n        onPress()')
    expect(src).toContain('[path, open]')
  })
})
