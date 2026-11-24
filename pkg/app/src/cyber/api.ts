/**
 * Native Hanzo Cloud API client for `/v1/cyber/*`.
 *
 * Authenticates every request with the reader's standard Hanzo IAM (`hanzo.id`)
 * bearer token and active organization header (`X-Org-Id`). Never uses a separate
 * Python backend or bespoke authentication.
 */

import { api } from '../lib/api'
import { bearer, org as currentOrg } from '../lib/session'
import type {
  CyberApproval,
  CyberAttackMatrix,
  CyberCoaItem,
  CyberDashboard,
  CyberEngagement,
  CyberFinding,
  CyberGraphNode,
  CyberHardening,
  CyberInterceptRule,
  CyberNodeKind,
  CyberRuleAction,
  CyberSeedDemoResponse,
  CyberSeverity,
  CyberTask,
  CyberTaskGraph,
  CyberTrafficRecord,
} from './types'

export class CyberApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'CyberApiError'
    this.status = status
  }
}

export function cyberHeaders(json = true): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = bearer()
  if (token) headers.Authorization = `Bearer ${token}`
  const orgId = currentOrg()
  if (orgId) headers['X-Org-Id'] = orgId
  if (json) headers['Content-Type'] = 'application/json'
  return headers
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hasBody = init.body !== undefined
  const url = `${api()}/v1/cyber${path}`
  const res = await fetch(url, {
    ...init,
    credentials: 'omit',
    headers: {
      ...cyberHeaders(hasBody),
      ...(init.headers as Record<string, string> | undefined),
    },
  })
  const text = await res.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }
  if (!res.ok) {
    const errObj = parsed as { error?: { message?: string } | string; message?: string } | null
    const msg =
      (typeof errObj?.error === 'object' ? errObj.error?.message : errObj?.error) ||
      errObj?.message ||
      `Request failed (${res.status})`
    throw new CyberApiError(res.status, msg)
  }
  return parsed as T
}

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim()) sp.set(k, v.trim())
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const cyberApi = {
  dashboard: (engagementId?: string) =>
    request<CyberDashboard>(`/dashboard${qs({ engagementId })}`),

  listEngagements: () =>
    request<{ data: CyberEngagement[] }>('/engagements').then((r) => r.data ?? []),

  createEngagement: (input: {
    name: string
    target: string
    scope?: string[]
    mode?: string
    synthetic?: boolean
  }) =>
    request<CyberEngagement>('/engagements', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  seedDemo: () =>
    request<CyberSeedDemoResponse>('/engagements/seed-demo', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  listTasks: (engagementId?: string) =>
    request<{ data: CyberTask[] }>(`/tasks${qs({ engagementId })}`).then((r) => r.data ?? []),

  createTask: (input: { engagementId: string; title: string; goal?: string; phase?: string }) =>
    request<CyberTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getTaskGraph: (taskId: string) =>
    request<CyberTaskGraph>(`/tasks/${encodeURIComponent(taskId)}/graph`),

  addGraphNode: (
    taskId: string,
    input: {
      kind: CyberNodeKind
      label: string
      detail?: string
      status?: string
      severity?: string
      parentId?: string
    },
  ) =>
    request<CyberGraphNode>(`/tasks/${encodeURIComponent(taskId)}/nodes`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listFindings: (filter?: { engagementId?: string; severity?: string; status?: string }) =>
    request<{ data: CyberFinding[] }>(
      `/findings${qs({
        engagementId: filter?.engagementId,
        severity: filter?.severity,
        status: filter?.status,
      })}`,
    ).then((r) => r.data ?? []),

  createFinding: (input: {
    engagementId: string
    taskId?: string
    title: string
    severity?: CyberSeverity
    category?: string
    cwe?: string
    mitreTechnique?: string
    mitreTactic?: string
    target?: string
    evidenceQuote?: string
    trafficId?: string
    remediation?: string
  }) =>
    request<CyberFinding>('/findings', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateFinding: (
    id: string,
    input: { status?: string; evidenceQuote?: string; trafficId?: string; remediation?: string },
  ) =>
    request<CyberFinding>(`/findings/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  verifyFinding: (id: string, input?: { trafficId?: string; evidenceQuote?: string }) =>
    request<CyberFinding>(`/findings/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      body: JSON.stringify(input ?? {}),
    }),

  listTraffic: (filter?: { engagementId?: string; host?: string }) =>
    request<{ data: CyberTrafficRecord[] }>(
      `/traffic${qs({ engagementId: filter?.engagementId, host: filter?.host })}`,
    ).then((r) => r.data ?? []),

  recordTraffic: (input: {
    engagementId: string
    taskId?: string
    method?: string
    url: string
    host?: string
    statusCode?: number
    requestHeaders?: string
    requestBody?: string
    responseHeaders?: string
    responseBody?: string
    latencyMs?: number
  }) =>
    request<CyberTrafficRecord>('/traffic', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listApprovals: (filter?: { engagementId?: string; status?: string }) =>
    request<{ data: CyberApproval[] }>(
      `/approvals${qs({ engagementId: filter?.engagementId, status: filter?.status })}`,
    ).then((r) => r.data ?? []),

  submitApproval: (input: {
    engagementId: string
    taskId?: string
    action: string
    target: string
    tool?: string
  }) =>
    request<CyberApproval>('/approvals', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  decideApproval: (id: string, decision: 'approved' | 'denied' | 'always_allow') =>
    request<CyberApproval>(`/approvals/${encodeURIComponent(id)}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),

  listRules: (engagementId?: string) =>
    request<{ data: CyberInterceptRule[] }>(`/intercept/rules${qs({ engagementId })}`).then(
      (r) => r.data ?? [],
    ),

  createRule: (input: {
    engagementId?: string
    name: string
    matchHost?: string
    matchPath?: string
    action?: CyberRuleAction
  }) =>
    request<CyberInterceptRule>('/intercept/rules', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  deleteRule: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/intercept/rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  attackMatrix: (engagementId?: string) =>
    request<CyberAttackMatrix>(`/attack${qs({ engagementId })}`),

  courseOfAction: (engagementId?: string) =>
    request<{ data: CyberCoaItem[] }>(`/coa${qs({ engagementId })}`).then((r) => r.data ?? []),

  hardening: (engagementId?: string) =>
    request<CyberHardening>(`/hardening${qs({ engagementId })}`),
}
