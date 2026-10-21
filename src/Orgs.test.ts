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
  host: 'hanzo.ai',
  // The token's organizations, the one this browser works in, and whether IAM signed a SuperAdmin.
  orgs: ['acme'],
  org: 'acme' as string | null,
  sudo: false,
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
vi.mock('@hanzo/ui', () => ({
  Avatar: () => null,
  Button: ({ children }: { children?: ReactNode }) => createElement('button', null, children),
  Tag: ({ children }: { children?: ReactNode }) => createElement('span', null, children),
}))
vi.mock('@hanzo/ui/product/Filters', () => ({
  SearchInput: ({ placeholder, actions }: { placeholder?: string; actions?: ReactNode }) =>
    createElement('div', null, createElement('input', { placeholder }), actions),
}))
vi.mock('@hanzo/build/plan', () => ({ label: () => null, said: () => '' }))
vi.mock('lucide-react', () => ({ Check: () => null, Minus: () => null, Plus: () => null, X: () => null }))
vi.mock('@hanzo/iam/react', () => ({ useIam: () => state.iam }))
vi.mock('./waiting', () => ({ Waiting: () => null }))
vi.mock('./lib/destination', () => ({ LOGIN: '/login', enter: () => {} }))
vi.mock('./lib/ai', () => ({ useAi: () => ({ client: null }) }))
vi.mock('./lib/hostname', () => ({ useHost: () => state.host }))
vi.mock('./lib/hydrated', () => ({ useHydrated: () => true }))
vi.mock('./lib/api', () => ({ api: () => 'https://api.hanzo.ai' }))
vi.mock('./lib/tier', () => ({
  useTier: () => ({ tier: state.tier, wrong: null, reload: () => {} }),
  usePersonal: () => state.personal,
}))
vi.mock('./lib/session', () => ({
  CHOOSE: 'hanzo:org:choose',
  ORG: 'hanzo:org',
  PICKED: 'hanzo:org:picked',
  assumed: () => null,
  bearer: () => 't',
  hasSession: () => true,
  org: () => state.org,
  orgs: () => state.orgs,
  pick: () => {},
  renew: () => {},
  role: () => 'owner',
  scope: () => ({}),
  superAdmin: () => state.sudo,
  support: async () => {},
}))
vi.mock('./lib/host', () => ({ dev: () => '/dev', team: (host: string) => host === 'hanzo.team' }))
vi.mock('./lib/pay', () => ({ checkoutUrl: () => '', money: () => '' }))
vi.mock('./lib/plans', () => ({ cartUrl: () => '', charge: () => 0, priced: () => ({}), usePlan: () => ({}), usePlans: () => [] }))
vi.mock('./lib/invite', () => ({ createInvitation: async () => '', inviteLink: () => '', setOrganizationProfile: async () => {} }))
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
    state.host = 'hanzo.ai'
    state.orgs = ['acme']
    state.org = 'acme'
    state.sudo = false
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

  test('on the workspace\'s host a team on Free is asked for the plan, and not drawn the room', () => {
    state.host = 'hanzo.team'
    state.tier = { tier: { name: 'free' } }
    state.personal = false
    const html = drawn()
    expect(html).not.toContain('<textarea')
    expect(held(html)).toBe('')
  })

  test('on the workspace\'s host a live plan opens the room', () => {
    state.host = 'hanzo.team'
    state.tier = { tier: { name: 'dev' } }
    expect(held(drawn())).toBe('<div data-slot="held">')
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

  describe('the chooser', () => {
    beforeEach(() => {
      state.orgs = ['acme', 'webby-ai']
      state.org = null
    })

    test('several organizations and none chosen: each of the reader\'s is a row, with its slug and the role the token signs', () => {
      const html = drawn()
      expect(html).toContain('>Choose an organization<')
      for (const o of ['acme', 'webby-ai']) expect(html).toContain(`>${o}<`)
      expect(html).toContain('>Owner<')
      expect(html).not.toContain('<textarea')
    })

    test('a person may found one here, and is never shown every organization', () => {
      const html = drawn()
      expect(html).toContain('New organization')
      expect(html).toContain('placeholder="Find an organization"')
      expect(html).not.toContain('All organizations')
    })

    test('a SuperAdmin is shown every organization, and no way to own one', () => {
      state.sudo = true
      const html = drawn()
      expect(html).toContain('>All organizations<')
      expect(html).toContain('placeholder="Search every organization"')
      expect(html).not.toContain('New organization')
    })
  })
})
