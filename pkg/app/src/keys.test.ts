// @vitest-environment happy-dom
// The workspace's global keys are handled once (keys.ts), for the app and for every Shell view.
import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))

const { handle, useGlobalKeys } = await import('./keys')

const say = (s: string) => s
const press = (init: KeyboardEventInit & { key: string }, target: EventTarget = document.body) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  Object.defineProperty(e, 'target', { value: target })
  return e
}
const keys = () => ({ find: vi.fn(), newChat: vi.fn(), sidebar: vi.fn(), settings: vi.fn(), chooseTheme: vi.fn(), say: vi.fn() })

afterEach(() => {
  document.documentElement.className = ''
  localStorage.clear()
})

describe('the global keys', () => {
  test('⌘K opens the palette, ⌘B the sidebar, ⌘⇧O a new chat', () => {
    const on = keys()
    expect(handle(press({ key: 'k', metaKey: true }), on, say)).toBe(true)
    expect(handle(press({ key: 'b', ctrlKey: true }), on, say)).toBe(true)
    expect(handle(press({ key: 'O', code: 'KeyO', metaKey: true, shiftKey: true }), on, say)).toBe(true)
    expect([on.find, on.sidebar, on.newChat].map((f) => f.mock.calls.length)).toEqual([1, 1, 1])
  })

  test('⌘, opens Settings from anywhere but a field or a dialog', () => {
    const on = keys()
    const e = press({ key: ',', metaKey: true })
    expect(handle(e, on, say)).toBe(true)
    expect(e.defaultPrevented).toBe(true)
    expect(on.settings).toHaveBeenCalledTimes(1)
    const field = document.createElement('input')
    document.body.append(field)
    expect(handle(press({ key: ',', metaKey: true }, field), on, say)).toBe(false)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)
    expect(handle(press({ key: ',', ctrlKey: true }, dialog), on, say)).toBe(false)
    expect(on.settings).toHaveBeenCalledTimes(1)
  })

  test('⌘⇧L hands the new theme to the host, which saves it to the account', () => {
    const on = keys()
    document.documentElement.classList.add('light')
    handle(press({ key: 'L', code: 'KeyL', metaKey: true, shiftKey: true }), on, say)
    expect(on.chooseTheme).toHaveBeenCalledWith('dark')
    document.documentElement.className = ''
    handle(press({ key: 'L', code: 'KeyL', metaKey: true, shiftKey: true }), on, say)
    expect(on.chooseTheme).toHaveBeenLastCalledWith('light')
    expect(on.say).toHaveBeenLastCalledWith('Switched to light theme')
  })

  test('⌘⇧D flips Developer mode and says so', () => {
    const on = keys()
    handle(press({ key: 'D', code: 'KeyD', metaKey: true, shiftKey: true }), on, say)
    expect(on.say).toHaveBeenLastCalledWith('Developer mode enabled')
    handle(press({ key: 'D', code: 'KeyD', metaKey: true, shiftKey: true }), on, say)
    expect(on.say).toHaveBeenLastCalledWith('Developer mode disabled')
  })

  test('a press already answered, or one still composing, is left alone', () => {
    const on = keys()
    const answered = press({ key: 'k', metaKey: true })
    answered.preventDefault()
    expect(handle(answered, on, say)).toBe(false)
    expect(handle(press({ key: 'b', metaKey: true, isComposing: true }), on, say)).toBe(false)
    expect(handle(press({ key: ',', metaKey: true, isComposing: true }), on, say)).toBe(false)
    const settled = press({ key: ',', metaKey: true })
    settled.preventDefault()
    expect(handle(settled, on, say)).toBe(false)
    expect(on.find).not.toHaveBeenCalled()
    expect(on.sidebar).not.toHaveBeenCalled()
    expect(on.settings).not.toHaveBeenCalled()
  })
})

describe('the hook', () => {
  test('listens on the window once while mounted, with the latest handlers, and stops when unmounted', async () => {
    const { act, createElement } = await import('react')
    const { createRoot } = await import('react-dom/client')
    const first = keys()
    const second = keys()
    const Probe = ({ on }: { on: ReturnType<typeof keys> }) => {
      useGlobalKeys(on)
      return null
    }
    const box = document.createElement('div')
    const root = createRoot(box)
    act(() => root.render(createElement(Probe, { on: first })))
    act(() => root.render(createElement(Probe, { on: second })))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true }))
    expect(first.sidebar).not.toHaveBeenCalled()
    expect(second.sidebar).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true }))
    expect(second.sidebar).toHaveBeenCalledTimes(1)
  })
})
