// A signed-out turn answered by the host (`configure({ local })`): what it is sent.

import { words } from '@hanzo/ui/chat/pure'

/** One turn of the conversation the host's engine is asked to continue. */
export interface Turn {
  role: 'user' | 'assistant'
  content: string
}

/**
 * The conversation so far and the new question: the turns that said something
 * (a placeholder, a stop or a failure says nothing the engine should hear), then `question`.
 */
export function conversation(held: ReadonlyArray<{ role: string; content?: unknown }>, question: string, silent: ReadonlySet<string>): Turn[] {
  const said: Turn[] = []
  for (const turn of held) {
    const content = words(turn.content as Parameters<typeof words>[0]).trim()
    if ((turn.role === 'user' || turn.role === 'assistant') && content && !silent.has(content)) said.push({ role: turn.role, content })
  }
  return [...said, { role: 'user', content: question }]
}
