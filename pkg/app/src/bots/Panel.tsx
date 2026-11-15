'use client'

// The open bot's right inspector panel:
// - Avatar, Primary Bot ("hanzo" · Layer 0) status, [Activity | Library] segmented tabs
// - Hierarchy & Layer role card (Primary Bot promotion, Bot Group assignment, Layer 0..3)
// - Slack Sync & Channel Routing card (one-click Add to Slack, Sync Channels, default @hanzo responder, #channel bindings)
// - Upcoming routines & connected networks
// - Connectors launcher
// - Dedicated Desktop Sandbox Computer card opening ComputerDialog (live GUI + Terminal + Computer Use)
// - Voice chat preferences

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Agent, AgentRun, Sandbox } from '@hanzo/ai'
import { useI18n } from '@hanzo/i18n/react'
import { Text, XStack, YStack } from '@hanzo/gui'
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Switch,
} from '@hanzo/ui'
import {
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Layers,
  Plus,
  RefreshCw,
  Star,
  X,
} from 'lucide-react'
import { useKept } from '../kept'
import { useAi } from '../lib/ai'
import { say } from '../failure'
import { Network, of } from '../network'
import { called } from '../team'
import { ComputerDialog } from './ComputerDialog'
import { ConnectorsDialog } from './ConnectorsDialog'
import { Face } from './face'
import {
  ALWAYS,
  PRIMARY_BOT,
  answering,
  disk,
  setAnswering,
  setPrimaryBot,
  slackAuthorizeUrl,
  slackChannels,
  slackStatus,
  slackSyncChannels,
  toGroupRef,
  updateBotMeta,
  type BotAgent,
  type BotGroup,
  type SlackChannel,
} from './api'
import { CARD, CLIP, LABEL, PILL, ROUND, WORD } from './kit'
import { DIM, GROUND, INK, LINE, PICKED, RAISED } from './ink'
import { partsOf } from './said'
import { cron as words } from './time'

