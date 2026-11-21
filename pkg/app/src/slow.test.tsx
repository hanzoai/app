// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/ui', () => {
  const box = (tag: string) => ({ children, role, 'data-slot': slot, onPress }: { children?: ReactNode; role?: string; 'data-slot'?: string; onPress?: () => void }) =>
    createElement(tag, { role, 'data-slot': slot, onClick: onPress }, children)
  return { Button: box('button'), Text: box('span'), XStack: box('div'), YStack: box('div') }
})

const { Loading, SLOW } = await import('./slow')

let root: Root
let box: HTMLElement
beforeEach(() => {
  vi.useFakeTimers()
  box = document.createElement('div')
  document.body.append(box)
  root = createRoot(box)
})
afterEach(() => {
  act(() => root.unmount())
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('a page that is loading', () => {
  test('says what it is loading in words, as a status, at once', () => {
    act(() => root.render(createElement(Loading, { label: 'Loading your machines…' })))
    expect(box.querySelector('[role="status"]')?.textContent).toBe('Loading your machines…')
    expect(box.textContent).not.toContain('Still loading')
  })

  test('after five seconds says it is still loading, and Try again asks again and restarts the wait', () => {
    const retry = vi.fn()
    act(() => root.render(createElement(Loading, { label: 'Loading your machines…', onRetry: retry })))
    act(() => void vi.advanceTimersByTime(SLOW))
    expect(SLOW).toBe(5000)
    expect(box.textContent).toContain('Still loading')
    act(() => (box.querySelector('[data-slot="loading-retry"]') as HTMLElement).click())
    expect(retry).toHaveBeenCalledOnce()
    expect(box.textContent).not.toContain('Still loading')
  })

  test('without a way to ask again there is no Try again', () => {
    act(() => root.render(createElement(Loading, { label: 'Loading' })))
    act(() => void vi.advanceTimersByTime(SLOW))
    expect(box.textContent).toContain('Still loading')
    expect(box.querySelector('[data-slot="loading-retry"]')).toBeNull()
  })
})
