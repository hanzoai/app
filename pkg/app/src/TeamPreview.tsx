'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AtSign,
  CalendarCheck,
  Check,
  ChevronDown,
  Eye,
  FileSpreadsheet,
  FileText,
  Flame,
  GitMerge,
  GitPullRequest,
  Hash,
  Headphones,
  Heart,
  Image as Picture,
  Laugh,
  Mail,
  Menu,
  Mic,
  PartyPopper,
  Plus,
  Presentation,
  Rocket,
  Search,
  SendHorizontal,
  Smile,
  SquarePen,
  ThumbsUp,
  X,
  CornerDownRight,
  ShieldCheck,
  Target,
  Wallet,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useI18n } from '@hanzo/i18n/react'
import { Avatar as Monogram, Text, View, XStack, YStack } from '@hanzo/ui'
import { Face } from './cast'
import { md, useHost, usePlay, useStage, useStill, type PreviewProps } from './preview'
import { DAY, HOME, LIMITS, MISSIONS, ORGS, SCENE, STILL, agent, channelOf, frame, orgOf, pace, waiting, who, type Ask, type Card, type Handoff, type Mark, type Message } from './workday'

/**
 * Hanzo Team, playing: a working day in the workspace, laid out the way a team
 * chat is read. hanzo.team's landing and hanzo.ai's /team open on it, and
 * hanzo.ai's hero plays it in its cycle; one component for every host.
 *
 * Far left, the organizations a person belongs to (one active, "+" under them,
 * the reader at the foot); then the workspace's column: its name, Channels
 * (bold and counted when unread), Direct messages with who is here, and the
 * org's Agents; then the channel: its name and topic, who is in it, the huddle,
 * the messages with their cards, reactions and threads, who is typing, and the
 * composer. A thread opens beside the channel when there is room, over it when
 * not.
 *
 * The day is `./workday`: more than five minutes of people and agents working
 * together before it plays again. It plays while on screen and the pointer is
 * elsewhere. Pressing an org or a channel plays that room's own scene, an
 * agent's question or a draft answers a press, and from then on the reader
 * drives: nothing loops over them. A reader who asked for less motion, the
 * server and the first paint get one whole frame: #eng with the pull request
 * merged.
 *
 * People wear their initials (`Face`, as the app draws a person with no
 * picture); agents wear the crew's memoji, `/memoji/<id>.svg`, from this
 * package's assets. The chrome is monochrome; the faces carry the colour.
 */

/** A reaction's mark: monochrome, as the rest of the chrome. */
const MARKS: Record<Mark, LucideIcon> = { thumbs: ThumbsUp, heart: Heart, flame: Flame, rocket: Rocket, eyes: Eye, laugh: Laugh, party: PartyPopper, check: Check }

/** A file's mark, by what it is. */
const FILES: Record<Extract<Card, { kind: 'file' }>['type'], LucideIcon> = { doc: FileText, deck: Presentation, sheet: FileSpreadsheet, image: Picture }

/** A button drawn as one of the workspace's rows: the press, the hover, the focus ring. */
const ROW = {
  borderWidth: 0,
  cursor: 'pointer',
  hoverStyle: { bg: '$hover' },
  focusVisibleStyle: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)', outlineOffset: -2 },
} as const

/** The fade a list takes where it runs out of room. */
const TOP = { maskImage: 'linear-gradient(to bottom, transparent, black 48px)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 48px)' } as const
const FOOT = { maskImage: 'linear-gradient(to bottom, black 82%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black 82%, transparent)' } as const

/** The reader, at the rail's foot. */
const ME = 'ada'

/** How wide the preview must be to draw the workspace's column (below: the phone app). */
const DESK = 560
/** The workspace's column: narrower while the preview is. */
const breadth = (width: number) => (width && width < 700 ? 176 : width && width < 820 ? 200 : 232)
/** How tall a phone's preview must be to list the channels under the orgs (a short one, a landing's card, leaves them to the drawer). */
const LIST = 560
/** How wide the preview must be for the channel's header to show who is in it. */
const FACES = 900

/** "1 reply", "3 replies". */
const replies = (t: ReturnType<typeof useI18n>['t'], n: number) => (n === 1 ? t('1 reply') : t('{count} replies', { count: n }))
/** How wide it must be for a thread to stand beside the channel rather than over it. */
const ROOM = 1000

/** A person's initials or an agent's memoji. */
function Avatar({ id, size }: { id: string; size: number }) {
  if (!agent(id)) return <Face name={who(id).name} size={size} person />
  return (
    <View
      render={<img src={`/memoji/${id}.svg`} alt="" width={size} height={size} loading="lazy" decoding="async" />}
      width={size}
      height={size}
      shrink={0}
      rounded={9999}
      display="block"
      $platform-web={{ borderRadius: '9999px' }}
    />
  )
}

/** A dot that says someone is here now; hollow when away, pulsing while they work. */
function Here({ away, busy }: { away?: boolean; busy?: boolean }) {
  return (
    <View
      data-motion={busy ? 'pulse' : undefined}
      width={8}
      height={8}
      shrink={0}
      rounded={9999}
      borderWidth={away ? 1.5 : 0}
      borderColor="$soft"
      bg={away ? 'transparent' : 'var(--state-online)'}
      $platform-web={{ borderRadius: '9999px' }}
    />
  )
}

/** A line of a message with its mentions set apart: `@dev` reads as the agent's name. */
function Said({ text }: { text: string }) {
  return (
    <>
      {text.split(/(@[a-z]+)/).map((part, i) =>
        /^@[a-z]+$/.test(part) ? (
          <Text key={i} render="span" fontWeight="600" color="$ink" bg="$raised" px={3} rounded={4} $platform-web={{ borderRadius: '4px' }}>
            {`@${who(part.slice(1)).name}`}
          </Text>
        ) : (
          part
        ),
      )}
    </>
  )
}

