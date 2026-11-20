// @vitest-environment happy-dom
import { act, createElement, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Thread } from '@hanzo/ai'
import { useRenaming } from './renaming'

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
const thread = { id: 'c1', title: 'Plan' } as Thread
const close = vi.fn()
const rename = vi.fn()
let out: ReturnType<typeof useRenaming>
let row: HTMLButtonElement

function mount() {
  row = document.createElement('button')
  document.body.append(row)
  const Probe = () => {
    const from = useRef<HTMLElement | null>(row)
    out = useRenaming(from, close, rename, 'Untitled')
    return null
  }
  const root = createRoot(document.createElement('div'))
  act(() => root.render(createElement(Probe)))
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
  close.mockReset()
  rename.mockReset()
})

describe('leaving the rename field', () => {
  test('saving closes the field, sends the new title and puts focus back on the row', async () => {
    mount()
    act(() => out.commit(thread, '  Launch plan '))
    await frame()
    expect(close).toHaveBeenCalledWith(null)
    expect(rename).toHaveBeenCalledExactlyOnceWith(thread, 'Launch plan')
    expect(document.activeElement).toBe(row)
  })

  test('cancelling puts focus back too, and sends nothing', async () => {
    mount()
    act(() => out.cancel())
    await frame()
    expect(rename).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(row)
  })

  test('an unchanged or empty title sends nothing, and focus still returns', async () => {
    mount()
    act(() => out.commit(thread, 'Plan'))
    act(() => out.commit(thread, '  '))
    await frame()
    expect(rename).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(row)
  })
})
