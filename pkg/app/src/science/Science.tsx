'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Spinner, Text } from '@hanzo/ui'
import {
  Activity,
  Atom,
  Cloud,
  Cpu,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
export { scienceNav } from './nav'
import { useHost } from '../host'
import { go } from '../lib/host'
import { bearer, org as currentOrg } from '../lib/session'
import { useWindowed } from '../windowed'
import {
  activeProject,
  buildResearchSummary,
  canProbeLocalHanzod,
  listActiveCloudLeases,
  listBenchmarks,
  listExperiments,
  listLinkedMachines,
  listOpportunities,
  listRuns,
  listSchedules,
  listStudies,
  listWorkflowActivities,
  probeHanzodState,
  resolveLocalHanzodOrigin,
} from './api'
import { AutonomyTab } from './AutonomyTab'
import { MachinesTab } from './MachinesTab'
import { OverviewTab } from './OverviewTab'
import { SchedulesTab } from './SchedulesTab'
import { StudiesTab } from './StudiesTab'
import {
  parseScienceTab,
  SCIENCE_TAB_LABELS,
  SCIENCE_TABS,
  sciencePath,
  type BenchmarkRecord,
  type CloudLeaseInfo,
  type ExperimentRecord,
  type HanzodConnectionSnapshot,
  type HanzodWorkerState,
  type LinkedMachine,
  type OpportunityItem,
  type ResearchSummaryData,
  type RunRecord,
  type ScheduleRecord,
  type ScienceTab,
  type StudyRecord,
  type WorkflowActivity,
} from './types'

const EMPTY_SUMMARY: ResearchSummaryData = {
  activeRuns: 0,
  totalExperiments: 0,
  retainedExperiments: 0,
  totalStudies: 0,
  totalBenchmarks: 0,
  totalRuns: 0,
  qualifiedWins: 0,
  promisingLeads: 0,
  inconclusiveCount: 0,
  refutedCount: 0,
  totalCostUsd: 0,
  totalGpuHours: 0,
  onlineMachines: 0,
  busyMachines: 0,
  totalGpus: 0,
}

export function Science({
  onNavigate,
  desktopHint,
}: {
  onNavigate?: (to: string) => void
  desktopHint?: boolean
} = {}) {
  const { t } = useI18n()
  const hostCtx = useHost()
  const windowed = useWindowed()
  const isDesktop = desktopHint ?? windowed

  const currentPathname =
    hostCtx?.path ?? (typeof window !== 'undefined' ? window.location.pathname : '/science')
  const currentSearch = typeof window !== 'undefined' ? window.location.search : ''
  const activeTab = useMemo(
    () => parseScienceTab(currentPathname, currentSearch),
    [currentPathname, currentSearch],
  )

  const navigateTab = useCallback(
    (tab: ScienceTab) => {
      const target = sciencePath(tab)
      if (onNavigate) onNavigate(target)
      else go(target)
    },
    [onNavigate],
  )

  // Persistent state across all 5 tabs (preserved across hanzod restarts & tab switches)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const everConnectedRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const [hanzod, setHanzod] = useState<HanzodConnectionSnapshot>(() => ({
    origin: resolveLocalHanzodOrigin(),
    mode: isDesktop ? 'reconnecting' : 'web-cloud',
    worker: null,
    reconnectAttempts: 0,
    lastConnectedAt: null,
    lastError: null,
  }))

  const [studies, setStudies] = useState<StudyRecord[]>([])
  const [benchmarks, setBenchmarks] = useState<BenchmarkRecord[]>([])
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([])
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([])
  const [leases, setLeases] = useState<CloudLeaseInfo[]>([])
  const [machines, setMachines] = useState<LinkedMachine[]>([])
  const [activities, setActivities] = useState<WorkflowActivity[]>([])
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([])
  const [summary, setSummary] = useState<ResearchSummaryData>(EMPTY_SUMMARY)

  // Cross-tab handoffs (Overview -> Studies Evidence Drawer, Overview -> Autonomy Composer)
  const [inspectExp, setInspectExp] = useState<ExperimentRecord | null>(null)
  const [prefillOp, setPrefillOp] = useState<OpportunityItem | null>(null)

  const checkHanzodOnly = useCallback(
    async (signal?: AbortSignal): Promise<HanzodWorkerState | null> => {
      const origin = resolveLocalHanzodOrigin()
      if (!canProbeLocalHanzod(isDesktop)) {
        setHanzod((prev) => ({
          origin,
          mode: 'web-cloud',
          version: prev.version,
          sandbox: prev.sandbox,
          hanzo_vm_available: prev.hanzo_vm_available,
          worker: null,
          reconnectAttempts: 0,
          lastConnectedAt: prev.lastConnectedAt,
          lastError: null,
        }))
        return null
      }
      const probe = await probeHanzodState(origin, signal)
      if (probe.connected) {
        everConnectedRef.current = true
        reconnectAttemptsRef.current = 0
        setHanzod({
          origin: probe.origin,
          mode: 'connected',
          version: probe.version,
          sandbox: probe.sandbox,
          hanzo_vm_available: probe.hanzo_vm_available,
          worker: probe.worker,
          reconnectAttempts: 0,
          lastConnectedAt: Date.now(),
          lastError: null,
        })
        return probe.worker
      }

      const shouldReconnect = isDesktop || everConnectedRef.current
      if (shouldReconnect) {
        reconnectAttemptsRef.current += 1
      }
      setHanzod((prev) => ({
        origin: probe.origin,
        mode: shouldReconnect ? 'reconnecting' : 'web-cloud',
        version: prev.version,
        sandbox: prev.sandbox,
        hanzo_vm_available: prev.hanzo_vm_available,
        worker: null,
        reconnectAttempts: shouldReconnect ? reconnectAttemptsRef.current : 0,
        lastConnectedAt: prev.lastConnectedAt,
        lastError: probe.error ?? null,
      }))
      return null
    },
    [isDesktop],
  )

  const refreshAll = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true)
      setError(null)
      const ctl = new AbortController()
      try {
        const localWorker = await checkHanzodOnly(ctl.signal)
        const [stRows, bmRows, expRows, actRows, schRows, leaseRows] = await Promise.all([
          listStudies(undefined, ctl.signal).catch(() => [] as StudyRecord[]),
          listBenchmarks(undefined, ctl.signal).catch(() => [] as BenchmarkRecord[]),
          listExperiments({ includeHistoricalRetracted: true, signal: ctl.signal }).catch(
            () => [] as ExperimentRecord[],
          ),
          listWorkflowActivities('gpu-jobs', 50, ctl.signal).catch(() => [] as WorkflowActivity[]),
          listSchedules('gpu-jobs', ctl.signal).catch(() => [] as ScheduleRecord[]),
          listActiveCloudLeases(['default'], ctl.signal).catch(() => [] as CloudLeaseInfo[]),
        ])

        const [runRows, machineRows] = await Promise.all([
          listRuns({
            includeLocalHanzod: Boolean(localWorker),
            localOrigin: resolveLocalHanzodOrigin(),
            signal: ctl.signal,
          }).catch(() => [] as RunRecord[]),
          listLinkedMachines({
            localWorker,
            leases: leaseRows,
            signal: ctl.signal,
          }).catch(() => [] as LinkedMachine[]),
        ])

        const [opRows, summaryData] = await Promise.all([
          listOpportunities({
            studies: stRows,
            experiments: expRows,
            runs: runRows,
            signal: ctl.signal,
          }).catch(() => [] as OpportunityItem[]),
          buildResearchSummary({
            studies: stRows,
            benchmarks: bmRows,
            runs: runRows,
            experiments: expRows,
            machines: machineRows,
            activities: actRows,
            localRunningRuns: localWorker?.active_research_runs ?? 0,
            signal: ctl.signal,
          }),
        ])

        setStudies(stRows)
        setBenchmarks(bmRows)
        setExperiments(expRows)
        setRuns(runRows)
        setLeases(leaseRows)
        setMachines(machineRows)
        setActivities(actRows)
        setSchedules(schRows)
        setOpportunities(opRows)
        setSummary(summaryData)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setInitialLoading(false)
        setRefreshing(false)
      }
    },
    [checkHanzodOnly],
  )

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  // Automatic Desktop `hanzod` reconnect loop when `hanzod` restarts (preserves session & active view state)
  useEffect(() => {
    if (hanzod.mode !== 'reconnecting') return
    let cancelled = false
    const delayMs = Math.min(10_000, 1500 * 2 ** Math.min(hanzod.reconnectAttempts, 3))
    const timer = setTimeout(() => {
      if (cancelled) return
      void checkHanzodOnly().then((worker) => {
        if (worker && !cancelled) {
          void refreshAll(true)
        }
      })
    }, delayMs)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [hanzod.mode, hanzod.reconnectAttempts, checkHanzodOnly, refreshAll])

  const upsertActivity = useCallback((act: WorkflowActivity) => {
    setActivities((prev) => {
      const idx = prev.findIndex((x) => x.activityId === act.activityId)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = act
        return copy
      }
      return [act, ...prev]
    })
  }, [])

  const reloadSchedules = useCallback(async () => {
    const schRows = await listSchedules('gpu-jobs')
    setSchedules(schRows)
  }, [])

  const handleWorkerUpdated = useCallback((updated: HanzodWorkerState) => {
    setHanzod((prev) => ({
      ...prev,
      mode: 'connected',
      worker: updated,
      reconnectAttempts: 0,
    }))
    setMachines((prev) =>
      prev.map((m) =>
        m.is_local_hanzod || m.id === updated.worker_id
          ? {
              ...m,
              when_idle_only: updated.when_idle_only,
              targeted_only: updated.targeted_only,
              max_gpu_util_pct: updated.max_gpu_util_pct,
              busy: updated.busy,
              busy_reason: updated.busy_reason ?? '',
            }
          : m,
      ),
    )
  }, [])

  const activeOrgName = currentOrg() || 'personal'
  const projectName = activeProject()

  const tabCount = (tab: ScienceTab): number | undefined => {
    switch (tab) {
      case 'overview':
        return undefined
      case 'studies':
        return experiments.length || studies.length || undefined
      case 'autonomy':
        return opportunities.length || undefined
      case 'machines':
        return machines.length || undefined
      case 'schedules':
        return schedules.length || undefined
    }
  }

  return (
    <YStack
      data-slot="science-workbench"
      flex={1}
      minH={0}
      overflowY="auto"
      overflowX="hidden"
      p="$3.5"
      $md={{ p: '$6' }}
      gap="$4"
      $platform-web={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {/* Product Header & Active Transport Hierarchy */}
      <YStack gap="$2.5">
        <XStack items="flex-start" justify="space-between" flexWrap="wrap" gap="$3">
          <XStack items="center" gap="$3" flex={1} minW={0}>
            <XStack
              width={40}
              height={40}
              rounded="$3"
              bg="$raised"
              borderWidth={1}
              borderColor="$edge"
              items="center"
              justify="center"
              shrink={0}
            >
              <Atom size={20} aria-hidden />
            </XStack>
            <YStack gap={2} flex={1} minW={0}>
              <Text fontSize="$6" fontWeight="600" color="$ink" data-slot="science-title">
                Hanzo Science
              </Text>
              <Text fontSize="$2" color="$soft" data-slot="science-subtitle">
                {t('Research, discovery, experimentation and autonomous evolution')}
              </Text>
            </YStack>
          </XStack>

          <XStack items="center" gap="$2" flexWrap="wrap">
            <Button
              size="sm"
              variant="ghost"
              data-slot="science-refresh"
              disabled={refreshing}
              onPress={() => void refreshAll()}
            >
              <RefreshCw size={14} aria-hidden />
              {t('Refresh')}
            </Button>
          </XStack>
        </XStack>

        {/* Research Workspace & Transport Strip */}
        <XStack
          data-slot="science-workspace-strip"
          items="center"
          justify="space-between"
          flexWrap="wrap"
          gap="$2"
          px="$3"
          py="$2"
          rounded="$3"
          borderWidth={1}
          borderColor="$edge"
        >
          <XStack items="center" gap="$2" flexWrap="wrap">
            <Text fontSize="$1" fontWeight="600" color="$ink">
              {t('Research workspace')}
            </Text>
            <Text fontSize="$1" color="$quiet">
              · {t('One interface across Web, Desktop and Cloud')}
            </Text>
          </XStack>

          <XStack items="center" gap="$2" flexWrap="wrap">
            <XStack px="$2" py={2} rounded="$2" bg="$hover" items="center" gap="$1">
              <Cloud size={11} aria-hidden />
              <Text fontSize="$1" fontFamily="$mono" color="$ink">
                Cloud /v1/research ({activeOrgName}/{projectName})
              </Text>
            </XStack>
            <XStack
              px="$2"
              py={2}
              rounded="$2"
              bg={hanzod.mode === 'connected' ? '$raised' : '$hover'}
              items="center"
              gap="$1"
              data-slot="hanzod-transport-pill"
            >
              <Cpu size={11} aria-hidden />
              <Text fontSize="$1" fontFamily="$mono" color="$ink">
                {hanzod.mode === 'connected'
                  ? `hanzod (${hanzod.worker?.worker_id || hanzod.sandbox || 'local'})`
                  : hanzod.mode === 'reconnecting'
                    ? 'hanzod (reconnecting…)'
                    : 'hanzod (linked fleet)'}
              </Text>
            </XStack>
            <XStack px="$2" py={2} rounded="$2" bg="$hover" items="center" gap="$1">
              <Activity size={11} aria-hidden />
              <Text fontSize="$1" fontFamily="$mono" color="$ink">
                hanzoai/tasks (gpu-jobs)
              </Text>
            </XStack>
          </XStack>
        </XStack>
      </YStack>

      {/* Guest / Signed-Out Cloud Notice */}
      {!bearer() ? (
        <XStack
          data-slot="science-signin-banner"
          p="$3"
          rounded="$3"
          borderWidth={1}
          borderColor="$edge"
          bg="$raised"
          items="center"
          justify="space-between"
          flexWrap="wrap"
          gap="$2.5"
        >
          <YStack flex={1} minW={200} gap={2}>
            <Text fontSize="$2" fontWeight="600" color="$ink">
              {t('Viewing local Science workspace without a Cloud session')}
            </Text>
            <Text fontSize="$1" color="$quiet">
              {t('Local hanzod hardware & runs appear below. Sign in to load your organization’s Cloud studies, qualified discoveries, fleet leases, and schedules.')}
            </Text>
          </YStack>
          <Button
            size="sm"
            data-slot="science-signin-cta"
            onPress={() => {
              const target = `/login?next=${encodeURIComponent(currentPathname)}`
              if (onNavigate) onNavigate(target)
              else go(target)
            }}
          >
            {t('Sign in')}
          </Button>
        </XStack>
      ) : null}

      {/* Desktop hanzod Reconnect Banner (zero session or view state loss) */}
      {hanzod.mode === 'reconnecting' ? (
        <XStack
          data-slot="hanzod-reconnect-banner"
          p="$3"
          rounded="$3"
          borderWidth={1}
          borderColor="var(--border-strong)"
          bg="$hover"
          items="center"
          justify="space-between"
          flexWrap="wrap"
          gap="$2"
        >
          <XStack items="flex-start" gap="$2" flex={1} minW={200}>
            <XStack pt={2} shrink={0}>
              <ShieldAlert size={15} aria-hidden />
            </XStack>
            <Text fontSize="$2" color="$ink" flex={1} minW={0}>
              {t('Reconnecting to local hanzod')} ({hanzod.origin}, attempt #{Math.max(1, hanzod.reconnectAttempts)}) —{' '}
              {t('Cloud /v1/research and hanzoai/tasks remain live and your session state is preserved.')}
            </Text>
          </XStack>
          <Button
            size="sm"
            variant="outline"
            shrink={0}
            data-slot="hanzod-reconnect-now"
            onPress={() => void checkHanzodOnly().then((w) => (w ? refreshAll(true) : undefined))}
          >
            {t('Reconnect now')}
          </Button>
        </XStack>
      ) : null}

      {/* Exact 5-Tab Navigation Order: Overview · Studies · Autonomy · Machines · Schedules */}
      <XStack
        data-slot="science-tabs"
        role="tablist"
        aria-label="Hanzo Science sections"
        items="center"
        gap="$1"
        flexWrap="wrap"
        borderBottomWidth={1}
        borderColor="$edge"
        pb="$2"
      >
        {SCIENCE_TABS.map((id) => {
          const on = activeTab === id
          const count = tabCount(id)
          return (
            <XStack
              key={id}
              render="button"
              role="tab"
              aria-selected={on}
              data-slot={`science-tab-${id}`}
              onClick={() => navigateTab(id)}
              px="$3"
              py="$1.5"
              rounded="$3"
              bg={on ? '$raised' : 'transparent'}
              cursor="pointer"
              items="center"
              gap="$1.5"
              hoverStyle={{ bg: on ? '$raised' : '$hover' }}
            >
              <Text fontSize="$2" fontWeight={on ? '600' : '400'} color={on ? '$ink' : '$quiet'}>
                {t(SCIENCE_TAB_LABELS[id])}
              </Text>
              {typeof count === 'number' ? (
                <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                  {count}
                </Text>
              ) : null}
            </XStack>
          )
        })}
      </XStack>

      {error ? (
        <XStack p="$3" rounded="$3" bg="$hover" items="center" gap="$2">
          <ShieldAlert size={15} aria-hidden />
          <Text fontSize="$2" color="$ink">
            {error}
          </Text>
        </XStack>
      ) : null}

      {initialLoading ? (
        <YStack py="$8" items="center" justify="center" gap="$2">
          <Spinner size={24} />
          <Text fontSize="$2" color="$quiet">
            {t('Loading Hanzo Science workspace…')}
          </Text>
        </YStack>
      ) : null}

      {!initialLoading && activeTab === 'overview' ? (
        <OverviewTab
          summary={summary}
          experiments={experiments}
          opportunities={opportunities}
          machines={machines}
          onNavigateTab={navigateTab}
          onInspectExperiment={(exp) => {
            setInspectExp(exp)
            navigateTab('studies')
          }}
          onLaunchOpportunity={(op) => {
            setPrefillOp(op)
            navigateTab('autonomy')
          }}
        />
      ) : null}

      {!initialLoading && activeTab === 'studies' ? (
        <StudiesTab
          studies={studies}
          benchmarks={benchmarks}
          runs={runs}
          allExperiments={experiments}
          initialSelectedExperiment={inspectExp}
          onClearInitialExperiment={() => setInspectExp(null)}
        />
      ) : null}

      {!initialLoading && activeTab === 'autonomy' ? (
        <AutonomyTab
          opportunities={opportunities}
          experiments={experiments}
          machines={machines}
          activities={activities}
          prefillOpportunity={prefillOp}
          onClearPrefill={() => setPrefillOp(null)}
          onActivityUpdated={upsertActivity}
          onPreregistered={() => void refreshAll(true)}
        />
      ) : null}

      {!initialLoading && activeTab === 'machines' ? (
        <MachinesTab
          machines={machines}
          leases={leases}
          localWorker={hanzod.worker}
          activities={activities}
          onWorkerUpdated={handleWorkerUpdated}
          onActivityUpdated={upsertActivity}
        />
      ) : null}

      {!initialLoading && activeTab === 'schedules' ? (
        <SchedulesTab
          schedules={schedules}
          machines={machines}
          onReloadSchedules={reloadSchedules}
        />
      ) : null}
    </YStack>
  )
}

export default Science
