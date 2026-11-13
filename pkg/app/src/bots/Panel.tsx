'use client'

// The open bot's right inspector panel: avatar, name, [Activity | Library]
// segmented control, Upcoming routines & connected networks, Bot's computer
// status monitor, and Voice chat preferences.

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
import { ChevronDown, ChevronRight, Clock, FileText, Image as ImageIcon, Plus, X } from 'lucide-react'
import { useKept } from '../kept'
import { useAi } from '../lib/ai'
import { say } from '../failure'
import { Network, of } from '../network'
import { called } from '../team'
import { ConnectorsDialog } from './ConnectorsDialog'
import { Face } from './face'
import { ALWAYS, answering, disk, grant } from './api'
import { CARD, CLIP, LABEL, PILL, ROUND, WORD } from './kit'
import { DIM, INK, LINE, PICKED, RAISED } from './ink'
import { partsOf } from './said'
import { cron as words } from './time'

const VOICES = ['Liora', 'Aria', 'Sol', 'Koe', 'Nova', 'Echo'] as const
const SPEEDS = ['0.9x', '1x', '1.25x', '1.5x', '2x'] as const
const LANGUAGES = ['Auto-detect', 'English', 'Spanish', 'French', 'German', 'Japanese', 'Chinese'] as const

/** One row of a card: a mark, two lines, and whatever acts on it. */
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

/** A computer's state as a person reads it. No lease is a computer asleep. */
function state(box: Sandbox | null, t: (s: string) => string): string {
  if (!box) return t('Asleep')
  if (box.status === 'running') return t('Awake')
  if (box.status === 'pending') return t('Waking')
  return box.error || t('Stopped')
}

const best = (boxes: readonly Sandbox[]): Sandbox | null =>
  boxes.find((b) => b.status === 'running') ?? boxes.find((b) => b.status === 'pending') ?? boxes[0] ?? null

const POLL = 5000

export function Panel({
  bot,
  runs = [],
  onClose,
  kept,
  onSchedule,
  onDelete,
  focus = false,
}: {
  bot: Agent
  runs?: readonly AgentRun[]
  kept: string
  onClose: () => void
  onSchedule: (on: boolean, cron: string) => Promise<void>
  onDelete: () => Promise<void>
  focus?: boolean
}) {
  const { t, locale } = useI18n()
  const { client } = useAi()
  const [tab, setTab] = useState<'activity' | 'library'>('activity')
  const [instructions, setInstructions] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [box, setBox] = useState<Sandbox | null>(null)
  const [boxed, setBoxed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [connectorsOpen, setConnectorsOpen] = useState(false)

  const [voiceName, setVoiceName] = useKept<string>('hanzo.bots.voice.name', 'Liora')
  const [voiceSpeed, setVoiceSpeed] = useKept<string>('hanzo.bots.voice.speed', '1x')
  const [voiceLang, setVoiceLang] = useKept<string>('hanzo.bots.voice.lang', 'Auto-detect')

  const displayName = called(bot.name)
  const cron = bot.schedule || kept
  const activeSchedule = bot.executionMode === ALWAYS && Boolean(bot.schedule)

  const survey = useCallback(
    async (signal?: AbortSignal) => {
      if (!client) return
      const opts = signal ? { signal } : undefined
      const [detail, nets, boxes] = await Promise.allSettled([
        client.agents.get(bot.name, opts),
        client.transports.list(opts),
        client.sandboxes.list({ project: disk(bot.name) }, opts),
      ])
      if (signal?.aborted) return
      if (detail.status === 'fulfilled') setInstructions(detail.value.instructions ?? '')
      if (boxes.status === 'fulfilled') {
        setBox(best(boxes.value))
        setBoxed(true)
      }
      if (nets.status === 'fulfilled') {
        const connected = nets.value.filter((n) => n.connected)
        const bound = await Promise.allSettled(connected.map((n) => answering(client, n.id, signal)))
        if (signal?.aborted) return
        setAnswers(
          connected
            .filter((_, i) => {
              const r = bound[i]
              return r.status === 'fulfilled' && r.value.default === bot.name
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

  const computer = async () => {
    if (!client || busy) return
    setBusy(true)
    setWrong(null)
    const win = box?.status === 'running' ? window.open('', '_blank') : null
    try {
      if (box?.status === 'running') {
        const g = await grant(client, box.id, box.class === 'desktop' ? 'screen' : 'terminal')
        if (!win) return setWrong(t('The browser kept the new tab from opening.'))
        if (!g.url?.startsWith('https://')) {
          win.close()
          return setWrong(t('The platform opened no window onto it.'))
        }
        win.opener = null
        win.location.href = g.url
      } else if (!box || box.status === 'error') {
        await client.sandboxes.lease({ class: 'desktop', project: disk(bot.name) })
        await survey()
      }
    } catch (e) {
      win?.close()
      setWrong(say(e, t('{name}’s computer', { name: displayName }), 'save', t))
    } finally {
      setBusy(false)
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

      <YStack items="center" gap={12} pt={2} pb={18} px={14}>
        <Face bot={bot} size={68} />
        <Text {...CLIP} maxW="100%" fontSize={18} lineHeight={23} fontWeight="600" color={INK}>
          {displayName}
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
        <YStack px={15} pb={24} gap={20}>
          {cron || answers.length ? (
            <YStack gap={10} data-parity-key="bots.panel.upcoming">
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

          <YStack gap={10} data-parity-key="bots.panel.connectors">
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
                  {answers.length ? t('{n} channels connected', { n: answers.length }) : t('Connect Slack, WhatsApp, Stripe…')}
                </Text>
                <Text {...CLIP} fontSize={12} lineHeight={17} color={DIM}>
                  {t('External apps, socials & MCP tools')}
                </Text>
              </YStack>
              <ChevronRight size={15} color={DIM} aria-hidden />
            </XStack>
          </YStack>

          {boxed ? (
            <YStack gap={10} data-parity-key="bots.panel.computer">
              <Text {...LABEL} px={4}>
                {t('Computer')}
              </Text>
              <XStack
                {...CARD}
                render="button"
                {...{ type: 'button' }}
                onClick={computer}
                disabled={busy || box?.status === 'pending'}
                aria-label={t(box?.status === 'running' ? 'Open {name}’s computer' : 'Wake {name}’s computer', { name: displayName })}
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
                  <Text {...CLIP} fontSize={13} lineHeight={18} color={DIM}>
                    {busy ? t('Waking') : state(box, t)}
                  </Text>
                </YStack>
                <ComputerScreen awake={box?.status === 'running'} />
              </XStack>
            </YStack>
          ) : null}

          <YStack gap={10} data-parity-key="bots.panel.voice">
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
      <ConnectorsDialog
        open={connectorsOpen}
        onOpenChange={setConnectorsOpen}
        defaultFilter="channels"
        onConnected={() => void survey()}
      />
    </YStack>
  )
}
