'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Clock,
  Plus,
  Bot,
  Video,
  ExternalLink,
  Zap,
  Trash2,
  X,
} from 'lucide-react'
import { phrase, type Say } from '@hanzo/i18n'
import { Text, View, XStack, YStack } from '@hanzo/gui'
import { Button, Popover, PopoverContent, PopoverTrigger, toast } from '@hanzo/ui'
import { useI18n } from '@hanzo/i18n/react'
import { useDevMode } from './lib/dev-mode'

export interface CalendarEvent {
  id: string
  title: string
  type: 'meeting' | 'bot_automation' | 'agent_query'
  date: string // YYYY-MM-DD
  time: string // HH:MM
  duration: string // e.g. "30m"
  botName?: string
  meetUrl?: string
  description?: string
  devDescription?: string
  cronPattern?: string
  status: 'scheduled' | 'running' | 'completed'
}

const LEGACY_PORT_DESCRIPTION = 'Sync on port 9005 drive server performance and ingress routing.'
const PLAIN_SYNC_DESCRIPTION = phrase('Sync on file storage performance and traffic routing.')

const DEFAULT_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-1',
    title: phrase('Daily morning AI intelligence digest'),
    type: 'bot_automation',
    date: '2026-09-04',
    time: '09:00',
    duration: phrase('15m'),
    botName: 'Chief',
    cronPattern: '0 9 * * 1-5',
    description: phrase('Collect frontier AI papers, benchmark shifts, and pull requests into team channels.'),
    status: 'scheduled',
  },
  {
    id: 'evt-3',
    title: phrase('Autonomous outbound prospecting run'),
    type: 'bot_automation',
    date: '2026-09-04',
    time: '11:00',
    duration: phrase('60m'),
    botName: 'Sales Outbound',
    cronPattern: '0 11 * * 1-5',
    description: phrase('Find 50 lookalike enterprise leads and prepare personalized outreach drafts.'),
    status: 'scheduled',
  },
  {
    id: 'evt-4',
    title: phrase('Hourly GitHub PR and typecheck review'),
    type: 'agent_query',
    date: '2026-09-04',
    time: '14:00',
    duration: phrase('20m'),
    botName: 'Hanzo Coder',
    cronPattern: '0 * * * *',
    description: phrase('Verify type safety and lint across open pull requests in the organization.'),
    status: 'scheduled',
  },
  {
    id: 'evt-2',
    title: phrase('Platform architecture and inference sync'),
    type: 'meeting',
    date: '2026-09-04',
    time: '18:00',
    duration: phrase('45m'),
    meetUrl: 'https://meet.hanzo.ai/platform-architecture',
    botName: 'Hanzo Coder (Bot Co-pilot)',
    description: PLAIN_SYNC_DESCRIPTION,
    devDescription: phrase(LEGACY_PORT_DESCRIPTION),
    status: 'scheduled',
  },
  {
    id: 'evt-5',
    title: phrase('Research review'),
    type: 'meeting',
    date: '2026-09-04',
    time: '20:00',
    duration: phrase('60m'),
    meetUrl: 'https://meet.hanzo.ai/research-review',
    botName: 'Hanzo Researcher',
    description: phrase('Review datasets and proofs for the week’s research runs.'),
    status: 'scheduled',
  },
]

/** Format a 24h clock pair into plain English (e.g. `9:00 AM`). */
function formatHourMinute(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  const mm = String(minute).padStart(2, '0')
  return `${h12}:${mm} ${period}`
}

/** Human-readable schedule phrase for common 5-field cron patterns when Developer mode is off. */
function humanizeCron(pattern: string, t: Say): string {
  const parts = pattern.trim().split(/\s+/)
  if (parts.length !== 5) return t('Recurring schedule')
  const [min, hour, dom, mon, dow] = parts
  if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return t('Every hour')
  }
  const everyMin = /^\*\/(\d+)$/.exec(min)
  if (everyMin && hour === '*' && dom === '*' && mon === '*' && dow === '*') {
    return t('Every {n} minutes', { n: everyMin[1] })
  }
  const mNum = Number(min)
  const hNum = Number(hour)
  if (Number.isInteger(mNum) && Number.isInteger(hNum) && dom === '*' && mon === '*') {
    const time = formatHourMinute(hNum, mNum)
    if (dow === '1-5') return t('Weekdays · {time}', { time })
    if (dow === '*') return t('Daily · {time}', { time })
  }
  return t('Recurring schedule')
}

