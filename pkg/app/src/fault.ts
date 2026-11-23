// A thing that broke, caught, scrubbed and filed. No React, so a spec reads it as it is.
//
// Uncaught errors (window errors, unhandled rejections, React render errors, and /v1
// 5xx responses) are scrubbed immediately and reported fail-soft to Hanzo's central
// collector (`POST /v1/event`) with source, release, URL, and org context (from the
// signed-in IAM bearer, or the host's publishable ingest key when signed out).
//
// User-submitted "Report a problem" feedback goes to the SAME central collector
// (`POST /v1/event`, `event: 'user_feedback'`) for BOTH signed-in and unsigned users,
// never hidden in a user's private Tasks board, with a clear confirmation reference.

import { keyForPage, ORG_KEY } from '@hanzo/event'
import { api } from './lib/api'
import { bearer, org, scope, subject } from './lib/session'
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
  void reportCaught(c)
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
      // The report's own calls and telemetry ingest must never report themselves.
      if (path.startsWith('/v1/') && path !== '/v1/event' && !sending) {
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

/** Official Hanzo Discord community invite for direct user support. */
export const DISCORD_HELP_URL = 'https://discord.com/invite/XthHQQj'

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
  if (!bearer()) throw new Error('Sign in to upload a screenshot.')
  return fetch(`${api()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...scope(), ...init.headers },
  })
}

const ANON_KEY = 'hanzo:fault:anon'

function anonId(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = window.localStorage.getItem(ANON_KEY)
      if (existing) return existing
      const fresh = `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
      window.localStorage.setItem(ANON_KEY, fresh)
      return fresh
    }
  } catch {
    /* ignore storage errors */
  }
  return `anon_${Date.now().toString(36)}`
}

/** Resolve the emitting surface name for central error/feedback attribution. */
export function sourceOf(): string {
  if (where().team) return 'team'
  if (typeof window !== 'undefined') {
    const proto = window.location?.protocol ?? ''
    const host = (window.location?.hostname ?? '').toLowerCase()
    if (proto === 'tauri:' || host === 'tauri.localhost') return 'desktop'
    if (host === 'hanzo.team' || host.endsWith('.hanzo.team')) return 'team'
  }
  return 'app'
}

function siteOf(): string {
  if (typeof window === 'undefined') return 'app'
  const host = (window.location?.hostname ?? '').trim()
  if (!host || host === 'tauri.localhost') return sourceOf() === 'desktop' ? 'desktop.hanzo.app' : 'hanzo.app'
  return host
}

function pageUrlOf(route: string): string {
  if (typeof window === 'undefined') return route
  const origin = window.location?.origin
  if (origin && origin !== 'null') return `${origin}${route.startsWith('/') ? route : `/${route}`}`
  return route
}

/** Publishable ingest key for anonymous / fallback central error & feedback collection. */
export function publishableKey(): string {
  const configured = where().key?.trim()
  if (configured && configured.startsWith('pk-')) return configured
  try {
    const byPage = keyForPage()
    if (byPage) return byPage
  } catch {
    /* non-browser or unmapped host */
  }
  return ORG_KEY.hanzo
}

const kindErrorType = (kind: Kind): string => {
  switch (kind) {
    case 'render':
      return 'RenderError'
    case 'rejection':
      return 'UnhandledRejection'
    case 'http':
      return 'HttpError'
    default:
      return 'Error'
  }
}

/**
 * Post one canonical event batch to Hanzo's central `/v1/event` collector.
 * Signed-in callers authenticate with their IAM bearer (stamping their real org
 * server-side); unsigned callers (or expired-token fallback) use the write-only
 * publishable key (`?ingest_key=pk-...`) as a CORS-simple request.
 */
async function postEvent(event: Record<string, unknown>, keepalive = false): Promise<Response> {
  const base = api().replace(/\/+$/, '')
  const bodyText = JSON.stringify({ batch: [event] })
  const token = bearer()
  if (token) {
    const res = await fetch(`${base}/v1/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: bodyText,
      keepalive,
    })
    if (res.ok || (res.status !== 401 && res.status !== 403)) return res
  }
  const key = publishableKey()
  return fetch(`${base}/v1/event?ingest_key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: bodyText,
    keepalive,
  })
}

/** Best-effort automatic delivery of a caught uncaught error/rejection to `/v1/event`. */
async function reportCaught(c: Caught): Promise<void> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return
  const wasSending = sending
  sending = true
  try {
    const sub = subject()
    const activeOrg = org()
    const product = sourceOf()
    const release = c.version || VERSION
    await postEvent(
      {
        messageId: `err-${c.fingerprint}-${Date.now().toString(36)}`,
        type: 'error',
        timestamp: c.at,
        distinctId: sub ?? anonId(),
        ...(sub ? { personId: sub } : {}),
        product,
        release,
        environment: 'production',
        site: siteOf(),
        url: pageUrlOf(c.route),
        path: c.route,
        level: 'error',
        library: '@hanzo/app',
        libraryVersion: release,
        error: {
          type: kindErrorType(c.kind),
          message: c.message,
          ...(c.stack ? { stack: c.stack } : {}),
          handled: false,
        },
        properties: {
          kind: c.kind,
          source: product,
          repo: repo(),
          fingerprint: c.fingerprint,
          signed_in: Boolean(bearer()),
          ...(activeOrg ? { org: activeOrg } : {}),
        },
      },
      true,
    )
  } catch {
    /* fail-soft: background telemetry must never mask the app error */
  } finally {
    sending = wasSending
  }
}

