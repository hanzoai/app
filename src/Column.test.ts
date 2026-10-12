import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

// The drawing libraries are not under test and do not load outside a bundler.
// A part draws its children as a div, or, given `render`, as that element, the
// way gui draws a part into the element it is handed.
const { rail, part } = vi.hoisted(() => {
  type Part = { children?: ReactNode; render?: ReactElement; icon?: ReactNode; label?: string; 'data-slot'?: string; role?: string }
  const part = ({ children, render, icon, label, 'data-slot': slot, role }: Part) => {
    const attrs = { 'data-slot': slot, 'aria-label': label, role }
    const kids = [icon, children].filter((k) => k != null)
    return isValidElement(render) ? cloneElement(render, attrs, ...kids) : createElement('div', attrs, ...kids)
  }
  return { rail: { collapsed: false }, part }
})

vi.mock('@hanzo/gui', () => ({ Text: part, XStack: part, YStack: part }))
vi.mock('@hanzo/ui/chat', () => ({ Sidebar: part, SidebarIconButton: part, SidebarItem: part }))
vi.mock('@hanzogui/shell', () => ({ HanzoMark: () => null }))
vi.mock('@hanzo/build', () => ({
  Grip: () => null,
  NEW: 'new',
  nav: () => [
    {
      id: 'work',
      label: 'Work',
      links: [
        { id: 'new', label: 'New run', icon: null },
        { id: 'projects', label: 'Projects', icon: null },
      ],
    },
  ],
}))
vi.mock('./ModeMark', () => ({ ModeMark: () => null }))
vi.mock('./Me', () => ({ Made: () => null, Me: () => null }))
vi.mock('./Recents', () => ({ Recents: () => null }))
vi.mock('./Setup', () => ({ Setup: () => null }))
vi.mock('./kept', () => ({ useKept: () => [rail.collapsed, () => {}] }))
vi.mock('./span', () => ({ useSpan: () => ({ ref: null, style: {}, span: 272, move: () => {}, keep: () => {} }) }))
vi.mock('./lib/session', () => ({ pick: () => {} }))

import { Column } from './Column'
import { TERMINALS } from './lib/host'
import type { Mode } from './recent'

const draw = (mode: Mode, collapsed: boolean) => {
  rail.collapsed = collapsed
  const host = { go: () => {} } as unknown as Parameters<typeof Column>[0]['host']
  return renderToStaticMarkup(createElement(Column, { host, mode, thread: null, onChat: () => {}, onDev: () => {}, go: () => {} }))
}

const LINK = `<a href="${TERMINALS}" target="_blank" rel="noopener noreferrer" data-slot="app-terminals"`

describe('Terminals', () => {
  test('the address is the platform’s', () => {
    expect(TERMINALS).toBe('https://platform.hanzo.ai/terminals')
  })

  for (const mode of ['chat', 'dev'] as const)
    for (const collapsed of [false, true])
      test(`${mode}, ${collapsed ? 'collapsed' : 'open'}: a link out, right under New`, () => {
        const html = draw(mode, collapsed)
        expect(html.split(LINK)).toHaveLength(2)
        const link = html.slice(html.indexOf(LINK))
        expect(link).toMatch(/^<a [^>]*role="link"/)
        if (collapsed) expect(link).toMatch(/^<a [^>]*aria-label="Terminals"/)
        else expect(link).toMatch(/^<a [^>]*>[^]*?Terminals<\/a>/)
        const before = html.slice(0, html.indexOf(LINK))
        const next = mode === 'chat' ? 'New chat' : 'New run'
        expect(before).toContain(next)
        if (mode === 'dev') {
          expect(before).not.toContain('Projects')
          expect(link).toContain('Projects')
        }
      })
})