/** The public booking pages, one card each on the Booker tab. */
const BOOKINGS = [
  {
    title: phrase('Quick sync'),
    duration: phrase('15m'),
    slug: '15min',
    description: phrase('Fast 15-minute alignment or triage call on Hanzo Meet.'),
  },
  {
    title: phrase('Technical deep dive'),
    duration: phrase('30m'),
    slug: '30min',
    description: phrase('In-depth architectural review, bug diagnosis, or sprint planning.'),
  },
  {
    title: phrase('AI pair programming'),
    duration: phrase('45m'),
    slug: 'pair-ai',
    description: phrase('Interactive coding session with Hanzo Coder assisting in the terminal.'),
  },
  {
    title: phrase('Executive and strategy sync'),
    duration: phrase('60m'),
    slug: '60min',
    description: phrase('Quarterly roadmap sync, partnerships, and leadership decision forum.'),
  },
] as const

/** Demo titles and descriptions. A reader's own event is drawn as they wrote it. */
const AUTHORED = new Set<string>(
  DEFAULT_EVENTS.flatMap((event) =>
    [event.title, event.description, event.devDescription].filter((line): line is string => Boolean(line)),
  ),
)

const TYPE_LABEL: Record<CalendarEvent['type'], string> = {
  meeting: phrase('Meeting'),
  bot_automation: phrase('Bot automation'),
  agent_query: phrase('Agent query'),
}

/** A bot's label. Names stay as written; a role this screen authors is translated. */
function botLabel(name: string, t: Say): string {
  switch (name) {
    case 'Sales Outbound':
      return t('Sales Outbound')
    case 'Inbox Manager':
      return t('Inbox Manager')
    case 'Account Manager':
      return t('Account Manager')
    case 'Talent Scout':
      return t('Talent Scout')
    case 'Expense Manager':
      return t('Expense Manager')
    case 'Offsite crew':
      return t('Offsite crew')
    case 'Hanzo Coder (Bot Co-pilot)':
      return t('{name} (Bot Co-pilot)', { name: 'Hanzo Coder' })
    default:
      return name
  }
}

/** design's smallest rung (`--text-floor`, 10px), below gui's `$1`; gui's font size takes a rung or a number. */
const FLOOR = 11 // minimum readable badge size (11px)
const MODAL = 'var(--z-modal)'
/** One field of the dialog: the box every input, select and textarea in it draws. */
const FIELD = {
  width: '100%',
  py: 8,
  bg: '$background',
  borderWidth: 1,
  borderColor: 'var(--border-strong)',
  rounded: 6,
  color: '$ink',
  fontSize: '$2',
} as const
/** A dialog label. */
const LABEL = { render: 'label', fontSize: '$1', color: '$soft', mb: 4, display: 'block' } as const

