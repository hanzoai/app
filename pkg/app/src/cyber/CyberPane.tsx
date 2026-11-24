'use client'

/**
 * Hanzo Cyber — Native TypeScript `@hanzo/gui` autonomous cyber operations console.
 *
 * Backed entirely by Hanzo Cloud (`/v1/cyber/*`) and secured by Hanzo IAM (`hanzo.id`)
 * plus the `beta.cyber` alpha flag (auto-enabled for Hanzo orgs and SuperAdmins).
 * Zero Python control backend; zero iframes; strictly monochrome `@hanzo/gui` + `@hanzo/ui`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Input, XStack, YStack } from '@hanzo/gui'
import { Button, Text } from '@hanzo/ui'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  FlaskConical,
  GitFork,
  ListChecks,
  Lock,
  Plus,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useBetas } from '../Betas'
import { org as currentOrg } from '../lib/session'
import { CyberApiError, cyberApi } from './api'
import { CyberGraph } from './CyberGraph'
import {
  CYBER_TABS,
  CYBER_TAB_LABELS,
  cyberPath,
  formatTime,
  parseCyberTab,
  severityOrder,
  type CyberApproval,
  type CyberAttackMatrix,
  type CyberCoaItem,
  type CyberDashboard,
  type CyberEngagement,
  type CyberFinding,
  type CyberGraphNode,
  type CyberHardening,
  type CyberInterceptRule,
  type CyberNodeKind,
  type CyberRuleAction,
  type CyberSeverity,
  type CyberTab,
  type CyberTask,
  type CyberTaskGraph,
  type CyberTrafficRecord,
} from './types'

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <YStack
      flex={1}
      minW={148}
      p="$3"
      rounded="$3"
      borderWidth={1}
      borderColor="$edge"
      bg="var(--card)"
      gap="$1"
    >
      <Text fontSize="$1" fontFamily="$mono" color="$soft" textTransform="uppercase">
        {label}
      </Text>
      <Text fontSize="$6" fontWeight="600" color="$ink" fontFamily="$mono">
        {value}
      </Text>
      {sub ? (
        <Text fontSize="$1" color="$soft" numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </YStack>
  )
}

function Pill({ label, strong = false }: { label: string; strong?: boolean }) {
  return (
    <XStack
      px="$2"
      py="$0.5"
      rounded="$2"
      borderWidth={1}
      borderColor={strong ? '$ink' : '$edge'}
      bg={strong ? '$raised' : 'var(--card)'}
      items="center"
      shrink={0}
    >
      <Text fontSize="$1" fontFamily="$mono" fontWeight={strong ? '600' : '500'} color={strong ? '$ink' : '$soft'}>
        {label}
      </Text>
    </XStack>
  )
}

export function CyberPane({
  path = '/cyber',
  onNavigate,
}: {
  path?: string
  onNavigate?: (to: string) => void
}) {
  const { open: betaOpen } = useBetas()
  const activeTab = useMemo<CyberTab>(
    () => parseCyberTab(path, typeof window !== 'undefined' ? window.location.search : ''),
    [path],
  )
  const alphaAllowed = betaOpen('cyber')

  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  const [dashboard, setDashboard] = useState<CyberDashboard | null>(null)
  const [engagements, setEngagements] = useState<CyberEngagement[]>([])
  const [selectedEngId, setSelectedEngId] = useState<string>('')
  const [tasks, setTasks] = useState<CyberTask[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [graph, setGraph] = useState<CyberTaskGraph | null>(null)
  const [selectedNode, setSelectedNode] = useState<CyberGraphNode | null>(null)

  const [findings, setFindings] = useState<CyberFinding[]>([])
  const [severityFilter, setSeverityFilter] = useState<string>('')
  const [selectedFindingId, setSelectedFindingId] = useState<string>('')

  const [traffic, setTraffic] = useState<CyberTrafficRecord[]>([])
  const [selectedTrafficId, setSelectedTrafficId] = useState<string>('')

  const [approvals, setApprovals] = useState<CyberApproval[]>([])
  const [rules, setRules] = useState<CyberInterceptRule[]>([])
  const [attack, setAttack] = useState<CyberAttackMatrix | null>(null)
  const [coa, setCoa] = useState<CyberCoaItem[]>([])
  const [hardening, setHardening] = useState<CyberHardening | null>(null)

  // Creation forms
  const [showNewEng, setShowNewEng] = useState(false)
  const [newEngName, setNewEngName] = useState('')
  const [newEngTarget, setNewEngTarget] = useState('')
  const [newEngScope, setNewEngScope] = useState('')

  const [newNodeKind, setNewNodeKind] = useState<CyberNodeKind>('hint')
  const [newNodeLabel, setNewNodeLabel] = useState('')
  const [newNodeDetail, setNewNodeDetail] = useState('')

  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleHost, setNewRuleHost] = useState('*.mdtf.test')
  const [newRulePath, setNewRulePath] = useState('/*')
  const [newRuleAction, setNewRuleAction] = useState<CyberRuleAction>('require_approval')

  const [showNewFinding, setShowNewFinding] = useState(false)
  const [newFindingTitle, setNewFindingTitle] = useState('')
  const [newFindingSeverity, setNewFindingSeverity] = useState<CyberSeverity>('high')
  const [newFindingTarget, setNewFindingTarget] = useState('')
  const [newFindingQuote, setNewFindingQuote] = useState('')

  const refresh = useCallback(
    async (engOverride?: string) => {
      if (!alphaAllowed) return
      setLoading(true)
      setError(null)
      setForbidden(false)
      try {
        const engList = await cyberApi.listEngagements()
        setEngagements(engList)
        const activeEng =
          engOverride !== undefined
            ? engOverride
            : selectedEngId && engList.some((e) => e.id === selectedEngId)
              ? selectedEngId
              : engList[0]?.id ?? ''
        if (activeEng !== selectedEngId) {
          setSelectedEngId(activeEng)
        }
        const [dash, tsks, fnds, trfs, aprs, rls, atk, coaList, hard] = await Promise.all([
          cyberApi.dashboard(activeEng || undefined),
          cyberApi.listTasks(activeEng || undefined),
          cyberApi.listFindings({ engagementId: activeEng || undefined }),
          cyberApi.listTraffic({ engagementId: activeEng || undefined }),
          cyberApi.listApprovals({ engagementId: activeEng || undefined }),
          cyberApi.listRules(activeEng || undefined),
          cyberApi.attackMatrix(activeEng || undefined),
          cyberApi.courseOfAction(activeEng || undefined),
          cyberApi.hardening(activeEng || undefined),
        ])
        setDashboard(dash)
        setTasks(tsks)
        setFindings(fnds)
        setTraffic(trfs)
        setApprovals(aprs)
        setRules(rls)
        setAttack(atk)
        setCoa(coaList)
        setHardening(hard)

        const tId = selectedTaskId && tsks.some((t) => t.id === selectedTaskId) ? selectedTaskId : tsks[0]?.id ?? ''
        setSelectedTaskId(tId)
        if (tId) {
          const g = await cyberApi.getTaskGraph(tId)
          setGraph(g)
          setSelectedNode((prev) => (prev && g.nodes.some((n) => n.id === prev.id) ? prev : g.nodes[0] ?? null))
        } else {
          setGraph(null)
          setSelectedNode(null)
        }
        if (fnds.length > 0 && !fnds.some((f) => f.id === selectedFindingId)) {
          setSelectedFindingId(fnds[0]!.id)
        }
        if (trfs.length > 0 && !trfs.some((tr) => tr.id === selectedTrafficId)) {
          setSelectedTrafficId(trfs[0]!.id)
        }
      } catch (err) {
        if (err instanceof CyberApiError && (err.status === 401 || err.status === 403)) {
          setForbidden(true)
          setError(err.message)
        } else {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        setLoading(false)
      }
    },
    [alphaAllowed, selectedEngId, selectedTaskId, selectedFindingId, selectedTrafficId],
  )

  useEffect(() => {
    void refresh()
  }, [alphaAllowed]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onNew = () => setShowNewEng(true)
    window.addEventListener('hanzo:cyber-new-engagement', onNew)
    return () => window.removeEventListener('hanzo:cyber-new-engagement', onNew)
  }, [])

  const switchEngagement = async (engId: string) => {
    setSelectedEngId(engId)
    await refresh(engId)
  }

  const selectTask = async (taskId: string) => {
    setSelectedTaskId(taskId)
    try {
      const g = await cyberApi.getTaskGraph(taskId)
      setGraph(g)
      setSelectedNode(g.nodes[0] ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSeedDemo = async () => {
    setBusy('seed')
    setError(null)
    try {
      const res = await cyberApi.seedDemo()
      await refresh(res.engagement.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleCreateEngagement = async () => {
    if (!newEngName.trim() || !newEngTarget.trim()) return
    setBusy('create-eng')
    setError(null)
    try {
      const scope = newEngScope
        .split(/[,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      const created = await cyberApi.createEngagement({
        name: newEngName.trim(),
        target: newEngTarget.trim(),
        scope: scope.length > 0 ? scope : [newEngTarget.trim()],
      })
      setNewEngName('')
      setNewEngTarget('')
      setNewEngScope('')
      setShowNewEng(false)
      await refresh(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleAddNode = async () => {
    if (!selectedTaskId || !newNodeLabel.trim()) return
    setBusy('add-node')
    setError(null)
    try {
      await cyberApi.addGraphNode(selectedTaskId, {
        kind: newNodeKind,
        label: newNodeLabel.trim(),
        detail: newNodeDetail.trim(),
        parentId: selectedNode?.id,
      })
      setNewNodeLabel('')
      setNewNodeDetail('')
      await selectTask(selectedTaskId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleCreateFinding = async () => {
    if (!selectedEngId || !newFindingTitle.trim()) return
    setBusy('create-finding')
    setError(null)
    try {
      const created = await cyberApi.createFinding({
        engagementId: selectedEngId,
        taskId: selectedTaskId || undefined,
        title: newFindingTitle.trim(),
        severity: newFindingSeverity,
        target: newFindingTarget.trim() || engagements.find((e) => e.id === selectedEngId)?.target || '',
        evidenceQuote: newFindingQuote.trim() || undefined,
        trafficId: traffic[0]?.id,
      })
      setNewFindingTitle('')
      setNewFindingTarget('')
      setNewFindingQuote('')
      setShowNewFinding(false)
      setSelectedFindingId(created.id)
      await refresh(selectedEngId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleVerifyFinding = async (finding: CyberFinding) => {
    setBusy(`verify-${finding.id}`)
    setError(null)
    try {
      await cyberApi.verifyFinding(finding.id)
      await refresh(selectedEngId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleDecideApproval = async (id: string, decision: 'approved' | 'denied' | 'always_allow') => {
    setBusy(`decide-${id}`)
    setError(null)
    try {
      await cyberApi.decideApproval(id, decision)
      await refresh(selectedEngId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleCreateRule = async () => {
    if (!newRuleName.trim()) return
    setBusy('create-rule')
    setError(null)
    try {
      await cyberApi.createRule({
        engagementId: selectedEngId || undefined,
        name: newRuleName.trim(),
        matchHost: newRuleHost.trim() || '*',
        matchPath: newRulePath.trim() || '/*',
        action: newRuleAction,
      })
      setNewRuleName('')
      await refresh(selectedEngId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleDeleteRule = async (id: string) => {
    setBusy(`del-rule-${id}`)
    setError(null)
    try {
      await cyberApi.deleteRule(id)
      await refresh(selectedEngId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const filteredFindings = useMemo(() => {
    const list = severityFilter
      ? findings.filter((f) => f.severity === severityFilter)
      : findings
    return [...list].sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity))
  }, [findings, severityFilter])

  const selectedFinding = useMemo(
    () => filteredFindings.find((f) => f.id === selectedFindingId) ?? filteredFindings[0] ?? null,
    [filteredFindings, selectedFindingId],
  )

  const boundTraffic = useMemo(
    () => (selectedFinding?.trafficId ? traffic.find((t) => t.id === selectedFinding.trafficId) ?? null : null),
    [selectedFinding, traffic],
  )

  const selectedTraffic = useMemo(
    () => traffic.find((t) => t.id === selectedTrafficId) ?? traffic[0] ?? null,
    [traffic, selectedTrafficId],
  )

  const goTab = (tab: CyberTab) => {
    if (onNavigate) onNavigate(cyberPath(tab))
  }

  if (!alphaAllowed || forbidden) {
    return (
      <YStack
        data-slot="cyber-alpha-gate"
        flex={1}
        height="100%"
        items="center"
        justify="center"
        p="$6"
        gap="$4"
        bg="$background"
      >
        <XStack items="center" gap="$2">
          <Shield size={22} aria-hidden />
          <Text fontSize="$6" fontWeight="600" color="$ink">
            Hanzo Cyber
          </Text>
          <Pill label="ALPHA" strong />
        </XStack>
        <Text fontSize="$3" color="$soft" maxW={460} text="center">
          Hanzo Cyber is currently in private alpha for Hanzo internal organizations and authorized security
          evaluators (`beta.cyber`). Sign in with a Hanzo organization account or request alpha access via your
          administrator.
        </Text>
        <XStack gap="$2">
          <Button size="sm" variant="outline" onClick={() => onNavigate?.('/beta')}>
            View Betas & Access
          </Button>
          <Button size="sm" onClick={() => onNavigate?.('/chat')}>
            Back to Workspace
          </Button>
        </XStack>
      </YStack>
    )
  }

  const activeEngagement = engagements.find((e) => e.id === selectedEngId) ?? null

  return (
    <YStack data-slot="cyber-pane" flex={1} minH={0} height="100%" bg="$background">
      {/* Header Bar */}
      <XStack
        data-slot="cyber-header"
        items="center"
        justify="space-between"
        px="$4"
        py="$3"
        borderBottomWidth={1}
        borderColor="$edge"
        gap="$3"
        flexWrap="wrap"
      >
        <XStack items="center" gap="$2.5" flexWrap="wrap">
          <Shield size={18} aria-hidden />
          <Text fontSize="$4" fontWeight="600" color="$ink">
            Hanzo Cyber
          </Text>
          <Pill label="ALPHA" strong />
          <Pill label={`ORG: ${dashboard?.org ?? currentOrg() ?? 'hanzo'}`} />
          {activeEngagement ? (
            <Pill label={activeEngagement.synthetic ? `${activeEngagement.name} · SYNTHETIC` : activeEngagement.name} />
          ) : null}
        </XStack>

        <XStack items="center" gap="$2" flexWrap="wrap">
          {engagements.length > 1 ? (
            <XStack items="center" gap="$1" flexWrap="wrap">
              {engagements.map((eng) => (
                <Button
                  key={eng.id}
                  size="sm"
                  variant={eng.id === selectedEngId ? 'default' : 'outline'}
                  onClick={() => void switchEngagement(eng.id)}
                >
                  {eng.name}
                </Button>
              ))}
            </XStack>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => setShowNewEng((v) => !v)}>
            <Plus size={14} aria-hidden />
            New Engagement
          </Button>
          <Button size="sm" variant="outline" disabled={busy === 'seed'} onClick={() => void handleSeedDemo()}>
            <FlaskConical size={14} aria-hidden />
            {busy === 'seed' ? 'Seeding…' : 'Seed MDTF Lab'}
          </Button>
          <Button size="sm" variant="ghost" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw size={14} aria-hidden />
          </Button>
        </XStack>
      </XStack>

      {/* Sub-navigation Strip */}
      <XStack
        data-slot="cyber-tabs"
        px="$4"
        py="$2"
        gap="$1.5"
        borderBottomWidth={1}
        borderColor="$edge"
        overflowX="auto"
        shrink={0}
      >
        {CYBER_TABS.map((tab) => {
          const active = tab === activeTab
          const badge =
            tab === 'findings' && dashboard?.findingsTotal
              ? ` (${dashboard.findingsTotal})`
              : tab === 'approvals' && dashboard?.pendingApprovals
                ? ` (${dashboard.pendingApprovals})`
                : ''
          return (
            <XStack
              key={tab}
              render="button"
              data-slot={`cyber-tab-${tab}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => goTab(tab)}
              px="$2.5"
              py="$1.5"
              rounded="$2"
              bg={active ? '$raised' : 'transparent'}
              hoverStyle={{ bg: active ? '$raised' : '$hover' }}
              cursor="pointer"
              shrink={0}
            >
              <Text fontSize="$2" fontWeight={active ? '600' : '500'} color={active ? '$ink' : '$soft'}>
                {CYBER_TAB_LABELS[tab]}
                {badge}
              </Text>
            </XStack>
          )
        })}
      </XStack>

      {/* Main Scroll Area */}
      <YStack flex={1} minH={0} overflowY="auto" p="$4" gap="$4">
        {error ? (
          <XStack p="$3" rounded="$3" borderWidth={1} borderColor="$edge" bg="$raised" justify="space-between" items="center">
            <Text fontSize="$2" color="$ink" fontFamily="$mono">
              {error}
            </Text>
            <Button size="sm" variant="ghost" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </XStack>
        ) : null}

        {showNewEng ? (
          <YStack p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$2.5">
            <Text fontSize="$3" fontWeight="600" color="$ink">
              Create Authorized Engagement
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              <Input
                flex={1}
                minW={200}
                placeholder="Engagement name (e.g. Tactical C2 Enclave)"
                value={newEngName}
                onChangeText={setNewEngName}
              />
              <Input
                flex={1}
                minW={200}
                placeholder="Primary target host (e.g. enclave.example.test)"
                value={newEngTarget}
                onChangeText={setNewEngTarget}
              />
              <Input
                flex={1}
                minW={220}
                placeholder="Authorized scope hosts (comma-separated)"
                value={newEngScope}
                onChangeText={setNewEngScope}
              />
            </XStack>
            <XStack gap="$2">
              <Button size="sm" disabled={busy === 'create-eng'} onClick={() => void handleCreateEngagement()}>
                Create Engagement
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewEng(false)}>
                Cancel
              </Button>
            </XStack>
          </YStack>
        ) : null}

        {/* Empty Onboarding State */}
        {!loading && engagements.length === 0 ? (
          <YStack p="$6" rounded="$4" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$3" items="flex-start">
            <XStack items="center" gap="$2">
              <ShieldCheck size={18} aria-hidden />
              <Text fontSize="$4" fontWeight="600" color="$ink">
                No cyber engagements yet in this organization
              </Text>
            </XStack>
            <Text fontSize="$3" color="$soft" maxW={640}>
              Create an authorized engagement with explicit Rules of Engagement scope, or load the synthetic MDTF
              Tactical Enclave lab dataset to test verbatim proof verification, reasoning graphs, and Kai risk gates.
            </Text>
            <XStack gap="$2">
              <Button size="sm" disabled={busy === 'seed'} onClick={() => void handleSeedDemo()}>
                <FlaskConical size={14} aria-hidden />
                Load Synthetic MDTF Lab Demo
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewEng(true)}>
                <Plus size={14} aria-hidden />
                Create Engagement
              </Button>
            </XStack>
          </YStack>
        ) : null}

        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && engagements.length > 0 ? (
          <YStack gap="$4">
            <XStack gap="$3" flexWrap="wrap">
              <MetricCard label="Engagements" value={dashboard?.engagements ?? engagements.length} sub={activeEngagement?.mode ?? 'enclave'} />
              <MetricCard
                label="Findings"
                value={dashboard?.findingsTotal ?? findings.length}
                sub={`${dashboard?.critical ?? 0} crit · ${dashboard?.high ?? 0} high · ${dashboard?.medium ?? 0} med`}
              />
              <MetricCard
                label="Verbatim Verified"
                value={`${dashboard?.verificationRate ?? 0}%`}
                sub={`${dashboard?.findingsVerified ?? 0}/${dashboard?.findingsTotal ?? 0} bound to HTTP proof`}
              />
              <MetricCard
                label="Pending Kai Gates"
                value={dashboard?.pendingApprovals ?? 0}
                sub={`${dashboard?.rulesCount ?? rules.length} scope rules active`}
              />
              <MetricCard label="Captured Traffic" value={dashboard?.trafficCount ?? traffic.length} sub="HTTP proof corpus" />
            </XStack>

            <XStack gap="$4" flexWrap="wrap" items="flex-start">
              <YStack flex={1} minW={300} p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$2.5">
                <XStack justify="space-between" items="center">
                  <XStack items="center" gap="$2">
                    <AlertTriangle size={15} aria-hidden />
                    <Text fontSize="$3" fontWeight="600" color="$ink">
                      Priority Findings
                    </Text>
                  </XStack>
                  <Button size="sm" variant="ghost" onClick={() => goTab('findings')}>
                    All findings
                  </Button>
                </XStack>
                {filteredFindings.slice(0, 5).map((f) => (
                  <XStack
                    key={f.id}
                    render="button"
                    onClick={() => {
                      setSelectedFindingId(f.id)
                      goTab('findings')
                    }}
                    p="$2.5"
                    rounded="$2"
                    borderWidth={1}
                    borderColor="$edge"
                    bg="$background"
                    hoverStyle={{ bg: '$hover' }}
                    justify="space-between"
                    items="center"
                    gap="$2"
                    cursor="pointer"
                  >
                    <YStack flex={1} minW={0} gap="$0.5">
                      <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1}>
                        {f.title}
                      </Text>
                      <Text fontSize="$1" fontFamily="$mono" color="$soft" numberOfLines={1}>
                        {f.target} · {f.mitreTechnique || f.cwe || f.category}
                      </Text>
                    </YStack>
                    <XStack gap="$1.5" items="center" shrink={0}>
                      <Pill label={f.severity.toUpperCase()} strong={f.severity === 'critical'} />
                      <Pill label={f.verified ? 'VERIFIED' : 'UNVERIFIED'} strong={f.verified} />
                    </XStack>
                  </XStack>
                ))}
              </YStack>

              <YStack flex={1} minW={300} p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$2.5">
                <XStack justify="space-between" items="center">
                  <XStack items="center" gap="$2">
                    <ShieldAlert size={15} aria-hidden />
                    <Text fontSize="$3" fontWeight="600" color="$ink">
                      Kai Risk Gate Queue
                    </Text>
                  </XStack>
                  <Button size="sm" variant="ghost" onClick={() => goTab('approvals')}>
                    Manage gates
                  </Button>
                </XStack>
                {approvals.slice(0, 4).map((a) => (
                  <YStack key={a.id} p="$2.5" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background" gap="$1.5">
                    <XStack justify="space-between" items="center" gap="$2">
                      <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1} flex={1}>
                        {a.action}
                      </Text>
                      <Pill label={`RISK ${a.riskScore}/100`} strong={a.riskScore >= 65} />
                    </XStack>
                    <Text fontSize="$1" fontFamily="$mono" color="$soft" numberOfLines={2}>
                      {a.target} · {a.tool} · {a.status.toUpperCase()}
                    </Text>
                    {a.status === 'pending' ? (
                      <XStack gap="$2" pt="$1">
                        <Button size="sm" onClick={() => void handleDecideApproval(a.id, 'approved')}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleDecideApproval(a.id, 'denied')}>
                          Deny
                        </Button>
                      </XStack>
                    ) : null}
                  </YStack>
                ))}
              </YStack>
            </XStack>
          </YStack>
        ) : null}

        {/* TAB: MISSION GRAPH */}
        {activeTab === 'graph' && engagements.length > 0 ? (
          <YStack gap="$3">
            <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
              <XStack items="center" gap="$2">
                <GitFork size={16} aria-hidden />
                <Text fontSize="$3" fontWeight="600" color="$ink">
                  Autonomous Reasoning Graph (GOAL → INTENT → FINDING → KAI GATE)
                </Text>
              </XStack>
              {tasks.length > 0 ? (
                <XStack items="center" gap="$1.5" flexWrap="wrap">
                  {tasks.map((t) => (
                    <Button
                      key={t.id}
                      size="sm"
                      variant={t.id === selectedTaskId ? 'default' : 'outline'}
                      onClick={() => void selectTask(t.id)}
                    >
                      {t.title}
                    </Button>
                  ))}
                </XStack>
              ) : null}
            </XStack>

            <CyberGraph
              nodes={graph?.nodes ?? []}
              selectedId={selectedNode?.id ?? null}
              onSelect={setSelectedNode}
            />

            <XStack gap="$3" flexWrap="wrap" items="flex-start">
              <YStack flex={1} minW={280} p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$1.5">
                <Text fontSize="$2" fontFamily="$mono" color="$soft">
                  Node inspector
                </Text>
                {selectedNode ? (
                  <>
                    <XStack items="center" gap="$2">
                      <Pill label={selectedNode.kind} strong />
                      <Pill label={selectedNode.status} />
                      {selectedNode.severity ? <Pill label={selectedNode.severity} strong /> : null}
                    </XStack>
                    <Text fontSize="$3" fontWeight="600" color="$ink">
                      {selectedNode.label}
                    </Text>
                    <Text fontSize="$2" color="$soft">
                      {selectedNode.detail || 'No additional detail.'}
                    </Text>
                  </>
                ) : (
                  <Text fontSize="$2" color="$soft">
                    Select any node in the graph to inspect its reasoning trace.
                  </Text>
                )}
              </YStack>

              <YStack flex={1} minW={280} p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$2">
                <Text fontSize="$2" fontFamily="$mono" color="$soft">
                  Inject operator hint or intent
                </Text>
                <XStack gap="$2">
                  {(['intent', 'hint', 'action'] as const).map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant={newNodeKind === k ? 'default' : 'outline'}
                      onClick={() => setNewNodeKind(k)}
                    >
                      {k.toUpperCase()}
                    </Button>
                  ))}
                </XStack>
                <Input placeholder="Node label" value={newNodeLabel} onChangeText={setNewNodeLabel} />
                <Input placeholder="Operator guidance or hypothesis detail" value={newNodeDetail} onChangeText={setNewNodeDetail} />
                <Button size="sm" disabled={busy === 'add-node' || !selectedTaskId} onClick={() => void handleAddNode()}>
                  Append to Selected Node
                </Button>
              </YStack>
            </XStack>
          </YStack>
        ) : null}

        {/* TAB: FINDINGS + VERBATIM PROOF VERIFICATION */}
        {activeTab === 'findings' && engagements.length > 0 ? (
          <YStack gap="$3">
            <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
              <XStack gap="$1.5" flexWrap="wrap">
                {['', 'critical', 'high', 'medium', 'low'].map((sev) => (
                  <Button
                    key={sev || 'all'}
                    size="sm"
                    variant={severityFilter === sev ? 'default' : 'outline'}
                    onClick={() => setSeverityFilter(sev)}
                  >
                    {sev ? sev.toUpperCase() : 'ALL'}
                  </Button>
                ))}
              </XStack>
              <Button size="sm" variant="outline" onClick={() => setShowNewFinding((v) => !v)}>
                <Plus size={14} aria-hidden />
                Record Finding
              </Button>
            </XStack>

            {showNewFinding ? (
              <YStack p="$3" rounded="$3" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$2">
                <XStack gap="$2" flexWrap="wrap">
                  <Input flex={2} minW={220} placeholder="Finding title" value={newFindingTitle} onChangeText={setNewFindingTitle} />
                  <XStack items="center" gap="$1">
                    {(['critical', 'high', 'medium', 'low'] as const).map((sev) => (
                      <Button
                        key={sev}
                        size="sm"
                        variant={newFindingSeverity === sev ? 'default' : 'outline'}
                        onClick={() => setNewFindingSeverity(sev)}
                      >
                        {sev}
                      </Button>
                    ))}
                  </XStack>
                </XStack>
                <XStack gap="$2" flexWrap="wrap">
                  <Input flex={1} minW={200} placeholder="Affected endpoint URL" value={newFindingTarget} onChangeText={setNewFindingTarget} />
                  <Input flex={1} minW={220} placeholder="Exact verbatim quote from HTTP response" value={newFindingQuote} onChangeText={setNewFindingQuote} />
                </XStack>
                <XStack gap="$2">
                  <Button size="sm" disabled={busy === 'create-finding'} onClick={() => void handleCreateFinding()}>
                    Save Finding
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowNewFinding(false)}>
                    Cancel
                  </Button>
                </XStack>
              </YStack>
            ) : null}

            <XStack gap="$3" flexWrap="wrap" items="flex-start">
              <YStack flex={1} minW={300} gap="$2">
                {filteredFindings.map((f) => {
                  const active = selectedFinding?.id === f.id
                  return (
                    <YStack
                      key={f.id}
                      render="button"
                      onClick={() => setSelectedFindingId(f.id)}
                      p="$3"
                      rounded="$3"
                      borderWidth={1}
                      borderColor={active ? '$ink' : '$edge'}
                      bg={active ? '$raised' : 'var(--card)'}
                      hoverStyle={{ bg: '$hover' }}
                      gap="$1.5"
                      cursor="pointer"
                    >
                      <XStack justify="space-between" items="center" width="100%" gap="$2">
                        <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1} flex={1}>
                          {f.title}
                        </Text>
                        <Pill label={f.severity.toUpperCase()} strong={f.severity === 'critical'} />
                      </XStack>
                      <XStack items="center" gap="$2" flexWrap="wrap">
                        <Pill label={f.verified ? 'VERBATIM VERIFIED' : 'UNVERIFIED'} strong={f.verified} />
                        {f.cwe ? <Pill label={f.cwe} /> : null}
                        {f.mitreTechnique ? <Pill label={f.mitreTechnique} /> : null}
                      </XStack>
                    </YStack>
                  )
                })}
              </YStack>

              {selectedFinding ? (
                <YStack flex={1.3} minW={340} p="$4" rounded="$3" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$3">
                  <XStack justify="space-between" items="flex-start" gap="$2">
                    <YStack gap="$1" flex={1}>
                      <Text fontSize="$4" fontWeight="600" color="$ink">
                        {selectedFinding.title}
                      </Text>
                      <Text fontSize="$2" fontFamily="$mono" color="$soft">
                        {selectedFinding.target}
                      </Text>
                    </YStack>
                    <Button
                      size="sm"
                      disabled={busy === `verify-${selectedFinding.id}` || !selectedFinding.trafficId}
                      onClick={() => void handleVerifyFinding(selectedFinding)}
                    >
                      <CheckCircle2 size={14} aria-hidden />
                      {busy === `verify-${selectedFinding.id}` ? 'Verifying…' : 'Verify Proof'}
                    </Button>
                  </XStack>

                  <XStack gap="$2" flexWrap="wrap">
                    <Pill label={selectedFinding.severity.toUpperCase()} strong />
                    <Pill label={selectedFinding.status.toUpperCase()} />
                    {selectedFinding.cwe ? <Pill label={selectedFinding.cwe} /> : null}
                    {selectedFinding.mitreTechnique ? (
                      <Pill label={`${selectedFinding.mitreTechnique} · ${selectedFinding.mitreTactic ?? ''}`} />
                    ) : null}
                  </XStack>

                  <YStack p="$3" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background" gap="$1">
                    <Text fontSize="$1" fontFamily="$mono" color="$soft">
                      VERBATIM EVIDENCE QUOTE ({selectedFinding.verified ? 'CONFIRMED' : 'PENDING'})
                    </Text>
                    <Text fontSize="$2" fontFamily="$mono" color="$ink">
                      {selectedFinding.evidenceQuote || 'No quote bound'}
                    </Text>
                    {selectedFinding.verificationNote ? (
                      <Text fontSize="$1" color="$soft">
                        {selectedFinding.verificationNote}
                      </Text>
                    ) : null}
                  </YStack>

                  {boundTraffic ? (
                    <YStack p="$3" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background" gap="$1">
                      <Text fontSize="$1" fontFamily="$mono" color="$soft">
                        BOUND CAPTURED HTTP TRAFFIC · {boundTraffic.method} {boundTraffic.url} ({boundTraffic.statusCode})
                      </Text>
                      <Text fontSize="$1" fontFamily="$mono" color="$ink">
                        {boundTraffic.responseBody}
                      </Text>
                    </YStack>
                  ) : null}

                  <YStack gap="$1">
                    <Text fontSize="$1" fontFamily="$mono" color="$soft">
                      Remediation
                    </Text>
                    <Text fontSize="$2" color="$ink">
                      {selectedFinding.remediation || 'No remediation recorded yet.'}
                    </Text>
                  </YStack>
                </YStack>
              ) : null}
            </XStack>
          </YStack>
        ) : null}

        {/* TAB: KAI APPROVALS & INTERCEPT RULES */}
        {activeTab === 'approvals' && engagements.length > 0 ? (
          <YStack gap="$4">
            <YStack gap="$2">
              <XStack items="center" gap="$2">
                <ShieldCheck size={16} aria-hidden />
                <Text fontSize="$3" fontWeight="600" color="$ink">
                  Kai Risk-Gated Action Approvals
                </Text>
              </XStack>
              {approvals.map((a) => (
                <YStack key={a.id} p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$2">
                  <XStack justify="space-between" items="center" flexWrap="wrap" gap="$2">
                    <Text fontSize="$3" fontWeight="600" color="$ink">
                      {a.action}
                    </Text>
                    <XStack gap="$1.5">
                      <Pill label={`KAI RISK ${a.riskScore}/100 (${a.riskLevel.toUpperCase()})`} strong={a.riskScore >= 65} />
                      <Pill label={a.status.toUpperCase()} strong={a.status === 'pending'} />
                    </XStack>
                  </XStack>
                  <Text fontSize="$2" fontFamily="$mono" color="$soft">
                    Target: {a.target} · Tool: {a.tool}
                  </Text>
                  <Text fontSize="$2" color="$soft">
                    {a.kaiRationale}
                  </Text>
                  {a.status === 'pending' ? (
                    <XStack gap="$2" pt="$1">
                      <Button
                        size="sm"
                        disabled={busy === `decide-${a.id}`}
                        onClick={() => void handleDecideApproval(a.id, 'approved')}
                      >
                        Approve Once
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === `decide-${a.id}`}
                        onClick={() => void handleDecideApproval(a.id, 'always_allow')}
                      >
                        Always Allow Target
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === `decide-${a.id}`}
                        onClick={() => void handleDecideApproval(a.id, 'denied')}
                      >
                        Deny
                      </Button>
                    </XStack>
                  ) : (
                    <Text fontSize="$1" fontFamily="$mono" color="$soft">
                      Decided by {a.decidedBy || 'operator'} at {formatTime(a.decidedAt ?? 0)}
                    </Text>
                  )}
                </YStack>
              ))}
            </YStack>

            <YStack p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$3">
              <Text fontSize="$3" fontWeight="600" color="$ink">
                Rules of Engagement · Scope & Intercept Guardrails
              </Text>
              <XStack gap="$2" flexWrap="wrap">
                <Input flex={1.5} minW={180} placeholder="Rule name" value={newRuleName} onChangeText={setNewRuleName} />
                <Input flex={1} minW={140} placeholder="Match host" value={newRuleHost} onChangeText={setNewRuleHost} />
                <Input flex={1} minW={120} placeholder="Match path" value={newRulePath} onChangeText={setNewRulePath} />
                <XStack items="center" gap="$1" flexWrap="wrap">
                  {(
                    [
                      ['require_approval', 'Require approval'],
                      ['allow', 'Allow'],
                      ['block', 'Block'],
                      ['tag', 'Tag'],
                    ] as const
                  ).map(([val, label]) => (
                    <Button
                      key={val}
                      size="sm"
                      variant={newRuleAction === val ? 'default' : 'outline'}
                      onClick={() => setNewRuleAction(val)}
                    >
                      {label}
                    </Button>
                  ))}
                </XStack>
                <Button size="sm" disabled={busy === 'create-rule'} onClick={() => void handleCreateRule()}>
                  Add Rule
                </Button>
              </XStack>
              <YStack gap="$2">
                {rules.map((r) => (
                  <XStack
                    key={r.id}
                    p="$2.5"
                    rounded="$2"
                    borderWidth={1}
                    borderColor="$edge"
                    bg="$background"
                    justify="space-between"
                    items="center"
                    gap="$2"
                  >
                    <YStack flex={1} minW={0}>
                      <Text fontSize="$2" fontWeight="600" color="$ink">
                        {r.name}
                      </Text>
                      <Text fontSize="$1" fontFamily="$mono" color="$soft">
                        {r.matchHost} {r.matchPath}
                      </Text>
                    </YStack>
                    <XStack items="center" gap="$2">
                      <Pill label={r.action.toUpperCase()} strong={r.action === 'block' || r.action === 'require_approval'} />
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy === `del-rule-${r.id}`}
                        onClick={() => void handleDeleteRule(r.id)}
                      >
                        <Trash2 size={14} aria-hidden />
                      </Button>
                    </XStack>
                  </XStack>
                ))}
              </YStack>
            </YStack>
          </YStack>
        ) : null}

        {/* TAB: TRAFFIC INSPECTOR */}
        {activeTab === 'traffic' && engagements.length > 0 ? (
          <XStack gap="$3" flexWrap="wrap" items="flex-start">
            <YStack flex={1} minW={280} gap="$2">
              <XStack items="center" gap="$2">
                <Activity size={15} aria-hidden />
                <Text fontSize="$3" fontWeight="600" color="$ink">
                  Captured HTTP Exchanges ({traffic.length})
                </Text>
              </XStack>
              {traffic.map((tr) => {
                const active = selectedTraffic?.id === tr.id
                return (
                  <YStack
                    key={tr.id}
                    render="button"
                    onClick={() => setSelectedTrafficId(tr.id)}
                    p="$2.5"
                    rounded="$3"
                    borderWidth={1}
                    borderColor={active ? '$ink' : '$edge'}
                    bg={active ? '$raised' : 'var(--card)'}
                    hoverStyle={{ bg: '$hover' }}
                    gap="$1"
                    cursor="pointer"
                  >
                    <XStack justify="space-between" items="center" width="100%">
                      <Pill label={`${tr.method} · ${tr.statusCode}`} strong />
                      <Text fontSize="$1" fontFamily="$mono" color="$soft">
                        {tr.latencyMs}ms
                      </Text>
                    </XStack>
                    <Text fontSize="$2" fontFamily="$mono" color="$ink" numberOfLines={1}>
                      {tr.url}
                    </Text>
                  </YStack>
                )
              })}
            </YStack>

            {selectedTraffic ? (
              <YStack flex={1.5} minW={340} p="$4" rounded="$3" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$3">
                <Text fontSize="$3" fontWeight="600" fontFamily="$mono" color="$ink">
                  {selectedTraffic.method} {selectedTraffic.url}
                </Text>
                <YStack p="$3" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background" gap="$1">
                  <Text fontSize="$1" fontFamily="$mono" color="$soft">
                    Request
                  </Text>
                  <Text fontSize="$1" fontFamily="$mono" color="$ink">
                    {selectedTraffic.requestHeaders}
                    {selectedTraffic.requestBody ? `\n\n${selectedTraffic.requestBody}` : ''}
                  </Text>
                </YStack>
                <YStack p="$3" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background" gap="$1">
                  <Text fontSize="$1" fontFamily="$mono" color="$soft">
                    RESPONSE ({selectedTraffic.statusCode})
                  </Text>
                  <Text fontSize="$1" fontFamily="$mono" color="$ink">
                    {selectedTraffic.responseHeaders}
                    {selectedTraffic.responseBody ? `\n\n${selectedTraffic.responseBody}` : ''}
                  </Text>
                </YStack>
              </YStack>
            ) : null}
          </XStack>
        ) : null}

        {/* TAB: MITRE ATT&CK */}
        {activeTab === 'attack' && engagements.length > 0 ? (
          <YStack gap="$3">
            <XStack items="center" gap="$2">
              <Crosshair size={16} aria-hidden />
              <Text fontSize="$3" fontWeight="600" color="$ink">
                MITRE ATT&CK Technique Coverage
              </Text>
            </XStack>
            <XStack gap="$3" flexWrap="wrap">
              {(attack?.techniques ?? []).map((tech) => (
                <YStack key={tech.techniqueId} minW={240} flex={1} p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$1.5">
                  <XStack justify="space-between" items="center">
                    <Pill label={tech.techniqueId} strong />
                    <Pill label={tech.maxSeverity.toUpperCase()} />
                  </XStack>
                  <Text fontSize="$3" fontWeight="600" color="$ink">
                    {tech.name}
                  </Text>
                  <Text fontSize="$1" fontFamily="$mono" color="$soft">
                    Tactic: {tech.tactic} · {tech.verifiedCount}/{tech.findingCount} verified
                  </Text>
                </YStack>
              ))}
            </XStack>
          </YStack>
        ) : null}

        {/* TAB: COURSE OF ACTION */}
        {activeTab === 'coa' && engagements.length > 0 ? (
          <YStack gap="$3">
            <XStack items="center" gap="$2">
              <ListChecks size={16} aria-hidden />
              <Text fontSize="$3" fontWeight="600" color="$ink">
                Prioritized Courses of Action
              </Text>
            </XStack>
            {coa.map((item) => (
              <YStack key={item.id} p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$1.5">
                <XStack justify="space-between" items="center" flexWrap="wrap" gap="$2">
                  <Text fontSize="$3" fontWeight="600" color="$ink">
                    {item.title}
                  </Text>
                  <XStack gap="$1.5">
                    <Pill label={item.priority} strong={item.priority === 'P0'} />
                    <Pill label={`-${item.riskReduction}% RISK`} />
                    <Pill label={`EFFORT: ${item.effort.toUpperCase()}`} />
                  </XStack>
                </XStack>
                <Text fontSize="$2" color="$soft">
                  {item.summary}
                </Text>
              </YStack>
            ))}
          </YStack>
        ) : null}

        {/* TAB: HARDENING */}
        {activeTab === 'hardening' && engagements.length > 0 ? (
          <YStack gap="$3">
            <XStack items="center" justify="space-between">
              <XStack items="center" gap="$2">
                <Lock size={16} aria-hidden />
                <Text fontSize="$3" fontWeight="600" color="$ink">
                  Enclave Hardening & Governance Posture
                </Text>
              </XStack>
              <Pill label={`SCORE ${hardening?.score ?? 0}/100`} strong />
            </XStack>
            {(hardening?.checks ?? []).map((chk) => (
              <XStack
                key={chk.id}
                p="$3"
                rounded="$3"
                borderWidth={1}
                borderColor="$edge"
                bg="var(--card)"
                justify="space-between"
                items="center"
                gap="$3"
              >
                <YStack flex={1} gap="$0.5">
                  <Text fontSize="$3" fontWeight="600" color="$ink">
                    {chk.control}
                  </Text>
                  <Text fontSize="$2" color="$soft">
                    {chk.detail}
                  </Text>
                </YStack>
                <Pill label={chk.status.toUpperCase()} strong={chk.status !== 'pass'} />
              </XStack>
            ))}
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  )
}

export default CyberPane
