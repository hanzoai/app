// The page a conversation last wrote: what Chat's Preview opens (Chat.tsx
// `PreviewButton`, and `see`). Pure, so the tests read it without a pane.

import { artifacts, renders, type Artifact } from '@hanzo/build'

/** One turn as the thread holds it: who said it, and what. */
interface Turn {
  role: string
  content?: unknown
}

/** The last page or picture an answer in `turns` wrote, or null: what the Preview opens. */
export function written(turns: readonly Turn[]): Artifact | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const one = turns[i]!
    if (one.role !== 'assistant' || typeof one.content !== 'string') continue
    const page = [...artifacts(one.content)].reverse().find(renders)
    if (page) return page
  }
  return null
}
