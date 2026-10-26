import { afterEach, describe, expect, test, vi } from 'vitest'
import { GOOGLE_TOKENS_KEY, gmail, keep, raw, send } from './gmail'

/** A localStorage that holds what it is given. */
const memory = (seed: Record<string, string> = {}) => {
  const m = new Map(Object.entries(seed))
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

const MODIFY = 'openid email https://www.googleapis.com/auth/gmail.modify'
const at = (ms: number) => new Date(ms).toISOString()

/** The raw message, decoded back to text. */
const decode = (r: string) => new TextDecoder().decode(Uint8Array.from(atob(r.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))
const part = (body: string, type: string) => {
  const m = body.split(`Content-Type: ${type}; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n`)[1]
  const b64 = m.split('\r\n--')[0].replace(/\r\n/g, '')
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))
}

afterEach(() => vi.unstubAllGlobals())

describe('gmail()', () => {
  test('none connected is null', () => {
    vi.stubGlobal('window', { localStorage: memory() })
    expect(gmail()).toBeNull()
  })

  test('an expired token, or one that may not send, is null', () => {
    const now = Date.now()
    vi.stubGlobal('window', {
      localStorage: memory({
        [GOOGLE_TOKENS_KEY]: JSON.stringify({
          'old@a.co': { accessToken: 'old', scope: MODIFY, connectedAt: at(now - 2 * 3600_000) },
          'soon@a.co': { accessToken: 'soon', scope: MODIFY, connectedAt: at(now - 60_000), expiresAt: at(now + 30_000) },
          'drive@a.co': { accessToken: 'drive', scope: 'openid https://www.googleapis.com/auth/drive', connectedAt: at(now) },
        }),
      }),
    })
    expect(gmail()).toBeNull()
  })

  test('two accounts: the chosen one, else the live one connected most recently', () => {
    const now = Date.now()
    vi.stubGlobal('window', {
      localStorage: memory({
        [GOOGLE_TOKENS_KEY]: JSON.stringify({
          'work@a.co': { accessToken: 'work', scope: MODIFY, connectedAt: at(now - 20 * 60_000) },
          'me@b.co': { accessToken: 'me', scope: MODIFY, connectedAt: at(now - 5 * 60_000), expiresAt: at(now + 55 * 60_000) },
        }),
      }),
    })
    expect(gmail()).toMatchObject({ token: 'me', email: 'me@b.co', expires: now + 55 * 60_000 })
    expect(gmail('Work@A.co')).toMatchObject({ token: 'work', email: 'work@a.co' })
    expect(gmail('nobody@c.co')).toBeNull()
  })

  test('keep() is what gmail() reads, with the lifetime Google gave', () => {
    const store = memory()
    vi.stubGlobal('window', { localStorage: store })
    keep('Ada@Example.com', { accessToken: 'fresh', scope: MODIFY, expiresIn: 3599 })
    const got = gmail()
    expect(got).toMatchObject({ token: 'fresh', email: 'ada@example.com' })
    expect(got!.expires).toBeGreaterThan(Date.now() + 3500_000)
    expect(JSON.parse(store.getItem('hanzo.onboarding.google.accounts')!)).toEqual(['ada@example.com'])
  })
})

describe('raw()', () => {
  test('headers, an encoded UTF-8 subject, and both parts', () => {
    const body = decode(raw({ to: 'friend@example.com', from: 'ada@example.com', subject: 'Join me on Hanzo — beta', text: 'Hi ✨ text', html: '<p>Hi ✨ html</p>' }, 'B'))
    expect(body).toContain('From: ada@example.com\r\n')
    expect(body).toContain('To: friend@example.com\r\n')
    expect(body).toContain('MIME-Version: 1.0\r\n')
    expect(body).toContain('Content-Type: multipart/alternative; boundary="B"\r\n')
    const subject = body.match(/^Subject: =\?UTF-8\?B\?(.+)\?=\r$/m)![1]
    expect(new TextDecoder().decode(Uint8Array.from(atob(subject), (c) => c.charCodeAt(0)))).toBe('Join me on Hanzo — beta')
    expect(part(body, 'text/plain')).toBe('Hi ✨ text')
    expect(part(body, 'text/html')).toBe('<p>Hi ✨ html</p>')
    expect(body.trimEnd().endsWith('--B--')).toBe(true)
  })

  test('an ASCII subject stays plain, and the raw is base64url with no padding', () => {
    const r = raw({ to: 'f@example.com', subject: 'Hello', text: 'a', html: 'b' }, 'B')
    expect(r).not.toMatch(/[+/=]/)
    expect(decode(r)).toContain('Subject: Hello\r\n')
    expect(decode(r)).not.toContain('From:')
  })

  test('a line break in a header, or a non-address, is refused', () => {
    expect(() => raw({ to: 'f@example.com\r\nBcc: x@y.co', subject: 's', text: 't', html: 'h' })).toThrow(/line break/)
    expect(() => raw({ to: 'f@example.com', subject: 's\nBcc: x@y.co', text: 't', html: 'h' })).toThrow(/line break/)
    expect(() => raw({ to: 'not an address', subject: 's', text: 't', html: 'h' })).toThrow(/not an email address/)
  })
})

describe('send()', () => {
  const m = { to: 'f@example.com', subject: 's', text: 't', html: 'h' }
  const answering = (status: number, json: unknown = {}) =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } })))

  test('posts the raw message with the token and answers the id', async () => {
    answering(200, { id: 'm1' })
    await expect(send('tok', m)).resolves.toEqual({ id: 'm1' })
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body as string).raw).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  test.each([
    [401, /Reconnect Gmail/],
    [403, /did not allow sending/],
    [429, /Gmail is limiting/],
    [400, /refused this message/],
    [500, /could not send/],
  ])('status %i is said in words', async (status, said) => {
    answering(status)
    await expect(send('tok', m)).rejects.toThrow(said)
  })

  test('no connection is said in words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(send('tok', m)).rejects.toThrow(/could not be reached/)
  })
})
