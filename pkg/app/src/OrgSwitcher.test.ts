// @vitest-environment happy-dom
// The organization menu answers Escape: it closes, hands focus back to the button
// that opened it, and the press goes no further, so a dialog or the sidebar
// behind it does not also close on the same key.
import { act, createElement, createRef, type ReactNode, type Ref } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { part } = vi.hoisted(() => ({
  part: ({ children, ref, 'data-slot': slot }: { children?: ReactNode; ref?: Ref<HTMLDivElement>; 'data-slot'?: string }) => createElement('div', { ref, 'data-slot': slot }, children),
}))

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('lucide-react', () => ({ Check: () => null, ChevronDown: () => null, Plus: () => null, Settings: () => null }))
vi.mock('@hanzogui/shell', () => ({ HanzoMark: () => null }))
const { held } = vi.hoisted(() => ({ held: { orgs: [] as { id: string; name: string }[] } }))
vi.mock('@hanzo/iam/react', () => ({ useOrganizations: () => ({ organizations: held.orgs, currentOrgId: null }) }))
vi.mock('@hanzo/ui', () => ({ Avatar: () => null, Button: part }))
vi.mock('@hanzo/gui', () => ({ Text: part, View: part, XStack: part, YStack: part }))
vi.mock('./lib/account', () => ({ useAccount: () => ({ organizations: [] }) }))
vi.mock('./lib/api', () => ({ iam: () => '' }))
vi.mock('./lib/session', () => ({ CHOOSE: 'choose', pick: () => {} }))
vi.mock('./where', () => ({ site: (p: string) => p }))
vi.mock('./lib/host', () => ({ settings: () => '/settings' }))

const { OrgSwitcherDropdown, Tiles } = await import('./OrgSwitcher')

let root: Root
let box: HTMLElement
let trigger: HTMLButtonElement
const closed = vi.fn()

beforeEach(() => {
  box = document.createElement('div')
  trigger = document.createElement('button')
  document.body.append(trigger, box)
  root = createRoot(box)
  const ref = createRef<HTMLButtonElement>()
  ;(ref as { current: HTMLButtonElement }).current = trigger
  act(() => root.render(createElement(OrgSwitcherDropdown, { open: true, onClose: closed, activeOrgId: '', onSelect: () => {}, triggerRef: ref as never })))
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
  closed.mockReset()
})

describe('the organization menu and Escape', () => {
  test('closes, returns focus to its button, and keeps the press from reaching anything behind it', async () => {
    const behind = vi.fn()
    window.addEventListener('keydown', behind)
    const press = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    act(() => void document.body.dispatchEvent(press))
    window.removeEventListener('keydown', behind)
    expect(closed).toHaveBeenCalledTimes(1)
    expect(press.defaultPrevented).toBe(true)
    expect(behind).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(document.activeElement).toBe(trigger)
  })

  test('another key does nothing', () => {
    act(() => void document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })))
    expect(closed).not.toHaveBeenCalled()
  })
})

describe('the org tiles', () => {
  const tiles = () => {
    act(() => root.render(createElement(Tiles)))
    return box.querySelector('[data-slot="org-tiles"]')
  }
  afterEach(() => {
    held.orgs = []
  })

  test('a person in one organization still has the tiles, and the plus to make or join another', () => {
    held.orgs = [{ id: 'a', name: 'acme' }]
    expect(tiles()).not.toBeNull()
  })

  test('a person with none has no tiles', () => {
    expect(tiles()).toBeNull()
  })
})
