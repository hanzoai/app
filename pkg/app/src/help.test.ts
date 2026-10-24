import { afterEach, describe, expect, test } from 'vitest'
import { said } from './chord'
import { asked, KEYS, legal, pages } from './help'
import { configure, where } from './where'

const before = { ...where() }
afterEach(() => configure(before))

const hrefs = () => [...pages(), ...legal()].map((p) => p.href)

describe('the Help menu', () => {
  // Each is a page hanzo.ai serves (hanzo-inc/app: app/(marketing)/support,
  // legal, legal/[slug], download) or the release notes its own nav links to.
  test('names the real pages, in order', () => {
    configure({ site: '' })
    expect(hrefs()).toEqual(['/support', 'https://docs.hanzo.ai', '/contact', '/legal', 'https://github.com/hanzoai/cli/releases', '/download', '/legal/terms', '/legal/privacy'])
    expect([...pages(), ...legal()].map((p) => p.label)).toEqual(['Help center', 'Documentation', 'Contact us', 'Privacy center', 'Release notes', 'Download apps', 'Terms of Service', 'Privacy Policy'])
  })

  test("on hanzo.team every address is hanzo.ai's, read when the menu is drawn", () => {
    configure({ site: 'https://hanzo.ai' })
    for (const href of hrefs()) {
      const url = new URL(href)
      expect(url.protocol, href).toBe('https:')
      expect(['hanzo.ai', 'docs.hanzo.ai', 'github.com'], href).toContain(url.host)
    }
  })
})

describe('the keyboard shortcuts', () => {
  test('one row per key, each spelled for a Mac and for every other platform', () => {
    expect(new Set(KEYS.map((k) => k.does)).size).toBe(KEYS.length)
    for (const k of KEYS) {
      expect(k.mac, k.does).not.toBe('')
      expect(k.pc, k.does).not.toBe('')
    }
  })

  test("lists the app's keys as their handlers spell them", () => {
    const pc = Object.fromEntries(KEYS.map((k) => [k.does, k.pc]))
    expect(pc).toMatchObject({
      'Search chats': 'Ctrl+K',
      Settings: 'Ctrl+,',
      'Keyboard shortcuts': 'Ctrl+/',
      'Side panel': 'Ctrl+.',
      'Attach files': 'Ctrl+U',
      Send: 'Enter',
      'New line': 'Shift+Enter',
      'Rename chat': said('rename', false),
      'Pin or unpin chat': said('pin', false),
    })
    expect(KEYS.find((k) => k.does === 'Rename chat')?.mac).toBe(said('rename', true))
  })

  test('⌘/ and Ctrl+/ open them, once a press', () => {
    const key = { key: '/', ctrlKey: false, metaKey: false, altKey: false }
    expect(asked({ ...key, ctrlKey: true })).toBe(true)
    expect(asked({ ...key, metaKey: true })).toBe(true)
    expect(asked(key)).toBe(false)
    expect(asked({ ...key, ctrlKey: true, altKey: true })).toBe(false)
    expect(asked({ ...key, ctrlKey: true, repeat: true })).toBe(false)
    expect(asked({ ...key, key: 'k', ctrlKey: true })).toBe(false)
  })
})
