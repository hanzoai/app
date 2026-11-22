// SKILLS, AGENTS AND PERSONAS WITHOUT A SLASH (hanzo-inc/app issue 314).
//
// Nobody has to know `/code-review` exists for a message to be reviewed the way
// that skill reviews. While Chat is on "Let Hanzo choose" (the default), each
// message asks Kai (POST /v1/tool/detect, @hanzo/build `detect`) which skills
// apply to it, and the ones that do ride with that message alone, a few
// thousand characters each. The conversation's system turn names the personas
// Hanzo may bring in, so one is taken up when a message calls for it. Nothing is
// switched on for the org: Kai is only asked.
//
// "Preload into this chat" is the other way, and what `+` and `/` always did:
// the skills and agents picked there go into every message, which costs context
// whether or not a message needs them, and Hanzo adds nothing of its own.

import { detect, skillsSaid, type Target } from '@hanzo/build'
import { TEAM } from './team'

/** At most this many skills join one message. */
export const CHOSEN = 2

/** How many candidates Kai is asked for, before the ones that fall short are left out. */
const ASKED = 8

/**
 * How sure Kai must be. Its default (0.55) let in skills that had nothing to do
 * with the message (an org audit-log reader for "make my landing page look
 * better on phones"), so a chosen skill must clear a higher bar.
 */
export const SURE = 0.8

/** The most of one chosen skill a message carries. A chosen skill stays in the conversation's history, so it carries less than a preloaded one. */
export const CHOSEN_MAX = 3000

/** How long a message waits for Kai before it goes without what Kai would have chosen. */
export const WAIT = 1200

/** Shorter than this, a message is not worth asking about ("thanks", "go on"). */
const SHORT = 12

export interface Chosen {
  /** The skills that joined the message. */
  names: string[]
  /** What they add to it, '' when none. */
  text: string
}

export const NONE: Chosen = { names: [], text: '' }

/** The skills a conversation's earlier turns already carried, by the line `skillsSaid` opens each with. */
export function carried(turns: readonly { role: string; content?: unknown }[]): string[] {
  const out = new Set<string>()
  for (const t of turns) {
    if (t.role !== 'user' || typeof t.content !== 'string') continue
    for (const m of t.content.matchAll(/Use the (?:skill "([^"]+)" where it applies|"([^"]+)" skill)/g)) out.add((m[1] ?? m[2])!)
  }
  return [...out]
}

/**
 * Whether a skill may be chosen on its own: a skill a person could pick from
 * `+` (`known`, when the shelf has been read), never one of the platform's API
 * descriptors (`audit_audit`, `ai_chats`: an underscore, not a skill's hyphen).
 */
export const choosable = (name: string, known: readonly string[] = []): boolean => !name.includes('_') && (!known.length || known.includes(name))

/** Threshold and cap when a user explicitly asks Kai to analyze and apply skills via `/skill [query]`. */
export const EXPLICIT_SURE = 0.55
export const EXPLICIT_CHOSEN = 3

export interface SkillCommand {
  /** Query after `/skill` (empty string when invoked bare as `/skill` or `/skills`). */
  query: string
}

/** Parse an explicit `/skill [query]` (or `/skills [query]`) command from a composer message. */
export function parseSkillCommand(text: string): SkillCommand | null {
  const m = text.trim().match(/^\/skills?(?:\s+([\s\S]*))?$/i)
  if (!m) return null
  return { query: (m[1] ?? '').trim() }
}

/**
 * Build a concise detection query from recent conversation turns when `/skill`
 * is invoked bare (without a query), so Kai (`POST /v1/tool/detect`) analyzes
 * the active thread context and returns matching skills.
 */
export function skillContext(
  turns: readonly { role: string; content?: unknown }[],
  fallback = '',
): string {
  const pieces: string[] = []
  for (let i = turns.length - 1; i >= 0 && pieces.length < 4; i--) {
    const t = turns[i]
    if (t.role !== 'user' && t.role !== 'assistant') continue
    const raw = typeof t.content === 'string' ? t.content : ''
    const cleaned = raw
      .replace(/<workspace-files>[\s\S]*?<\/workspace-files>/g, '')
      .replace(/^\/skills?$/gim, '')
      .trim()
    if (cleaned) pieces.unshift(cleaned.slice(0, 400))
  }
  const joined = pieces.join('\n').trim()
  if (joined) return joined.slice(0, 1200)
  return fallback.trim() || 'general coding, productivity, and assistant skills'
}

/** Detect whether a `/skill <query>` prompt is asking to create, author, or adapt a skill. */
export function isSkillAuthoring(text: string): boolean {
  const s = text.trim()
  if (!s) return false
  return (
    /\b(?:make|create|build|write|draft|author|design|generate|new|adapt|customi[sz]\w*|fork|extend|modify|update|turn\s+.+\s+into)\b[\s\S]*\bskills?\b|\bskills?\b[\s\S]*\b(?:for|from|about|that|to\s+handle|to\s+help)\b/i.test(
      s,
    ) ||
    /^(?:adapt|customi[sz]e|fork|extend|modify|draft|author|(?:make|create|build|write)\s+(?:me\s+)?(?:a\s+)?new)\b/i.test(s)
  )
}

