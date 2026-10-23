import { afterEach, describe, expect, test, vi } from 'vitest'
import { createInvitation, listInvitations } from './invite'

/** Every request answered with `body`. */
function wire(body: unknown) {
  vi.stubGlobal('fetch', async () =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('invitations: a code is shown once, at creation', () => {
  test('a listed invitation carries no code and is still listed', async () => {
    wire({
      invitations: [
        { owner: 'acme', name: 'inv-a', code: '', email: 'sam@acme.example', quota: 1, usedCount: 0, state: 'Active' },
        { owner: 'acme', name: 'inv-b', code: '', email: '', quota: 25, usedCount: 3, state: 'Active' },
        null,
      ],
      total: 2,
    })
    expect((await listInvitations('acme')).map((r) => r.name)).toEqual(['inv-a', 'inv-b'])
  })

  test('the answer to a create carries the code', async () => {
    wire({ owner: 'acme', name: 'inv-c', code: 'ABCDEFGHJKLMNPQRSTUV', quota: 1, usedCount: 0, state: 'Active' })
    expect((await createInvitation('acme', 'sam@acme.example')).code).toBe('ABCDEFGHJKLMNPQRSTUV')
  })
})
