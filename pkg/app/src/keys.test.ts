// @vitest-environment happy-dom
// The workspace's global keys are one keymap (Dev's table, @hanzo/dev/keymap), handled once
// (keys.ts) for the app and for every Shell view.
import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))

const { handle, useGlobalKeys, cyclePanel, railKeys } = await import('./keys')
const km = await import('@hanzo/dev/keymap')

const say = (s: string) => s
const press = (init: KeyboardEventInit & { key: string }, target: EventTarget = document.body) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  Object.defineProperty(e, 'target', { value: target })
  return e
}
const ctrl = (key: string, extra: KeyboardEventInit = {}, target?: EventTarget) => press({ key, code: /^[0-9]$/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`, ctrlKey: true, ...extra }, target)
const keys = () => ({
  find: vi.fn(), newChat: vi.fn(), sidebar: vi.fn(), settings: vi.fn(), shortcuts: vi.fn(), back: vi.fn(), forward: vi.fn(),
  section: vi.fn(), focusComposer: vi.fn(), focusList: vi.fn(), panel: vi.fn(), chooseTheme: vi.fn(), say: vi.fn(),
})
const run = (e: KeyboardEvent, on: ReturnType<typeof keys>, extra = {}) => handle(e, { ...on, ...extra }, say, km)

afterEach(() => {
  document.documentElement.className = ''
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('the one keymap, as the shell uses it', () => {
  test('⌘K palette, ⌘N new chat, ⌘B sidebar, ⌘, settings, ⌘/ shortcuts, ⌘[ ⌘] history', () => {
    const on = keys()
    for (const e of [ctrl('k'), ctrl('n'), ctrl('b'), ctrl(','), ctrl('/'), ctrl('['), ctrl(']')]) expect(run(e, on)).toBe(true)
    expect([on.find, on.newChat, on.sidebar, on.settings, on.shortcuts, on.back, on.forward].map((f) => f.mock.calls.length)).toEqual([1, 1, 1, 1, 1, 1, 1])
  })

  test('⌘⇧O stays a new chat, and ? lists the shortcuts when nothing is being typed', () => {
    const on = keys()
    expect(run(ctrl('O', { code: 'KeyO', shiftKey: true }), on)).toBe(true)
    expect(on.newChat).toHaveBeenCalledTimes(1)
    expect(run(press({ key: '?', code: 'Slash', shiftKey: true }), on)).toBe(true)
    expect(on.shortcuts).toHaveBeenCalledTimes(1)
    const field = document.createElement('input')
    document.body.append(field)
    expect(run(press({ key: '?', code: 'Slash', shiftKey: true }, field), on)).toBe(false)
  })

  test('⌘1 to ⌘9 are sections in the host\'s own window, ctrl+alt+1 to 9 anywhere; a browser keeps ⌘1 to ⌘9', () => {
    const on = keys()
    expect(run(ctrl('3'), on)).toBe(false)
    expect(run(ctrl('3'), on, { desktop: true })).toBe(true)
    expect(on.section).toHaveBeenLastCalledWith(3)
    expect(run(press({ key: '5', code: 'Digit5', ctrlKey: true, altKey: true }), on)).toBe(true)
    expect(on.section).toHaveBeenLastCalledWith(5)
  })

  test('⌘L is the composer, ⌘0 the list, F6 and ⇧F6 the panels', () => {
    const on = keys()
    expect(run(ctrl('l'), on)).toBe(true)
    expect(run(ctrl('0'), on)).toBe(true)
    expect(run(press({ key: 'F6', code: 'F6' }), on)).toBe(true)
    expect(run(press({ key: 'F6', code: 'F6', shiftKey: true }), on)).toBe(true)
    expect(on.focusComposer).toHaveBeenCalledTimes(1)
    expect(on.focusList).toHaveBeenCalledTimes(1)
    expect(on.panel.mock.calls).toEqual([[1], [-1]])
  })

  test('from a field only the palette, shortcuts, focus jumps and panels; the editor keeps ⌘B', () => {
    const on = keys()
    const field = document.createElement('textarea')
    document.body.append(field)
    expect(run(ctrl('b', {}, field), on)).toBe(false)
    expect(run(ctrl(',', {}, field), on)).toBe(false)
    expect(run(ctrl('k', {}, field), on)).toBe(true)
    expect(run(ctrl('l', {}, field), on)).toBe(true)
    expect(on.sidebar).not.toHaveBeenCalled()
  })

  test('a dialog keeps its keys except the palette', () => {
    const on = keys()
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)
    expect(run(ctrl(',', {}, dialog), on)).toBe(false)
    expect(run(ctrl('k', {}, dialog), on)).toBe(true)
  })

  test('⌘⌥⇧A hands the new theme to the host, which saves it to the account', () => {
    const on = keys()
    const theme = () => run(press({ key: 'a', code: 'KeyA', ctrlKey: true, altKey: true, shiftKey: true }), on)
    document.documentElement.classList.add('light')
    theme()
    expect(on.chooseTheme).toHaveBeenCalledWith('dark')
    document.documentElement.className = ''
    theme()
    expect(on.chooseTheme).toHaveBeenLastCalledWith('light')
    expect(on.say).toHaveBeenLastCalledWith('Switched to light theme')
  })

  test('a press already answered, one still composing, or one the surface has no use for is left alone', () => {
    const on = keys()
    const answered = ctrl('k')
    answered.preventDefault()
    expect(run(answered, on)).toBe(false)
    expect(run(ctrl('b', { isComposing: true }), on)).toBe(false)
    expect(handle({ ...ctrl('b'), preventDefault() {} } as never, { find() {}, newChat() {}, sidebar() {}, settings() {} }, say, null)).toBe(false)
    expect(run(ctrl('j'), on)).toBe(false) // a Dev command the shell does not own is the core's
    expect(on.find).not.toHaveBeenCalled()
    expect(on.sidebar).not.toHaveBeenCalled()
  })
})

describe('panels', () => {
  test('F6 moves focus sidebar to pane to dock and wraps', () => {
    document.body.innerHTML = '<div data-slot="sidebar-nav"><a href="#a">a</a></div><main id="main-content"><button>b</button></main><div data-slot="dev-dock"><button>c</button></div>'
    const at = () => document.activeElement?.textContent
    cyclePanel(1)
    expect(at()).toBe('a')
    cyclePanel(1)
    expect(at()).toBe('b')
    cyclePanel(1)
    expect(at()).toBe('c')
    cyclePanel(1)
    expect(at()).toBe('a')
    cyclePanel(-1)
    expect(at()).toBe('c')
  })
})

describe('the sidebar rows', () => {
  const rail = () => {
    document.body.innerHTML = '<nav><button id="a">a</button><button id="b">b</button><button id="c" disabled>c</button><input id="q" /></nav>'
    return document.querySelector('nav') as HTMLElement
  }
  const key = (init: { key: string; shiftKey?: boolean }, target: HTMLElement) => {
    const calls = { prevented: false }
    railKeys({ shiftKey: false, ...init, target, preventDefault: () => (calls.prevented = true) }, document.querySelector('nav') as HTMLElement)
    return calls.prevented
  }

  test('↑ and ↓ move between rows, skipping disabled ones, and Home and End go to the ends', () => {
    rail()
    const a = document.getElementById('a')!
    const b = document.getElementById('b')!
    expect(key({ key: 'ArrowDown' }, a)).toBe(true)
    expect(document.activeElement).toBe(b)
    expect(key({ key: 'ArrowUp' }, b)).toBe(true)
    expect(document.activeElement).toBe(a)
    key({ key: 'End' }, a)
    expect(document.activeElement).toBe(b)
    key({ key: 'Home' }, b)
    expect(document.activeElement).toBe(a)
  })

  test('Shift+F10 and the menu key open the focused row\'s menu as a right press does', () => {
    rail()
    const b = document.getElementById('b')!
    const seen: string[] = []
    window.addEventListener('contextmenu', (e) => seen.push((e.target as HTMLElement).id), { once: true })
    expect(key({ key: 'F10', shiftKey: true }, b)).toBe(true)
    expect(seen).toEqual(['b'])
    window.addEventListener('contextmenu', (e) => seen.push((e.target as HTMLElement).id), { once: true })
    key({ key: 'ContextMenu' }, b)
    expect(seen).toEqual(['b', 'b'])
  })

  test('arrows in a field are the field\'s', () => {
    rail()
    expect(key({ key: 'ArrowDown' }, document.getElementById('q')!)).toBe(false)
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
    await vi.waitFor(() => {
      window.dispatchEvent(ctrl('b'))
      expect(second.sidebar).toHaveBeenCalled()
    })
    expect(first.sidebar).not.toHaveBeenCalled()
    const seen = second.sidebar.mock.calls.length
    act(() => root.unmount())
    window.dispatchEvent(ctrl('b'))
    expect(second.sidebar).toHaveBeenCalledTimes(seen)
  })
})
