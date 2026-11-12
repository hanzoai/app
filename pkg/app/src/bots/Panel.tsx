'use client'

// What the open bot has: its face and name, then each thing the platform holds
// for it — its schedule, the networks it answers on, its computer. A section
// with nothing behind it is not drawn, so a new bot's panel is its face alone.

import { useCallback, useEffect, useState } from 'react'
import type { Agent, Sandbox } from '@hanzo/ai'
import { useI18n } from '@hanzo/i18n/react'
import { Text, XStack, YStack } from '@hanzo/gui'
import { Switch } from '@hanzo/ui'
import { Clock, X } from 'lucide-react'
import { useAi } from '../lib/ai'
import { say } from '../failure'
import { Network, of } from '../network'
import { Face } from './face'
import { ALWAYS, answering, disk, grant } from './api'
import { CARD, CLIP, LABEL, ROUND } from './kit'
import { DIM, INK, LINE } from './ink'
import { cron } from './time'

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

export function Panel({
  bot,
  onClose,
  onSchedule,
}: {
  bot: Agent
  onClose: () => void
  onSchedule: (on: boolean) => Promise<void>
}) {
  const { t, locale } = useI18n()
  const { client } = useAi()
  const [instructions, setInstructions] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [box, setBox] = useState<Sandbox | null>(null)
  const [boxed, setBoxed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)

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
        setBox(boxes.value[0] ?? null)
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

  /** Asleep, a press wakes it; awake, a press opens its screen. */
  const computer = async () => {
    if (!client || busy) return
    setBusy(true)
    setWrong(null)
    try {
      if (box?.status === 'running') {
        const g = await grant(client, box.id, box.class === 'desktop' ? 'screen' : 'terminal')
        if (g.url) window.open(g.url, '_blank', 'noopener')
      } else if (!box || box.status === 'error') {
        await client.sandboxes.lease({ class: 'desktop', project: disk(bot.name) })
        await survey()
      }
    } catch (e) {
      setWrong(say(e, t('{name}’s computer', { name: bot.name }), 'save', t))
    } finally {
      setBusy(false)
    }
  }

  const routine = bot.schedule ? instructions.split('\n')[0].trim() || bot.description || bot.name : ''

  return (
    <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden" aria-label={bot.name} render="aside">
      <XStack height={58} shrink={0} px={13} items="center" justify="flex-end">
        <XStack {...ROUND} aria-label={t('Close')} onClick={onClose}>
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
        {bot.schedule ? (
          <YStack gap={10} data-parity-key="bots.panel.upcoming">
            <Text {...LABEL} px={12}>
              {t('Upcoming')}
            </Text>
            <YStack {...CARD}>
              <Row mark={<Clock size={16} color={DIM} aria-hidden />} title={routine} line={cron(bot.schedule, locale, t)} last>
                <Switch
                  aria-label={t('Run {name} on its schedule', { name: bot.name })}
                  checked={bot.executionMode === ALWAYS}
                  onCheckedChange={(on: boolean) => {
                    setWrong(null)
                    onSchedule(on).catch((e) => setWrong(say(e, bot.name, 'save', t)))
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
      </YStack>
    </YStack>
  )
}
