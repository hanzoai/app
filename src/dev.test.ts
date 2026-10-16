import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Host } from '@hanzo/build'

// The host is read off one render; everything it asks of IAM, the router and
// the look is answered here, and a move inside the app is recorded rather than
// made. The builder does not load outside a bundler, so its address grammar is
// the two kinds this reads: a screen and a Settings section.
const { moved } = vi.hoisted(() => ({ moved: [] as string[] }))

vi.mock('@hanzo/build', () => {
  type Route = { kind: string; screen?: string; section?: string }
  const path = (r: Route) => (r.kind === 'settings' ? `-/settings/${r.section}` : r.kind === 'screen' ? `-/${r.screen}` : '')
  const route = (p: string): Route =>
    p.startsWith('-/settings/') ? { kind: 'settings', section: p.slice(11) } : p.startsWith('-/') ? { kind: 'screen', screen: p.slice(2) } : { kind: 'new' }
  return { administers: () => true, path, route }
})
vi.mock('@hanzo/iam/react', () => ({ useIam: () => ({ user: { name: 'Ada', email: 'ada@acme.dev' }, accessToken: 't' }) }))
vi.mock('./host', () => ({ useRooms: () => ({ router: { push: () => {} }, path: '/chat' }), useLook: () => ({ pref: {}, set: () => {} }) }))
vi.mock('./lib/signout', () => ({ useSignOut: () => () => {} }))
vi.mock('./lib/session', () => ({ bearer: () => 't', named: () => null, org: () => 'acme', orgs: () => ['acme'], pick: () => {} }))
vi.mock('./lib/destination', () => ({ enter: () => {} }))
vi.mock('./lib/api', () => ({ api: () => 'https://api.hanzo.ai' }))
vi.mock('./open', () => ({ showSettings: () => {}, useOpen: () => ({ settings: null }) }))
vi.mock('./lib/host', async (actual) => ({
  ...((await actual()) as object),
  go: (address: string) => void moved.push(address),
}))

import { path } from '@hanzo/build'
import { leave, useDevHost } from './dev'

/** The host as one render hands it out. */
function host(): Host {
  let got: Host | null = null
  const Read = () => {
    got = useDevHost()
    return null
  }
  renderToStaticMarkup(createElement(Read))
  return got!
}

afterEach(() => {
  vi.unstubAllGlobals()
  moved.length = 0
})

/** A browser at `href`, whose page loads are recorded. */
function at(href: string) {
  const assign = vi.fn()
  const replace = vi.fn()
  const u = new URL(href)
  vi.stubGlobal('window', { location: { href, hostname: u.hostname, origin: u.origin, pathname: u.pathname, search: u.search, assign, replace } })
  return { assign, replace }
}

/** Where a recorded page load went: the address and its query. */
const where = (to: string) => {
  const u = new URL(to)
  return { at: `${u.origin}${u.pathname}`, org: u.searchParams.get('org'), back: u.searchParams.get('returnUrl') }
}

describe('the app host', () => {
  test('opens the plans on the pay site at once, for the organization in use, coming back to the page it left', () => {
    const { assign } = at('https://hanzo.ai/chat')
    host().go(path({ kind: 'screen', screen: 'plans' }))
    expect(assign, 'in the same turn as the press, with nothing read first').toHaveBeenCalledTimes(1)
    expect(where(assign.mock.calls[0][0])).toEqual({ at: 'https://hanzo.ai/pay/cart', org: 'acme', back: 'https://hanzo.ai/chat' })
    expect(moved, 'a page load, not a move inside the app').toEqual([])
  })

  test("the plans' own address is replaced, coming back to Dev", () => {
    const { assign, replace } = at('https://hanzo.ai/dev/-/plans')
    leave('app')
    expect(assign).not.toHaveBeenCalled()
    expect(where(replace.mock.calls[0][0])).toEqual({ at: 'https://hanzo.ai/pay/cart', org: 'acme', back: 'https://hanzo.ai/dev' })
  })

  test('moves inside the app to every other place', () => {
    const { assign } = at('https://hanzo.ai/chat')
    host().go(path({ kind: 'settings', section: 'billing' }))
    expect(assign).not.toHaveBeenCalled()
    expect(moved).toHaveLength(1)
    expect(moved[0]).toMatch(/^\/dev\//)
  })
})
