// A thing that broke, caught, scrubbed and filed. No React, so a spec reads it as it is.
//
// WHAT LEAVES THE DEVICE IS DECIDED BY A PERSON, NOT BY THIS FILE. `listen()`
// only remembers: the last error and the last lines the console said, scrubbed
// the moment they are written so a raw token is never held. Nothing is sent
// until `send()` is called, and the sheet that calls it shows the person every
// field first.
//
// ONE DESTINATION: the task app's own issues (`/v1/task/projects/<repo>/issues`
// on the gateway), authenticated by the person's IAM bearer like every other
// call. A screenshot is one presigned PUT to Hanzo S3 and is attached to the
// issue by its address. A repeat of the same break is the same fingerprint, and
// gets a "+1" on the issue already open instead of a second one.

import { api } from './lib/api'
import { bearer, scope } from './lib/session'
import { VERSION } from './version.gen'
import { where } from './where'

/** What broke. `http` is a /v1 call that answered 5xx. */
export type Kind = 'render' | 'error' | 'rejection' | 'http'

export interface Caught {
  kind: Kind
  message: string
  stack: string
  /** Path only: a query string can carry a token or an address. */
  route: string
  at: string
  /** Hashed from the kind, the message with its ids taken out, and the top frame. */
  fingerprint: string
  version: string
  agent: string
  lines: string[]
}

/** How many console lines ride with a report. */
export const LINES = 50

const MASK = '[redacted]'

const SECRETS: [RegExp, string][] = [
  [/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*/g, MASK],
  [/\b(Bearer|Basic)\s+[\w.~+/=-]{8,}/gi, `$1 ${MASK}`],
  [/\b(?:sk|pk|hk|rk|ghp|gho|ghs|github_pat|xox[abprs]|AKIA|ASIA)[-_]?[\w-]{12,}/g, MASK],
  [/((?:access|refresh|id|api|auth|session|csrf)?[_-]?(?:token|key|secret|password|passwd|pwd|cookie|authorization|signature|sig)\w*["']?\s*[:=]\s*["']?)[^\s"'&,;)}]+/gi, `$1${MASK}`],
  [/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, MASK],
  [/\b[A-Fa-f0-9]{32,}\b/g, MASK],
  [/\b[A-Za-z0-9+/_-]{40,}={0,2}/g, MASK],
]

/** The text with every token, key, cookie, password and email taken out. */
export function scrub(text: string): string {
  return SECRETS.reduce((s, [re, to]) => s.replace(re, to), text)
}

/** An address with its query and fragment gone, and its secrets with them. */
export const pathOf = (u: string): string => {
  try {
    return scrub(new URL(u, 'http://x').pathname)
  } catch {
    return scrub(u.split(/[?#]/)[0] ?? '')
  }
}

const fnv = (s: string, seed: number): string => {
  let h = seed >>> 0
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0
  return h.toString(16).padStart(8, '0')
}

/** The first frame that is code, with its line and column taken off: a rebuild moves them. */
const frame = (stack: string): string =>
  (stack.split('\n').find((l) => /\bat\b|@/.test(l) && !/node_modules/.test(l)) ?? '').replace(/:\d+(:\d+)?\)?\s*$/, '').replace(/\?[^\s)]*/, '').trim()

/** What the same break reads as every time: ids, numbers and hashes taken out. */
const shape = (message: string): string =>
  message.replace(/\b[0-9a-f]{8,}\b/gi, '#').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 200)

export function fingerprint(kind: Kind, message: string, stack: string): string {
  const key = `${kind}|${shape(message)}|${frame(stack)}`
  return fnv(key, 2166136261) + fnv(key, 5381)
}

const ring: string[] = []

const say = (level: string, args: unknown[]): string =>
  scrub(
    `${level} ${args
      .map((a) => {
        if (typeof a === 'string') return a
        if (a instanceof Error) return `${a.name}: ${a.message}`
        try {
          return JSON.stringify(a)
        } catch {
          return String(a)
        }
      })
      .join(' ')}`,
  ).slice(0, 500)

