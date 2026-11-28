import { describe, expect, it, vi } from 'vitest'
import { createClusterStatusMod } from './clusterStatusMod'

describe('createClusterStatusMod', () => {
  it('registers route, siderail entry, top bar action, and authenticated /v1 call', async () => {
    const mod = createClusterStatusMod()
    expect(mod.id).toBe('cluster-status')
    expect(mod.route).toBe('/mods/cluster-status')
    expect(mod.topBarAction.endpoint).toBe('/v1/health')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'healthy' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await mod.fetchClusterStatus('https://api.hanzo.ai/', 'test-token')
    expect(mockFetch).toHaveBeenCalledWith('https://api.hanzo.ai/v1/health', {
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/json',
      },
    })
    expect(result).toEqual({ ok: true, status: 200, data: { status: 'healthy' } })
    vi.unstubAllGlobals()
  })
})
