import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Host } from '@hanzo/dev/builder'

// The host is read off one render; everything it asks of IAM, the router and
// the look is answered here, and a move inside the app or through the router is
// recorded rather than made. The builder does not load outside a bundler, so its
// address grammar is the two kinds this reads: a screen and a Settings section.
const { moved, routed } = vi.hoisted(() => ({ moved: [] as string[], routed: [] as string[] }))

const { MARKS } = vi.hoisted(() => {
  const mark = () => () => null
  const one = { icon: mark(), make: mark() }
  return { MARKS: { chat: one, dev: one, design: one, studio: one, tabs: one, library: one, scheduled: one, customize: one } }
})
vi.mock('@hanzo/dev/builder', () => {
  type Route = { kind: string; screen?: string; section?: string }
  const path = (r: Route) => (r.kind === 'settings' ? `-/settings/${r.section}` : r.kind === 'screen' ? `-/${r.screen}` : '')
  const route = (p: string): Route =>
    p.startsWith('-/settings/') ? { kind: 'settings', section: p.slice(11) } : p.startsWith('-/') ? { kind: 'screen', screen: p.slice(2) } : { kind: 'new' }
  return { MARKS, administers: () => true, path, route }
})
vi.mock('@hanzo/iam/react', () => ({ useIam: () => ({ user: { name: 'Ada', email: 'ada@acme.dev' }, accessToken: 't' }) }))
vi.mock('./host', () => ({
  useHost: () => ({ router: { push: (to: string) => void routed.push(to), replace: (to: string) => void routed.push(to) }, path: '/chat' }),
  useLook: () => ({ pref: {}, set: () => {} }),
}))
vi.mock('./lib/signout', () => ({ useSigningOut: () => false, useSignOut: () => () => {} }))
vi.mock('./lib/session', () => ({ bearer: () => 't', named: () => null, org: () => 'acme', orgs: () => ['acme'], pick: () => {} }))
vi.mock('./lib/destination', () => ({ enter: () => {} }))
vi.mock('./lib/api', () => ({ api: () => 'https://api.hanzo.ai' }))
vi.mock('./open', () => ({ showSettings: () => {}, useOpen: () => ({ settings: null }) }))

import { path } from '@hanzo/dev/builder'
import { leave, useDevHost } from './dev'

/** The host as one render hands it out. */
function host(confirm?: Host['confirm']): Host {
  let got: Host | null = null
  const Read = () => {
    got = useDevHost(confirm)
    return null
  }
  renderToStaticMarkup(createElement(Read))
  return got!
}

afterEach(() => {
  vi.unstubAllGlobals()
  moved.length = 0
  routed.length = 0
})

/** A browser at `href`, whose page loads and history entries are recorded. */
function at(href: string) {
  const assign = vi.fn()
  const replace = vi.fn()
  const u = new URL(href)
  const entry = (_: unknown, __: string, to: string) => void moved.push(to)
  vi.stubGlobal('window', {
    location: { href, hostname: u.hostname, origin: u.origin, pathname: u.pathname, search: u.search, assign, replace },
    history: { pushState: entry, replaceState: entry },
  })
  return { assign, replace }
}

/** Where a recorded page load went: the address and its query. */
const where = (to: string) => {
  const u = new URL(to)
  return { at: `${u.origin}${u.pathname}`, org: u.searchParams.get('org'), back: u.searchParams.get('returnUrl') }
}

describe('the app host', () => {
  test('opens the plans on the pay site at once, for the organization in use, coming back to the page it left', () => {
    const { assign } = at('https://hanzo.app/chat')
    host().go(path({ kind: 'screen', screen: 'plans' }))
    expect(assign, 'in the same turn as the press, with nothing read first').toHaveBeenCalledTimes(1)
    expect(where(assign.mock.calls[0][0])).toEqual({ at: 'https://hanzo.ai/pay/cart', org: 'acme', back: 'https://hanzo.app/chat' })
    expect(moved, 'a page load, not a move inside the app').toEqual([])
  })

  test("the plans' own address is replaced, coming back to Dev", () => {
    const { assign, replace } = at('https://hanzo.app/dev/-/plans')
    leave('app')
    expect(assign).not.toHaveBeenCalled()
    expect(where(replace.mock.calls[0][0])).toEqual({ at: 'https://hanzo.ai/pay/cart', org: 'acme', back: 'https://hanzo.app/dev' })
  })

  test('opens a Settings section at its page of the site, through the router, never under /dev', () => {
    const { assign } = at('https://hanzo.app/dev')
    host().go(path({ kind: 'settings', section: 'billing' }))
    host().go(path({ kind: 'settings', section: 'notifications' }))
    expect(assign).not.toHaveBeenCalled()
    expect(moved, 'not a move inside the app').toEqual([])
    expect(routed).toEqual(['/settings/organization/billing', '/settings'])
  })

  test('moves inside the app to every other place', () => {
    const { assign } = at('https://hanzo.app/chat')
    host().go(path({ kind: 'screen', screen: 'projects' }))
    expect(assign).not.toHaveBeenCalled()
    expect(routed).toEqual([])
    expect(moved).toEqual(['/dev/projects'])
  })

  test('navigating to a chat thread via host.go from /, /chat, or /dev/projects/... lands on /chat/<id>, never /dev/projects/chat/<id>', () => {
    const thread = 't-mwsfr4dak3eyk3x0'
    for (const url of ['https://hanzo.app/', 'https://hanzo.app/chat', 'https://hanzo.app/dev/projects/acme/web']) {
      moved.length = 0
      routed.length = 0
      const { assign } = at(url)
      host().go(`/chat/${thread}`)
      expect(assign, url).not.toHaveBeenCalled()
      expect(routed, url).toEqual([])
      expect(moved, url).toEqual([`/chat/${thread}`])
    }
  })

  test('names Settings by its page', () => {
    expect(host().links?.settings).toBe('/settings')
  })

  test("the app's spend question is the builder's confirm, and with none the builder keeps its own", () => {
    const confirm = vi.fn(async () => true)
    expect(host(confirm).confirm).toBe(confirm)
    expect(host().confirm).toBeUndefined()
  })
})