/** The console lines so far, newest last. */
export const lines = (): string[] => ring.slice(-LINES)

/** Writes one line, as the console wrapper does. */
export function note(level: string, args: unknown[]): void {
  ring.push(say(level, args))
  if (ring.length > LINES * 2) ring.splice(0, ring.length - LINES)
}

const subscribers = new Set<(c: Caught) => void>()

/** Hears every break. Returns what stops it. */
export function hear(fn: (c: Caught) => void): () => void {
  subscribers.add(fn)
  return () => void subscribers.delete(fn)
}

const seen = new Map<string, number>()

/** What the screen at a path is called on the crash screen ("/tabs" → "Tabs", "/chat/abc" → "Chat"), or '' at the root. */
export function screenOf(path: string): string {
  const first = path.split(/[/?#]/).filter(Boolean)[0] ?? ''
  return first ? first[0]!.toUpperCase() + first.slice(1) : ''
}

/** What the crash screen's Copy details puts on the clipboard: the error, the screen's path and the version, secrets out. */
export function details(message: string, path: string): string {
  return [`Error: ${scrub(message).slice(0, 500)}`, `Screen: ${pathOf(path)}`, `Version: ${where().report?.version ?? VERSION}`].join('\n')
}

/** Records a break, once per fingerprint a minute: a render loop is one report, not a thousand. */
export function catches(kind: Kind, error: unknown, route?: string): Caught | null {
  const e = error as { message?: unknown; stack?: unknown } | string | null | undefined
  const message = scrub(typeof e === 'string' ? e : String(e?.message ?? e ?? 'Unknown error')).slice(0, 500)
  const stack = scrub(typeof e === 'object' && e && typeof e.stack === 'string' ? e.stack : '').slice(0, 4000)
  const fp = fingerprint(kind, message, stack)
  const now = Date.now()
  if (now - (seen.get(fp) ?? 0) < 60_000) return null
  seen.set(fp, now)
  const c: Caught = {
    kind,
    message,
    stack,
    route: route ?? (typeof window === 'undefined' ? '' : pathOf(window.location.href)),
    at: new Date(now).toISOString(),
    fingerprint: fp,
    version: where().report?.version ?? VERSION,
    agent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    lines: lines(),
  }
  subscribers.forEach((fn) => fn(c))
  return c
}

let live = false
let sending = false

/**
 * Starts listening, once: window errors, unhandled rejections, 5xx from /v1,
 * and the console. Safe to call again.
 */
export function listen(): void {
  if (live || typeof window === 'undefined') return
  live = true
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const was = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      note(level, args)
      was(...args)
    }
  }
  window.addEventListener('error', (e) => {
    // A resource that failed to load is not a thrown error: its target is the element.
    if (e.target && e.target !== window) return
    catches('error', e.error ?? e.message)
  })
  window.addEventListener('unhandledrejection', (e) => void catches('rejection', e.reason))
  const was = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const res = await was(input, init)
    if (res.status >= 500) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const path = pathOf(url)
      // The report's own calls must never report themselves.
      if (path.startsWith('/v1/') && !sending) {
        const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
        catches('http', `${method} ${path} answered ${res.status}`)
      }
    }
    return res
  }
}

/** What the sheet sends, after the person has read and edited it. */
export interface Filing {
  caught: Caught
  title: string
  description: string
  /** A PNG data URL, or null when the person took it off. */
  shot: string | null
}

export interface Filed {
  /** The issue's handle on its board, `app#12`. */
  identifier: string
  /** True when it joined an issue already open. */
  again: boolean
}

/** The repository a report files to: the one Dev is open on, else the surface's product repo. */
export const repo = (): string => where().report?.repo ?? 'hanzoai/app'

const mark = (fp: string): string => `fp:${fp}`