const VOICES = ['Liora', 'Aria', 'Sol', 'Koe', 'Nova', 'Echo'] as const
const SPEEDS = ['0.9x', '1x', '1.25x', '1.5x', '2x'] as const
const LANGUAGES = ['Auto-detect', 'English', 'Spanish', 'French', 'German', 'Japanese', 'Chinese'] as const

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
      <YStack flex={1} minW={0}>
        <Text {...CLIP} fontSize={14} lineHeight={19} color={INK}>
          {title}
        </Text>
        {line ? (
          <Text {...CLIP} fontSize={13} lineHeight={18} color={DIM}>
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
            render="button"
            {...{ type: 'button' }}
            items="center"
            gap={5}
            px={6}
            py={4}
            rounded={6}
            bg="transparent"
            borderWidth={0}
            cursor="pointer"
            hoverStyle={{ bg: PICKED }}
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

function ComputerScreen({ awake }: { awake: boolean }) {
  return (
    <YStack
      aria-hidden
      width={56}
      height={36}
      rounded={9}
      shrink={0}
      items="center"
      justify="center"
      position="relative"
      overflow="hidden"
      bg={PICKED}
      borderWidth={1}
      borderColor={LINE}
    >
      {awake ? (
        <YStack width={10} height={10} rounded={999} bg="var(--state-online)" />
      ) : (
        <>
          <Text position="absolute" t={2} r={6} fontSize={9} lineHeight={10} fontWeight="600" color={DIM}>
            z
          </Text>
          <svg width="20" height="18" viewBox="0 0 20 18" fill="none" aria-hidden="true">
            <path
              d="M10 16.2C10 16.2 2.5 11.4 2.5 6.3C2.5 3.8 4.4 2 6.7 2C8.1 2 9.3 2.7 10 3.8C10.7 2.7 11.9 2 13.3 2C15.6 2 17.5 3.8 17.5 6.3C17.5 11.4 10 16.2 10 16.2Z"
              fill="currentColor"
              opacity="0.34"
            />
            <circle cx="8.1" cy="7.9" r="0.9" fill="var(--pane-fill, var(--card))" />
            <circle cx="11.9" cy="7.9" r="0.9" fill="var(--pane-fill, var(--card))" />
          </svg>
        </>
      )}
    </YStack>
  )
}

function stateLabel(box: Sandbox | null, t: (s: string) => string): string {
  if (!box) return t('Asleep · click for Desktop GUI')
  if (box.status === 'running') return t('Awake · Desktop GUI & Shell')
  if (box.status === 'pending') return t('Waking desktop…')
  return box.error || t('Parked · click to wake')
}

const best = (boxes: readonly Sandbox[]): Sandbox | null =>
  boxes.find((b) => b.status === 'running') ?? boxes.find((b) => b.status === 'pending') ?? boxes[0] ?? null

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
  const [instructions, setInstructions] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [box, setBox] = useState<Sandbox | null>(null)
  const [computerOpen, setComputerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [connectorsOpen, setConnectorsOpen] = useState(false)

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
      const [detail, nets, boxes, slk] = await Promise.allSettled([
        client.agents.get(bot.name, opts),
        client.transports.list(opts),
        client.sandboxes.list({ project: disk(bot.name) }, opts),
        slackStatus(signal),
      ])
      if (signal?.aborted) return
      if (detail.status === 'fulfilled') setInstructions(detail.value.instructions ?? '')
      if (boxes.status === 'fulfilled') {
        setBox(best(boxes.value))
      }
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
    [client, bot.name],
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
      client.sandboxes
        .list({ project: disk(bot.name) }, { signal: stop.signal })
        .then((boxes) => setBox(best(boxes)))
        .catch(() => undefined)
    }, POLL)
    return () => {
      window.clearInterval(tick)
      stop.abort()
    }
  }, [client, box?.status, bot.name])

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

  const routine = cron ? bot.description || instructions.split('\n')[0].trim() || displayName : ''
  const scheduleLine = cron
    ? activeSchedule
      ? words(cron, locale, t)
      : cron === 'paused'
        ? t('Paused')
        : `${t('Paused')} · ${words(cron, locale, t)}`
    : ''

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
    <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden" aria-label={displayName} render="aside">
      <XStack height={46} shrink={0} px={12} items="center" justify="flex-end">
        <XStack {...ROUND} aria-label={t('Close')} onClick={onClose} {...{ autoFocus: focus }}>
          <X size={16} color={INK} aria-hidden />
        </XStack>
      </XStack>

      <YStack items="center" gap={8} pt={2} pb={18} px={14}>
        <Face bot={bot} size={68} starred={isPrimary} />
        <Text {...CLIP} maxW="100%" fontSize={18} lineHeight={23} fontWeight="600" color={INK}>
          {displayName}
        </Text>
        <Text fontSize={12} lineHeight={16} color={DIM}>
          {isPrimary ? t('Primary Bot · Layer 0 (Directs all bots)') : t('Layer {lv} Bot', { lv: currentLayer })}
        </Text>
        <XStack
          data-parity-key="bots.panel.tabs"
          role="tablist"
          p={3}
          rounded={999}
          bg={RAISED}
          borderWidth={1}
          borderColor={LINE}
          gap={2}
        >
          {(['activity', 'library'] as const).map((id) => {
            const selected = tab === id
            return (
              <XStack
                key={id}
                render="button"
                {...{ type: 'button', role: 'tab', 'aria-selected': selected }}
                onClick={() => setTab(id)}
                height={28}
                px={14}
                rounded={999}
                items="center"
                justify="center"
                bg={selected ? PICKED : 'transparent'}
                borderWidth={0}
                cursor="pointer"
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
        <YStack px={15} pb={24} gap={18}>
          {/* Hierarchy & Layer Coordination */}
          <YStack gap={8} data-parity-key="bots.panel.hierarchy">
            <Text {...LABEL} px={4}>
              {t('Hierarchy & Coordination')}
            </Text>
            <YStack {...CARD}>
              <Row
                mark={isPrimary ? <Star size={16} color={INK} aria-hidden /> : <Layers size={16} color={DIM} aria-hidden />}
                title={isPrimary ? t('Primary Bot (Max 1)') : t('Subordinate Bot')}
                line={
                  isPrimary
                    ? t('Directs worker bots & layered Bot Groups')
                    : t('Directed by Primary Bot ({primary})', { primary: PRIMARY_BOT })
                }
                last={isPrimary && groups.length === 0}
              >
                {!isPrimary ? (
                  <XStack
                    render="button"
                    {...{ type: 'button' }}
                    disabled={saving}
                    onClick={() => void promotePrimary()}
                    height={26}
                    px={9}
                    rounded={999}
                    items="center"
                    bg={GROUND}
                    borderWidth={1}
                    borderColor={LINE}
                    cursor="pointer"
                    hoverStyle={{ bg: PICKED }}
                  >
                    <Text fontSize={11} lineHeight={15} fontWeight="500" color={INK}>
                      {t('Make Primary')}
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
                <XStack minH={44} px={14} items="center" justify="space-between">
                  <Text fontSize={14} lineHeight={19} color={INK}>
                    {t('Group')}
                  </Text>
                  <XStack items="center" gap={6}>
                    {assignedGroup && onPickGroup ? (
                      <XStack
                        render="button"
                        {...{ type: 'button' }}
                        onClick={() => onPickGroup(toGroupRef(assignedGroup.name))}
                        px={8}
                        py={3}
                        rounded={999}
                        bg={PICKED}
                        borderWidth={1}
                        borderColor={LINE}
                        cursor="pointer"
                      >
                        <Text fontSize={11} lineHeight={15} color={INK}>
                          {t('Open')}
                        </Text>
                      </XStack>
                    ) : null}
                    <DropdownMenu placement="bottom-end" offset={6}>
                      <DropdownMenuTrigger asChild>
                        <XStack
                          render="button"
                          {...{ type: 'button' }}
                          items="center"
                          gap={5}
                          px={6}
                          py={4}
                          rounded={6}
                          bg="transparent"
                          borderWidth={0}
                          cursor="pointer"
                          hoverStyle={{ bg: PICKED }}
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

          {/* Slack Sync ("Add to Slack" like @hanzo) */}
          <YStack gap={8} data-parity-key="bots.panel.slack">
            <XStack items="center" justify="space-between" px={4}>
              <Text {...LABEL}>{t('Slack Agent Sync')}</Text>
              {slackConn.connected ? (
                <XStack
                  render="button"
                  {...{ type: 'button' }}
                  disabled={slackBusy}
                  onClick={() => void syncSlack()}
                  items="center"
                  gap={4}
                  px={6}
                  py={2}
                  rounded={6}
                  bg="transparent"
                  borderWidth={0}
                  cursor="pointer"
                  hoverStyle={{ bg: PICKED }}
                >
                  <RefreshCw size={11} color={DIM} aria-hidden />
                  <Text fontSize={11} lineHeight={15} color={DIM}>
                    {t('Sync channels')}
                  </Text>
                </XStack>
              ) : null}
            </XStack>

            <YStack {...CARD}>
              <Row
                mark={<Network transport="slack" size={20} />}
                title={slackConn.connected ? (slackConn.account ? `Slack · ${slackConn.account}` : t('Slack Connected')) : t('Add @hanzo to Slack')}
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
                  <Switch
                    aria-label={t('Answer @hanzo in Slack with {name}', { name: displayName })}
                    checked={slackDefault === bot.name}
                    disabled={slackBusy}
                    onCheckedChange={(on: boolean) => void toggleSlackDefault(on)}
                  />
                ) : (
                  <XStack
                    render="button"
                    {...{ type: 'button' }}
                    disabled={slackBusy}
                    onClick={() => void connectSlack()}
                    height={28}
                    px={10}
                    rounded={999}
                    items="center"
                    gap={5}
                    bg={INK}
                    borderWidth={1}
                    borderColor={INK}
                    cursor="pointer"
                  >
                    <ExternalLink size={11} color="var(--background)" aria-hidden />
                    <Text fontSize={11} lineHeight={15} fontWeight="500" color="var(--background)">
                      {t('Add to Slack')}
                    </Text>
                  </XStack>
                )}
              </Row>

              {slackConn.connected && slackChans.length > 0 ? (
                <YStack px={13} py={9} gap={6}>
                  <Text fontSize={11} lineHeight={15} color={DIM}>
                    {t('Bind channels directly to {name}:', { name: displayName })}
                  </Text>
                  <XStack flexWrap="wrap" gap={5}>
                    {slackChans.slice(0, 8).map((ch) => {
                      const mine = slackBound[ch.id] === bot.name
                      return (
                        <XStack
                          key={ch.id}
                          render="button"
                          {...{ type: 'button' }}
                          disabled={slackBusy}
                          onClick={() => void toggleSlackChannel(ch.id)}
                          height={24}
                          px={8}
                          rounded={999}
                          items="center"
                          bg={mine ? INK : GROUND}
                          borderWidth={1}
                          borderColor={mine ? INK : LINE}
                          cursor="pointer"
                        >
                          <Text fontSize={11} lineHeight={15} color={mine ? 'var(--background)' : INK}>
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
              <Text fontSize={11} lineHeight={16} color={DIM} px={4}>
                {slackNote}
              </Text>
            ) : null}
          </YStack>

          {/* Dedicated Desktop Sandbox Computer (always visible for every bot!) */}
          <YStack gap={8} data-parity-key="bots.panel.computer">
            <Text {...LABEL} px={4}>
              {t('Desktop Computer')}
            </Text>
            <XStack
              {...CARD}
              render="button"
              {...{ type: 'button' }}
              onClick={() => setComputerOpen(true)}
              aria-label={t('Open {name}’s desktop computer', { name: displayName })}
              minH={60}
              px={13}
              py={10}
              items="center"
              gap={12}
              cursor="pointer"
              hoverStyle={{ bg: PICKED }}
            >
              <YStack flex={1} minW={0} items="flex-start">
                <Text {...CLIP} fontSize={14} lineHeight={19} color={INK}>
                  {t("Bot's computer")}
                </Text>
                <Text {...CLIP} fontSize={12} lineHeight={17} color={DIM}>
                  {stateLabel(box, t)}
                </Text>
              </YStack>
              <ComputerScreen awake={box?.status === 'running'} />
            </XStack>
          </YStack>

          {cron || answers.length ? (
            <YStack gap={8} data-parity-key="bots.panel.upcoming">
              <Text {...LABEL} px={4}>
                {t('Upcoming')}
              </Text>
              {cron ? (
                <YStack {...CARD}>
                  <Row mark={<Clock size={16} color={DIM} aria-hidden />} title={routine} line={scheduleLine} last>
                    <Switch
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
                </YStack>
              ) : null}

              {answers.length ? (
                <YStack {...CARD} data-parity-key="bots.panel.networks">
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
              ) : null}
            </YStack>
          ) : null}

          <YStack gap={8} data-parity-key="bots.panel.connectors">
            <XStack items="center" justify="space-between" px={4}>
              <Text {...LABEL}>{t('Connectors')}</Text>
              <XStack
                render="button"
                {...{ type: 'button' }}
                onClick={() => setConnectorsOpen(true)}
                items="center"
                gap={3}
                px={6}
                py={2}
                rounded={6}
                bg="transparent"
                borderWidth={0}
                cursor="pointer"
                hoverStyle={{ bg: PICKED }}
              >
                <Plus size={12} color={DIM} aria-hidden />
                <Text fontSize={12} lineHeight={16} color={DIM}>
                  {t('Add')}
                </Text>
              </XStack>
            </XStack>
            <XStack
              {...CARD}
              render="button"
              {...{ type: 'button' }}
              onClick={() => setConnectorsOpen(true)}
              minH={50}
              px={13}
              py={9}
              items="center"
              justify="space-between"
              gap={10}
              cursor="pointer"
              hoverStyle={{ bg: PICKED }}
            >
              <YStack flex={1} minW={0} items="flex-start">
                <Text {...CLIP} fontSize={14} lineHeight={19} color={INK}>
                  {answers.length ? t('{n} channels connected', { n: answers.length }) : t('Connect Slack, GitHub, Linear, Stripe…')}
                </Text>
                <Text {...CLIP} fontSize={12} lineHeight={17} color={DIM}>
                  {t('External apps, socials & MCP tools')}
                </Text>
              </YStack>
              <ChevronRight size={15} color={DIM} aria-hidden />
            </XStack>
          </YStack>

          <YStack gap={8} data-parity-key="bots.panel.voice">
            <Text {...LABEL} px={4}>
              {t('Voice chat')}
            </Text>
            <YStack {...CARD}>
              <VoiceRow label={t('Voice')} value={voiceName} options={VOICES} onSelect={setVoiceName} />
              <VoiceRow label={t('Speed')} value={voiceSpeed} options={SPEEDS} onSelect={setVoiceSpeed} />
              <VoiceRow label={t('Language')} value={voiceLang} options={LANGUAGES} onSelect={setVoiceLang} last />
            </YStack>
          </YStack>

          {wrong ? (
            <Text render="p" role="alert" px={8} m={0} fontSize={13} lineHeight={18} color={DIM}>
              {wrong}
            </Text>
          ) : null}

          {!isPrimary ? (
            <XStack px={8} pt={4}>
              <Text
                render="button"
                {...{ type: 'button' }}
                onClick={() => setDeleting(true)}
                bg="transparent"
                borderWidth={0}
                p={0}
                cursor="pointer"
                fontSize={13}
                lineHeight={18}
                color={DIM}
                hoverStyle={{ color: INK }}
              >
                {t('Delete {name}', { name: displayName })}
              </Text>
            </XStack>
          ) : null}
        </YStack>
      ) : (
        <YStack px={15} pb={24} gap={12} data-parity-key="bots.panel.library">
          {libraryItems.length ? (
            <YStack {...CARD}>
              {libraryItems.map((item, i) => (
                <Row
                  key={item.key}
                  mark={item.kind === 'doc' ? <FileText size={16} color={DIM} aria-hidden /> : <ImageIcon size={16} color={DIM} aria-hidden />}
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

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent maxW={440} rounded={20} gap={14}>
          <DialogTitle>{t('Delete {name}?', { name: displayName })}</DialogTitle>
          <Text fontSize={15} lineHeight={22} color={DIM}>
            {t('{name} and every message it was sent are deleted for good.', { name: displayName })}
          </Text>
          <XStack gap={8} justify="flex-end">
            <Button size="sm" variant="outline" rounded={999} onPress={() => setDeleting(false)}>
              {t('Cancel')}
            </Button>
            <XStack
              {...PILL}
              height={34}
              bg={INK}
              borderColor={INK}
              hoverStyle={{ bg: INK, opacity: 0.9 }}
              onClick={() => {
                if (!deleting) return
                setDeleting(false)
                onDelete().catch((e) => setWrong(say(e, displayName, 'save', t)))
              }}
            >
              <Text {...WORD} color="var(--background)">
                {t('Delete')}
              </Text>
            </XStack>
          </XStack>
        </DialogContent>
      </Dialog>

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
    </YStack>
  )
}