/** The frame every card in a message stands in. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <YStack data-motion="rise" self="flex-start" width="100%" maxW={420} mt={4} gap={8} p={12} rounded={12} borderWidth={1} borderColor="$edge" bg="$panel" $platform-web={{ borderRadius: '12px' }}>
      {children}
    </YStack>
  )
}

/** A small round state: a check once done, an empty ring before. */
function Tick({ done }: { done: boolean }) {
  return (
    <XStack
      width={16}
      height={16}
      shrink={0}
      rounded={9999}
      items="center"
      justify="center"
      borderWidth={1}
      borderColor={done ? '$ink' : '$edge'}
      bg={done ? '$ink' : 'transparent'}
      $platform-web={{ borderRadius: '9999px', transition: 'background-color 260ms ease, border-color 260ms ease' }}
    >
      {done ? <Check size={10} strokeWidth={3} color="var(--background)" aria-hidden /> : null}
    </XStack>
  )
}

/** A pill-shaped control a card offers; inked once it is the answer. */
function Choice({ on, faded, label, onPress }: { on: boolean; faded: boolean; label: string; onPress: () => void }) {
  return (
    <XStack
      render={<button type="button" aria-pressed={on} onClick={onPress} />}
      items="center"
      gap={6}
      px={12}
      py={5}
      rounded={9999}
      borderWidth={1}
      borderColor={on ? '$ink' : '$edge'}
      bg={on ? '$ink' : 'transparent'}
      opacity={faded ? 0.5 : 1}
      cursor="pointer"
      hoverStyle={{ borderColor: '$ink' }}
      focusVisibleStyle={ROW.focusVisibleStyle}
      $platform-web={{ borderRadius: '9999px', transition: 'background-color 240ms ease, border-color 240ms ease, opacity 240ms ease' }}
    >
      {on ? <Check size={12} color="var(--background)" strokeWidth={2.6} aria-hidden /> : null}
      <Text fontSize="$1" fontWeight="500" color={on ? '$background' : '$ink'}>
        {label}
      </Text>
    </XStack>
  )
}

/** What a message carries: a pull request, a draft, a file, a meeting, a list, a question, design options. */
function Attachment({ card, onPick }: { card: Card; onPick: (patch: Partial<Card>) => void }) {
  const { t } = useI18n()
  switch (card.kind) {
    case 'pr': {
      const merged = card.state === 'merged'
      const Mark = merged ? GitMerge : GitPullRequest
      const state = merged ? t('Merged') : card.state === 'passed' ? t('Checks passed') : t('Review requested')
      return (
        <Frame>
          <XStack items="center" gap={8}>
            <Mark size={15} color="var(--foreground)" aria-hidden />
            <Text fontFamily="$mono" fontSize="$1" color="$soft" data-i18n-ltr>
              {`${card.repo} #${card.number}`}
            </Text>
          </XStack>
          <Text fontSize="$2" lineHeight="$3" fontWeight="600" color="$ink">
            {t(card.title)}
          </Text>
          <XStack items="center" gap={10} flexWrap="wrap">
            <Text fontFamily="$mono" fontSize="$1" color="$soft" data-i18n-ltr>
              {`+${card.add} −${card.del}`}
            </Text>
            <XStack
              key={card.state}
              data-motion="rise"
              items="center"
              gap={5}
              px={8}
              py={2}
              rounded={9999}
              borderWidth={1}
              borderColor={card.state === 'review' ? '$edge' : '$ink'}
              bg={merged ? '$ink' : 'transparent'}
              $platform-web={{ borderRadius: '9999px' }}
            >
              {card.state === 'review' ? null : <Check size={11} strokeWidth={3} color={merged ? 'var(--background)' : 'var(--foreground)'} aria-hidden />}
              <Text fontSize={11} lineHeight={16} fontWeight="600" color={merged ? '$background' : '$ink'}>
                {state}
              </Text>
            </XStack>
          </XStack>
        </Frame>
      )
    }
    case 'draft':
      return (
        <Frame>
          <XStack items="center" gap={8}>
            <Mail size={14} color="var(--foreground)" aria-hidden />
            <Text flex={1} minW={0} fontSize="$1" color="$soft" numberOfLines={1}>
              {t('To: {to}', { to: t(card.to) })}
            </Text>
            <Text fontSize={11} fontWeight="600" color={card.sent ? '$ink' : '$soft'}>
              {card.sent ? t('Sent') : t('Draft')}
            </Text>
          </XStack>
          <Text key={card.body} data-motion="rise" fontSize="$2" lineHeight="$3" color="$ink">
            {t(card.body)}
          </Text>
          {card.sent ? null : (
            <XStack gap={8}>
              <Choice on={false} faded={false} label={t('Send')} onPress={() => onPick({ sent: true })} />
            </XStack>
          )}
        </Frame>
      )
    case 'file': {
      const Mark = FILES[card.type]
      return (
        <Frame>
          <XStack items="center" gap={10}>
            <XStack width={36} height={36} shrink={0} rounded={8} items="center" justify="center" bg="$raised" $platform-web={{ borderRadius: '8px' }}>
              <Mark size={17} color="var(--foreground)" aria-hidden />
            </XStack>
            <YStack flex={1} minW={0}>
              <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1} data-i18n-ltr>
                {card.name}
              </Text>
              {card.detail ? (
                <Text fontSize="$1" color="$soft" numberOfLines={1}>
                  {t(card.detail)}
                </Text>
              ) : null}
            </YStack>
          </XStack>
        </Frame>
      )
    }
    case 'meeting':
      return (
        <Frame>
          <XStack items="center" gap={10}>
            <XStack width={36} height={36} shrink={0} rounded={8} items="center" justify="center" bg="$ink" $platform-web={{ borderRadius: '8px' }}>
              <CalendarCheck size={17} color="var(--background)" aria-hidden />
            </XStack>
            <YStack flex={1} minW={0}>
              <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1}>
                {t(card.title)}
              </Text>
              <Text fontSize="$1" lineHeight={16} color="$soft">
                {t('{when} · on everyone’s calendar', { when: t(card.when) })}
              </Text>
            </YStack>
          </XStack>
        </Frame>
      )
    case 'list':
      return (
        <Frame>
          <Text fontSize="$1" fontWeight="700" color="$ink">
            {t(card.title)}
          </Text>
          <YStack gap={6}>
            {card.items.map((item, i) => (
              <XStack key={item} items="center" gap={8}>
                {card.done ? <Tick done={card.done.includes(i)} /> : <View width={5} height={5} shrink={0} rounded={9999} bg="$soft" mx={5} $platform-web={{ borderRadius: '9999px' }} />}
                <Text flex={1} minW={0} fontSize="$2" lineHeight="$2" color="$ink">
                  {t(item)}
                </Text>
              </XStack>
            ))}
          </YStack>
        </Frame>
      )
    case 'ask':
      return (
        <Frame>
          <XStack gap={8} flexWrap="wrap">
            {card.options.map((o, i) => (
              <Choice key={o} on={card.picked === i} faded={card.picked !== undefined && card.picked !== i} label={t(o)} onPress={() => onPick({ picked: i })} />
            ))}
          </XStack>
        </Frame>
      )
    case 'options':
      return (
        <Frame>
          <Text fontFamily="$mono" fontSize="$1" color="$soft" data-i18n-ltr>
            {card.file}
          </Text>
          <XStack gap={8}>
            {card.options.map((o, i) => {
              const on = card.picked === i
              return (
                <YStack
                  key={o}
                  render={<button type="button" aria-pressed={on} aria-label={t('Option {name}', { name: o })} onClick={() => onPick({ picked: i })} />}
                  flex={1}
                  gap={5}
                  p={8}
                  rounded={8}
                  borderWidth={on ? 2 : 1}
                  borderColor={on ? '$ink' : '$edge'}
                  bg="$background"
                  opacity={card.picked !== undefined && !on ? 0.55 : 1}
                  cursor="pointer"
                  focusVisibleStyle={ROW.focusVisibleStyle}
                  $platform-web={{ borderRadius: '8px', transition: 'opacity 240ms ease, border-color 240ms ease' }}
                >
                  <XStack items="center" justify="space-between">
                    <Text fontSize="$1" fontWeight="700" color="$ink" data-i18n-ltr>
                      {o}
                    </Text>
                    {on ? <Check size={12} strokeWidth={3} color="var(--foreground)" aria-hidden /> : null}
                  </XStack>
                  <XStack gap={4}>
                    {[0, 1, 2].map((c) => (
                      <YStack key={c} flex={1} gap={3} p={4} rounded={4} borderWidth={1} borderColor="$edge" $platform-web={{ borderRadius: '4px' }}>
                        <View height={4} width="70%" rounded={2} bg="$raised" />
                        {Array.from({ length: i ? 2 : 4 }, (_, k) => (
                          <View key={k} height={3} width="90%" rounded={2} bg="$hover" />
                        ))}
                      </YStack>
                    ))}
                  </XStack>
                </YStack>
              )
            })}
          </XStack>
        </Frame>
      )
  }
}

