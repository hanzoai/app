import { describe, expect, test } from 'vitest'
import { body, catches, fingerprint, hear, lines, note, pathOf, scrub } from './fault'

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
