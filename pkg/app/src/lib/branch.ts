import { english, type Say } from '@hanzo/i18n'

/** A branch's own name, so it never stands in the list under the very title it came from. */
export const branchName = (title: string, t: Say = english): string => t('{title} (branch)', { title })

/** What a branch saves: the chat up to this answer, as plain turns. Nothing at all for a chat that keeps nothing (anonymous or private), or an empty one. */
export function branched<T extends { id?: string; role: string }>(
  list: readonly T[],
  turnId: string,
  text: (turn: T) => string,
  chat: { anonymous?: boolean; forgetful?: boolean },
): { role: string; content: string }[] | null {
  if (chat.anonymous || chat.forgetful) return null
  const at = list.findIndex((m) => m.id === turnId)
  const turns = (at >= 0 ? list.slice(0, at + 1) : list)
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: text(m) }))
    .filter((m) => m.content.trim())
  return turns.length ? turns : null
}
