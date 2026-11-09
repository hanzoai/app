import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// The drawing libraries are not under test and do not load outside a bundler.
// A part draws its children as a div carrying its slot and name; a press is kept
// by slot, so a test can press a button.
const { part, pressed, mark } = vi.hoisted(() => {
  type Part = { children?: ReactNode; 'aria-label'?: string; 'data-slot'?: string; onPress?: () => void }
  const pressed = new Map<string, (() => void) | undefined>()
  const part = ({ children, 'aria-label': label, 'data-slot': slot, onPress }: Part) => {
    if (slot) pressed.set(slot, onPress)
    return createElement('div', { 'data-slot': slot, 'aria-label': label }, children)
  }
  const mark = (name: string) => () => createElement('svg', { 'data-mark': name })
  return { part, pressed, mark }
})

vi.mock('@hanzo/gui', () => ({ Text: part, XStack: part }))
const made = vi.fn()
vi.mock('./Sidebar', () => ({ dispatchTabsAction: (d: { kind: string }) => calls.push(`tabs ${d.kind}`) }))
vi.mock('@hanzo/build', () => ({
  MARKS: {
    chat: { icon: mark('chat'), make: mark('chat-make') },
    dev: { icon: mark('dev'), make: mark('dev-make') },
    studio: { icon: mark('studio'), make: mark('studio-make') },
    tabs: { icon: mark('tabs'), make: mark('tabs-make') },
  },
  NEW: 'new',
  nav: () => [{ id: 'work', label: 'Work', links: [{ id: 'new', label: 'New run', onPress: made }, { id: 'projects', label: 'Projects' }] }],
}))

import { Bar } from './Bar'
import type { Place } from './lib/host'

const host = { go: () => {} } as unknown as Parameters<typeof Bar>[0]['host']
const calls: string[] = []
const top = (mode: Place['mode'], places?: Parameters<typeof Bar>[0]['places']) =>
  renderToStaticMarkup(
    createElement(Bar, {
      host,
      mode,
      places,
      go: (a: string) => calls.push(`go ${a}`),
      onMenu: () => calls.push('menu'),
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
  test('the drawer’s button, then New: no switch between them, on any mode', () => {
    for (const mode of ['chat', 'dev', 'tabs'] as const) {
      const html = top(mode)
      expect(html).not.toContain('role="radiogroup"')
      expect(html).not.toContain('bar-mode')
      expect(html).not.toContain('data-value=')
      expect(at(html, 'aria-label="Open sidebar"')).toBeLessThan(at(html, 'data-slot="bar-new"'))
    }
  })

  test('the menu opens the drawer', () => {
    top('chat')
    pressed.get('bar-menu')?.()
    expect(calls).toEqual(['menu'])
  })

  test('New is New chat in Chat, with the pen: the conversation let go of, and /chat', () => {
    const html = top('chat')
    expect(html).toContain('aria-label="New chat"')
    expect(html).toContain('data-mark="chat-make"')
    pressed.get('bar-new')?.()
    expect(calls).toEqual(['go /chat'])
  })

  test('New is the mode’s own New row in Dev, named as the sidebar names it, with `</>`', () => {
    const html = top('dev')
    expect(html).toContain('aria-label="New run"')
    expect(html).toContain('data-mark="dev-make"')
    pressed.get('bar-new')?.()
    expect(made).toHaveBeenCalledOnce()
  })

  test('New is a terminal in Tabs, with the terminal icon', () => {
    const html = top('tabs', [])
    expect(html).toContain('aria-label="New terminal"')
    expect(html).toContain('data-mark="tabs-make"')
    pressed.get('bar-new')?.()
    expect(calls).toEqual(['tabs shell'])
  })

  test('New is Studio’s own New row, named as the sidebar names it', () => {
    const html = top('studio', [{ id: 'make', links: [{ id: 'new', label: 'New creation', icon: null, onPress: () => calls.push('creation') }] }])
    expect(html).toContain('aria-label="New creation"')
    pressed.get('bar-new')?.()
    expect(calls).toEqual(['creation'])
  })

  test('Betas has nothing to make: no New, and the menu keeps the bar', () => {
    const html = top('beta', [])
    expect(html).not.toContain('data-slot="bar-new"')
    expect(html).toContain('aria-label="Open sidebar"')
  })
})
