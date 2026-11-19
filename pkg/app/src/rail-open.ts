'use client'

import { useEffect, useState } from 'react'
import { useKept } from './kept'

/**
 * Whether the Shell's sidebar is open, kept under App.tsx's key (`hanzo.build.rail`, true when shut) so the
 * column does not jump between /chat and /home.
 *
 * The page is prerendered, so the first pass draws the server's tree (open) and what the reader kept arrives
 * after mount; nothing kept falls back to Hanzo's earlier key `hanzo:sidebar:open`, then the window's width.
 * `away` shuts it for now without keeping that: a pick on a phone is not a choice to keep it shut.
 */
export function useSidebar(): [boolean, (next: boolean | ((open: boolean) => boolean)) => void, () => void] {
  const [shut, setShut] = useKept<boolean | null>('hanzo.build.rail', null)
  const [started, setStarted] = useState(false)
  const [first, setFirst] = useState(true)
  const [away, setAway] = useState(false)
  useEffect(() => {
    let old: string | null = null
    try {
      old = localStorage.getItem('hanzo:sidebar:open')
    } catch {
      // No store is the width of the window, which is a state and not a failure.
    }
    setFirst(old !== null ? old === 'true' : window.innerWidth >= 768)
    setStarted(true)
  }, [])
  const open = !away && (started ? (shut === null ? first : !shut) : true)
  const set = (next: boolean | ((open: boolean) => boolean)) => {
    setAway(false)
    setShut(!(typeof next === 'function' ? next(open) : next))
  }
  return [open, set, () => setAway(true)]
}
