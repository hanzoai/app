import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// The drawing libraries are not under test and do not load outside a bundler.
// A part draws its children as a div carrying its slot and name; the group
// keeps what it was handed, so a test can press a side.
const { part, group } = vi.hoisted(() => {
  type Part = { children?: ReactNode; 'aria-label'?: string; 'data-slot'?: string; onPress?: () => void }
  const pressed = new Map<string, (() => void) | undefined>()
  const part = ({ children, 'aria-label': label, 'data-slot': slot, onPress }: Part) => {
    if (slot) pressed.set(slot, onPress)
    return createElement('div', { 'data-slot': slot, 'aria-label': label }, children)
  }
  const group = { value: undefined as unknown, change: (_: string) => {}, pressed }
  return { part, group }
})

vi.mock('@hanzo/gui', () => ({ Text: part, XStack: part }))
vi.mock('@hanzo/ui', () => ({
  ToggleGroup: ({ children, value, onValueChange, 'aria-label': label }: { children: ReactNode; value: string; onValueChange: (v: string) => void; 'aria-label': string }) => {
    group.value = value
    group.change = onValueChange
    return createElement('div', { role: 'radiogroup', 'aria-label': label }, children)
  },
  ToggleGroupItem: ({ children, value }: { children: ReactNode; value: string }) => createElement('div', { role: 'radio', 'data-value': value }, children),
}))
const made = vi.fn()
vi.mock('@hanzo/build', () => ({
  NEW: 'new',
  nav: () => [{ id: 'work', label: 'Work', links: [{ id: 'new', label: 'New run', onPress: made }, { id: 'projects', label: 'Projects' }] }],
}))

import { Top } from './Top'
import type { Place } from './lib/host'

const host = { go: () => {} } as unknown as Parameters<typeof Top>[0]['host']
const calls: string[] = []
const top = (mode: Place['mode'], places?: Parameters<typeof Top>[0]['places']) =>
  renderToStaticMarkup(
    createElement(Top, {
      host,
      mode,
      places,
      go: (a: string) => calls.push(`go ${a}`),
      onMenu: () => calls.push('menu'),
      onChat: () => calls.push('chat'),
      onDev: () => calls.push('dev'),
    }),
  )

/** Where a string first stands in the markup, failing when it is absent. */
const at = (html: string, s: string): number => {
  const i = html.indexOf(s)
  expect(i, s).toBeGreaterThanOrEqual(0)
  return i
}

beforeEach(() => {
  calls.length = 0
  made.mockClear()
})

describe('a phone’s bar', () => {
  test('the drawer’s button, then Chat | Dev, then New, in that order', () => {
    const html = top('chat')
    const order = ['aria-label="Open sidebar"', 'role="radiogroup"', 'data-value="chat"', 'data-value="dev"', 'data-slot="bar-new"'].map((s) => at(html, s))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(html).toContain('>Chat<')
    expect(html).toContain('>Dev<')
  })

  test('the side lit is the mode the reader is in, and neither in Studio', () => {
    top('chat')
    expect(group.value).toBe('chat')
    top('dev')
    expect(group.value).toBe('dev')
    top('studio', [{ id: 'make', links: [{ id: 'new', label: 'New creation', icon: null, onPress: () => calls.push('creation') }] }])
    expect(group.value).toBe('')
  })

  test('a side moves the app the way the rail does', () => {
    top('chat')
    group.change('dev')
    group.change('chat')
    expect(calls).toEqual(['dev', 'chat'])
  })

  test('the menu opens the drawer', () => {
    top('chat')
    group.pressed.get('bar-menu')?.()
    expect(calls).toEqual(['menu'])
  })

  test('New is New chat in Chat: the conversation let go of, and /chat', () => {
    const html = top('chat')
    expect(html).toContain('aria-label="New chat"')
    group.pressed.get('bar-new')?.()
    expect(calls).toEqual(['go /chat'])
  })

  test('New is the mode’s own New row elsewhere, named as the sidebar names it', () => {
    expect(top('dev')).toContain('aria-label="New run"')
    group.pressed.get('bar-new')?.()
    expect(made).toHaveBeenCalledOnce()

    expect(top('studio', [{ id: 'make', links: [{ id: 'new', label: 'New creation', icon: null, onPress: () => calls.push('creation') }] }])).toContain('aria-label="New creation"')
    group.pressed.get('bar-new')?.()
    expect(calls).toEqual(['creation'])
  })

  test('Betas has nothing to make: no New, and Chat | Dev keep the middle', () => {
    const html = top('beta', [])
    expect(html).not.toContain('data-slot="bar-new"')
    expect(html).toContain('aria-label="Open sidebar"')
    expect(html).toContain('role="radiogroup"')
  })
})
