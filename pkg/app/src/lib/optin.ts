/**
 * OPTING IN TO WHAT IS EXPERIMENTAL: the one client for the reader's choice and
 * their organization's block.
 *
 * A beta is PRIVATE (a SuperAdmin grants it, person by person) or PUBLIC (an
 * admin promoted it). A reader who opts in gets every public beta, unless their
 * organization turned it off; staff get every beta. Who is in is still the
 * cloud's answer at GET /v1/flag/platform, so `opens` (lib/betas) stays the one
 * predicate; this module only reads and writes the choice.
 *
 *   GET /v1/flag/optin      {on, blocked, public: [<beta id>]}   401 signed out
 *   PUT /v1/flag/optin      {on} -> the same shape               403 when blocked and on
 *   PUT /v1/flag/optin/org  {blocked} -> {blocked}               an org admin or a SuperAdmin
 *
 * A refusal is said in words a person can act on, never as a status code: each
 * is authored English (`phrase`), so a caller draws it through `t`.
 */

import { phrase } from '@hanzo/i18n'
import { api } from './api'
import { scope } from './session'

/** The reader's choice, their organization's block, and the betas that are public. */
export interface Optin {
  /** The reader opted in. */
  on: boolean
  /** Their organization turned it off for everyone in it. */
  blocked: boolean
  /** The ids (lib/betas) of the public betas. */
  public: string[]
}

/** Fired on window after the choice or the block changes, so a list can read again. */
export const CHANGED = 'hanzo.optin'

/** What a call says when it cannot be made, when it fails, and when it is refused. */
interface Words {
  offline: string
  failed: string
  refused?: string
}

const SIGNED_OUT = phrase('Sign in to choose experimental features.')

async function call(path: string, init: RequestInit | undefined, words: Words): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(`${api()}${path}`, { ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...scope() } })
  } catch {
    throw new Error(words.offline)
  }
  if (res.status === 401) throw new Error(SIGNED_OUT)
  if (res.status === 403 && words.refused) throw new Error(words.refused)
  if (!res.ok) throw new Error(words.failed)
  return res.json()
}

const told = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED))
}

function shape(body: unknown): Optin {
  const b = (body ?? {}) as Partial<Optin>
  return { on: b.on === true, blocked: b.blocked === true, public: Array.isArray(b.public) ? b.public.filter((id) => typeof id === 'string') : [] }
}

/** The reader's choice as the cloud holds it. */
export async function optin(): Promise<Optin> {
  return shape(
    await call('/v1/flag/optin', undefined, {
      offline: phrase('Your experimental features setting could not be read. Check your connection and try again.'),
      failed: phrase('Your experimental features setting could not be read. Try again in a moment.'),
    }),
  )
}

/** Opt the reader in or out. Refused while their organization has it turned off. */
export async function opt(on: boolean): Promise<Optin> {
  const out = shape(
    await call(
      '/v1/flag/optin',
      { method: 'PUT', body: JSON.stringify({ on }) },
      {
        offline: phrase('Your choice was not saved. Check your connection and try again.'),
        failed: phrase('Your choice was not saved. Try again in a moment.'),
        refused: phrase('Your team or organization has turned experimental features off.'),
      },
    ),
  )
  told()
  return out
}

/** Turn experimental features off, or back on, for everyone in the organization in scope. */
export async function block(blocked: boolean): Promise<{ blocked: boolean }> {
  const b = (await call(
    '/v1/flag/optin/org',
    { method: 'PUT', body: JSON.stringify({ blocked }) },
    {
      offline: phrase('The organization setting was not saved. Check your connection and try again.'),
      failed: phrase('The organization setting was not saved. Try again in a moment.'),
      refused: phrase('Only an admin of this organization can change this for everyone in it.'),
    },
  )) as { blocked?: unknown }
  told()
  return { blocked: b?.blocked === true }
}
