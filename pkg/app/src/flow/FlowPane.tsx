'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Box, Button, Input, Switch, Text } from '@hanzo/ui'
import {
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  History,
  LayoutTemplate,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Server,
  ShieldAlert,
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
import { FlowKnowledgePanel } from './FlowKnowledgePanel'
import { FlowMcpDrawer } from './FlowMcpDrawer'
import { FlowPalette } from './FlowPalette'
import { FlowPlayground } from './FlowPlayground'
import { FlowStepIo } from './FlowStepIo'
import {
  createBlankFlow,
  describeTemplateMeta,
  FLOW_TEMPLATE_CATEGORIES,
  FLOW_TEMPLATES,
  instantiateTemplate,
  type FlowTemplate,
  type FlowTemplateCategory,
} from './templates'
import {
  describeCron,
  flowPath,
  isStickyNoteNode,
  makeNodeFromComponent,
  parseFlowRoute,
  topologicalSort,
  type FlowDefinition,
  type FlowNode,
  type FlowNodeConfig,
  type FlowNodeSubtype,
  type FlowPosition,
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
  const [showPlayground, setShowPlayground] = useState(false)
  const [showMcpDrawer, setShowMcpDrawer] = useState(false)
  const [paletteCollapsed, setPaletteCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024,
  )
  const [inspectorCollapsed, setInspectorCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024,
  )
  const [activeRunSummary, setActiveRunSummary] = useState<string | null>(null)
  const [lastLiveRun, setLastLiveRun] = useState<FlowRunRecord | null>(null)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null)
  const [expandedLiveSteps, setExpandedLiveSteps] = useState<Record<string, boolean>>({})
  const [expandedRunSteps, setExpandedRunSteps] = useState<Record<string, boolean>>({})
  const [templateQuery, setTemplateQuery] = useState('')
  const [templateCategory, setTemplateCategory] = useState<'All' | FlowTemplateCategory>('All')
  const runAbortRef = useRef<AbortController | null>(null)

  const attachRemoteId = useCallback((flowId: string, remoteId: string) => {
    setFlows((prev) => prev.map((f) => (f.id === flowId ? { ...f, remoteId } : f)))
  }, [])

  // Keep org-isolated storage when switching orgs.
  if (shownOrg !== activeOrg) {
    setShownOrg(activeOrg)
    const nextFlows = readLocalFlows(activeOrg)
    setFlows(nextFlows)
    setRuns(readLocalRuns(activeOrg))
    setActiveFlowId(nextFlows[0]?.id ?? '')
    setSelectedNodeId(null)
    setShowPlayground(false)
    setLastLiveRun(null)
    setLiveSteps([])
    setActiveRunSummary(null)
    setExpandedRunId(null)
    setCopiedRunId(null)
  }

  // Merge remote /v1/flow/workflows definitions when authenticated via Hanzo IAM.
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

  // Follow `/flow/<id>`, `/flow/new`, or sidebar view navigation (always dismiss drawers).
  useEffect(() => {
    setShowPlayground(false)
    setShowMcpDrawer(false)
    if (route.createNew) {
      const fresh = createBlankFlow(`Flow ${flows.length + 1}`)
      const next = [fresh, ...flows]
      setFlows(next)
      setActiveFlowId(fresh.id)
      setSelectedNodeId(fresh.nodes[1]?.id ?? fresh.nodes[0]?.id ?? null)
      writeLocalFlows(next, activeOrg)
      void persistFlow(fresh, next, activeOrg, (rid) => attachRemoteId(fresh.id, rid)).then(setSyncState)
      navigate(flowPath(fresh.id), true)
      return
    }
    if (route.flowId && flows.some((f) => f.id === route.flowId) && route.flowId !== activeFlowId) {
      setActiveFlowId(route.flowId)
      setSelectedNodeId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.view, route.createNew, route.flowId])

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
    const result = await persistFlow(activeFlow, flows, activeOrg, (rid) => attachRemoteId(activeFlow.id, rid))
    setSyncState(result)
  }, [activeFlow, flows, activeOrg, attachRemoteId])

  const handleToggleFlowStatus = useCallback(() => {
    if (!activeFlow) return
    const nextStatus = activeFlow.status === 'active' ? 'paused' : 'active'
    const updated: FlowDefinition = { ...activeFlow, status: nextStatus, updatedAt: new Date().toISOString() }
    const next = flows.map((f) => (f.id === updated.id ? updated : f))
    setFlows(next)
    writeLocalFlows(next, activeOrg)
    void persistFlow(updated, next, activeOrg, (rid) => attachRemoteId(updated.id, rid)).then(setSyncState)
  }, [activeFlow, flows, activeOrg, attachRemoteId])

  const handleCreateFlow = useCallback(() => {
    const fresh = createBlankFlow(`Flow ${flows.length + 1}`)
    const next = [fresh, ...flows]
    setFlows(next)
    setActiveFlowId(fresh.id)
    setSelectedNodeId(fresh.nodes[1]?.id ?? fresh.nodes[0]?.id ?? null)
    setShowPlayground(false)
    writeLocalFlows(next, activeOrg)
    void persistFlow(fresh, next, activeOrg, (rid) => attachRemoteId(fresh.id, rid)).then(setSyncState)
    navigate(flowPath(fresh.id))
  }, [flows, activeOrg, navigate, attachRemoteId])

  const handleUseTemplate = useCallback(
    (template: FlowTemplate, openPlaygroundAfter = false) => {
      const created = instantiateTemplate(template)
      const next = [created, ...flows]
      setFlows(next)
      setActiveFlowId(created.id)
      setSelectedNodeId(created.nodes.find((n) => !isStickyNoteNode(n))?.id ?? null)
      setShowPlayground(openPlaygroundAfter)
      writeLocalFlows(next, activeOrg)
      void persistFlow(created, next, activeOrg, (rid) => attachRemoteId(created.id, rid)).then(setSyncState)
      navigate(flowPath(created.id))
    },
    [flows, activeOrg, navigate, attachRemoteId],
  )

  const handleDeleteFlow = useCallback(
    (flowId: string) => {
      const target = flows.find((f) => f.id === flowId)
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
      void removeRemoteFlow(flowId, target?.remoteId)
    },
    [flows, activeFlowId, activeOrg],
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

  const handleAddComponent = useCallback(
    (subtype: FlowNodeSubtype, position?: FlowPosition) => {
      if (!activeFlow) return
      const created = makeNodeFromComponent(subtype, activeFlow.nodes.length, position)
      const previous = [...activeFlow.nodes].reverse().find((n) => !isStickyNoteNode(n))
      const connectPrev = Boolean(!position && previous && !isStickyNoteNode(created))
      commitFlow((f) => ({
        ...f,
        nodes: [...f.nodes, created],
        edges:
          connectPrev && previous
            ? [
                ...f.edges,
                {
                  id: `e_${Date.now().toString(36)}`,
                  source: previous.id,
                  target: created.id,
                  sourceHandle: 'output',
                  targetHandle: 'input',
                },
              ]
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
    (source: string, target: string, sourceHandle?: string, targetHandle?: string) => {
      if (source === target) return
      commitFlow((f) => {
        if (
          f.edges.some(
            (e) =>
              e.source === source &&
              e.target === target &&
              (e.sourceHandle || 'output') === (sourceHandle || 'output') &&
              (e.targetHandle || 'input') === (targetHandle || 'input'),
          )
        ) {
          return f
        }
        const label =
          sourceHandle === 'tools' || targetHandle === 'tools'
            ? 'Tools'
            : sourceHandle === 'true'
              ? 'True'
              : sourceHandle === 'false'
                ? 'False'
                : undefined
        return {
          ...f,
          edges: [
            ...f.edges,
            {
              id: `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
              source,
              target,
              sourceHandle: sourceHandle || 'output',
              targetHandle: targetHandle || 'input',
              label,
            },
          ],
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
      const notes = f.nodes.filter((n) => isStickyNoteNode(n))
      const runnable = topologicalSort(
        f.nodes.filter((n) => !isStickyNoteNode(n)),
        f.edges,
      )
      const positions = new Map<string, { x: number; y: number }>()
      notes.forEach((n, idx) => {
        positions.set(n.id, { x: 48 + idx * 304, y: 32 })
      })
      const baseY = notes.length > 0 ? 240 : 96
      runnable.forEach((n, idx) => {
        positions.set(n.id, {
          x: 48 + (idx % 4) * 304,
          y: baseY + Math.floor(idx / 4) * 208,
        })
      })
      return {
        ...f,
        nodes: f.nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position })),
      }
    })
  }, [commitFlow])

  const recordRun = useCallback(
    (record: FlowRunRecord, replaceRunId?: string) => {
      setRuns((prev) => {
        const next = replaceRunId
          ? [record, ...prev.filter((r) => r.id !== replaceRunId)].slice(0, 50)
          : [record, ...prev].slice(0, 50)
        writeLocalRuns(next, activeOrg)
        return next
      })
    },
    [activeOrg],
  )

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
      setLastLiveRun(null)
      setLiveSteps([])
      setExpandedLiveSteps({})
      try {
        const record = await executeFlow(flowToRun, {
          trigger,
          signal: ctrl.signal,
          onStepUpdate: (steps) => setLiveSteps(steps),
        })
        recordRun(record)
        setLastLiveRun(record)
        setActiveRunSummary(record.summary ?? null)
      } finally {
        setRunning(false)
      }
    },
    [activeFlow, running, recordRun],
  )

  const handleResumeRun = useCallback(
    async (
      run: FlowRunRecord,
      opts: { startFromNodeId: string; decision?: 'approved' | 'rejected' },
    ) => {
      const targetFlow = flows.find((f) => f.id === run.flowId)
      if (!targetFlow || running) return
      runAbortRef.current?.abort()
      const ctrl = new AbortController()
      runAbortRef.current = ctrl
      setRunning(true)
      setActiveRunSummary(null)
      setLiveSteps(run.steps)
      try {
        const record = await executeFlow(targetFlow, {
          trigger: run.trigger,
          sampleInput: run.inputSample,
          signal: ctrl.signal,
          onStepUpdate: (steps) => setLiveSteps(steps),
          resumeFrom: {
            previousSteps: run.steps,
            startFromNodeId: opts.startFromNodeId,
          },
          approvalDecisions: opts.decision ? { [opts.startFromNodeId]: opts.decision } : undefined,
        })
        // Replace resolved waiting_approval entries in-place so stale Approve/Reject buttons cannot fire twice.
        recordRun(record, opts.decision ? run.id : undefined)
        setLastLiveRun(record)
        setActiveRunSummary(record.summary ?? null)
        setExpandedRunId(record.id)
      } finally {
        setRunning(false)
      }
    },
    [flows, running, recordRun],
  )

  const handleCopyOutput = useCallback((runId: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopiedRunId(runId)
          setTimeout(() => setCopiedRunId((cur) => (cur === runId ? null : cur)), 2000)
        })
        .catch(() => {})
    }
  }, [])

  const handleDownloadOutput = useCallback((run: FlowRunRecord) => {
    if (typeof window === 'undefined' || !run.finalOutput) return
    const slug = run.flowName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'flow-run'
    const blob = new Blob([run.finalOutput], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug}-${run.id}.md`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [])

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
        if (target) void persistFlow(target, next, activeOrg, (rid) => attachRemoteId(target.id, rid)).then(setSyncState)
        return next
      })
    },
    [activeOrg, attachRemoteId],
  )

  const scheduledFlows = useMemo(
    () => flows.filter((f) => Boolean(f.schedule) || f.nodes.some((n) => n.kind === 'schedule')),
    [flows],
  )

  const filteredTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase()
    return FLOW_TEMPLATES.filter((tpl) => {
      if (templateCategory !== 'All' && tpl.category !== templateCategory) return false
      if (!q) return true
      const hay = `${tpl.name} ${tpl.description} ${tpl.category} ${tpl.nodes.map((n) => n.title).join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [templateQuery, templateCategory])

  const viewTabs: readonly { id: FlowView; label: string; routeSub: string; Icon: typeof Workflow }[] = [
    { id: 'canvas', label: t('Builder'), routeSub: '', Icon: Workflow },
    { id: 'knowledge', label: t('Knowledge'), routeSub: 'knowledge', Icon: BookOpen },
    { id: 'scheduled', label: t('Scheduled'), routeSub: 'scheduled', Icon: CalendarClock },
    { id: 'runs', label: t('Runs'), routeSub: 'runs', Icon: History },
    { id: 'templates', label: t('Templates'), routeSub: 'templates', Icon: LayoutTemplate },
  ]

  return (
    <YStack data-slot="flow-pane" flex={1} minW={0} minH={0} bg="$background" position="relative">
      {/* Top Studio toolbar */}
      <XStack
        data-slot="flow-toolbar"
        px="$4"
        py="$2"
        gap="$3"
        items="center"
        justify="space-between"
        flexWrap="wrap"
        borderBottomWidth={1}
        borderColor="$edge"
        bg="var(--card)"
        shrink={0}
        $max-md={{ px: '$2.5', py: '$2', gap: '$2' }}
      >
        <XStack items="center" gap="$3" flexWrap="wrap" minW={0} maxW="100%">
          <XStack items="center" gap="$2">
            <Workflow size={16} aria-hidden />
            <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
              {route.view === 'canvas' && activeFlow ? activeFlow.name : t('Flow')}
            </Text>
          </XStack>

          <XStack items="center" gap="$1" role="tablist" aria-label={t('Flow views')} maxW="100%" overflowX="auto">
            {viewTabs.map(({ id, label, routeSub, Icon }) => {
              const active = route.view === id
              return (
                <XStack
                  key={id}
                  render="button"
                  role="tab"
                  aria-selected={active}
                  data-slot={`flow-tab-${id}`}
                  onClick={() => {
                    setShowPlayground(false)
                    setShowMcpDrawer(false)
                    navigate(flowPath(routeSub))
                  }}
                  px="$2.5"
                  py="$1.5"
                  rounded="$3"
                  gap="$1.5"
                  items="center"
                  shrink={0}
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
          <XStack
            data-slot="flow-cloud-status"
            items="center"
            gap="$1.5"
            px="$2.5"
            py="$1"
            rounded="$10"
            bg="var(--surface-card)"
            borderWidth={1}
            borderColor="$edge"
            $max-lg={{ display: 'none' }}
          >
            <YStack width={7} height={7} rounded={999} bg="var(--state-online)" />
            <Text fontSize="$1" color="$soft" fontFamily="$mono" numberOfLines={1}>
              Hanzo Enso (api.hanzo.ai/v1) · LLMs + zen-embedding-3 Active via Hanzo IAM
            </Text>
          </XStack>

          {route.view === 'canvas' && activeFlow ? (
            <>
              <XStack
                render="button"
                {...{ type: 'button' }}
                data-slot="flow-status-pill"
                data-status={activeFlow.status}
                aria-label={
                  activeFlow.status === 'paused'
                    ? t('Paused — resume flow')
                    : activeFlow.status === 'draft'
                      ? t('Draft — activate flow')
                      : t('Active — pause flow')
                }
                onClick={handleToggleFlowStatus}
                items="center"
                gap="$1.5"
                px="$2"
                py="$1"
                rounded="$10"
                borderWidth={1}
                borderColor={activeFlow.status === 'paused' ? 'var(--border-strong)' : '$edge'}
                bg={activeFlow.status === 'paused' ? '$raised' : 'transparent'}
                cursor="pointer"
                hoverStyle={{ bg: '$hover' }}
                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              >
                {activeFlow.status === 'paused' ? (
                  <Pause size={11} aria-hidden />
                ) : (
                  <YStack
                    width={6}
                    height={6}
                    rounded={999}
                    bg={activeFlow.status === 'active' ? 'var(--state-online)' : '$quiet'}
                  />
                )}
                <Text fontSize="$1" fontWeight="500" color="$ink">
                  {activeFlow.status === 'paused'
                    ? t('Paused')
                    : activeFlow.status === 'draft'
                      ? t('Draft')
                      : t('Active')}
                </Text>
              </XStack>
              <Text fontSize="$1" color="$quiet" data-slot="flow-sync-status" $max-md={{ display: 'none' }}>
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
                variant="outline"
                data-slot="flow-mcp-open"
                onPress={() => setShowMcpDrawer((v) => !v)}
              >
                <Server size={13} aria-hidden />
                {t('MCP Server')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                data-slot="flow-test-run"
                disabled={running}
                onPress={() => void handleRunFlow()}
              >
                {running ? <Loader2 size={13} aria-hidden /> : <Play size={13} aria-hidden />}
                {running ? t('Running…') : t('Test run')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                data-slot="flow-playground-open"
                onPress={() => {
                  setShowMcpDrawer(false)
                  setShowPlayground(true)
                }}
              >
                <MessageSquare size={13} aria-hidden />
                {t('Playground')}
              </Button>
            </>
          ) : null}
        </XStack>
      </XStack>

      {/* Main view body */}
      {route.view === 'canvas' && activeFlow ? (
        <YStack flex={1} minW={0} minH={0} position="relative">
          <XStack flex={1} minW={0} minH={0} $max-lg={{ flexDirection: 'column' }}>
            {/* Collapsible left Component Palette + Flows switcher */}
            <FlowPalette
              collapsed={paletteCollapsed}
              onToggleCollapse={() => setPaletteCollapsed((v) => !v)}
              flows={flows}
              activeFlowId={activeFlow.id}
              onSelectFlow={(flowId) => {
                setActiveFlowId(flowId)
                setSelectedNodeId(null)
                navigate(flowPath(flowId))
              }}
              onCreateFlow={handleCreateFlow}
              onDeleteFlow={handleDeleteFlow}
              onAddComponent={(subtype) => handleAddComponent(subtype)}
            />

            {/* OLED dot-matrix interactive graph canvas */}
            <FlowCanvas
              nodes={activeFlow.nodes}
              edges={activeFlow.edges}
              selectedNodeId={selectedNodeId}
              stepResults={stepResultMap}
              onSelectNode={setSelectedNodeId}
              onMoveNode={handleMoveNode}
              onDropComponent={(subtype, pos) => handleAddComponent(subtype, pos)}
              onConnectNodes={handleConnectNodes}
              onDeleteEdge={handleDeleteEdge}
              onDeleteNode={handleDeleteNode}
              onAutoLayout={handleAutoLayout}
            />

            {/* Collapsible right property inspector */}
            <FlowInspector
              collapsed={inspectorCollapsed}
              onToggleCollapse={() => setInspectorCollapsed((v) => !v)}
              flow={activeFlow}
              selectedNode={selectedNode}
              onUpdateFlow={(patch) => {
                const updated: FlowDefinition = {
                  ...activeFlow,
                  ...patch,
                  updatedAt: new Date().toISOString(),
                }
                const next = flows.map((f) => (f.id === updated.id ? updated : f))
                setFlows(next)
                writeLocalFlows(next, activeOrg)
                if ('status' in patch) {
                  void persistFlow(updated, next, activeOrg, (rid) => attachRemoteId(updated.id, rid)).then(setSyncState)
                } else {
                  setSyncState('local')
                }
              }}
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
                <XStack items="center" gap="$2" flexWrap="wrap">
                  <Text fontSize="$2" fontWeight="600" color="$ink">
                    {t('Test run output')}
                  </Text>
                  {activeRunSummary ? (
                    <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                      {activeRunSummary}
                    </Text>
                  ) : null}
                  {lastLiveRun?.status === 'waiting_approval' && lastLiveRun.pendingApprovalNodeId ? (
                    <XStack items="center" gap="$1.5">
                      <Button
                        size="sm"
                        variant="primary"
                        data-slot="live-run-approve"
                        disabled={running}
                        onPress={() =>
                          void handleResumeRun(lastLiveRun, {
                            startFromNodeId: lastLiveRun.pendingApprovalNodeId!,
                            decision: 'approved',
                          })
                        }
                      >
                        <Check size={12} aria-hidden />
                        {t('Approve & continue')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        data-slot="live-run-reject"
                        disabled={running}
                        onPress={() =>
                          void handleResumeRun(lastLiveRun, {
                            startFromNodeId: lastLiveRun.pendingApprovalNodeId!,
                            decision: 'rejected',
                          })
                        }
                      >
                        <X size={12} aria-hidden />
                        {t('Reject')}
                      </Button>
                    </XStack>
                  ) : lastLiveRun?.status === 'failed' ? (
                    (() => {
                      const failedStep = lastLiveRun.steps.find((s) => s.status === 'error')
                      return failedStep ? (
                        <Button
                          size="sm"
                          variant="outline"
                          data-slot="live-run-retry"
                          disabled={running}
                          onPress={() =>
                            void handleResumeRun(lastLiveRun, {
                              startFromNodeId: failedStep.nodeId,
                            })
                          }
                        >
                          <RotateCcw size={12} aria-hidden />
                          {t('Retry failed step')}
                        </Button>
                      ) : null
                    })()
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
                {liveSteps.map((step) => {
                  const expanded = Boolean(expandedLiveSteps[step.nodeId])
                  return (
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
                      <Box
                        render={<button type="button" />}
                        data-slot={`run-step-toggle-${step.nodeId}`}
                        aria-expanded={expanded}
                        onClick={() =>
                          setExpandedLiveSteps((prev) => ({
                            ...prev,
                            [step.nodeId]: !prev[step.nodeId],
                          }))
                        }
                        display="flex"
                        width="100%"
                        items="center"
                        justify="space-between"
                        gap="$2"
                        bg="transparent"
                        borderWidth={0}
                        p={0}
                        cursor="pointer"
                      >
                        <XStack items="center" gap="$1.5">
                          {expanded ? (
                            <ChevronDown size={13} color="var(--muted-foreground)" aria-hidden />
                          ) : (
                            <ChevronRight size={13} color="var(--muted-foreground)" aria-hidden />
                          )}
                          {step.status === 'running' ? (
                            <Loader2 size={13} aria-hidden />
                          ) : step.status === 'success' ? (
                            <CheckCircle2 size={13} color="var(--state-online)" aria-hidden />
                          ) : step.status === 'waiting_approval' ? (
                            <ShieldAlert size={13} color="var(--foreground)" aria-hidden />
                          ) : step.status === 'error' || step.status === 'rejected' ? (
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
                      </Box>
                      {expanded ? (
                        <FlowStepIo step={step} />
                      ) : step.error ? (
                        <Text fontSize="$1" color="var(--state-error)" fontFamily="$mono">
                          {step.error}
                        </Text>
                      ) : step.output ? (
                        <Text fontSize="$1" color="$soft" numberOfLines={3}>
                          {step.output}
                        </Text>
                      ) : null}
                    </YStack>
                  )
                })}
              </YStack>
            </YStack>
          ) : null}

          {/* Canonical Streamable HTTP MCP Server Drawer */}
          {showMcpDrawer ? (
            <FlowMcpDrawer
              flow={activeFlow}
              orgId={activeOrg}
              onClose={() => setShowMcpDrawer(false)}
            />
          ) : null}

          {/* Full Playground Drawer/View with standard @hanzo/ui/chat Composer */}
          {showPlayground ? (
            <FlowPlayground
              flow={activeFlow}
              orgId={activeOrg}
              onClose={() => setShowPlayground(false)}
              onLiveStepsChange={setLiveSteps}
              onRunRecorded={recordRun}
            />
          ) : null}
        </YStack>
      ) : route.view === 'knowledge' ? (
        <FlowKnowledgePanel orgId={activeOrg} />
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
                {t('Enable a schedule in the Flow inspector or start from the Scheduled Intelligence Brief template.')}
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
                      <XStack items="center" gap="$2" flexWrap="wrap">
                        <Text fontSize="$3" fontWeight="600" color="$ink">
                          {item.name}
                        </Text>
                        <Text fontSize="$1" color="$quiet" fontFamily="$mono" px="$2" py={2} rounded="$2" bg="$hover">
                          {cron}
                        </Text>
                        {item.status === 'paused' ? (
                          <Text fontSize="$1" color="$soft" px="$2" py={2} rounded="$2" bg="$raised">
                            {t('Flow paused')}
                          </Text>
                        ) : null}
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
                        data-slot={`scheduled-run-${item.id}`}
                        disabled={running || item.status === 'paused'}
                        onPress={() => {
                          setActiveFlowId(item.id)
                          navigate(flowPath(item.id))
                          void handleRunFlow(item, 'schedule')
                        }}
                      >
                        <Play size={13} aria-hidden />
                        {item.status === 'paused' ? t('Paused') : t('Run now')}
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
              {t('Recent Playground sessions, test runs, and scheduled executions across your flows.')}
            </Text>
          </YStack>

          {runs.length === 0 ? (
            <YStack p="$5" rounded="$4" borderWidth={1} borderColor="$edge" gap="$2" items="flex-start">
              <Text fontSize="$3" fontWeight="500" color="$ink">
                {t('No runs recorded yet')}
              </Text>
              <Text fontSize="$2" color="$quiet">
                {t('Open any flow in the Builder and press Playground or Test run to execute it live with Enso.')}
              </Text>
            </YStack>
          ) : (
            <YStack gap="$2.5">
              {runs.map((run) => {
                const expanded = expandedRunId === run.id
                const failedStep = run.steps.find((s) => s.status === 'error')
                const pendingNodeId =
                  run.pendingApprovalNodeId ?? run.steps.find((s) => s.status === 'waiting_approval')?.nodeId
                const hasFlow = flows.some((f) => f.id === run.flowId)
                const allSkipped = run.steps.length > 0 && run.steps.every((s) => s.status === 'skipped')
                return (
                  <YStack
                    key={run.id}
                    data-slot={`flow-run-${run.id}`}
                    p="$3.5"
                    rounded="$4"
                    borderWidth={1}
                    borderColor={
                      run.status === 'waiting_approval'
                        ? 'var(--border-selected)'
                        : run.status === 'failed'
                          ? 'var(--state-error)'
                          : '$edge'
                    }
                    bg="var(--card)"
                    gap="$2"
                  >
                    <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
                      <XStack
                        render="button"
                        {...{ type: 'button' }}
                        data-slot={`run-expand-${run.id}`}
                        aria-expanded={expanded}
                        onClick={() => setExpandedRunId(expanded ? null : run.id)}
                        items="center"
                        gap="$2"
                        bg="transparent"
                        borderWidth={0}
                        p={0}
                        cursor="pointer"
                        focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                      >
                        {expanded ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />}
                        {allSkipped ? (
                          <Pause size={15} color="var(--muted-foreground)" aria-hidden />
                        ) : run.status === 'completed' ? (
                          <CheckCircle2 size={15} color="var(--state-online)" aria-hidden />
                        ) : run.status === 'waiting_approval' ? (
                          <ShieldAlert size={15} color="var(--foreground)" aria-hidden />
                        ) : (
                          <XCircle size={15} color="var(--state-error)" aria-hidden />
                        )}
                        <Text fontSize="$3" fontWeight="600" color="$ink">
                          {run.flowName}
                        </Text>
                        <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                          {run.trigger} · {allSkipped ? 'paused' : run.status}
                        </Text>
                      </XStack>
                      <XStack items="center" gap="$2" flexWrap="wrap">
                        <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                          {run.durationMs ? `${run.durationMs}ms` : ''} · {new Date(run.startedAt).toLocaleString()}
                        </Text>
                        {run.finalOutput && run.status !== 'rejected' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              data-slot={`run-copy-${run.id}`}
                              onPress={() => handleCopyOutput(run.id, run.finalOutput!)}
                            >
                              {copiedRunId === run.id ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                              {copiedRunId === run.id ? t('Copied') : t('Copy')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              data-slot={`run-download-${run.id}`}
                              onPress={() => handleDownloadOutput(run)}
                            >
                              <Download size={12} aria-hidden />
                              {t('Download')}
                            </Button>
                          </>
                        ) : null}
                      </XStack>
                    </XStack>

                    {run.summary ? (
                      <Text fontSize="$2" color="$soft">
                        {run.summary}
                      </Text>
                    ) : null}

                    {/* Human Approval actions on paused runs */}
                    {run.status === 'waiting_approval' && pendingNodeId && hasFlow ? (
                      <XStack items="center" gap="$2" flexWrap="wrap" pt="$1">
                        <Button
                          size="sm"
                          variant="primary"
                          data-slot={`run-approve-${run.id}`}
                          disabled={running}
                          onPress={() =>
                            void handleResumeRun(run, {
                              startFromNodeId: pendingNodeId,
                              decision: 'approved',
                            })
                          }
                        >
                          <Check size={12} aria-hidden />
                          {t('Approve & continue')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          data-slot={`run-reject-${run.id}`}
                          disabled={running}
                          onPress={() =>
                            void handleResumeRun(run, {
                              startFromNodeId: pendingNodeId,
                              decision: 'rejected',
                            })
                          }
                        >
                          <X size={12} aria-hidden />
                          {t('Reject')}
                        </Button>
                      </XStack>
                    ) : null}

                    {/* Failed-run recovery actions: retry from failed step or inspect node */}
                    {run.status === 'failed' && failedStep && hasFlow ? (
                      <XStack items="center" gap="$2" flexWrap="wrap" pt="$1">
                        <Button
                          size="sm"
                          variant="primary"
                          data-slot={`run-retry-${run.id}`}
                          disabled={running}
                          onPress={() =>
                            void handleResumeRun(run, {
                              startFromNodeId: failedStep.nodeId,
                            })
                          }
                        >
                          <RotateCcw size={12} aria-hidden />
                          {t('Retry from failed step')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          data-slot={`run-inspect-${run.id}`}
                          onPress={() => {
                            setActiveFlowId(run.flowId)
                            setSelectedNodeId(failedStep.nodeId)
                            navigate(flowPath(run.flowId))
                          }}
                        >
                          {t('Inspect failed node')}
                        </Button>
                      </XStack>
                    ) : null}

                    {/* Deliverable output preview (suppressed on rejected runs) */}
                    {run.finalOutput && run.status !== 'rejected' ? (
                      <YStack
                        data-slot={`run-deliverable-${run.id}`}
                        p="$2.5"
                        rounded="$3"
                        borderWidth={1}
                        borderColor="$edge"
                        bg="$background"
                        gap="$1"
                      >
                        <Text fontSize="$1" fontWeight="600" color="$soft">
                          {run.status === 'waiting_approval' ? t('Pending review output') : t('Deliverable output')}
                        </Text>
                        <Text
                          fontSize="$2"
                          color="$ink"
                          numberOfLines={expanded ? undefined : 3}
                          $platform-web={{ whiteSpace: 'pre-wrap' }}
                        >
                          {run.finalOutput}
                        </Text>
                      </YStack>
                    ) : null}

                    <YStack gap="$1">
                      {run.steps.map((step) => {
                        const stepKey = `${run.id}:${step.nodeId}`
                        const stepExpanded = Boolean(expandedRunSteps[stepKey])
                        return (
                          <YStack
                            key={step.nodeId}
                            data-slot={`runs-step-${run.id}-${step.nodeId}`}
                            px="$2"
                            py="$1.5"
                            rounded="$2"
                            bg="$background"
                            gap="$1"
                          >
                            <Box
                              render={<button type="button" />}
                              data-slot={`runs-step-toggle-${run.id}-${step.nodeId}`}
                              aria-expanded={stepExpanded}
                              onClick={() =>
                                setExpandedRunSteps((prev) => ({
                                  ...prev,
                                  [stepKey]: !prev[stepKey],
                                }))
                              }
                              display="flex"
                              width="100%"
                              items="center"
                              justify="space-between"
                              gap="$2"
                              bg="transparent"
                              borderWidth={0}
                              p={0}
                              cursor="pointer"
                            >
                              <XStack items="center" gap="$1.5" flex={1} minW={0}>
                                {stepExpanded ? (
                                  <ChevronDown size={12} color="var(--muted-foreground)" aria-hidden />
                                ) : (
                                  <ChevronRight size={12} color="var(--muted-foreground)" aria-hidden />
                                )}
                                <Text fontSize="$1" color="$ink" flex={1} numberOfLines={1} text="left">
                                  {step.nodeTitle}
                                </Text>
                              </XStack>
                              <Text
                                fontSize="$1"
                                color={
                                  step.status === 'error' || step.status === 'rejected'
                                    ? 'var(--state-error)'
                                    : '$quiet'
                                }
                                fontFamily="$mono"
                              >
                                {step.status}
                                {step.durationMs ? ` · ${step.durationMs}ms` : ''}
                              </Text>
                            </Box>
                            {stepExpanded ? (
                              <FlowStepIo step={step} />
                            ) : step.error ? (
                              <Text fontSize="$1" color="var(--state-error)" fontFamily="$mono">
                                {step.error}
                              </Text>
                            ) : expanded && step.output ? (
                              <Text fontSize="$1" color="$soft" $platform-web={{ whiteSpace: 'pre-wrap' }}>
                                {step.output}
                              </Text>
                            ) : null}
                          </YStack>
                        )
                      })}
                    </YStack>
                  </YStack>
                )
              })}
            </YStack>
          )}
        </YStack>
      ) : (
        <YStack data-slot="flow-templates-view" flex={1} minH={0} overflowY="auto" p="$5" gap="$4">
          <XStack items="center" justify="space-between" flexWrap="wrap" gap="$3">
            <YStack gap="$1">
              <Text fontSize="$5" fontWeight="600" color="$ink">
                {t('Starter templates')} ({FLOW_TEMPLATES.length})
              </Text>
              <Text fontSize="$2" color="$quiet">
                {t('Pre-wired to Hanzo Enso with zero external key setup. Launch any template in one click.')}
              </Text>
            </YStack>

            <XStack
              items="center"
              gap="$1.5"
              px="$2.5"
              rounded="$3"
              borderWidth={1}
              borderColor="$edge"
              bg="var(--card)"
              width={260}
              maxW="100%"
            >
              <Search size={14} color="var(--muted-foreground)" aria-hidden />
              <Input
                data-slot="flow-template-search"
                value={templateQuery}
                onChangeText={setTemplateQuery}
                placeholder={t('Search templates…')}
                borderWidth={0}
                bg="transparent"
                flex={1}
                minW={0}
                size="sm"
              />
            </XStack>
          </XStack>

          {/* Category filter pills */}
          <XStack gap="$1.5" flexWrap="wrap" data-slot="flow-template-categories">
            {(['All', ...FLOW_TEMPLATE_CATEGORIES] as const).map((cat) => {
              const active = templateCategory === cat
              return (
                <XStack
                  key={cat}
                  render="button"
                  data-slot={`template-cat-${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  onClick={() => setTemplateCategory(cat)}
                  px="$3"
                  py="$1.5"
                  rounded="$10"
                  borderWidth={1}
                  borderColor={active ? 'var(--border-selected)' : '$edge'}
                  bg={active ? '$raised' : 'var(--card)'}
                  cursor="pointer"
                  hoverStyle={{ borderColor: 'var(--border-strong)' }}
                >
                  <Text fontSize="$1" fontWeight={active ? '600' : '500'} color={active ? '$ink' : '$soft'}>
                    {t(cat)}
                  </Text>
                </XStack>
              )
            })}
          </XStack>

          <XStack gap="$3.5" flexWrap="wrap" items="stretch">
            {filteredTemplates.map((tpl) => {
              const meta = describeTemplateMeta(tpl)
              return (
              <YStack
                key={tpl.id}
                data-slot={`flow-template-${tpl.id}`}
                flex={1}
                flexBasis={300}
                minW={270}
                maxW="100%"
                p="$4"
                rounded="$4"
                borderWidth={1}
                borderColor="$edge"
                bg="var(--surface-card)"
                justify="space-between"
                gap="$3"
                hoverStyle={{ borderColor: 'var(--border-strong)', bg: 'var(--surface-card-emphasis)' }}
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
                  <YStack
                    data-slot={`flow-template-meta-${tpl.id}`}
                    gap="$1"
                    p="$2"
                    rounded="$2"
                    bg="$background"
                    borderWidth={1}
                    borderColor="$edge"
                  >
                    <Text fontSize="$1" color="$soft">
                      {t('Trigger')}: {t(meta.trigger)} · {t('Output')}: {t(meta.output)}
                    </Text>
                    <Text fontSize="$1" color="$quiet" numberOfLines={1}>
                      {t('Input')}: {meta.inputs}
                    </Text>
                    {meta.connections.length > 0 ? (
                      <Text fontSize="$1" color="$quiet">
                        {t('Uses')}: {meta.connections.join(', ')}
                      </Text>
                    ) : null}
                  </YStack>
                  <XStack gap="$1" flexWrap="wrap" pt="$1">
                    {tpl.nodes
                      .filter((n) => !isStickyNoteNode(n))
                      .map((n) => (
                        <Text key={n.id} fontSize="$1" color="$quiet" fontFamily="$mono" px="$1.5" py={2} rounded="$2" bg="$background">
                          {n.title}
                        </Text>
                      ))}
                  </XStack>
                </YStack>
                <XStack justify="flex-end" gap="$2">
                  <Button
                    size="sm"
                    variant="outline"
                    data-slot={`try-template-${tpl.id}`}
                    onPress={() => handleUseTemplate(tpl, true)}
                  >
                    <MessageSquare size={12} aria-hidden />
                    {t('Playground')}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    data-slot={`use-template-${tpl.id}`}
                    onPress={() => handleUseTemplate(tpl, false)}
                  >
                    {t('Use template')}
                  </Button>
                </XStack>
              </YStack>
              )
            })}
          </XStack>
        </YStack>
      )}
    </YStack>
  )
}

export default FlowPane
