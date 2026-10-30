'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AtSign, ChevronDown, Flame, Hash, Headphones, Heart, Image as Picture, MessageSquareText, Mic, Plus, SendHorizontal, Smile, SquarePen, ThumbsUp, type LucideIcon } from 'lucide-react'
import { phrase } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { Text, View, XStack, YStack } from '@hanzo/ui'
import { Face } from './cast'
import { md, useDesk, useHost, usePlay, useStage, useStill, type Beat, type PreviewProps } from './preview'

/**
 * Hanzo Team, playing: the workspace as these rooms draw it, laid out the way
 * a team chat is read. hanzo.team's landing opens on it, and hanzo.ai's hero
 * plays it after its own scene; one component, both hosts. Far left, the organizations a
 * person belongs to, one active, with "+" under them; then the workspace's
 * column: its name, Channels, Direct messages with who is here, and the org's
 * Agents; then the channel, its topic and who is in it, the messages, and the
 * composer.
 *
 * The script is friends and their agents building together: at Acme, Zoe puts
 * the pricing page up, Sam asks des for the plan cards, des posts the work, a
 * reaction lands, dev ships it; then the switcher flips to Friday Club, where
 * friends start a recipe app and maya sets up the board. It plays while on
 * screen and the pointer is elsewhere, and loops. Pressing an org or a channel
 * opens it and plays its own exchange; from then on nothing loops over the
 * reader.
 *
 * A reader who asked for less motion, the server and the first paint get Acme's
 * #launch whole, still. People wear their initials, as the rooms draw a person
 * with no picture; agents wear the cast's portraits (`Face`). Every
 * word is sample copy written here, through `phrase`/`t()`; a name, a channel
 * and a file stay as written.
 */

type Who = { name: string; agent?: boolean }
const WHO: Record<string, Who> = {
  ada: { name: 'Ada Park' },
  sam: { name: 'Sam Ortiz' },
  mina: { name: 'Mina Chen' },
  theo: { name: 'Theo Brandt' },
  zoe: { name: 'Zoe Iyer' },
  des: { name: 'des', agent: true },
  dev: { name: 'dev', agent: true },
  maya: { name: 'maya', agent: true },
  vi: { name: 'vi', agent: true },
}

/** A reaction's mark: monochrome, as the rest of the chrome. */
const MARKS: Record<string, LucideIcon> = { flame: Flame, heart: Heart, thumbs: ThumbsUp }

type Line = Beat &
  (
    | { kind: 'say'; who: string; text: string; replies?: number; file?: string }
    | { kind: 'typing'; who: string }
    /** A reaction lands on the message before it. */
    | { kind: 'react'; mark: string; count: number }
    /** The switcher flips to another organization, on its own channel. */
    | { kind: 'org'; org: string }
    | { kind: 'rest' }
  )

type Channel = { id: string; topic: string; unread?: number }
type Org = { id: string; name: string; mark: string; channels: Channel[]; people: string[]; agents: string[] }

const ORGS: Org[] = [
  {
    id: 'acme',
    name: 'Acme',
    mark: 'A',
    channels: [
      { id: 'general', topic: phrase('Everything Acme') },
      { id: 'launch', topic: phrase('Shipping the pricing page this week') },
      { id: 'design', topic: phrase('Screens, mocks and taste'), unread: 2 },
    ],
    people: ['zoe', 'sam', 'ada'],
    agents: ['des', 'dev'],
  },
  {
    id: 'friday',
    name: 'Friday Club',
    mark: 'F',
    channels: [
      { id: 'side-project', topic: phrase('Building a recipe app, for fun') },
      { id: 'game-night', topic: phrase('Who is in this week'), unread: 5 },
    ],
    people: ['mina', 'theo', 'ada'],
    agents: ['maya', 'vi'],
  },
  {
    id: 'lab',
    name: 'Night Lab',
    mark: 'N',
    channels: [
      { id: 'general', topic: phrase('Late ideas, early prototypes') },
      { id: 'ideas', topic: phrase('Half-baked, on purpose'), unread: 1 },
    ],
    people: ['theo', 'zoe'],
    agents: ['vi', 'dev'],
  },
]
const org = (id: string) => ORGS.find((o) => o.id === id) ?? ORGS[0]
/** The channel each org opens on. */
const HOME: Record<string, string> = { acme: 'launch', friday: 'side-project', lab: 'general' }

