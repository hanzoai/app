import { afterEach, describe, expect, test, vi } from 'vitest'

// The palette's places and actions against the registries they are derived
// from. The registries are @hanzo/build's and @hanzo/studio's, drawn here as
// the shape they hand a sidebar: rows that move the app through `go`.
const { empty, asked } = vi.hoisted(() => ({ empty: vi.fn(), asked: [] as unknown[] }))

vi.mock('@hanzo/ai/react', () => ({ useAi: () => ({}) }))
vi.mock('@hanzo/ui', () => ({ Dialog: () => null, DialogContent: () => null, DialogTitle: () => null }))
vi.mock('@hanzo/ui/product/CommandMenu', () => ({ CommandMenu: () => null }))
vi.mock('@hanzo/build', async () => {
  const { path } = await import('@hanzo/build/route')
  type Go = (p: string) => void
  const link = (go: Go, id: string, label: string, at: string) => ({ id, label, onPress: () => go(at) })
  type Section = Extract<Parameters<typeof path>[0], { kind: 'settings' }>['section']
  const settings = (go: Go, id: Section, label: string) => link(go, id, label, path({ kind: 'settings', section: id }))
  return {
    NEW: 'new',
    path,
    // As @hanzo/build's reads it: the host's api, token, org and person, at once.
    useSessions: (h: { api: string; person: unknown }) => (asked.push(h), h.api, Boolean(h.person), { value: [] }),
    nav: (_: unknown, go: Go) => [
      { id: 'work', label: 'Work', links: [link(go, 'new', 'New run', ''), link(go, 'projects', 'Projects', path({ kind: 'screen', screen: 'projects' }))] },
      { id: 'run', label: 'Run', links: [settings(go, 'machines', 'Machines')] },
    ],
    sections: (_: unknown, go: Go) => [
      { id: 'Settings', label: '', links: [settings(go, 'general', 'General'), settings(go, 'account', 'Account'), settings(go, 'billing', 'Billing'), settings(go, 'machines', 'Machines')] },
    ],
    tabs: (_: unknown, go: Go) => [{ id: 'customize', label: '', links: [link(go, 'agents', 'Agents', path({ kind: 'customize', tab: 'agents' }))] }],
    library: () => [
      { id: 'library-do', label: '', links: [{ id: 'upload', label: 'Upload', onPress: () => {} }] },
      { id: 'library-kinds', label: '', links: [{ id: 'kind-image', label: 'Images', onPress: () => {} }] },
    ],
  }
})
vi.mock('@hanzo/studio', () => ({ nav: (_: unknown, go: (p: string) => void) => [{ id: 'make', label: 'Create', links: [{ id: 'explore', label: 'Explore', onPress: () => go('explore') }] }] }))
vi.mock('./crew', () => ({ useCrew: () => ({ agents: [] }) }))
vi.mock('./agents', () => ({ ordered: (a: unknown[]) => a }))
vi.mock('./team', () => ({ called: (n: string) => n }))
vi.mock('./thread', () => ({ useThreadList: () => ({ threads: [] }) }))
vi.mock('./open', () => ({ empty, openThread: () => {}, withAgents: () => {} }))
vi.mock('./lib/signout', () => ({ useSignOut: () => () => {} }))
vi.mock('./lib/session', () => ({ choose: () => {} }))
vi.mock('./Betas', () => ({ useBetas: () => ({ open: () => false }) }))

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { path } from '@hanzo/build/route'
import { actions, Search, places } from './Search'
import { app, settings, talk } from './lib/host'
import type { Host } from '@hanzo/build'

const host = { path: '', org: 'acme' } as unknown as Host
const take = (rows: { id: string; run: () => void }[], id: string) => {
  const row = rows.find((r) => r.id === id)
  expect(row, id).toBeDefined()
  row!.run()
}

afterEach(() => {
  vi.unstubAllGlobals()
  empty.mockClear()
})

describe('Go to', () => {
  test('a Settings page is jumped to at its address of the site, named for where it lives', () => {
    const go = vi.fn()
    const { deep } = places(host, go)
    expect(deep.find((r) => r.id === 'settings-billing')).toMatchObject({ label: 'Billing', where: 'Settings' })
    take(deep, 'settings-billing')
    expect(go).toHaveBeenCalledWith(settings('billing'))
    expect(app(path({ kind: 'settings', section: 'billing' }))).toBe('/settings/organization/billing')
    take(deep, 'settings-general')
    expect(go).toHaveBeenLastCalledWith('/settings')
  })

  test('a section with no page of its own is not offered, and Settings itself opens /settings', () => {
    const go = vi.fn()
    const { top, deep } = places(host, go)
    expect(deep.map((r) => r.id)).not.toContain('settings-account')
    expect(deep.map((r) => r.id)).not.toContain('settings-machines')
    take(top, 'settings')
    expect(go).toHaveBeenCalledWith('/settings')
  })

  test('Referral leaves the app for the site’s own page', () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { assign } })
    take(places(host, vi.fn()).top, 'referral')
    expect(assign).toHaveBeenCalledWith('/referral')
  })

  test('the products lead, then Dev’s places from its registry, New run left to the action', () => {
    const { top } = places(host, vi.fn())
    expect(top.slice(0, 7).map((r) => r.label)).toEqual(['Chat', 'Dev', 'Studio', 'Tabs', 'Team', 'Projects', 'Machines'])
    expect(top.some((r) => r.label === 'New run')).toBe(false)
  })

  test('a place two registries hold is listed once; Studio’s places are Studio’s', () => {
    const go = vi.fn()
    const { top, deep } = places(host, go)
    expect([...top, ...deep].filter((r) => r.label === 'Machines')).toHaveLength(1)
    take(deep, 'studio-explore')
    expect(go).toHaveBeenCalledWith('/studio/explore')
  })

  test('without a host the products and the site’s pages are still there', () => {
    const { top, deep } = places(undefined, vi.fn())
    expect(top.map((r) => r.id)).toEqual(['chat', 'dev', 'studio', 'tabs', 'settings', 'referral', 'beta', 'help-help'])
    expect(deep.every((r) => r.where === 'Help')).toBe(true)
  })
})

describe('Actions', () => {
  test('New chat empties the selection and opens Chat', () => {
    const go = vi.fn()
    take(actions(host, go, () => {}, () => {}), 'new-chat')
    expect(empty).toHaveBeenCalledTimes(1)
    expect(go).toHaveBeenCalledWith(talk())
  })

  test('what the host cannot do is not offered', () => {
    const ids = (h?: Host) => actions(h, vi.fn(), () => {}, () => {}).map((a) => a.id)
    expect(ids(host)).toEqual(['new-chat', 'new-task', 'new-creation', 'new-scheduled', 'upload', 'model', 'org', 'keys', 'logout'])
    expect(ids({ ...host, chooseTheme: () => {} } as Host)).toContain('theme')
    expect(ids()).not.toContain('upload')
  })
})

describe('The palette', () => {
  test('opens in a frame that holds no builder, asking for no runs', () => {
    // hanzo.team's Shell mounts it with no host: it draws, and the runs it asks
    // for are nobody's rather than a read of a host that is not there.
    asked.length = 0
    expect(() => renderToStaticMarkup(createElement(Search, { onClose: () => {}, go: () => {} }))).not.toThrow()
    expect(asked).toHaveLength(1)
    expect(asked[0]).toMatchObject({ api: '', person: null })
  })
})
