// A text file that goes with a message to a bot. A run carries text alone, so the
// file is fenced under its name in the message the bot reads. Pure, so the fence
// and the limits are tested as data.

/** The agents route refuses an input over 128 KiB (apps/agents maxInput). */
export const MAX = 128 * 1024

/** A text file held beside the draft until it is sent. */
export interface File {
  name: string
  text: string
}

/** Whether the bytes read as text: no NUL, which no text file carries. */
export const texty = (text: string): boolean => !text.includes('\u0000')

/** The file's name as a fence's info string: one line, no backticks. */
const label = (name: string): string => name.replace(/[`\r\n]+/g, ' ').trim()

/**
 * The file fenced under its name. The fence is one backtick longer than the
 * longest run of backticks inside, so nothing in the file can close it.
 */
export function fence(file: File): string {
  const longest = Math.max(2, ...(file.text.match(/`+/g) ?? []).map((run) => run.length))
  const ticks = '`'.repeat(longest + 1)
  return `${ticks}${label(file.name)}\n${file.text.replace(/\n$/, '')}\n${ticks}`
}

/** What is sent: the words, then the file. */
export const compose = (draft: string, file: File | null): string =>
  [draft.trim(), file ? fence(file) : ''].filter(Boolean).join('\n\n')

/** Whether a message fits the route's input cap, in bytes as the route counts them. */
export const fits = (message: string): boolean => new TextEncoder().encode(message).length <= MAX
