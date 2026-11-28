// @vitest-environment happy-dom
// The sidebar's right-click menu offers Select multiple / Select all only while a Recents list is drawn:
// they act on that list, so over a section that draws none they would do nothing.
import { act, createElement } from 'react'
import { afterEach, describe, expect, test } from 'vitest'
import { mount, type Mounted } from '../vitest.real'
import { AppContextMenu } from './ContextMenu'

let at: Mounted | undefined
afterEach(async () => {
  await at?.done()
  at = undefined
  document.body.querySelectorAll('[data-slot="window"]').forEach((n) => n.remove())
})

const rightClick = (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }))
    await new Promise((r) => setTimeout(r, 120))
  })

const menu = () => document.querySelector('[data-slot="app-context-menu"]')?.textContent ?? ''

async function openOver(recents: boolean, mode: 'chat' | 'studio' = 'chat'): Promise<string> {
  const window_ = document.createElement('div')
  window_.setAttribute('data-slot', 'window')
  window_.innerHTML = `<div data-slot="app-column">${recents ? '<div data-slot="recents"></div>' : ''}<span id="spot">Sidebar</span></div>`
  document.body.append(window_)
  at = await mount()
  await at.draw(
    createElement(AppContextMenu as never, {
      host: {},
      mode,
      closed: false,
      onToggleSidebar() {},
      onSeek() {},
      onNewChat() {},
      go() {},
      pins: [[], () => {}],
    } as never),
  )
  await rightClick(window_.querySelector('#spot')!)
  return menu()
}

describe('Select multiple and Select all in the sidebar menu', () => {
  test('are offered while a Recents list is drawn', async () => {
    const shown = await openOver(true)
    expect(shown).toContain('New chat')
    expect(shown).toContain('Select multiple…')
    expect(shown).toContain('Select all')
  })

  test('are not offered when no Recents list is drawn', async () => {
    const shown = await openOver(false)
    expect(shown).toContain('New chat')
    expect(shown).not.toContain('Select multiple…')
    expect(shown).not.toContain('Select all')
  })

  test('Studio sidebar context menu offers New creation and Select controls', async () => {
    const shown = await openOver(true, 'studio')
    expect(shown).toContain('New creation')
    expect(shown).toContain('Select multiple…')
    expect(shown).toContain('Select all')
  })

  test('empty Rail space right-click opens the shell context menu', async () => {
    const window_ = document.createElement('div')
    window_.setAttribute('data-slot', 'window')
    window_.innerHTML = `<div data-slot="rail"><span id="rail-empty">Empty</span></div>`
    document.body.append(window_)
    at = await mount()
    await at.draw(
      createElement(AppContextMenu as never, {
        host: {},
        mode: 'chat',
        closed: false,
        onToggleSidebar() {},
        onSeek() {},
        onNewChat() {},
        go() {},
        pins: [[], () => {}],
      } as never),
    )
    await rightClick(window_.querySelector('#rail-empty')!)
    const shown = menu()
    expect(shown).toContain('New chat')
    expect(shown).toContain('Close sidebar')
  })
})
