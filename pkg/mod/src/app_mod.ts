/**
 * @hanzo/mod - Reference Open-Source App Mod Architecture
 * 
 * Provides contract, runtime registry, and lifecycle interfaces for mounting
 * modular application extensions directly into the @hanzo/app shell and siderail.
 */

export interface AppModTopBarControl {
  id: string
  label: string
  icon?: string
  tooltip?: string
  action: () => void | Promise<void>
}

export interface AppModEndpointConfig {
  engineUrl: string // e.g. "http://127.0.0.1:1234"
  cloudUrl: string  // e.g. "http://127.0.0.1:8080"
  authToken?: string
}

export interface AppModContext {
  token?: string | (() => Promise<string | null>)
  endpoints: AppModEndpointConfig
  go: (path: string) => void
  notify?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

export interface AppModDefinition {
  id: string
  name: string
  version: string
  description: string
  route: string
  category?: 'cluster' | 'tools' | 'analytics' | 'custom'
  icon?: string
  topBarControls?: (ctx: AppModContext) => AppModTopBarControl[]
  executeV1Call?: (ctx: AppModContext, path: string, options?: RequestInit) => Promise<Response>
  mount: (container: HTMLElement | unknown, ctx: AppModContext) => () => void
}

/** In-memory registry of active and sideloaded App Mods */
const MOD_REGISTRY = new Map<string, AppModDefinition>()

/**
 * Validates and defines an App Mod conforming to the @hanzo/mod specification.
 */
export function defineAppMod(definition: AppModDefinition): AppModDefinition {
  if (!definition.id || typeof definition.id !== 'string') {
    throw new Error('App Mod must provide a non-empty string `id`.')
  }
  if (!definition.name) {
    throw new Error(`App Mod [${definition.id}] must provide a display name.`)
  }
  if (!definition.route || !definition.route.startsWith('/')) {
    throw new Error(`App Mod [${definition.id}] route must begin with a leading slash '/'.`)
  }
  return Object.freeze({ ...definition })
}

/**
 * Registers an App Mod into the global application host registry.
 */
export function registerAppMod(mod: AppModDefinition): void {
  const validated = defineAppMod(mod)
  MOD_REGISTRY.set(validated.id, validated)
}

/**
 * Retrieves all registered App Mods available to the siderail.
 */
export function getRegisteredAppMods(): AppModDefinition[] {
  return Array.from(MOD_REGISTRY.values())
}

/**
 * Resolves an active App Mod by path or route.
 */
export function matchAppModRoute(path: string): AppModDefinition | undefined {
  for (const mod of MOD_REGISTRY.values()) {
    if (path === mod.route || path.startsWith(`${mod.route}/`)) {
      return mod
    }
  }
  return undefined
}

/**
 * Clears the registry (useful for test resets).
 */
export function clearAppModRegistry(): void {
  MOD_REGISTRY.clear()
}

/**
 * Helper to execute authenticated `/v1` requests against local/remote Hanzo endpoints.
 */
export async function fetchAuthenticatedV1(
  ctx: AppModContext,
  endpointPath: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = typeof ctx.token === 'function' ? await ctx.token() : ctx.token
  const baseUrl = endpointPath.startsWith('/v1/models') || endpointPath.startsWith('/v1/chat')
    ? ctx.endpoints.engineUrl
    : ctx.endpoints.cloudUrl

  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`
  const targetUrl = `${baseUrl.replace(/\/+$/, '')}${cleanPath}`

  const headers = new Headers(options.headers || {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(targetUrl, {
    ...options,
    headers,
  })
}

/**
 * Standard reference implementation: Cluster & Local Runtime Status App Mod
 */
export const ReferenceClusterStatusMod: AppModDefinition = defineAppMod({
  id: 'cluster-status',
  name: 'Cluster & Runtime Status',
  version: '1.0.0',
  description: 'Real-time telemetry and health monitoring for local hanzoai/engine and cloud cluster nodes.',
  route: '/apps/cluster-status',
  category: 'cluster',
  icon: 'server',
  topBarControls: (ctx: AppModContext) => [
    {
      id: 'refresh-metrics',
      label: 'Refresh',
      tooltip: 'Poll latest node metrics',
      action: async () => {
        try {
          await fetchAuthenticatedV1(ctx, '/v1/cluster/status')
        } catch {
          // handled in status UI
        }
      },
    },
    {
      id: 'switch-cluster',
      label: 'Local Node (:1234)',
      tooltip: 'Switch between local dev cluster and staging cloud',
      action: () => {
        ctx.notify?.('Switched cluster target to http://127.0.0.1:1234', 'info')
      },
    },
  ],
  executeV1Call: fetchAuthenticatedV1,
  mount: (_container, ctx) => {
    ctx.notify?.('Mounted Reference Cluster Status App Mod', 'info')
    return () => {
      // cleanup lifecycle hook
    }
  },
})
