import type { Act, Hint } from '@hanzo/build'
import { book, hand, want, path as devPath } from '@hanzo/build'
import { app, go } from './lib/host'

export interface HintActions {
  reopen: (threadId: string) => void
  submit: (query: string) => void
  target?: unknown
  setPrepWrong?: (err: string | null) => void
  t?: (s: string) => string
}

/**
 * Executes a suggestion action:
 * - open: if it points to a chat thread (/chat/<id>), reopens that thread immediately and updates history;
 *         if external, opens in a new tab;
 *         if another app route, navigates via go;
 *         fallback: submits row title as query.
 * - send / task: submits prompt or title directly into the conversation.
 * - schedule: books automation or falls back to submitting the prompt.
 */
export function handleHint(a: Act, row: Hint | undefined, actions: HintActions): void {
  const { reopen, submit, target, setPrepWrong, t = (s: string) => s } = actions

  switch (a.kind) {
    case 'open': {
      const chatMatch = a.to.match(/\/chat\/([^?#/]+)/)
      if (chatMatch && chatMatch[1]) {
        const threadId = decodeURIComponent(chatMatch[1])
        reopen(threadId)
        go(a.to)
        return
      }
      if (a.item) want(a.item)
      if (/^https:\/\//.test(a.to)) {
        if (typeof window !== 'undefined') window.open(a.to, '_blank', 'noopener,noreferrer')
        return
      }
      if (a.to && a.to !== '/chat') {
        go(a.to.startsWith('/') ? a.to : app(a.to))
        return
      }
      const query = row?.title
      if (query) {
        submit(query)
        return
      }
      return
    }
    case 'send': {
      const query = a.prompt || row?.title || ''
      if (query) submit(query)
      return
    }
    case 'task': {
      const query = a.prompt || row?.title || ''
      if (query) {
        submit(query)
      } else {
        hand('task', '')
        go(app(''))
      }
      return
    }
    case 'schedule': {
      if (target) {
        void book(target as any, a as any, 'chat').then(
          (made) => go(app(devPath({ kind: 'automation', id: made.id }))),
          (e: unknown) => {
            if (a.prompt) submit(a.prompt)
            else if (setPrepWrong) setPrepWrong(e instanceof Error && e.message ? e.message : t('The scheduled task could not be made.'))
          },
        )
      } else if (a.prompt) {
        submit(a.prompt)
      }
      return
    }
  }

  if (row?.title) {
    submit(row.title)
  }
}
