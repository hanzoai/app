/** Reported token usage and explicitly estimated context. Never stores prompt text. */
export interface Tokens { input: number; output: number; total: number; cached?: number; reasoning?: number; model?: string }
export interface Turn { role: string; content?: unknown }
const count = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
export function tokensOf(raw: unknown): Tokens | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Record<string, any>
  const input = v.prompt_tokens ?? v.input_tokens
  const output = v.completion_tokens ?? v.output_tokens
  if (!count(input) || !count(output)) return null
  const cached = v.prompt_tokens_details?.cached_tokens ?? v.cache_read_input_tokens
  const reasoning = v.completion_tokens_details?.reasoning_tokens
  return { input, output, total: count(v.total_tokens) ? v.total_tokens : input + output,
    ...(count(cached) ? { cached } : {}), ...(count(reasoning) ? { reasoning } : {}) }
}
/** Stable request identity: organization, model, and transcript through the last user turn. */
export function tokenKey(org: string | null, model: string, messages: readonly Turn[], subject = ''): string {
  let last = messages.length - 1
  while (last >= 0 && messages[last].role !== 'user') last--
  if (last < 0) return ''
  const text = JSON.stringify(messages.slice(0, last + 1).map(({ role, content }) => ({ role, content })))
  let a = 2166136261, b = 5381
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i) }
  return `${org ?? ''}:${subject}:${model}:${text.length}:${a >>> 0}:${b >>> 0}`
}
const held = new Map<string, Tokens>()
const listeners = new Set<() => void>()
export const subscribeTokens = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f) } }
export const readTokens = (key: string) => held.get(key) ?? null
export function recordTokens(key: string, usage: Tokens): void {
  if (!key) return
  held.delete(key); held.set(key, usage)
  if (held.size > 100) held.delete(held.keys().next().value!)
  for (const f of listeners) f()
}
export function clearTokens(): void { held.clear(); for (const f of listeners) f() }
const textOf = (v: unknown): string => typeof v === 'string' ? v : Array.isArray(v) ? v.filter((p) => p?.type === 'text').map((p) => p.text ?? '').join('\n') : ''
export function contextOf(messages: readonly Turn[], draft = '', tools?: unknown) {
  const system = messages.filter((m) => m.role === 'system' || m.role === 'developer').map((m) => textOf(m.content)).join('\n')
  const conversation = messages.filter((m) => m.role !== 'system' && m.role !== 'developer').map((m) => textOf(m.content)).join('\n')
  const estimate = (s: string) => s ? Math.ceil(s.length / 4) : 0
  const rows = [ { name: 'System & instructions', tokens: estimate(system) }, { name: 'Tool definitions', tokens: estimate(tools ? JSON.stringify(tools) : '') }, { name: 'Conversation', tokens: estimate(conversation) }, { name: 'Draft', tokens: estimate(draft) } ]
  return { rows, total: rows.reduce((n, r) => n + r.tokens, 0), images: messages.some((m) => Array.isArray(m.content) && m.content.some((p: any) => p?.type !== 'text')) }
}

/** A rotated IAM token keeps the same subject. An opaque token has no subject. */
export function tokenSubject(authorization: string | null): string {
  try {
    const part = authorization?.replace(/^Bearer /i, '').split('.')[1]
    if (!part) return ''
    const v = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof v.sub === 'string' ? v.sub : ''
  } catch { return '' }
}