/** The reactions under a message; a count that changes lands again. */
function Reactions({ list }: { list: Message['reactions'] }) {
  return (
    <XStack gap={6} mt={4} flexWrap="wrap">
      {list.map((r) => {
        const Mark = MARKS[r.mark]
        return (
          <XStack key={`${r.mark}:${r.n}`} data-motion="rise" items="center" gap={4} px={8} py={2} rounded={9999} borderWidth={1} borderColor="$edge" bg="$hover" $platform-web={{ borderRadius: '9999px' }}>
            <Mark size={12} color="var(--foreground)" aria-hidden />
            <Text fontSize="$1" fontWeight="600" color="$ink" data-i18n-ltr>
              {r.n}
            </Text>
          </XStack>
        )
      })}
    </XStack>
  )
}

/** A message's name line: the name, an agent's tag, the time. */
function Byline({ id, time }: { id: string; time: string }) {
  const { t } = useI18n()
  return (
    <XStack items="center" gap={6} minW={0}>
      <Text fontSize="$2" fontWeight="700" color="$ink" numberOfLines={1}>
        {who(id).name}
      </Text>
      {agent(id) ? (
        <Text fontSize={10} lineHeight={15} fontWeight="600" px={5} rounded={4} bg="$raised" color="$soft" $platform-web={{ borderRadius: '4px' }}>
          {t('Agent')}
        </Text>
      ) : null}
      <Text fontSize={11} color="$faint" data-i18n-ltr>
        {time}
      </Text>
    </XStack>
  )
}

/** "9:41 AM", in the reader's language, for a minute of the sample day. */
function useClock() {
  const { locale } = useI18n()
  const time = useMemo(() => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }), [locale])
  return (minute: number) => time.format(new Date(2026, 9, 29, Math.floor(minute / 60), minute % 60))
}

