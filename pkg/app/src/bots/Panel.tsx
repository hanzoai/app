'use client'

// The open bot's right inspector panel:
// - Avatar, Primary Bot ("hanzo" · Layer 0) status, [Activity | Library] segmented tabs
// - Sleek Desktop Sandbox Computer card (`Awake` / `Parked` / `Asleep` dark screen preview — no heart icon!)
// - Scheduled & Event-Driven Automations (`/v1/auto/automations` + agent cron schedule, live toggle & Run now)
// - Unified Secrets & Login Autofill (`1Password`, `LastPass`, `Hanzo KMS` synced with platform.hanzo.ai & hanzo.app)
// - Hierarchy & Layer role card (Primary Bot promotion, Bot Group assignment, Layer 0..3)
// - Slack Sync & Channel Routing card (one-click Add to Slack, Sync Channels, default @hanzo responder, #channel bindings)
// - Connectors launcher & Voice chat preferences

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Agent, AgentRun, Sandbox } from '@hanzo/ai'
import { useI18n } from '@hanzo/i18n/react'
import { Input, Text, XStack, YStack } from '@hanzo/gui'
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@hanzo/ui'
import {
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { useKept } from '../kept'
import { api } from '../lib/api'
import { useAi } from '../lib/ai'
import { FLOW } from '../lib/host'
import { say } from '../failure'
import { Network, of } from '../network'
import { called } from '../team'
import { VaultDialog, readVault, type VaultDoc } from '../vault'
import { ComputerDialog } from './ComputerDialog'
import { ConnectorsDialog } from './ConnectorsDialog'
import { Face } from './face'
import {
  ALWAYS,
  PRIMARY_BOT,
  answering,
  createBotAutomation,
  deleteBotAutomation,
  findBotComputer,
  listBotAutomations,
  parseAutomationWhen,
  runBotAutomation,
  setAnswering,
  setPrimaryBot,
  slackAuthorizeUrl,
  slackChannels,
  slackStatus,
  slackSyncChannels,
  toGroupRef,
  toggleBotAutomation,
  updateBotMeta,
  type AutomationSchedule,
  type BotAgent,
  type BotAutomation,
  type BotGroup,
  type SlackChannel,
} from './api'
import { CARD, CLIP, LABEL, PILL, ROUND, WORD } from './kit'
import { DIM, FLOOR, GROUND, INK, LINE, PICKED, RAISED } from './ink'
import { partsOf } from './said'
import { cron as words } from './time'
import { Confirm, useSpend } from '../Confirm'

const VOICES = ['Liora', 'Aria', 'Sol', 'Koe', 'Nova', 'Echo'] as const
const SPEEDS = ['0.9x', '1x', '1.25x', '1.5x', '2x'] as const
const LANGUAGES = ['Auto-detect', 'English', 'Spanish', 'French', 'German', 'Japanese', 'Chinese'] as const

const EVENT_TRIGGERS: readonly { id: string; source: string; name: string; label: string; hint: string }[] = [
  { id: 'slack:mention', source: 'slack', name: 'mention', label: 'Slack · @mention', hint: 'Runs when @hanzo is mentioned in Slack' },
  { id: 'slack:message', source: 'slack', name: 'message', label: 'Slack · Channel message', hint: 'Runs on new messages in bound channels' },
  { id: 'github:push', source: 'github', name: 'push', label: 'GitHub · Push', hint: 'Runs when commits are pushed to a repository' },
  { id: 'github:pull_request', source: 'github', name: 'pull_request', label: 'GitHub · Pull request', hint: 'Runs when a PR opens or updates' },
  { id: 'stripe:charge', source: 'stripe', name: 'charge', label: 'Stripe · Payment or charge', hint: 'Runs when a customer payment settles' },
  { id: 'webhook:inbound', source: 'webhook', name: 'inbound', label: 'Webhook · Inbound HTTP', hint: 'Runs whenever your webhook URL receives a POST' },
]

const SCHEDULE_PRESETS: readonly { id: string; label: string; schedule: AutomationSchedule }[] = [
  { id: 'daily', label: 'Daily · 9:00 AM', schedule: { kind: 'daily', at: '09:00' } },
  { id: 'weekdays', label: 'Weekdays · 9:00 AM', schedule: { kind: 'weekdays', at: '09:00' } },
  { id: 'hourly', label: 'Every hour', schedule: { kind: 'hourly' } },
  { id: 'weekly', label: 'Mondays · 9:00 AM', schedule: { kind: 'weekly', day: 'mon', at: '09:00' } },
]

function PanelSwitch({
  checked,
  disabled,
  onCheckedChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  disabled?: boolean
  onCheckedChange: (next: boolean) => void
  'aria-label': string
}) {
  return (
    <XStack
      render={<button type="button" role="switch" aria-checked={checked} disabled={disabled} />}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onCheckedChange(!checked)
      }}
      width={36}
      height={20}
      p={2}
      rounded={999}
      borderWidth={1}
      borderColor={checked ? 'var(--foreground)' : 'var(--border-strong)'}
      bg={checked ? 'var(--foreground)' : 'var(--border)'}
      items="center"
      justify={checked ? 'flex-end' : 'flex-start'}
      shrink={0}
      opacity={disabled ? 0.5 : 1}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      transition="quickest"
      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)', outlineOffset: 2 }}
    >
      <YStack
        width={14}
        height={14}
        rounded={999}
        bg={checked ? 'var(--background)' : 'var(--muted-foreground)'}
        aria-hidden
      />
    </XStack>
  )
}

function Row({
  mark,
  title,
  line,
  children,
  last,
}: {
  mark: React.ReactNode
  title: string
  line?: string
  children?: React.ReactNode
  last?: boolean
}) {
  return (
    <XStack minH={52} px={13} py={9} gap={11} items="center" borderBottomWidth={last ? 0 : 1} borderColor={LINE}>
      {mark}
      <YStack flex={1} minW={0} gap={2}>
        <Text {...CLIP} fontSize={14} lineHeight={19} fontWeight="500" color={INK}>
          {title}
        </Text>
        {line ? (
          <Text {...CLIP} fontSize={12} lineHeight={17} color={DIM}>
            {line}
          </Text>
        ) : null}
      </YStack>
      {children}
    </XStack>
  )
}

