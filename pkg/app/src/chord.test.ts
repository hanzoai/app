import { describe, expect, test } from 'vitest'
import { chord, globalAction, named, said, typing, type Press } from './chord'

const on = (tagName: string, extra: Record<string, unknown> = {}) => ({ tagName, closest: () => null, ...extra }) as unknown as EventTarget

const press = (key: string, code: string, extra: Partial<Press> = {}): Press => ({
  key,
  code,
  ctrlKey: true,
  altKey: true,
  metaKey: false,
  shiftKey: false,
  target: on('DIV'),
  ...extra,
})

describe('the keys a conversation answers to', () => {
  test('Ctrl+Alt+R renames and Ctrl+Alt+P pins', () => {
    expect(chord(press('r', 'KeyR'))).toBe('rename')
    expect(chord(press('p', 'KeyP'))).toBe('pin')
    expect(chord(press('q', 'KeyQ'))).toBeNull()
  })

  test('the letter on the key, whatever the layout', () => {
    // Dvorak: the key labelled P sits where QWERTY's R is.
    expect(chord(press('p', 'KeyR'))).toBe('pin')
    expect(chord(press('r', 'KeyO'))).toBe('rename')
    expect(chord(press('R', 'KeyR'))).toBe('rename')
  })

  test("the key's place, where Option or AltGr made it another character", () => {
    expect(chord(press('®', 'KeyR'))).toBe('rename')
    expect(chord(press('π', 'KeyP'))).toBe('pin')
    expect(chord(press('Dead', 'KeyQ'))).toBeNull()
  })

  test('both modifiers and no others', () => {
    expect(chord(press('r', 'KeyR', { altKey: false }))).toBeNull()
    expect(chord(press('r', 'KeyR', { ctrlKey: false }))).toBeNull()
    expect(chord(press('r', 'KeyR', { metaKey: true }))).toBeNull()
    expect(chord(press('p', 'KeyP', { shiftKey: true }))).toBeNull()
    expect(chord(press('r', 'KeyR', { isComposing: true }))).toBeNull()
  })

  test('once a press: a held key repeats, and the repeats ask nothing', () => {
    expect(chord(press('p', 'KeyP', { repeat: true }))).toBeNull()
    expect(chord(press('p', 'KeyP', { repeat: false }))).toBe('pin')
  })

  test('never while typing: a field, a text area, a picker, or text that edits itself', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'input']) expect(chord(press('r', 'KeyR', { target: on(tag) }))).toBeNull()
    expect(chord(press('p', 'KeyP', { target: on('DIV', { isContentEditable: true }) }))).toBeNull()
    // Inside a composer whose box is a role="textbox".
    const inside = on('SPAN', { closest: (q: string) => (q.includes('role="textbox"') ? {} : null) })
    expect(chord(press('p', 'KeyP', { target: inside }))).toBeNull()
    expect(typing(on('BUTTON'))).toBe(false)
    expect(typing(null)).toBe(false)
  })

  test('never inside a dialog: its keys are its own', () => {
    for (const role of ['dialog', 'alertdialog']) {
      const inside = on('BUTTON', { closest: (q: string) => (q.includes(`role="${role}"`) ? {} : null) })
      expect(chord(press('r', 'KeyR', { target: inside }))).toBeNull()
    }
  })

  test('printed the way the platform says it, and named for assistive technology one way', () => {
    expect(said('rename', true)).toBe('⌃⌥R')
    expect(said('pin', true)).toBe('⌃⌥P')
    expect(said('rename', false)).toBe('Ctrl+Alt+R')
    expect(said('pin', false)).toBe('Ctrl+Alt+P')
    expect(named('rename')).toBe('Control+Alt+R')
    expect(named('pin')).toBe('Control+Alt+P')
  })
})

describe('the workspace keys', () => {
  const mod = (key: string, extra: Partial<Press> = {}) => press(key, `Key${key.toUpperCase()}`, { ctrlKey: false, altKey: false, metaKey: true, ...extra })

  test('Cmd+Shift+O, Cmd+B, Cmd+Shift+L and Cmd+Shift+D each name their act, and Ctrl does the same off a Mac', () => {
    expect(globalAction(mod('o', { shiftKey: true }))).toBe('new-chat')
    expect(globalAction(mod('b'))).toBe('toggle-sidebar')
    expect(globalAction(mod('l', { shiftKey: true }))).toBe('toggle-theme')
    expect(globalAction(mod('d', { shiftKey: true }))).toBe('toggle-dev-mode')
    expect(globalAction(mod('b', { metaKey: false, ctrlKey: true }))).toBe('toggle-sidebar')
  })

  test('a bare letter, the wrong shift, or Alt asks nothing', () => {
    expect(globalAction(mod('b', { metaKey: false }))).toBeNull()
    expect(globalAction(mod('o'))).toBeNull()
    expect(globalAction(mod('b', { shiftKey: true }))).toBeNull()
    expect(globalAction(mod('b', { altKey: true }))).toBeNull()
  })

  test('never while typing, inside a dialog, held down, composing, or already answered', () => {
    expect(globalAction(mod('b', { target: on('TEXTAREA') }))).toBeNull()
    expect(globalAction(mod('b', { target: on('DIV', { closest: () => ({}) }) }))).toBeNull()
    expect(globalAction(mod('b', { repeat: true }))).toBeNull()
    expect(globalAction(mod('b', { isComposing: true }))).toBeNull()
    expect(globalAction(mod('b', { defaultPrevented: true }))).toBeNull()
  })
})