const BUCKET = 'reports'

/** Decode a data: URL in memory without fetch() so strict CSP connect-src never blocks it. */
function dataUrlToBlob(data: string): Blob {
  const comma = data.indexOf(',')
  if (!data.startsWith('data:') || comma === -1) {
    throw new Error('invalid screenshot data URL')
  }
  const meta = data.slice(5, comma)
  const mime = meta.split(';')[0] || 'image/png'
  const raw = data.slice(comma + 1)
  if (meta.includes(';base64')) {
    const bin = atob(raw)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }
  return new Blob([decodeURIComponent(raw)], { type: mime })
}

/** One presigned PUT to Hanzo S3, then the address the issue carries. */
async function store(data: string, fp: string): Promise<string> {
  const png = dataUrlToBlob(data)
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

const REPORTED_KEY = 'hanzo:reported:v1'
const REPORTED_TTL_MS = 24 * 60 * 60 * 1000

interface ReportedEntry {
  identifier: string
  at: number
}

function readReported(): Record<string, ReportedEntry> {
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage?.getItem(REPORTED_KEY) : null
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ReportedEntry>
    const now = Date.now()
    const clean: Record<string, ReportedEntry> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.identifier === 'string' && typeof v.at === 'number' && now - v.at < REPORTED_TTL_MS) {
        clean[k] = v
      }
    }
    return clean
  } catch {
    return {}
  }
}

function rememberReported(keys: string[], identifier: string): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return
    const map = readReported()
    const entry: ReportedEntry = { identifier, at: Date.now() }
    for (const k of keys) {
      if (k) map[k] = entry
    }
    window.sessionStorage.setItem(REPORTED_KEY, JSON.stringify(map))
  } catch {
    /* sessionStorage may be unavailable */
  }
}

const normTitle = (s: string): string => shape(s).toLowerCase()

let inFlight: Promise<Filed> | null = null

/**
 * Sends user-submitted problem reports and feedback directly to Hanzo's central
 * `/v1/event` collector so every report arrives with source, release, URL, and
 * user/org context — working for BOTH signed-in and unsigned users.
 */
export async function send(f: Filing): Promise<Filed> {
  if (inFlight) return inFlight
  sending = true
  const work = file(f).finally(() => {
    sending = false
    inFlight = null
  })
  inFlight = work
  return work
}

async function file(f: Filing): Promise<Filed> {
  const wantedTitle = scrub(f.title.trim()) || f.caught.message.slice(0, 100)
  const noteText = scrub(f.description.trim())
  const dedupKeys = [mark(f.caught.fingerprint), `title:${normTitle(wantedTitle)}`]

  // If this browser session already reported this exact issue and the user added
  // no new written note, don't duplicate submissions.
  const prevMap = readReported()
  const prev = dedupKeys.map((k) => prevMap[k]).find(Boolean)
  if (prev && !noteText) {
    return { identifier: prev.identifier, again: true }
  }

  let shot: string | undefined
  if (f.shot && bearer()) {
    try {
      shot = await store(f.shot, f.caught.fingerprint)
    } catch (e) {
      // Never block filing a bug report just because screenshot upload failed.
      console.warn('report screenshot skipped:', e instanceof Error ? e.message : String(e))
    }
  }

  const ref = `FB-${f.caught.fingerprint.slice(0, 8).toUpperCase()}`
  const sub = subject()
  const activeOrg = org()
  const product = sourceOf()
  const release = f.caught.version || VERSION

  const res = await postEvent({
    messageId: `${ref.toLowerCase()}-${Date.now().toString(36)}`,
    type: 'error',
    event: 'user_feedback',
    timestamp: new Date().toISOString(),
    distinctId: sub ?? anonId(),
    ...(sub ? { personId: sub } : {}),
    product,
    release,
    environment: 'production',
    site: siteOf(),
    url: pageUrlOf(f.caught.route),
    path: f.caught.route,
    level: 'error',
    library: '@hanzo/app',
    libraryVersion: release,
    error: {
      type: 'UserFeedback',
      message: wantedTitle,
      ...(f.caught.stack ? { stack: f.caught.stack } : {}),
      handled: true,
    },
    properties: {
      feedback: true,
      report_id: ref,
      kind: f.caught.kind,
      source: product,
      repo: repo(),
      title: wantedTitle,
      description: noteText,
      route: f.caught.route,
      version: release,
      fingerprint: f.caught.fingerprint,
      agent: scrub(f.caught.agent),
      console_lines: f.caught.lines.slice(-20).join('\n'),
      ...(shot ? { screenshot_url: shot } : {}),
      signed_in: Boolean(bearer()),
      ...(activeOrg ? { org: activeOrg } : {}),
    },
  })

  if (!res.ok) {
    throw new Error(`Could not send report (${res.status}).`)
  }
  rememberReported(dedupKeys, ref)
  return { identifier: ref, again: Boolean(prev) }
}
