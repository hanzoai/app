/**
 * The organization settings area's reads and writes, each on the API that owns it.
 *
 *   the org row            GET    /v1/iam/organizations/admin/<org>
 *   delete the org         DELETE /v1/iam/organizations/admin/<org>
 *   found a team org       POST   /v1/iam/organizations {owner: admin, name, displayName}
 *   business address       GET|PUT /v1/settings/organization (cloud's per-org config)
 *   API keys               GET|POST /v1/account/keys, DELETE /v1/account/keys/<id>
 *                          (yours; every key of the org for an admin; a secret shown once)
 *   payment methods        GET    /v1/billing/methods
 *   invoices               GET    /v1/billing/invoices
 *
 * The name, the logo, the members and the invitations are lib/hanzo/team.ts's,
 * and the plan and balance are lib/hanzo/tier.ts's. Nothing here decides who may
 * do what: every request carries the reader's bearer and organization (`scope`),
 * the server answers, and a refusal comes back as the server's own sentence.
 */

import { phrase, english, type Say } from '@hanzo/i18n'
import { scope } from './session'
import { api } from './api'
import { list } from './list'

/**
 * A refusal, with the status it came under and the server's words. One this
 * module words itself keeps its English source and arguments (`source`,
 * `values`), so `say` can put it in the reader's language; the server's words
 * have none and are shown as they came.
 */
export class Refusal extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly source?: string,
    readonly values?: Readonly<Record<string, string | number>>,
  ) {
    super(message)
  }
}

/** A refusal this module words: its English filled in as the message, the source kept for `say`. */
const worded = (status: number, source: string, values?: Readonly<Record<string, string | number>>): Refusal =>
  new Refusal(status, english(source, values), source, values)

/** IAM's code for "not yours to do", said as a sentence. */
const UNAUTHORIZED = /^auth:Unauthorized operation$|^forbidden$/i
const NOT_YOURS = phrase('Your role in this organization does not allow this.')

