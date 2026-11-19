import { useCallback, type RefObject } from 'react'
import type { Thread } from '@hanzo/ai'
import { tidy } from './lib/title'

/**
 * The two ways out of renaming a conversation in its row: save and cancel. Either one closes the field and puts
 * focus back on the row it stood in, so the keyboard is not left on nothing; only a changed, non-empty title is sent.
 */
export function useRenaming(
  from: RefObject<HTMLElement | null>,
  close: (id: null) => void,
  rename: (thread: Thread, title: string) => void,
  untitled: string,
) {
  const refocus = useCallback(() => {
    requestAnimationFrame(() => {
      if (from.current?.isConnected) from.current.focus()
    })
  }, [from])
  const cancel = useCallback(() => {
    close(null)
    refocus()
  }, [close, refocus])
  const commit = useCallback(
    (thread: Thread, next: string) => {
      cancel()
      const trimmed = next.trim()
      if (trimmed && trimmed !== tidy(thread.title, 80, untitled)) rename(thread, trimmed)
    },
    [cancel, rename, untitled],
  )
  return { commit, cancel }
}
