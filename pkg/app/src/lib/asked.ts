import { partsOf, said as told } from './attach'

/** A turn as the chat holds it: who spoke, and what they said (words, or a list of parts). */
export interface Turn {
  id: string | number
  role: string
  content: unknown
}

/**
 * The question as its person wrote it: the one just before the turn `id` (an answer's own
 * question), else the conversation's last. What Schedule… opens on, from the header or from
 * an answer: always the ask, never the answer.
 */
export function questionOf(turns: readonly Turn[], id?: string | number): string {
  const at = id === undefined ? turns.length : turns.findIndex((one) => String(one.id) === String(id))
  const q = turns.slice(0, at < 0 ? turns.length : at).reverse().find((one) => one.role === 'user')
  if (!q) return ''
  if (typeof q.content === 'string') return told(q.content).text
  return Array.isArray(q.content) ? partsOf(q.content as never).flatMap((p) => (p.type === 'text' ? [p.text] : [])).join('\n') : ''
}
