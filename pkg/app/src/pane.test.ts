import { describe, expect, test } from 'vitest'
import { draftOf, drop, hold, paneOf, retry, retryable, setDraft, type Via } from './pane'

/** A store that answers the bucket list and refuses every upload grant. */
const refusing = (calls: string[]): Via => ({
  org: 'acme',
  api: {
    http: {
      json: async (req: { method?: string; path: string }) => {
        calls.push(`${req.method ?? 'GET'} ${req.path}`)
        if (!req.method && req.path === '/v1/s3/buckets') return { buckets: [{ name: 'acme' }] }
        throw new Error('Failed to fetch')
      },
    },
  } as never,
})

describe('a failed upload', () => {
  test('goes up again from the bytes the reader picked, in place on its chip', async () => {
    const key = 'thread:retry'
    const calls: string[] = []
    const via = refusing(calls)
    const grants = () => calls.filter((c) => c.startsWith('POST') && c.endsWith('/objects')).length

    await hold(key, [new File(['hello'], 'note.txt')], via)
    const [first] = paneOf(key).held
    expect(first).toMatchObject({ name: 'note.txt', state: 'failed', error: 'Failed to fetch' })
    expect(retryable(first.id)).toBe(true)
    expect(grants()).toBe(1)

    const again = retry(key, first.id, via)
    expect(paneOf(key).held[0]).toMatchObject({ id: first.id, state: 'uploading', sent: 0, error: undefined })
    await again
    expect(grants()).toBe(2)
    expect(paneOf(key).held).toHaveLength(1)
    expect(paneOf(key).held[0]).toMatchObject({ id: first.id, state: 'failed' })

    drop(key, first.id)
    expect(retryable(first.id)).toBe(false)
  })

  test('is not retried when it is not failed, or when its bytes are gone', async () => {
    const key = 'thread:norty'
    const calls: string[] = []
    const via = refusing(calls)
    await retry(key, 'h-missing', via)
    expect(calls).toEqual([])
  })
})

describe("a conversation's draft", () => {
  test('is kept per conversation, so going to another tool and back finds it', () => {
    setDraft('new', 'a question not yet sent')
    setDraft('thread:a', 'another')
    expect(draftOf('new')).toBe('a question not yet sent')
    expect(draftOf('thread:a')).toBe('another')
    expect(draftOf('thread:b')).toBe('')
  })

  test('forgets an empty draft, as sending does', () => {
    setDraft('new', 'sent soon')
    setDraft('new', '')
    expect(draftOf('new')).toBe('')
  })
})
