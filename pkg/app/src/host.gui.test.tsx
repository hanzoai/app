// @vitest-environment happy-dom
// What a host adds with `configure` is drawn: its Settings page, and its keys in the Shortcuts dialog and the palette.
import { act, createElement } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { inApp, platform } from '../vitest.chat'
import { mount, tap, type Mounted } from '../vitest.real'
import { Shortcuts } from './Account'
import { Search } from './Search'
import { SettingsPane } from './SettingsPane'
import { configure, where } from './where'

let at: Mounted | undefined
const before = { ...where() }
afterEach(async () => {
  configure({ ...before, keys: undefined, section: undefined })
  await at?.done()
  at = undefined
})

const keys = [
  { does: 'New chat', mac: '⌘N', pc: 'Ctrl+N', group: 'Navigation' as const },
  { does: 'Voice input', mac: '⌘⇧M', pc: 'Ctrl+Shift+M', group: 'Chat' as const },
]

describe('a host’s Settings page', () => {
  test('is drawn by the pane for its section id', async () => {
    configure({ section: { id: 'this-computer', label: 'This computer', Page: () => createElement('p', null, 'models on this computer') } })
    at = await mount()
    await at.draw(createElement(SettingsPane, { id: 'this-computer' }))
    expect(document.body.textContent).toContain('models on this computer')
  })
})

describe('a host’s keys', () => {
  test('both spellings of New chat are on its one row in the Shortcuts dialog, and a new action has its row', async () => {
    configure({ keys })
    at = await mount()
    await at.draw(createElement(Shortcuts, { open: true, onOpenChange: () => {}, apple: true }))
    const rows = [...document.querySelectorAll('[data-slot="shortcuts-dialog"] *')].filter((e) => e.textContent?.startsWith('New chat') && e.children.length > 1)
    const row = rows.at(-1)!
    expect(row.textContent).toContain('⇧')
    expect(row.textContent).toContain('N')
    expect(document.querySelector('[data-slot="shortcuts-dialog"]')!.textContent).toContain('Voice input')
    expect(document.body.textContent!.match(/New chat/g)).toHaveLength(1)
  })

  test('the palette finds a host key action by name', async () => {
    configure({ keys })
    at = await mount()
    platform()
    await at.draw(inApp(createElement(Search, { onClose: () => {}, go: vi.fn() })))
    const type = (text: string) =>
      act(async () => {
        const box = document.querySelector('input')!
        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(box), 'value')!.set!.call(box, text)
        box.dispatchEvent(new Event('input', { bubbles: true }))
        await new Promise((r) => setTimeout(r, 120))
      })
    await type('keyboard')
    const opener = [...document.querySelectorAll<HTMLElement>('*')].filter((e) => e.textContent === 'Keyboard shortcuts' && !e.children.length).at(-1)!
    await tap(opener)
    await type('voice')
    expect(document.body.textContent).toContain('Voice input')
  })
})
