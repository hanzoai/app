'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Input, Switch, Text } from '@hanzo/ui'
import {
  CheckCircle2,
  Cpu,
  Lock,
  Play,
  RefreshCw,
  Server,
  ShieldAlert,
  SlidersHorizontal,
  Square,
  Terminal,
} from 'lucide-react'
import {
  cancelWorkflowActivity,
  configureHanzodWorker,
  describeWorkflowActivity,
  dispatchResearchActivities,
} from './api'
import type {
  CloudLeaseInfo,
  HanzodWorkerState,
  LinkedMachine,
  WorkflowActivity,
} from './types'

function shortStatus(raw: string): string {
  return raw.replace(/^ACTIVITY_TASK_STATE_/, '') || 'SCHEDULED'
}

export function MachinesTab({
  machines,
  leases,
  localWorker,
  activities,
  onWorkerUpdated,
  onActivityUpdated,
}: {
  machines: readonly LinkedMachine[]
  leases: readonly CloudLeaseInfo[]
  localWorker: HanzodWorkerState | null
  activities: readonly WorkflowActivity[]
  onWorkerUpdated: (w: HanzodWorkerState) => void
  onActivityUpdated: (act: WorkflowActivity) => void
}) {
  const { t } = useI18n()

  // Local hanzod worker configuration controls
  const [workerIdleOnly, setWorkerIdleOnly] = useState(localWorker?.when_idle_only ?? true)
  const [workerTargetedOnly, setWorkerTargetedOnly] = useState(localWorker?.targeted_only ?? false)
  const [workerMaxGpuPct, setWorkerMaxGpuPct] = useState(String(localWorker?.max_gpu_util_pct ?? 25))
  const [workerEnabled, setWorkerEnabled] = useState(localWorker?.enabled ?? true)

  useEffect(() => {
    if (localWorker) {
      setWorkerIdleOnly(localWorker.when_idle_only)
      setWorkerTargetedOnly(localWorker.targeted_only)
      setWorkerMaxGpuPct(String(localWorker.max_gpu_util_pct))
      setWorkerEnabled(localWorker.enabled)
    }
  }, [localWorker])

  // Multi-Machine Dispatch Control state
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['any'])
  const [customTargetInput, setCustomTargetInput] = useState('any')
  const [activityType, setActivityType] = useState<'research.bench' | 'research.tick' | 'hanzod.run'>('research.bench')
  const [benchmark, setBenchmark] = useState('kernel-bench')
  const [command, setCommand] = useState('hanzo-research bench --json')
  const [whenIdleOnly, setWhenIdleOnly] = useState(true)
  const [requiredBackend, setRequiredBackend] = useState('any')
  const [maxSeconds, setMaxSeconds] = useState('900')
  const [inspectedJobId, setInspectedJobId] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const toggleMachineTarget = (id: string) => {
    if (id === 'any') {
      setSelectedTargets(['any'])
      setCustomTargetInput('any')
      return
    }
    const withoutAny = selectedTargets.filter((x) => x !== 'any')
    const next = withoutAny.includes(id)
      ? withoutAny.filter((x) => x !== id)
      : [...withoutAny, id]
    const resolved = next.length > 0 ? next : ['any']
    setSelectedTargets(resolved)
    setCustomTargetInput(resolved.join(','))
  }

  const handleSaveWorkerConfig = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await configureHanzodWorker({
        enabled: workerEnabled,
        when_idle_only: workerIdleOnly,
        targeted_only: workerTargetedOnly,
        max_gpu_util_pct: Math.min(100, Math.max(1, Number(workerMaxGpuPct) || 25)),
      })
      onWorkerUpdated(updated)
      setNotice(
        `Updated local hanzod worker (${updated.worker_id}): when_idle_only=${updated.when_idle_only}, max_gpu_util_pct=${updated.max_gpu_util_pct}%`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDispatch = async () => {
    if (!command.trim()) {
      setError(t('Enter a command or benchmark invocation to dispatch.'))
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const dispatched = await dispatchResearchActivities({
        targets: customTargetInput.trim() || selectedTargets,
        activityType,
        benchmark: benchmark.trim(),
        command: command.trim(),
        whenIdleOnly,
        requiredBackend: requiredBackend !== 'any' ? requiredBackend : undefined,
        maxComputeSeconds: Math.max(30, Number(maxSeconds) || 900),
      })
      for (const act of dispatched) onActivityUpdated(act)
      if (dispatched[0]) setInspectedJobId(dispatched[0].activityId)
      setNotice(
        `Dispatched ${dispatched.length} job(s) (${dispatched.map((d) => `${d.activityId} → ${d.taskQueue}`).join(', ')})`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleRefreshJob = async (act: WorkflowActivity) => {
    try {
      const snap = await describeWorkflowActivity(act.activityId, act.runId)
      onActivityUpdated(snap)
      setInspectedJobId(snap.activityId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleCancelJob = async (act: WorkflowActivity) => {
    setBusy(true)
    setError(null)
    try {
      const snap = await cancelWorkflowActivity(act.activityId, act.runId, 'Canceled from Science Machines')
      onActivityUpdated(snap)
      setNotice(`Canceled activity ${act.activityId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const inspectedJob = activities.find((a) => a.activityId === inspectedJobId) ?? activities[0] ?? null

  return (
    <YStack data-slot="science-machines" gap="$5">
      {error ? (
        <XStack p="$3" rounded="$3" bg="$hover" items="center" gap="$2">
          <ShieldAlert size={15} aria-hidden />
          <Text fontSize="$2" color="$ink">
            {error}
          </Text>
        </XStack>
      ) : null}

      {notice ? (
        <XStack p="$3" rounded="$3" bg="$raised" items="center" gap="$2" data-slot="machines-notice">
          <CheckCircle2 size={15} aria-hidden />
          <Text fontSize="$2" color="$ink">
            {notice}
          </Text>
        </XStack>
      ) : null}

      {/* Desktop Local hanzod Worker Controls */}
      {localWorker ? (
        <YStack
          data-slot="local-hanzod-worker-controls"
          p="$4"
          rounded="$4"
          borderWidth={1}
          borderColor="var(--border-strong)"
          gap="$3"
        >
          <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
            <XStack items="center" gap="$2">
              <SlidersHorizontal size={16} aria-hidden />
              <YStack>
                <Text fontSize="$3" fontWeight="600" color="$ink">
                  {t('This Machine · Local hanzod Worker')} ({localWorker.worker_id})
                </Text>
                <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                  linked={String(localWorker.linked)} · sse={String(localWorker.sse_connected)} · queues={localWorker.queues.join(', ') || 'gpu-jobs'}
                  {localWorker.gpu_util_pct != null ? ` · gpu_util=${localWorker.gpu_util_pct.toFixed(1)}%` : ''}
                </Text>
              </YStack>
            </XStack>
            <XStack px="$2.5" py="$1" rounded="$3" bg={localWorker.busy ? '$hover' : '$raised'}>
              <Text fontSize="$1" fontWeight="600" color="$ink" fontFamily="$mono">
                {localWorker.busy ? `BUSY (${localWorker.busy_reason || 'active'})` : 'IDLE · READY'}
              </Text>
            </XStack>
          </XStack>

          <XStack gap="$4" flexWrap="wrap" items="center">
            <XStack items="center" gap="$2">
              <Switch
                data-slot="worker-enabled-switch"
                checked={workerEnabled}
                onCheckedChange={setWorkerEnabled}
              />
              <Text fontSize="$2" color="$ink">
                {t('Worker enabled')}
              </Text>
            </XStack>
            <XStack items="center" gap="$2">
              <Switch
                data-slot="worker-idle-only-switch"
                checked={workerIdleOnly}
                onCheckedChange={setWorkerIdleOnly}
              />
              <Text fontSize="$2" color="$ink">
                {t('when_idle_only')}
              </Text>
            </XStack>
            <XStack items="center" gap="$2">
              <Switch
                data-slot="worker-targeted-only-switch"
                checked={workerTargetedOnly}
                onCheckedChange={setWorkerTargetedOnly}
              />
              <Text fontSize="$2" color="$ink">
                {t('Targeted queue only')}
              </Text>
            </XStack>
            <XStack items="center" gap="$2">
              <Text fontSize="$1" color="$quiet">
                {t('Max GPU util %:')}
              </Text>
              <YStack width={84}>
                <Input
                  data-slot="worker-max-gpu-input"
                  value={workerMaxGpuPct}
                  onChangeText={setWorkerMaxGpuPct}
                />
              </YStack>
            </XStack>
            <Button
              size="sm"
              data-slot="worker-save-btn"
              disabled={busy}
              onPress={() => void handleSaveWorkerConfig()}
            >
              {t('Apply Worker Policy')}
            </Button>
          </XStack>
        </YStack>
      ) : null}

      {/* Linked Fleet & Compute Workers */}
      <YStack gap="$3">
        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
          <XStack items="center" gap="$2">
            <Server size={16} aria-hidden />
            <Text fontSize="$3" fontWeight="600" color="$ink">
              {t('Linked Fleet & Compute Nodes')} ({machines.length})
            </Text>
          </XStack>
          <Text fontSize="$1" color="$quiet" fontFamily="$mono">
            GET /v1/compute/fleet/workers + /v1/hanzod/worker
          </Text>
        </XStack>

        {machines.length === 0 ? (
          <YStack p="$5" rounded="$4" borderWidth={1} borderColor="$edge" items="center" gap="$1">
            <Text fontSize="$2" color="$quiet">
              {t('No linked machines registered in this org yet. Run `hanzo link` or start Hanzo Desktop (`hanzod`) to link GPU nodes.')}
            </Text>
          </YStack>
        ) : (
          <XStack gap="$3" flexWrap="wrap">
            {machines.map((m) => {
              const isSelected = selectedTargets.includes(m.id)
              return (
                <YStack
                  key={m.id}
                  data-slot={`machine-card-${m.id}`}
                  flex={1}
                  minW={290}
                  p="$4"
                  rounded="$4"
                  borderWidth={1}
                  borderColor={isSelected ? 'var(--border-strong)' : '$edge'}
                  bg={isSelected ? '$raised' : 'transparent'}
                  gap="$2.5"
                >
                  <XStack items="center" justify="space-between" gap="$2">
                    <XStack items="center" gap="$2">
                      <Cpu size={15} aria-hidden />
                      <Text fontSize="$3" fontWeight="600" color="$ink">
                        {m.id}
                      </Text>
                      {m.is_local_hanzod ? (
                        <XStack px="$1.5" py={1} rounded="$2" bg="$hover">
                          <Text fontSize="$1" fontFamily="$mono" color="$ink">
                            local hanzod
                          </Text>
                        </XStack>
                      ) : null}
                    </XStack>
                    <XStack px="$2" py={2} rounded="$2" bg={m.online ? '$raised' : '$hover'}>
                      <Text fontSize="$1" fontWeight="600" color={m.online ? '$ink' : '$quiet'} fontFamily="$mono">
                        {m.online ? (m.busy ? 'ONLINE · BUSY' : 'ONLINE · IDLE') : 'OFFLINE'}
                      </Text>
                    </XStack>
                  </XStack>

                  <Text fontSize="$1" color="$soft" fontFamily="$mono">
                    host={m.hostname} · {m.os || 'linux'}/{m.arch || 'x86_64'}
                    {m.cpus > 0 ? ` · ${m.cpus} CPU` : ''}
                    {m.memory_gb > 0 ? ` · ${m.memory_gb} GB` : ''}
                  </Text>

                  {m.gpus.length > 0 ? (
                    <YStack gap="$1">
                      {m.gpus.map((g, gi) => (
                        <Text key={`${g.name}-${gi}`} fontSize="$2" fontWeight="500" color="$ink">
                          {g.name}
                          {g.arch ? ` (${g.arch})` : ''}
                          {g.memoryTotal ? ` · ${g.memoryTotal}` : ''}
                        </Text>
                      ))}
                    </YStack>
                  ) : (
                    <Text fontSize="$1" color="$quiet">
                      {m.capacity || 'CPU / Unified execution node'}
                    </Text>
                  )}

                  <XStack gap="$1.5" flexWrap="wrap">
                    {m.backends.map((b) => (
                      <XStack key={b} px="$1.5" py={1} rounded="$2" bg="$hover">
                        <Text fontSize="$1" fontFamily="$mono" color="$soft">
                          {b}
                        </Text>
                      </XStack>
                    ))}
                    {m.capabilities.map((cap) => (
                      <XStack key={cap} px="$1.5" py={1} rounded="$2" bg="$hover">
                        <Text fontSize="$1" fontFamily="$mono" color="$quiet">
                          {cap}
                        </Text>
                      </XStack>
                    ))}
                  </XStack>

                  {m.busy || m.busy_reason ? (
                    <Text fontSize="$1" color="$ink" fontFamily="$mono" data-slot={`machine-busy-${m.id}`}>
                      busy_reason: {m.busy_reason || 'active_workload'}
                    </Text>
                  ) : null}

                  {m.active_lease ? (
                    <XStack items="center" gap="$1.5" p="$2" rounded="$2" bg="$hover">
                      <Lock size={12} aria-hidden />
                      <Text fontSize="$1" color="$soft" fontFamily="$mono">
                        lease {m.active_lease.campaign}/{m.active_lease.opportunity_id} (fence #{m.active_lease.fencing_token})
                      </Text>
                    </XStack>
                  ) : null}

                  <XStack items="center" justify="space-between" pt="$1">
                    <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                      queue: {m.task_queue}
                    </Text>
                    <Button
                      size="sm"
                      variant="outline"
                      bg={isSelected ? '$raised' : 'transparent'}
                      borderColor={isSelected ? 'var(--border-strong)' : '$edge'}
                      aria-pressed={isSelected}
                      data-slot={`select-machine-${m.id}`}
                      onPress={() => toggleMachineTarget(m.id)}
                    >
                      {isSelected ? t('Targeted ✓') : t('Target')}
                    </Button>
                  </XStack>
                </YStack>
              )
            })}
          </XStack>
        )}
      </YStack>

      {/* Active Cloud Leases Summary */}
      {leases.length > 0 ? (
        <YStack p="$3.5" rounded="$4" borderWidth={1} borderColor="$edge" gap="$2">
          <XStack items="center" gap="$2">
            <Lock size={14} aria-hidden />
            <Text fontSize="$2" fontWeight="600" color="$ink">
              {t('Active Cross-Machine Fencing Leases (/v1/research/evidence)')}
            </Text>
          </XStack>
          {leases.map((ls) => (
            <XStack key={ls.uri} justify="space-between" flexWrap="wrap" gap="$2">
              <Text fontSize="$1" color="$soft" fontFamily="$mono">
                {ls.uri} · holder={ls.owner_worker_id} ({ls.host})
              </Text>
              <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                fencing_token=#{ls.fencing_token} · state={ls.state}
              </Text>
            </XStack>
          ))}
        </YStack>
      ) : null}

      {/* Multi-Machine Dispatch Control */}
      <YStack
        data-slot="multi-machine-dispatch"
        p="$4"
        rounded="$4"
        borderWidth={1}
        borderColor="$edge"
        gap="$3.5"
      >
        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
          <XStack items="center" gap="$2">
            <Terminal size={16} aria-hidden />
            <YStack>
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Multi-Machine Dispatch Control')}
              </Text>
              <Text fontSize="$1" color="$quiet">
                {t('Single target, cross-architecture fan-out (e.g. evo,dgx), or shared gpu-jobs lane')}
              </Text>
            </YStack>
          </XStack>
          <XStack gap="$1.5">
            {(['research.bench', 'research.tick', 'hanzod.run'] as const).map((tp) => (
              <Button
                key={tp}
                size="sm"
                variant={activityType === tp ? 'outline' : 'ghost'}
                bg={activityType === tp ? '$raised' : 'transparent'}
                aria-pressed={activityType === tp}
                onPress={() => setActivityType(tp)}
              >
                {tp}
              </Button>
            ))}
          </XStack>
        </XStack>

        <XStack gap="$1.5" flexWrap="wrap" items="center">
          <Text fontSize="$1" color="$quiet">
            {t('Targets:')}
          </Text>
          <XStack
            render="button"
            data-slot="target-chip-any"
            onClick={() => toggleMachineTarget('any')}
            px="$2.5"
            py="$1"
            rounded="$3"
            borderWidth={1}
            borderColor={selectedTargets.includes('any') ? 'var(--border-strong)' : '$edge'}
            bg={selectedTargets.includes('any') ? '$raised' : 'transparent'}
            cursor="pointer"
          >
            <Text fontSize="$1" fontFamily="$mono" color="$ink">
              any (gpu-jobs)
            </Text>
          </XStack>
          {machines.map((m) => (
            <XStack
              key={m.id}
              render="button"
              data-slot={`target-chip-${m.id}`}
              onClick={() => toggleMachineTarget(m.id)}
              px="$2.5"
              py="$1"
              rounded="$3"
              borderWidth={1}
              borderColor={selectedTargets.includes(m.id) ? 'var(--border-strong)' : '$edge'}
              bg={selectedTargets.includes(m.id) ? '$raised' : 'transparent'}
              cursor="pointer"
            >
              <Text fontSize="$1" fontFamily="$mono" color="$ink">
                {m.id}
              </Text>
            </XStack>
          ))}
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          <YStack width={220}>
            <Input
              data-slot="dispatch-targets-input"
              placeholder={t('Targets (evo, dgx, evo,dgx, or any)')}
              value={customTargetInput}
              onChangeText={setCustomTargetInput}
            />
          </YStack>
          <YStack width={200}>
            <Input
              data-slot="dispatch-benchmark-input"
              placeholder={t('Benchmark slug')}
              value={benchmark}
              onChangeText={setBenchmark}
            />
          </YStack>
          <YStack width={140}>
            <Input
              placeholder={t('Backend (any/CUDA/ROCM)')}
              value={requiredBackend}
              onChangeText={setRequiredBackend}
            />
          </YStack>
          <YStack width={130}>
            <Input
              placeholder={t('Timeout (s)')}
              value={maxSeconds}
              onChangeText={setMaxSeconds}
            />
          </YStack>
        </XStack>

        <Input
          data-slot="dispatch-command-input"
          placeholder={t('Command (e.g. python3 bench_decode.py --json or hanzo-research run)')}
          value={command}
          onChangeText={setCommand}
        />

        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$3">
          <XStack items="center" gap="$2.5">
            <Switch
              data-slot="dispatch-idle-only-switch"
              checked={whenIdleOnly}
              onCheckedChange={setWhenIdleOnly}
            />
            <Text fontSize="$2" color="$ink">
              {whenIdleOnly
                ? t('when_idle_only = true (defer & retry when machine is busy)')
                : t('allow_when_busy = true (execute immediately alongside active work)')}
            </Text>
          </XStack>
          <Button
            size="sm"
            data-slot="dispatch-submit-btn"
            disabled={busy}
            onPress={() => void handleDispatch()}
          >
            <Play size={14} aria-hidden />
            {t('Dispatch to Selected Machine(s)')}
          </Button>
        </XStack>
      </YStack>

      {/* Dispatched Jobs & Live Output Inspector */}
      <YStack
        data-slot="dispatched-jobs-inspector"
        p="$4"
        rounded="$4"
        borderWidth={1}
        borderColor="$edge"
        gap="$3"
      >
        <Text fontSize="$3" fontWeight="600" color="$ink">
          {t('Dispatched Machine Activities & Live Results')} ({activities.length})
        </Text>

        {activities.length === 0 ? (
          <Text fontSize="$2" color="$quiet">
            {t('No activities in gpu-jobs yet.')}
          </Text>
        ) : (
          <XStack gap="$4" flexWrap="wrap" items="flex-start">
            <YStack flex={1} minW={280} gap="$2">
              {activities.slice(0, 12).map((act) => {
                const st = shortStatus(act.status)
                const active = st === 'SCHEDULED' || st === 'STARTED'
                const selected = inspectedJob?.activityId === act.activityId
                return (
                  <YStack
                    key={`${act.activityId}-${act.runId}`}
                    render="button"
                    onClick={() => setInspectedJobId(act.activityId)}
                    p="$3"
                    rounded="$3"
                    borderWidth={1}
                    borderColor={selected ? 'var(--border-strong)' : '$edge'}
                    bg={selected ? '$raised' : 'transparent'}
                    gap="$1.5"
                    items="flex-start"
                    cursor="pointer"
                  >
                    <XStack width="100%" items="center" justify="space-between" gap="$2">
                      <Text fontSize="$2" fontWeight="600" color="$ink" fontFamily="$mono" numberOfLines={1}>
                        {act.activityId}
                      </Text>
                      <Text fontSize="$1" fontWeight="600" color="$ink" fontFamily="$mono">
                        {st}
                      </Text>
                    </XStack>
                    <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                      {act.taskQueue} · {act.activityType} · attempt #{act.attempt}
                      {act.durationMs != null ? ` · ${(act.durationMs / 1000).toFixed(2)}s` : ''}
                    </Text>
                    <XStack gap="$1.5" pt="$1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => void handleRefreshJob(act)}
                      >
                        <RefreshCw size={12} aria-hidden />
                        {t('Refresh')}
                      </Button>
                      {active ? (
                        <Button
                          size="sm"
                          variant="outline"
                          data-slot={`cancel-job-${act.activityId}`}
                          onPress={() => void handleCancelJob(act)}
                        >
                          <Square size={12} aria-hidden />
                          {t('Cancel')}
                        </Button>
                      ) : null}
                    </XStack>
                  </YStack>
                )
              })}
            </YStack>

            {inspectedJob ? (
              <YStack
                data-slot="job-output-panel"
                flex={1}
                minW={300}
                p="$3.5"
                rounded="$3"
                borderWidth={1}
                borderColor="$edge"
                gap="$2"
              >
                <Text fontSize="$2" fontWeight="600" color="$ink" fontFamily="$mono">
                  {inspectedJob.activityId}
                </Text>
                <Text fontSize="$1" color="$soft" fontFamily="$mono">
                  status={shortStatus(inspectedJob.status)} · queue={inspectedJob.taskQueue}
                  {inspectedJob.workerIdentity ? ` · worker=${inspectedJob.workerIdentity}` : ''}
                  {inspectedJob.durationMs != null ? ` · duration=${(inspectedJob.durationMs / 1000).toFixed(2)}s` : ''}
                </Text>
                {inspectedJob.deferCount > 0 ? (
                  <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                    deferred {inspectedJob.deferCount}× ({inspectedJob.lastBusyReason || 'busy'})
                  </Text>
                ) : null}
                {inspectedJob.failure ? (
                  <YStack p="$2.5" rounded="$2" bg="$hover">
                    <Text fontSize="$1" color="$ink" fontFamily="$mono">
                      {inspectedJob.failure}
                    </Text>
                  </YStack>
                ) : null}
                <YStack p="$2.5" rounded="$2" bg="$hover" maxH={240} overflowY="auto">
                  <Text fontSize="$1" color="$soft" fontFamily="$mono">
                    {JSON.stringify(
                      inspectedJob.result !== undefined
                        ? { result: inspectedJob.result }
                        : { input: inspectedJob.input ?? {} },
                      null,
                      2,
                    )}
                  </Text>
                </YStack>
              </YStack>
            ) : null}
          </XStack>
        )}
      </YStack>
    </YStack>
  )
}
