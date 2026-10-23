/**
 * SCHEDULED — a prompt from Chat that runs itself (`/v1/auto`).
 *
 * The one scheduler is the platform's automations: a schedule said the way a
 * person says it ("every Monday at 9am") is turned into one by `POST
 * /v1/auto/cron` in the reader's own time zone, and `POST /v1/auto/automations`
 * keeps it, made in Chat (`source: "chat"`). Each run's answer lands in the
 * reader's Library; the list of them is Scheduled tasks in Dev.
 */

import type { Api } from './library'

/** When it runs, in the platform's words. */
export interface Schedule {
  kind: string
  at?: string
  day?: string
  cron?: string
  tz?: string
}

/** A schedule read from words: itself, the words it is said back in, and its next run. */
export interface When {
  schedule: Schedule
  says: string
  /** RFC 3339, or null when it runs only when asked. */
  next: string | null
}

/** The reader's own time zone, or UTC where the browser will not say. */
export function zone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Reads a schedule off the wire, or null for one with no kind. */
export function when(raw: unknown): When | null {
  const o = obj(raw)
  const s = obj(o.schedule)
  if (!str(s.kind)) return null
  const schedule: Schedule = { kind: str(s.kind) }
  for (const k of ['at', 'day', 'cron', 'tz'] as const) if (str(s[k])) schedule[k] = str(s[k])
  return { schedule, says: str(o.says), next: str(o.next) || null }
}

/** Turns words into a schedule, in `tz`. */
export async function cron(api: Api, text: string, tz: string, signal?: AbortSignal): Promise<When> {
  const got = when(await api.http.json<unknown>({ method: 'POST', path: '/v1/auto/cron', body: { text, tz }, signal }))
  if (!got) throw new Error('That is not a time the scheduler can read.')
  return got
}

/** A schedule's name: the prompt's first line, held to what the platform keeps. */
export function title(prompt: string): string {
  const first = prompt.trim().split('\n')[0]?.trim() ?? ''
  return first.length > 80 ? `${first.slice(0, 79).trimEnd()}…` : first || 'Scheduled prompt'
}

/** Keeps a prompt from Chat as an automation on `schedule`, and answers its id. */
export async function schedule(api: Api, prompt: string, at: Schedule, model?: string): Promise<string> {
  const body: Record<string, unknown> = {
    name: title(prompt),
    instructions: prompt.trim(),
    schedule: at,
    source: 'chat',
    permissions: 'ask',
    notify: true,
  }
  if (model) body.model = model
  const got = obj(await api.http.json<unknown>({ method: 'POST', path: '/v1/auto/automations', body }))
  const id = str(got.id)
  if (!id) throw new Error('The scheduler answered with no task.')
  return id
}
