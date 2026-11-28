import type { ModTheme } from './theme'

export interface SiderailModEntry {
  id: string
  label: string
  route: string
  icon: string
  topBarAction: {
    label: string
    endpoint: string
  }
  theme: ModTheme
  fetchClusterStatus: (baseUrl: string, token: string) => Promise<{ ok: boolean; status: number; data: unknown }>
}

export function createClusterStatusMod(baseTheme?: Partial<ModTheme>): SiderailModEntry {
  const theme: ModTheme = {
    name: baseTheme?.name ?? 'cluster-status-mod',
    platform: baseTheme?.platform ?? 'macos',
    ...(baseTheme ?? {}),
  } as ModTheme

  return {
    id: 'cluster-status',
    label: 'Cluster Status',
    route: '/mods/cluster-status',
    icon: 'activity',
    topBarAction: {
      label: 'Refresh /v1/health',
      endpoint: '/v1/health',
    },
    theme,
    async fetchClusterStatus(baseUrl: string, token: string) {
      const url = `${baseUrl.replace(/\/$/, '')}/v1/health`
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })
      const data = await res.json().catch(() => null)
      return { ok: res.ok, status: res.status, data }
    },
  }
}
