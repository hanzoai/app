'use client'

import { useEffect, useRef } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { inDialog, typing, type Press } from './chord'

/** The one keymap (Dev's table and resolver, @hanzo/dev-core/keymap), fetched once, on first use. */
type Keymap = typeof import('@hanzo/dev-core/keymap')
let keymap: Keymap | null = null
const loading = (): Promise<Keymap> => import('@hanzo/dev-core/keymap').then((m) => (keymap = m))

/** What the workspace's global keys do, said by the surface that draws the workspace. */
export interface Keys {
  /** ⌘K: the palette, open or shut. */
  find(): void
  /** ⌘N / ⌘⇧O: a new chat or thread. */
  newChat(): void
  /** ⌘B: the sidebar, open or shut. */
  sidebar(): void
  /** ⌘,: Settings (or the sign-in prompt for a stranger). */
  settings(): void
  /** ⌘/ and ?: every shortcut, listed. */
  shortcuts?(): void
  /** ⌘[ and ⌘]: back and forward, where the surface has a history of its own. */
  back?(): void
  forward?(): void
  /** ⌘1 to ⌘9: the nth section (Chat, Dev, Design, ...). */
  section?(n: number): void
  /** ⌘L: the composer. */
  focusComposer?(): void
  /** ⌘0: the sidebar's list. */
  focusList?(): void
  /** F6 / ⇧F6: the next or previous panel. */
  panel?(step: 1 | -1): void
  /** ⌘⌥⇧A: the theme, kept on the account (`Host.chooseTheme`). */
  chooseTheme?(next: 'light' | 'dark'): void
  /** One line of confirmation after a theme switch. */
  say?(message: string): void
  /** The window is the host's own (its desktop app), so ⌘1 to ⌘9 are not the browser's tabs. */
  desktop?: boolean
}

/** The part of a keydown the global keys read. */
export type Stroke = Press & { preventDefault(): void }

/** Commands a person can press from inside a field: the rest belong to the editor there. */
const FROM_A_FIELD = new Set([
  'commandPalette.toggle',
  'keybindings.open',
  'composer.focus',
  'sidebar.focus',
  'workspace.focusNext',
  'workspace.focusPrevious',
])

/**
 * THE ONE KEY HANDLER. App and Shell both mount this and nothing else listens for window
 * keys, so a key means the same on every surface. The command comes from the one keymap;
 * what a command does is `on`'s. A command this does not know (the ones that act inside a
 * thread) is left for the Dev core's own scopes.
 */
export function handle(e: Stroke, on: Keys, t: (s: string) => string, km: Keymap | null = keymap): boolean {
  // A press something already answered, or one that is still composing a character, is not a command.
  if (!km || e.defaultPrevented || e.isComposing) return false
  const field = typing(e.target)
  const command = km.resolveCommand(e as never, { editableFocus: field, hostDesktop: Boolean(on.desktop) })
  if (!command) return false
  if ((field && !FROM_A_FIELD.has(command)) || (inDialog(e.target) && command !== 'commandPalette.toggle')) return false
  const act = ((): (() => void) | undefined => {
    if (command === 'commandPalette.toggle') return on.find
    if (command === 'chat.new') return on.newChat
    if (command === 'sidebar.toggle') return on.sidebar
    if (command === 'settings.open') return on.settings
    if (command === 'keybindings.open') return on.shortcuts
    if (command === 'navigation.back') return on.back
    if (command === 'navigation.forward') return on.forward
    if (command === 'composer.focus') return on.focusComposer
    if (command === 'sidebar.focus') return on.focusList
    if (command === 'workspace.focusNext') return on.panel && (() => on.panel!(1))
    if (command === 'workspace.focusPrevious') return on.panel && (() => on.panel!(-1))
    if (command === 'appearance.cycle') {
      return on.chooseTheme && (() => {
        const cls = typeof document !== 'undefined' ? document.documentElement.classList : null
        const next = cls && (cls.contains('light') || cls.contains('t_light')) ? 'dark' : 'light'
        on.chooseTheme!(next)
        on.say?.(next === 'light' ? t('Switched to light theme') : t('Switched to dark theme'))
      })
    }
    const section = /^section\.([1-9])$/.exec(command)
    if (section) return on.section && (() => on.section!(Number(section[1])))
    return undefined
  })()
  if (!act) return false
  e.preventDefault()
  act()
  return true
}

/** The panels F6 cycles, in reading order: the sidebar's list, the pane, the dock. */
const PANELS = ['[data-slot="sidebar-nav"]', '#main-content', '[data-slot="dev-dock"]']

/** Moves focus to the next (or previous) panel that is on screen. */
export function cyclePanel(step: 1 | -1, root: Document = document): void {
  const panels = PANELS.map((selector) => root.querySelector<HTMLElement>(selector)).filter((el): el is HTMLElement => el !== null)
  if (panels.length === 0) return
  const at = panels.findIndex((p) => p.contains(root.activeElement))
  const next = panels[(at + step + panels.length) % panels.length]!
  const inner = next.querySelector<HTMLElement>('[tabindex="0"], a[href], button, input, textarea, [contenteditable="true"]')
  if (inner) inner.focus()
  else {
    if (next.tabIndex < 0) next.tabIndex = -1
    next.focus()
  }
}

/** Focuses the first row of the sidebar's list. */
export function focusSidebar(root: Document = document): boolean {
  const row = root.querySelector<HTMLElement>('[data-slot="sidebar-nav"] a[href], [data-slot="sidebar-nav"] [role="button"], [data-slot="sidebar-nav"] button')
  row?.focus()
  return row != null
}

/** Listen for the global keys while mounted; loads the keymap the first time. */
export function useGlobalKeys(on: Keys): void {
  const { t } = useI18n()
  const latest = useRef(on)
  latest.current = on
  useEffect(() => {
    let live = true
    void loading()
    const key = (e: KeyboardEvent) => void handle(e, latest.current, t)
    window.addEventListener('keydown', key)
    return () => {
      live = false
      void live
      window.removeEventListener('keydown', key)
    }
  }, [t])
}