/** One request as the signed-in reader, in the organization this browser works in. */
async function ask<T>(path: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
  const res = await fetch(`${api()}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...scope(),
      ...(init.json === undefined ? null : { 'Content-Type': 'application/json' }),
    },
    body: init.json === undefined ? undefined : JSON.stringify(init.json),
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // An empty or HTML body carries nothing worth showing.
  }
  const said = (body ?? {}) as { detail?: string; msg?: string; error?: string; message?: string; status?: unknown }
  if (res.status === 401) throw worded(401, phrase('Your session expired. Sign in again.'))
  if (!res.ok || said.status === 'error') {
    const words = said.detail || said.msg || said.error || said.message || ''
    const status = res.ok ? 400 : res.status
    if (UNAUTHORIZED.test(words) || (status === 403 && !words)) throw worded(status, NOT_YOURS)
    throw words ? new Refusal(status, words) : worded(status, phrase('The server answered {status}.'), { status: res.status })
  }
  return body as T
}

const enc = encodeURIComponent

/**
 * The words of any failure, for a toast or a line under a control: a refusal
 * this module worded in the reader's language (an app passes its `t`), the
 * server's words as they came, else a plain line.
 */
export const say = (e: unknown, t: Say = english): string =>
  e instanceof Refusal && e.source
    ? t(e.source, e.values)
    : e instanceof Error && e.message
      ? e.message
      : t('That did not go through.')

// ── the organization ────────────────────────────────────────────────────────

/** The org row as IAM answers it. Every org row is filed under the reserved `admin` owner. */
export interface OrgRow {
  name: string
  displayName: string
  websiteUrl?: string
  isPersonal?: boolean
  avatar?: string
}

export const readOrg = (org: string): Promise<OrgRow> => ask<OrgRow>(`/v1/iam/organizations/admin/${enc(org)}`)

/** Deletes the org row. IAM decides who may; there is no undo. */
export const deleteOrg = (org: string): Promise<unknown> =>
  ask(`/v1/iam/organizations/admin/${enc(org)}`, { method: 'DELETE' })

/**
 * Creates an organization the reader owns: cloud's `POST /v1/account/orgs
 * {name}`, the one create every surface uses. Cloud files the row in IAM and
 * records the verified creator as its owner through IAM's membership API.
 * Answers the new organization's handle; a refusal is what the reader is shown.
 */
export const createOrg = async (name: string): Promise<string> => {
  const made = await ask<{ org?: string }>('/v1/account/orgs', { method: 'POST', json: { name } })
  if (!made?.org) throw worded(502, phrase('The organization was not created. Try again.'))
  return made.org
}

/** The handle an org is addressed by, from the name a person typed. */
export function slug(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 39)
    .replace(/-+$/, '')
}

// ── the business address ────────────────────────────────────────────────────

export interface Address {
  line1: string
  line2: string
  city: string
  state: string
  postalCode: string
  country: string
}

export const EMPTY_ADDRESS: Address = { line1: '', line2: '', city: '', state: '', postalCode: '', country: '' }

interface Config {
  config?: Record<string, unknown>
}

/** Where cloud keeps an org's own settings: one document per (org, product). */
const PROFILE = '/v1/settings/organization'

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

function addressOf(config: Record<string, unknown> | undefined): Address {
  const a = (config?.address ?? {}) as Record<string, unknown>
  return {
    line1: text(a.line1),
    line2: text(a.line2),
    city: text(a.city),
    state: text(a.state),
    postalCode: text(a.postalCode),
    country: text(a.country),
  }
}

export async function readAddress(): Promise<Address> {
  return addressOf((await ask<Config>(PROFILE)).config)
}

/**
 * Stores the address and answers what was stored. The document is written
 * whole, so the rest of it is read first and carried: a save of the address
 * never drops a field somebody else kept beside it.
 */
export async function saveAddress(next: Address): Promise<Address> {
  const held = (await ask<Config>(PROFILE)).config ?? {}
  const stored = await ask<Config>(PROFILE, { method: 'PUT', json: { config: { ...held, address: next } } })
  return addressOf(stored.config)
}

// ── keys ────────────────────────────────────────────────────────────────────

export type KeyType = 'secret' | 'publishable'

/**
 * One API key the reader may see: their own, or any key of an org they administer.
 * Each is its own credential, so creating one never replaces another. A secret
 * key's value is never listed; `key` carries it once, in the answer to a create.
 */
export interface ApiKey {
  id: string
  name: string
  type: KeyType
  /** The head of the credential, enough to tell which string it is. */
  prefix?: string
  /** The whole value: always for a publishable key, once for a new secret one. */
  key?: string
  status: 'active' | 'expired' | 'revoked' | 'disabled'
  /** Who the key speaks for, `<org>/<user>`. */
  creator?: string
  created?: string
  expires?: string
  revoker?: string
  revoked?: string
  /** What the key may reach; empty reaches whatever its holder does. */
  limit?: string[]
}

export async function keys(): Promise<ApiKey[]> {
  return list<ApiKey>((await ask<{ keys?: unknown }>('/v1/account/keys')).keys)
}

/** Creates a new key beside the ones held, and answers it with its value — once. */
export async function createKey(input: { name?: string; type: KeyType }): Promise<ApiKey> {
  const made = await ask<ApiKey>('/v1/account/keys', { method: 'POST', json: input })
  if (!made?.key) throw worded(502, phrase('IAM answered without a key.'))
  return made
}

/** Revokes exactly one key. It stays listed as revoked; every other key keeps working. */
export const revokeKey = (id: string): Promise<ApiKey> =>
  ask(`/v1/account/keys/${enc(id)}`, { method: 'DELETE' })

// ── billing reads ───────────────────────────────────────────────────────────

/** A card on file, as billing lists it. */
export interface Method {
  id: string
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  isDefault?: boolean
}

export async function methods(): Promise<Method[]> {
  const got = await ask<unknown>('/v1/billing/methods')
  return list<Method>(Array.isArray(got) ? got : (got as { data?: unknown } | null)?.data)
}

/** An invoice, amounts in whole cents. */
export interface Invoice {
  id: string
  numberStr?: string
  status?: string
  amountDue: number
  amountPaid?: number
  currency?: string
  createdAt?: string
  paidAt?: string
}

export async function invoices(): Promise<Invoice[]> {
  return list<Invoice>((await ask<{ invoices?: unknown }>('/v1/billing/invoices')).invoices)
}

/** Whole cents as money. English is `$1,234.56`; another locale follows its own currency format. */
export function cents(n: number, currency = 'usd', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() }).format(n / 100)
}
