'use client'

import { useEffect, useRef } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { globalAction, inDialog, typing, type Press } from './chord'
import { getDevMode, setDevMode } from './lib/dev-mode'
import { summons } from './seek'

/** What the workspace's global keys do, said by the surface that draws the workspace. */
export interface Keys {
  /** ⌘K: the palette, open or shut. */
  find(): void
  /** ⌘⇧O: a new chat. */
  newChat(): void
  /** ⌘B: the sidebar, open or shut. */
  sidebar(): void
  /** ⌘,: Settings (or the sign-in prompt for a stranger). */
  settings(): void
  /** ⌘⇧L: the theme, kept on the account (`Host.chooseTheme`). */
  chooseTheme?(next: 'light' | 'dark'): void
  /** One line of confirmation after a theme or Developer mode switch. */
  say?(message: string): void
}

/** The part of a keydown the global keys read. */
export type Stroke = Press & { preventDefault(): void }

/**
 * THE ONE KEY HANDLER. App and Shell both mount this and nothing else listens
 * for these keys, so a key means the same on every surface and a theme chosen
 * with ⌘⇧L is saved to the account the way the menu's choice is.
 */
export function handle(e: Stroke, on: Keys, t: (s: string) => string): boolean {
  // A press something already answered, or one that is still composing a character, is not a command.
  if (e.defaultPrevented || e.isComposing) return false
  if (summons(e)) {
    e.preventDefault()
    on.find()
    return true
  }
  const act = globalAction(e)
  if (act) {
    e.preventDefault()
    if (act === 'new-chat') on.newChat()
    else if (act === 'toggle-sidebar') on.sidebar()
    else if (act === 'toggle-theme') {
      const cls = typeof document !== 'undefined' ? document.documentElement.classList : null
      const next = cls && (cls.contains('light') || cls.contains('t_light')) ? 'dark' : 'light'
      on.chooseTheme?.(next)
      on.say?.(next === 'light' ? t('Switched to light theme') : t('Switched to dark theme'))
    } else {
      const next = !getDevMode()
      setDevMode(next)
      on.say?.(next ? t('Developer mode enabled') : t('Developer mode disabled'))
    }
    return true
  }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === ',' && !typing(e.target) && !inDialog(e.target)) {
    e.preventDefault()
    on.settings()
    return true
  }
  return false
}

/** Listen for the global keys while mounted. */
export function useGlobalKeys(on: Keys): void {
  const { t } = useI18n()
  const latest = useRef(on)
  latest.current = on
  useEffect(() => {
    const key = (e: KeyboardEvent) => void handle(e, latest.current, t)
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [t])
}
