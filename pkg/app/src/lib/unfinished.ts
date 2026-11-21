'use client'

/**
 * A sign-out whose host's leaving did not finish (lib/signout `leaving`), told
 * to the page it moves to: a toast drawn on the page that is leaving would go
 * with it before anyone read it. Its own module, so `Look`, which every page
 * mounts, can say it without pulling the sign-out's IAM client in.
 */

import { useEffect } from 'react'
import { toast } from '@hanzo/ui'
import { useI18n } from '@hanzo/i18n/react'
import { subject } from './session'

const UNFINISHED = 'hanzo.signout.unfinished'

/**
 * How long the note is worth saying. The page a sign-out moves to opens within
 * seconds; a note older than this was left on a page that never said it (IAM
 * landing the person on hanzo.ai/login), and would otherwise show long after.
 */
export const FRESH = 60_000

/** The note: whose sign-out it was, and when. */
type Note = { sub?: string; at: number }

/** Leaves the note, for the person signing out. Written just before the page moves. */
export function unfinished(): void {
  try {
    window.sessionStorage.setItem(UNFINISHED, JSON.stringify({ sub: subject(), at: Date.now() } satisfies Note))
  } catch {
    /* no store: the next page cannot be told */
  }
}

/**
 * Says the note once, on the next page this tab opens, and takes it away
 * whatever it says: only while it is fresh, and only to the person who signed
 * out (or to nobody signed in). Someone who signed in since is not told about
 * another's sign-out.
 */
export function useUnfinished(): void {
  const { t } = useI18n()
  useEffect(() => {
    let note: Note | null = null
    try {
      note = JSON.parse(window.sessionStorage.getItem(UNFINISHED) || 'null') as Note | null
      window.sessionStorage.removeItem(UNFINISHED)
    } catch {
      return
    }
    if (!note || !(Date.now() - note.at <= FRESH)) return
    const now = subject()
    if (now && now !== note.sub) return
    toast.error(t('Signed out, but this device could not finish forgetting you. Sign out again if anything remains.'))
  }, [t])
}
