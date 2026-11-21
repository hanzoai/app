/**
 * What a person said "Don't ask again" to, per kind of spend: each kind is its
 * own yes, so trusting one (starting a cloud machine) never waves another
 * through (turning on pay-as-you-go).
 *
 * A yes is the PERSON'S, in one ORGANIZATION: it is kept under their account
 * (the token's subject) and the organization they work in, so the next person
 * on a shared computer, or the same person spending another organization's
 * plan, is asked again. Nobody signed in is always asked. `forget` takes every
 * yes back, in every organization (the account menu's "Ask me again before spending"). A store that
 * refuses means the confirm simply asks every time.
 */

import { org, subject } from './session'

/**
 * Every paid action that can be started with one press, each its own kind: a yes to one (a Tabs
 * machine) never starts another (a bot's desktop), however alike they are. Each says whether a
 * "Don't ask again" may cover it, so the rule lives with the kind and no call site can forget it:
 *
 *   · ALWAYS ASKED (false): the organization's pay-as-you-go, and anything that then runs without
 *     the person there to see it and stop it, on a schedule or around the clock.
 *   · MAY BE REMEMBERED (true): what the person starts, watches and can stop themselves.
 */
const KINDS = {
  // Turns on the organization's pay-as-you-go.
  credits: false,
  // A task that runs on its schedule, whoever is watching.
  schedule: false,
  // A run of a bot's automation: the bot works on its own, unwatched (agents.ts RUNS, 24/7).
  'automation-run': false,
  // A cloud machine in Tabs, one kind per class as @hanzo/tabs remembers it (a yes to a terminal
  // never starts a desktop), a bot's desktop and a task on it: each in front of
  // the person, who stops it.
  'tabs-dev': true,
  'tabs-desktop': true,
  'tabs-browser': true,
  'bot-desktop': true,
  'bot-task': true,
  // Design's makers (@hanzo/studio), each asked where its paid call starts. Pictures from the gateway are made
  // while the person waits and watches, and Stop ends them: a yes may stay.
  'design-image': true,
  // A gateway clip is a job the video model runs to the end, and a render on the org's GPU (a Zen picture, a
  // Wan clip, music, 3D) waits in the GPU's queue: both go on when the page closes, so each is asked.
  'design-video': false,
  'design-gpu': false,
  // Flow's Run queues the graph on the GPU, where it runs on whether the page follows it or not.
  'flow-run': false,
  // Flow's Copilot: one model request that edits the canvas in front of the person.
  'flow-mutate': true,
} as const

/**
 * @hanzo/build's spends, kept apart from the app's own by the `build.` prefix no app kind
 * carries. The package names the key itself (`Spend.again`, `<kind>.<uses>`), so each is its
 * `again` and nothing else; a spend whose `again` is null has no kind here and is always asked.
 * A bot is never remembered, whatever its `again` says: a 24/7 bot runs unwatched on a budget of
 * its own, like a schedule.
 */
const BUILD_KINDS = ['run', 'task-run', 'task', 'bot', 'machine', 'publish'] as const
const BUILD_USES = ['computer', 'credits'] as const
type BuildKind = `build.${(typeof BUILD_KINDS)[number]}.${(typeof BUILD_USES)[number]}`
const BUILD = Object.fromEntries(BUILD_KINDS.flatMap((k) => BUILD_USES.map((u) => [`build.${k}.${u}`, k !== 'bot']))) as Record<BuildKind, boolean>

const ALL: Record<keyof typeof KINDS | BuildKind, boolean> = { ...KINDS, ...BUILD }
export type Spend = keyof typeof ALL
export const SPENDS = Object.keys(ALL) as Spend[]

/** The kind an @hanzo/build `again` is kept as, or null for one the package does not name (it is then always asked). */
export function fromBuild(again: string | null): Spend | null {
  const kind = `build.${again}`
  return again && Object.hasOwn(BUILD, kind) ? (kind as Spend) : null
}

/** Whether a "Don't ask again" may cover this kind of spend. */
export const rememberable = (kind: Spend): boolean => ALL[kind] === true

const ROOT = 'hanzo.spend.trusted.'

/** A subject or organization as one key part: escaped, dots too, so no part can end where another's key begins. */
const part = (s: string): string => encodeURIComponent(s).replace(/\./g, '%2E')

/** The prefix of everything this person said yes to, in every organization, or null when nobody is signed in. */
function person(): string | null {
  const sub = subject()
  return sub ? `${ROOT}${part(sub)}.` : null
}

/** The prefix of this person's yeses in the organization they work in now. */
function whose(): string | null {
  const at = person()
  return at ? `${at}${part(org() ?? '-')}.` : null
}

/** Whether this kind of spend starts without asking. A kind no yes may cover never does. */
export function trusted(kind: Spend): boolean {
  const at = whose()
  if (!at) return false
  if (!rememberable(kind)) {
    kept() // reading the yeses removes one an older build kept for this kind
    return false
  }
  try {
    return window.localStorage.getItem(at + kind) === '1'
  } catch {
    return false
  }
}

/** Start this kind of spend without asking from now on, for this person in this organization. */
export function trust(kind: Spend): void {
  const at = whose()
  if (!at || !rememberable(kind)) return
  try {
    window.localStorage.setItem(at + kind, '1')
  } catch {
    /* no store: the confirm keeps asking */
  }
}

/**
 * Every yes this person keeps, in any organization, by its key. A yes to a kind no yes may cover
 * (credits, kept by a build from before that rule), or to a kind no longer listed, is removed as
 * it is found, never honoured.
 */
function kept(): string[] {
  const at = person()
  if (!at) return []
  try {
    const store = window.localStorage
    const mine = Array.from({ length: store.length }, (_, i) => store.key(i) ?? '').filter((key) => key.startsWith(at))
    // The kind is everything after the organization: subject and organization have their dots
    // escaped, so the first dot after the subject ends the organization (a build kind has dots).
    // A kind no yes may cover, or one no longer listed (the one `tabs-machine` that covered every class), is never honoured.
    const stale = mine.filter((key) => ALL[key.slice(key.indexOf('.', at.length) + 1) as Spend] !== true)
    for (const key of stale) store.removeItem(key)
    return mine.filter((key) => !stale.includes(key))
  } catch {
    return []
  }
}

/** Whether this person said "Don't ask again" to anything, in any organization. */
export const trusts = (): boolean => kept().length > 0

/** Ask again before every kind of spend, in every organization: this person's every yes is taken back. */
export function forget(): void {
  try {
    for (const key of kept()) window.localStorage.removeItem(key)
  } catch {
    /* nothing kept */
  }
}
