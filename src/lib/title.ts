/**
 * A title fit to show: a conversation's or a run's title as the server kept it,
 * less the markup a first message can carry (`<workspace-files>{…}</workspace-files>`,
 * a lone tag, a leading JSON object), its whitespace one space, cut to `max`
 * characters with an ellipsis; `fallback` when nothing readable is left.
 */
export function tidy(title: string | null | undefined, max = 80, fallback = 'Untitled'): string {
  let t = (title ?? '').replace(/<([a-z][\w-]*)[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<\/?[a-z][\w-]*[^>]*>/gi, ' ')
  // A JSON object the message opened with, balanced, goes whole.
  const m = t.match(/^\s*\{/)
  if (m) {
    let depth = 0
    let quoted = false
    for (let i = m[0].length - 1; i < t.length; i++) {
      const c = t[i]
      if (quoted) {
        if (c === '\\') i++
        else if (c === '"') quoted = false
      } else if (c === '"') quoted = true
      else if (c === '{') depth++
      else if (c === '}' && --depth === 0) {
        t = t.slice(i + 1)
        break
      }
    }
  }
  t = t.replace(/\s+/g, ' ').trim()
  if (!t) return fallback
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}
