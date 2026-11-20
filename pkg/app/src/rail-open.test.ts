// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { useSidebar } from './rail-open'

let root: Root
let seen: ReturnType<typeof useSidebar>
const Probe = () => {
  seen = useSidebar()
  return null
}
const mount = () => act(() => root.render(createElement(Probe)))
const kept = () => localStorage.getItem('hanzo.build.rail')

beforeEach(() => {
  root = createRoot(document.createElement('div'))
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true })
})
afterEach(() => {
  act(() => root.unmount())
  localStorage.clear()
})

describe('the Shell’s sidebar', () => {
  test('opens on a wide window and shuts on a narrow one when nothing was kept', () => {
    mount()
    expect(seen[0]).toBe(true)
    act(() => root.unmount())
    root = createRoot(document.createElement('div'))
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
    mount()
    expect(seen[0]).toBe(false)
    expect(kept()).toBeNull()
  })

  test('starts from Hanzo’s earlier key once, and a choice is kept under hanzo.build.rail only', () => {
    localStorage.setItem('hanzo:sidebar:open', 'false')
    mount()
    expect(seen[0]).toBe(false)
    act(() => seen[1](true))
    expect(seen[0]).toBe(true)
    expect(kept()).toBe('false')
    expect(localStorage.getItem('hanzo.nav.open')).toBeNull()
  })

  test('what was kept wins over the earlier key', () => {
    localStorage.setItem('hanzo.build.rail', 'true')
    localStorage.setItem('hanzo:sidebar:open', 'true')
    mount()
    expect(seen[0]).toBe(false)
  })

  test('a pick on a phone shuts it for now without keeping that, and the next toggle opens it', () => {
    localStorage.setItem('hanzo.build.rail', 'false')
    mount()
    expect(seen[0]).toBe(true)
    act(() => seen[2]())
    expect(seen[0]).toBe(false)
    expect(kept()).toBe('false')
    act(() => seen[1]((open) => !open))
    expect(seen[0]).toBe(true)
  })
})
