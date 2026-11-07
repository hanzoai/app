import { createElement, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

// The drawing libraries are not under test and do not load outside a bundler.
// Each primitive draws its children, and a menu row records its words and its
// press, so the open menu can be read in order and pressed.
const { rows, settings, left, Draw, Row } = vi.hoisted(() => {
  const rows: { label: string; press: () => void }[] = []
  /** The words under a node, in order. */
  const words = (node: ReactNode): string[] =>
    typeof node === 'string' ? [node] : Array.isArray(node) ? node.flatMap(words) : isValidElement<{ children?: ReactNode }>(node) ? words(node.props.children) : []
  const Draw = ({ children }: { children?: ReactNode }) => createElement('div', null, children)
  const Row = (props: { children?: ReactNode; onSelect?: () => void }) => {
    rows.push({ label: words(props.children)[0] ?? '', press: props.onSelect ?? (() => {}) })
    return Draw(props)
  }
  return { rows, settings: vi.fn(), left: vi.fn(), Draw, Row }
})

vi.mock('@hanzo/gui', () => ({ SizableText: Draw, XStack: Draw, YStack: Draw }))
vi.mock('@hanzo/ui', () => ({
  Button: () => null,
  Dialog: () => null,
  DialogContent: () => null,
  DialogTitle: () => null,
  DropdownMenu: Draw,
  DropdownMenuContent: Draw,
  DropdownMenuItem: Row,
  DropdownMenuLabel: Draw,
  DropdownMenuSeparator: () => null,
  DropdownMenuShortcut: Draw,
  DropdownMenuSub: Draw,
  DropdownMenuSubContent: Draw,
  DropdownMenuSubTrigger: Row,
  DropdownMenuTrigger: Draw,
  Input: () => null,
  Kbd: Draw,
}))
vi.mock('@hanzo/iam/react', () => ({ useOrganizations: () => ({ roles: { acme: 'owner' } }) }))
vi.mock('@hanzo/build', async () => {
  const { label, said } = await import('@hanzo/build/plan')
  return { label, Meter: () => null, said, useStanding: () => ({ value: null, error: null, loading: false }) }
})
vi.mock('./lib/session', () => ({ choose: () => {}, org: () => 'acme', orgs: () => ['acme'], pick: () => {}, renew: () => {}, scope: () => ({}), superAdmin: () => false }))
vi.mock('./lib/org', () => ({ createOrg: async () => '', say: String }))
vi.mock('./dev', () => ({ leave: left }))
vi.mock('./open', () => ({ showSettings: settings }))
// The accounts signed in on this browser: Ada (current) and whoever a test adds.
const signed = vi.hoisted(() => ({
  accounts: [] as { sub: string; owner: string; name: string; displayName: string; email: string; avatar: string }[],
  switchTo: vi.fn(async () => {}),
  add: vi.fn(async () => {}),
}))
vi.mock('./lib/accounts', () => ({
  label: (a: { displayName: string; name: string; email: string }) => ({ title: a.displayName || a.name, line: a.email }),
  useAccounts: () => ({
    accounts: signed.accounts,
    current: signed.accounts.find((a) => a.name === 'ada') ?? null,
    switchTo: signed.switchTo,
    add: signed.add,
  }),
}))

import { Account, planOf, upgrade } from './Account'
import type { Tier } from './lib/tier'

/** The account menu, open, as its rows. */
function menu(accountOpen = false) {
  rows.length = 0
  const host = { api: '', token: () => null, org: 'acme', person: { name: 'Ada', email: 'ada@acme.dev', avatar: '' }, signOut: () => {} }
  renderToStaticMarkup(createElement(Account, { host, onOrg: () => {}, defaultAccountOpen: accountOpen }))
  return [...rows]
}

const press = (label: string, accountOpen = true) => menu(accountOpen).find((r) => r.label === label)?.press()

afterEach(() => {
  settings.mockClear()
  left.mockClear()
})

describe('the account menu', () => {
  test('reads top to bottom: the account icon, Add account, the organization switcher, Usage, Settings, Upgrade plan, Language, Help and Log out', () => {
    expect(menu(false).map((r) => r.label)).toEqual(['Ada', 'Add account', 'acme · Free', 'Usage', 'Settings', 'Upgrade plan', 'Language', 'Help', 'Log out'])
  })

  test('the account icon collapses account options: Profile, Personalization, Settings, Beta', () => {
    expect(menu(true).map((r) => r.label)).toEqual(['Ada', 'Profile', 'Personalization', 'Settings', 'Beta', 'Add account', 'acme · Free', 'Usage', 'Settings', 'Upgrade plan', 'Language', 'Help', 'Log out'])
  })

  test('every other account signed in on this browser is listed under the current one, and a press switches to it', () => {
    const ada = { sub: 's-ada', owner: 'acme', name: 'ada', displayName: 'Ada', email: 'ada@acme.dev', avatar: '' }
    const bob = { sub: 's-bob', owner: 'acme', name: 'bob', displayName: 'Bob Tester', email: 'bob@acme.dev', avatar: '' }
    signed.accounts = [ada, bob]
    try {
      const labels = menu(false).map((r) => r.label)
      expect(labels.slice(0, 3)).toEqual(['Ada', 'Bob Tester', 'Add account'])
      expect(labels.filter((l) => l === 'Ada')).toHaveLength(1)
      press('Bob Tester', false)
      expect(signed.switchTo).toHaveBeenCalledWith(bob)
      press('Add account', false)
      expect(signed.add).toHaveBeenCalledTimes(1)
    } finally {
      signed.accounts = []
    }
  })

  test("Beta opens the person's place on the waitlist, a page of the site", () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    press('Beta')
    vi.unstubAllGlobals()
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/\/beta$/))
  })

  test("each Settings row opens its section of Settings, the one door the app and the shell both answer", () => {
    press('Usage')
    expect(settings).toHaveBeenCalledWith('usage')
    press('Personalization')
    press('Profile')
    press('Settings')
    expect(settings.mock.calls).toEqual([['usage'], ['general'], ['account'], ['general']])
  })

  test('Upgrade plan leaves for the plans on the pay site', () => {
    press('Upgrade plan')
    expect(left).toHaveBeenCalledWith('here')
  })

  test('the plans row is named by the plan the organization is on', () => {
    expect(upgrade('Enterprise')).toBe('Enterprise plan')
    expect(upgrade('Agency')).toBe('Agency plan')
    for (const family of ['Free', 'Pro', 'Max', 'Team', 'DNS', 'Embedded Pod', 'Forward Deployed', 'White', null, undefined]) expect(upgrade(family), String(family)).toBe('Upgrade plan')
  })

  test("an organization's plan is the tier answer's planName, else its family", () => {
    const tier = (t: Partial<Tier>) => ({ plan: '', tier: { name: 'pro' }, ...t }) as Tier
    expect(planOf(tier({ plan: 'unlimited', planName: 'Unlimited' }))).toBe('Unlimited')
    expect(planOf(tier({ plan: '', planName: 'Unlimited' }))).toBe('Unlimited')
    expect(planOf(tier({ plan: 'max-20x' }))).toBe('Max 20x')
    expect(planOf(tier({ plan: '' }))).toBe('Pro')
    expect(planOf(null)).toBe('')
  })
})
