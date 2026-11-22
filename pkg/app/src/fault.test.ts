import { describe, expect, test } from 'vitest'
import { body, catches, details, fingerprint, hear, lines, note, pathOf, screenOf, scrub } from './fault'
import { VERSION } from './version.gen'

describe('scrub', () => {
  test('takes tokens, keys, cookies and emails out', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk'
    const out = scrub(`Authorization: Bearer ${jwt} cookie=session=abc123def456 z@hanzo.ai api_key: sk-live-abcdef0123456789 ghp_abcdefghijklmnop1234`)
    for (const leak of [jwt, 'abc123def456', 'z@hanzo.ai', 'sk-live-abcdef0123456789', 'ghp_abcdefghijklmnop1234']) expect(out).not.toContain(leak)
  })
  test('leaves ordinary words alone', () => {
    expect(scrub('Cannot read properties of undefined (reading "map")')).toBe('Cannot read properties of undefined (reading "map")')
  })
  test('a query string never rides a path', () => {
    expect(pathOf('https://api.hanzo.ai/v1/chat?token=abc&x=1')).toBe('/v1/chat')
  })
})

describe('fingerprint', () => {
  const stack = (l: number) => `Error: x\n    at render (https://hanzo.app/_next/app.js:${l}:9)`
  test('is the same break with ids and positions moved', () => {
    expect(fingerprint('error', 'No chat 8812 found', stack(10))).toBe(fingerprint('error', 'No chat 9913 found', stack(99)))
  })
  test('differs by message and by kind', () => {
    expect(fingerprint('error', 'a', stack(1))).not.toBe(fingerprint('error', 'b', stack(1)))
    expect(fingerprint('error', 'a', stack(1))).not.toBe(fingerprint('http', 'a', stack(1)))
  })
})

describe('catches', () => {
  test('keeps the last 50 console lines, scrubbed, and tells the listener once per minute', () => {
    for (let i = 0; i < 80; i++) note('log', [`line ${i} z@hanzo.ai`])
    expect(lines()).toHaveLength(50)
    expect(lines().join('\n')).not.toContain('z@hanzo.ai')
    const heard: string[] = []
    hear((c) => heard.push(c.fingerprint))
    const first = catches('error', new Error('boom 1'), '/chat')
    expect(first?.lines).toHaveLength(50)
    expect(catches('error', new Error('boom 2'), '/chat')).toBeNull()
    expect(heard).toHaveLength(1)
  })
  test('the issue body carries the marker the next report finds it by', () => {
    const c = catches('error', new Error('unique failure'), '/x')!
    const text = body({ caught: c, title: 't', description: 'it broke', shot: null }, 'https://api.hanzo.ai/s.png')
    expect(text).toContain(`<!-- fp:${c.fingerprint} -->`)
    expect(text).toContain('![screenshot](https://api.hanzo.ai/s.png)')
  })
})

describe('the crash screen', () => {
  test('names the screen by its path', () => {
    expect(screenOf('/tabs')).toBe('Tabs')
    expect(screenOf('/chat/abc')).toBe('Chat')
    expect(screenOf('/dev/-/artifacts')).toBe('Dev')
    expect(screenOf('/')).toBe('')
  })
  test('Copy details carries the error, the path without its query, and the version, with secrets out', () => {
    const out = details('Failed for z@hanzo.ai', 'https://hanzo.app/tabs?token=abc')
    expect(out).toBe(`Error: ${scrub('Failed for z@hanzo.ai')}\nScreen: /tabs\nVersion: ${VERSION}`)
    expect(out).not.toContain('z@hanzo.ai')
    expect(out).not.toContain('token')
  })
})

describe('send resilience', () => {
  test('decodes base64 screenshots in memory, survives S3 failure, and auto-seats on 403', async () => {
    const { configure } = await import('./where')
    const { send } = await import('./fault')
    const origFetch = globalThis.fetch
    const hadWindow = 'window' in globalThis
    const origWindow = (globalThis as { window?: unknown }).window
    if (!hadWindow) (globalThis as { window?: unknown }).window = { location: { href: 'tauri://localhost/design', hostname: 'localhost', protocol: 'tauri:', origin: 'tauri://localhost' } }
    const calls: string[] = []
    let seated = false
    configure({
      api: 'https://api.example.test',
      session: {
        length: 0,
        key: () => null,
        clear: () => {},
        getItem: (k: string) => (k.includes('access_token') ? 'tok_test' : null),
        setItem: () => {},
        removeItem: () => {},
      },
    })
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = (init?.method ?? 'GET').toUpperCase()
      calls.push(`${method} ${url}`)
      if (url.startsWith('data:')) throw new Error('CSP must never fetch data: URLs')
      if (url.endsWith('/v1/git/workspace')) {
        seated = true
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      if (url.includes('/v1/task/projects/app/issues') && method === 'GET') {
        if (!seated) return new Response('unseated', { status: 403 })
        return new Response(JSON.stringify([]), { status: 200 })
      }
      if (url.includes('/v1/s3/buckets')) {
        return new Response('s3 unavailable', { status: 503 })
      }
      if (url.includes('/v1/task/projects/app/issues') && method === 'POST') {
        return new Response(JSON.stringify({ number: 42, identifier: 'APP#42', title: 't' }), { status: 201 })
      }
      return new Response('not found', { status: 404 })
    }) as typeof fetch
    try {
      const c = catches('http', 'POST /v1/chat/completions answered 503', '/design')!
      const res = await send({
        caught: c,
        title: 'POST /v1/chat/completions answered 503',
        description: 'failed during design',
        shot: 'data:image/png;base64,iVBORw0KGgo=',
      })
      expect(res).toEqual({ identifier: 'APP#42', again: false })
      expect(calls).toContain('GET https://api.example.test/v1/git/workspace')
      expect(calls.some((x) => x.startsWith('POST https://api.example.test/v1/task/projects/app/issues'))).toBe(true)
    } finally {
      globalThis.fetch = origFetch
      if (!hadWindow) delete (globalThis as { window?: unknown }).window
      else (globalThis as { window?: unknown }).window = origWindow
    }
  })
})
