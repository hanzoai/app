// A signed-out turn answered by the host (`configure({ local })`): what it is sent.

import { words } from '@hanzo/ui/chat/pure'

/** One part of a turn that carries more than words (OpenAI's shape): text, or a picture as a data URL. */
export type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

/** One turn of the conversation the host's engine is asked to continue: words, or parts when files came with it. */
export interface Turn {
  role: 'user' | 'assistant'
  content: string | Part[]
}

// What a signed-out reader's own files are read as, with no workspace to hold them: a picture goes with
// the turn as itself, a text file as its text; anything else needs the workspace, so it says so.
const TEXT = /^(text\/|application\/(json|xml|javascript|x-yaml|yaml|x-sh|sql|toml)$)/
const TEXT_NAME = /\.(txt|md|markdown|csv|tsv|json|jsonl|xml|ya?ml|toml|ini|log|html?|css|js|jsx|ts|tsx|py|rb|go|rs|java|kt|swift|c|h|cpp|hpp|cs|php|sh|sql)$/i
const IMAGE_NAME = /\.(png|jpe?g|gif|webp|avif|svg)$/i
export const TEXT_MAX = 1024 * 1024
export const IMAGE_MAX = 10 * 1024 * 1024
/** The most of a text file that goes with a turn. */
const TEXT_SENT = 100_000

/** How `file` can be read with no session: 'image', 'text', or a sentence saying why not. */
export function localRead(file: { name: string; type: string; size: number }): 'image' | 'text' | string {
  if (file.type.startsWith('image/') || (!file.type && IMAGE_NAME.test(file.name)))
    return file.size <= IMAGE_MAX ? 'image' : `${file.name} is too large to attach without signing in (pictures up to 10 MB).`
  if (TEXT.test(file.type) || TEXT_NAME.test(file.name))
    return file.size <= TEXT_MAX ? 'text' : `${file.name} is too large to attach without signing in (text files up to 1 MB).`
  return `Sign in to attach ${file.name}: without an account only pictures and text files can be read here.`
}

/** The parts a held file goes with: a text file as its name and text, a picture as its data URL. */
export const partOf = (name: string, read: { text: string } | { image: string }): Part =>
  'image' in read ? { type: 'image_url', image_url: { url: read.image } } : { type: 'text', text: `${name}:\n${read.text.slice(0, TEXT_SENT)}` }

/**
 * The conversation so far and the new question: the turns that said something
 * (a placeholder, a stop or a failure says nothing the engine should hear), then `question` with the
 * parts of the files that came with it.
 */
export function conversation(held: ReadonlyArray<{ role: string; content?: unknown }>, question: string, silent: ReadonlySet<string>, attached: readonly Part[] = []): Turn[] {
  const said: Turn[] = []
  for (const turn of held) {
    const content = words(turn.content as Parameters<typeof words>[0]).trim()
    if ((turn.role === 'user' || turn.role === 'assistant') && content && !silent.has(content)) said.push({ role: turn.role, content })
  }
  return [...said, { role: 'user', content: attached.length ? [{ type: 'text', text: question }, ...attached] : question }]
}
