// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string, v?: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? '')), dir: 'ltr' }) }))
vi.mock('@hanzo/ai/react', () => ({ useAi: () => null }))
// Every kit part is a plain element; a dialog draws its children only while open.
vi.mock('@hanzo/ui', () => {
  const part = ({ children, onPress, onClick, 'data-slot': slot }: { children?: ReactNode; onPress?: () => void; onClick?: () => void; 'data-slot'?: string }) =>
    createElement('div', { 'data-slot': slot, onClick: onPress ?? onClick }, children)
  return {
    ...Object.fromEntries(['Box', 'Button', 'Checkbox', 'Label', 'ContextMenu', 'ContextMenuContent', 'ContextMenuItem', 'ContextMenuSeparator', 'ContextMenuShortcut', 'ContextMenuTrigger', 'DialogContent', 'DialogDescription', 'DialogTitle', 'DropdownMenu', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuSeparator', 'DropdownMenuShortcut', 'DropdownMenuTrigger', 'Input', 'SizableText', 'Text', 'XStack', 'YStack'].map((name) => [name, part])),
    Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) => (open ? createElement('div', { role: 'dialog' }, children) : null),
    toast: Object.assign(() => {}, { success: () => {}, error: () => {} }),
  }
})
vi.mock('@hanzo/gui', () => {
  const part = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
  return Object.fromEntries(['XStack', 'YStack', 'Text', 'SizableText', 'Input'].map((name) => [name, part]))
})

import { ConversationMenu, type Thread } from './thread'

let root: Root
let host: HTMLElement
const threads = new Map<string, Thread>(
  [
    { id: 'a', title: 'Quote for the Murphys' },
    { id: 'b', title: 'Roof survey notes' },
  ].map((t) => [t.id, { ...t, updatedAt: '2026-11-21T10:00:00Z' } as unknown as Thread]),
)

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('ConversationMenu', () => {
  test('Backspace with chats selected asks first, naming them, and deletes only on Delete', async () => {
    const remove = vi.fn(async (_: Thread) => true)
    const act_ = { remove, rename: vi.fn(), pin: vi.fn(), archive: vi.fn() } as never
    act(() => root.render(createElement(ConversationMenu, { threads, customActions: act_, canShare: false, children: createElement('div') })))
    act(() => void window.dispatchEvent(new CustomEvent('hanzo:recents-select', { detail: { mode: 'all' } })))
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' })))
    expect(remove).not.toHaveBeenCalled()
    const dialog = document.querySelector('[data-slot="confirm"]')
    expect(dialog?.textContent).toContain('Delete 2 chats?')
    expect(dialog?.textContent).toContain('Quote for the Murphys')
    expect(dialog?.textContent).toContain('Roof survey notes')
    act(() => (document.querySelector('[data-slot="confirm-cancel"]') as HTMLElement).click())
    expect(remove).not.toHaveBeenCalled()
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' })))
    await act(async () => (document.querySelector('[data-slot="confirm-yes"]') as HTMLElement).click())
    expect(remove.mock.calls.map(([t]) => (t as Thread).id).sort()).toEqual(['a', 'b'])
  })

  test('Backspace typed in a field never deletes chats, and never asks to', async () => {
    const remove = vi.fn(async (_: Thread) => true)
    const act_ = { remove, rename: vi.fn(), pin: vi.fn(), archive: vi.fn() } as never
    const field = document.createElement('input')
    document.body.append(field)
    try {
      act(() => root.render(createElement(ConversationMenu, { threads, customActions: act_, canShare: false, children: createElement('div') })))
      act(() => void window.dispatchEvent(new CustomEvent('hanzo:recents-select', { detail: { mode: 'all' } })))
      field.focus()
      for (const key of ['Backspace', 'Delete']) act(() => void field.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })))
      expect(document.querySelector('[data-slot="confirm"]')).toBeNull()
      expect(remove).not.toHaveBeenCalled()
    } finally {
      field.remove()
    }
  })
})
