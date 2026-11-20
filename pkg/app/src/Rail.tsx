'use client'

// Folded left navigation rail (52px icons-only, shown when the unified sidebar
// is folded, plus the compact phone drawer rail):
// - Shared `useNavEntries()` model keeps Hanzo's exact product names & order
//   (`Chat`, `Dev`, `Design`, `Studio` if opened, `Library`, `Scheduled tasks`,
//   `Customize`, `Tabs`, `Betas`, and every hosted app or beta the reader may open;
//   Developer mode hides none of them) across both the unified Sidebar and the 52px folded Rail.
// - Strictly monochrome active chrome (`bg="$raised"`, `color="$ink"`).
// - Every `render="button"` element uses `onClick` (never `onPress`).

import { useI18n } from '@hanzo/i18n/react'
import {
  Bot,
  CircleHelp,
  Compass,
  Ellipsis,
  FlaskConical,
  PanelLeft,
  PanelLeftOpen,
  Plus,
  Settings,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react'
import { useState, type DragEvent, type ReactNode } from 'react'
import { XStack, YStack, Text } from '@hanzo/gui'
import { MARKS, route, type Host } from '@hanzo/build'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@hanzo/ui'
import { SidebarItem } from '@hanzo/ui/chat'
import { MoreMenu } from './MoreMenu'
import { BetasDialog, useBetas } from './Betas'
import { out } from './help'
import { BETAS } from './lib/betas'
import { HOSTED_APPS } from './lib/hosted'
import { Account } from './Account'
import { useDevMode } from './lib/dev-mode'
import { usePref } from './pref'
import { HEAD, MARK, TOUCH_HEAD } from './ground'
import { apex, app, design, flow, hosted, studio, talk, TERMINALS, WORKSPACE, type Place } from './lib/host'
import { site } from './where'

export { MARK }

export const RAIL_FOLDED = 52

/** A mark on a touch screen, px: a thumb's 44. */
const TOUCH = 44

/** Where an earlier version kept the menu (the five apps, then the reader's pins), on the account. Read once, to carry those pins over. */
export const NAV_PINNED_KEY = 'hanzo.nav.pinned'
/** Where the reader's pins are kept, on the account (`usePref`), so they follow them to every device: only what they pinned, in their order. */
export const NAV_PINS_KEY = 'hanzo.nav.pins'

/** The menu as it stands when nothing is pinned, in its order: each app's default place. */
export const DEFAULT_NAV: readonly string[] = ['chat', 'dev', 'design', 'library', 'tabs']
/** The old name of `DEFAULT_NAV`, for importers that still read it. */
export const DEFAULT_PINNED_NAV = DEFAULT_NAV

const CORE_NAV_SET = new Set<string>(DEFAULT_NAV)

/** The reader's pins, each once, in their order. */
export function cleanPinnedNav(list: readonly unknown[]): string[] {
  return [...new Set(list.filter((id): id is string => typeof id === 'string' && id.length > 0))]
}

/**
 * The pins an earlier version kept (`NAV_PINNED_KEY`: the five apps, then what the reader pinned from More): the ones
 * pinned from More stay pinned, and the five go back to their default places.
 */
export function carriedPinnedNav(list: unknown): string[] {
  return Array.isArray(list) ? cleanPinnedNav(list).filter((id) => !CORE_NAV_SET.has(id)) : []
}

/** `list` with `id` pinned (to the end of the pins, so at the top of the menu, under the ones pinned before it) or unpinned (back to its default place). */
export function toggledPinnedNav(list: readonly string[], id: string): string[] {
  const pins = cleanPinnedNav(list)
  if (!id) return pins
  return pins.includes(id) ? pins.filter((item) => item !== id) : [...pins, id]
}

/** `list` with `sourceId` moved to where `targetId` stands, pinning it on the way when it was not; `targetId` not pinned puts it last. */
export function reorderedPinnedNav(list: readonly string[], sourceId: string, targetId: string): string[] {
  const pins = cleanPinnedNav(list)
  if (!sourceId || sourceId === targetId) return pins
  const without = pins.filter((id) => id !== sourceId)
  const at = without.indexOf(targetId)
  without.splice(at < 0 ? without.length : at, 0, sourceId)
  return without
}

/** What `usePinnedNav` answers, held once by the surface and handed to the Rail, the Sidebar and the context menu, so a pin made in one is in the others. */
export type Pins = ReturnType<typeof usePinnedNav>

/** `list` with `id` swapped with its neighbour one place up (-1) or down (1) among `visible`, the pins the reader sees (one may be hidden): the keyboard's way to the order a drag makes. */
export function shiftedPinnedNav(list: readonly string[], id: string, delta: -1 | 1, visible: readonly string[] = list): string[] {
  const next = cleanPinnedNav(list)
  const other = visible[visible.indexOf(id) + delta]
  const from = next.indexOf(id)
  const to = other === undefined ? -1 : next.indexOf(other)
  if (from < 0 || to < 0) return next
  ;[next[from], next[to]] = [next[to]!, next[from]!]
  return next
}

/**
 * The reader's pins, a toggle for one, a reorder and a move, kept on the account. Pins stand at the top of the menu in
 * the reader's order; everything else keeps its default place (`DEFAULT_NAV`, then More). Until the reader pins under
 * this version, the pins an earlier one kept carry over (`carriedPinnedNav`).
 */
export function usePinnedNav(): [string[], (id: string) => void, (sourceId: string, targetId: string) => void, (id: string, delta: -1 | 1, visible?: readonly string[]) => void] {
  const [earlier] = usePref<string[] | null>(NAV_PINNED_KEY, null)
  const [kept, keep] = usePref<string[] | null>(NAV_PINS_KEY, null)
  const pinned = Array.isArray(kept) ? cleanPinnedNav(kept) : carriedPinnedNav(earlier)
  return [pinned, (id) => keep(toggledPinnedNav(pinned, id)), (src, target) => keep(reorderedPinnedNav(pinned, src, target)), (id, delta, visible) => keep(shiftedPinnedNav(pinned, id, delta, visible))]
}

/** The places the rail holds beside the products, by the builder address each opens. */
export const RAISED = { library: '-/artifacts', scheduled: '-/automations', customize: '-/customize' } as const
export type Raised = keyof typeof RAISED

/** Which of them a builder address stands on, if any, and so takes the sidebar. */
export function raised(at: string | null): Raised | null {
  if (at === null) return null
  const r = route(at)
  if (r.kind === 'screen' && r.screen === 'artifacts') return 'library'
  if ((r.kind === 'screen' && r.screen === 'automations') || r.kind === 'automation') return 'scheduled'
  if (r.kind === 'customize' || r.kind === 'agent' || (r.kind === 'screen' && r.screen === 'mcp')) return 'customize'
  return null
}

export const fullNavUrl = (href: string): string => {
  if (/^https?:\/\//.test(href)) return href
  if (typeof window === 'undefined') return href
  return new URL(site(href), window.location.href).href
}

export interface NavEntry {
  id: string
  slot: string
  label: string
  href: string
  external?: boolean
  pinnable?: boolean
  on: boolean
  icon: ReactNode
  onPress: () => void
}

export function useNavEntries({
  host,
  mode,
  at,
  inside = null,
  onChat,
  onDev,
  onDesign,
  onStudio,
  onTabs,
  go,
  pins,
}: {
  host: Host
  mode: Place['mode']
  at: string | null
  inside?: string | null
  pins: Pins
  onChat: () => void
  onDev: () => void
  onDesign?: () => void
  onStudio: () => void
  onTabs: () => void
  go: (address: string) => void
}) {
  const { t } = useI18n()
  const [devMode] = useDevMode()
  const [pinnedIds, togglePin] = pins
  const { open: opened } = useBetas()

  const anon = host.person === null
  const here = mode === 'dev' ? raised(at) : null
  const to = (p: string) => () => go(app(p))
  const team = mode !== 'studio' && mode !== 'design'
  const rawGranted = BETAS.filter((b) => b.href && b.embed === undefined && b.id !== 'studio' && b.id !== 'flow' && opened(b.id))
  const rawApps = HOSTED_APPS.filter((a) => opened(a.id))
  const reach = (address: string) => (address.startsWith('/') ? go(address) : out(address))
  const pinnedSet = new Set(pinnedIds)
  // Everything Hanzo showed before stays reachable without Developer mode (unpinned ones sit in More).
  const apps = rawApps
  const granted = rawGranted
  const localTeamHref = typeof window !== 'undefined' && !apex(window.location.hostname) ? '/home' : WORKSPACE
  const localBotsHref = typeof window !== 'undefined' && !apex(window.location.hostname) ? '/bots' : 'https://hanzo.bot'

  const allEntries: NavEntry[] = [
    {
      id: 'chat',
      slot: 'rail-chat',
      label: t('Chat'),
      href: talk(),
      on: mode === 'chat',
      icon: <MARKS.chat.icon size={17} aria-hidden />,
      onPress: onChat,
    },
    {
      id: 'dev',
      slot: 'rail-dev',
      label: 'Dev',
      href: app(''),
      on: mode === 'dev' && !here,
      icon: <MARKS.dev.icon size={17} aria-hidden />,
      onPress: onDev,
    },
    ...(anon
      ? []
      : [
          {
            id: 'design',
            slot: 'rail-design',
            label: 'Design',
            href: design(''),
                  on: mode === 'design',
            icon: <MARKS.design.icon size={17} aria-hidden />,
            onPress: () => onDesign?.(),
          } satisfies NavEntry,
        ]),
    {
      id: 'library',
      slot: 'rail-library',
      label: t('Library'),
      href: app(RAISED.library),
      on: here === 'library',
      icon: <MARKS.library.icon size={17} aria-hidden />,
      onPress: to(RAISED.library),
    },
    ...(anon
      ? []
      : [
          {
            id: 'scheduled',
            slot: 'rail-scheduled',
            label: t('Scheduled tasks'),
            href: app(RAISED.scheduled),
            on: here === 'scheduled',
            icon: <MARKS.scheduled.icon size={17} aria-hidden />,
            onPress: to(RAISED.scheduled),
          } satisfies NavEntry,
          {
            id: 'customize',
            slot: 'rail-customize',
            label: t('Customize'),
            href: app(RAISED.customize),
            on: here === 'customize',
            icon: <MARKS.customize.icon size={17} aria-hidden />,
            onPress: to(RAISED.customize),
          } satisfies NavEntry,
          ...(opened('studio')
            ? [
                {
                  id: 'studio',
                  slot: 'rail-studio',
                  label: 'Studio',
                  href: studio(''),
                  on: mode === 'studio',
                  icon: <MARKS.studio.icon size={17} aria-hidden />,
                  onPress: onStudio,
                } satisfies NavEntry,
              ]
            : []),
          ...(opened('flow') || mode === 'flow'
            ? [
                {
                  id: 'flow',
                  slot: 'rail-flow',
                  label: 'Flow',
                  href: flow(''),
                  on: mode === 'flow',
                  icon: <Workflow size={17} aria-hidden />,
                  onPress: () => go(flow('')),
                } satisfies NavEntry,
              ]
            : []),
          {
            id: 'tabs',
            slot: 'rail-tabs',
            label: 'Tabs',
            href: TERMINALS,
                  on: mode === 'tabs',
            icon: <MARKS.tabs.icon size={17} aria-hidden />,
            onPress: onTabs,
          } satisfies NavEntry,
          {
            id: 'betas',
            slot: 'rail-betas',
            label: t('Betas'),
            href: '/beta',
            on: mode === 'beta',
            icon: <FlaskConical size={17} aria-hidden />,
            onPress: () => go('/beta'),
          } satisfies NavEntry,
          ...apps.map(
            (a): NavEntry => ({
              id: `app-${a.id}`,
              slot: `rail-app-${a.id}`,
              label: a.name,
              href: hosted(a.id),
              on: inside === a.id,
              icon: <a.icon size={17} aria-hidden />,
              onPress: () => go(hosted(a.id)),
            }),
          ),
        ]),
  ]

  const externalEntries: NavEntry[] =
    !anon && team
      ? [
          {
            id: 'ext-team',
            slot: 'rail-ext-team',
            label: 'Team',
            href: localTeamHref,
            external: localTeamHref.startsWith('http'),
            on: false,
            icon: <Users size={17} aria-hidden />,
            onPress: () => reach(localTeamHref),
          },
          {
            id: 'ext-bots',
            slot: 'rail-ext-bots',
            label: 'Bot',
            href: localBotsHref,
            external: localBotsHref.startsWith('http'),
            on: false,
            icon: <Bot size={17} aria-hidden />,
            onPress: () => reach(localBotsHref),
          },
          {
            id: 'ext-market',
            slot: 'rail-ext-market',
            label: t('Marketplace'),
            href: 'https://hanzo.market',
            external: true,
            on: false,
            icon: <Compass size={17} aria-hidden />,
            onPress: () => out('https://hanzo.market'),
          },
          ...granted.map(
            (b): NavEntry => ({
              id: `beta-${b.id}`,
              slot: `rail-beta-${b.id}`,
              label: b.name,
              href: b.href as string,
              external: !(b.href as string).startsWith('/'),
              on: false,
              icon: <Sparkles size={17} aria-hidden />,
              onPress: () => reach(b.href as string),
            }),
          ),
        ]
      : []

  const combinedById = new Map([...allEntries, ...externalEntries].map((item) => [item.id, item]))

  // Anonymous visitors see the public trio (Chat, Dev, Library), and pin nothing.
  // The reader's pins lead, in their order; the default apps follow in theirs; the rest is More.
  const pinnedEntries: NavEntry[] = anon
    ? []
    : pinnedIds.map((id) => combinedById.get(id)).filter((item): item is NavEntry => Boolean(item))
  const pinnedShown = new Set(pinnedEntries.map((item) => item.id))
  const defaultEntries: NavEntry[] = anon
    ? allEntries
    : DEFAULT_NAV.filter((id) => !pinnedShown.has(id))
        .map((id) => combinedById.get(id))
        .filter((item): item is NavEntry => Boolean(item))

  const shownInPrimary = new Set([...pinnedEntries, ...defaultEntries].map((item) => item.id))
  const moreEntries: NavEntry[] = anon
    ? []
    : [
        ...allEntries.filter((item) => !shownInPrimary.has(item.id)),
        ...externalEntries.filter((item) => !shownInPrimary.has(item.id)),
      ]

  return {
    anon,
    devMode,
    team,
    here,
    apps,
    granted,
    pinnedIds,
    pinnedSet,
    togglePin,
    allEntries,
    externalEntries,
    pinnedEntries,
    defaultEntries,
    moreEntries,
    shownInPrimary,
    reach,
  }
}

/** One mark: an icon button named for where it goes (`label`), with optional instant Tooltip when folded. */
export function Mark({
  label,
  on = false,
  tooltip = false,
  onPress,
  onClick,
  children,
  ...rest
}: {
  label: string
  /** The reader is there. */
  on?: boolean
  /** Render a styled Hanzo Tooltip when used in the folded icon rail. */
  tooltip?: boolean
  onPress?: () => void
  onClick?: () => void
  children: ReactNode
  [attribute: `data-${string}` | `aria-${string}`]: unknown
}) {
  const handleClick = onClick ?? onPress
  const button = (
    <XStack
      render="button"
      aria-label={label}
      {...(tooltip ? {} : ({ title: label } as object))}
      aria-current={on ? 'page' : undefined}
      onClick={handleClick}
      width={MARK}
      height={MARK}
      rounded={12}
      items="center"
      justify="center"
      shrink={0}
      cursor="pointer"
      opacity={on ? 1 : 0.76}
      bg={on ? '$raised' : 'transparent'}
      hoverStyle={{ bg: on ? '$raised' : '$hover', opacity: 1 }}
      pressStyle={{ bg: '$raised' }}
      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
      $touchable={{ width: TOUCH, height: TOUCH }}
      {...rest}
    >
      {children}
    </XStack>
  )

  if (!tooltip) return button

  return (
    <Tooltip placement="right" offset={8}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        maxW={240}
        px="$2.5"
        py="$1.5"
        rounded="$3"
        bg="var(--popover)"
        borderWidth={1}
        borderColor="$edge"
        z="var(--z-tooltip)"
      >
        <Text fontFamily="$body" fontSize="$1" fontWeight="500" color="$ink">
          {label}
        </Text>
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * A destination on the folded rail: its mark with its name under it, so the folded rail reads at a glance without a
 * hover (hanzo-inc/app issue 315). The name is small and one line; a long one ends in an ellipsis, and the tooltip says it whole.
 */
export function RailMark({
  label,
  on = false,
  onClick,
  children,
  ...rest
}: {
  label: string
  on?: boolean
  onClick?: () => void
  children: ReactNode
  [attribute: `data-${string}` | `aria-${string}`]: unknown
}) {
  return (
    <Tooltip placement="right" offset={8}>
      <TooltipTrigger asChild>
        <YStack
          render="button"
          aria-label={label}
          aria-current={on ? 'page' : undefined}
          onClick={onClick}
          width={RAIL_FOLDED - 6}
          minH={MARK + 6}
          px={2}
          py={5}
          gap={3}
          rounded={12}
          items="center"
          justify="center"
          shrink={0}
          cursor="pointer"
          bg={on ? '$raised' : 'transparent'}
          hoverStyle={{ bg: on ? '$raised' : '$hover' }}
          pressStyle={{ bg: '$raised' }}
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
          $touchable={{ minH: TOUCH + 8 }}
          {...rest}
        >
          <XStack width={20} height={20} items="center" justify="center" opacity={on ? 1 : 0.76}>
            {children}
          </XStack>
          <Text
            data-slot="rail-caption"
            aria-hidden
            maxW="100%"
            fontSize={10}
            lineHeight={12}
            fontWeight={on ? '600' : '400'}
            color={on ? '$ink' : '$aside'}
            numberOfLines={1}
            text="center"
          >
            {label}
          </Text>
        </YStack>
      </TooltipTrigger>
      <TooltipContent
        maxW={240}
        px="$2.5"
        py="$1.5"
        rounded="$3"
        bg="var(--popover)"
        borderWidth={1}
        borderColor="$edge"
        z="var(--z-tooltip)"
      >
        <Text fontFamily="$body" fontSize="$1" fontWeight="500" color="$ink">
          {label}
        </Text>
      </TooltipContent>
    </Tooltip>
  )
}

/** The sidebar's toggle: the same mark wherever a host draws it. */
export function Toggle({ open, onPress, label }: { open: boolean; onPress: () => void; label?: string }) {
  const { t } = useI18n()
  return (
    <Mark label={label ?? t(open ? 'Close sidebar' : 'Open sidebar')} data-slot="sidebar-toggle" aria-expanded={open} onClick={onPress}>
      <PanelLeft size={18} aria-hidden data-i18n-mirror />
    </Mark>
  )
}

export function Rail({
  host,
  mode,
  at,
  open,
  toggle,
  onOpen,
  onNew,
  compact = false,
  inside = null,
  onChat,
  onDev,
  onDesign,
  onStudio,
  onTabs,
  go,
  onOrg,
  pins,
}: {
  host: Host
  /** The pinned apps, held by the surface. */
  pins: Pins
  mode: Place['mode']
  /** Dev's builder address, or null outside Dev. */
  at: string | null
  /** The sidebar beside the rail is open. */
  open: boolean
  /** Lead with the sidebar's toggle; absent where the host's bar holds it. */
  toggle?: () => void
  /** Expand the folded rail back into the unified sidebar. */
  onOpen?: () => void
  /** Primary + New action when folded. */
  onNew?: () => void
  /** Force compact icons-only layout without expand header (e.g. inside narrow phone drawer). */
  compact?: boolean
  /** The hosted app (lib/hosted) the reader is in, if any. */
  inside?: string | null
  /** To Chat, Dev, Design and Studio, each where the reader left it. */
  onChat: () => void
  onDev: () => void
  onDesign?: () => void
  onStudio: () => void
  onTabs: () => void
  /** Moves the app to an address of this page. */
  go: (address: string) => void
  /** Work in another organization. */
  onOrg: (org: string) => void
}) {
  const { t, dir } = useI18n()
  const [betas, setBetas] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropId, setDropId] = useState<string | null>(null)
  const nav = useNavEntries({
    host,
    mode,
    at,
    inside,
    onChat,
    onDev,
    onDesign,
    onStudio,
    onTabs,
    go,
    pins,
  })
  const { anon, pinnedEntries, defaultEntries, allEntries, externalEntries, shownInPrimary, reach } = nav

  const betasDialog = <BetasDialog open={betas} onOpenChange={setBetas} go={reach} />

  const unpinnedActive = allEntries.filter((item) => !shownInPrimary.has(item.id) && item.on)
  // The reader's pins first, then the default apps in their places, then an app from More while the reader is in it.
  const visibleMarks = [...pinnedEntries, ...defaultEntries, ...unpinnedActive]
  const pinnedSet = new Set(pinnedEntries.map((item) => item.id))
  const overflowBuiltIn = allEntries.filter((item) => !shownInPrimary.has(item.id) && !item.on)
  const overflowExternal = externalEntries.filter((item) => !shownInPrimary.has(item.id))

  const foldedEntries = [...overflowBuiltIn, ...overflowExternal]

  const expandHandler = onOpen ?? toggle
  const newLabel = mode === 'dev' ? t('New run') : mode === 'design' ? t('New design') : t('New chat')
  const handleNew =
    onNew ??
    (() => {
      if (mode === 'dev') go(app(''))
      else if (mode === 'design') go(design(''))
      else if (mode === 'studio') go(studio(''))
      else go(talk())
    })

  return (
    <TooltipProvider delay={90}>
      <YStack
        data-slot="rail"
        data-expanded="false"
        render="nav"
        aria-label={t('Products')}
        width={RAIL_FOLDED}
        flex={1}
        minH={0}
        pt={(HEAD - MARK) / 2 + 2}
        pb={0}
        gap={4}
        shrink={0}
        items="center"
        $touchable={{ pt: (TOUCH_HEAD - TOUCH) / 2, pb: 0 }}
      >
        {/* Top expand button (only in folded desktop rail, never duplicated in compact drawer rail) */}
        {!compact && expandHandler ? (
          <Mark
            label={t('Open sidebar')}
            data-slot="rail-expand"
            tooltip
            onClick={expandHandler}
          >
            <PanelLeftOpen size={18} aria-hidden data-i18n-mirror />
          </Mark>
        ) : null}

        {/* Primary + New icon button when folded */}
        {!compact && mode !== 'beta' && mode !== 'hosted' ? (
          <Mark
            label={newLabel}
            data-slot="rail-new"
            tooltip
            onClick={handleNew}
          >
            <Plus size={18} aria-hidden />
          </Mark>
        ) : null}

        {/* Scrollable icons-only product list (drag with grab cursor to reorder) */}
        <YStack
          flex={1}
          minH={0}
          overflowY="auto"
          overflowX="hidden"
          items="center"
          gap={4}
          width="100%"
          $platform-web={{ scrollbarWidth: 'none' }}
        >
          {visibleMarks.map((item, i) => {
            const isDragging = dragId === item.id
            // A pin is where a drag lands: dropped on one, the dragged app is pinned there (or moved there among the pins).
            const droppable = pinnedSet.has(item.id)
            const isDropTarget = droppable && dropId === item.id && dragId !== null && dragId !== item.id
            const afterPins = i > 0 && i === pinnedEntries.length
            return (
              <YStack
                key={item.id}
                width="100%"
                items="center"
                opacity={isDragging ? 0.4 : 1}
                borderTopWidth={isDropTarget ? 2 : 0}
                borderColor="var(--foreground)"
                pt={isDropTarget ? 2 : 0}
                $platform-web={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                {...({
                  draggable: !anon,
                  onDragStart: (e: DragEvent) => {
                    setDragId(item.id)
                    e.dataTransfer?.setData('text/plain', item.id)
                    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
                  },
                  onDragOver: (e: DragEvent) => {
                    if (!droppable || !dragId || dragId === item.id) return
                    e.preventDefault()
                    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                    if (dropId !== item.id) setDropId(item.id)
                  },
                  onDragLeave: () => {
                    if (dropId === item.id) setDropId(null)
                  },
                  onDrop: (e: DragEvent) => {
                    if (!droppable) return
                    e.preventDefault()
                    const src = dragId || e.dataTransfer?.getData('text/plain')
                    if (src && src !== item.id) pins[2](src, item.id)
                    setDragId(null)
                    setDropId(null)
                  },
                  onDragEnd: () => {
                    setDragId(null)
                    setDropId(null)
                  },
                } as object)}
              >
                {afterPins ? <YStack data-slot="rail-pins-end" width={20} height={1} bg="$edge" mb={4} aria-hidden /> : null}
                <RailMark
                  label={item.label}
                  on={item.on}
                  onClick={item.onPress}
                  data-slot={item.slot}
                  data-nav-id={item.id}
                  data-pinned={pinnedSet.has(item.id) ? '' : undefined}
                >
                  {item.icon}
                </RailMark>
              </YStack>
            )
          })}
          {!anon && foldedEntries.length > 0 ? (
            <MoreMenu
              placement={dir === 'rtl' ? 'left-start' : 'right-start'}
              minWidth={220}
              maxHeight={420}
              entries={foldedEntries}
              onPin={nav.togglePin}
              t={t}
              trigger={
                <YStack
                  render="button"
                  aria-label={t('More')}
                  {...({ title: t('More') } as object)}
                  data-slot="rail-more"
                  width={RAIL_FOLDED - 6}
                  minH={MARK + 6}
                  px={2}
                  py={5}
                  gap={3}
                  rounded={12}
                  items="center"
                  justify="center"
                  cursor="pointer"
                  hoverStyle={{ bg: '$hover' }}
                  pressStyle={{ bg: '$raised' }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
                  $touchable={{ minH: TOUCH + 8 }}
                >
                  <XStack width={20} height={20} items="center" justify="center" opacity={0.68}>
                    <Ellipsis size={18} aria-hidden />
                  </XStack>
                  <Text data-slot="rail-caption" aria-hidden maxW="100%" fontSize={10} lineHeight={12} color="$aside" numberOfLines={1} text="center">
                    {t('More')}
                  </Text>
                </YStack>
              }
            />
          ) : null}
          {betasDialog}
        </YStack>

        {anon ? (
          <YStack gap={4} items="center" pb="$1">
            <Mark
              label={t('See plans and pricing')}
              data-slot="anon-pricing"
              tooltip
              onClick={() => {
                if (typeof window !== 'undefined') window.location.assign('/pricing')
              }}
            >
              <Sparkles size={18} aria-hidden />
            </Mark>
            <Mark
              label={t('Help')}
              data-slot="anon-help"
              tooltip
              onClick={() => {
                if (typeof window !== 'undefined') window.open('https://docs.hanzo.ai', '_blank', 'noopener,noreferrer')
              }}
            >
              <CircleHelp size={18} aria-hidden />
            </Mark>
            <Mark
              label={t('Settings')}
              data-slot="anon-settings"
              tooltip
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('hanzo:anon-settings', { detail: { open: true } }))
                }
              }}
            >
              <Settings size={18} aria-hidden />
            </Mark>
          </YStack>
        ) : (
          <YStack width="100%" items="center" pt="$1">
            <Account host={host} narrow onOrg={onOrg} />
          </YStack>
        )}
      </YStack>
    </TooltipProvider>
  )
}
