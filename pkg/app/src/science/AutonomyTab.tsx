'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Input, Switch, Text } from '@hanzo/ui'
import {
  Activity,
  CheckCircle2,
  FlaskConical,
  GitBranch,
  Play,
  Radio,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Square,
} from 'lucide-react'
import {
  cancelWorkflowActivity,
  describeWorkflowActivity,
  dispatchResearchActivities,
  filePreregistration,
  subscribeWorkflowEvents,
} from './api'
import {
  classifyVerdict,
  verdictLabel,
  type EvidenceRecord,
  type ExperimentRecord,
  type LinkedMachine,
  type OpportunityItem,
  type WorkflowActivity,
  type WorkflowSseEvent,
} from './types'

function shortActivityStatus(raw: string): string {
  return raw.replace(/^ACTIVITY_TASK_STATE_/, '') || 'SCHEDULED'
}

export function AutonomyTab({
  opportunities,
  experiments,
  machines,
  activities,
  prefillOpportunity,
  onClearPrefill,
  onActivityUpdated,
  onPreregistered,
}: {
  opportunities: readonly OpportunityItem[]
  experiments: readonly ExperimentRecord[]
  machines: readonly LinkedMachine[]
  activities: readonly WorkflowActivity[]
  prefillOpportunity?: OpportunityItem | null
  onClearPrefill?: () => void
  onActivityUpdated: (act: WorkflowActivity) => void
  onPreregistered: (ev: EvidenceRecord) => void
}) {
  const { t } = useI18n()

  // Pre-registration Composer state
  const [study, setStudy] = useState('kernel-attention')
  const [hypothesis, setHypothesis] = useState('')
  const [nullHypothesis, setNullHypothesis] = useState('')
  const [metric, setMetric] = useState('tok_per_sec')
  const [targetDelta, setTargetDelta] = useState('0.10')
  const [higherIsBetter, setHigherIsBetter] = useState(true)
  const [manifestSha256, setManifestSha256] = useState('')
  const [evidenceKind, setEvidenceKind] = useState<'requirement' | 'analysis'>('requirement')
  const [screeningSamples, setScreeningSamples] = useState('16')
  const [qualificationSamples, setQualificationSamples] = useState('128')
  const [maxComputeSeconds, setMaxComputeSeconds] = useState('600')
  const [maxCostUsd, setMaxCostUsd] = useState('25')
  const [anytimeValid, setAnytimeValid] = useState(true)
  const [relatedOpportunityId, setRelatedOpportunityId] = useState('')

  // Optional immediate dispatch to `hanzoai/tasks`
  const [dispatchImmediately, setDispatchImmediately] = useState(true)
  const [activityType, setActivityType] = useState<'research.bench' | 'research.tick'>('research.bench')
  const [targetMachine, setTargetMachine] = useState('any')
  const [command, setCommand] = useState('hanzo-research run --progressive-screen')
  const [whenIdleOnly, setWhenIdleOnly] = useState(true)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [filedRecords, setFiledRecords] = useState<EvidenceRecord[]>([])

  // Live SSE Event Stream state (`/v1/workflow/events`)
  const [sseState, setSseState] = useState<'connected' | 'reconnecting' | 'unsupported'>('reconnecting')
  const [events, setEvents] = useState<WorkflowSseEvent[]>([])

  useEffect(() => {
    if (prefillOpportunity) {
      setStudy(prefillOpportunity.domain || 'general')
      setHypothesis(prefillOpportunity.proposed_approach)
      setNullHypothesis(`No statistically significant improvement over ${prefillOpportunity.current_best}`)
      setTargetDelta(String(prefillOpportunity.expected_improvement || 0.1))
      setRelatedOpportunityId(prefillOpportunity.opportunity_id)
      onClearPrefill?.()
    }
  }, [prefillOpportunity, onClearPrefill])

  useEffect(() => {
    const ctl = new AbortController()
    void subscribeWorkflowEvents({
      signal: ctl.signal,
      onConnectionChange: (st) => setSseState(st),
      onEvent: (ev) => {
        setEvents((prev) => [ev, ...prev].slice(0, 25))
        if (ev.activityId) {
          void describeWorkflowActivity(ev.activityId, ev.runId)
            .then((snap) => onActivityUpdated(snap))
            .catch(() => {})
        }
      },
    })
    return () => ctl.abort()
  }, [onActivityUpdated])

  const loadOpportunity = (op: OpportunityItem) => {
    setStudy(op.domain || 'general')
    setHypothesis(op.proposed_approach)
    setNullHypothesis(`Effect delta <= 0 against baseline ${op.current_best}`)
    setTargetDelta(String(op.expected_improvement || 0.1))
    setRelatedOpportunityId(op.opportunity_id)
  }

  const handleSubmitComposer = async () => {
    if (!study.trim() || !hypothesis.trim() || !nullHypothesis.trim() || !metric.trim()) {
      setError(t('Study, falsifiable hypothesis, null hypothesis, and metric are required.'))
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const filed = await filePreregistration({
        study: study.trim(),
        hypothesis: hypothesis.trim(),
        nullHypothesis: nullHypothesis.trim(),
        metric: metric.trim(),
        targetDelta: Number(targetDelta) || 0.05,
        higherIsBetter,
        manifestSha256: manifestSha256.trim() || 'sha256:canonical-manifest',
        evidenceKind,
        screeningSamples: Math.max(1, Math.floor(Number(screeningSamples) || 16)),
        qualificationSamples: Math.max(1, Math.floor(Number(qualificationSamples) || 128)),
        maxComputeSeconds: Math.max(10, Math.floor(Number(maxComputeSeconds) || 600)),
        maxCostUsd: Math.max(0, Number(maxCostUsd) || 25),
        anytimeValid,
        relatedOpportunityId: relatedOpportunityId.trim() || undefined,
      })
      setFiledRecords((prev) => [filed, ...prev])
      onPreregistered(filed)

      if (dispatchImmediately) {
        const contentObj = (filed.content ?? {}) as Record<string, unknown>
        const hypId = typeof contentObj.hypothesis_id === 'string' ? contentObj.hypothesis_id : `sha256:${filed.hash}`
        const dispatched = await dispatchResearchActivities({
          targets: targetMachine,
          activityType,
          command: command.trim(),
          study: study.trim(),
          hypothesisId: hypId,
          whenIdleOnly,
          maxComputeSeconds: Math.max(30, Math.floor(Number(maxComputeSeconds) || 600)),
          extraInput: {
            evidence_uri: filed.uri,
            evidence_version: filed.version,
            metric: metric.trim(),
            target_delta: Number(targetDelta) || 0.05,
            screening_samples: Math.max(1, Math.floor(Number(screeningSamples) || 16)),
            qualification_samples: Math.max(1, Math.floor(Number(qualificationSamples) || 128)),
          },
        })
        for (const act of dispatched) onActivityUpdated(act)
        setNotice(
          `Filed pre-registration ${filed.uri} (v${filed.version || 1}) and dispatched ${dispatched.length} ${activityType} job(s) to ${dispatched.map((d) => d.taskQueue).join(', ')}`,
        )
      } else {
        setNotice(`Filed pre-registration evidence ${filed.uri} (v${filed.version || 1}, kind=${filed.kind})`)
      }
      setHypothesis('')
      setNullHypothesis('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const refreshSingleActivity = async (act: WorkflowActivity) => {
    try {
      const updated = await describeWorkflowActivity(act.activityId, act.runId)
      onActivityUpdated(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const cancelSingleActivity = async (act: WorkflowActivity) => {
    try {
      const updated = await cancelWorkflowActivity(act.activityId, act.runId)
      onActivityUpdated(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // Autonomous follow-up lineage edges
  const lineageRows = experiments.filter(
    (e) => Boolean(e.meta?.parent_experiment || (e.meta?.parent_ids && e.meta.parent_ids.length > 0) || e.meta?.next_hypothesis),
  )

  return (
    <YStack data-slot="science-autonomy" gap="$5">
      {error ? (
        <XStack p="$3" rounded="$3" bg="$hover" items="center" gap="$2">
          <ShieldAlert size={15} aria-hidden />
          <Text fontSize="$2" color="$ink">
            {error}
          </Text>
        </XStack>
      ) : null}

      {notice ? (
        <XStack p="$3" rounded="$3" bg="$raised" items="center" gap="$2" data-slot="autonomy-notice">
          <CheckCircle2 size={15} aria-hidden />
          <Text fontSize="$2" color="$ink">
            {notice}
          </Text>
        </XStack>
      ) : null}

      {/* New Hypothesis & Pre-Registration Composer */}
      <YStack
        data-slot="preregistration-composer"
        p="$4"
        rounded="$4"
        borderWidth={1}
        borderColor="$edge"
        gap="$3.5"
      >
        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
          <XStack items="center" gap="$2">
            <FlaskConical size={16} aria-hidden />
            <YStack>
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('New Hypothesis & Pre-Registration Composer')}
              </Text>
              <Text fontSize="$1" color="$quiet">
                {t('Files a versioned Evidence record (POST /v1/research/evidence) with progressive screening gates')}
              </Text>
            </YStack>
          </XStack>
          <XStack gap="$1.5">
            <Button
              size="sm"
              variant={evidenceKind === 'requirement' ? 'primary' : 'ghost'}
              onPress={() => setEvidenceKind('requirement')}
            >
              {t('kind: requirement')}
            </Button>
            <Button
              size="sm"
              variant={evidenceKind === 'analysis' ? 'primary' : 'ghost'}
              onPress={() => setEvidenceKind('analysis')}
            >
              {t('kind: analysis')}
            </Button>
          </XStack>
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          <YStack flex={1} minW={180}>
            <Input
              data-slot="composer-study"
              placeholder={t('Study / campaign (e.g. kernel-attention)')}
              value={study}
              onChangeText={setStudy}
            />
          </YStack>
          <YStack flex={1} minW={150}>
            <Input
              data-slot="composer-metric"
              placeholder={t('Primary metric (e.g. tok_per_sec)')}
              value={metric}
              onChangeText={setMetric}
            />
          </YStack>
          <YStack width={130}>
            <Input
              data-slot="composer-delta"
              placeholder={t('Target Δ')}
              value={targetDelta}
              onChangeText={setTargetDelta}
            />
          </YStack>
          <YStack flex={1} minW={220}>
            <Input
              data-slot="composer-manifest"
              placeholder={t('Dataset / model manifest SHA-256')}
              value={manifestSha256}
              onChangeText={setManifestSha256}
            />
          </YStack>
        </XStack>

        <Input
          data-slot="composer-hypothesis"
          placeholder={t('Falsifiable hypothesis (e.g. Split-K FlashDecode lifts gfx1151 tok/s by >= 12% at 32k context)')}
          value={hypothesis}
          onChangeText={setHypothesis}
        />

        <Input
          data-slot="composer-null"
          placeholder={t('Null hypothesis H₀ (e.g. Lift < 12%, 95% CI overlaps baseline, or max_abs_diff > 1e-3)')}
          value={nullHypothesis}
          onChangeText={setNullHypothesis}
        />

        {/* Progressive Screening & Budget */}
        <XStack gap="$2" flexWrap="wrap" items="center">
          <YStack width={150}>
            <Input
              placeholder={t('Screening N')}
              value={screeningSamples}
              onChangeText={setScreeningSamples}
            />
          </YStack>
          <YStack width={150}>
            <Input
              placeholder={t('Qualification N')}
              value={qualificationSamples}
              onChangeText={setQualificationSamples}
            />
          </YStack>
          <YStack width={150}>
            <Input
              placeholder={t('Max seconds')}
              value={maxComputeSeconds}
              onChangeText={setMaxComputeSeconds}
            />
          </YStack>
          <YStack width={140}>
            <Input
              placeholder={t('Max USD')}
              value={maxCostUsd}
              onChangeText={setMaxCostUsd}
            />
          </YStack>
          <XStack items="center" gap="$2" pl="$2">
            <Switch checked={anytimeValid} onCheckedChange={setAnytimeValid} />
            <Text fontSize="$1" color="$soft">
              {t('Anytime-valid e-process')}
            </Text>
          </XStack>
          <XStack items="center" gap="$2" pl="$2">
            <Switch checked={higherIsBetter} onCheckedChange={setHigherIsBetter} />
            <Text fontSize="$1" color="$soft">
              {t('Higher is better')}
            </Text>
          </XStack>
        </XStack>

        {/* Immediate Dispatch to hanzoai/tasks */}
        <YStack p="$3" rounded="$3" borderWidth={1} borderColor="$edge" gap="$2.5">
          <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
            <XStack items="center" gap="$2">
              <Switch
                data-slot="composer-dispatch-toggle"
                checked={dispatchImmediately}
                onCheckedChange={setDispatchImmediately}
              />
              <Text fontSize="$2" fontWeight="600" color="$ink">
                {t('Dispatch live experiment immediately to hanzoai/tasks (gpu-jobs)')}
              </Text>
            </XStack>
            {dispatchImmediately ? (
              <XStack gap="$1.5">
                <Button
                  size="sm"
                  variant={activityType === 'research.bench' ? 'primary' : 'ghost'}
                  onPress={() => setActivityType('research.bench')}
                >
                  research.bench
                </Button>
                <Button
                  size="sm"
                  variant={activityType === 'research.tick' ? 'primary' : 'ghost'}
                  onPress={() => setActivityType('research.tick')}
                >
                  research.tick
                </Button>
              </XStack>
            ) : null}
          </XStack>

          {dispatchImmediately ? (
            <XStack gap="$2" flexWrap="wrap" items="center">
              <YStack width={200}>
                <Input
                  data-slot="composer-target-machine"
                  placeholder={t('Target (any, evo, dgx, evo,dgx)')}
                  value={targetMachine}
                  onChangeText={setTargetMachine}
                />
              </YStack>
              <YStack flex={1} minW={240}>
                <Input
                  data-slot="composer-command"
                  placeholder={t('Command')}
                  value={command}
                  onChangeText={setCommand}
                />
              </YStack>
              <XStack items="center" gap="$2">
                <Switch checked={whenIdleOnly} onCheckedChange={setWhenIdleOnly} />
                <Text fontSize="$1" color="$soft">
                  {t('when_idle_only')}
                </Text>
              </XStack>
            </XStack>
          ) : null}

          {dispatchImmediately && machines.length > 0 ? (
            <XStack gap="$1.5" flexWrap="wrap" items="center">
              <Text fontSize="$1" color="$quiet">
                {t('Quick target:')}
              </Text>
              {['any', ...machines.map((m) => m.id)].slice(0, 6).map((tid) => (
                <XStack
                  key={tid}
                  render="button"
                  onClick={() => setTargetMachine(tid)}
                  px="$2"
                  py={2}
                  rounded="$2"
                  bg={targetMachine === tid ? '$raised' : '$hover'}
                  cursor="pointer"
                >
                  <Text fontSize="$1" fontFamily="$mono" color="$ink">
                    {tid}
                  </Text>
                </XStack>
              ))}
            </XStack>
          ) : null}
        </YStack>

        <XStack justify="flex-end" gap="$2">
          <Button
            size="sm"
            data-slot="composer-submit"
            disabled={busy}
            onPress={() => void handleSubmitComposer()}
          >
            <Play size={14} aria-hidden />
            {dispatchImmediately
              ? t('Pre-register & Dispatch Experiment')
              : t('File Pre-Registration Evidence')}
          </Button>
        </XStack>

        {filedRecords.length > 0 ? (
          <YStack gap="$1" pt="$1">
            {filedRecords.slice(0, 3).map((rec) => (
              <Text key={`${rec.uri}@${rec.version}`} fontSize="$1" color="$quiet" fontFamily="$mono">
                Filed: {rec.uri} · v{rec.version} · sha256:{rec.hash.slice(0, 16)}…
              </Text>
            ))}
          </YStack>
        ) : null}
      </YStack>

      <XStack gap="$4" flexWrap="wrap" items="flex-start">
        {/* Ranked Opportunities Queue */}
        <YStack
          data-slot="ranked-opportunities-queue"
          flex={1}
          minW={320}
          p="$4"
          rounded="$4"
          borderWidth={1}
          borderColor="$edge"
          gap="$3"
        >
          <XStack items="center" justify="space-between">
            <XStack items="center" gap="$2">
              <Sparkles size={16} aria-hidden />
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Ranked Opportunities Queue')} ({opportunities.length})
              </Text>
            </XStack>
          </XStack>

          {opportunities.length === 0 ? (
            <Text fontSize="$2" color="$quiet">
              {t('No queued opportunities in /v1/research/evidence or experiment follow-ups yet.')}
            </Text>
          ) : (
            <YStack gap="$2">
              {opportunities.map((op) => (
                <YStack
                  key={op.opportunity_id}
                  data-slot={`autonomy-op-${op.opportunity_id}`}
                  p="$3"
                  rounded="$3"
                  borderWidth={1}
                  borderColor="$edge"
                  gap="$1.5"
                >
                  <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
                    <XStack items="center" gap="$1.5">
                      <Text fontSize="$2" fontWeight="600" color="$ink">
                        {op.domain}
                      </Text>
                      <XStack px="$1.5" py={1} rounded="$2" bg="$hover">
                        <Text fontSize="$1" fontFamily="$mono" color="$soft">
                          {op.axis}
                        </Text>
                      </XStack>
                      <XStack px="$1.5" py={1} rounded="$2" bg="$hover">
                        <Text fontSize="$1" fontFamily="$mono" color="$quiet">
                          {op.status}
                        </Text>
                      </XStack>
                    </XStack>
                    <Text fontSize="$1" fontFamily="$mono" color="$ink">
                      +{Math.round(op.expected_improvement * 100)}% · priority {op.priority_score.toFixed(2)}
                    </Text>
                  </XStack>
                  <Text fontSize="$2" color="$soft">
                    {op.proposed_approach}
                  </Text>
                  <XStack items="center" justify="space-between" pt="$1">
                    <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                      {op.trigger_rule}
                    </Text>
                    <Button size="sm" variant="outline" onPress={() => loadOpportunity(op)}>
                      {t('Load into Composer')}
                    </Button>
                  </XStack>
                </YStack>
              ))}
            </YStack>
          )}
        </YStack>

        {/* Live Execution & Event Stream */}
        <YStack
          data-slot="live-execution-stream"
          flex={1}
          minW={320}
          p="$4"
          rounded="$4"
          borderWidth={1}
          borderColor="$edge"
          gap="$3"
        >
          <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
            <XStack items="center" gap="$2">
              <Activity size={16} aria-hidden />
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Live Execution & Event Stream')}
              </Text>
            </XStack>
            <XStack px="$2.5" py="$1" rounded="$3" bg={sseState === 'connected' ? '$raised' : '$hover'} items="center" gap="$1.5">
              <Radio size={12} aria-hidden />
              <Text fontSize="$1" fontFamily="$mono" color="$ink" data-slot="sse-status">
                {sseState === 'connected'
                  ? 'SSE /v1/workflow/events live'
                  : sseState === 'unsupported'
                    ? 'Activity poll mode'
                    : 'SSE reconnecting…'}
              </Text>
            </XStack>
          </XStack>

          {activities.length === 0 ? (
            <Text fontSize="$2" color="$quiet">
              {t('No gpu-jobs activities dispatched yet.')}
            </Text>
          ) : (
            <YStack gap="$2">
              {activities.slice(0, 10).map((act) => {
                const st = shortActivityStatus(act.status)
                const isRunning = st === 'SCHEDULED' || st === 'STARTED'
                return (
                  <YStack
                    key={`${act.activityId}-${act.runId}`}
                    data-slot={`workflow-activity-${act.activityId}`}
                    p="$3"
                    rounded="$3"
                    borderWidth={1}
                    borderColor="$edge"
                    gap="$1.5"
                  >
                    <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
                      <Text fontSize="$2" fontWeight="600" color="$ink" fontFamily="$mono">
                        {act.activityId}
                      </Text>
                      <XStack px="$2" py={2} rounded="$2" bg={st === 'COMPLETED' ? '$raised' : '$hover'}>
                        <Text fontSize="$1" fontWeight="600" color="$ink" fontFamily="$mono">
                          {st}
                        </Text>
                      </XStack>
                    </XStack>

                    <Text fontSize="$1" color="$soft" fontFamily="$mono">
                      {act.activityType} · queue={act.taskQueue} · attempt #{act.attempt}
                      {act.deferCount > 0 ? ` · deferred ${act.deferCount}× (${act.lastBusyReason || 'busy'})` : ''}
                    </Text>

                    <XStack justify="flex-end" gap="$1.5">
                      <Button size="sm" variant="ghost" onPress={() => void refreshSingleActivity(act)}>
                        <RefreshCw size={12} aria-hidden />
                        {t('Refresh')}
                      </Button>
                      {isRunning ? (
                        <Button size="sm" variant="outline" onPress={() => void cancelSingleActivity(act)}>
                          <Square size={12} aria-hidden />
                          {t('Cancel')}
                        </Button>
                      ) : null}
                    </XStack>
                  </YStack>
                )
              })}
            </YStack>
          )}

          {events.length > 0 ? (
            <YStack gap="$1" pt="$2" borderTopWidth={1} borderColor="$edge">
              <Text fontSize="$1" fontWeight="600" color="$ink">
                {t('Realtime SSE Frames')}
              </Text>
              {events.slice(0, 6).map((ev, idx) => (
                <Text key={`${ev.activityId}-${ev.kind}-${idx}`} fontSize="$1" color="$quiet" fontFamily="$mono">
                  [{ev.kind}] {ev.activityId}
                  {ev.deferCount ? ` (defer #${ev.deferCount})` : ''}
                </Text>
              ))}
            </YStack>
          ) : null}
        </YStack>
      </XStack>

      {/* Autonomous Follow-Up Lineage */}
      {lineageRows.length > 0 ? (
        <YStack
          data-slot="autonomous-lineage"
          p="$4"
          rounded="$4"
          borderWidth={1}
          borderColor="$edge"
          gap="$2.5"
        >
          <XStack items="center" gap="$2">
            <GitBranch size={16} aria-hidden />
            <Text fontSize="$3" fontWeight="600" color="$ink">
              {t('Autonomous Evolutionary Lineage')}
            </Text>
          </XStack>
          <YStack gap="$1.5">
            {lineageRows.slice(0, 8).map((exp) => {
              const parent =
                String(exp.meta?.parent_experiment || (exp.meta?.parent_ids?.[0] ?? 'root'))
              const v = classifyVerdict(exp)
              return (
                <XStack
                  key={exp.id}
                  p="$2.5"
                  rounded="$3"
                  borderWidth={1}
                  borderColor="$edge"
                  items="center"
                  justify="space-between"
                  flexWrap="wrap"
                  gap="$2"
                >
                  <Text fontSize="$1" color="$ink" fontFamily="$mono">
                    {parent} → {exp.id} ({verdictLabel(v)})
                  </Text>
                  {exp.meta?.next_hypothesis ? (
                    <Text fontSize="$1" color="$quiet">
                      next: {String(exp.meta.next_hypothesis)}
                    </Text>
                  ) : null}
                </XStack>
              )
            })}
          </YStack>
        </YStack>
      ) : null}
    </YStack>
  )
}
