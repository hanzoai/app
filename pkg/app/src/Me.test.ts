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
vi.mock('@hanzo/build', () => ({
  label: () => null,
  Meter: () => null,
  said: () => '',
  useStanding: () => ({ value: null, error: null, loading: false }),
}))
vi.mock('./lib/session', () => ({ choose: () => {}, org: () => 'acme', orgs: () => ['acme'], pick: () => {}, renew: () => {}, scope: () => ({}), superAdmin: () => false }))
vi.mock('./lib/org', () => ({ createOrg: async () => '', say: String }))
vi.mock('./dev', () => ({ leave: left }))
vi.mock('./open', () => ({ showSettings: settings }))

import { Me, upgrade } from './Me'

/** The account menu, open, as its rows. */
function menu() {
  rows.length = 0
  const host = { api: '', token: () => null, org: 'acme', person: { name: 'Ada', email: 'ada@acme.dev', avatar: '' }, signOut: () => {} }
  renderToStaticMarkup(createElement(Me, { host, onOrg: () => {} }))
  return [...rows]
}

const press = (label: string) => menu().find((r) => r.label === label)?.press()

afterEach(() => {
  settings.mockClear()
  left.mockClear()
})

describe('the account menu', () => {
  test('reads top to bottom: the account, the organization with its plan, Upgrade plan, Personalization, Profile, Settings, Beta, Language, Help and Log out', () => {
    expect(menu().map((r) => r.label)).toEqual(['Ada', 'acme · No plan', 'Upgrade plan', 'Personalization', 'Profile', 'Settings', 'Beta', 'Language', 'Help', 'Log out'])
  })

  test("Beta opens the person's place on the waitlist, a page of the site", () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    press('Beta')
    vi.unstubAllGlobals()
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/\/beta$/))
  })

  test("each Settings row opens its section of Settings, the one door the app and the shell both answer", () => {
    press('Personalization')
    press('Profile')
    press('Settings')
    expect(settings.mock.calls).toEqual([['general'], ['account'], ['general']])
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
})
