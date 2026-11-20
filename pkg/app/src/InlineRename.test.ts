// @vitest-environment happy-dom
import { act, createElement, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/gui', () => ({ XStack: ({ children }: { children?: ReactNode }) => createElement('div', null, children) }))
vi.mock('@hanzo/ui', () => ({
  Input: ({ value, onChangeText, onKeyDown, onBlur }: { value: string; onChangeText: (v: string) => void; onKeyDown: (e: unknown) => void; onBlur: () => void }) =>
    createElement('input', { value, onChange: (e: ChangeEvent<HTMLInputElement>) => onChangeText(e.target.value), onKeyDown: (e: KeyboardEvent) => onKeyDown(e), onBlur }),
}))

const { InlineRename } = await import('./InlineRename')

let root: Root
let box: HTMLElement
const saved = vi.fn()
const cancelled = vi.fn()
const field = () => box.querySelector('input')!
const type = (value: string) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    set.call(field(), value)
    field().dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const key = (k: string) => act(() => void field().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })))

beforeEach(() => {
  box = document.createElement('div')
  document.body.append(box)
  root = createRoot(box)
  act(() => root.render(createElement(InlineRename, { initial: 'Plan', onSave: saved, onCancel: cancelled })))
})
afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
  saved.mockReset()
  cancelled.mockReset()
})

describe('renaming a conversation in its row', () => {
  test('Enter saves the trimmed title, once, even when the field then loses focus', () => {
    type('  Launch plan ')
    key('Enter')
    act(() => void field().dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    field().blur()
    expect(saved).toHaveBeenCalledExactlyOnceWith('Launch plan')
    expect(cancelled).not.toHaveBeenCalled()
  })

  test('Escape cancels and keeps the old title', () => {
    type('Something else')
    key('Escape')
    expect(cancelled).toHaveBeenCalledTimes(1)
    expect(saved).not.toHaveBeenCalled()
  })

  test('an empty title is not saved', () => {
    type('   ')
    key('Enter')
    expect(saved).not.toHaveBeenCalled()
    expect(cancelled).toHaveBeenCalledTimes(1)
  })
})
