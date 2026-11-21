import { createElement as h, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

// Every piece draws its children (a menu's content too, as if it were open) and its slot, so a test reads what is offered.
const { box } = vi.hoisted(() => ({
  box: ({ children, 'data-slot': slot, 'aria-label': label }: { children?: ReactNode; 'data-slot'?: string; 'aria-label'?: string }) =>
    ({ $$typeof: Symbol.for('react.transitional.element'), type: 'div', key: null, ref: null, props: { 'data-slot': slot, 'aria-label': label, children }, _owner: null, _store: {} }),
}))
vi.mock('@hanzo/ui', () => ({
  DropdownMenu: box,
  DropdownMenuContent: box,
  DropdownMenuItem: box,
  DropdownMenuLabel: box,
  DropdownMenuSeparator: box,
  DropdownMenuTrigger: box,
  Switch: ({ checked, 'aria-label': label }: { checked?: boolean; 'aria-label'?: string }) => h('input', { type: 'checkbox', checked, readOnly: true, 'aria-label': label }),
  Text: box,
  XStack: box,
  YStack: box,
}))
vi.mock('lucide-react', () => ({ Check: () => h('i', { 'data-check': '' }), Sparkles: () => null }))
vi.mock('./lib/dev-mode', () => ({ useDevMode: () => [true, () => {}] }))

const { Bring } = await import('./bring')
const { DeveloperMode } = await import('./developer')

describe('how skills, agents and personas join a message (hanzo-inc/app issue 314)', () => {
  test('offers Let Hanzo choose and Preload into this chat, saying that preloading uses context', () => {
    const html = renderToStaticMarkup(h(Bring, { value: 'choose', onChange: () => {}, last: ['frontend-design'] }))
    expect(html).toContain('Skills: Auto')
    expect(html).toContain('Let Hanzo choose')
    expect(html).toContain('No / commands needed.')
    expect(html).toContain('Preload into this chat')
    expect(html).toContain('Preloading uses context.')
    expect(html).toContain('Brought into your last message: frontend-design')
  })

  test('says Preload once it is chosen, and no longer what Hanzo brought in', () => {
    const html = renderToStaticMarkup(h(Bring, { value: 'preload', onChange: () => {}, last: ['frontend-design'] }))
    expect(html).toContain('Skills: Preload')
    expect(html).not.toContain('Brought into your last message')
  })
})

describe('Developer mode in Settings › General (hanzo-inc/app issue 321)', () => {
  test('is a named switch that says what it shows', () => {
    const html = renderToStaticMarkup(h(DeveloperMode))
    expect(html).toContain('data-slot="settings-dev-mode"')
    expect(html).toContain('aria-label="Developer mode"')
    expect(html).toContain('checked=""')
    expect(html).toContain('the terminal, the commands Hanzo runs and each step. Off, Hanzo shows the result.')
  })
})
