/**
 * Gmail, from the browser: the Google Workspace token Setup's connect keeps,
 * the consent that gets one, and one message sent with it.
 *
 * THE TOKEN NEVER LEAVES THIS BROWSER. Setup's connect is Google's browser
 * consent (response_type=token): an access token of about an hour, no refresh,
 * kept in localStorage under TOKENS as `{ [email]: { accessToken, scope,
 * connectedAt, expiresAt? } }` (`default` when Google named no address), the
 * addresses under ACCOUNTS. This module is the one reader and writer of both;
 * Setup and the site's portal call it rather than the keys.
 *
 * WHICH ACCOUNT. `gmail(email)` answers the account the person chose; with no
 * choice it answers the live one connected most recently, the token least
 * likely to have run out. A token that may not send (its scope names neither
 * gmail.modify, gmail.send nor the full mail scope) or that expires within a
 * minute is no token: the answer is null and the person reconnects.
 */

import { phrase } from '@hanzo/i18n'
import { api } from './api'
import { answers } from './host'
import { scope } from './session'

export const GOOGLE_KEY = 'hanzo.onboarding.google.v2'
export const GOOGLE_ACCOUNTS_KEY = 'hanzo.onboarding.google.accounts'
export const GOOGLE_TOKENS_KEY = 'hanzo.onboarding.google.tokens'

export const DEFAULT_GOOGLE_CLIENT_ID = '113591532635-s8pvqrebprkbndluhftddmdap4htvu1p.apps.googleusercontent.com'

/**
 * What the Google connect asks for: who the person is, and the Workspace the
 * assistant works in for them — Drive, Docs, Sheets, Gmail and Calendar, read
 * and write — so it can study, ingest and create documents across their
 * business and act on the tasks they hand it. Full Drive and gmail.modify are
 * restricted scopes: Google verifies each in use and requires a security
 * assessment for them.
 */
export const GOOGLE_WORKSPACE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
].join(' ')

/** Google's own lifetime for a browser token, for one kept before `expiresAt` was. */
const LIFE = 3600_000

/** A token this close to its end is treated as ended: a send must not race it. */
const MARGIN = 60_000

/** The scopes that may send mail. */
const SENDS = ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.send', 'https://mail.google.com/']

interface Held {
  accessToken: string
  scope?: string
  connectedAt?: string
  expiresAt?: string
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = storage()?.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value))
  } catch {
    /* no storage: the token lives as long as the page */
  }
}

/** The connected addresses, as Setup lists them. */
export function accounts(): string[] {
  const list = read<unknown>(GOOGLE_ACCOUNTS_KEY, [])
  return Array.isArray(list) ? list.filter((a): a is string => typeof a === 'string') : []
}

/** Keep a token Google handed back for `email`, and list the address. */
export function keep(email: string, token: { accessToken: string; scope?: string; expiresIn?: number }): void {
  const clean = email.trim().toLowerCase()
  const now = Date.now()
  const held = read<Record<string, Held>>(GOOGLE_TOKENS_KEY, {})
  held[clean || 'default'] = {
    accessToken: token.accessToken,
    scope: token.scope || GOOGLE_WORKSPACE_SCOPES,
    connectedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + (token.expiresIn && token.expiresIn > 0 ? token.expiresIn * 1000 : LIFE)).toISOString(),
  }
  write(GOOGLE_TOKENS_KEY, held)
  const list = accounts()
  if (clean && !list.includes(clean)) write(GOOGLE_ACCOUNTS_KEY, [...list, clean])
  write(GOOGLE_KEY, true)
}

/** Forget `email`'s token and address. */
export function drop(email: string): void {
  const held = read<Record<string, Held>>(GOOGLE_TOKENS_KEY, {})
  delete held[email]
  write(GOOGLE_TOKENS_KEY, held)
  const list = accounts().filter((a) => a !== email)
  write(GOOGLE_ACCOUNTS_KEY, list)
  if (list.length === 0) write(GOOGLE_KEY, false)
}

const ends = (h: Held): number => {
  const at = Date.parse(h.expiresAt ?? '')
  if (Number.isFinite(at)) return at
  const from = Date.parse(h.connectedAt ?? '')
  return Number.isFinite(from) ? from + LIFE : 0
}