/**
 * Extra guidance attached to an explicit `/skill <query>` turn so the model can
 * use matched skills, adapt a close existing skill, or author a portable SKILL.md
 * when the user asks to create/adapt one or no catalog skill matches.
 */
export function skillCommandNote(query: string, matched: readonly string[], authoring: boolean): string {
  if (authoring) {
    const found = matched.filter((n) => n !== 'skill-creator')
    const basis = found.length
      ? `Kai found related existing skill(s) in the catalog (${found.join(', ')}) whose instructions are attached above. Adapt or extend them if they fit, or author a fresh skill if a dedicated one is cleaner.`
      : 'Kai checked the skills catalog and no existing skill closely matched this request.'
    return [
      `The user invoked /skill to create or adapt a skill: "${query}".`,
      basis,
      'Output a complete, ready-to-use `SKILL.md` with valid YAML frontmatter (`name:` lowercase kebab-case, `description:` concise trigger criteria under 1024 chars) followed by clear, actionable instructions, edge cases, and examples.',
      'Mention that they can save it in Customize › Skills or at `~/.agents/skills/<name>/SKILL.md` (compatible with Hanzo App, Hanzo Bot, Hanzo Dev, Claude Code, Codex, and Cursor).',
    ].join(' ')
  }
  if (!matched.length) {
    return `The user invoked /skill for "${query}", and Kai found no matching pre-installed skill in the catalog. Answer the request directly using your best expertise, and offer to turn the workflow into a reusable \`SKILL.md\` (saveable in Customize › Skills or \`~/.agents/skills/<name>/SKILL.md\`) if they want to keep it.`
  }
  return ''
}

export interface ChooseOptions {
  /** Override minimum Kai confidence (default: SURE = 0.8; explicit `/skill` uses EXPLICIT_SURE = 0.55). */
  minProbability?: number
  /** Override max skills attached to one turn (default: CHOSEN = 2; explicit `/skill` uses EXPLICIT_CHOSEN = 3). */
  maxSkills?: number
  /** Skip the minimum prompt length guard (used for explicit `/skill <short>` invocations). */
  explicit?: boolean
  /** Extra skill names to include alongside Kai's picks when available (e.g. `skill-creator` for authoring). */
  prefer?: readonly string[]
}

/**
 * What Kai chooses for `prompt`: up to `CHOSEN` skills it is `SURE` of that a
 * person could have picked themselves (`choosable`), leaving out the ones `skip`
 * names (preloaded, or said another way already). A skill an earlier turn
 * carried (`had`) is named again rather than carried twice. Never throws: a
 * message Kai cannot answer for goes as it is.
 */
export async function choose(
  t: Target,
  prompt: string,
  skip: readonly string[] = [],
  had: readonly string[] = [],
  signal?: AbortSignal,
  known: readonly string[] = [],
  options?: ChooseOptions,
): Promise<Chosen> {
  const words = prompt.trim()
  if (!words || (!options?.explicit && words.length < SHORT)) return NONE
  const minProb = options?.minProbability ?? SURE
  const limit = options?.maxSkills ?? CHOSEN
  try {
    const found = await detect(t, words, { maxSkills: ASKED, maxTools: 1, signal })
    const detected = found
      .filter((d) => d.skill && d.probability >= minProb && !skip.includes(d.name) && choosable(d.name, known))
      .map((d) => d.name)
    const extra = (options?.prefer ?? []).filter(
      (n) => !skip.includes(n) && !detected.includes(n) && choosable(n, known),
    )
    const names = [...detected, ...extra].slice(0, limit)
    if (!names.length) return NONE
    const fresh = names.filter((n) => !had.includes(n))
    const again = names.filter((n) => had.includes(n)).map((n) => `Use the "${n}" skill where it applies, as earlier in this conversation.`)
    const taught = fresh.length ? await skillsSaid(t, fresh, CHOSEN_MAX).catch(() => fresh.map((n) => `Use the "${n}" skill where it applies.`).join('\n\n')) : ''
    return { names, text: [taught, ...again].filter(Boolean).join('\n\n') }
  } catch {
    return NONE
  }
}

/** `p`, or `fallback` once `ms` have passed without it. */
export function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((done) => {
    const timer = setTimeout(() => done(fallback), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        done(v)
      },
      () => {
        clearTimeout(timer)
        done(fallback)
      },
    )
  })
}

/**
 * The personas Hanzo may bring in, for the conversation's system turn: each by
 * name and part, the ones already in the conversation left out. One line a
 * request, the same every request, so it costs little and is never repeated in
 * the history.
 */
export function personas(cast: readonly string[]): string {
  const there = new Set(cast.map((n) => n.toLowerCase()))
  const team = TEAM.filter((one) => !there.has(one.name.toLowerCase()) && !there.has(one.id))
  if (!team.length) return ''
  return [
    `Personas you may bring in without being asked: ${team.map((one) => `${one.name} (${one.role})`).join(', ')}.`,
    'When a message clearly calls for one of them, answer with that persona’s expertise and say in a few words who you brought in. Otherwise answer as yourself.',
  ].join(' ')
}