/** The issue body. Everything in it has been through `scrub`. */
export function body(f: Filing, shot?: string): string {
  const c = f.caught
  return [
    f.description.trim() ? scrub(f.description.trim()) : '',
    '',
    `| | |\n|---|---|\n| Kind | ${c.kind} |\n| Route | \`${c.route}\` |\n| Version | ${c.version} |\n| When | ${c.at} |\n| Browser | ${scrub(c.agent)} |`,
    '',
    `**${c.message}**`,
    c.stack ? `\n\`\`\`\n${c.stack}\n\`\`\`` : '',
    c.lines.length ? `\n<details><summary>Console (last ${c.lines.length})</summary>\n\n\`\`\`\n${c.lines.join('\n')}\n\`\`\`\n</details>` : '',
    shot ? `\n![screenshot](${shot})` : '',
    `\n<!-- ${mark(c.fingerprint)} -->`,
  ]
    .filter((s, i, all) => s !== '' || all[i - 1] !== '')
    .join('\n')
}

const call = async (path: string, init: RequestInit = {}): Promise<Response> => {
  if (!bearer()) throw new Error('Sign in to send a report.')
  return fetch(`${api()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...scope(), ...init.headers },
  })
}

const BUCKET = 'reports'

/** One presigned PUT to Hanzo S3, then the address the issue carries. */
async function store(data: string, fp: string): Promise<string> {
  const png = await (await fetch(data)).blob()
  const made = await call('/v1/s3/buckets', { method: 'POST', body: JSON.stringify({ name: BUCKET }) })
  if (!made.ok && made.status !== 409) throw new Error(`screenshot store ${made.status}`)
  const key = `${fp}/${Date.now()}.png`
  const put = await call(`/v1/s3/buckets/${BUCKET}/objects`, { method: 'POST', body: JSON.stringify({ key }) })
  if (!put.ok) throw new Error(`screenshot store ${put.status}`)
  const { url } = (await put.json()) as { url: string }
  const up = await fetch(url, { method: 'PUT', body: png, headers: { 'Content-Type': 'image/png' } })
  if (!up.ok) throw new Error(`screenshot upload ${up.status}`)
  return `${api()}/v1/s3/buckets/${BUCKET}/objects/${key}`
}

interface Row {
  number: number
  identifier?: string
  title: string
  description?: string
  status?: string
}

/**
 * Files the report: a +1 on the open issue with this fingerprint, else a new
 * issue. The screenshot goes to S3 first and is named in the body.
 */
export async function send(f: Filing): Promise<Filed> {
  sending = true
  try {
    return await file(f)
  } finally {
    sending = false
  }
}

async function file(f: Filing): Promise<Filed> {
  const board = encodeURIComponent(repo().split('/').pop() ?? repo())
  const found = await call(`/v1/task/projects/${board}/issues`)
  if (!found.ok) throw new Error(`Could not reach the tracker (${found.status}).`)
  const open = ((await found.json()) as Row[] | { data?: Row[] })
  const rows = Array.isArray(open) ? open : (open.data ?? [])
  const twin = rows.find((r) => r.status !== 'done' && r.status !== 'canceled' && r.description?.includes(mark(f.caught.fingerprint)))
  const shot = f.shot ? await store(f.shot, f.caught.fingerprint) : undefined
  if (twin) {
    const note = `+1 from ${f.caught.version} on \`${f.caught.route}\` at ${f.caught.at}${f.description.trim() ? `\n\n${scrub(f.description.trim())}` : ''}${shot ? `\n\n![screenshot](${shot})` : ''}`
    const r = await call(`/v1/task/projects/${board}/issues/${twin.number}`, { method: 'PATCH', body: JSON.stringify({ comment: note }) })
    if (!r.ok) throw new Error(`Could not add to the issue (${r.status}).`)
    return { identifier: twin.identifier ?? `${board}#${twin.number}`, again: true }
  }
  const r = await call(`/v1/task/projects/${board}/issues`, {
    method: 'POST',
    body: JSON.stringify({ title: scrub(f.title.trim()) || f.caught.message.slice(0, 100), description: body(f, shot), status: 'backlog' }),
  })
  if (!r.ok) throw new Error(`Could not file the report (${r.status}).`)
  const made = (await r.json()) as Row
  return { identifier: made.identifier ?? `${board}#${made.number}`, again: false }
}