const sends = (h: Held): boolean => {
  const granted = (h.scope ?? '').split(/\s+/)
  return SENDS.some((s) => granted.includes(s))
}

/** The live token that may send for `email`, or the most recently connected one; null when there is none. */
export function gmail(email?: string): { token: string; email?: string; expires: number } | null {
  const held = read<Record<string, Held>>(GOOGLE_TOKENS_KEY, {})
  const now = Date.now()
  const live = Object.entries(held)
    .filter(([, h]) => h && typeof h.accessToken === 'string' && h.accessToken && sends(h) && ends(h) - MARGIN > now)
    .sort(([, a], [, b]) => (Date.parse(b.connectedAt ?? '') || 0) - (Date.parse(a.connectedAt ?? '') || 0))
  const want = email?.trim().toLowerCase()
  const hit = want ? live.find(([who]) => who === want) : live[0]
  if (!hit) return null
  const [who, h] = hit
  return { token: h.accessToken, email: who === 'default' ? undefined : who, expires: ends(h) }
}

/** Google's consent address for this origin. */
export function buildGoogleWorkspaceAuthorizeUrl(origin: string, clientId = DEFAULT_GOOGLE_CLIENT_ID, state = 'gws'): string {
  const cleanOrigin = origin.replace(/\/+$/, '')
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  u.searchParams.set('client_id', clientId || DEFAULT_GOOGLE_CLIENT_ID)
  u.searchParams.set('redirect_uri', `${cleanOrigin}/v1/iam/oauth/callback`)
  u.searchParams.set('response_type', 'token')
  u.searchParams.set('scope', GOOGLE_WORKSPACE_SCOPES)
  u.searchParams.set('include_granted_scopes', 'true')
  u.searchParams.set('prompt', 'select_account consent')
  u.searchParams.set('state', state)
  return u.toString()
}

/** The consent address: the platform's client when it names one, else this origin's own. */
async function authorizeUrl(): Promise<string> {
  let clientId = DEFAULT_GOOGLE_CLIENT_ID
  try {
    const res = await fetch(`${api()}/v1/integrations/google/connect`, {
      method: 'POST',
      headers: { ...scope(), 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (res.ok) {
      const j = (await res.json().catch(() => null)) as { authorizeUrl?: string } | null
      if (j?.authorizeUrl) {
        const parsed = new URL(j.authorizeUrl)
        const cid = parsed.searchParams.get('client_id')
        if (cid) clientId = cid
        if (!answers(window.location.hostname)) {
          parsed.searchParams.set('scope', GOOGLE_WORKSPACE_SCOPES)
          parsed.searchParams.set('access_type', 'offline')
          parsed.searchParams.set('include_granted_scopes', 'true')
          parsed.searchParams.set('prompt', 'select_account consent')
          return parsed.toString()
        }
      }
    }
  } catch {
    /* the origin's own consent below */
  }
  return buildGoogleWorkspaceAuthorizeUrl(window.location.origin, clientId, `gws_${Date.now().toString(36)}`)
}

/** Keep the token, name its account, and tell the platform it was connected. */
async function complete(accessToken: string, granted: string | null, expiresIn: number): Promise<string> {
  let email = ''
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } })
    if (r.ok) {
      const u = (await r.json()) as { email?: string }
      if (typeof u?.email === 'string') email = u.email.trim().toLowerCase()
    }
  } catch {
    /* an unnamed account is kept as `default` */
  }
  keep(email, { accessToken, scope: granted || GOOGLE_WORKSPACE_SCOPES, expiresIn })
  fetch(`${api()}/v1/integrations/google/connect`, {
    method: 'POST',
    headers: { ...scope(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: accessToken, accountId: email }),
  }).catch(() => null)
  return email
}

/**
 * Google's consent in a popup, the one Setup opens: resolves with the address
 * once the token is kept, and refuses if the window closes without one or
 * Google answers an error. A blocked popup opens the consent in a tab instead,
 * and the token arrives through the site's callback (`message` below).
 */
