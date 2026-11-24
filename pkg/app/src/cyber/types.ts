/**
 * Wire types, route helpers, and deterministic helpers for Hanzo Cyber (`/cyber`).
 *
 * All data is served natively by Hanzo Cloud at `/v1/cyber/*` using the reader's
 * standard Hanzo IAM (`hanzo.id`) bearer session and active organization.
 */

export const CYBER_TABS = [
  'overview',
  'graph',
  'findings',
  'approvals',
  'traffic',
  'attack',
  'coa',
  'hardening',
] as const

export type CyberTab = (typeof CYBER_TABS)[number]

export const CYBER_TAB_LABELS: Readonly<Record<CyberTab, string>> = {
  overview: 'Overview',
  graph: 'Mission Graph',
  findings: 'Findings',
  approvals: 'Kai Approvals',
  traffic: 'Traffic',
  attack: 'ATT&CK',
  coa: 'Course of Action',
  hardening: 'Hardening',
}

export function parseCyberTab(pathname: string, search = ''): CyberTab {
  const clean = (pathname.split(/[?#]/)[0] || '').replace(/\/+$/, '')
  const rest = clean.startsWith('/cyber/') ? clean.slice('/cyber/'.length) : ''
  const seg = rest.split('/')[0]?.trim().toLowerCase() ?? ''
  if ((CYBER_TABS as readonly string[]).includes(seg)) {
    return seg as CyberTab
  }
  if (search) {
    const qs = search.startsWith('?') ? search.slice(1) : search
    const tabParam = new URLSearchParams(qs).get('tab')?.trim().toLowerCase() ?? ''
    if ((CYBER_TABS as readonly string[]).includes(tabParam)) {
      return tabParam as CyberTab
    }
  }
  return 'overview'
}

export function cyberPath(tab: CyberTab = 'overview'): string {
  return tab === 'overview' ? '/cyber' : `/cyber/${tab}`
}

export type CyberSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type CyberFindingStatus = 'open' | 'verified' | 'remediated' | 'false_positive'
export type CyberNodeKind = 'goal' | 'intent' | 'finding' | 'hint' | 'action'
export type CyberApprovalStatus = 'pending' | 'approved' | 'denied' | 'always_allow'
export type CyberRuleAction = 'allow' | 'block' | 'require_approval' | 'tag'

export interface CyberDashboard {
  org: string
  stage: string
  engagements: number
  tasks: number
  findingsTotal: number
  findingsVerified: number
  critical: number
  high: number
  medium: number
  low: number
  pendingApprovals: number
  trafficCount: number
  rulesCount: number
  verificationRate: number
}

export interface CyberEngagement {
  id: string
  name: string
  target: string
  scope: string[]
  mode: string
  status: string
  synthetic: boolean
  createdAt: number
  updatedAt: number
}

export interface CyberTask {
  id: string
  engagementId: string
  title: string
  goal: string
  status: string
  phase: string
  createdAt: number
  updatedAt: number
}

export interface CyberGraphNode {
  id: string
  taskId: string
  kind: CyberNodeKind
  label: string
  detail: string
  status: string
  severity?: string
  parentId?: string
  createdAt: number
}

export interface CyberTaskGraph {
  task: CyberTask
  nodes: CyberGraphNode[]
}

export interface CyberFinding {
  id: string
  engagementId: string
  taskId?: string
  title: string
  severity: CyberSeverity
  category: string
  cwe?: string
  mitreTechnique?: string
  mitreTactic?: string
  status: CyberFindingStatus
  target: string
  evidenceQuote?: string
  trafficId?: string
  verified: boolean
  verificationNote?: string
  remediation?: string
  createdAt: number
  updatedAt: number
}

export interface CyberTrafficRecord {
  id: string
  engagementId: string
  taskId?: string
  method: string
  url: string
  host: string
  statusCode: number
  requestHeaders: string
  requestBody: string
  responseHeaders: string
  responseBody: string
  latencyMs: number
  createdAt: number
}

export interface CyberApproval {
  id: string
  engagementId: string
  taskId?: string
  action: string
  target: string
  tool: string
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  kaiRationale: string
  status: CyberApprovalStatus
  decidedBy?: string
  decidedAt?: number
  createdAt: number
}

export interface CyberInterceptRule {
  id: string
  engagementId?: string
  name: string
  matchHost: string
  matchPath: string
  action: CyberRuleAction
  enabled: boolean
  createdAt: number
}

export interface CyberAttackTechnique {
  techniqueId: string
  tactic: string
  name: string
  findingCount: number
  verifiedCount: number
  maxSeverity: string
}

export interface CyberAttackMatrix {
  tactics: string[]
  techniques: CyberAttackTechnique[]
}

export interface CyberCoaItem {
  id: string
  title: string
  priority: string
  riskReduction: number
  effort: string
  mitreTechnique?: string
  findingIds: string[]
  summary: string
}

export interface CyberHardeningCheck {
  id: string
  control: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

export interface CyberHardening {
  score: number
  scopeEnforced: boolean
  verbatimVerified: number
  openCritical: number
  checks: CyberHardeningCheck[]
}

export interface CyberSeedDemoResponse {
  engagement: CyberEngagement
  tasks: number
  findings: number
  traffic: number
  approvals: number
  rules: number
}

export function severityOrder(s: string): number {
  switch (s.toLowerCase()) {
    case 'critical':
      return 5
    case 'high':
      return 4
    case 'medium':
      return 3
    case 'low':
      return 2
    default:
      return 1
  }
}

export function formatTime(ms: number): string {
  if (!ms) return '—'
  try {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return String(ms)
  }
}