const ACME: Line[] = [
  { kind: 'say', who: 'zoe', text: phrase('Pricing page is on the preview link. Tear it apart.'), replies: 3, wait: 600 },
  { kind: 'say', who: 'sam', text: phrase('Love it. @des can the plan cards line up?'), wait: 1500 },
  { kind: 'typing', who: 'des', wait: 1200 },
  { kind: 'say', who: 'des', text: phrase('Done. Every price sits on one baseline now.'), file: 'plan-cards.png', wait: 1100 },
  { kind: 'react', mark: 'flame', count: 3, wait: 1300 },
  { kind: 'say', who: 'ada', text: phrase('@dev ship it when the checks pass.'), wait: 1300 },
  { kind: 'typing', who: 'dev', wait: 1200 },
  { kind: 'say', who: 'dev', text: phrase('Checks passed. It is live.'), wait: 1000 },
  { kind: 'react', mark: 'thumbs', count: 4, wait: 1000 },
]
const FRIDAY: Line[] = [
  { kind: 'say', who: 'mina', text: phrase('Who is in for the recipe app tonight?'), wait: 700 },
  { kind: 'say', who: 'theo', text: phrase('In. @maya can you set up the board?'), wait: 1400 },
  { kind: 'typing', who: 'maya', wait: 1200 },
  { kind: 'say', who: 'maya', text: phrase('Board is ready: sign-in, recipes and search, a card each.'), wait: 1000 },
  { kind: 'react', mark: 'heart', count: 5, wait: 1100 },
  { kind: 'say', who: 'ada', text: phrase('Bringing snacks.'), replies: 2, wait: 1300 },
]
/** What each room says when it is opened by hand. */
const ROOMS: Record<string, Line[]> = {
  'acme/launch': ACME,
  'acme/general': [
    { kind: 'say', who: 'ada', text: phrase('Standup moved to 10 today.'), wait: 300 },
    { kind: 'say', who: 'zoe', text: phrase('Works for me.'), wait: 900 },
    { kind: 'react', mark: 'thumbs', count: 2, wait: 800 },
  ],
  'acme/design': [
    { kind: 'say', who: 'sam', text: phrase('@des a darker hover on the cards?'), wait: 300 },
    { kind: 'typing', who: 'des', wait: 800 },
    { kind: 'say', who: 'des', text: phrase('Tried it. The mock is in Drive, side by side with the old one.'), file: 'hover.png', wait: 1000 },
  ],
  'friday/side-project': FRIDAY,
  'friday/game-night': [
    { kind: 'say', who: 'theo', text: phrase('Game night Thursday?'), wait: 300 },
    { kind: 'say', who: 'mina', text: phrase('Yes. @vi can you find a time that works for all of us?'), wait: 1000 },
    { kind: 'typing', who: 'vi', wait: 800 },
    { kind: 'say', who: 'vi', text: phrase('Thursday at 8 works for everyone. It is on your calendars.'), wait: 1000 },
  ],
  'lab/general': [
    { kind: 'say', who: 'zoe', text: phrase('What if the app planned the week for you?'), wait: 300 },
    { kind: 'typing', who: 'dev', wait: 800 },
    { kind: 'say', who: 'dev', text: phrase('I can have a first version running by morning.'), wait: 1000 },
    { kind: 'react', mark: 'flame', count: 2, wait: 900 },
  ],
  'lab/ideas': [
    { kind: 'say', who: 'theo', text: phrase('A bot that waters the plants.'), wait: 300 },
    { kind: 'say', who: 'zoe', text: phrase('Filed under someday.'), wait: 1000 },
  ],
}
/** The whole script: Acme's launch, then the switch to Friday Club. */
const SCRIPT: Line[] = [...ACME, { kind: 'org', org: 'friday', wait: 2600 }, ...FRIDAY, { kind: 'rest', wait: 2600 }]