export async function connect(): Promise<string> {
  if (typeof window === 'undefined') throw new Error(phrase('Gmail can be connected only in a browser.'))
  const url = await authorizeUrl()
  const popup = window.open(url, 'hanzo-oauth-google', 'width=600,height=700')
  return new Promise<string>((resolve, reject) => {
    let done = false
    let timer: number | undefined
    const finish = (fn: () => void) => {
      if (done) return
      done = true
      if (timer !== undefined) window.clearInterval(timer)
      window.removeEventListener('message', onMessage)
      fn()
    }
    // The site's callback page posts the token it kept, whichever window it landed in.
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return
      const data = ev.data as { type?: string; email?: string } | null
      if (data?.type === 'hanzo-google-workspace-connected') finish(() => resolve((data.email ?? '').trim().toLowerCase()))
    }
    window.addEventListener('message', onMessage)
    if (!popup) {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    timer = window.setInterval(() => {
      if (popup.closed) {
        finish(() => (gmail() ? resolve(gmail()?.email ?? '') : reject(new Error(phrase('Gmail was not connected. Try again and allow access.')))))
        return
      }
      try {
        if (popup.location.origin !== window.location.origin) return
        const hash = popup.location.hash || ''
        if (!hash.includes('access_token=') && !hash.includes('error=')) return
        const params = new URLSearchParams(hash.replace(/^#/, ''))
        const token = params.get('access_token')
        popup.close()
        if (!token) {
          finish(() => reject(new Error(phrase('Google did not allow access. Try again and allow Gmail.'))))
          return
        }
        const life = Number(params.get('expires_in') ?? '')
        void complete(token, params.get('scope'), Number.isFinite(life) ? life : 0).then((email) => finish(() => resolve(email)))
      } catch {
        /* still on accounts.google.com: cross-origin until the callback */
      }
    }, 250)
  })
}

/** One message to send. `from` is the connected address; Gmail fills it in when absent. */
export interface Message {
  to: string
  subject: string
  text: string
  html: string
  from?: string
}

const CRLF = '\r\n'

function bytes64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

const utf8 = (s: string): string => bytes64(new TextEncoder().encode(s))

/** A header value: plain when it is ASCII, RFC 2047 encoded-word otherwise. */
const word = (s: string): string => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${utf8(s)}?=`)

/** A body part in base64, wrapped at 76 as RFC 2045 asks. */
const part = (type: string, body: string): string =>
  [`Content-Type: ${type}; charset="UTF-8"`, 'Content-Transfer-Encoding: base64', '', utf8(body).replace(/(.{76})/g, `$1${CRLF}`)].join(CRLF)

/** The RFC 2822 message, multipart/alternative with the text and the HTML, as Gmail's `raw` (base64url, no padding). */
export function raw(m: Message, boundary = `hanzo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`): string {
  for (const v of [m.to, m.subject, m.from ?? '']) {
    if (/[\r\n]/.test(v)) throw new Error(phrase('An address or subject cannot hold a line break.'))
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(m.to.trim())) throw new Error(phrase('That is not an email address.'))
  const head = [
    ...(m.from ? [`From: ${m.from}`] : []),
    `To: ${m.to.trim()}`,
    `Subject: ${word(m.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ]
  const message = [...head, '', `--${boundary}`, part('text/plain', m.text), `--${boundary}`, part('text/html', m.html), `--${boundary}--`, ''].join(CRLF)
  return utf8(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Send one message from the connected account. Every refusal is a sentence a person can act on. */
export async function send(token: string, m: Message): Promise<{ id: string }> {
  const body = JSON.stringify({ raw: raw(m) })
  let res: Response
  try {
    res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    })
  } catch {
    throw new Error(phrase('Gmail could not be reached. Check your connection and try again.'))
  }
  if (res.ok) {
    const j = (await res.json().catch(() => ({}))) as { id?: string }
    return { id: j.id ?? '' }
  }
  if (res.status === 401) throw new Error(phrase('Reconnect Gmail: the connection has expired.'))
  if (res.status === 403) throw new Error(phrase('Gmail did not allow sending from this account. Reconnect Gmail and allow it to send.'))
  if (res.status === 429) throw new Error(phrase('Gmail is limiting how fast this account sends. Try again in a few minutes.'))
  if (res.status === 400) throw new Error(phrase('Gmail refused this message. Check the address and try again.'))
  throw new Error(phrase('Gmail could not send the message. Try again in a moment.'))
}
