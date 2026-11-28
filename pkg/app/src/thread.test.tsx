// @vitest-environment happy-dom
import { act, createElement, Fragment, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { ctxEvents } = vi.hoisted(() => ({
  ctxEvents: { openChange: null as ((open: boolean, event?: { preventDefault?: () => void }) => void) | null },
}))

vi.mock('@hanzo/i18n/react', () => ({
  useI18n: () => ({ t: (s: string, v?: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? '')), dir: 'ltr' }),
}))
vi.mock('@hanzo/ai/react', () => ({ useAi: () => null }))

// Every kit part forwards DOM handlers, data-*, aria-*, title, and borderWidth so multi-select,
// Shift+click, drag-select, touch-drag, right-click, and batch-bar layout are exercised against the real DOM.
vi.mock('@hanzo/ui', () => {
  type Props = Record<string, unknown> & { children?: ReactNode }
  const domProps = (p: Props) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(p)) {
      if (
        k.startsWith('data-') ||
        k.startsWith('aria-') ||
        k === 'role' ||
        k === 'title' ||
        k === 'id' ||
        k === 'type' ||
        k === 'disabled' ||
        k === 'onClick' ||
        k === 'onClickCapture' ||
        k === 'onMouseDown' ||
        k === 'onMouseUp' ||
        k === 'onMouseEnter' ||
        k === 'onPointerDown' ||
        k === 'onPointerDownCapture' ||
        k === 'onPointerUp' ||
        k === 'onPointerUpCapture' ||
        k === 'onContextMenu' ||
        k === 'onContextMenuCapture'
      ) {
        out[k] = v
      }
    }
    if (p.onPress && !out.onClick) out.onClick = p.onPress
    if (p.borderWidth !== undefined) out['data-border-width'] = String(p.borderWidth)
    return out
  }
  const part = (p: Props) => {
    const tag = p.render === 'button' ? 'button' : 'div'
    return createElement(tag, domProps(p), p.children)
  }
  const through = ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children)
  return {
    ...Object.fromEntries(
      [
        'Box',
        'Button',
        'Checkbox',
        'Label',
        'ContextMenuContent',
        'ContextMenuItem',
        'ContextMenuSeparator',
        'ContextMenuShortcut',
        'ContextMenuTrigger',
        'DialogContent',
        'DialogDescription',
        'DialogTitle',
        'DropdownMenu',
        'DropdownMenuContent',
        'DropdownMenuItem',
        'DropdownMenuSeparator',
        'DropdownMenuShortcut',
        'DropdownMenuTrigger',
        'Input',
        'SizableText',
        'Text',
        'XStack',
        'YStack',
      ].map((name) => [name, part]),
    ),
    ContextMenu: ({ children, onOpenChange }: { children?: ReactNode; onOpenChange?: (open: boolean, event?: { preventDefault?: () => void }) => void }) => {
      ctxEvents.openChange = onOpenChange ?? null
      return createElement('div', { 'data-slot': 'context-menu-root' }, children)
    },
    Tooltip: through,
    TooltipTrigger: through,
    TooltipContent: ({ children }: { children?: ReactNode }) => createElement('span', { 'data-slot': 'tooltip-content', hidden: true }, children),
    Dialog: ({ open, children }: { open?: boolean; children?: ReactNode }) => (open ? createElement('div', { role: 'dialog' }, children) : null),
    toast: Object.assign(() => {}, { success: () => {}, error: () => {} }),
  }
})
vi.mock('@hanzo/gui', () => {
  type Props = Record<string, unknown> & { children?: ReactNode }
  const part = (p: Props) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(p)) {
      if (
        k.startsWith('data-') ||
        k.startsWith('aria-') ||
        k === 'role' ||
        k === 'title' ||
        k === 'id' ||
        k === 'type' ||
        k === 'disabled' ||
        k === 'onClick' ||
        k === 'onClickCapture' ||
        k === 'onMouseDown' ||
        k === 'onMouseUp' ||
        k === 'onMouseEnter' ||
        k === 'onPointerDown' ||
        k === 'onPointerDownCapture' ||
        k === 'onPointerUp' ||
        k === 'onPointerUpCapture' ||
        k === 'onContextMenu' ||
        k === 'onContextMenuCapture'
      ) {
        out[k] = v
      }
    }
    if (p.onPress && !out.onClick) out.onClick = p.onPress
    if (p.borderWidth !== undefined) out['data-border-width'] = String(p.borderWidth)
    return createElement(p.render === 'button' ? 'button' : 'div', out, p.children)
  }
  return Object.fromEntries(['XStack', 'YStack', 'Text', 'SizableText', 'Input'].map((name) => [name, part]))
})

import { ConversationMenu, ThreadRow, type Thread } from './thread'

let root: Root
let host: HTMLElement