function VoiceRow({
  label,
  value,
  options,
  onSelect,
  last,
}: {
  label: string
  value: string
  options: readonly string[]
  onSelect: (next: string) => void
  last?: boolean
}) {
  return (
    <XStack minH={44} px={14} items="center" justify="space-between" borderBottomWidth={last ? 0 : 1} borderColor={LINE}>
      <Text fontSize={14} lineHeight={19} color={INK}>
        {label}
      </Text>
      <DropdownMenu placement="bottom-end" offset={6}>
        <DropdownMenuTrigger asChild>
          <XStack
            render={<button type="button" />}
            items="center"
            gap={5}
            px={6}
            py={4}
            rounded={6}
            bg="transparent"
            borderWidth={0}
            cursor="pointer"
            transition="quickest"
            hoverStyle={{ bg: PICKED }}
            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $max-sm={{ minH: 44 }}
          >
            <Text fontSize={14} lineHeight={19} color={INK}>
              {value}
            </Text>
            <ChevronDown size={14} color={DIM} aria-hidden />
          </XStack>
        </DropdownMenuTrigger>
        <DropdownMenuContent minW={160} aria-label={label}>
          {options.map((opt) => (
            <DropdownMenuItem key={opt} onSelect={() => onSelect(opt)}>
              <Text fontSize="$3" color="$ink" fontWeight={opt === value ? '600' : '400'}>
                {opt}
              </Text>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </XStack>
  )
}

/**
 * Miniature monochrome desktop screen preview that adapts cleanly to Dark & Light modes.
 * Displays a `--state-online` dot when `Awake` and a calm neutral screen surface when `Parked` or `Asleep`.
 */
function ComputerScreen({ awake, parked }: { awake: boolean; parked: boolean }) {
  return (
    <YStack
      aria-hidden
      width={56}
      height={36}
      rounded={8}
      shrink={0}
      justify="flex-end"
      items="center"
      pb={4}
      position="relative"
      overflow="hidden"
      bg={awake ? PICKED : FLOOR}
      borderWidth={1}
      borderColor={awake ? 'var(--border-strong)' : LINE}
    >
      {awake ? (
        <YStack
          position="absolute"
          t={5}
          r={5}
          width={6}
          height={6}
          rounded={999}
          bg="var(--state-online)"
        />
      ) : null}
      <XStack
        width={22}
        height={3}
        rounded={999}
        bg={awake ? INK : DIM}
        opacity={awake ? 0.72 : parked ? 0.42 : 0.25}
      />
    </YStack>
  )
}

function stateLabel(box: Sandbox | null, hasRef: boolean, t: (s: string) => string): string {
  if (box?.status === 'running') return t('Awake')
  if (box?.status === 'pending') return t('Starting desktop…')
  if (box || hasRef) return t('Parked · click to resume')
  return t('Ready · click to open')
}

function describeAutomation(a: BotAutomation, t: (s: string, p?: Record<string, unknown>) => string): string {
  if (a.event?.source && a.event?.name) {
    return `${t('On event')}: ${a.event.source}.${a.event.name}`
  }
  const s = a.schedule
  if (!s || s.kind === 'manual') return a.enabled ? t('On demand') : t('Paused')
  if (!a.enabled) return `${t('Paused')} · ${s.kind}${s.at ? ` ${s.at}` : ''}`
  if (s.kind === 'hourly') return t('Every hour')
  if (s.kind === 'daily') return t('Daily at {at}', { at: s.at || '09:00' })
  if (s.kind === 'weekdays') return t('Weekdays at {at}', { at: s.at || '09:00' })
  if (s.kind === 'weekly') return t('Weekly ({day}) at {at}', { day: s.day || 'mon', at: s.at || '09:00' })
  if (s.kind === 'cron' && s.cron) return `Cron · ${s.cron}`
  return s.kind
}

const POLL = 5000

export function Panel({
  bot,
  groups = [],
  runs = [],
  onClose,
  kept,
  onSchedule,
  onDelete,
  onBotChanged,
  onPickGroup,
  focus = false,
}: {
  bot: Agent
  groups?: readonly BotGroup[]
  runs?: readonly AgentRun[]
  kept: string
  onClose: () => void
  onSchedule: (on: boolean, cron: string) => Promise<void>
  onDelete: () => Promise<void>
  onBotChanged?: () => void | Promise<void>
  onPickGroup?: (ref: string) => void
  focus?: boolean
}) {
  const { t, locale } = useI18n()
  const { client } = useAi()
  const ext = bot as BotAgent
  const isPrimary = Boolean(ext.isPrimary || bot.name.toLowerCase() === PRIMARY_BOT)
  const currentLayer = isPrimary ? 0 : (ext.layer ?? 1)

  const [tab, setTab] = useState<'activity' | 'library'>('activity')
  const [moreOpen, setMoreOpen] = useState(false)
  const [instructions, setInstructions] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [box, setBox] = useState<Sandbox | null>(null)
  const [computerOpen, setComputerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [connectorsOpen, setConnectorsOpen] = useState(false)
  const [vaultOpen, setVaultOpen] = useState(false)
  const [vaultDoc, setVaultDoc] = useState<VaultDoc>({ items: [], providers: {}, secretKeys: [] })

  // Scheduled + Event-driven Automations state
  const [automations, setAutomations] = useState<BotAutomation[]>([])
  const [autoModalOpen, setAutoModalOpen] = useState(false)
  const [autoMode, setAutoMode] = useState<'schedule' | 'event'>('schedule')
  const [autoName, setAutoName] = useState('')
  const [autoInstructions, setAutoInstructions] = useState('')
  const [autoPreset, setAutoPreset] = useState('weekdays')
  const [autoCustomWhen, setAutoCustomWhen] = useState('')
  const [autoEventId, setAutoEventId] = useState('slack:mention')
  const [autoBusy, setAutoBusy] = useState(false)
  // The automation a Delete press is asking about.
  const [unmaking, setUnmaking] = useState<BotAutomation | null>(null)
  // A run is billed: Run now asks first.
  const runNow = useSpend('automation-run', t('Run this automation now?'), t('This starts one run of the automation right away.'), t('Run now'))

  // Slack workspace + channel routing state
  const [slackConn, setSlackConn] = useState<{ connected: boolean; account?: string }>({ connected: false })
  const [slackDefault, setSlackDefault] = useState<string>(PRIMARY_BOT)
  const [slackChans, setSlackChans] = useState<SlackChannel[]>([])
  const [slackBound, setSlackBound] = useState<Record<string, string>>({})
  const [slackBusy, setSlackBusy] = useState(false)
  const [slackNote, setSlackNote] = useState<string | null>(null)

  const [voiceName, setVoiceName] = useKept<string>('hanzo.bots.voice.name', 'Liora')
  const [voiceSpeed, setVoiceSpeed] = useKept<string>('hanzo.bots.voice.speed', '1x')
  const [voiceLang, setVoiceLang] = useKept<string>('hanzo.bots.voice.lang', 'Auto-detect')

  const displayName = called(bot.name)
  const cron = bot.schedule || kept
  const activeSchedule = bot.executionMode === ALWAYS && Boolean(bot.schedule)

  const assignedGroup = useMemo(
    () => groups.find((g) => g.id === ext.groupId || g.name === ext.groupId || g.members.includes(bot.name)) ?? null,
    [groups, ext.groupId, bot.name],
  )

  const survey = useCallback(
    async (signal?: AbortSignal) => {
      if (!client) return
      const opts = signal ? { signal } : undefined
      const [detail, nets, foundBox, slk, autos, vdoc] = await Promise.allSettled([
        client.agents.get(bot.name, opts),
        client.transports.list(opts),
        findBotComputer(client, ext, signal),
        slackStatus(signal),
        listBotAutomations(client, bot.name, signal),
        readVault(signal),
      ])
      if (signal?.aborted) return
      if (detail.status === 'fulfilled') setInstructions(detail.value.instructions ?? '')
      if (foundBox.status === 'fulfilled') setBox(foundBox.value)
      if (autos.status === 'fulfilled') setAutomations(autos.value)
      if (vdoc.status === 'fulfilled') setVaultDoc(vdoc.value)
      if (slk.status === 'fulfilled') {
        setSlackConn(slk.value)
        if (slk.value.connected) {
          const [ans, chs] = await Promise.all([
            answering(client, 'slack', signal).catch(() => null),
            slackChannels(signal),
          ])
          if (!signal?.aborted) {
            if (ans) {
              setSlackDefault(ans.default || PRIMARY_BOT)
              setSlackBound(ans.channels || {})
            }
            setSlackChans(chs)
          }
        }
      }
      if (nets.status === 'fulfilled') {
        const connected = nets.value.filter((n) => n.connected)
        const bound = await Promise.allSettled(connected.map((n) => answering(client, n.id, signal)))
        if (signal?.aborted) return
        setAnswers(
          connected
            .filter((_, i) => {
              const r = bound[i]
              return r.status === 'fulfilled' && (r.value.default || PRIMARY_BOT) === bot.name
            })
            .map((n) => n.id),
        )
      }
    },
    [client, bot.name, ext],
  )

  useEffect(() => {
    const stop = new AbortController()
    void survey(stop.signal)
    return () => stop.abort()
  }, [survey])

  useEffect(() => {
    if (!client || box?.status !== 'pending') return
    const stop = new AbortController()
    const tick = window.setInterval(() => {
      findBotComputer(client, ext, stop.signal)
        .then((b) => setBox(b))
        .catch(() => undefined)
    }, POLL)
    return () => {
      window.clearInterval(tick)
      stop.abort()
    }
  }, [client, box?.status, ext])

  const promotePrimary = async () => {
    if (!client || saving) return
    setSaving(true)
    setWrong(null)
    try {
      await setPrimaryBot(client, bot.name)
      await onBotChanged?.()
      await survey()
    } catch (e) {
      setWrong(say(e, displayName, 'save', t))
    } finally {
      setSaving(false)
    }
  }

  const assignLayer = async (lv: number) => {
    if (!client || saving) return
    setSaving(true)
    setWrong(null)
    try {
      await updateBotMeta(client, bot.name, { layer: lv })
      await onBotChanged?.()
    } catch (e) {
      setWrong(say(e, displayName, 'save', t))
    } finally {
      setSaving(false)
    }
  }

  const assignGroup = async (groupId: string) => {
    if (!client || saving) return
    setSaving(true)
    setWrong(null)
    try {
      await updateBotMeta(client, bot.name, { groupId })
      await onBotChanged?.()
    } catch (e) {
      setWrong(say(e, displayName, 'save', t))
    } finally {
      setSaving(false)
    }
  }

  const connectSlack = async () => {
    setSlackBusy(true)
    setSlackNote(null)
    try {
      const url = await slackAuthorizeUrl()
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer')
        setSlackNote(t('Approve Slack in the opened tab — channels sync automatically when connected.'))
      } else {
        setConnectorsOpen(true)
      }
    } catch {
      setConnectorsOpen(true)
    } finally {
      setSlackBusy(false)
    }
  }

  const syncSlack = async () => {
    setSlackBusy(true)
    setSlackNote(null)
    try {
      const res = await slackSyncChannels()
      setSlackNote(
        res.ok
          ? res.joined !== undefined
            ? t('Synced @hanzo into {n} Slack channels.', { n: res.joined })
            : t('Synced @hanzo into workspace Slack channels.')
          : t('Could not sync channels — ensure Slack is connected by an org admin.'),
      )
      await survey()
    } finally {
      setSlackBusy(false)
    }
  }

  const toggleSlackDefault = async (on: boolean) => {
    if (!client || slackBusy) return
    setSlackBusy(true)
    try {
      const target = on ? bot.name : PRIMARY_BOT
      const ans = await setAnswering(client, { transport: 'slack', default: target })
      setSlackDefault(ans.default || PRIMARY_BOT)
      await survey()
    } catch (e) {
      setWrong(say(e, t('Slack responder'), 'save', t))
    } finally {
      setSlackBusy(false)
    }
  }

  const toggleSlackChannel = async (channelId: string) => {
    if (!client || slackBusy) return
    setSlackBusy(true)
    try {
      const boundToMe = slackBound[channelId] === bot.name
      const ans = await setAnswering(
        client,
        boundToMe ? { transport: 'slack', unbind: [channelId] } : { transport: 'slack', channels: { [channelId]: bot.name } },
      )
      setSlackBound(ans.channels || {})
    } catch (e) {
      setWrong(say(e, t('Slack channel routing'), 'save', t))
    } finally {
      setSlackBusy(false)
    }
  }

  const submitAutomation = async (e: FormEvent) => {
    e.preventDefault()
    if (!client || autoBusy || !autoName.trim() || !autoInstructions.trim()) return
    setAutoBusy(true)
    setWrong(null)
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      let sched: AutomationSchedule | undefined
      if (autoMode === 'schedule') {
        if (autoCustomWhen.trim()) {
          sched = (await parseAutomationWhen(client, autoCustomWhen.trim(), zone)) ?? undefined
        }
        if (!sched) {
          const found = SCHEDULE_PRESETS.find((p) => p.id === autoPreset) ?? SCHEDULE_PRESETS[0]
          sched = { ...found.schedule, tz: zone }
        }
      }
      const evDef = EVENT_TRIGGERS.find((ev) => ev.id === autoEventId) ?? EVENT_TRIGGERS[0]

      await createBotAutomation(client, {
        botName: bot.name,
        name: autoName.trim(),
        instructions: autoInstructions.trim(),
        mode: autoMode,
        schedule: sched,
        event: autoMode === 'event' ? { source: evDef.source, name: evDef.name } : undefined,
        model: bot.model,
      })
      setAutoName('')
      setAutoInstructions('')
      setAutoCustomWhen('')
      setAutoModalOpen(false)
      await survey()
    } catch (err) {
      setWrong(say(err, t('automation'), 'save', t))
    } finally {
      setAutoBusy(false)
    }
  }

  const handleToggleAuto = async (a: BotAutomation, enabled: boolean) => {
    if (!client || autoBusy) return
    setAutoBusy(true)
    try {
      await toggleBotAutomation(client, a.id, enabled)
      setAutomations((list) => list.map((x) => (x.id === a.id ? { ...x, enabled } : x)))
    } catch (err) {
      setWrong(say(err, a.name, 'save', t))
    } finally {
      setAutoBusy(false)
    }
  }

  const handleRunAutoNow = async (a: BotAutomation) => {
    if (!client || autoBusy) return
    setAutoBusy(true)
    try {
      await runBotAutomation(client, a.id)
      await survey()
    } catch (err) {
      setWrong(say(err, a.name, 'save', t))
    } finally {
      setAutoBusy(false)
    }
  }

  const handleDeleteAuto = async (a: BotAutomation) => {
    if (!client || autoBusy) return
    setAutoBusy(true)
    try {
      await deleteBotAutomation(client, a.id)
      setAutomations((list) => list.filter((x) => x.id !== a.id))
    } catch (err) {
      setWrong(say(err, a.name, 'save', t))
    } finally {
      setAutoBusy(false)
    }
  }

  const routine = cron ? bot.description || instructions.split('\n')[0].trim() || displayName : ''
  const scheduleLine = cron
    ? activeSchedule
      ? words(cron, locale, t)
      : cron === 'paused'
        ? t('Paused')
        : `${t('Paused')} · ${words(cron, locale, t)}`
    : ''

  const vaultSummary = useMemo(() => {
    const logins = vaultDoc.items.filter((i) => i.kind === 'login').length
    const keys = vaultDoc.items.filter((i) => i.kind !== 'login').length
    const linked: string[] = []
    if (vaultDoc.providers.onepassword?.connected) linked.push('1Password')
    if (vaultDoc.providers.lastpass?.connected) linked.push('LastPass')
    linked.push('KMS')
    if (logins + keys === 0) {
      return t('1Password, LastPass & KMS autofill')
    }
    return t('{logins} logins · {keys} keys ({srcs})', {
      logins,
      keys,
      srcs: linked.join(', '),
    })
  }, [vaultDoc, t])

  const selectedEventDef = EVENT_TRIGGERS.find((e) => e.id === autoEventId) ?? EVENT_TRIGGERS[0]

  const libraryItems = useMemo(() => {
    const items: Array<{ key: string; kind: 'doc' | 'image'; label: string; sub?: string; href?: string }> = []
    for (const r of runs) {
      for (const blob of [r.input, r.output]) {
        if (!blob) continue
        for (const [idx, part] of partsOf(blob).entries()) {
          if (part.kind === 'doc') {
            items.push({ key: `${r.id}-${idx}-${part.name}`, kind: 'doc', label: part.name, sub: part.size, href: part.href })
          } else if (part.kind === 'image') {
            items.push({ key: `${r.id}-${idx}-img`, kind: 'image', label: part.alt || t('Preview image'), href: part.src })
          }
        }
      }
    }
    return items.reverse()
  }, [runs, t])

  return (
    <YStack flex={1} minW={300} $max-sm={{ minW: 0 }} minH={0} overflowY="auto" overflowX="hidden" pb={32} aria-label={displayName} render="aside">
      <XStack minH={46} $max-sm={{ minH: 52, px: 10 }} shrink={0} px={12} items="center" justify="flex-end">
        <XStack
          {...ROUND}
          borderColor="var(--border-strong)"
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
          $max-sm={{ width: 44, height: 44 }}
          aria-label={t('Close')}
          onClick={onClose}
          {...{ autoFocus: focus }}
        >
          <X size={16} color={INK} aria-hidden />
        </XStack>
      </XStack>

      <YStack items="center" gap={10} pt={2} pb={20} px={14}>
        <Face bot={bot} size={68} starred={isPrimary} />
        <YStack items="center" gap={2} maxW="100%">
          <Text {...CLIP} maxW="100%" fontSize={17} lineHeight={22} fontWeight="600" letterSpacing={-0.34} color={INK}>
            {displayName}
          </Text>
          <Text fontSize={12} lineHeight={16} color={DIM} text="center">
            {isPrimary ? t('Primary bot · Layer 0 (directs all bots)') : t('Layer {lv} bot', { lv: currentLayer })}
          </Text>
        </YStack>
        <XStack
          data-parity-key="bots.panel.tabs"
          role="tablist"
          mt={4}
          p={3}
          rounded={999}
          bg={RAISED}
          borderWidth={1}
          borderColor="var(--border-strong)"
          gap={2}
        >
          {(['activity', 'library'] as const).map((id) => {
            const selected = tab === id
            return (
              <XStack
                key={id}
                render={<button type="button" role="tab" aria-selected={selected} />}
                onClick={() => setTab(id)}
                height={28}
                $max-sm={{ minH: 40 }}
                px={14}
                rounded={999}
                items="center"
                justify="center"
                bg={selected ? PICKED : 'transparent'}
                borderWidth={0}
                cursor="pointer"
                transition="quickest"
                hoverStyle={{ bg: PICKED }}
                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              >
                <Text fontSize={13} lineHeight={18} fontWeight={selected ? '500' : '400'} color={selected ? INK : DIM}>
                  {id === 'activity' ? t('Activity') : t('Library')}
                </Text>
              </XStack>
            )
          })}
        </XStack>
      </YStack>

      {tab === 'activity' ? (
        <YStack px={15} pb={32} gap={24}>
          {/* Resumable Desktop Sandbox Computer */}
          <YStack gap={6} data-parity-key="bots.panel.computer">
            <Text {...LABEL} px={4}>
              {t('Computer')}
            </Text>
            <XStack
              {...CARD}
              render={<button type="button" />}
              onClick={() => setComputerOpen(true)}
              aria-label={t('Open {name}’s desktop computer', { name: displayName })}
              minH={60}
              px={13}
              py={10}
              items="center"
              gap={12}
              cursor="pointer"
              transition="quickest"
              hoverStyle={{ bg: PICKED, borderColor: 'var(--border-strong)' }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            >
              <YStack flex={1} minW={0} items="flex-start" gap={2}>
                <Text {...CLIP} fontSize={14} lineHeight={19} fontWeight="500" color={INK}>
                  {t("Bot's computer")}
                </Text>
                <Text {...CLIP} fontSize={12} lineHeight={17} color={DIM}>
                  {stateLabel(box, Boolean(ext.computeRef), t)}
                </Text>
              </YStack>
              <ComputerScreen awake={box?.status === 'running'} parked={Boolean(box || ext.computeRef)} />
            </XStack>
          </YStack>

          {/* Automations (Scheduled & Event-Driven) */}
          <YStack gap={6} data-parity-key="bots.panel.automations">
            <XStack items="center" justify="space-between" flexWrap="wrap" px={4} gap={6}>
              <Text {...LABEL}>{t('Automations')}</Text>
              <XStack items="center" gap={4}>
                <XStack
                  render={<a href={FLOW} />}
                  data-slot="bots-panel-open-flow"
                  items="center"
                  gap={3}
                  px={6}
                  py={2}
                  rounded={6}
                  bg="transparent"
                  cursor="pointer"
                  transition="quickest"
                  hoverStyle={{ bg: PICKED }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  $max-sm={{ minH: 44, px: 10 }}
                  $platform-web={{ textDecoration: 'none' }}
                >
                  <Text fontSize={12} lineHeight={16} color={DIM}>
                    {t('Open in Flow')}
                  </Text>
                  <ExternalLink size={11} color={DIM} aria-hidden />
                </XStack>
                <XStack
                  render={<button type="button" />}
                  onClick={() => setAutoModalOpen(true)}
                  items="center"
                  gap={3}
                  px={6}
                  py={2}
                  rounded={6}
                  bg="transparent"
                  borderWidth={0}
                  cursor="pointer"
                  transition="quickest"
                  hoverStyle={{ bg: PICKED }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  $max-sm={{ minH: 44, px: 10 }}
                >
                  <Plus size={12} color={DIM} aria-hidden />
                  <Text fontSize={12} lineHeight={16} color={DIM}>
                    {t('Add')}
                  </Text>
                </XStack>
              </XStack>
            </XStack>

            <YStack {...CARD}>
              {cron ? (
                <Row
                  mark={<Clock size={16} color={DIM} aria-hidden />}
                  title={routine}
                  line={scheduleLine}
                  last={automations.length === 0}
                >
                  <PanelSwitch
                    aria-label={t('Run {name} on its schedule', { name: displayName })}
                    checked={activeSchedule}
                    disabled={saving}
                    onCheckedChange={(on: boolean) => {
                      setWrong(null)
                      setSaving(true)
                      onSchedule(on, cron === 'paused' ? '0 9 * * *' : cron)
                        .catch((e) => setWrong(say(e, t('{name}’s schedule', { name: displayName }), 'save', t)))
                        .finally(() => setSaving(false))
                    }}
                  />
                </Row>
              ) : null}

              {automations.map((a, idx) => {
                const isEvent = Boolean(a.event?.source)
                const isLast = idx === automations.length - 1
                return (
                  <Row
                    key={a.id}
                    mark={isEvent ? <Zap size={16} color={INK} aria-hidden /> : <Clock size={16} color={DIM} aria-hidden />}
                    title={a.name}
                    line={describeAutomation(a, t)}
                    last={isLast}
                  >
                    <XStack items="center" gap={6}>
                      <XStack
                        render={<button type="button" />}
                        aria-label={t('Run {name} now', { name: a.name })}
                        disabled={autoBusy}
                        onClick={() => runNow.ask(() => void handleRunAutoNow(a))}
                        width={26}
                        height={26}
                        $max-sm={{ width: 44, height: 44 }}
                        rounded={999}
                        items="center"
                        justify="center"
                        bg="transparent"
                        borderWidth={0}
                        cursor="pointer"
                        transition="quickest"
                        hoverStyle={{ bg: PICKED }}
                        focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                      >
                        <Play size={12} color={DIM} aria-hidden />
                      </XStack>
                      <PanelSwitch
                        aria-label={t('Toggle {name}', { name: a.name })}
                        checked={a.enabled}
                        disabled={autoBusy}
                        onCheckedChange={(on: boolean) => void handleToggleAuto(a, on)}
                      />
                      <XStack
                        render={<button type="button" />}
                        aria-label={t('Delete {name}', { name: a.name })}
                        disabled={autoBusy}
                        onClick={() => setUnmaking(a)}
                        ml={4}
                        width={24}
                        height={24}
                        $max-sm={{ width: 44, height: 44 }}
                        rounded={999}
                        items="center"
                        justify="center"
                        bg="transparent"
                        borderWidth={0}
                        cursor="pointer"
                        transition="quickest"
                        hoverStyle={{ bg: PICKED }}
                        focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                      >
                        <Trash2 size={12} color={DIM} aria-hidden />
                      </XStack>
                    </XStack>
                  </Row>
                )
              })}

              {!cron && automations.length === 0 ? (
                <XStack
                  render={<button type="button" />}
                  onClick={() => setAutoModalOpen(true)}
                  width="100%"
                  minW={0}
                  overflow="hidden"
                  minH={50}
                  px={13}
                  py={9}
                  items="center"
                  justify="space-between"
                  gap={10}
                  bg="transparent"
                  borderWidth={0}
                  cursor="pointer"
                  transition="quickest"
                  hoverStyle={{ bg: PICKED }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                >
                  <YStack flex={1} minW={0} items="flex-start" gap={2}>
                    <Text {...CLIP} fontSize={14} lineHeight={19} fontWeight="500" color={INK}>
                      {t('Scheduled & event-driven work')}
                    </Text>
                    <Text {...CLIP} fontSize={12} lineHeight={17} color={DIM}>
                      {t('Run on cron schedules, Slack mentions, GitHub PRs, or webhooks')}
                    </Text>
                  </YStack>
                  <XStack shrink={0} items="center">
                    <ChevronRight size={15} color={DIM} aria-hidden />
                  </XStack>
                </XStack>
              ) : null}
            </YStack>
          </YStack>

          {/* Unified Secrets, Logins & Autofill */}
          <YStack gap={6} data-parity-key="bots.panel.vault">
            <Text {...LABEL} px={4}>
              {t('Secrets & login autofill')}
            </Text>
            <XStack
              {...CARD}
              render={<button type="button" />}
              onClick={() => setVaultOpen(true)}
              width="100%"
              minW={0}
              overflow="hidden"
              minH={52}
              px={13}
              py={9}
              items="center"
              gap={11}
              cursor="pointer"
              transition="quickest"
              hoverStyle={{ bg: PICKED, borderColor: 'var(--border-strong)' }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            >
              <XStack shrink={0} items="center">
                <KeyRound size={17} color={INK} aria-hidden />
              </XStack>
              <YStack flex={1} minW={0} items="flex-start" gap={2}>
                <Text {...CLIP} fontSize={14} lineHeight={19} fontWeight="500" color={INK}>
                  {t('Unified vault & password autofill')}
                </Text>
                <Text {...CLIP} fontSize={12} lineHeight={17} color={DIM}>
                  {vaultSummary}
                </Text>
              </YStack>
              <XStack shrink={0} items="center">
                <ChevronRight size={15} color={DIM} aria-hidden />
              </XStack>
            </XStack>
          </YStack>

          {/* Slack Sync */}
          <YStack gap={6} data-parity-key="bots.panel.slack">
            <XStack items="center" justify="space-between" px={4}>
              <Text {...LABEL}>{t('Slack agent sync')}</Text>
              {slackConn.connected ? (
                <XStack
                  render={<button type="button" />}
                  disabled={slackBusy}
                  onClick={() => void syncSlack()}
                  items="center"
                  gap={4}
                  px={6}
                  py={2}
                  $max-sm={{ minH: 44, px: 10 }}
                  rounded={6}
                  bg="transparent"
                  borderWidth={0}
                  cursor="pointer"
                  transition="quickest"
                  hoverStyle={{ bg: PICKED }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                >
                  <RefreshCw size={11} color={DIM} aria-hidden />
                  <Text fontSize={12} lineHeight={16} color={DIM}>
                    {t('Sync channels')}
                  </Text>
                </XStack>
              ) : null}
            </XStack>

            <YStack {...CARD}>
              <Row
                mark={<Network transport="slack" size={20} />}
                title={
                  slackConn.connected
                    ? slackConn.account
                      ? `Slack · ${slackConn.account}`
                      : t('Slack connected')
                    : t('Add @hanzo to Slack')
                }
                line={
                  slackConn.connected
                    ? slackDefault === bot.name
                      ? t('Answers @hanzo in Slack by default')
                      : t('Default responder: {def}', { def: slackDefault })
                    : t('Sync channels, threads, and DMs like @hanzo')
                }
                last={!slackConn.connected}
              >
                {slackConn.connected ? (
                  <PanelSwitch
                    aria-label={t('Answer @hanzo in Slack with {name}', { name: displayName })}
                    checked={slackDefault === bot.name}
                    disabled={slackBusy}
                    onCheckedChange={(on: boolean) => void toggleSlackDefault(on)}
                  />
                ) : (
                  <XStack
                    render={<button type="button" />}
                    disabled={slackBusy}
                    onClick={() => void connectSlack()}
                    height={30}
                    $max-sm={{ minH: 44 }}
                    px={11}
                    rounded={999}
                    items="center"
                    gap={5}
                    bg={INK}
                    borderWidth={1}
                    borderColor={INK}
                    cursor="pointer"
                    transition="quickest"
                    hoverStyle={{ opacity: 0.9 }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  >
                    <ExternalLink size={11} color="var(--background)" aria-hidden />
                    <Text fontSize={12} lineHeight={16} fontWeight="600" color="var(--background)">
                      {t('Add to Slack')}
                    </Text>
                  </XStack>
                )}
              </Row>

              {slackConn.connected && slackChans.length > 0 ? (
                <YStack px={13} py={10} gap={6}>
                  <Text fontSize={12} lineHeight={16} color={DIM}>
                    {t('Bind channels directly to {name}:', { name: displayName })}
                  </Text>
                  <XStack flexWrap="wrap" gap={6}>
                    {slackChans.slice(0, 8).map((ch) => {
                      const mine = slackBound[ch.id] === bot.name
                      return (
                        <XStack
                          key={ch.id}
                          render={<button type="button" />}
                          aria-pressed={mine}
                          disabled={slackBusy}
                          onClick={() => void toggleSlackChannel(ch.id)}
                          height={26}
                          $max-sm={{ minH: 40 }}
                          px={9}
                          rounded={999}
                          items="center"
                          bg={mine ? PICKED : GROUND}
                          borderWidth={1}
                          borderColor={mine ? 'var(--border-strong)' : LINE}
                          cursor="pointer"
                          transition="quickest"
                          hoverStyle={{ bg: PICKED }}
                          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                        >
                          <Text fontSize={12} lineHeight={16} fontWeight={mine ? '600' : '400'} color={mine ? INK : DIM}>
                            {`#${ch.name}`}
                          </Text>
                        </XStack>
                      )
                    })}
                  </XStack>
                </YStack>
              ) : null}
            </YStack>

            {slackNote ? (
              <Text fontSize={12} lineHeight={17} color={DIM} px={4}>
                {slackNote}
              </Text>
            ) : null}
          </YStack>

          {/* Connected Channels */}
          {answers.length ? (
            <YStack gap={6} data-parity-key="bots.panel.networks">
              <Text {...LABEL} px={4}>
                {t('Connected channels')}
              </Text>
              <YStack {...CARD}>
                {answers.map((id, i) => (
                  <Row
                    key={id}
                    mark={<Network transport={id} size={18} />}
                    title={of(id).name}
                    line={t('Connected')}
                    last={i === answers.length - 1}
                  >
                    <ChevronRight size={15} color={DIM} aria-hidden />
                  </Row>
                ))}
              </YStack>
            </YStack>
          ) : null}

          {/* Connectors */}
          <YStack gap={6} data-parity-key="bots.panel.connectors">
            <XStack items="center" justify="space-between" px={4}>
              <Text {...LABEL}>{t('Connectors')}</Text>
              <XStack
                render={<button type="button" />}
                onClick={() => setConnectorsOpen(true)}
                items="center"
                gap={3}
                px={6}
                py={2}
                $max-sm={{ minH: 44, px: 10 }}
                rounded={6}
                bg="transparent"
                borderWidth={0}
                cursor="pointer"
                transition="quickest"
                hoverStyle={{ bg: PICKED }}
                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              >
                <Plus size={12} color={DIM} aria-hidden />
                <Text fontSize={12} lineHeight={16} color={DIM}>
                  {t('Add')}
                </Text>
              </XStack>
            </XStack>
            <XStack
              {...CARD}
              render={<button type="button" />}
              onClick={() => setConnectorsOpen(true)}
              width="100%"
              minW={0}
              overflow="hidden"
              minH={50}
              px={13}
              py={9}
              items="center"
              justify="space-between"
              gap={10}
              cursor="pointer"
              transition="quickest"
              hoverStyle={{ bg: PICKED, borderColor: 'var(--border-strong)' }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            >
              <YStack flex={1} minW={0} items="flex-start" gap={2}>
                <Text {...CLIP} fontSize={14} lineHeight={19} fontWeight="500" color={INK}>
                  {answers.length ? t('{n} channels connected', { n: answers.length }) : t('Connect Slack, GitHub, Linear, Stripe…')}
                </Text>
                <Text {...CLIP} fontSize={12} lineHeight={17} color={DIM}>
                  {t('External apps, socials & MCP tools')}
                </Text>
              </YStack>
              <XStack shrink={0} items="center">
                <ChevronRight size={15} color={DIM} aria-hidden />
              </XStack>
            </XStack>
          </YStack>

          {/* Progressive Disclosure: Hierarchy & Voice Settings */}
          <YStack gap={16}>
            <XStack
              {...CARD}
              render={<button type="button" />}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              width="100%"
              minW={0}
              minH={46}
              px={13}
              py={9}
              items="center"
              justify="space-between"
              gap={10}
              cursor="pointer"
              transition="quickest"
              hoverStyle={{ bg: PICKED, borderColor: 'var(--border-strong)' }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            >
              <YStack flex={1} minW={0} items="flex-start" gap={2}>
                <Text {...CLIP} fontSize={14} lineHeight={19} fontWeight="500" color={INK}>
                  {t('More settings')}
                </Text>
                <Text {...CLIP} fontSize={12} lineHeight={17} color={DIM}>
                  {t('Layer {lv} · Voice: {voice}', { lv: currentLayer, voice: voiceName })}
                </Text>
              </YStack>
              <XStack shrink={0} items="center">
                {moreOpen ? <ChevronDown size={15} color={DIM} aria-hidden /> : <ChevronRight size={15} color={DIM} aria-hidden />}
              </XStack>
            </XStack>

            {moreOpen ? (
              <YStack gap={20}>
                {/* Hierarchy & Layer Coordination */}
                <YStack gap={6} data-parity-key="bots.panel.hierarchy">
                  <Text {...LABEL} px={4}>
                    {t('Hierarchy & coordination')}
                  </Text>
                  <YStack {...CARD}>
                    <Row
                      mark={isPrimary ? <Star size={16} color={INK} aria-hidden /> : <Layers size={16} color={DIM} aria-hidden />}
                      title={isPrimary ? t('Primary bot (max 1)') : t('Subordinate bot')}
                      line={
                        isPrimary
                          ? t('Directs worker bots & layered bot groups')
                          : t('Directed by primary bot ({primary})', { primary: PRIMARY_BOT })
                      }
                      last={isPrimary && groups.length === 0}
                    >
                      {!isPrimary ? (
                        <XStack
                          render={<button type="button" />}
                          disabled={saving}
                          onClick={() => void promotePrimary()}
                          height={28}
                          $max-sm={{ minH: 44 }}
                          px={10}
                          rounded={999}
                          items="center"
                          bg={GROUND}
                          borderWidth={1}
                          borderColor="var(--border-strong)"
                          cursor="pointer"
                          transition="quickest"
                          hoverStyle={{ bg: PICKED }}
                          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                        >
                          <Text fontSize={12} lineHeight={16} fontWeight="500" color={INK}>
                            {t('Make primary')}
                          </Text>
                        </XStack>
                      ) : null}
                    </Row>

                    {!isPrimary ? (
                      <VoiceRow
                        label={t('Layer')}
                        value={`Layer ${currentLayer}`}
                        options={['Layer 1', 'Layer 2', 'Layer 3']}
                        onSelect={(opt) => void assignLayer(Number(opt.replace('Layer ', '')) || 1)}
                        last={groups.length === 0}
                      />
                    ) : null}

                    {groups.length > 0 ? (
                      <XStack minH={44} px={14} items="center" justify="space-between" gap={8}>
                        <Text fontSize={14} lineHeight={19} color={INK}>
                          {t('Group')}
                        </Text>
                        <XStack items="center" gap={6}>
                          {assignedGroup && onPickGroup ? (
                            <XStack
                              render={<button type="button" />}
                              onClick={() => onPickGroup(toGroupRef(assignedGroup.name))}
                              px={8}
                              py={3}
                              $max-sm={{ minH: 44, items: 'center' }}
                              rounded={999}
                              bg={PICKED}
                              borderWidth={1}
                              borderColor="var(--border-strong)"
                              cursor="pointer"
                              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                            >
                              <Text fontSize={12} lineHeight={16} color={INK}>
                                {t('Open')}
                              </Text>
                            </XStack>
                          ) : null}
                          <DropdownMenu placement="bottom-end" offset={6}>
                            <DropdownMenuTrigger asChild>
                              <XStack
                                render={<button type="button" />}
                                items="center"
                                gap={5}
                                px={6}
                                py={4}
                                $max-sm={{ minH: 44 }}
                                rounded={6}
                                bg="transparent"
                                borderWidth={0}
                                cursor="pointer"
                                transition="quickest"
                                hoverStyle={{ bg: PICKED }}
                                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                              >
                                <Text fontSize={13} lineHeight={18} color={INK}>
                                  {assignedGroup ? assignedGroup.name : t('None')}
                                </Text>
                                <ChevronDown size={14} color={DIM} aria-hidden />
                              </XStack>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent minW={170}>
                              <DropdownMenuItem onSelect={() => void assignGroup('')}>
                                <Text fontSize="$3" color="$ink">
                                  {t('None')}
                                </Text>
                              </DropdownMenuItem>
                              {groups.map((g) => (
                                <DropdownMenuItem key={g.id} onSelect={() => void assignGroup(g.id)}>
                                  <Text fontSize="$3" color="$ink">
                                    {`${g.name} (L${g.layer || 1})`}
                                  </Text>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </XStack>
                      </XStack>
                    ) : null}
                  </YStack>
                </YStack>

                {/* Voice chat */}
                <YStack gap={6} data-parity-key="bots.panel.voice">
                  <Text {...LABEL} px={4}>
                    {t('Voice chat')}
                  </Text>
                  <YStack {...CARD}>
                    <VoiceRow label={t('Voice')} value={voiceName} options={VOICES} onSelect={setVoiceName} />
                    <VoiceRow label={t('Speed')} value={voiceSpeed} options={SPEEDS} onSelect={setVoiceSpeed} />
                    <VoiceRow label={t('Language')} value={voiceLang} options={LANGUAGES} onSelect={setVoiceLang} last />
                  </YStack>
                </YStack>
              </YStack>
            ) : null}
          </YStack>

          {wrong ? (
            <Text render="p" role="alert" px={8} m={0} fontSize={13} lineHeight={18} color="var(--state-error)">
              {wrong}
            </Text>
          ) : null}

          {!isPrimary ? (
            <XStack px={4} pt={16} mt={4} borderTopWidth={1} borderColor={LINE}>
              <Text
                render={<button type="button" />}
                onClick={() => setDeleting(true)}
                bg="transparent"
                borderWidth={0}
                px={8}
                py={6}
                $max-sm={{ minH: 44 }}
                rounded={8}
                cursor="pointer"
                fontSize={13}
                lineHeight={18}
                color={DIM}
                hoverStyle={{ color: 'var(--state-error)', bg: PICKED }}
                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              >
                {t('Delete {name}', { name: displayName })}
              </Text>
            </XStack>
          ) : null}
        </YStack>
      ) : (
        <YStack px={15} pb={32} gap={12} data-parity-key="bots.panel.library">
          {libraryItems.length ? (
            <YStack {...CARD}>
              {libraryItems.map((item, i) => (
                <Row
                  key={item.key}
                  mark={
                    item.kind === 'doc' ? <FileText size={16} color={DIM} aria-hidden /> : <ImageIcon size={16} color={DIM} aria-hidden />
                  }
                  title={item.label}
                  line={item.sub}
                  last={i === libraryItems.length - 1}
                >
                  {item.href ? <ChevronRight size={15} color={DIM} aria-hidden /> : null}
                </Row>
              ))}
            </YStack>
          ) : (
            <YStack {...CARD} px={14} py={16} items="center">
              <Text fontSize={13} lineHeight={19} color={DIM} text="center">
                {t('Files, documents, and images shared with {name} appear here.', { name: displayName })}
              </Text>
            </YStack>
          )}
        </YStack>
      )}

      {/* Create Scheduled or Event-Driven Automation Modal */}
      <Dialog open={autoModalOpen} onOpenChange={setAutoModalOpen}>
        <DialogContent
          data-parity-key="bots.automations.dialog"
          width="calc(100vw - 24px)"
          maxW={540}
          $max-sm={{ maxW: 'calc(100vw - 24px)', rounded: 14 }}
          maxH="90vh"
          overflowY="auto"
          p={0}
          showCloseButton={false}
          bg={GROUND}
          borderWidth={1}
          borderColor="var(--border-strong)"
          rounded={18}
          overflow="hidden"
        >
          <YStack p={22} $max-sm={{ p: 16 }} gap={18} bg={GROUND}>
            <XStack items="center" justify="space-between" gap={10}>
              <DialogTitle>
                <Text fontSize={17} lineHeight={23} fontWeight="600" letterSpacing={-0.34} color={INK}>
                  {t('New automation for {name}', { name: displayName })}
                </Text>
              </DialogTitle>
              <XStack
                {...ROUND}
                width={30}
                height={30}
                borderColor="var(--border-strong)"
                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                $max-sm={{ width: 44, height: 44 }}
                aria-label={t('Close')}
                onClick={() => setAutoModalOpen(false)}
              >
                <X size={15} color={INK} aria-hidden />
              </XStack>
            </XStack>

            <XStack p={3} rounded={14} bg={RAISED} borderWidth={1} borderColor="var(--border-strong)" gap={4} flexWrap="wrap">
              {(
                [
                  { id: 'schedule', label: t('Scheduled (cron / time)'), Icon: Clock },
                  { id: 'event', label: t('Event-driven (webhook / app)'), Icon: Zap },
                ] as const
              ).map(({ id, label, Icon }) => {
                const active = autoMode === id
                return (
                  <XStack
                    key={id}
                    render={<button type="button" />}
                    aria-pressed={active}
                    onClick={() => setAutoMode(id)}
                    flex={1}
                    minW={140}
                    height={32}
                    $max-sm={{ minH: 44 }}
                    px={10}
                    gap={6}
                    rounded={10}
                    items="center"
                    justify="center"
                    bg={active ? PICKED : 'transparent'}
                    borderWidth={0}
                    cursor="pointer"
                    transition="quickest"
                    hoverStyle={{ bg: PICKED }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  >
                    <Icon size={13} color={active ? INK : DIM} aria-hidden />
                    <Text fontSize={12} lineHeight={16} fontWeight={active ? '600' : '400'} color={active ? INK : DIM} numberOfLines={1}>
                      {label}
                    </Text>
                  </XStack>
                )
              })}
            </XStack>

            <YStack render="form" {...{ onSubmit: submitAutomation }} gap={14}>
              <Input
                unstyled
                value={autoName}
                onChange={(e) => setAutoName(e.target.value)}
                placeholder={
                  autoMode === 'schedule'
                    ? t('Name (e.g., Daily Hanzo leadership update)')
                    : t('Name (e.g., Triage new GitHub pull requests)')
                }
                aria-label={t('Automation name')}
                width="100%"
                px={13}
                py={10}
                $max-sm={{ minH: 44 }}
                rounded={10}
                bg={RAISED}
                borderWidth={1}
                borderColor="var(--border-strong)"
                focusStyle={{ borderColor: 'var(--ring)' }}
                color={INK}
                fontSize={14}
                placeholderTextColor="$placeholderColor"
              />

              {autoMode === 'schedule' ? (
                <YStack gap={8}>
                  <XStack flexWrap="wrap" gap={6}>
                    {SCHEDULE_PRESETS.map((p) => {
                      const active = autoPreset === p.id && !autoCustomWhen.trim()
                      return (
                        <XStack
                          key={p.id}
                          render={<button type="button" />}
                          aria-pressed={active}
                          onClick={() => {
                            setAutoPreset(p.id)
                            setAutoCustomWhen('')
                          }}
                          height={30}
                          $max-sm={{ minH: 40 }}
                          px={11}
                          rounded={999}
                          items="center"
                          bg={active ? PICKED : RAISED}
                          borderWidth={1}
                          borderColor={active ? 'var(--border-strong)' : LINE}
                          cursor="pointer"
                          transition="quickest"
                          hoverStyle={{ bg: PICKED }}
                          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                        >
                          <Text fontSize={12} lineHeight={16} fontWeight={active ? '600' : '400'} color={active ? INK : DIM}>
                            {t(p.label)}
                          </Text>
                        </XStack>
                      )
                    })}
                  </XStack>
                  <Input
                    unstyled
                    value={autoCustomWhen}
                    onChange={(e) => setAutoCustomWhen(e.target.value)}
                    placeholder={t('Or type any schedule in plain English (e.g., "Fridays at 4pm" or "every 2 hours")')}
                    aria-label={t('Natural language schedule')}
                    width="100%"
                    px={13}
                    py={9}
                    $max-sm={{ minH: 44 }}
                    rounded={10}
                    bg={RAISED}
                    borderWidth={1}
                    borderColor="var(--border-strong)"
                    focusStyle={{ borderColor: 'var(--ring)' }}
                    color={INK}
                    fontSize={13}
                    placeholderTextColor="$placeholderColor"
                  />
                </YStack>
              ) : (
                <YStack gap={8}>
                  <XStack flexWrap="wrap" gap={6}>
                    {EVENT_TRIGGERS.map((ev) => {
                      const active = autoEventId === ev.id
                      return (
                        <XStack
                          key={ev.id}
                          render={<button type="button" />}
                          aria-pressed={active}
                          onClick={() => setAutoEventId(ev.id)}
                          height={30}
                          $max-sm={{ minH: 40 }}
                          px={11}
                          rounded={999}
                          items="center"
                          bg={active ? PICKED : RAISED}
                          borderWidth={1}
                          borderColor={active ? 'var(--border-strong)' : LINE}
                          cursor="pointer"
                          transition="quickest"
                          hoverStyle={{ bg: PICKED }}
                          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                        >
                          <Text fontSize={12} lineHeight={16} fontWeight={active ? '600' : '400'} color={active ? INK : DIM}>
                            {t(ev.label)}
                          </Text>
                        </XStack>
                      )
                    })}
                  </XStack>
                  <YStack px={12} py={9} rounded={10} bg={FLOOR} borderWidth={1} borderColor={LINE} gap={3}>
                    <Text fontSize={12} lineHeight={16} color={INK}>
                      {t(selectedEventDef.hint)}
                    </Text>
                    <Text fontFamily="$mono" fontSize={11} lineHeight={15} color={DIM} numberOfLines={2}>
                      {`POST ${api()}/v1/auto/hooks/${selectedEventDef.source}/${selectedEventDef.name}`}
                    </Text>
                  </YStack>
                </YStack>
              )}

              <Input
                unstyled
                render="textarea"
                rows={4}
                value={autoInstructions}
                onChange={(e) => setAutoInstructions(e.target.value)}
                placeholder={t(
                  'Instructions for {name}: what to check, which tools or desktop browser logins to use, and where to post the result…',
                  { name: displayName },
                )}
                aria-label={t('Automation instructions')}
                width="100%"
                px={13}
                py={10}
                rounded={10}
                bg={RAISED}
                borderWidth={1}
                borderColor="var(--border-strong)"
                focusStyle={{ borderColor: 'var(--ring)' }}
                color={INK}
                fontSize={14}
                placeholderTextColor="$placeholderColor"
              />

              <XStack justify="flex-end" gap={8} pt={6} flexWrap="wrap">
                <XStack
                  {...PILL}
                  minH={36}
                  borderColor="var(--border-strong)"
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  $max-sm={{ minH: 44 }}
                  onClick={() => setAutoModalOpen(false)}
                >
                  <Text {...WORD}>{t('Cancel')}</Text>
                </XStack>
                <XStack
                  {...PILL}
                  {...{ type: 'submit' }}
                  minH={36}
                  bg={INK}
                  borderColor={INK}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  $max-sm={{ minH: 44 }}
                  disabled={autoBusy || !autoName.trim() || !autoInstructions.trim()}
                  opacity={autoBusy || !autoName.trim() || !autoInstructions.trim() ? 0.5 : 1}
                >
                  <Text {...WORD} fontWeight="600" color="var(--background)">
                    {autoBusy ? t('Saving…') : t('Create automation')}
                  </Text>
                </XStack>
              </XStack>
            </YStack>
          </YStack>
        </DialogContent>
      </Dialog>

      {runNow.dialog}
      <Confirm
        open={unmaking !== null}
        danger
        title={t('Delete {name}?', { name: unmaking?.name ?? '' })}
        body={t('The automation stops and is deleted for good, with its schedule.')}
        yes={t('Delete')}
        onYes={() => unmaking && void handleDeleteAuto(unmaking)}
        onOpenChange={(o) => !o && setUnmaking(null)}
      />
      <Confirm
        open={deleting}
        danger
        title={t('Delete {name}?', { name: displayName })}
        body={t('{name} and every message it was sent are deleted for good.', { name: displayName })}
        yes={t('Delete')}
        onYes={() => void onDelete().catch((e) => setWrong(say(e, displayName, 'save', t)))}
        onOpenChange={setDeleting}
      />

      <ComputerDialog
        open={computerOpen}
        onOpenChange={setComputerOpen}
        bot={ext}
        box={box}
        onUpdated={async () => {
          await survey()
          await onBotChanged?.()
        }}
      />

      <ConnectorsDialog
        open={connectorsOpen}
        onOpenChange={setConnectorsOpen}
        defaultFilter="all"
        onConnected={() => void survey()}
      />

      <VaultDialog
        open={vaultOpen}
        onOpenChange={setVaultOpen}
        onChanged={(doc) => setVaultDoc(doc)}
      />
    </YStack>
  )
}
