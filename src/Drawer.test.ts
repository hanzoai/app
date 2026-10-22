// @vitest-environment happy-dom
// A DOM, so the drawer's effects run: the inert window, the focus, the history
// entry, Escape and Back. The drawing library is not under test and does not
// load outside a bundler: a part draws the element it is asked to render, with
// its ref, its name and slot, and a press as a click.
import { act, createElement, type ReactNode, type Ref } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { part } = vi.hoisted(() => {
  type Part = { children?: ReactNode; render?: string; ref?: Ref<HTMLElement>; onPress?: () => void; role?: string; tabIndex?: number; [k: string]: unknown }
  const part = ({ children, render, ref, onPress, role, tabIndex, ...rest }: Part) => {
    const attrs: Record<string, unknown> = { ref, role, tabIndex, onClick: onPress }
    for (const [k, v] of Object.entries(rest)) if (k.startsWith('data-') || k.startsWith('aria-')) attrs[k] = v
    return createElement(typeof render === 'string' ? render : 'div', attrs, children as ReactNode)
  }
  return { part }
})

vi.mock('@hanzo/gui', () => ({ Text: part, XStack: part, YStack: part, useMedia: () => ({ md: false }) }))
vi.mock('./Me', () => ({ Me: () => createElement('button', { 'aria-label': 'Account: Bob Ross · hanzo', 'data-slot': 'me' }) }))

const { Foot, Layer, useDrawer } = await import('./Drawer')
const { OPEN } = await import('./slide')

const host = { api: '', token: null, org: 'hanzo', person: { name: 'Bob Ross' }, signOut: () => {} } as unknown as Parameters<typeof Foot>[0]['host']

/** The window as App draws it: the pane with the bar's menu button in it, and the menu's layer while it is out. */
function Window({ onChat }: { onChat: () => void }) {
  const d = useDrawer()
  return createElement(
    'div',
    { ref: d.window, 'data-slot': 'window' },
    createElement('div', { ref: d.pane, 'data-slot': 'frame', style: d.slide ?? undefined }, createElement('button', { 'data-slot': 'bar-menu', onClick: d.open }, 'Open sidebar')),
    d.state === 'shut' ? null : createElement(Layer, { drawer: d, children: createElement(Foot, { host, onChat, onOrg: () => {} }) }),
  )
}

let root: Root
let box: HTMLElement
const onChat = vi.fn()
const $ = (s: string) => box.querySelector<HTMLElement>(s)
const frame = () => $('[data-slot="frame"]')!
const press = (el: HTMLElement | null) => act(() => el!.click())
const open = () => press($('[data-slot="bar-menu"]'))
/** The slide ends: what a browser's `transitionend` on the pane's transform says. */
const ended = () =>
  act(() => {
    const e = new Event('transitionend')
    Object.defineProperty(e, 'propertyName', { value: 'transform' })
    frame().dispatchEvent(e)
  })

beforeEach(() => {
  box = document.createElement('div')
  document.body.appendChild(box)
  root = createRoot(box)
  act(() => root.render(createElement(Window, { onChat })))
  onChat.mockReset()
})

afterEach(() => {
  act(() => root.unmount())
  box.remove()
  vi.restoreAllMocks()
})

describe('the phone drawer', () => {
  test('shut: no menu, and the pane is as it always is', () => {
    expect($('[role="dialog"]')).toBeNull()
    expect(frame().getAttribute('style')).toBeNull()
    expect(frame().inert).toBe(false)
  })

  test('open: a modal menu, the window behind it inert, the focus in it, the pane slid to the end', () => {
    const push = vi.spyOn(window.history, 'pushState')
    open()
    const menu = $('[role="dialog"]')!
    expect(menu.getAttribute('aria-modal')).toBe('true')
    expect(menu.getAttribute('aria-label')).toBe('Menu')
    expect(frame().inert).toBe(true)
    expect(document.activeElement).toBe(menu)
    expect(push).toHaveBeenCalledTimes(1)
    expect(frame().style.getPropertyValue('--drawer-at')).toBe(OPEN)
    expect(frame().style.getPropertyValue('--drawer-way')).toBe('1')
    expect($('[data-slot="drawer-close"]')!.getAttribute('aria-label')).toBe('Close sidebar')
  })

  test('its foot is the account and the accent New chat, nothing else', () => {
    open()
    const foot = $('[data-slot="drawer-foot"]')!
    expect(foot.querySelector('[data-slot="me"]')).not.toBeNull()
    const chat = foot.querySelector<HTMLElement>('[data-slot="drawer-chat"]')!
    expect(chat.getAttribute('aria-label')).toBe('New chat')
    expect(chat.textContent).toBe('Chat')
    expect(foot.querySelectorAll('button')).toHaveLength(2)
    press(chat)
    expect(onChat).toHaveBeenCalledTimes(1)
  })

  test('a press on the raised pane closes it: the pane slides home, then the menu goes and the focus comes back', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    const opener = $('[data-slot="bar-menu"]')!
    act(() => opener.focus())
    open()
    press($('[data-slot="drawer-close"]'))
    expect(back).toHaveBeenCalledTimes(1)
    expect($('[role="dialog"]')!.getAttribute('data-state')).toBe('closing')
    expect(frame().style.getPropertyValue('--drawer-at')).toBe('0px')
    ended()
    expect($('[role="dialog"]')).toBeNull()
    expect(frame().inert).toBe(false)
    expect(frame().getAttribute('style') ?? '').not.toContain('translateX')
    expect(document.activeElement).toBe(opener)
  })

  test('Escape closes it and pops its entry', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    open()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(back).toHaveBeenCalledTimes(1)
    expect($('[role="dialog"]')!.getAttribute('data-state')).toBe('closing')
  })

  test('Escape is a menu’s first, where a menu the drawer opened holds the focus', () => {
    open()
    const elsewhere = document.createElement('button')
    document.body.appendChild(elsewhere)
    act(() => elsewhere.focus())
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect($('[role="dialog"]')!.getAttribute('data-state')).toBe('open')
    elsewhere.remove()
  })

  test('Back closes it, and the entry it popped is not popped again', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {})
    open()
    act(() => window.dispatchEvent(new PopStateEvent('popstate')))
    expect($('[role="dialog"]')!.getAttribute('data-state')).toBe('closing')
    expect(back).not.toHaveBeenCalled()
  })

  test('under rtl the pane slides the other way: the sign is read off the page', () => {
    const real = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      const style = real(el)
      return new Proxy(style, { get: (t, k) => (k === 'direction' ? (el.closest('[dir]')?.getAttribute('dir') ?? 'ltr') : Reflect.get(t, k)) })
    })
    box.setAttribute('dir', 'rtl')
    open()
    expect(frame().style.getPropertyValue('--drawer-way')).toBe('-1')
    expect(frame().style.getPropertyValue('--drawer-at')).toBe(OPEN)
  })
})