const list: Thread[] = [
  { id: 'a', title: 'Quote for the Murphys', updatedAt: '2026-11-21T10:00:00Z' } as unknown as Thread,
  { id: 'b', title: 'Roof survey notes', updatedAt: '2026-11-21T09:00:00Z' } as unknown as Thread,
  { id: 'c', title: 'Timber quote', updatedAt: '2026-11-21T08:00:00Z' } as unknown as Thread,
  { id: 'd', title: 'Site inspection', updatedAt: '2026-11-21T07:00:00Z' } as unknown as Thread,
]
const threads = new Map<string, Thread>(list.map((t) => [t.id, t]))

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  ctxEvents.openChange = null
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  vi.useRealTimers()
  act(() => root.unmount())
  host.remove()
})

const selectedIds = () => [...host.querySelectorAll('[data-thread][data-selected]')].map((el) => el.getAttribute('data-thread'))

function renderRows(opts: { active?: string | null; onOpen?: (id: string) => void; act?: Record<string, unknown> } = {}) {
  const onOpen = opts.onOpen ?? vi.fn()
  const act_ = (opts.act ?? { remove: vi.fn(async () => true), rename: vi.fn(async () => true), pin: vi.fn(async () => true), archive: vi.fn(async () => true) }) as never
  act(() =>
    root.render(
      createElement(
        ConversationMenu,
        {
          threads,
          active: opts.active ?? null,
          customActions: act_,
          canShare: false,
          children: createElement(
            'div',
            { role: 'list' },
            ...list.map((t) =>
              createElement(ThreadRow, {
                key: t.id,
                t,
                active: opts.active === t.id,
                children: createElement('button', { type: 'button', 'data-slot': `open-${t.id}`, onClick: () => onOpen(t.id) }, t.title),
              }),
            ),
          ),
        },
      ),
    ),
  )
  return { onOpen, act: act_ as Record<string, ReturnType<typeof vi.fn>> }
}

