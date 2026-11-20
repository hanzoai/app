import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

const { part } = vi.hoisted(() => {
  type Props = {
    children?: ReactNode
    render?: ReactElement | string
    'data-slot'?: string
    gap?: number | string
    shrink?: number
    position?: string
    flex?: number
    minW?: number
    borderWidth?: number
    width?: number | string
    px?: number | string
    p?: number | string
  }
  const part = ({
    children,
    render,
    'data-slot': slot,
    gap,
    shrink,
    position,
    flex,
    minW,
    borderWidth,
    width,
    px,
    p,
  }: Props) => {
    const attrs: Record<string, unknown> = {}
    if (slot !== undefined) attrs['data-slot'] = slot
    if (gap !== undefined) attrs['data-gap'] = String(gap)
    if (shrink !== undefined) attrs['data-shrink'] = String(shrink)
    if (position !== undefined) attrs['data-position'] = position
    if (flex !== undefined) attrs['data-flex'] = String(flex)
    if (minW !== undefined) attrs['data-minw'] = String(minW)
    if (borderWidth !== undefined) attrs['data-border-width'] = String(borderWidth)
    if (width !== undefined) attrs['data-width'] = String(width)
    if (px !== undefined) attrs['data-px'] = String(px)
    if (p !== undefined) attrs['data-p'] = String(p)
    if (isValidElement(render)) return cloneElement(render, attrs)
    return createElement(typeof render === 'string' ? render : 'div', attrs, children)
  }
  return { part }
})

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/ui', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? createElement('div', { 'data-slot': 'dialog' }, children) : null),
  DialogContent: part,
  DialogTitle: part,
  Text: part,
  XStack: part,
  YStack: part,
}))
vi.mock('lucide-react', () => ({
  Search: () => createElement('svg', { 'data-icon': 'search' }),
  X: () => createElement('svg', { 'data-icon': 'x' }),
}))
vi.mock('./Settings', () => ({
  FIRST: 'general',
  SettingsList: ({ filter }: { filter: string }) => createElement('div', { 'data-slot': 'settings-list', 'data-filter': filter }),
}))
vi.mock('./SettingsPane', () => ({
  SettingsPane: ({ id }: { id: string }) => createElement('div', { 'data-slot': 'settings-pane', 'data-id': id }),
}))

import { PreferencesDialog } from './PreferencesDialog'

describe('PreferencesDialog search input layout regression', () => {
  test('renders Search settings icon in a non-shrinking flex slot before the borderless input so it never overlaps placeholder text', () => {
    const html = renderToStaticMarkup(createElement(PreferencesDialog, { open: true, onOpenChange: () => {} }))

    const searchBoxIdx = html.indexOf('data-slot="settings-search"')
    const iconIdx = html.indexOf('data-slot="settings-search-icon"')
    const inputIdx = html.indexOf('data-slot="settings-search-input"')

    expect(searchBoxIdx).toBeGreaterThanOrEqual(0)
    expect(iconIdx).toBeGreaterThan(searchBoxIdx)
    expect(inputIdx).toBeGreaterThan(iconIdx)

    // Container uses explicit flex gap and horizontal padding.
    expect(html).toMatch(/data-slot="settings-search"[^>]*data-gap="8"/)
    expect(html).toMatch(/data-slot="settings-search"[^>]*data-px="10"/)

    // Icon wrapper is in normal flex flow (never overlapping via absolute positioning) and never shrinks.
    const iconTag = html.match(/<div[^>]*data-slot="settings-search-icon"[^>]*>/)?.[0] ?? ''
    expect(iconTag).toContain('data-shrink="0"')
    expect(iconTag).not.toContain('data-position="absolute"')

    // Input is a clean borderless flex child with proper Search settings placeholder and aria-label.
    const inputTag = html.match(/<input[^>]*data-slot="settings-search-input"[^>]*>/)?.[0] ?? ''
    expect(inputTag).toContain('placeholder="Search settings"')
    expect(inputTag).toContain('aria-label="Search settings"')
    expect(inputTag).toContain('data-flex="1"')
    expect(inputTag).toContain('data-minw="0"')
    expect(inputTag).toContain('data-border-width="0"')
  })

  test('uses the unified 256px sidebar width inside the settings dialog', () => {
    const html = renderToStaticMarkup(createElement(PreferencesDialog, { open: true, onOpenChange: () => {} }))
    expect(html).toContain('data-width="256"')
  })
})