/** One message: the face (or nothing, under the same author's last), the words, its card, reactions and thread. */
function Post({ m, grouped, onThread, onPick }: { m: Message; grouped: boolean; onThread?: () => void; onPick: (patch: Partial<Card>) => void }) {
  const { t } = useI18n()
  const clock = useClock()
  const last = m.replies[m.replies.length - 1]
  const faces = [...new Set(m.replies.map((r) => r.who))].slice(0, 3)
  return (
    <XStack data-motion="rise" gap={10} items="flex-start" pt={grouped ? 0 : 8}>
      <View width={34} shrink={0} items="center">
        {grouped ? null : <Avatar id={m.who} size={34} />}
      </View>
      <YStack flex={1} minW={0} gap={2}>
        {grouped ? null : <Byline id={m.who} time={clock(m.time)} />}
        <Text fontSize="$2" lineHeight="$3" color="$ink">
          <Said text={t(m.text)} />
        </Text>
        {m.card ? <Attachment card={m.card} onPick={onPick} /> : null}
        {m.reactions.length ? <Reactions list={m.reactions} /> : null}
        {m.replies.length ? (
          <XStack
            render={<button type="button" onClick={onThread} aria-label={t('Open the thread: {replies}', { replies: replies(t, m.replies.length) })} />}
            self="flex-start"
            items="center"
            gap={6}
            mt={4}
            px={4}
            py={3}
            rounded={8}
            bg="transparent"
            {...ROW}
            $platform-web={{ borderRadius: '8px' }}
          >
            <XStack>
              {faces.map((f, i) => (
                <View key={f} marginInlineStart={i ? -5 : 0} rounded={9999} borderWidth={1.5} borderColor="var(--background)" $platform-web={{ borderRadius: '9999px' }}>
                  <Avatar id={f} size={18} />
                </View>
              ))}
            </XStack>
            <Text fontSize="$1" fontWeight="700" color="$ink">
              {replies(t, m.replies.length)}
            </Text>
            <Text fontSize="$1" color="$faint" numberOfLines={1}>
              {last ? t('Last reply {time}', { time: clock(last.time) }) : null}
            </Text>
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  )
}

/** A count of what is unread, inked. */
function Count({ n }: { n: number }) {
  return (
    <Text key={n} data-motion="rise" fontSize={10} lineHeight={16} minW={18} px={5} rounded={9999} bg="$ink" color="$background" fontWeight="700" text="center" $platform-web={{ borderRadius: '9999px' }} data-i18n-ltr>
      {n}
    </Text>
  )
}

/**
 * An organization's tile: its initial in its own hue, as the app's org chooser
 * draws it (@hanzo/ui `Avatar`, seeded on the org's id). The active one wears a
 * ring in that hue; the others what is unread there.
 */
function Tile({ org, on, n, size, onPress }: { org: { id: string; name: string }; on: boolean; n: number; size: 'xl' | 'lg'; onPress: () => void }) {
  const { t } = useI18n()
  return (
    <XStack
      render={<button type="button" aria-pressed={on} aria-label={n ? t('Open {org}, {count} unread', { org: org.name, count: n }) : t('Open {org}', { org: org.name })} onClick={onPress} />}
      position="relative"
      shrink={0}
      p={2}
      rounded={10}
      borderWidth={2}
      borderColor={on ? '$ink' : 'transparent'}
      bg="transparent"
      cursor="pointer"
      opacity={on ? 1 : 0.8}
      hoverStyle={{ opacity: 1 }}
      focusVisibleStyle={ROW.focusVisibleStyle}
      $platform-web={{ borderRadius: '10px', transition: 'opacity 200ms ease, border-color 260ms ease' }}
    >
      <Monogram size={size} shape="rounded" name={org.name} colorSeed={org.id} variant={on ? 'outline' : 'soft'} />
      {n ? (
        <View position="absolute" t={-7} insetInlineEnd={-8}>
          <Count n={n} />
        </View>
      ) : null}
    </XStack>
  )
}

/** One of the panel's boxes: a title (and what stands at its end), then what it holds. */
function Box({ icon: Icon, title, aside, children }: { icon: LucideIcon; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <YStack gap={8} p={12} rounded={12} borderWidth={1} borderColor="$edge" bg="$panel" $platform-web={{ borderRadius: '12px' }}>
      <XStack items="center" gap={6}>
        <Icon size={13} color="var(--foreground)" aria-hidden />
        <Text flex={1} minW={0} fontSize="$1" fontWeight="700" color="$ink" numberOfLines={1}>
          {title}
        </Text>
        {aside}
      </XStack>
      {children}
    </YStack>
  )
}

/**
 * The approval mode, as the app's settings hold it: autonomous (agents run
 * tools on their own and stop for anything risky) or supervised (they ask
 * before each tool, connector or site). Spending limits hold either way.
 */
function Mode({ supervised, onSet, small = false }: { supervised: boolean; onSet: (supervised: boolean) => void; small?: boolean }) {
  const { t } = useI18n()
  return (
    <XStack role="radiogroup" aria-label={t('How agents act')} p={2} gap={2} rounded={9999} borderWidth={1} borderColor="$edge" bg="$background" self="flex-start" $platform-web={{ borderRadius: '9999px' }}>
      {[
        { on: false, label: t('Autonomous') },
        { on: true, label: t('Supervised') },
      ].map((m) => {
        const active = m.on === supervised
        return (
          <XStack
            key={m.label}
            render={<button type="button" role="radio" aria-checked={active} onClick={() => onSet(m.on)} />}
            px={small ? 9 : 11}
            height={small ? 24 : 26}
            items="center"
            rounded={9999}
            borderWidth={0}
            bg={active ? '$ink' : 'transparent'}
            cursor="pointer"
            focusVisibleStyle={ROW.focusVisibleStyle}
            $platform-web={{ borderRadius: '9999px', transition: 'background-color 200ms ease' }}
          >
            <Text fontSize={small ? 11 : '$1'} fontWeight="600" color={active ? '$background' : '$soft'}>
              {m.label}
            </Text>
          </XStack>
        )
      })}
    </XStack>
  )
}

/** A bar of how much of a whole is done. */
function Progress({ done, total }: { done: number; total: number }) {
  return (
    <View height={6} rounded={9999} bg="$raised" overflow="hidden" $platform-web={{ borderRadius: '9999px' }}>
      <View height="100%" width={`${total ? Math.round((done / total) * 100) : 0}%`} bg="$ink" rounded={9999} $platform-web={{ borderRadius: '9999px', transition: 'width 600ms cubic-bezier(0.2, 0.7, 0.2, 1)' }} />
    </View>
  )
}

/**
 * The column beside the channel, from 1000px of the preview's own width: how
 * agents act here, what waits on a person, the org's mission and how far it
 * has come, who handed what to whom, and the agents' spending limits.
 */
function Panel({ org, supervised, onMode, asks, done, handoffs, onOpen }: { org: string; supervised: boolean; onMode: (supervised: boolean) => void; asks: Ask[]; done: number[]; handoffs: Handoff[]; onOpen: (room: string) => void }) {
  const { t } = useI18n()
  const clock = useClock()
  const mission = MISSIONS[org]
  // The four steps shown: the last two done, then what is next.
  const from = mission ? Math.max(0, Math.min(done.length - 2, mission.steps.length - 4)) : 0
  const agents = ORGS.find((o) => o.id === org)?.agents.filter((a) => LIMITS[a]).slice(0, 3) ?? []
  return (
    <YStack flex={1} minH={0} overflow="hidden" gap={10} p={12} bg="$sunken" $platform-web={FOOT}>
      <Box icon={ShieldCheck} title={t('How agents act')}>
        <Mode supervised={supervised} onSet={onMode} />
        <Text fontSize="$1" lineHeight={16} color="$soft">
          {supervised ? t('Agents ask before each tool, connector or site. Spending limits stay on.') : t('Agents run tools on their own and stop for anything risky. Spending limits stay on.')}
        </Text>
      </Box>
      <Box
        icon={UserRound}
        title={t('Needs a person')}
        aside={
          <Text key={asks.length} data-motion="rise" fontSize="$1" fontWeight="700" color="$ink" data-i18n-ltr>
            {asks.length}
          </Text>
        }
      >
        {asks.length ? (
          asks.slice(0, 3).map((a) => (
            <XStack
              key={a.id}
              data-motion="rise"
              render={<button type="button" aria-label={t('Open #{channel}', { channel: channelOf(a.room) })} onClick={() => onOpen(a.room)} />}
              items="center"
              gap={8}
              p={4}
              rounded={8}
              bg="transparent"
              {...ROW}
              $platform-web={{ borderRadius: '8px', textAlign: 'start' }}
            >
              <Avatar id={a.who} size={20} />
              <Text flex={1} minW={0} fontSize="$1" lineHeight={16} color="$ink" numberOfLines={2}>
                {t(a.say, { what: t(a.what) })}
              </Text>
            </XStack>
          ))
        ) : (
          <Text fontSize="$1" color="$soft">
            {t('Nothing right now.')}
          </Text>
        )}
      </Box>
      {mission ? (
        <Box
          icon={Target}
          title={t(mission.title)}
          aside={
            <Text fontSize="$1" color="$soft" data-i18n-ltr>
              {t('{done} of {total}', { done: done.length, total: mission.steps.length })}
            </Text>
          }
        >
          <Progress done={done.length} total={mission.steps.length} />
          <YStack gap={5}>
            {mission.steps.map((step, i) => ({ step, i })).slice(from, from + 4).map(({ step, i }) => (
              <XStack key={step} items="center" gap={8}>
                <Tick done={done.includes(i)} />
                <Text flex={1} minW={0} fontSize="$1" color={done.includes(i) ? '$ink' : '$soft'} numberOfLines={1}>
                  {t(step)}
                </Text>
              </XStack>
            ))}
          </YStack>
        </Box>
      ) : null}
      <Box icon={CornerDownRight} title={t('Handoffs')}>
        {handoffs.length ? (
          [...handoffs]
            .reverse()
            .slice(0, 4)
            .map((h) => (
              <XStack key={`${h.time}/${h.from}/${h.to}`} data-motion="rise" items="center" gap={6}>
                <Avatar id={h.from} size={18} />
                <CornerDownRight size={11} color="var(--muted-foreground)" aria-hidden data-i18n-mirror />
                <Avatar id={h.to} size={18} />
                <Text flex={1} minW={0} fontSize="$1" color="$ink" numberOfLines={1}>
                  {t('{from} to {to}', { from: who(h.from).name, to: who(h.to).name })}
                </Text>
                <Text fontSize={11} color="$faint" data-i18n-ltr>
                  {clock(h.time)}
                </Text>
              </XStack>
            ))
        ) : (
          <Text fontSize="$1" color="$soft">
            {t('No handoffs yet today.')}
          </Text>
        )}
      </Box>
      {agents.length ? (
        <Box icon={Wallet} title={t('Spending limits')}>
          {agents.map((a) => (
            <XStack key={a} items="center" gap={8}>
              <Avatar id={a} size={18} />
              <Text flex={1} minW={0} fontSize="$1" color="$ink" numberOfLines={1}>
                {who(a).name}
              </Text>
              <Text fontSize={11} color="$soft" data-i18n-ltr>
                {t('{week} a week · {task} a task', { week: `$${LIMITS[a].week}`, task: `$${LIMITS[a].task}` })}
              </Text>
            </XStack>
          ))}
        </Box>
      ) : null}
    </YStack>
  )
}

/** Three dots that take turns, beside who is typing. */
function Dots() {
  return (
    <XStack gap={3} aria-hidden>
      {['0ms', '200ms', '400ms'].map((delay) => (
        <View key={delay} data-motion="pulse" width={4} height={4} rounded={9999} bg="$soft" $platform-web={{ borderRadius: '9999px', animationDelay: delay }} />
      ))}
    </XStack>
  )
}

/**
 * Hanzo Team's workspace, playing. From 600px of its own width it is the
 * desktop app (the rail, the workspace's column, the channel); narrower, or
 * told `phone`, the phone app: the channel, with the rail and the column as a
 * drawer. A host (the landing's hero) can pause it, hear when it ends, and fit
 * it to a device's screen (`PreviewProps`).
 */
export function TeamPreview(props: PreviewProps) {
  const { compact, phone } = props
  const { t } = useI18n()
  const still = useStill()
  const { box, seen, width, height, visible, held, hold } = useStage()
  const { live, end } = useHost(props)
  // It always lays itself out by its own width, so it fits a page's column, a
  // hero's half and a device's screen alike; the window decides only before it
  // is measured (the server's render and the first paint).
  const desk = phone ? false : width ? width >= DESK : null
  const roomy = desk !== false && width >= ROOM
  const [driven, setDriven] = useState(false)
  const loop = useRef(true)
  const [replay, setReplay] = useState(0)
  // The room the reader opened, the rooms they have read, and what they set by hand.
  const [opened, setOpened] = useState<string | null>(null)
  const [read, setRead] = useState<string[]>([])
  const [hand, setHand] = useState<Record<string, Partial<Card>>>({})
  const [threadHand, setThreadHand] = useState<string | null | undefined>(undefined)
  const [drawer, setDrawer] = useState(false)
  // How agents act: autonomous (the app's Auto approval) or supervised (Manual).
  const [supervised, setSupervised] = useState(false)

  useEffect(() => {
    loop.current = !driven
  }, [driven])

  const lines = useMemo(() => (opened ? (SCENE[opened] ?? pace([{ kind: 'open', room: opened, time: 9 * 60 }])) : DAY), [opened])
  const run = seen && !still
  const at = usePlay(lines, run, replay, { visible, held, loop, live, end })
  // Before it plays, and under reduced motion, the day stands at its still frame.
  const upto = opened || run ? at : STILL
  const f = useMemo(() => frame(lines, upto), [lines, upto])

  const here = f.room
  const o = orgOf(here)
  const channel = channelOf(here)
  const topic = o.channels.find((c) => c.id === channel)?.topic ?? ''
  const messages = (f.rooms[here] ?? []).map((m) => (hand[m.id] && m.card ? { ...m, card: { ...m.card, ...hand[m.id] } as Card } : m))
  const thread = threadHand === undefined ? f.thread : threadHand
  const parent = thread ? messages.find((m) => m.id === thread) : undefined
  const typing = f.typing
  const huddle = f.huddle[here] ?? []
  const unread = (room: string) => (room === here || read.includes(room) ? 0 : (f.unread[room] ?? 0))
  /** What is unread across an org's channels. */
  const news = (org: string) => ORGS.find((x) => x.id === org)?.channels.reduce((n, c) => n + unread(`${org}/${c.id}`), 0) ?? 0
  const members = [...o.people.slice(0, 2), ...o.agents.slice(0, 2)]
  const asks = waiting(f, supervised).filter((a) => orgOf(a.room).id === o.id)
  const done = f.steps[o.id] ?? []
  const handoffs = f.handoffs.filter((h) => orgOf(h.room).id === o.id)
  const mission = MISSIONS[o.id]

  /** The reader takes over: nothing loops over what they set. */
  const go = (room: string) => {
    setDriven(true)
    setDrawer(false)
    setThreadHand(undefined)
    setOpened(room)
    setRead((r) => (r.includes(room) ? r : [...r, room]))
    setReplay((n) => n + 1)
  }
  const pick = (id: string) => (patch: Partial<Card>) => {
    setDriven(true)
    setHand((h) => ({ ...h, [id]: { ...h[id], ...patch } }))
  }
  const openThread = (id: string | null) => {
    setDriven(true)
    setThreadHand(id)
  }

  /** The organizations a person belongs to: the active one marked, "+" under them, the reader at the foot. */
  const rail = (
    <YStack items="center" gap={12} py={12} width={60} height="100%" shrink={0} borderColor="$edge" borderInlineEndWidth={1} bg="$sunken">
      {ORGS.map((x) => {
        const on = x.id === o.id
        return (
          <XStack key={x.id} position="relative" items="center" justify="center">
            <View
              position="absolute"
              insetInlineStart={-8}
              width={4}
              height={on ? 28 : 0}
              rounded={9999}
              bg="$ink"
              $platform-web={{ borderRadius: '9999px', transition: still ? 'none' : 'height 260ms ease' }}
            />
            <Tile org={x} on={on} n={on ? 0 : news(x.id)} size="xl" onPress={() => go(HOME[x.id])} />
          </XStack>
        )
      })}
      <XStack width={32} height={32} rounded={8} items="center" justify="center" borderWidth={1} borderColor="$edge" $platform-web={{ borderRadius: '8px' }}>
        <Plus size={15} color="var(--muted-foreground)" aria-hidden />
      </XStack>
      <View flex={1} />
      <View position="relative">
        <Avatar id={ME} size={30} />
        <View position="absolute" b={-1} insetInlineEnd={-1} rounded={9999} borderWidth={2} borderColor="$sunken" $platform-web={{ borderRadius: '9999px' }}>
          <Here />
        </View>
      </View>
    </YStack>
  )

  const heading = (label: string) => (
    <XStack items="center" gap={4} px={8} pt={12} pb={3}>
      <ChevronDown size={12} color="var(--muted-foreground)" aria-hidden />
      <Text fontSize="$1" fontWeight="600" color="$soft">
        {label}
      </Text>
    </XStack>
  )

  /** The workspace's column: its name, search, the channels, the direct messages and the agents. */
  const column = (
    <YStack key={o.id} data-motion="rise" flex={1} minH={0} overflow="hidden" px={8} py={10} $platform-web={FOOT}>
      <XStack items="center" gap={6} px={8} pb={10}>
        <Text fontSize="$4" fontWeight="700" color="$ink" numberOfLines={1}>
          {o.name}
        </Text>
        <ChevronDown size={14} color="var(--muted-foreground)" aria-hidden />
        <View flex={1} />
        <XStack width={28} height={28} rounded={8} items="center" justify="center" bg="$raised" $platform-web={{ borderRadius: '8px' }}>
          <SquarePen size={14} color="var(--foreground)" aria-hidden />
        </XStack>
      </XStack>
      <XStack items="center" gap={6} mx={4} mb={4} px={10} height={28} rounded={8} borderWidth={1} borderColor="$edge" $platform-web={{ borderRadius: '8px' }}>
        <Search size={12} color="var(--muted-foreground)" aria-hidden />
        <Text fontSize="$1" color="$faint" numberOfLines={1}>
          {t('Search {org}', { org: o.name })}
        </Text>
      </XStack>
      {heading(t('Channels'))}
      {o.channels.map((c) => {
        const room = `${o.id}/${c.id}`
        const on = room === here
        const n = unread(room)
        return (
          <XStack
            key={c.id}
            render={<button type="button" aria-pressed={on} aria-label={t('Open #{channel}', { channel: c.id })} onClick={() => go(room)} />}
            items="center"
            gap={6}
            px={10}
            py={4}
            rounded={8}
            bg={on ? '$raised' : 'transparent'}
            {...ROW}
            $platform-web={{ borderRadius: '8px', textAlign: 'start' }}
          >
            <Hash size={13} color={on || n ? 'var(--foreground)' : 'var(--muted-foreground)'} aria-hidden />
            <Text flex={1} minW={0} fontSize="$2" lineHeight={20} fontWeight={on || n ? '700' : '400'} color={on || n ? '$ink' : '$soft'} numberOfLines={1} data-i18n-ltr>
              {c.id}
            </Text>
            {n ? <Count n={n} /> : null}
          </XStack>
        )
      })}
      {heading(t('Direct messages'))}
      {o.people.map((p, i) => (
        <XStack key={p} items="center" gap={8} px={10} py={3}>
          <Avatar id={p} size={20} />
          <Text flex={1} minW={0} fontSize="$2" color="$soft" numberOfLines={1}>
            {who(p).name}
          </Text>
          <Here away={i === o.people.length - 1} busy={typing?.who === p} />
        </XStack>
      ))}
      {heading(t('Agents'))}
      {o.agents.map((a) => (
        <XStack key={a} items="center" gap={8} px={10} py={3}>
          <Avatar id={a} size={20} />
          <Text flex={1} minW={0} fontSize="$2" color="$soft" numberOfLines={1}>
            {t('{name} · {role}', { name: who(a).name, role: t(who(a).role ?? '') })}
          </Text>
          <Here busy={typing?.who === a} />
        </XStack>
      ))}
    </YStack>
  )

  const title = (
    <YStack flex={1} minW={0}>
      <XStack items="center" gap={3}>
        <Hash size={15} color="var(--foreground)" aria-hidden />
        <Text fontSize="$3" fontWeight="700" color="$ink" numberOfLines={1} data-i18n-ltr>
          {channel}
        </Text>
        <ChevronDown size={13} color="var(--muted-foreground)" aria-hidden />
      </XStack>
      <Text fontSize="$1" color="$soft" numberOfLines={1}>
        {t(topic)}
      </Text>
    </YStack>
  )

  /** A conversation's messages, the oldest leaving the top; a run of one author's lines shares one face. */
  const list = (items: Message[], threads: boolean) => (
    <YStack flex={1} minH={0} overflow="hidden" justify="flex-end" gap={6} px={16} pt={8} pb={4} $platform-web={TOP}>
      {items.map((m, i) => {
        const before = items[i - 1]
        const grouped = !!before && before.who === m.who && !before.card && !before.replies.length && m.time - before.time < 5
        return <Post key={m.id} m={m} grouped={grouped} onThread={threads ? () => openThread(m.id) : undefined} onPick={pick(m.id)} />
      })}
    </YStack>
  )

  const composer = (placeholder: string) => (
    <YStack mx={12} mb={12} gap={8} px={12} py={10} rounded={12} borderWidth={1} borderColor="$edge" bg="$panel" $platform-web={{ borderRadius: '12px' }}>
      <Text fontSize="$2" color="$faint" numberOfLines={1}>
        {placeholder}
      </Text>
      <XStack items="center" gap={12}>
        <Plus size={15} color="var(--muted-foreground)" aria-hidden />
        <AtSign size={15} color="var(--muted-foreground)" aria-hidden />
        <Smile size={15} color="var(--muted-foreground)" aria-hidden />
        <Mic size={15} color="var(--muted-foreground)" aria-hidden />
        <View flex={1} />
        <SendHorizontal size={15} color="var(--muted-foreground)" aria-hidden data-i18n-mirror />
      </XStack>
    </YStack>
  )

  /** The thread a message started: the message, its replies, a reply box. */
  const side = parent ? (
    <YStack key={parent.id} flex={1} minH={0} bg="var(--background)">
      <XStack items="center" gap={8} px={14} minH={52} borderBottomWidth={1} borderColor="$edge">
        <YStack flex={1} minW={0}>
          <Text fontSize="$3" fontWeight="700" color="$ink">
            {t('Thread')}
          </Text>
          <Text fontSize="$1" color="$soft" data-i18n-ltr>
            {`#${channel}`}
          </Text>
        </YStack>
        <XStack
          render={<button type="button" aria-label={t('Close the thread')} onClick={() => openThread(null)} />}
          width={28}
          height={28}
          rounded={8}
          items="center"
          justify="center"
          bg="transparent"
          {...ROW}
          $platform-web={{ borderRadius: '8px' }}
        >
          <X size={15} color="var(--muted-foreground)" aria-hidden />
        </XStack>
      </XStack>
      <YStack flex={1} minH={0} overflow="hidden" justify="flex-end" gap={6} px={14} pt={8} pb={4} $platform-web={TOP}>
        <Post m={{ ...parent, replies: [] }} grouped={false} onPick={pick(parent.id)} />
        <XStack items="center" gap={8} py={6}>
          <Text fontSize="$1" color="$soft">
            {replies(t, parent.replies.length)}
          </Text>
          <View flex={1} height={1} bg="$edge" />
        </XStack>
        {parent.replies.map((r, i) => (
          <Post key={i} m={{ id: `${parent.id}/${i}`, who: r.who, text: r.text, time: r.time, reactions: [], replies: [] }} grouped={false} onPick={() => undefined} />
        ))}
      </YStack>
      {composer(t('Reply…'))}
    </YStack>
  ) : null

  return (
    <View
      ref={box}
      data-slot="team-preview"
      role="group"
      aria-label={t('Hanzo Team, playing a sample workspace')}
      {...hold}
      display="grid"
      position="relative"
      height={compact ? '100%' : 620}
      overflow="hidden"
      bg="var(--background)"
      gridTemplateColumns="minmax(0, 1fr)"
      {...md(desk, {
        height: compact ? '100%' : 640,
        gridTemplateColumns: `60px ${breadth(width)}px minmax(0, 1fr)${roomy ? ' 290px' : ''}`,
      })}
      $platform-web={{ textAlign: 'start' }}
    >
      <YStack display="none" {...md(desk, { display: 'flex' })} minH={0}>
        {rail}
      </YStack>
      <YStack display="none" {...md(desk, { display: 'flex' })} minH={0} borderColor="$edge" borderInlineEndWidth={1} bg="$sunken">
        {column}
      </YStack>

      {/* The channel: its name and topic, who is in it, the huddle, the messages and the composer. */}
      <YStack minW={0} minH={0} position="relative">
        <XStack items="center" gap={10} px={14} minH={52} borderBottomWidth={1} borderColor="$edge">
          <XStack {...md(desk, { display: 'none' })}>
            <XStack
              render={<button type="button" aria-expanded={drawer} aria-label={t('Channels in {org}', { org: o.name })} onClick={() => setDrawer(!drawer)} />}
              width={32}
              height={32}
              rounded={8}
              items="center"
              justify="center"
              bg="transparent"
              {...ROW}
              $platform-web={{ borderRadius: '8px' }}
            >
              <Menu size={17} color="var(--foreground)" aria-hidden />
            </XStack>
          </XStack>
          {title}
          <XStack display="none" {...(width >= FACES ? { display: 'flex' } : {})} items="center">
            {members.map((p, i) => (
              <View key={p} marginInlineStart={i ? -6 : 0} rounded={9999} borderWidth={2} borderColor="var(--background)" $platform-web={{ borderRadius: '9999px' }}>
                <Avatar id={p} size={22} />
              </View>
            ))}
            <Text fontSize="$1" color="$soft" marginInlineStart={6} data-i18n-ltr>
              {o.people.length + o.agents.length}
            </Text>
          </XStack>
          <XStack
            key={huddle.length ? 'on' : 'off'}
            data-motion="rise"
            items="center"
            gap={6}
            px={10}
            height={30}
            rounded={8}
            borderWidth={1}
            borderColor={huddle.length ? '$ink' : '$edge'}
            bg={huddle.length ? '$ink' : 'transparent'}
            $platform-web={{ borderRadius: '8px' }}
          >
            {huddle.length ? <View data-motion="pulse" width={7} height={7} rounded={9999} bg="var(--state-online)" $platform-web={{ borderRadius: '9999px' }} /> : null}
            <Headphones size={14} color={huddle.length ? 'var(--background)' : 'var(--foreground)'} aria-hidden />
            <Text display="none" {...md(desk, { display: 'flex' })} fontSize="$1" fontWeight="600" color={huddle.length ? '$background' : '$ink'}>
              {huddle.length ? t('Huddle · {count}', { count: huddle.length }) : t('Huddle')}
            </Text>
          </XStack>
        </XStack>

        {/* The phone's switcher: every organization, then this one's channels, each with what is unread.
            The channels wrap rather than scroll, so every one is on screen and none passes the edge. */}
        <YStack {...md(desk, { display: 'none' })} gap={8} pt={10} pb={8} borderBottomWidth={1} borderColor="$edge">
          <XStack items="center" gap={10} px={12}>
            {ORGS.map((x) => (
              <Tile key={x.id} org={x} on={x.id === o.id} n={x.id === o.id ? 0 : news(x.id)} size="lg" onPress={() => go(HOME[x.id])} />
            ))}
            <Text key={o.id} data-motion="rise" flex={1} minW={0} fontSize="$3" fontWeight="700" color="$ink" numberOfLines={1} marginInlineStart={4}>
              {o.name}
            </Text>
          </XStack>
          <XStack flexWrap="wrap" gap={6} px={12} display={height && height < LIST ? 'none' : 'flex'}>
            {o.channels.map((c) => {
              const room = `${o.id}/${c.id}`
              const on = room === here
              const n = unread(room)
              return (
                <XStack
                  key={c.id}
                  render={<button type="button" aria-pressed={on} aria-label={t('Open #{channel}', { channel: c.id })} onClick={() => go(room)} />}
                  shrink={0}
                  items="center"
                  gap={5}
                  px={10}
                  height={28}
                  rounded={9999}
                  borderWidth={1}
                  borderColor={on ? '$ink' : '$edge'}
                  bg={on ? '$ink' : 'transparent'}
                  cursor="pointer"
                  focusVisibleStyle={ROW.focusVisibleStyle}
                  $platform-web={{ borderRadius: '9999px' }}
                >
                  <Text fontSize="$1" fontWeight={on || n ? '700' : '500'} color={on ? '$background' : n ? '$ink' : '$soft'} data-i18n-ltr>
                    {`#${c.id}`}
                  </Text>
                  {n && !on ? <Count n={n} /> : null}
                </XStack>
              )
            })}
          </XStack>
        </YStack>

        {list(messages, true)}

        <XStack items="center" gap={6} px={18} minH={20}>
          {typing && typing.room === here ? (
            <>
              <Dots />
              <Text fontSize="$1" color="$soft" numberOfLines={1}>
                {t('{name} is typing…', { name: who(typing.who).name })}
              </Text>
            </>
          ) : null}
        </XStack>
        {/* Where there is no room for the panel: how agents act, what waits on a person, the mission's progress. */}
        {roomy || (height && height < LIST) ? null : (
          <XStack flexWrap="wrap" items="center" gap={8} px={12} pb={8}>
            <Mode supervised={supervised} onSet={setSupervised} small />
            <XStack items="center" gap={6} px={10} height={28} rounded={9999} borderWidth={1} borderColor={asks.length ? '$ink' : '$edge'} $platform-web={{ borderRadius: '9999px' }}>
              <UserRound size={12} color="var(--foreground)" aria-hidden />
              <Text key={asks.length} data-motion="rise" fontSize={11} fontWeight="600" color="$ink">
                {asks.length ? t('{count} need a person', { count: asks.length }) : t('Nothing needs a person')}
              </Text>
            </XStack>
            {mission ? (
              <XStack items="center" gap={6} px={10} height={28} rounded={9999} borderWidth={1} borderColor="$edge" $platform-web={{ borderRadius: '9999px' }}>
                <Target size={12} color="var(--foreground)" aria-hidden />
                <Text fontSize={11} fontWeight="600" color="$ink" data-i18n-ltr>
                  {t('{done} of {total}', { done: done.length, total: mission.steps.length })}
                </Text>
                <View width={36}>
                  <Progress done={done.length} total={mission.steps.length} />
                </View>
              </XStack>
            ) : null}
          </XStack>
        )}
        {composer(t('Message #{channel}', { channel }))}

        {/* The thread over the channel, where it cannot stand beside it. */}
        {side && !roomy ? (
          <YStack data-motion="rise" position="absolute" t={0} b={0} insetInlineEnd={0} width="100%" maxW={420} borderColor="$edge" borderInlineStartWidth={1} bg="var(--background)" boxShadow="0 24px 60px -24px color-mix(in srgb, var(--pure-black) 60%, transparent)">
            {side}
          </YStack>
        ) : null}

        {/* The phone's drawer: the rail and the workspace's column over the channel, drawn only while open. */}
        {drawer && desk !== true ? (
          <XStack
            data-motion="rise"
            position="absolute"
            t={0}
            b={0}
            insetInlineStart={0}
            width="88%"
            maxW={340}
            bg="var(--background)"
            borderColor="$edge"
            borderInlineEndWidth={1}
            boxShadow="0 24px 60px -24px color-mix(in srgb, var(--pure-black) 60%, transparent)"
            {...md(desk, { display: 'none' })}
          >
            {rail}
            <YStack flex={1} minW={0} bg="$sunken">
              {column}
            </YStack>
          </XStack>
        ) : null}
      </YStack>

      {roomy ? (
        <YStack minW={0} minH={0} borderColor="$edge" borderInlineStartWidth={1}>
          {side ?? <Panel org={o.id} supervised={supervised} onMode={setSupervised} asks={asks} done={done} handoffs={handoffs} onOpen={go} />}
        </YStack>
      ) : null}
    </View>
  )
}
