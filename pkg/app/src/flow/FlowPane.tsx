'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Switch, Text } from '@hanzo/ui'
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  History,
  LayoutTemplate,
  Loader2,
  Play,
  Plus,
  Save,
  Trash2,
  Workflow,
  X,
  XCircle,
} from 'lucide-react'
import type { Host } from '@hanzo/build'
import { useHost } from '../host'
import { go as navGo } from '../lib/host'
import { org as currentOrg } from '../lib/session'
import {
  executeFlow,
  persistFlow,
  readLocalFlows,
  readLocalRuns,
  removeRemoteFlow,
  syncLoadFlows,
  writeLocalFlows,
  writeLocalRuns,
} from './api'
import { FlowCanvas } from './FlowCanvas'
import { FlowInspector } from './FlowInspector'
import { createBlankFlow, FLOW_TEMPLATES, instantiateTemplate, type FlowTemplate } from './templates'
import {
  describeCron,
  FLOW_STUDIO_URL,
  flowPath,
  makeDefaultNode,
  parseFlowRoute,
  topologicalSort,
  type FlowDefinition,
  type FlowNode,
  type FlowNodeConfig,
  type FlowNodeKind,
  type FlowRunRecord,
  type FlowStepResult,
  type FlowView,
} from './types'

export function FlowPane({
  host,
  path,
  onNavigate,
}: {
  host?: Host
  path?: string
  onNavigate?: (to: string) => void
} = {}) {
  const { t } = useI18n()
  const hostCtx = useHost()
  const activeOrg = host?.org ?? currentOrg()
  const currentPathname =
    path ?? hostCtx?.path ?? (typeof window !== 'undefined' ? window.location.pathname : '/flow')

  const route = useMemo(() => parseFlowRoute(currentPathname), [currentPathname])

  const navigate = useCallback(
    (to: string, replace = false) => {
      if (onNavigate && !replace) onNavigate(to)
      else navGo(to, replace)
    },
    [onNavigate],
  )

  const [flows, setFlows] = useState<FlowDefinition[]>(() => readLocalFlows(activeOrg))
  const [runs, setRuns] = useState<FlowRunRecord[]>(() => readLocalRuns(activeOrg))
  const [shownOrg, setShownOrg] = useState(activeOrg)
  const [activeFlowId, setActiveFlowId] = useState<string>(() => flows[0]?.id ?? '')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [syncState, setSyncState] = useState<'synced' | 'local' | 'saving'>('local')
  const [running, setRunning] = useState(false)
  const [liveSteps, setLiveSteps] = useState<FlowStepResult[]>([])
  const [showRunDrawer, setShowRunDrawer] = useState(false)
  const [activeRunSummary, setActiveRunSummary] = useState<string | null>(null)
  const runAbortRef = useRef<AbortController | null>(null)

  // Keep org-isolated storage when switching orgs.
  if (shownOrg !== activeOrg) {
    setShownOrg(activeOrg)
    const nextFlows = readLocalFlows(activeOrg)
    setFlows(nextFlows)
    setRuns(readLocalRuns(activeOrg))
    setActiveFlowId(nextFlows[0]?.id ?? '')
    setSelectedNodeId(null)
  }

  // Merge remote /v1/workflow definitions when authenticated.
  useEffect(() => {
    const ctrl = new AbortController()
    void syncLoadFlows(activeOrg, ctrl.signal).then((res) => {
      if (ctrl.signal.aborted) return
      setFlows(res.flows)
      setSyncState(res.source === 'remote' ? 'synced' : 'local')
      setActiveFlowId((cur) => (res.flows.some((f) => f.id === cur) ? cur : (res.flows[0]?.id ?? '')))
    })
    return () => ctrl.abort()
  }, [activeOrg])

  // Follow `/flow/<id>` or `/flow/new` route navigation.
  useEffect(() => {
    if (route.createNew) {
      const fresh = createBlankFlow(`Flow ${flows.length + 1}`)
      const next = [fresh, ...flows]
      setFlows(next)
      setActiveFlowId(fresh.id)
      setSelectedNodeId(fresh.nodes[1]?.id ?? fresh.nodes[0]?.id ?? null)
      writeLocalFlows(next, activeOrg)
      void persistFlow(fresh, next, activeOrg).then(setSyncState)
      navigate(flowPath(fresh.id), true)
      return
    }
    if (route.flowId && flows.some((f) => f.id === route.flowId) && route.flowId !== activeFlowId) {
      setActiveFlowId(route.flowId)
      setSelectedNodeId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.createNew, route.flowId])

  useEffect(() => () => runAbortRef.current?.abort(), [])

  const activeFlow = useMemo(
    () => flows.find((f) => f.id === activeFlowId) ?? flows[0] ?? null,
    [flows, activeFlowId],
  )

  const selectedNode = useMemo(
    () => (activeFlow && selectedNodeId ? activeFlow.nodes.find((n) => n.id === selectedNodeId) ?? null : null),
    [activeFlow, selectedNodeId],
  )

  const stepResultMap = useMemo(() => {
    const map = new Map<string, FlowStepResult>()
    for (const s of liveSteps) map.set(s.nodeId, s)
    return map
  }, [liveSteps])

  const commitFlow = useCallback(
    (updater: (flow: FlowDefinition) => FlowDefinition) => {
      if (!activeFlow) return
      const updated = { ...updater(activeFlow), updatedAt: new Date().toISOString() }
      setFlows((prev) => {
        const next = prev.map((f) => (f.id === updated.id ? updated : f))
        writeLocalFlows(next, activeOrg)
        return next
      })
      setSyncState('local')
    },
    [activeFlow, activeOrg],
  )

  const handleSave = useCallback(async () => {
    if (!activeFlow) return
    setSyncState('saving')
    const result = await persistFlow(activeFlow, flows, activeOrg)
    setSyncState(result)
  }, [activeFlow, flows, activeOrg])

  const handleCreateFlow = useCallback(() => {
    const fresh = createBlankFlow(`Flow ${flows.length + 1}`)
    const next = [fresh, ...flows]
    setFlows(next)
    setActiveFlowId(fresh.id)
    setSelectedNodeId(fresh.nodes[1]?.id ?? fresh.nodes[0]?.id ?? null)
    writeLocalFlows(next, activeOrg)
    void persistFlow(fresh, next, activeOrg).then(setSyncState)
    navigate(flowPath(fresh.id))
  }, [flows, activeOrg, navigate])

  const handleUseTemplate = useCallback(
    (template: FlowTemplate) => {
      const created = instantiateTemplate(template)
      const next = [created, ...flows]
      setFlows(next)
      setActiveFlowId(created.id)
      setSelectedNodeId(created.nodes[1]?.id ?? created.nodes[0]?.id ?? null)
      writeLocalFlows(next, activeOrg)
      void persistFlow(created, next, activeOrg).then(setSyncState)
      navigate(flowPath(created.id))
    },
    [flows, activeOrg, navigate],
  )

  const handleDeleteFlow = useCallback(
    (flowId: string) => {
      setFlows((prev) => {
        const remaining = prev.filter((f) => f.id !== flowId)
        const next = remaining.length > 0 ? remaining : [createBlankFlow()]
        writeLocalFlows(next, activeOrg)
        if (activeFlowId === flowId) {
          setActiveFlowId(next[0]!.id)
          setSelectedNodeId(null)
        }
        return next
      })
      void removeRemoteFlow(flowId)
    },
    [activeFlowId, activeOrg],
  )

  const handleMoveNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      commitFlow((f) => ({
        ...f,
        nodes: f.nodes.map((n) => (n.id === nodeId ? { ...n, position: { x, y } } : n)),
      }))
    },
    [commitFlow],
  )

  const handleAddNode = useCallback(
    (kind: FlowNodeKind) => {
      if (!activeFlow) return
      const created = makeDefaultNode(kind, activeFlow.nodes.length)
      const previous = activeFlow.nodes.at(-1)
      commitFlow((f) => ({
        ...f,
        nodes: [...f.nodes, created],
        edges: previous
          ? [...f.edges, { id: `e_${Date.now().toString(36)}`, source: previous.id, target: created.id }]
          : f.edges,
      }))
      setSelectedNodeId(created.id)
    },
    [activeFlow, commitFlow],
  )

  const handleUpdateNode = useCallback(
    (nodeId: string, patch: Partial<FlowNode>, configPatch?: Partial<FlowNodeConfig>) => {
      commitFlow((f) => ({
        ...f,
        nodes: f.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, ...patch, config: configPatch ? { ...n.config, ...configPatch } : n.config }
            : n,
        ),
      }))
    },
    [commitFlow],
  )

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      commitFlow((f) => ({
        ...f,
        nodes: f.nodes.filter((n) => n.id !== nodeId),
        edges: f.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      }))
      setSelectedNodeId((cur) => (cur === nodeId ? null : cur))
    },
    [commitFlow],
  )

  const handleConnectNodes = useCallback(
    (source: string, target: string) => {
      if (source === target) return
      commitFlow((f) => {
        if (f.edges.some((e) => e.source === source && e.target === target)) return f
        return {
          ...f,
          edges: [...f.edges, { id: `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`, source, target }],
        }
      })
    },
    [commitFlow],
  )

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      commitFlow((f) => ({
        ...f,
        edges: f.edges.filter((e) => e.id !== edgeId),
      }))
    },
    [commitFlow],
  )

  const handleAutoLayout = useCallback(() => {
    commitFlow((f) => {
      const sorted = topologicalSort(f.nodes, f.edges)
      const positions = new Map<string, { x: number; y: number }>()
      sorted.forEach((n, idx) => {
        positions.set(n.id, {
          x: 40 + (idx % 4) * 296,
          y: 96 + Math.floor(idx / 4) * 184,
        })
      })
      return {
        ...f,
        nodes: f.nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position })),
      }
    })
  }, [commitFlow])

  const handleRunFlow = useCallback(
    async (targetFlow?: FlowDefinition, trigger: 'manual' | 'schedule' = 'manual') => {
      const flowToRun = targetFlow ?? activeFlow
      if (!flowToRun || running) return
      runAbortRef.current?.abort()
      const ctrl = new AbortController()
      runAbortRef.current = ctrl
      setRunning(true)
      setShowRunDrawer(true)
      setActiveRunSummary(null)
      setLiveSteps([])
      try {
        const record = await executeFlow(flowToRun, {
          trigger,
          signal: ctrl.signal,
          onStepUpdate: (steps) => setLiveSteps(steps),
        })
        setRuns((prev) => {
          const next = [record, ...prev].slice(0, 50)
          writeLocalRuns(next, activeOrg)
          return next
        })
        setActiveRunSummary(record.summary ?? null)
      } finally {
        setRunning(false)
      }
    },
    [activeFlow, running, activeOrg],
  )

  const toggleSchedule = useCallback(
    (flowId: string, enabled: boolean) => {
      setFlows((prev) => {
        const next = prev.map((f) =>
          f.id === flowId
            ? {
                ...f,
                schedule: {
                  cron: f.schedule?.cron || '0 8 * * 1-5',
                  timezone: f.schedule?.timezone || 'UTC',
                  enabled,
                },
                updatedAt: new Date().toISOString(),
              }
            : f,
        )
        writeLocalFlows(next, activeOrg)
        const target = next.find((f) => f.id === flowId)
        if (target) void persistFlow(target, next, activeOrg).then(setSyncState)
        return next
      })
    },
    [activeOrg],
  )

  const scheduledFlows = useMemo(
    () => flows.filter((f) => Boolean(f.schedule) || f.nodes.some((n) => n.kind === 'schedule')),
    [flows],
  )

  const viewTabs: readonly { id: FlowView; label: string; routeSub: string; Icon: typeof Workflow }[] = [
    { id: 'canvas', label: t('Builder'), routeSub: '', Icon: Workflow },
    { id: 'scheduled', label: t('Scheduled'), routeSub: 'scheduled', Icon: CalendarClock },
    { id: 'runs', label: t('Runs'), routeSub: 'runs', Icon: History },
    { id: 'templates', label: t('Templates'), routeSub: 'templates', Icon: LayoutTemplate },
  ]

  return (
    <YStack data-slot="flow-pane" flex={1} minW={0} minH={0} bg="$background">
      {/* Top workspace toolbar */}
      <XStack
        data-slot="flow-toolbar"
        px="$4"
        py="$2.5"
        gap="$3"
        items="center"
        justify="space-between"
        flexWrap="wrap"
        borderBottomWidth={1}
        borderColor="$edge"
        shrink={0}
      >
        <XStack items="center" gap="$3" flexWrap="wrap" minW={0}>
          <XStack items="center" gap="$2">
            <Workflow size={16} aria-hidden />
            <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
              {route.view === 'canvas' && activeFlow ? activeFlow.name : t('Flow')}
            </Text>
          </XStack>

          <XStack items="center" gap="$1" role="tablist" aria-label={t('Flow views')}>
            {viewTabs.map(({ id, label, routeSub, Icon }) => {
              const active = route.view === id
              return (
                <XStack
                  key={id}
                  render="button"
                  role="tab"
                  aria-selected={active}
                  data-slot={`flow-tab-${id}`}
                  onClick={() => navigate(flowPath(routeSub))}
                  px="$2.5"
                  py="$1.5"
                  rounded="$3"
                  gap="$1.5"
                  items="center"
                  bg={active ? '$raised' : 'transparent'}
                  cursor="pointer"
                  hoverStyle={{ bg: active ? '$raised' : '$hover' }}
                >
                  <Icon size={13} aria-hidden />
                  <Text fontSize="$2" fontWeight={active ? '600' : '400'} color={active ? '$ink' : '$soft'}>
                    {label}
                  </Text>
                </XStack>
              )
            })}
          </XStack>
        </XStack>

        <XStack items="center" gap="$2" flexWrap="wrap">
          {route.view === 'canvas' && activeFlow ? (
            <>
              <Text fontSize="$1" color="$quiet" data-slot="flow-sync-status">
                {syncState === 'saving'
                  ? t('Saving…')
                  : syncState === 'synced'
                    ? t('Synced')
                    : t('Saved locally')}
              </Text>
              <Button size="sm" variant="outline" data-slot="flow-save" onPress={() => void handleSave()}>
                <Save size={13} aria-hidden />
                {t('Save')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                data-slot="flow-test-run"
                disabled={running}
                onPress={() => void handleRunFlow()}
              >
                {running ? <Loader2 size={13} aria-hidden /> : <Play size={13} aria-hidden />}
                {running ? t('Running…') : t('Test run')}
              </Button>
            </>
          ) : null}

          <XStack
            render={<a href={FLOW_STUDIO_URL} target="_blank" rel="noopener noreferrer" />}
            data-slot="flow-studio-link"
            px="$2.5"
            py="$1.5"
            rounded="$3"
            borderWidth={1}
            borderColor="$edge"
            items="center"
            gap="$1.5"
            cursor="pointer"
            hoverStyle={{ bg: '$hover', borderColor: 'var(--border-strong)' }}
          >
            <Text fontSize="$2" fontWeight="500" color="$ink">
              {t('Open Flow Studio')}
            </Text>
            <ExternalLink size={12} aria-hidden />
          </XStack>
        </XStack>
      </XStack>

      {/* Main view body */}
      {route.view === 'canvas' && activeFlow ? (
        <YStack flex={1} minW={0} minH={0}>
          <XStack flex={1} minW={0} minH={0} $max-lg={{ flexDirection: 'column' }}>
            {/* Compact flows switcher rail inside the pane */}
            <YStack
              data-slot="flow-list"
              width={212}
              shrink={0}
              borderInlineEndWidth={1}
              borderColor="$edge"
              p="$2.5"
              gap="$2"
              overflowY="auto"
              overflowX="hidden"
              $max-lg={{ width: '100%', borderInlineEndWidth: 0, borderBottomWidth: 1, maxH: 132 }}
            >
              <XStack items="center" justify="space-between" px="$1">
                <Text fontSize="$1" fontWeight="500" color="$quiet">
                  {t('Active flows')} ({flows.length})
                </Text>
                <XStack
                  render="button"
                  aria-label={t('New flow')}
                  data-slot="flow-list-new"
                  onClick={handleCreateFlow}
                  width={24}
                  height={24}
                  rounded="$2"
                  items="center"
                  justify="center"
                  cursor="pointer"
                  hoverStyle={{ bg: '$hover' }}
                >
                  <Plus size={14} aria-hidden />
                </XStack>
              </XStack>

              <YStack gap="$1">
                {flows.map((item) => {
                  const isCurrent = item.id === activeFlow.id
                  return (
                    <XStack
                      key={item.id}
                      data-slot={`flow-row-${item.id}`}
                      items="center"
                      justify="space-between"
                      gap="$1.5"
                      px="$2"
                      py="$1.5"
                      rounded="$3"
                      bg={isCurrent ? '$raised' : 'transparent'}
                      hoverStyle={{ bg: isCurrent ? '$raised' : '$hover' }}
                    >
                      <YStack
                        render="button"
                        flex={1}
                        minW={0}
                        items="flex-start"
                        bg="transparent"
                        cursor="pointer"
                        onClick={() => {
                          setActiveFlowId(item.id)
                          setSelectedNodeId(null)
                          navigate(flowPath(item.id))
                        }}
                      >
                        <Text fontSize="$2" fontWeight={isCurrent ? '600' : '400'} color="$ink" numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text fontSize="$1" color="$quiet" numberOfLines={1}>
                          {item.nodes.length} {t('steps')}
                          {item.schedule?.enabled ? ` · ${t('Scheduled')}` : ''}
                        </Text>
                      </YStack>
                      {flows.length > 1 ? (
                        <XStack
                          render="button"
                          aria-label={t('Delete flow')}
                          onClick={() => handleDeleteFlow(item.id)}
                          width={22}
                          height={22}
                          rounded="$2"
                          items="center"
                          justify="center"
                          opacity={0.6}
                          cursor="pointer"
                          hoverStyle={{ opacity: 1, bg: '$hover' }}
                        >
                          <Trash2 size={12} aria-hidden />
                        </XStack>
                      ) : null}
                    </XStack>
                  )
                })}
              </YStack>
            </YStack>

            {/* Visual drag & connect graph canvas */}
            <FlowCanvas
              nodes={activeFlow.nodes}
              edges={activeFlow.edges}
              selectedNodeId={selectedNodeId}
              stepResults={stepResultMap}
              onSelectNode={setSelectedNodeId}
              onMoveNode={handleMoveNode}
              onAddNode={handleAddNode}
              onConnectNodes={handleConnectNodes}
              onDeleteEdge={handleDeleteEdge}
              onDeleteNode={handleDeleteNode}
              onAutoLayout={handleAutoLayout}
            />

            {/* Step / flow property inspector */}
            <FlowInspector
              flow={activeFlow}
              selectedNode={selectedNode}
              onUpdateFlow={(patch) => commitFlow((f) => ({ ...f, ...patch }))}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
              onConnectNodes={handleConnectNodes}
              onDeleteEdge={handleDeleteEdge}
            />
          </XStack>

          {/* Bottom live test-run trace drawer */}
          {showRunDrawer ? (
            <YStack
              data-slot="flow-run-drawer"
              height={196}
              shrink={0}
              borderTopWidth={1}
              borderColor="$edge"
              bg="var(--card)"
              p="$3"
              gap="$2"
              overflowY="auto"
            >
              <XStack items="center" justify="space-between" gap="$2">
                <XStack items="center" gap="$2">
                  <Text fontSize="$2" fontWeight="600" color="$ink">
                    {t('Test run output')}
                  </Text>
                  {activeRunSummary ? (
                    <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                      {activeRunSummary}
                    </Text>
                  ) : null}
                </XStack>
                <XStack
                  render="button"
                  aria-label={t('Close run output')}
                  onClick={() => setShowRunDrawer(false)}
                  width={24}
                  height={24}
                  rounded="$2"
                  items="center"
                  justify="center"
                  cursor="pointer"
                  hoverStyle={{ bg: '$hover' }}
                >
                  <X size={14} aria-hidden />
                </XStack>
              </XStack>

              <YStack gap="$1.5">
                {liveSteps.map((step) => (
                  <YStack
                    key={step.nodeId}
                    data-slot={`run-step-${step.nodeId}`}
                    p="$2"
                    rounded="$3"
                    borderWidth={1}
                    borderColor="$edge"
                    bg="$background"
                    gap="$1"
                  >
                    <XStack items="center" justify="space-between" gap="$2">
                      <XStack items="center" gap="$1.5">
                        {step.status === 'running' ? (
                          <Loader2 size={13} aria-hidden />
                        ) : step.status === 'success' ? (
                          <CheckCircle2 size={13} color="var(--state-online)" aria-hidden />
                        ) : step.status === 'error' ? (
                          <XCircle size={13} color="var(--state-error)" aria-hidden />
                        ) : null}
                        <Text fontSize="$2" fontWeight="500" color="$ink">
                          {step.nodeTitle}
                        </Text>
                        <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                          {step.status}
                        </Text>
                      </XStack>
                      {step.durationMs ? (
                        <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                          {step.durationMs}ms
                        </Text>
                      ) : null}
                    </XStack>
                    {step.error ? (
                      <Text fontSize="$1" color="var(--state-error)" fontFamily="$mono">
                        {step.error}
                      </Text>
                    ) : step.output ? (
                      <Text fontSize="$1" color="$soft" numberOfLines={3}>
                        {step.output}
                      </Text>
                    ) : null}
                  </YStack>
                ))}
              </YStack>
            </YStack>
          ) : null}
        </YStack>
      ) : route.view === 'scheduled' ? (
        <YStack data-slot="flow-scheduled-view" flex={1} minH={0} overflowY="auto" p="$5" gap="$4">
          <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
            <YStack gap="$1">
              <Text fontSize="$5" fontWeight="600" color="$ink">
                {t('Scheduled flows')}
              </Text>
              <Text fontSize="$2" color="$quiet">
                {t('Automations triggered automatically on a cron cadence.')}
              </Text>
            </YStack>
            <Button size="sm" variant="outline" onPress={() => navigate(flowPath('templates'))}>
              <Plus size={14} aria-hidden />
              {t('Browse templates')}
            </Button>
          </XStack>

          {scheduledFlows.length === 0 ? (
            <YStack p="$5" rounded="$4" borderWidth={1} borderColor="$edge" gap="$2" items="flex-start">
              <Text fontSize="$3" fontWeight="500" color="$ink">
                {t('No scheduled flows yet')}
              </Text>
              <Text fontSize="$2" color="$quiet">
                {t('Enable a schedule in the Flow inspector or start from the Scheduled Research Brief template.')}
              </Text>
            </YStack>
          ) : (
            <YStack gap="$2.5">
              {scheduledFlows.map((item) => {
                const cron =
                  item.schedule?.cron ??
                  item.nodes.find((n) => n.kind === 'schedule')?.config.cron ??
                  '0 8 * * 1-5'
                const enabled = item.schedule?.enabled ?? false
                const info = describeCron(cron)
                return (
                  <XStack
                    key={item.id}
                    data-slot={`scheduled-flow-${item.id}`}
                    p="$3.5"
                    rounded="$4"
                    borderWidth={1}
                    borderColor="$edge"
                    bg="var(--card)"
                    items="center"
                    justify="space-between"
                    flexWrap="wrap"
                    gap="$3"
                  >
                    <YStack flex={1} minW={220} gap="$1">
                      <XStack items="center" gap="$2">
                        <Text fontSize="$3" fontWeight="600" color="$ink">
                          {item.name}
                        </Text>
                        <Text fontSize="$1" color="$quiet" fontFamily="$mono" px="$2" py={2} rounded="$2" bg="$hover">
                          {cron}
                        </Text>
                      </XStack>
                      <Text fontSize="$2" color="$soft">
                        {info.human} · {item.schedule?.timezone || 'UTC'}
                      </Text>
                    </YStack>
                    <XStack items="center" gap="$2.5">
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) => toggleSchedule(item.id, Boolean(checked))}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => {
                          setActiveFlowId(item.id)
                          navigate(flowPath(item.id))
                        }}
                      >
                        {t('Edit')}
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={running}
                        onPress={() => {
                          setActiveFlowId(item.id)
                          navigate(flowPath(item.id))
                          void handleRunFlow(item, 'schedule')
                        }}
                      >
                        <Play size={13} aria-hidden />
                        {t('Run now')}
                      </Button>
                    </XStack>
                  </XStack>
                )
              })}
            </YStack>
          )}
        </YStack>
      ) : route.view === 'runs' ? (
        <YStack data-slot="flow-runs-view" flex={1} minH={0} overflowY="auto" p="$5" gap="$4">
          <YStack gap="$1">
            <Text fontSize="$5" fontWeight="600" color="$ink">
              {t('Run history')}
            </Text>
            <Text fontSize="$2" color="$quiet">
              {t('Recent test runs and scheduled executions across your flows.')}
            </Text>
          </YStack>

          {runs.length === 0 ? (
            <YStack p="$5" rounded="$4" borderWidth={1} borderColor="$edge" gap="$2" items="flex-start">
              <Text fontSize="$3" fontWeight="500" color="$ink">
                {t('No runs recorded yet')}
              </Text>
              <Text fontSize="$2" color="$quiet">
                {t('Open any flow in the Builder and press Test run to execute it live with Enso.')}
              </Text>
            </YStack>
          ) : (
            <YStack gap="$2.5">
              {runs.map((run) => (
                <YStack
                  key={run.id}
                  data-slot={`flow-run-${run.id}`}
                  p="$3.5"
                  rounded="$4"
                  borderWidth={1}
                  borderColor="$edge"
                  bg="var(--card)"
                  gap="$2"
                >
                  <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
                    <XStack items="center" gap="$2">
                      {run.status === 'completed' ? (
                        <CheckCircle2 size={15} color="var(--state-online)" aria-hidden />
                      ) : (
                        <XCircle size={15} color="var(--state-error)" aria-hidden />
                      )}
                      <Text fontSize="$3" fontWeight="600" color="$ink">
                        {run.flowName}
                      </Text>
                      <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                        {run.trigger}
                      </Text>
                    </XStack>
                    <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                      {run.durationMs ? `${run.durationMs}ms` : ''} · {new Date(run.startedAt).toLocaleString()}
                    </Text>
                  </XStack>
                  {run.summary ? (
                    <Text fontSize="$2" color="$soft">
                      {run.summary}
                    </Text>
                  ) : null}
                  <YStack gap="$1">
                    {run.steps.map((step) => (
                      <XStack key={step.nodeId} items="center" justify="space-between" gap="$2" px="$2" py="$1" rounded="$2" bg="$background">
                        <Text fontSize="$1" color="$ink" flex={1} numberOfLines={1}>
                          {step.nodeTitle}
                        </Text>
                        <Text fontSize="$1" color={step.status === 'error' ? 'var(--state-error)' : '$quiet'} fontFamily="$mono">
                          {step.status}
                          {step.durationMs ? ` · ${step.durationMs}ms` : ''}
                        </Text>
                      </XStack>
                    ))}
                  </YStack>
                </YStack>
              ))}
            </YStack>
          )}
        </YStack>
      ) : (
        <YStack data-slot="flow-templates-view" flex={1} minH={0} overflowY="auto" p="$5" gap="$4">
          <YStack gap="$1">
            <Text fontSize="$5" fontWeight="600" color="$ink">
              {t('Starter templates')}
            </Text>
            <Text fontSize="$2" color="$quiet">
              {t('Launch an agentic workflow in one click and customize every step on the canvas.')}
            </Text>
          </YStack>

          <XStack gap="$3.5" flexWrap="wrap" items="stretch">
            {FLOW_TEMPLATES.map((tpl) => (
              <YStack
                key={tpl.id}
                data-slot={`flow-template-${tpl.id}`}
                flex={1}
                flexBasis={280}
                minW={260}
                maxW="100%"
                p="$4"
                rounded="$4"
                borderWidth={1}
                borderColor="$edge"
                bg="var(--card)"
                justify="space-between"
                gap="$3"
              >
                <YStack gap="$2">
                  <XStack items="center" justify="space-between" gap="$2">
                    <Text fontSize="$3" fontWeight="600" color="$ink">
                      {tpl.name}
                    </Text>
                    <Text fontSize="$1" color="$quiet" px="$2" py={2} rounded="$2" bg="$hover">
                      {tpl.category}
                    </Text>
                  </XStack>
                  <Text fontSize="$2" color="$soft">
                    {tpl.description}
                  </Text>
                  <XStack gap="$1" flexWrap="wrap" pt="$1">
                    {tpl.nodes.map((n) => (
                      <Text key={n.id} fontSize="$1" color="$quiet" fontFamily="$mono" px="$1.5" py={2} rounded="$2" bg="$background">
                        {n.title}
                      </Text>
                    ))}
                  </XStack>
                </YStack>
                <XStack justify="flex-end">
                  <Button
                    size="sm"
                    variant="primary"
                    data-slot={`use-template-${tpl.id}`}
                    onPress={() => handleUseTemplate(tpl)}
                  >
                    {t('Use template')}
                  </Button>
                </XStack>
              </YStack>
            ))}
          </XStack>
        </YStack>
      )}
    </YStack>
  )
}

export default FlowPane
