import { beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  auth: { Authorization: 'Bearer tok', 'X-Org-Id': 'acme' } as Record<string, string>,
  org: 'acme' as string | null,
}))

vi.mock('./api', () => ({ api: () => 'https://api.hanzo.ai' }))
vi.mock('./session', () => ({
  scope: () => state.auth,
  org: () => state.org,
}))

const { orgNavKey, readOrgNavDefaults, resetOrgNavCache, resolveNavSeed, saveOrgNavDefaults } = await import('./org-nav')

beforeEach(() => {
  resetOrgNavCache()
  vi.restoreAllMocks()
})

describe('per-org sidebar customization & org defaults (/v1/settings/app-nav)', () => {
  test('scopes user preference keys per organization', () => {
    expect(orgNavKey('hanzo.nav.pins', 'acme')).toBe('hanzo.nav.pins:acme')
    expect(orgNavKey('hanzo.nav.pins', 'Hanzo')).toBe('hanzo.nav.pins:hanzo')
    expect(orgNavKey('hanzo.nav.pins', null)).toBe('hanzo.nav.pins')
  })

  test('new org members inherit org defaults; personal per-org customizations override org defaults', () => {
    const orgDefaults = ['chat', 'dev', 'app-crm', 'scheduled']
    // New member with no personal override in this org starts with org defaults.
    expect(resolveNavSeed(null, orgDefaults, ['legacy-only'])).toEqual(orgDefaults)
    // Member who customized their own sidebar in this org keeps their per-org order.
    expect(resolveNavSeed(['dev', 'chat', 'design'], orgDefaults, null)).toEqual(['dev', 'chat', 'design'])
    // When org has no defaults, legacy global pins carry over cleanly.
    expect(resolveNavSeed(null, null, ['app-commerce'])).toEqual(['app-commerce'])
    expect(resolveNavSeed(null, null, null)).toEqual([])
  })

  test('reads and writes org default apps via GET/PUT /v1/settings/app-nav', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ product: 'app-nav', config: { apps: ['chat', 'dev', 'app-crm'] } }), { status: 200 }),
    )
    expect(await readOrgNavDefaults()).toEqual(['chat', 'dev', 'app-crm'])
    expect(fetchSpy).toHaveBeenCalledWith('https://api.hanzo.ai/v1/settings/app-nav', { headers: state.auth })

    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ product: 'app-nav', config: { apps: ['chat', 'app-crm'] } }), { status: 200 }))
    expect(await saveOrgNavDefaults(['chat', 'app-crm', 'chat'])).toBe(true)
    expect(fetchSpy).toHaveBeenLastCalledWith('https://api.hanzo.ai/v1/settings/app-nav', {
      method: 'PUT',
      headers: { ...state.auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { apps: ['chat', 'app-crm'] } }),
    })
    // Cache updated immediately after save.
    expect(await readOrgNavDefaults()).toEqual(['chat', 'app-crm'])
  })
})
