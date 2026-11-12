'use client'

// What the open bot has: its face and name, then each thing the platform holds
// for it — its schedule, the networks it answers on, its computer. A section
// with nothing behind it is not drawn, so a new bot's panel is its face alone.

import { useCallback, useEffect, useState } from 'react'
import type { Agent, Sandbox } from '@hanzo/ai'
import { useI18n } from '@hanzo/i18n/react'
import { Text, XStack, YStack } from '@hanzo/gui'
import { Button, Dialog, DialogContent, DialogTitle, Switch } from '@hanzo/ui'
import { Clock, X } from 'lucide-react'
import { useAi } from '../lib/ai'
import { say } from '../failure'
import { Network, of } from '../network'
import { Face } from './face'
import { ALWAYS, answering, disk, grant } from './api'
import { CARD, CLIP, LABEL, PILL, ROUND, WORD } from './kit'
import { DIM, INK, LINE } from './ink'
import { cron as words } from './time'

/** One row of a card: a mark, two lines, and whatever acts on it. */
function Row({ mark, title, line, children, last }: { mark: React.ReactNode; title: string; line?: string; children?: React.ReactNode; last?: boolean }) {
  return (
    <XStack minH={48} px={12} py={8} gap={10} items="center" borderBottomWidth={last ? 0 : 1} borderColor={LINE}>
      {mark}
      <YStack flex={1} minW={0}>
        <Text {...CLIP} fontSize={13} lineHeight={18} color={INK}>
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

/** A computer's state as a person reads it. No lease is a computer asleep. */
function state(box: Sandbox | null, t: (s: string) => string): string {
  if (!box) return t('Asleep')
  if (box.status === 'running') return t('Awake')
  if (box.status === 'pending') return t('Waking')
  return box.error || t('Stopped')
}

/** The computer to draw: a running one first, then one waking, then any. */
const best = (boxes: readonly Sandbox[]): Sandbox | null =>
  boxes.find((b) => b.status === 'running') ?? boxes.find((b) => b.status === 'pending') ?? boxes[0] ?? null

/** How often a waking computer is asked whether it is awake. */
const POLL = 5000

export function Panel({
  bot,
  onClose,
  kept,
  onSchedule,
  onDelete,
  focus = false,
}: {
  bot: Agent
  /** The schedule this page last saw for the bot, kept by the app across panels. */
  kept: string
  onClose: () => void
  onSchedule: (on: boolean, cron: string) => Promise<void>
  onDelete: () => Promise<void>
  /** Over the thread: the close control takes the focus, so Escape and Tab start here. */
  focus?: boolean
}) {
  const { t, locale } = useI18n()
  const { client } = useAi()
  const [instructions, setInstructions] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [box, setBox] = useState<Sandbox | null>(null)
  const [boxed, setBoxed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  // The schedule on the record, else the one this page last saw for the bot (the
  // platform keeps none for a bot that runs only when asked).
  const cron = bot.schedule || kept

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
        setAnswers(connected.filter((_, i) => {
          const r = bound[i]
          return r.status === 'fulfilled' && r.value.default === bot.name
        }).map((n) => n.id))
      }
    },
    [client, bot.name],
  )

  useEffect(() => {
    const stop = new AbortController()
    void survey(stop.signal)
    return () => stop.abort()
  }, [survey])

  // A waking computer is asked again until it is awake or says why it is not.
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

  /**
   * Asleep, a press wakes it; awake, a press opens its screen in a new tab. The
   * tab is opened inside the press, before the grant answers, because a browser
   * allows a new window only from the press itself.
   */
  const computer = async () => {
    if (!client || busy) return
    setBusy(true)
    setWrong(null)
    const tab = box?.status === 'running' ? window.open('', '_blank') : null
    try {
      if (box?.status === 'running') {
        const g = await grant(client, box.id, box.class === 'desktop' ? 'screen' : 'terminal')
        if (!tab) return setWrong(t('The browser kept the new tab from opening.'))
        if (!g.url?.startsWith('https://')) {
          tab.close()
          return setWrong(t('The platform opened no window onto it.'))
        }
        tab.opener = null
        tab.location.href = g.url
      } else if (!box || box.status === 'error') {
        await client.sandboxes.lease({ class: 'desktop', project: disk(bot.name) })
        await survey()
      }
    } catch (e) {
      tab?.close()
      setWrong(say(e, t('{name}’s computer', { name: bot.name }), 'save', t))
    } finally {
      setBusy(false)
    }
  }

  const routine = cron ? instructions.split('\n')[0].trim() || bot.description || bot.name : ''

  return (
    <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden" aria-label={bot.name} render="aside">
      <XStack height={58} shrink={0} px={13} items="center" justify="flex-end">
        <XStack {...ROUND} aria-label={t('Close')} onClick={onClose} {...{ autoFocus: focus }}>
          <X size={16} color={INK} aria-hidden />
        </XStack>
      </XStack>

      <YStack items="center" gap={20} pt={8} pb={24} px={15}>
        <Face bot={bot} size={64} />
        <Text {...CLIP} maxW="100%" fontSize={17} lineHeight={22} fontWeight="500" color={INK}>
          {bot.name}
        </Text>
      </YStack>

      <YStack px={15} pb={24} gap={20}>
        {cron ? (
          <YStack gap={10} data-parity-key="bots.panel.upcoming">
            <Text {...LABEL} px={12}>
              {t('Upcoming')}
            </Text>
            <YStack {...CARD}>
              <Row mark={<Clock size={16} color={DIM} aria-hidden />} title={routine} line={words(cron, locale, t)} last>
                <Switch
                  aria-label={t('Run {name} on its schedule', { name: bot.name })}
                  checked={bot.executionMode === ALWAYS && Boolean(bot.schedule)}
                  disabled={saving}
                  onCheckedChange={(on: boolean) => {
                    setWrong(null)
                    setSaving(true)
                    onSchedule(on, cron)
                      .catch((e) => setWrong(say(e, t('{name}’s schedule', { name: bot.name }), 'save', t)))
                      .finally(() => setSaving(false))
                  }}
                />
              </Row>
            </YStack>
          </YStack>
        ) : null}

        {answers.length ? (
          <YStack {...CARD} data-parity-key="bots.panel.networks">
            {answers.map((id, i) => (
              <Row key={id} mark={<Network transport={id} size={18} />} title={of(id).name} line={t('Connected')} last={i === answers.length - 1} />
            ))}
          </YStack>
        ) : null}

        {boxed ? (
          <YStack gap={10} data-parity-key="bots.panel.computer">
            <Text {...LABEL} px={12}>
              {t('Computer')}
            </Text>
            <XStack
              {...CARD}
              render="button"
              {...{ type: 'button' }}
              onClick={computer}
              disabled={busy || box?.status === 'pending'}
              aria-label={t(box?.status === 'running' ? 'Open {name}’s computer' : 'Wake {name}’s computer', { name: bot.name })}
              minH={60}
              px={12}
              items="center"
              gap={10}
              cursor="pointer"
              hoverStyle={{ bg: 'var(--secondary)' }}
            >
              <YStack flex={1} minW={0} items="flex-start">
                <Text {...CLIP} fontSize={13} lineHeight={18} color={INK}>
                  {t('{name}’s computer', { name: bot.name })}
                </Text>
                <Text {...CLIP} fontSize={13} lineHeight={18} color={DIM}>
                  {busy ? t('Waking') : state(box, t)}
                </Text>
              </YStack>
            </XStack>
          </YStack>
        ) : null}

        {wrong ? (
          <Text render="p" role="alert" px={12} m={0} fontSize={13} lineHeight={18} color={DIM}>
            {wrong}
          </Text>
        ) : null}

        <XStack px={12} pt={8}>
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
            {t('Delete {name}', { name: bot.name })}
          </Text>
        </XStack>
      </YStack>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent maxW={440} rounded={20} gap={14}>
          <DialogTitle>{t('Delete {name}?', { name: bot.name })}</DialogTitle>
          <Text fontSize={15} lineHeight={22} color={DIM}>
            {t('{name} and every message it was sent are deleted for good.', { name: bot.name })}
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
                onDelete().catch((e) => setWrong(say(e, bot.name, 'save', t)))
              }}
            >
              <Text {...WORD} color="var(--background)">
                {t('Delete')}
              </Text>
            </XStack>
          </XStack>
        </DialogContent>
      </Dialog>
    </YStack>
  )
}
