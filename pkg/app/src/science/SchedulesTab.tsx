'use client'

import { useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Input, Switch, Text } from '@hanzo/ui'
import {
  CalendarClock,
  CheckCircle2,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Zap,
} from 'lucide-react'
import {
  createSchedule,
  deleteSchedule,
  describeSchedule,
  pauseSchedule,
  resumeSchedule,
  triggerSchedule,
  updateSchedule,
} from './api'
import type { LinkedMachine, ScheduleRecord } from './types'

const INTERVAL_PRESETS = ['30m', '2h', '6h', '12h', '24h'] as const

export function SchedulesTab({
  schedules,
  machines,
  onReloadSchedules,
}: {
  schedules: readonly ScheduleRecord[]
  machines: readonly LinkedMachine[]
  onReloadSchedules: () => Promise<void>
}) {
  const { t } = useI18n()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [scheduleId, setScheduleId] = useState('')
  const [cadenceMode, setCadenceMode] = useState<'interval' | 'cron'>('interval')
  const [intervalValue, setIntervalValue] = useState('2h')
  const [cronValue, setCronValue] = useState('0 */2 * * *')
  const [target, setTarget] = useState('any')
  const [activityType, setActivityType] = useState<'research.tick' | 'research.bench'>('research.tick')
  const [whenIdleOnly, setWhenIdleOnly] = useState(true)
  const [maxComputeSeconds, setMaxComputeSeconds] = useState('1800')
  const [campaign, setCampaign] = useState('autonomous-sweep')
  const [command, setCommand] = useState('hanzo-research tick --campaign autonomous-sweep')
  const [note, setNote] = useState('')
  const [startPaused, setStartPaused] = useState(false)

  const [selectedDetail, setSelectedDetail] = useState<ScheduleRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const resetForm = () => {
    setEditingId(null)
    setScheduleId('')
    setCadenceMode('interval')
    setIntervalValue('2h')
    setCronValue('0 */2 * * *')
    setTarget('any')
    setActivityType('research.tick')
    setWhenIdleOnly(true)
    setMaxComputeSeconds('1800')
    setCampaign('autonomous-sweep')
    setCommand('hanzo-research tick --campaign autonomous-sweep')
    setNote('')
    setStartPaused(false)
  }

  const populateForEdit = (s: ScheduleRecord) => {
    setEditingId(s.scheduleId)
    setScheduleId(s.scheduleId)
    if (s.cronStrings.length > 0 && s.intervals.length === 0) {
      setCadenceMode('cron')
      setCronValue(s.cronStrings[0]!)
    } else {
      setCadenceMode('interval')
      setIntervalValue(s.intervals[0] ?? '2h')
    }
    setTarget(s.targetMachine || 'any')
    setActivityType(s.activityType === 'research.bench' ? 'research.bench' : 'research.tick')
    setWhenIdleOnly(s.whenIdleOnly)
    setMaxComputeSeconds(String(s.maxComputeSeconds ?? 1800))
    setCampaign(s.campaign ?? '')
    setCommand(s.command ?? '')
    setNote(s.note)
    setStartPaused(s.paused)
  }

  const handleSubmit = async () => {
    if (!scheduleId.trim()) {
      setError(t('Schedule ID is required (e.g. nightly-dgx-sweep).'))
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const payload = {
        scheduleId: scheduleId.trim(),
        interval: cadenceMode === 'interval' ? intervalValue.trim() : undefined,
        cron: cadenceMode === 'cron' ? cronValue.trim() : undefined,
        target: target.trim() || 'any',
        activityType,
        whenIdleOnly,
        maxComputeSeconds: Math.max(30, Math.floor(Number(maxComputeSeconds) || 1800)),
        campaign: campaign.trim() || undefined,
        command: command.trim() || undefined,
        note: note.trim(),
        paused: startPaused,
      }
      if (editingId) {
        const updated = await updateSchedule(payload)
        setSelectedDetail(updated)
        setNotice(`Updated schedule ${updated.scheduleId}`)
      } else {
        const created = await createSchedule(payload)
        if (created[0]) setSelectedDetail(created[0])
        setNotice(`Created ${created.length} schedule(s): ${created.map((c) => c.scheduleId).join(', ')}`)
      }
      resetForm()
      await onReloadSchedules()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleTriggerNow = async (s: ScheduleRecord) => {
    setBusy(true)
    setError(null)
    try {
      await triggerSchedule(s.scheduleId)
      setNotice(`Triggered immediate execution of ${s.scheduleId}`)
      const detail = await describeSchedule(s.scheduleId).catch(() => s)
      setSelectedDetail(detail)
      await onReloadSchedules()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleTogglePause = async (s: ScheduleRecord) => {
    setBusy(true)
    setError(null)
    try {
      if (s.paused) {
        await resumeSchedule(s.scheduleId)
        setNotice(`Resumed schedule ${s.scheduleId}`)
      } else {
        await pauseSchedule(s.scheduleId, 'Paused from Hanzo Science')
        setNotice(`Paused schedule ${s.scheduleId}`)
      }
      const detail = await describeSchedule(s.scheduleId).catch(() => ({ ...s, paused: !s.paused }))
      setSelectedDetail(detail)
      await onReloadSchedules()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (s: ScheduleRecord) => {
    setBusy(true)
    setError(null)
    try {
      await deleteSchedule(s.scheduleId)
      if (selectedDetail?.scheduleId === s.scheduleId) setSelectedDetail(null)
      setNotice(`Deleted schedule ${s.scheduleId}`)
      await onReloadSchedules()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleInspect = async (s: ScheduleRecord) => {
    setBusy(true)
    setError(null)
    try {
      const detail = await describeSchedule(s.scheduleId)
      setSelectedDetail(detail)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <YStack data-slot="science-schedules" gap="$5">
      {error ? (
        <XStack p="$3" rounded="$3" bg="$hover" items="center" gap="$2">
          <ShieldAlert size={15} aria-hidden />
          <Text fontSize="$2" color="$ink">
            {error}
          </Text>
        </XStack>
      ) : null}

      {notice ? (
        <XStack p="$3" rounded="$3" bg="$raised" items="center" gap="$2" data-slot="schedules-notice">
          <CheckCircle2 size={15} aria-hidden />
          <Text fontSize="$2" color="$ink">
            {notice}
          </Text>
        </XStack>
      ) : null}

      {/* Create / Edit Autonomous Schedule Form */}
      <YStack
        data-slot="schedule-composer"
        p="$4"
        rounded="$4"
        borderWidth={1}
        borderColor="$edge"
        gap="$3.5"
      >
        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
          <XStack items="center" gap="$2">
            <CalendarClock size={16} aria-hidden />
            <YStack>
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {editingId
                  ? `${t('Edit Schedule')}: ${editingId}`
                  : t('Create Autonomous Research Schedule')}
              </Text>
              <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                /v1/workflow/namespaces/gpu-jobs/schedules
              </Text>
            </YStack>
          </XStack>
          <XStack gap="$1.5">
            <Button
              size="sm"
              variant={cadenceMode === 'interval' ? 'primary' : 'ghost'}
              onPress={() => setCadenceMode('interval')}
            >
              {t('Interval')}
            </Button>
            <Button
              size="sm"
              variant={cadenceMode === 'cron' ? 'primary' : 'ghost'}
              onPress={() => setCadenceMode('cron')}
            >
              {t('Cron')}
            </Button>
            {editingId ? (
              <Button size="sm" variant="outline" onPress={resetForm}>
                {t('Cancel Edit')}
              </Button>
            ) : null}
          </XStack>
        </XStack>

        <XStack gap="$2" flexWrap="wrap" items="center">
          <YStack flex={1} minW={200}>
            <Input
              data-slot="schedule-id-input"
              placeholder={t('Schedule ID (e.g. evo-idle-research)')}
              value={scheduleId}
              onChangeText={setScheduleId}
              disabled={Boolean(editingId)}
            />
          </YStack>
          {cadenceMode === 'interval' ? (
            <>
              <YStack width={140}>
                <Input
                  data-slot="schedule-interval-input"
                  placeholder="30m / 2h / 6h"
                  value={intervalValue}
                  onChangeText={setIntervalValue}
                />
              </YStack>
              <XStack gap="$1">
                {INTERVAL_PRESETS.map((iv) => (
                  <XStack
                    key={iv}
                    render="button"
                    onClick={() => setIntervalValue(iv)}
                    px="$2"
                    py="$1"
                    rounded="$2"
                    bg={intervalValue === iv ? '$raised' : '$hover'}
                    cursor="pointer"
                  >
                    <Text fontSize="$1" fontFamily="$mono" color="$ink">
                      {iv}
                    </Text>
                  </XStack>
                ))}
              </XStack>
            </>
          ) : (
            <YStack width={220}>
              <Input
                data-slot="schedule-cron-input"
                placeholder="0 */2 * * *"
                value={cronValue}
                onChangeText={setCronValue}
              />
            </YStack>
          )}
        </XStack>

        <XStack gap="$2" flexWrap="wrap" items="center">
          <YStack width={200}>
            <Input
              data-slot="schedule-target-input"
              placeholder={t('Target (any, evo, dgx, evo,dgx)')}
              value={target}
              onChangeText={setTarget}
            />
          </YStack>
          <YStack width={180}>
            <Input
              placeholder={t('Campaign')}
              value={campaign}
              onChangeText={setCampaign}
            />
          </YStack>
          <YStack width={150}>
            <Input
              placeholder={t('Max compute (s)')}
              value={maxComputeSeconds}
              onChangeText={setMaxComputeSeconds}
            />
          </YStack>
          <XStack gap="$1.5">
            <Button
              size="sm"
              variant={activityType === 'research.tick' ? 'primary' : 'ghost'}
              onPress={() => setActivityType('research.tick')}
            >
              research.tick
            </Button>
            <Button
              size="sm"
              variant={activityType === 'research.bench' ? 'primary' : 'ghost'}
              onPress={() => setActivityType('research.bench')}
            >
              research.bench
            </Button>
          </XStack>
        </XStack>

        {machines.length > 0 ? (
          <XStack gap="$1.5" flexWrap="wrap" items="center">
            <Text fontSize="$1" color="$quiet">
              {t('Target machine:')}
            </Text>
            {['any', ...machines.map((m) => m.id)].map((tid) => (
              <XStack
                key={tid}
                render="button"
                onClick={() => setTarget(tid)}
                px="$2"
                py={2}
                rounded="$2"
                bg={target === tid ? '$raised' : '$hover'}
                cursor="pointer"
              >
                <Text fontSize="$1" fontFamily="$mono" color="$ink">
                  {tid}
                </Text>
              </XStack>
            ))}
          </XStack>
        ) : null}

        <Input
          data-slot="schedule-command-input"
          placeholder={t('Command (e.g. hanzo-research tick --campaign autonomous-sweep)')}
          value={command}
          onChangeText={setCommand}
        />

        <Input
          placeholder={t('Optional schedule note')}
          value={note}
          onChangeText={setNote}
        />

        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$3">
          <XStack gap="$4" flexWrap="wrap" items="center">
            <XStack items="center" gap="$2">
              <Switch checked={whenIdleOnly} onCheckedChange={setWhenIdleOnly} />
              <Text fontSize="$2" color="$ink">
                {t('when_idle_only')}
              </Text>
            </XStack>
            <XStack items="center" gap="$2">
              <Switch checked={startPaused} onCheckedChange={setStartPaused} />
              <Text fontSize="$2" color="$ink">
                {t('Start paused')}
              </Text>
            </XStack>
          </XStack>
          <Button
            size="sm"
            data-slot="schedule-submit-btn"
            disabled={busy}
            onPress={() => void handleSubmit()}
          >
            <Plus size={14} aria-hidden />
            {editingId ? t('Save Schedule') : t('Create Schedule')}
          </Button>
        </XStack>
      </YStack>

      {/* Active Schedules List & Inspector */}
      <XStack gap="$4" flexWrap="wrap" items="flex-start">
        <YStack flex={2} minW={320} gap="$2.5">
          <XStack items="center" justify="space-between">
            <Text fontSize="$3" fontWeight="600" color="$ink">
              {t('Registered Schedules')} ({schedules.length})
            </Text>
            <Button size="sm" variant="ghost" onPress={() => void onReloadSchedules()} disabled={busy}>
              <RefreshCw size={13} aria-hidden />
              {t('Refresh')}
            </Button>
          </XStack>

          {schedules.length === 0 ? (
            <YStack p="$5" rounded="$4" borderWidth={1} borderColor="$edge" items="center">
              <Text fontSize="$2" color="$quiet">
                {t('No recurring schedules registered in namespace gpu-jobs yet.')}
              </Text>
            </YStack>
          ) : (
            schedules.map((s) => {
              const cadence =
                s.intervals.length > 0
                  ? `every ${s.intervals.join(', ')}`
                  : s.cronStrings.length > 0
                    ? `cron ${s.cronStrings.join(', ')}`
                    : 'custom'
              return (
                <YStack
                  key={s.scheduleId}
                  data-slot={`schedule-item-${s.scheduleId}`}
                  p="$3.5"
                  rounded="$3"
                  borderWidth={1}
                  borderColor={selectedDetail?.scheduleId === s.scheduleId ? 'var(--border-strong)' : '$edge'}
                  gap="$2"
                >
                  <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
                    <XStack items="center" gap="$2">
                      <Text fontSize="$2" fontWeight="600" color="$ink" fontFamily="$mono">
                        {s.scheduleId}
                      </Text>
                      <XStack px="$2" py={2} rounded="$2" bg={s.paused ? '$hover' : '$raised'}>
                        <Text fontSize="$1" fontWeight="600" color={s.paused ? '$quiet' : '$ink'} fontFamily="$mono">
                          {s.paused ? 'PAUSED' : 'ACTIVE'}
                        </Text>
                      </XStack>
                    </XStack>
                    <Text fontSize="$1" color="$soft" fontFamily="$mono">
                      {cadence} · {s.taskQueue}
                    </Text>
                  </XStack>

                  <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                    {s.activityType} · when_idle_only={String(s.whenIdleOnly)}
                    {s.maxComputeSeconds ? ` · max=${s.maxComputeSeconds}s` : ''}
                    {s.nextActionTime ? ` · next=${s.nextActionTime}` : ''}
                    {` · recent=${s.recentActions.length}`}
                  </Text>

                  {s.command ? (
                    <Text fontSize="$1" color="$soft" fontFamily="$mono" numberOfLines={1}>
                      $ {s.command}
                    </Text>
                  ) : null}

                  <XStack gap="$1.5" flexWrap="wrap" justify="flex-end" pt="$1">
                    <Button
                      size="sm"
                      variant="outline"
                      data-slot={`trigger-schedule-${s.scheduleId}`}
                      disabled={busy}
                      onPress={() => void handleTriggerNow(s)}
                    >
                      <Zap size={12} aria-hidden />
                      {t('Trigger Now')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      data-slot={`pause-schedule-${s.scheduleId}`}
                      disabled={busy}
                      onPress={() => void handleTogglePause(s)}
                    >
                      {s.paused ? <Play size={12} aria-hidden /> : <Pause size={12} aria-hidden />}
                      {s.paused ? t('Resume') : t('Pause')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onPress={() => populateForEdit(s)}
                    >
                      <Pencil size={12} aria-hidden />
                      {t('Edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onPress={() => void handleInspect(s)}
                    >
                      {t('Inspect')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      data-slot={`delete-schedule-${s.scheduleId}`}
                      disabled={busy}
                      onPress={() => void handleDelete(s)}
                    >
                      <Trash2 size={12} aria-hidden />
                      {t('Delete')}
                    </Button>
                  </XStack>
                </YStack>
              )
            })
          )}
        </YStack>

        {/* Schedule Detail Drawer (nextActionTime + recentActions) */}
        {selectedDetail ? (
          <YStack
            data-slot="schedule-detail-panel"
            flex={1}
            minW={300}
            p="$4"
            rounded="$4"
            borderWidth={1}
            borderColor="var(--border-strong)"
            bg="$raised"
            gap="$2.5"
          >
            <Text fontSize="$3" fontWeight="600" color="$ink" fontFamily="$mono">
              {selectedDetail.scheduleId}
            </Text>
            <Text fontSize="$1" color="$soft" fontFamily="$mono">
              state: {selectedDetail.paused ? 'PAUSED' : 'RUNNING'}
              {selectedDetail.note ? ` (${selectedDetail.note})` : ''}
            </Text>
            <Text fontSize="$1" color="$ink" fontFamily="$mono">
              nextActionTime: {selectedDetail.nextActionTime || 'none (paused or pending)'}
            </Text>
            <YStack gap="$1.5" pt="$1">
              <Text fontSize="$2" fontWeight="600" color="$ink">
                {t('Recent Actions')} ({selectedDetail.recentActions.length})
              </Text>
              {selectedDetail.recentActions.length === 0 ? (
                <Text fontSize="$1" color="$quiet">
                  {t('No executions recorded yet.')}
                </Text>
              ) : (
                selectedDetail.recentActions.slice(0, 8).map((ra, idx) => (
                  <YStack key={`${ra.workflowId ?? idx}`} p="$2" rounded="$2" bg="$hover" gap={2}>
                    <Text fontSize="$1" color="$ink" fontFamily="$mono">
                      {ra.workflowId || 'scheduled-tick'}
                    </Text>
                    <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                      {ra.actualTime || ra.scheduledTime || ''}
                    </Text>
                  </YStack>
                ))
              )}
            </YStack>
          </YStack>
        ) : null}
      </XStack>
    </YStack>
  )
}
