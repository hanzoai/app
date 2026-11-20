import { afterEach, describe, expect, it, vi } from 'vitest'
import { board, claim, edit, home, open, projects, targetOf } from './todo'

describe('targetOf', () => {
  it('goes to the card\'s own board first', () => {
    expect(targetOf('cloud', 'dev', ['hanzo'])).toBe('cloud')
  })
  it('on All boards goes to the first real board, never to "all"', () => {
    expect(targetOf('', 'all', ['hanzo', 'cloud'])).toBe('hanzo')
    expect(targetOf(undefined, 'all', [])).toBe('')
  })
  it('uses the board on screen when there is one', () => {
    expect(targetOf('', 'dev', ['hanzo'])).toBe('dev')
  })
})

describe('open', () => {
  afterEach(() => vi.unstubAllGlobals())
  const store = () => {
    const kept = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) } })
  }
  it('says a card is only on this device when the server did not take it', async () => {
    store()
    const client = { http: { json: async () => { throw new Error('down') } } }
    expect((await open(client as never, 'hanzo', { title: 'x' })).local).toBe(true)
  })
  it('does not say so for a card the server created and posts to /v1/task/projects/:key/issues', async () => {
    store()
    const seen: { method?: string; path: string }[] = []
    const client = {
      http: {
        json: async (req: { method?: string; path: string }) => {
          seen.push({ method: req.method, path: req.path })
          return { id: 'srv-1', title: 'x' }
        },
      },
    }
    expect((await open(client as never, 'cssprod-sroute', { title: 'x' })).local).toBeUndefined()
    expect(seen).toEqual([{ method: 'POST', path: '/v1/task/projects/cssprod-sroute/issues' }])
  })
})

describe('task API routes', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('uses /v1/task rather than retired /v1/todo for board, edit, and claim', async () => {
    const kept = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) } })
    const paths: string[] = []
    const client = {
      http: {
        json: async ({ path }: { path: string }) => {
          paths.push(path)
          return path.endsWith('/board') ? [] : { id: 'srv-1', title: 'x' }
        },
      },
    } as never
    await board(client)
    await edit(client, 'acme', 7, { title: 'updated' })
    await claim(client, 'acme', 7)
    expect(paths).toEqual([
      '/v1/task/board',
      '/v1/task/projects/acme/issues/7',
      '/v1/task/projects/acme/issues/7/claim',
    ])
  })
})

describe('home', () => {
  const asked = (task: unknown, dev: unknown) => ({
    http: { json: async ({ path }: { path: string }) => { if (path === '/v1/task/projects') return task; return dev } },
  }) as never
  it('prefers real server boards over demo stand-ins and deduplicates mirror keys', async () => {
    expect(await home(asked({ projects: [{ key: 'acme' }] }, []))).toBe('acme')
    expect((await projects(asked({ projects: [{ key: 'acme' }] }, []))).map((p) => p.key)).toEqual(['acme'])
    expect((await projects(asked({ projects: [] }, [])))[0]!.key).toBe('hanzo')
    expect(
      (
        await projects(
          asked(
            { projects: [{ key: 'cssprod_sroute', name: 'cssprod_sroute' }] },
            [{ id: 'p1', slug: 'cssprod-sroute', name: 'Sroute', repo: { url: 'https://git.hanzo.ai/mvee85560/cssprod_sroute' } }],
          ),
        )
      ).map((p) => p.key),
    ).toEqual(['cssprod_sroute'])
    expect(
      (
        await projects(
          asked(
            { projects: [] },
            [{ id: 'p1', slug: 'cssprod-sroute', name: 'Sroute', repo: { url: 'https://git.hanzo.ai/mvee85560/cssprod_sroute' } }],
          ),
        )
      ).map((p) => p.key),
    ).toEqual(['cssprod_sroute'])
  })
  it('is null when the server names none or cannot be asked', async () => {
    expect(await home(asked({ projects: [] }, []))).toBeNull()
    expect(await home({ http: { json: async () => { throw new Error('down') } } } as never)).toBeNull()
  })
})

describe('forge workspace seating', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('seats the caller via POST /v1/git/workspace once on 403 unseated and retries', async () => {
    const kept = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) } })
    let seated = false
    const seen: string[] = []
    const client = {
      http: {
        json: async ({ method = 'GET', path }: { method?: string; path: string }) => {
          seen.push(`${method} ${path}`)
          if (method === 'POST' && path === '/v1/git/workspace') {
            seated = true
            return { owner: 'mvee85560', made: true }
          }
          if (path.startsWith('/v1/task/') && !seated) {
            throw Object.assign(new Error('HTTP 403'), {
              status: 403,
              body: { detail: 'no forge identity for this principal yet; open Codebase, Projects or Issues in Hanzo Dev to set it up' },
            })
          }
          if (path === '/v1/task/board') return [{ id: '1', identifier: 'CSSPROD_SROUTE#1', projectKey: 'cssprod_sroute', number: 1, kind: 'issue', source: 'git', title: 'Live card', status: 'todo', priority: 'none', labels: [], createdAt: 1, updatedAt: 1 }]
          if (path === '/v1/task/projects') return [{ key: 'cssprod_sroute', name: 'cssprod_sroute' }]
          if (method === 'POST' && path === '/v1/task/projects/cssprod_sroute/issues') return { id: '2', identifier: 'CSSPROD_SROUTE#2', projectKey: 'cssprod_sroute', number: 2, kind: 'issue', source: 'git', title: 'Created after seat', status: 'todo', priority: 'none', labels: [], createdAt: 2, updatedAt: 2 }
          return []
        },
      },
    } as never

    const [cards, ps] = await Promise.all([board(client), projects(client)])
    expect(cards.map((c) => c.title)).toEqual(['Live card'])
    expect(ps.map((p) => p.key)).toEqual(['cssprod_sroute'])
    expect(seen.filter((s) => s === 'POST /v1/git/workspace')).toHaveLength(1)

    const created = await open(client, 'cssprod_sroute', { title: 'Created after seat' })
    expect(created.local).toBeUndefined()
    expect(created.id).toBe('2')
  })
})
