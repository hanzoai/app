// The Help menu's pages and the app's keys, as data: the account menu (Account.tsx)
// draws both, its shortcuts dialog renders KEYS, and a spec reads them as they
// are. No React, so a spec reads it as it is.

import { phrase } from '@hanzo/i18n'
import { said } from './chord'
import { site } from './where'

/** One Help row that leaves for a page. Its label is authored English, drawn through `t`. */
export interface Page {
  key: string
  label: string
  href: string
}

/** Where the release notes are published: the site's own nav names the same. */
const RELEASES = 'https://github.com/hanzoai/cli/releases'

/**
 * The Help menu's pages, read at call time: `site()` is the app's origin on
 * hanzo.ai and hanzo.ai itself on hanzo.team. Help center is /support, the
 * page that leads to the help center, the docs, status and a person.
 */
export const pages = (): Page[] => [
  { key: 'help', label: phrase('Help center'), href: site('/support') },
  { key: 'docs', label: phrase('Documentation'), href: 'https://docs.hanzo.ai' },
  { key: 'contact', label: phrase('Contact us'), href: site('/contact') },
  { key: 'center', label: phrase('Privacy center'), href: site('/legal') },
  { key: 'releases', label: phrase('Release notes'), href: RELEASES },
  { key: 'download', label: phrase('Download apps'), href: site('/download') },
]

/** The agreements under the Help menu's rule. */
export const legal = (): Page[] => [
  { key: 'terms', label: phrase('Terms of Service'), href: site('/legal/terms') },
  { key: 'privacy', label: phrase('Privacy Policy'), href: site('/legal/privacy') },
]

/** One of the app's keys: what it does (authored English, drawn through `t`), and how a Mac and every other platform spell it. */
export interface Key {
  does: string
  mac: string
  pc: string
}

/**
 * Every key the app answers, in the order a reader looks for them. Each is
 * handled where it acts: App.tsx (⌘K, ⌘, and, in a window, Back and Forward),
 * Account.tsx (⌘/), @hanzo/build's panel (⌘.), the composer (Enter, ⌘U), chord.ts
 * (the conversation's chords, spelled by `said` so the two cannot drift).
 */
export const KEYS: Key[] = [
  { does: phrase('Search chats'), mac: '⌘K', pc: 'Ctrl+K' },
  { does: phrase('Settings'), mac: '⌘,', pc: 'Ctrl+,' },
  { does: phrase('Keyboard shortcuts'), mac: '⌘/', pc: 'Ctrl+/' },
  { does: phrase('Side panel'), mac: '⌘.', pc: 'Ctrl+.' },
  { does: phrase('Attach files'), mac: '⌘U', pc: 'Ctrl+U' },
  { does: phrase('Send'), mac: 'Enter', pc: 'Enter' },
  { does: phrase('New line'), mac: '⇧Enter', pc: 'Shift+Enter' },
  { does: phrase('Rename chat'), mac: said('rename', true), pc: said('rename', false) },
  { does: phrase('Pin or unpin chat'), mac: said('pin', true), pc: said('pin', false) },
  { does: phrase('Back'), mac: '⌘[', pc: 'Alt+←' },
  { does: phrase('Forward'), mac: '⌘]', pc: 'Alt+→' },
]

/** The part of a keydown `asked` reads. */
export interface Press {
  key?: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  repeat?: boolean
}

/** Whether a keydown asks for the keyboard shortcuts: ⌘/ or Ctrl+/, once a press. */
export const asked = (e: Press): boolean => (e.metaKey || e.ctrlKey) && !e.altKey && !e.repeat && e.key === '/'

/**
 * Opens an address in a tab of its own, through an anchor, so a host that
 * sends links out of its window (the desktop's system browser) hears it as the
 * link it is.
 */
export function out(href: string): void {
  const a = document.createElement('a')
  a.href = href
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}
