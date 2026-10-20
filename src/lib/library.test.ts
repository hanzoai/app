import { describe, expect, test } from 'vitest'
import { base64, keyOf, made, MAX, read, save, type Api } from './library'
import { schedule, title, when } from './auto'

/** A client that records each request and answers with `reply`. */
function fake(reply: unknown): { api: Api; sent: { method?: string; path: string; body?: unknown }[] } {
  const sent: { method?: string; path: string; body?: unknown }[] = []
  const api = {
    http: {
      json: async <T>(opts: { method?: string; path: string; body?: unknown }): Promise<T> => {
        sent.push(opts)
        return reply as T
      },
    },
  } as unknown as Api
  return { api, sent }
}

const ITEM = { id: 'lib_1', kind: 'image', source: 'chat', name: 'Picture 1.svg', mime: 'image/svg+xml', bytes: 12, url: 'https://s3/a', download: 'https://s3/d', preview: 'https://s3/p', origin: '/chat/t1', mine: true, shared: false }

describe('the dedupe key', () => {
  test('names the conversation, the message and the place in it', () => {
    expect(keyOf('t1', 'm9', 0)).toBe('t1/m9/0')
    expect(keyOf('t1', 'm9', 2)).not.toBe(keyOf('t1', 'm9', 0))
    expect(keyOf('t1', 'm9', 0)).not.toBe(keyOf('t2', 'm9', 0))
  })
})

describe('what an answer made', () => {
  const block = (name: string, mime: string, body = 'x') => ({ name, mime, body })
  test('keeps pages, pictures and named files, and leaves snippets in the answer', () => {
    const got = made([
      block('html block', 'text/html'),
      block('ts block', 'text/plain'),
      block('poster.svg', 'image/svg+xml'),
      block('svg block', 'image/svg+xml'),
      block('report.md', 'text/markdown'),
    ])
    expect(got.map((a) => a.name)).toEqual(['Page 1.html', 'poster.svg', 'Picture 3.svg', 'report.md'])
  })
  test('the same answer names its makings the same way every time, so its keys hold', () => {
    const list = [block('html block', 'text/html'), block('svg block', 'image/svg+xml')]
    expect(made(list)).toEqual(made(list))
  })
})

describe('save', () => {
  test('posts the bytes as base64 under the conversation, made in Chat, with its key', async () => {
    const { api, sent } = fake(ITEM)
    const item = await save(api, { name: 'a.svg', mime: 'image/svg+xml', data: new Blob(['<svg/>']), ref: 't1', origin: '/chat/t1', key: 't1/m1/0', preview: 'UE5H', width: 100.4, height: 50 })
    expect(item.id).toBe('lib_1')
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ method: 'POST', path: '/v1/library' })
    expect(sent[0]!.body).toEqual({ name: 'a.svg', mime: 'image/svg+xml', data: btoa('<svg/>'), source: 'chat', ref: 't1', origin: '/chat/t1', key: 't1/m1/0', preview: 'UE5H', width: 100, height: 50 })
  })
  test('refuses, without a request, bytes over what the Library takes', async () => {
    const { api, sent } = fake(ITEM)
    const big = 'A'.repeat(Math.ceil((MAX * 4) / 3) + 8)
    await expect(save(api, { name: 'big.bin', mime: 'application/octet-stream', data: big, ref: 't', origin: '/chat/t', key: 'k' })).rejects.toThrow(/10 MB/)
    expect(sent).toHaveLength(0)
  })
  test('an answer that is not an item is an error, not an empty item', async () => {
    const { api } = fake({ error: 'nope' })
    await expect(save(api, { name: 'a', mime: 'text/plain', data: 'YQ==', ref: 't', origin: '/chat/t', key: 'k' })).rejects.toThrow()
  })
})

describe('read', () => {
  test('takes an item and refuses a row with no id', () => {
    expect(read(ITEM)?.preview).toBe('https://s3/p')
    expect(read({ name: 'x' })).toBeNull()
    expect(read(null)).toBeNull()
  })
})

describe('base64', () => {
  test('is the bytes, in chunks past the call stack', async () => {
    const bytes = new Uint8Array(200_000).map((_, i) => i % 251)
    const got = await base64(new Blob([bytes]))
    // One string comparison: an element-wise toEqual over 200 KB outran a slow runner's 5 s.
    expect(got).toBe(Buffer.from(bytes).toString('base64'))
  })
})

describe('Schedule this', () => {
  test('reads a schedule and refuses one with no kind', () => {
    expect(when({ schedule: { kind: 'cron', cron: '*/5 * * * *', tz: 'UTC' }, says: 'Every 5 minutes', next: '2026-10-17T10:05:00Z' })).toEqual({
      schedule: { kind: 'cron', cron: '*/5 * * * *', tz: 'UTC' },
      says: 'Every 5 minutes',
      next: '2026-10-17T10:05:00Z',
    })
    expect(when({ schedule: {} })).toBeNull()
  })
  test('a task is named by its prompt’s first line', () => {
    expect(title('Summarize my inbox\nand rank it')).toBe('Summarize my inbox')
    expect(title('   ')).toBe('Scheduled prompt')
    expect(title('x'.repeat(200))).toHaveLength(80)
  })
  test('creates an automation made in Chat that asks first and says how it went', async () => {
    const { api, sent } = fake({ id: 'flow_1' })
    expect(await schedule(api, ' Summarize the news ', { kind: 'cron', cron: '*/5 * * * *', tz: 'UTC' }, 'zen5')).toBe('flow_1')
    expect(sent[0]).toMatchObject({ method: 'POST', path: '/v1/auto/automations' })
    expect(sent[0]!.body).toEqual({
      name: 'Summarize the news',
      instructions: 'Summarize the news',
      schedule: { kind: 'cron', cron: '*/5 * * * *', tz: 'UTC' },
      source: 'chat',
      permissions: 'ask',
      notify: true,
      model: 'zen5',
    })
  })
})