const FOCUS_RING = { outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' } as const

/** Monochrome Popover selector — replaces native OS `<select>` menus inside the scheduler modal. */
function MonoSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  slotName,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
  slotName: string
}) {
  const [open, setOpen] = useState(false)
  const [triggerW, setTriggerW] = useState(0)
  const triggerRef = useRef<HTMLElement | null>(null)

  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus?.())
  }, [])

  useEffect(() => {
    const el = triggerRef.current
    if (!el) return
    const measure = () => {
      const next = Math.round(el.getBoundingClientRect().width)
      setTriggerW((prev) => (prev === next ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  const selected = options.find((o) => o.value === value) ?? options[0]

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-start" allowFlip stayInFrame>
      <PopoverTrigger asChild disablePressTrigger>
        <XStack
          ref={(node: unknown) => {
            triggerRef.current = (node as HTMLElement | null) ?? null
          }}
          render={<button type="button" />}
          onClick={() => setOpen((prev) => !prev)}
          data-slot={slotName}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          width="100%"
          minH={38}
          $max-sm={{ minH: 44 }}
          px={12}
          py={8}
          bg="$background"
          borderWidth={1}
          borderColor="var(--border-strong)"
          rounded={6}
          items="center"
          justify="space-between"
          gap={8}
          cursor="pointer"
          hoverStyle={{ bg: '$hover' }}
          focusVisibleStyle={FOCUS_RING}
        >
          <Text fontSize="$2" color="$ink" numberOfLines={1} flex={1} minW={0} text="start">
            {selected?.label ?? ''}
          </Text>
          <ChevronDown size={14} color="var(--muted-foreground)" aria-hidden />
        </XStack>
      </PopoverTrigger>
      <PopoverContent
        solid
        data-slot={`${slotName}-menu`}
        bg="var(--popover)"
        borderWidth={1}
        borderColor="var(--border-strong)"
        boxShadow="var(--shadow-floating)"
        rounded="$4"
        p="$1.5"
        width={triggerW > 0 ? triggerW : 320}
        maxW="calc(100vw - 48px)"
        maxH={260}
        overflowY="auto"
        z="var(--z-popover)"
        onCloseAutoFocus={(e: Event) => {
          e.preventDefault()
          triggerRef.current?.focus?.()
        }}
        onKeyDown={(e: { key?: string; preventDefault?: () => void; stopPropagation?: () => void }) => {
          if (e.key === 'Escape') {
            e.preventDefault?.()
            e.stopPropagation?.()
            close(true)
          }
        }}
      >
        <YStack role={'listbox' as never} aria-label={label} gap={2}>
          {options.map((opt) => {
            const active = opt.value === value
            return (
              <XStack
                key={opt.value}
                render={<button type="button" />}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value)
                  close(true)
                }}
                width="100%"
                minH={36}
                $max-sm={{ minH: 44 }}
                px={10}
                py={8}
                rounded={8}
                borderWidth={1}
                borderColor={active ? 'var(--border-strong)' : 'transparent'}
                bg={active ? '$panel' : 'transparent'}
                items="center"
                justify="space-between"
                gap={8}
                cursor="pointer"
                hoverStyle={{ bg: '$hover', borderColor: 'var(--border-strong)' }}
                focusVisibleStyle={FOCUS_RING}
              >
                <Text fontSize="$2" fontWeight={active ? '600' : '400'} color="$ink" numberOfLines={1} flex={1} minW={0} text="start">
                  {opt.label}
                </Text>
                {active ? <Check size={14} color="var(--foreground)" aria-hidden /> : null}
              </XStack>
            )
          })}
        </YStack>
      </PopoverContent>
    </Popover>
  )
}

