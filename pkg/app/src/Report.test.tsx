// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/ui', () => {
  const box = (tag: string) => ({ children, role, 'data-slot': slot, onPress }: { children?: ReactNode; role?: string; 'data-slot'?: string; onPress?: () => void }) =>
    createElement(tag, { role, 'data-slot': slot, onClick: onPress }, children)
  return { Button: box('button'), Text: box('p'), SizableText: box('p'), View: box('div'), XStack: box('div'), YStack: box('div'), Dialog: () => null, DialogContent: () => null, DialogTitle: () => null, Input: () => null, Textarea: () => null }
})
vi.mock('./host', () => ({ useHost: () => ({ router: { push: (href: string) => { push(href); window.history.pushState(null, '', href) } }, route: '/', path: null }) }))
vi.mock('./shot', () => ({ shoot: async () => null }))
vi.mock('./lib/session', () => ({ bearer: () => null, superAdmin: () => false }))
vi.mock('./lib/host', () => ({ talk: () => '/chat' }))

const { Broke } = await import('./Report')

let root: Root
let box: HTMLElement
beforeEach(() => {
  window.history.replaceState(null, '', '/tabs')
  box = document.createElement('div')
  document.body.append(box)
  root = createRoot(box)
})
afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
  push.mockReset()
})

describe('the crash screen', () => {
  test('says in plain words which screen hit an error, with no stack on screen', () => {
    act(() => root.render(createElement(Broke, { error: new Error('boom at x.js:1:2'), onBack: () => {} })))
    expect(box.textContent).toContain('The Tabs screen hit an error.')
    expect(box.textContent).not.toContain('boom')
    for (const slot of ['broke-chat', 'broke-reload', 'broke-copy']) expect(box.querySelector(`[data-slot="${slot}"]`)).not.toBeNull()
  })

  test('Back to Chat moves through the router, without a reload, and draws the app again', () => {
    const back = vi.fn()
    act(() => root.render(createElement(Broke, { error: new Error('boom'), onBack: back })))
    act(() => (box.querySelector('[data-slot="broke-chat"]') as HTMLElement).click())
    expect(push).toHaveBeenCalledWith('/chat')
    expect(back).toHaveBeenCalled()
  })

  test('Back to Chat on Chat itself draws the app again without moving', () => {
    window.history.replaceState(null, '', '/chat')
    const back = vi.fn()
    act(() => root.render(createElement(Broke, { error: new Error('boom'), onBack: back })))
    act(() => (box.querySelector('[data-slot="broke-chat"]') as HTMLElement).click())
    expect(push).not.toHaveBeenCalled()
    expect(back).toHaveBeenCalledOnce()
  })

  test('Copy details puts the error, the screen and the version on the clipboard', async () => {
    const write = vi.fn(async (_text: string) => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true })
    act(() => root.render(createElement(Broke, { error: new Error('boom'), onBack: () => {} })))
    await act(async () => (box.querySelector('[data-slot="broke-copy"]') as HTMLElement).click())
    expect(write).toHaveBeenCalledOnce()
    expect(write.mock.calls[0]![0]).toMatch(/^Error: boom\nScreen: \/tabs\nVersion: /)
    expect(box.textContent).toContain('Copied')
  })
})
