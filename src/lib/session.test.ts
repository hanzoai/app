import { afterEach, describe, expect, test, vi } from 'vitest'
import { configure } from '../where'
import { bearer, home, live, me, org, orgs, renew, scope, superAdmin } from './session'

/** A Storage held in a map. */
function memory(seed: Record<string, string> = {}): Storage {
  const held = new Map(Object.entries(seed))
  return {
    get length() {
      return held.size
    },
    key: (i: number) => [...held.keys()][i] ?? null,
    getItem: (k: string) => held.get(k) ?? null,
    setItem: (k: string, v: string) => void held.set(k, String(v)),
    removeItem: (k: string) => void held.delete(k),
    clear: () => held.clear(),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  configure({ session: undefined })
})

describe('the session is read where the host keeps it', () => {
  test('a page keeps it in localStorage', () => {
    vi.stubGlobal('window', { localStorage: memory({ hanzo_iam_access_token: 'page', hanzo_iam_expires_at: String(Date.now() + 60_000) }) })
    expect(bearer()).toBe('page')
    expect(live()).toBe(true)
  })

  test('a host with a store of its own (the desktop keychain) is read there, and never from localStorage', () => {
    const keychain = memory({ hanzo_iam_access_token: 'keychain', hanzo_iam_expires_at: String(Date.now() + 60_000) })
    vi.stubGlobal('window', { localStorage: memory({ hanzo_iam_access_token: 'stale' }) })
    configure({ session: keychain })
    expect(bearer()).toBe('keychain')
    expect(live()).toBe(true)
    renew()
    expect(keychain.getItem('hanzo_iam_expires_at')).toBe('0')
    expect(live()).toBe(false)
  })
})

describe('a directory is a home, and nobody works in it', () => {
  const token = (orgs: { org: string; role?: string }[]) => `h.${btoa(JSON.stringify({ name: 'ada', orgs })).replace(/=+$/, '')}.s`
  const signed = (orgs: { org: string; role?: string }[]) =>
    vi.stubGlobal('window', { localStorage: memory({ hanzo_iam_access_token: token(orgs), hanzo_iam_expires_at: String(Date.now() + 60_000) }) })

  test('the orgs worked in leave out the directory; the account is still keyed by it', () => {
    signed([{ org: 'hanzo-id', role: 'member' }, { org: 'ada', role: 'owner' }, { org: 'acme', role: 'admin' }])
    expect(orgs()).toEqual(['ada', 'acme'])
    expect(home()).toBe('hanzo-id')
    expect(me()).toBe('hanzo-id/ada')
    expect(superAdmin()).toBe(false)
  })

  test('a person with a directory and one org of their own works in it from the first read', () => {
    signed([{ org: 'lux-id', role: 'member' }, { org: 'ada', role: 'owner' }])
    expect(orgs()).toEqual(['ada'])
    expect(org()).toBe('ada')
    expect(scope()['X-Org-Id']).toBe('ada')
  })

  test('a SuperAdmin is one whose own row is in admin, and admin is still an org to work in', () => {
    signed([{ org: 'admin', role: 'owner' }, { org: 'hanzo', role: 'admin' }])
    expect(superAdmin()).toBe(true)
    expect(orgs()).toEqual(['admin', 'hanzo'])
  })
})

describe('a platform org opens to the people who run it (authz Claims.opens)', () => {
  const token = (claims: Record<string, unknown>) => `h.${btoa(JSON.stringify({ name: 'ada', ...claims })).replace(/=+$/, '')}.s`
  const signed = (claims: Record<string, unknown>) =>
    vi.stubGlobal('window', { localStorage: memory({ hanzo_iam_access_token: token(claims), hanzo_iam_expires_at: String(Date.now() + 60_000) }) })

  test('a plain member of a brand org is offered none of it, and is scoped to nothing there', () => {
    signed({ orgs: [{ org: 'hanzo', role: 'member' }, { org: 'acme', role: 'owner' }] })
    expect(orgs()).toEqual(['acme'])
    expect(org()).toBe('acme')
    signed({ orgs: [{ org: 'hanzo', role: 'member' }] })
    expect(orgs()).toEqual([])
    expect(org()).toBeNull()
    expect(scope()['X-Org-Id']).toBeUndefined()
  })

  test('its owners and admins work in it', () => {
    signed({ orgs: [{ org: 'hanzo', role: 'Admin' }, { org: 'lux', role: 'owner' }, { org: 'zoo', role: 'member' }] })
    expect(orgs()).toEqual(['hanzo', 'lux'])
  })

  test('admin is a SuperAdmin\'s alone; a membership of it opens nothing', () => {
    signed({ orgs: [{ org: 'hanzo', role: 'owner' }, { org: 'admin', role: 'admin' }] })
    expect(orgs()).toEqual(['hanzo'])
    signed({ orgs: [{ org: 'admin', role: 'admin' }, { org: 'zoo', role: 'member' }] })
    expect(orgs()).toEqual(['admin', 'zoo'])
  })
})

describe('SuperAdmin is hanzoai/authz Claims.Sudo, read one way', () => {
  const as = (claims: Record<string, unknown>) =>
    vi.stubGlobal('window', {
      localStorage: memory({
        hanzo_iam_access_token: `h.${btoa(JSON.stringify({ name: 'ada', ...claims })).replace(/=+$/, '')}.s`,
        hanzo_iam_expires_at: String(Date.now() + 60_000),
      }),
    })

  test('an admin membership held from a brand org is not it', () => {
    as({ orgs: [{ org: 'hanzo', role: 'owner' }, { org: 'admin', role: 'admin' }] })
    expect(superAdmin()).toBe(false)
  })

  test('an org admin is not it', () => {
    as({ isAdmin: true, owner: 'acme', orgs: [{ org: 'acme', role: 'admin' }] })
    expect(superAdmin()).toBe(false)
  })

  test('an org named like admin in another case is not it', () => {
    for (const org of ['Admin', 'ADMIN']) {
      as({ orgs: [{ org, role: 'owner' }] })
      expect(superAdmin()).toBe(false)
    }
  })

  test('a program is never it', () => {
    as({ type: 'application', owner: 'admin', orgs: [{ org: 'admin', role: 'owner' }] })
    expect(superAdmin()).toBe(false)
    as({ owner: 'admin' })
    expect(superAdmin()).toBe(false)
  })

  test('an empty home is not shifted onto a later admin entry', () => {
    as({ orgs: [{ org: '' }, { org: 'admin', role: 'admin' }] })
    expect(superAdmin()).toBe(false)
  })
})