describe('ConversationMenu', () => {
  test('Backspace with chats selected asks first, naming them, and deletes only on Delete', async () => {
    const remove = vi.fn(async (_: Thread) => true)
    const two = new Map(list.slice(0, 2).map((t) => [t.id, t]))
    const act_ = { remove, rename: vi.fn(), pin: vi.fn(), archive: vi.fn() } as never
    act(() => root.render(createElement(ConversationMenu, { threads: two, customActions: act_, canShare: false, children: createElement('div') })))
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
    const two = new Map(list.slice(0, 2).map((t) => [t.id, t]))
    const act_ = { remove, rename: vi.fn(), pin: vi.fn(), archive: vi.fn() } as never
    const field = document.createElement('input')
    document.body.append(field)
    try {
      act(() => root.render(createElement(ConversationMenu, { threads: two, customActions: act_, canShare: false, children: createElement('div') })))
      act(() => void window.dispatchEvent(new CustomEvent('hanzo:recents-select', { detail: { mode: 'all' } })))
      field.focus()
      for (const key of ['Backspace', 'Delete']) act(() => void field.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })))
      expect(document.querySelector('[data-slot="confirm"]')).toBeNull()
      expect(remove).not.toHaveBeenCalled()
    } finally {
      field.remove()
    }
  })

  test('Shift+click selects inclusive range in DOM order, preserves anchor, and never navigates', () => {
    const { onOpen } = renderRows({ active: 'a' })
    const btnC = host.querySelector<HTMLElement>('[data-slot="open-c"]')!
    const btnD = host.querySelector<HTMLElement>('[data-slot="open-d"]')!

    // Shift+mousedown + Shift+click on C selects A..C without opening C
    act(() => {
      btnC.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, shiftKey: true }))
      btnC.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }))
    })
    expect(selectedIds()).toEqual(['a', 'b', 'c'])
    expect(onOpen).not.toHaveBeenCalled()

    // Second Shift+click on D extends range from original anchor A -> A..D
    act(() => {
      btnD.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, shiftKey: true }))
      btnD.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true }))
    })
    expect(selectedIds()).toEqual(['a', 'b', 'c', 'd'])
    expect(onOpen).not.toHaveBeenCalled()
  })

  test('Cmd/Ctrl+click toggles multi-select cleanly without navigating, and normal click toggles while in select mode', () => {
    const { onOpen } = renderRows()
    const btnA = host.querySelector<HTMLElement>('[data-slot="open-a"]')!
    const btnC = host.querySelector<HTMLElement>('[data-slot="open-c"]')!

    act(() => void btnA.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })))
    expect(selectedIds()).toEqual(['a'])
    expect(onOpen).not.toHaveBeenCalled()

    // Already in select mode: plain click on C toggles C on without navigating
    act(() => void btnC.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
    expect(selectedIds()).toEqual(['a', 'c'])
    expect(onOpen).not.toHaveBeenCalled()

    // Plain click on A toggles A off
    act(() => void btnA.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
    expect(selectedIds()).toEqual(['c'])
  })

  test('desktop click-drag across rows selects the dragged range without navigating', () => {
    const { onOpen } = renderRows()
    const rowA = host.querySelector<HTMLElement>('[data-thread="a"]')!
    const rowC = host.querySelector<HTMLElement>('[data-thread="c"]')!

    act(() => {
      rowA.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, buttons: 1 }))
      rowC.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, buttons: 1 }))
      rowC.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, buttons: 1 }))
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }))
    })
    expect(selectedIds()).toEqual(['a', 'b', 'c'])
    expect(onOpen).not.toHaveBeenCalled()
  })

  test('mobile touch long-press enters select mode and drags across rows; quick scroll cancels long-press', () => {
    vi.useFakeTimers()
    renderRows()
    const rowA = host.querySelector<HTMLElement>('[data-thread="a"]')!
    const rowB = host.querySelector<HTMLElement>('[data-thread="b"]')!
    const origElementFromPoint = document.elementFromPoint
    document.elementFromPoint = vi.fn(() => rowB)

    try {
      // Quick vertical touch scroll cancels long-press before 420ms
      act(() => {
        rowA.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 20, clientY: 10 }))
        window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'touch', clientX: 20, clientY: 40 }))
        vi.advanceTimersByTime(500)
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }))
      })
      expect(selectedIds()).toEqual([])

      // Stationary touch held for 420ms activates touch-drag select and drags down to rowB
      act(() => {
        rowA.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientX: 20, clientY: 10 }))
        vi.advanceTimersByTime(450)
        window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'touch', clientX: 20, clientY: 50 }))
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch' }))
      })
      expect(selectedIds()).toEqual(['a', 'b'])
    } finally {
      document.elementFromPoint = origElementFromPoint
    }
  })

  test('compact borderless batch-bar hides Pin/Archive/Group words, uses icon-only buttons with aria-labels, and opens delete confirm', () => {
    renderRows()
    act(() => void window.dispatchEvent(new CustomEvent('hanzo:recents-select', { detail: { mode: 'all' } })))

    const bar = host.querySelector<HTMLElement>('[data-slot="batch-bar"]')!
    expect(bar).not.toBeNull()
    expect(bar.getAttribute('data-border-width')).toBe('0')

    // Check every compact icon-only action control is present
    const pinBtn = bar.querySelector<HTMLElement>('[data-slot="batch-pin"]')!
    const archiveBtn = bar.querySelector<HTMLElement>('[data-slot="batch-archive"]')!
    const groupBtn = bar.querySelector<HTMLElement>('[data-slot="batch-organize"]')!
    const deleteBtn = bar.querySelector<HTMLElement>('[data-slot="batch-delete"]')!
    const selectAllBtn = bar.querySelector<HTMLElement>('[data-slot="batch-select-all"]')!
    const doneBtn = bar.querySelector<HTMLElement>('[data-slot="batch-done"]')!

    expect(pinBtn.getAttribute('aria-label')).toBe('Pin selected')
    expect(archiveBtn.getAttribute('aria-label')).toBe('Archive selected')
    expect(groupBtn.getAttribute('aria-label')).toBe('Organize selected')
    expect(deleteBtn.getAttribute('aria-label')).toBe('Delete selected')
    expect(selectAllBtn.textContent).toContain('4')
    expect(doneBtn.textContent).toContain('Done')

    // Visible button content (excluding hidden tooltip content) must NOT show the words Pin, Archive, or Group
    expect(pinBtn.textContent?.trim()).toBe('')
    expect(archiveBtn.textContent?.trim()).toBe('')
    expect(groupBtn.textContent?.trim()).toBe('')
    expect(deleteBtn.textContent?.trim()).toBe('')

    // Clicking trash opens confirmation dialog
    act(() => deleteBtn.click())
    expect(document.querySelector('[data-slot="confirm"]')?.textContent).toContain('Delete 4 chats?')
  })

  test('right-clicking any row sets target reliably in capture phase and offers Select (single) and Delete (n) (multi)', () => {
    renderRows()
    const rowB = host.querySelector<HTMLElement>('[data-thread="b"]')!

    // Simulate right-click followed by Radix/gui synthetic onOpenChange(true, { preventDefault })
    const prevent = vi.fn()
    act(() => {
      rowB.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
      ctxEvents.openChange?.(true, { preventDefault: prevent })
    })
    expect(prevent).not.toHaveBeenCalled()
    expect(host.textContent).toContain('Rename')
    expect(host.textContent).toContain('Select')
    expect(host.textContent).toContain('Delete')

    // When multiple rows are selected, right-click menu switches to batch items including Delete (2)
    const btnA = host.querySelector<HTMLElement>('[data-slot="open-a"]')!
    const btnB = host.querySelector<HTMLElement>('[data-slot="open-b"]')!
    act(() => void btnA.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })))
    act(() => void btnB.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
    act(() => {
      rowB.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
      ctxEvents.openChange?.(true, { preventDefault: prevent })
    })
    expect(host.textContent).toContain('Delete (2)')
  })
})