export function CalScheduler() {
  const { t, locale } = useI18n()
  const [devMode] = useDevMode()
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('hanzo_calendar_events_v1')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) return parsed
        }
      } catch {}
    }
    return DEFAULT_EVENTS
  })

  const [activeTab, setActiveTab] = useState<'scheduler' | 'booker' | 'automations'>('scheduler')
  const [filterType, setFilterType] = useState<'all' | 'meeting' | 'bot_automation' | 'agent_query'>('all')
  const [showModal, setShowModal] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'bot_automation' as 'meeting' | 'bot_automation' | 'agent_query',
    date: '2026-09-04',
    time: '10:00',
    duration: '30m',
    botName: 'Chief',
    description: '',
  })

  useEffect(() => {
    try {
      localStorage.setItem('hanzo_calendar_events_v1', JSON.stringify(events))
    } catch {}
  }, [events])

  useEffect(() => {
    if (activeTab === 'automations' && filterType === 'meeting') {
      setFilterType('all')
    }
  }, [activeTab, filterType])

  useEffect(() => {
    if (!showModal) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowModal(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showModal])

  const filteredEvents = [...events]
    .filter((e) => {
      if (activeTab === 'automations' && e.type === 'meeting') return false
      if (filterType === 'all') return true
      return e.type === filterType
    })
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEvent.title.trim()) return

    const created: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: newEvent.title.trim(),
      type: newEvent.type,
      date: newEvent.date,
      time: newEvent.time,
      duration: newEvent.duration,
      botName: newEvent.botName,
      description: newEvent.description,
      meetUrl:
        newEvent.type === 'meeting'
          ? `https://meet.hanzo.ai/${newEvent.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
          : undefined,
      status: 'scheduled',
    }

    setEvents((prev) => [created, ...prev])
    setShowModal(false)
    setNewEvent({
      title: '',
      type: 'bot_automation',
      date: '2026-09-04',
      time: '10:00',
      duration: '30m',
      botName: 'Chief',
      description: '',
    })
  }

  const deletedRef = useRef<Map<string, CalendarEvent>>(new Map())

  const handleDeleteEvent = (id: string) => {
    const target = events.find((e) => e.id === id)
    if (!target) return
    const snapshot: CalendarEvent = { ...target }
    deletedRef.current.set(snapshot.id, snapshot)
    setEvents((prev) => prev.filter((e) => e.id !== id))
    const label = AUTHORED.has(snapshot.title) ? t(snapshot.title) : snapshot.title
    toast(t('Removed “{title}”', { title: label }), {
      id: `hanzo:cal-delete:${snapshot.id}`,
      duration: 5000,
      action: {
        label: t('Undo'),
        onClick: () => {
          const restored = deletedRef.current.get(snapshot.id) ?? snapshot
          deletedRef.current.delete(snapshot.id)
          setEvents((prev) => (prev.some((e) => e.id === restored.id) ? prev : [...prev, restored]))
        },
      },
      onAutoClose: () => {
        deletedRef.current.delete(snapshot.id)
      },
      onDismiss: () => {
        deletedRef.current.delete(snapshot.id)
      },
    })
  }

  return (
    <YStack width="100%" height="100%" bg="$background" overflowX="hidden" overflowY="auto">
      {/* Top Header: one row from a laptop; on a phone the controls wrap under the title rather than clip it. */}
      <XStack
        minH={56}
        px={24}
        py={10}
        gap={10}
        flexWrap="wrap"
        bg="$panel"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
        items="center"
        justify="space-between"
        $max-sm={{ px: 16 }}
      >
        {/* Every part of this bar gives way on a phone, as a block box would: shrinking, never below its content. */}
        <XStack items="center" gap={12} shrink={1} minW={0}>
          <XStack width={32} height={32} rounded={8} bg="$raised" items="center" justify="center" shrink={0}>
            <CalendarIcon size={18} color="var(--foreground)" />
          </XStack>
          <YStack shrink={1} minW={0}>
            <XStack items="center" gap={8} flexWrap="wrap">
              <Text fontSize="$4" fontWeight="700" color="$ink">{t('Calendar & scheduler')}</Text>
              <Text
                fontSize={FLOOR}
                fontWeight="600"
                bg="$hover"
                color="$soft"
                borderWidth={1}
                borderColor="$borderColor"
                px={6}
                py={1}
                rounded={4}
              >
                cal.hanzo.ai
              </Text>
            </XStack>
            <Text fontSize="$1" color="$soft">
              {devMode
                ? t('Unified scheduler across meetings, bot routines, automated crons, and query triggers')
                : t('Unified schedule for meetings, bot routines, and recurring tasks')}
            </Text>
          </YStack>
        </XStack>

        <XStack items="center" gap={10} shrink={1} minW={0} flexWrap="wrap">
          <XStack
            items="center"
            gap={2}
            bg="$hover"
            rounded={8}
            p={2}
            borderWidth={1}
            borderColor="var(--border-strong)"
            shrink={1}
            minW={0}
            flexWrap="wrap"
          >
            {[
              { id: 'scheduler', label: t('Master schedule') },
              { id: 'automations', label: devMode ? t('Bot crons') : t('Bot routines') },
              { id: 'booker', label: t('Public booking') },
            ].map((tab) => (
              <Button
                key={tab.id}
                size="sm"
                variant={activeTab === tab.id ? 'primary' : 'ghost'}
                {...(activeTab === tab.id ? null : { color: '$soft' })}
                aria-pressed={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id as any)}
              >
                {tab.label}
              </Button>
            ))}
          </XStack>

          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
            <Plus size={14} />
            {t('Schedule event')}
          </Button>
        </XStack>
      </XStack>

      {/* Main Content Area */}
      {activeTab === 'booker' ? (
        /* Embed of cal.hanzo.ai Booker or Native Event Types */
        <YStack flex={1} p={28} $max-sm={{ p: 16 }} overflowY="auto" overflowX="hidden" gap={20}>
          <YStack gap={4}>
            <Text fontSize="$7" fontWeight="800" color="$ink">{t('Public booking pages')}</Text>
            <Text fontSize="$2" color="$soft">
              {t('Shareable links powered by {link}. Allows teammates, clients, and agents to book dedicated time slots.', {
                link: (
                  <Text
                    render={<a href="https://cal.hanzo.ai" target="_blank" rel="noopener noreferrer" />}
                    color="$ink"
                    textDecorationLine="none"
                  >
                    cal.hanzo.ai
                  </Text>
                ),
              })}
            </Text>
          </YStack>

          <View display="grid" gridTemplateColumns="repeat(auto-fill, minmax(min(280px, 100%), 1fr))" gap={16}>
            {BOOKINGS.map((card) => (
              <YStack
                key={card.slug}
                bg="$panel"
                borderWidth={1}
                borderColor="$borderColor"
                rounded={10}
                p={18}
                gap={12}
                minW={0}
              >
                <XStack items="center" justify="space-between" gap={8}>
                  <Text fontSize="$4" fontWeight="700" color="$ink" flex={1} minW={0}>
                    {t(card.title)}
                  </Text>
                  <Text fontSize="$1" fontWeight="600" bg="$hover" px={8} py={2} rounded={4} color="$soft" shrink={0}>
                    {t(card.duration)}
                  </Text>
                </XStack>

                <Text fontSize="$2" color="$soft" lineHeight="$2">
                  {t(card.description)}
                </Text>

                <Text px={10} py={8} bg="$sunken" rounded={6} fontSize="$1" fontFamily="$mono" color="$soft" numberOfLines={1}>
                  https://cal.hanzo.ai/alex/{card.slug}
                </Text>

                <XStack gap={8} mt={4}>
                  <Button
                    size="sm"
                    flex={1}
                    $max-sm={{ minH: 44 }}
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(`https://cal.hanzo.ai/alex/${card.slug}`)
                        .then(() => toast.success(t('Link copied')))
                        .catch(() => toast.error(t('Could not copy link.')))
                    }}
                  >
                    {t('Copy link')}
                  </Button>
                  <Button asChild variant="primary" size="sm">
                    <a href={`https://cal.hanzo.ai/alex/${card.slug}`} target="_blank" rel="noopener noreferrer">
                      {t('Open')}
                      <ExternalLink size={12} />
                    </a>
                  </Button>
                </XStack>
              </YStack>
            ))}
          </View>
        </YStack>
      ) : (
        /* Master Schedule & Automations Grid */
        <YStack flex={1} minH={0} overflow="hidden">
          {/* Subheader Filters */}
          <XStack
            px={24}
            py={12}
            $max-sm={{ px: 16 }}
            bg="$panel"
            borderBottomWidth={1}
            borderBottomColor="$borderColor"
            items="center"
            justify="space-between"
            flexWrap="wrap"
            gap={8}
          >
            <XStack items="center" gap={6} shrink={1} minW={0} flexWrap="wrap">
              <Text fontSize="$2" fontWeight="600" color="$soft">{t('Filter:')}</Text>
              {/* The kinds wear the same monochrome glyphs their event tiles do, never a colour emoji. */}
              {([
                { id: 'all', label: t('All items') },
                { id: 'meeting', label: t('Meetings'), icon: Video },
                { id: 'bot_automation', label: t('Bot routines'), icon: Bot },
                { id: 'agent_query', label: t('Agent queries'), icon: Zap },
              ] as const).filter((f) => !(activeTab === 'automations' && f.id === 'meeting')).map((f) => (
                <Button
                  key={f.id}
                  size="sm"
                  variant={filterType === f.id ? 'secondary' : 'ghost'}
                  color={filterType === f.id ? '$ink' : '$soft'}
                  aria-pressed={filterType === f.id}
                  onClick={() => setFilterType(f.id as any)}
                >
                  {'icon' in f ? <f.icon size={13} aria-hidden /> : null}
                  {f.label}
                </Button>
              ))}
            </XStack>

            <Text fontSize="$1" color="$faint">
              {t('Showing {count} scheduled items', {
                count: filteredEvents.length.toLocaleString(locale),
              })}
            </Text>
          </XStack>

          {/* Schedule List */}
          <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden" px={24} py={20} $max-sm={{ px: 16, py: 16 }} gap={10}>
            {filteredEvents.length === 0 ? (
              <YStack items="center" justify="center" gap={10} px={20} py={48}>
                <Text fontSize="$3" fontWeight="600" color="$ink" text="center">
                  {filterType !== 'all' ? t('No matching schedule items') : t('Nothing scheduled yet')}
                </Text>
                <Text fontSize="$2" color="$soft" text="center" maxW={360}>
                  {filterType !== 'all'
                    ? t('Try switching or clearing the active filter to view all scheduled items.')
                    : t('Add a meeting, bot routine, or agent query to get started.')}
                </Text>
                {filterType !== 'all' ? (
                  <Button size="sm" variant="outline" focusVisibleStyle={FOCUS_RING} $max-sm={{ minH: 44 }} onClick={() => setFilterType('all')}>
                    {t('Clear filter')}
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" focusVisibleStyle={FOCUS_RING} $max-sm={{ minH: 44 }} onClick={() => setShowModal(true)}>
                    {t('Schedule')}
                  </Button>
                )}
              </YStack>
            ) : filteredEvents.map((evt) => {
              const isMeeting = evt.type === 'meeting'
              const isAutomation = evt.type === 'bot_automation'
              const rawDescription = devMode
                ? (evt.devDescription ?? evt.description)
                : evt.description === LEGACY_PORT_DESCRIPTION
                  ? PLAIN_SYNC_DESCRIPTION
                  : evt.description

              return (
                <XStack
                  key={evt.id}
                  bg="$panel"
                  borderWidth={1}
                  borderColor="$borderColor"
                  rounded={10}
                  px={20}
                  py={16}
                  items="center"
                  justify="space-between"
                  flexWrap="wrap"
                  gap={16}
                  minW={0}
                  $max-md={{
                    flexDirection: 'column',
                    items: 'stretch',
                    px: 16,
                    py: 14,
                    gap: 12,
                  }}
                >
                  {/* Left Icon & Time */}
                  <XStack items="center" gap={12} minW={170} shrink={0} $max-md={{ minW: 0, width: '100%' }}>
                    <XStack
                      width={40}
                      height={40}
                      rounded={8}
                      bg="$raised"
                      items="center"
                      justify="center"
                      shrink={0}
                    >
                      {isMeeting ? <Video size={20} color="var(--foreground)" /> : isAutomation ? <Bot size={20} color="var(--foreground)" /> : <Zap size={20} color="var(--foreground)" />}
                    </XStack>

                    <YStack shrink={1} minW={0}>
                      <Text fontSize="$3" fontWeight="700" color="$ink" fontFamily="$mono">
                        {evt.time}
                      </Text>
                      <Text fontSize="$1" color="$faint">
                        {t('{date} · {duration}', { date: evt.date, duration: t(evt.duration) })}
                      </Text>
                    </YStack>
                  </XStack>

                  {/* Middle: Title & Details */}
                  <YStack flex={1} minW={0} $md={{ minW: 240 }} gap={4}>
                    <XStack items="center" gap={8} flexWrap="wrap">
                      <Text fontSize="$3" fontWeight="600" color="$ink" shrink={1} minW={0}>
                        {AUTHORED.has(evt.title) ? t(evt.title) : evt.title}
                      </Text>
                      <Text
                        fontSize="$1"
                        fontWeight="500"
                        bg="$hover"
                        color="$soft"
                        borderWidth={1}
                        borderColor="$borderColor"
                        px={8}
                        py={1}
                        rounded={4}
                        shrink={0}
                      >
                        {t(TYPE_LABEL[evt.type])}
                      </Text>
                    </XStack>

                    {rawDescription ? (
                      <Text display="block" fontSize="$2" color="$soft">
                        {AUTHORED.has(rawDescription) ? t(rawDescription) : rawDescription}
                      </Text>
                    ) : null}

                    <XStack items="center" gap={10} flexWrap="wrap" pt={2}>
                      {evt.botName ? (
                        <Text fontSize="$1" color="$faint">
                          {t('Bot: {name}', {
                            name: (
                              <Text render="strong" fontSize="$1" color="$quiet">
                                {botLabel(evt.botName, t)}
                              </Text>
                            ),
                          })}
                        </Text>
                      ) : null}
                      {evt.cronPattern ? (
                        devMode ? (
                          <Text fontSize="$1" color="$faint">
                            {t('Cron: {pattern}', {
                              pattern: (
                                <Text render="code" fontFamily="$mono" color="$ink">
                                  {evt.cronPattern}
                                </Text>
                              ),
                            })}
                          </Text>
                        ) : (
                          <Text fontSize="$1" color="$faint">
                            {t('Schedule: {label}', {
                              label: (
                                <Text fontSize="$1" color="$quiet">
                                  {humanizeCron(evt.cronPattern, t)}
                                </Text>
                              ),
                            })}
                          </Text>
                        )
                      ) : null}
                      {evt.meetUrl && devMode ? (
                        <Text fontSize="$1" color="$faint" numberOfLines={1}>
                          {t('Link: {url}', {
                            url: (
                              <Text render="code" fontFamily="$mono" color="$ink">
                                {evt.meetUrl}
                              </Text>
                            ),
                          })}
                        </Text>
                      ) : null}
                    </XStack>
                  </YStack>

                  {/* Right Actions */}
                  <XStack
                    items="center"
                    gap={8}
                    shrink={0}
                    $max-md={{ width: '100%', justify: 'space-between', pt: 4, borderTopWidth: 1, borderTopColor: '$borderColor' }}
                  >
                    {isMeeting ? (
                      <Button asChild variant="primary" size="sm">
                        <a href="/meet">
                          <Video size={13} />
                          {t('Join meeting')}
                        </a>
                      </Button>
                    ) : (
                      <Button asChild variant="primary" size="sm">
                        <a href="/bots">
                          <Bot size={13} />
                          {t('View bots')}
                        </a>
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      color="$soft"
                      $max-sm={{ minW: 44, minH: 44 }}
                      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
                      onClick={() => handleDeleteEvent(evt.id)}
                      aria-label={t('Remove schedule')}
                      title={t('Remove schedule')}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </XStack>
                </XStack>
              )
            })}
          </YStack>
        </YStack>
      )}

      {/* New Event / Routine Modal */}
      {showModal ? (
        <XStack
          position="fixed"
          inset={0}
          bg="var(--surface-scrim)"
          backdropFilter="blur(8px)"
          items="center"
          justify="center"
          p={16}
          z={MODAL}
          onClick={(e: { target?: unknown; currentTarget?: unknown }) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <YStack
            role="dialog"
            aria-modal
            aria-label={t('Schedule event or routine')}
            width="100%"
            maxW={460}
            maxH="90dvh"
            overflowY="auto"
            bg="var(--popover)"
            borderWidth={1}
            borderColor="var(--border-strong)"
            rounded={12}
            p={24}
            $max-sm={{ p: 16 }}
            gap={16}
            boxShadow="var(--shadow-floating)"
            onClick={(e: { stopPropagation?: () => void }) => e.stopPropagation?.()}
          >
            <XStack items="center" justify="space-between">
              <Text fontSize="$4" fontWeight="700" color="$ink">
                {t('Schedule event or routine')}
              </Text>
              <Button type="button" variant="ghost" size="icon-sm" mr={-8} onClick={() => setShowModal(false)} aria-label={t('Close')}>
                <X size={16} aria-hidden />
              </Button>
            </XStack>

            <YStack render="form" {...{ onSubmit: handleCreateEvent }} gap={12}>
              <View display="block">
                <Text {...LABEL}>
                  {t('Title')}
                </Text>
                <Text
                  render={
                    <input
                      type="text"
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      placeholder={t('e.g. Daily security audit or team sync')}
                      required
                    />
                  }
                  {...FIELD}
                  px={12}
                />
              </View>

              <View display="block">
                <Text {...LABEL}>
                  {t('Schedule type')}
                </Text>
                <MonoSelect
                  slotName="cal-schedule-type-select"
                  label={t('Schedule type')}
                  value={newEvent.type}
                  onChange={(next) => setNewEvent({ ...newEvent, type: next })}
                  options={[
                    { value: 'bot_automation', label: t('Automated bot routine') },
                    { value: 'meeting', label: t('Video meeting') },
                    { value: 'agent_query', label: t('Recurring agent query') },
                  ]}
                />
              </View>

              <View display="grid" gridTemplateColumns="1fr 1fr" gap={10}>
                <View display="block">
                  <Text {...LABEL}>
                    {t('Date')}
                  </Text>
                  <Text
                    render={<input type="date" value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} />}
                    {...FIELD}
                    px={8}
                  />
                </View>
                <View display="block">
                  <Text {...LABEL}>
                    {t('Time')}
                  </Text>
                  <Text
                    render={<input type="time" value={newEvent.time} onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })} />}
                    {...FIELD}
                    px={8}
                  />
                </View>
              </View>

              <View display="block">
                <Text {...LABEL}>
                  {t('Assigned bot')}
                </Text>
                <MonoSelect
                  slotName="cal-assigned-bot-select"
                  label={t('Assigned bot')}
                  value={newEvent.botName}
                  onChange={(next) => setNewEvent({ ...newEvent, botName: next })}
                  options={[
                    { value: 'Chief', label: 'Chief' },
                    { value: 'Sales Outbound', label: t('Sales Outbound') },
                    { value: 'Inbox Manager', label: t('Inbox Manager') },
                    { value: 'Account Manager', label: t('Account Manager') },
                    { value: 'Talent Scout', label: t('Talent Scout') },
                    { value: 'Expense Manager', label: t('Expense Manager') },
                    { value: 'Offsite crew', label: t('Offsite crew') },
                  ]}
                />
              </View>

              <View display="block">
                <Text {...LABEL}>
                  {t('Description')}
                </Text>
                <Text
                  render={
                    <textarea
                      value={newEvent.description}
                      onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                      placeholder={t('Details or instructions…')}
                      rows={3}
                    />
                  }
                  {...FIELD}
                  px={12}
                  // design's base sheet makes every textarea resizable; gui types no `resize`.
                  $platform-web={{ resize: 'none' }}
                />
              </View>

              <XStack justify="flex-end" gap={8} mt={8}>
                <Button type="button" onClick={() => setShowModal(false)}>
                  {t('Cancel')}
                </Button>
                <Button type="submit" variant="primary">
                  {t('Save schedule')}
                </Button>
              </XStack>
            </YStack>
          </YStack>
        </XStack>
      ) : null}
    </YStack>
  )
}
