// @vitest-environment happy-dom
// The workspace's global keys are handled once (keys.ts), for the app and for every Shell view.
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))

const { handle } = await import('./keys')

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

  test('App and Shell do not keep a handler of their own for these keys', () => {
    for (const file of ['./App.tsx', './Shell.tsx']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      expect(source, file).toContain('useGlobalKeys(')
      expect(source, file).not.toContain('globalAction')
      expect(source, file).not.toContain('writeAppearance')
    }
  })
})
