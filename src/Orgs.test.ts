import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

// What the gate reads, set per test: the session, the tier and the kind of organization.
const state = vi.hoisted(() => ({
  iam: { isAuthenticated: true, isLoading: false, accessToken: 't' },
  tier: null as { tier: { name: string } } | null,
  personal: null as boolean | null,
  // The host's front door: `team` on hanzo.team, nothing on hanzo.ai.
  where: {} as { team?: boolean },
}))

// The drawing libraries are not under test and do not load outside a bundler.
// A View draws the element it is given to render, with its children, so the
// markup carries the attributes the gate sets.
vi.mock('@hanzo/gui', () => {
  const Draw = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
  const View = ({ render, children }: { render?: ReactElement; children?: ReactNode }) =>
    isValidElement(render) ? cloneElement(render, undefined, children) : createElement('div', null, children)
  return { Text: Draw, View, XStack: Draw, YStack: Draw }
})
vi.mock('@hanzo/ui', () => ({ Button: () => null }))
vi.mock('lucide-react', () => ({ Minus: () => null, Plus: () => null, X: () => null }))
vi.mock('@hanzo/iam/react', () => ({ useIam: () => state.iam }))
vi.mock('./waiting', () => ({ Waiting: () => null }))
vi.mock('./lib/destination', () => ({ LOGIN: '/login', enter: () => {} }))
vi.mock('./lib/ai', () => ({ useAi: () => ({ client: null }) }))
vi.mock('./lib/hostname', () => ({ useHost: () => 'hanzo.ai' }))
vi.mock('./lib/hydrated', () => ({ useHydrated: () => true }))
vi.mock('./lib/api', () => ({ api: () => 'https://api.hanzo.ai' }))
vi.mock('./lib/tier', () => ({
  useTier: () => ({ tier: state.tier, wrong: null, reload: () => {} }),
  usePersonal: () => state.personal,
}))
vi.mock('./lib/session', () => ({
  ORG: 'hanzo:org',
  PICKED: 'hanzo:org:picked',
  assumed: () => null,
  hasSession: () => true,
  org: () => 'acme',
  orgs: () => ['acme'],
  pick: () => {},
  renew: () => {},
  scope: () => ({}),
}))
vi.mock('./lib/host', () => ({ dev: () => '/dev', team: (host: string) => host === 'hanzo.team' }))
vi.mock('./lib/pay', () => ({ checkoutUrl: () => '', money: () => '' }))
vi.mock('./lib/plans', () => ({ cartUrl: () => '', charge: () => 0, priced: () => ({}), usePlan: () => ({}), usePlans: () => [] }))
vi.mock('./lib/invite', () => ({ createInvitation: async () => '', inviteLink: () => '' }))
vi.mock('./lib/intent', () => ({ countSignup: () => {} }))
vi.mock('./lib/tags', () => ({ track: () => {} }))
vi.mock('./lib/mix', () => ({ BAD: 'red', mix: () => '' }))
vi.mock('./host', () => ({ useRooms: () => ({ router: { replace: () => {} } }) }))
vi.mock('./where', () => ({ brand: () => 'Hanzo AI', site: (p: string) => p, where: () => state.where }))

const { Orgs } = await import('./Orgs')

/** The gate's markup over a composer, the room it holds. */
const drawn = () => renderToStaticMarkup(createElement(Orgs, null, createElement('textarea', { 'aria-label': 'Ask anything' })))

/** The room's wrapper, as drawn. */
const held = (html: string) => html.match(/<div data-slot="held"[^>]*>/)?.[0] ?? ''

describe('the organization gate', () => {
  beforeEach(() => {
    state.iam = { isAuthenticated: true, isLoading: false, accessToken: 't' }
    state.tier = null
    state.personal = null
    state.where = {}
  })

  test('while the session settles, the room under the veil is inert and hidden', () => {
    state.iam = { isAuthenticated: false, isLoading: true, accessToken: '' }
    const html = drawn()
    expect(html).toContain('<textarea')
    expect(held(html)).toContain('inert=""')
    expect(held(html)).toContain('aria-hidden="true"')
  })

  test('off the front door the room opens before any plan is read, and nothing holds it', () => {
    const html = drawn()
    expect(held(html)).toBe('<div data-slot="held">')
    expect(html).toContain('<textarea')
  })

  test('off the front door a team on Free opens the room: no plan stands in front of Chat', () => {
    state.tier = { tier: { name: 'free' } }
    state.personal = false
    const html = drawn()
    expect(held(html)).toBe('<div data-slot="held">')
    expect(html).toContain('<textarea')
    expect(html).not.toContain('nothing in it works')
  })

  describe('behind the front door', () => {
    beforeEach(() => {
      state.where = { team: true }
    })

    test('while the tier is read, the room under the veil is inert and hidden', () => {
      const html = drawn()
      expect(held(html)).toContain('inert=""')
      expect(held(html)).toContain('aria-hidden="true"')
    })

    test('while a Free organization is read for its kind, the room is inert', () => {
      state.tier = { tier: { name: 'free' } }
      expect(held(drawn())).toContain('inert=""')
    })

    test('a live plan opens the room, in the same place, and nothing holds it', () => {
      state.tier = { tier: { name: 'dev' } }
      const html = drawn()
      expect(held(html)).toBe('<div data-slot="held">')
      expect(html).toContain('<textarea')
    })

    test('a team on Free is not drawn the room at all', () => {
      state.tier = { tier: { name: 'free' } }
      state.personal = false
      const html = drawn()
      expect(html).not.toContain('<textarea')
      expect(held(html)).toBe('')
    })
  })
})
