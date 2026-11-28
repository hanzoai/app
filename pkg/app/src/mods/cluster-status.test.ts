import { describe, expect, it, vi } from 'vitest'
import {
  CLUSTER_MOD_ID,
  clusterNavEntry,
  fetchClusterHealth,
  overallStatus,
  statusColor,
  type ServiceStatus,
} from './cluster-status'

describe('ClusterStatusMod (@hanzo/app reference mod)', () => {
  it('exports valid siderail nav entry metadata', () => {
    expect(clusterNavEntry.id).toBe(CLUSTER_MOD_ID)
    expect(clusterNavEntry.route).toBe('/cluster')
    expect(clusterNavEntry.label).toBe('Cluster')
    expect(clusterNavEntry.icon).toBe('Server')
  })

  it('computes overall status and status colors accurately', () => {
    const healthy: ServiceStatus[] = [
      { name: 'engine', status: 'healthy' },
      { name: 'api', status: 'healthy' },
    ]
    expect(overallStatus(healthy)).toBe('healthy')
    expect(statusColor('healthy')).toBe('#22c55e')

    const degraded: ServiceStatus[] = [
      { name: 'engine', status: 'healthy' },
      { name: 'api', status: 'degraded' },
    ]
    expect(overallStatus(degraded)).toBe('degraded')

    const down: ServiceStatus[] = [
      { name: 'engine', status: 'down' },
      { name: 'api', status: 'degraded' },
    ]
    expect(overallStatus(down)).toBe('down')
  })

  it('fetches authenticated /v1/health with IAM bearer token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ts: '2026-11-28T00:00:00.000Z',
        region: 'us-west-1',
        services: [{ name: 'engine', status: 'healthy', latencyMs: 12 }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    try {
      const health = await fetchClusterHealth('https://api.hanzo.ai', 'test-iam-token')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.hanzo.ai/v1/health',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-iam-token',
          }),
        }),
      )
      expect(health.region).toBe('us-west-1')
      expect(health.services[0].status).toBe('healthy')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('falls back to synthetic local status when /v1/health is unreachable', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    vi.stubGlobal('fetch', mockFetch)

    try {
      const health = await fetchClusterHealth('http://127.0.0.1:1234')
      expect(health.region).toBe('local')
      expect(health.services.length).toBeGreaterThan(0)
      expect(health.services[0].status).toBe('down')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
