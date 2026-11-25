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
  test('ignores benign ResizeObserver loops, AbortError cancellations, and extension-intercepted fetch rejections', () => {
    expect(catches('error', 'ResizeObserver loop completed with undelivered notifications.', '/')).toBeNull()
    expect(catches('rejection', new DOMException('signal is aborted without reason', 'AbortError'), '/design')).toBeNull()
    expect(catches('rejection', new Error('signal is aborted without reason'), '/design')).toBeNull()
    const extErr = new TypeError('Failed to fetch')
    extErr.stack = 'TypeError: Failed to fetch\n    at o (chrome-extension://abcdef/content.js:2:17856)\n    at window.fetch (https://hanzo.app/assets/main.js:14:4052)'
    expect(catches('rejection', extErr, '/design')).toBeNull()
    // Real application errors are still captured.
    const realErr = new TypeError("Cannot read properties of null (reading 'navigate')")
    expect(catches('rejection', realErr, '/chat/1')).not.toBeNull()
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

describe('send to central collector', () => {
  const mkStorage = () => {
    const map = new Map<string, string>()
    return {
      get length() { return map.size },
      key: (i: number) => [...map.keys()][i] ?? null,
      clear: () => map.clear(),
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    }
  }

  test('routes signed-in reports to /v1/event (never private Tasks board) and survives S3 failure', async () => {
    const { configure } = await import('./where')
    const { send } = await import('./fault')
    const origFetch = globalThis.fetch
    const hadWindow = 'window' in globalThis
    const origWindow = (globalThis as { window?: unknown }).window
    const ss = mkStorage()
    const ls = mkStorage()
    ;(globalThis as { window?: unknown }).window = {
      location: { href: 'https://hanzo.app/design', hostname: 'hanzo.app', protocol: 'https:', origin: 'https://hanzo.app' },
      sessionStorage: ss,
      localStorage: ls,
    }
    const calls: Array<{ method: string; url: string; headers: Record<string, string>; body: string }> = []
    configure({
      api: 'https://api.example.test',
      key: 'pk-test-publishable-key',
      session: {
        length: 1,
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
      calls.push({ method, url, headers: (init?.headers ?? {}) as Record<string, string>, body: String(init?.body ?? '') })
      if (url.startsWith('data:')) throw new Error('CSP must never fetch data: URLs')
      if (url.includes('/v1/s3/buckets')) return new Response('s3 unavailable', { status: 503 })
      if (url.includes('/v1/event') && method === 'POST') return new Response(JSON.stringify({ accepted: 1, dropped: 0 }), { status: 200 })
      return new Response('unexpected', { status: 404 })
    }) as typeof fetch
    try {
      const c = catches('http', 'POST /v1/chat/completions answered 503', '/design')!
      const res = await send({
        caught: c,
        title: 'POST /v1/chat/completions answered 503',
        description: 'failed during design',
        shot: 'data:image/png;base64,iVBORw0KGgo=',
      })
      expect(res.identifier).toMatch(/^FB-[0-9A-F]{8}$/)
      expect(res.again).toBe(false)
      expect(calls.some((x) => x.url.includes('/v1/task/'))).toBe(false)
      const fbCall = calls.find((x) => x.url === 'https://api.example.test/v1/event' && x.body.includes('"user_feedback"'))
      expect(fbCall).toBeTruthy()
      expect(fbCall!.headers.Authorization).toBe('Bearer tok_test')
      const payload = JSON.parse(fbCall!.body)
      expect(payload.batch[0]).toMatchObject({
        type: 'error',
        event: 'user_feedback',
        product: 'app',
        site: 'hanzo.app',
        path: '/design',
        error: { type: 'UserFeedback', message: 'POST /v1/chat/completions answered 503', handled: true },
      })
      expect(payload.batch[0].properties.description).toBe('failed during design')
      expect(payload.batch[0].properties.signed_in).toBe(true)
    } finally {
      globalThis.fetch = origFetch
      if (!hadWindow) delete (globalThis as { window?: unknown }).window
      else (globalThis as { window?: unknown }).window = origWindow
    }
  })

  test('routes unsigned user reports to /v1/event?ingest_key=pk-... and returns confirmation', async () => {
    const { configure } = await import('./where')
    const { send } = await import('./fault')
    const origFetch = globalThis.fetch
    const hadWindow = 'window' in globalThis
    const origWindow = (globalThis as { window?: unknown }).window
    const ss = mkStorage()
    const ls = mkStorage()
    ;(globalThis as { window?: unknown }).window = {
      location: { href: 'https://hanzo.app/chat', hostname: 'hanzo.app', protocol: 'https:', origin: 'https://hanzo.app' },
      sessionStorage: ss,
      localStorage: ls,
    }
    const calls: Array<{ method: string; url: string; body: string }> = []
    configure({
      api: 'https://api.example.test',
      key: 'pk-anon-test-key',
      session: {
        length: 0,
        key: () => null,
        clear: () => {},
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    })
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = (init?.method ?? 'GET').toUpperCase()
      calls.push({ method, url, body: String(init?.body ?? '') })
      if (url.includes('/v1/event?ingest_key=pk-anon-test-key') && method === 'POST') {
        return new Response(JSON.stringify({ accepted: 1, dropped: 0 }), { status: 200 })
      }
      return new Response('unexpected', { status: 500 })
    }) as typeof fetch
    try {
      const c = catches('error', new Error('unsigned modal test failure'), '/chat')!
      const res = await send({
        caught: c,
        title: 'Chat broke while signed out',
        description: 'clicked send and nothing happened',
        shot: null,
      })
      expect(res.identifier).toMatch(/^FB-[0-9A-F]{8}$/)
      expect(res.again).toBe(false)
      // Second identical send with no new note deduplicates cleanly
      const second = await send({
        caught: c,
        title: 'Chat broke while signed out',
        description: '',
        shot: null,
      })
      expect(second).toEqual({ identifier: res.identifier, again: true })
      const feedbackPosts = calls.filter((x) => x.body.includes('"user_feedback"'))
      expect(feedbackPosts).toHaveLength(1)
      expect(feedbackPosts[0]!.url).toBe('https://api.example.test/v1/event?ingest_key=pk-anon-test-key')
      // Uncaught error was also reported automatically
      const uncaughtPosts = calls.filter((x) => x.body.includes('"handled":false'))
      expect(uncaughtPosts).toHaveLength(1)
    } finally {
      globalThis.fetch = origFetch
      if (!hadWindow) delete (globalThis as { window?: unknown }).window
      else (globalThis as { window?: unknown }).window = origWindow
    }
  })

  test('ignores errors from /v1/event ingest endpoints and opens circuit on non-2xx storms', async () => {
    const { isEventIngestUrl, catches: freshCatches } = await import('./fault')
    expect(isEventIngestUrl('https://api.hanzo.ai/v1/event?ingest_key=pk-abc')).toBe(true)
    expect(isEventIngestUrl('https://api.hanzo.ai/v1/event/replay?ingest_key=pk-abc')).toBe(true)
    expect(isEventIngestUrl('https://hanzo.app/events?ingestkey=pk-abc')).toBe(true)
    expect(isEventIngestUrl('https://api.hanzo.ai/v1/chat/completions')).toBe(false)

    // Errors referencing the ingest endpoint must never be captured or re-emitted.
    expect(freshCatches('error', new Error('POST https://api.hanzo.ai/v1/event?ingest_key=pk-abc failed'))).toBeNull()
    expect(freshCatches('http', 'POST /v1/event/replay answered 500')).toBeNull()
    expect(freshCatches('rejection', 'Failed to fetch /events?ingestkey=pk-abc')).toBeNull()

    const { configure } = await import('./where')
    const origFetch = globalThis.fetch
    const hadWindow = 'window' in globalThis
    const origWindow = (globalThis as { window?: unknown }).window
    ;(globalThis as { window?: unknown }).window = {
      location: { href: 'https://hanzo.app/auth/callback', hostname: 'hanzo.app', protocol: 'https:', origin: 'https://hanzo.app' },
      sessionStorage: mkStorage(),
      localStorage: mkStorage(),
    }
    let ingestPosts = 0
    configure({
      api: 'https://api.example.test',
      key: 'pk-storm-test',
      session: {
        length: 0,
        key: () => null,
        clear: () => {},
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    })
    globalThis.fetch = (async () => {
      ingestPosts++
      return new Response('rate limited', { status: 429, headers: { 'retry-after': '60' } })
    }) as typeof fetch
    try {
      for (let i = 0; i < 30; i++) {
        freshCatches('error', new Error(`Distinct callback failure ${'q'.repeat(i + 1)}`), '/auth/callback')
        await new Promise((r) => setTimeout(r, 0))
      }
      // First 429 opens the circuit immediately — never hundreds of requests.
      expect(ingestPosts).toBe(1)
    } finally {
      globalThis.fetch = origFetch
      if (!hadWindow) delete (globalThis as { window?: unknown }).window
      else (globalThis as { window?: unknown }).window = origWindow
    }
  })
})