/** A reaction under a message: its mark and how many. */
function Reaction({ mark, count }: { mark: string; count: number }) {
  const Mark = MARKS[mark] ?? Heart
  return (
    <XStack data-motion="rise" items="center" gap={4} px={8} py={2} rounded={9999} borderWidth={1} borderColor="$ink" bg="$hover" $platform-web={{ borderRadius: '9999px' }}>
      <Mark size={12} color="var(--foreground)" aria-hidden />
      <Text fontSize="$1" color="$ink" data-i18n-ltr>
        {count}
      </Text>
    </XStack>
  )
}

/** One message: the face, the name (an agent tagged), the words, a file, its reactions and its thread. */
function Message({ who, file, replies, reactions, children }: { who: string; file?: string; replies?: number; reactions: { mark: string; count: number }[]; children: ReactNode }) {
  const { t } = useI18n()
  const w = WHO[who]
  return (
    <XStack data-motion="rise" gap={10} items="flex-start">
      <Face name={w.name} size={32} person={!w.agent} />
      <YStack flex={1} minW={0} gap={4}>
        <XStack items="center" gap={6}>
          <Text fontSize="$2" fontWeight="700" color="$ink" numberOfLines={1}>
            {w.name}
          </Text>
          {w.agent ? (
            <Text fontSize={10} lineHeight={14} px={6} rounded={6} bg="$hover" color="$soft" $platform-web={{ borderRadius: '6px' }}>
              {t('Agent')}
            </Text>
          ) : null}
        </XStack>
        <Text fontSize="$2" lineHeight="$3" color="$ink">
          {children}
        </Text>
        {file ? (
          <XStack self="flex-start" items="center" gap={8} mt={2} px={10} py={8} rounded={10} borderWidth={1} borderColor="$edge" bg="$panel" $platform-web={{ borderRadius: '10px' }}>
            <XStack width={34} height={26} rounded={6} items="center" justify="center" bg="$raised" $platform-web={{ borderRadius: '6px' }}>
              <Picture size={14} color="var(--muted-foreground)" aria-hidden />
            </XStack>
            <Text fontFamily="$mono" fontSize="$1" color="$soft" data-i18n-ltr>
              {file}
            </Text>
          </XStack>
        ) : null}
        {reactions.length ? (
          <XStack gap={6} mt={2}>
            {reactions.map((r, i) => (
              <Reaction key={i} mark={r.mark} count={r.count} />
            ))}
          </XStack>
        ) : null}
        {replies ? (
          <XStack items="center" gap={6} mt={2}>
            <MessageSquareText size={13} color="var(--foreground)" aria-hidden />
            <Text fontSize="$1" fontWeight="600" color="$ink">
              {t('{count} replies', { count: replies })}
            </Text>
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  )
}

/** A button drawn as one of the workspace's rows: the press, the hover, the focus ring. */
const ROW = {
  borderWidth: 0,
  cursor: 'pointer',
  hoverStyle: { bg: '$hover' },
  focusVisibleStyle: { outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)', outlineOffset: -2 },
} as const

/** A dot that says someone is here now. */
function Here() {
  return <View width={7} height={7} rounded={9999} bg="var(--state-online)" shrink={0} $platform-web={{ borderRadius: '9999px' }} />
}

/**
 * Hanzo Team's workspace, playing. From 768px the switcher and the workspace's
 * column stand beside the channel; on a phone the channel fills the window, the
 * org's mark flips to the next org and the channel's name opens the column as a
 * drawer. A host (the landing's hero) can pause it, hear when it ends, and fit
 * it to a device's screen (`PreviewProps`).
 */
export function TeamPreview(props: PreviewProps) {
  const { compact } = props
  const { t, dir } = useI18n()
  const still = useStill()
  const { box, seen, width, visible, held, hold } = useStage()
  const { live, end } = useHost(props)
  const desk = useDesk(width, props)
  const [driven, setDriven] = useState(false)
  const loop = useRef(true)
  const [replay, setReplay] = useState(0)
  // The room the reader opened by hand, and the channels they have read.
  const [opened, setOpened] = useState<{ org: string; channel: string } | null>(null)
  const [read, setRead] = useState<string[]>([])
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    loop.current = !driven
  }, [driven])

  const key = opened ? `${opened.org}/${opened.channel}` : 'script'
  const lines = opened ? (ROOMS[key] ?? ACME) : SCRIPT
  const at = usePlay(lines, seen && !still, replay, { visible, held, loop, live, end })
  const shown = lines.slice(0, at)
  const last = shown[shown.length - 1]

  // Where the script stands: the last org it switched to, on that org's channel.
  const flip = [...shown].reverse().find((l) => l.kind === 'org')
  const here = opened?.org ?? (flip?.kind === 'org' ? flip.org : 'acme')
  const channel = opened?.channel ?? HOME[here]
  const o = org(here)
  const next = ORGS[(ORGS.indexOf(o) + 1) % ORGS.length]
  const topic = o.channels.find((c) => c.id === channel)?.topic ?? ''
  // The messages since the last switch, each with the reactions that landed on it.
  const since = flip ? shown.slice(shown.indexOf(flip) + 1) : shown
  const messages: { line: Extract<Line, { kind: 'say' }>; reactions: { mark: string; count: number }[] }[] = []
  for (const l of since) {
    if (l.kind === 'say') messages.push({ line: l, reactions: [] })
    else if (l.kind === 'react' && messages.length) messages[messages.length - 1].reactions.push({ mark: l.mark, count: l.count })
  }

  const go = (next: string, room = HOME[next]) => {
    setDriven(true)
    setDrawer(false)
    setOpened({ org: next, channel: room })
    setRead((r) => [...r, `${next}/${room}`])
    setReplay((n) => n + 1)
  }
  const unread = (orgId: string, c: Channel) => (c.unread && !read.includes(`${orgId}/${c.id}`) && !(orgId === here && c.id === channel) ? c.unread : 0)

  /** The organizations a person belongs to: the active one marked, "+" under them. */
  const switcher = (
    <YStack items="center" gap={10} py={12} width={60} height="100%" shrink={0} borderColor="$edge" borderInlineEndWidth={1} bg="$sunken">
      {ORGS.map((x) => {
        const on = x.id === here
        const waiting = !on && x.channels.some((c) => unread(x.id, c) > 0)
        return (
          <XStack key={x.id} position="relative" items="center" justify="center">
            <View
              position="absolute"
              insetInlineStart={-12}
              width={4}
              height={on ? 28 : 0}
              rounded={9999}
              bg="$ink"
              $platform-web={{ borderRadius: '9999px', transition: still ? 'none' : 'height 260ms ease' }}
            />
            <XStack
              render={<button type="button" aria-pressed={on} aria-label={t('Open {org}', { org: x.name })} onClick={() => go(x.id)} />}
              width={36}
              height={36}
              rounded={10}
              items="center"
              justify="center"
              bg={on ? '$ink' : '$raised'}
              borderWidth={0}
              cursor="pointer"
              focusVisibleStyle={ROW.focusVisibleStyle}
              $platform-web={{ borderRadius: '10px', transition: still ? 'none' : 'background-color 260ms ease' }}
            >
              <Text fontSize="$3" fontWeight="700" color={on ? '$background' : '$ink'} data-i18n-ltr>
                {x.mark}
              </Text>
            </XStack>
            {waiting ? (
              <View position="absolute" t={-2} insetInlineEnd={-2} width={10} height={10} rounded={9999} bg="$ink" borderWidth={2} borderColor="$sunken" $platform-web={{ borderRadius: '9999px' }} />
            ) : null}
          </XStack>
        )
      })}
      <XStack width={36} height={36} rounded={10} items="center" justify="center" borderWidth={1} borderColor="$edge" $platform-web={{ borderRadius: '10px' }}>
        <Plus size={16} color="var(--muted-foreground)" aria-hidden />
      </XStack>
    </YStack>
  )

  /** The workspace's column: its name, the channels, the people and the agents. */
  const column = (
    <YStack key={here} data-motion="rise" minH={0} overflow="hidden" gap={2} px={8} py={10}>
      <XStack items="center" gap={6} px={6} pb={10}>
        <Text fontSize="$3" fontWeight="700" color="$ink" numberOfLines={1}>
          {o.name}
        </Text>
        <ChevronDown size={14} color="var(--muted-foreground)" aria-hidden />
        <View flex={1} />
        <SquarePen size={15} color="var(--muted-foreground)" aria-hidden />
      </XStack>
      <Text fontSize="$1" color="$soft" px={6} pt={4} pb={2}>
        {t('Channels')}
      </Text>
      {o.channels.map((c) => {
        const on = c.id === channel
        const n = unread(here, c)
        return (
          <XStack
            key={c.id}
            render={<button type="button" aria-pressed={on} aria-label={t('Open #{channel}', { channel: c.id })} onClick={() => go(here, c.id)} />}
            items="center"
            gap={6}
            px={8}
            py={5}
            rounded={8}
            bg={on ? '$raised' : 'transparent'}
            {...ROW}
            $platform-web={{ borderRadius: '8px', textAlign: 'start' }}
          >
            <Hash size={13} color={on || n ? 'var(--foreground)' : 'var(--muted-foreground)'} aria-hidden />
            <Text flex={1} minW={0} fontSize="$2" fontWeight={on || n ? '700' : '400'} color={on || n ? '$ink' : '$soft'} numberOfLines={1} data-i18n-ltr>
              {c.id}
            </Text>
            {n ? (
              <Text fontSize={10} lineHeight={16} minW={18} px={5} rounded={9999} bg="$ink" color="$background" fontWeight="700" text="center" $platform-web={{ borderRadius: '9999px' }} data-i18n-ltr>
                {n}
              </Text>
            ) : null}
          </XStack>
        )
      })}
      <Text fontSize="$1" color="$soft" px={6} pt={10} pb={2}>
        {t('Direct messages')}
      </Text>
      {o.people.map((p) => (
        <XStack key={p} items="center" gap={8} px={8} py={4}>
          <Face name={WHO[p].name} size={24} person />
          <Text flex={1} minW={0} fontSize="$2" color="$soft" numberOfLines={1}>
            {WHO[p].name}
          </Text>
          <Here />
        </XStack>
      ))}
      <Text fontSize="$1" color="$soft" px={6} pt={10} pb={2}>
        {t('Agents')}
      </Text>
      {o.agents.map((a) => (
        <XStack key={a} items="center" gap={8} px={8} py={4}>
          <Face name={WHO[a].name} size={24} />
          <Text flex={1} minW={0} fontSize="$2" color="$soft" numberOfLines={1}>
            {WHO[a].name}
          </Text>
          {last?.kind === 'typing' && last.who === a ? <View data-motion="pulse" width={7} height={7} rounded={9999} bg="var(--state-online)" $platform-web={{ borderRadius: '9999px' }} /> : <Here />}
        </XStack>
      ))}
    </YStack>
  )

  const title = (opens: boolean) => (
    <>
      <XStack items="center" gap={4}>
        <Hash size={14} color="var(--foreground)" aria-hidden />
        <Text fontSize="$3" fontWeight="700" color="$ink" numberOfLines={1} data-i18n-ltr>
          {channel}
        </Text>
        {opens ? <ChevronDown size={14} color="var(--muted-foreground)" aria-hidden /> : null}
      </XStack>
      <Text fontSize="$1" color="$soft" numberOfLines={1}>
        {t(topic)}
      </Text>
    </>
  )

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
      {...md(desk, { height: compact ? '100%' : 600, gridTemplateColumns: '60px 220px minmax(0, 1fr)' })}
      $platform-web={{ textAlign: 'start' }}
    >
      <YStack display="none" {...md(desk, { display: 'flex' })} minH={0}>
        {switcher}
      </YStack>
      <YStack display="none" {...md(desk, { display: 'flex' })} minH={0} borderColor="$edge" borderInlineEndWidth={1}>
        {column}
      </YStack>

      {/* The channel: its name and topic, who is in it, the messages and the composer. */}
      <YStack minW={0} minH={0} position="relative">
        <XStack items="center" gap={10} px={14} py={10} minH={52} borderBottomWidth={1} borderColor="$edge">
          <XStack {...md(desk, { display: 'none' })}>
            <XStack
              render={<button type="button" aria-label={t('Open {org}', { org: next.name })} onClick={() => go(next.id)} />}
              width={30}
              height={30}
              shrink={0}
              rounded={8}
              items="center"
              justify="center"
              bg="$ink"
              borderWidth={0}
              cursor="pointer"
              $platform-web={{ borderRadius: '8px' }}
            >
              <Text fontSize="$2" fontWeight="700" color="$background" data-i18n-ltr>
                {o.mark}
              </Text>
            </XStack>
          </XStack>
          {/* The channel's name and topic; on a phone the name opens the column. */}
          <YStack flex={1} minW={0} display="none" {...md(desk, { display: 'flex' })}>
            {title(false)}
          </YStack>
          <YStack
            flex={1}
            minW={0}
            render={<button type="button" aria-expanded={drawer} aria-label={t('Channels in {org}', { org: o.name })} onClick={() => setDrawer(!drawer)} />}
            borderWidth={0}
            bg="transparent"
            p={0}
            cursor="pointer"
            {...md(desk, { display: 'none' })}
            $platform-web={{ textAlign: 'start' }}
          >
            {title(true)}
          </YStack>
          <XStack display="none" {...md(desk, { display: 'flex' })}>
            {o.agents.map((p, i) => (
              <View key={p} marginInlineStart={i ? -6 : 0} rounded={9999} borderWidth={2} borderColor="var(--background)" $platform-web={{ borderRadius: '9999px' }}>
                <Face name={WHO[p].name} size={24} />
              </View>
            ))}
          </XStack>
          <XStack items="center" gap={6} px={10} py={5} rounded={8} borderWidth={1} borderColor="$edge" $platform-web={{ borderRadius: '8px' }}>
            <Headphones size={14} color="var(--foreground)" aria-hidden />
            <Text display="none" {...md(desk, { display: 'flex' })} fontSize="$1" color="$ink">
              {t('Huddle')}
            </Text>
          </XStack>
        </XStack>

        <YStack
          flex={1}
          minH={0}
          overflow="hidden"
          justify="flex-end"
          gap={14}
          px={16}
          py={14}
          $platform-web={{ maskImage: 'linear-gradient(to bottom, transparent, black 56px)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 56px)' }}
        >
          {messages.map(({ line, reactions }) => (
            <Message key={`${here}/${line.text}`} who={line.who} file={line.file} replies={line.replies} reactions={reactions}>
              {t(line.text)}
            </Message>
          ))}
        </YStack>

        <Text fontSize="$1" color="$soft" px={16} minH={18}>
          {last?.kind === 'typing' ? t('{name} is typing…', { name: WHO[last.who].name }) : ''}
        </Text>
        <YStack mx={12} mb={12} mt={4} gap={8} px={12} py={10} rounded={12} borderWidth={1} borderColor="$edge" bg="$panel" $platform-web={{ borderRadius: '12px' }}>
          <Text fontSize="$2" color="$faint" numberOfLines={1}>
            {t('Message #{channel}', { channel })}
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

        {/* The phone's drawer: the switcher and the column over the channel. */}
        <XStack
          aria-hidden={!drawer}
          position="absolute"
          t={0}
          b={0}
          insetInlineStart={0}
          width="86%"
          maxW={320}
          bg="var(--background)"
          borderColor="$edge"
          borderInlineEndWidth={1}
          boxShadow="0 24px 60px -24px color-mix(in srgb, var(--pure-black) 60%, transparent)"
          pointerEvents={drawer ? 'auto' : 'none'}
          {...md(desk, { display: 'none' })}
          $platform-web={{
            transform: drawer ? 'none' : `translateX(calc((100% + 32px) * ${dir === 'rtl' ? 1 : -1}))`,
            transition: still ? 'none' : 'transform 320ms cubic-bezier(0.2, 0.7, 0.2, 1)',
            visibility: drawer ? 'visible' : 'hidden',
          }}
        >
          {switcher}
          <YStack flex={1} minW={0}>
            {column}
          </YStack>
        </XStack>
      </YStack>
    </View>
  )
}
