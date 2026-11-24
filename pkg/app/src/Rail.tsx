'use client'

// Persistent left navigation rail (52px icons-only, anchored in place while the
// contextual sidebar beside it opens and closes):
// - Shared `useNavEntries()` model keeps Hanzo's exact product names & order
//   (`Chat`, `Dev`, `Design`, `Flow`, `Library`, `Scheduled tasks`,
//   `Customize`, `Tabs`, `Betas`, and every hosted app or beta the reader may open;
//   Developer mode hides none of them) across both the desktop Rail and mobile drawer.
// - Strictly monochrome active chrome (`bg="$raised"`, `color="$ink"`).
// - Every `render="button"` element uses `onClick` (never `onPress`).

import { useI18n } from '@hanzo/i18n/react'
import {
  Atom,
  BarChart3,
  BookOpen,
  Bot,
  Box,
  Boxes,
  Briefcase,
  Building2,
  CircleHelp,
  Clapperboard,
  Compass,
  Contact,
  Container,
  Cpu,
  Database,
  Ellipsis,
  Eye,
  FilePenLine,
  FileText,
  Film,
  FlaskConical,
  FolderLock,
  GitBranch,
  Globe,
  KeyRound,
  Landmark,
  LifeBuoy,
  ListChecks,
  Lock,
  Megaphone,
  Mic,
  Monitor,
  Music,
  Network,
  NotebookPen,
  Palette,
  Phone,
  Radar,
  ScanFace,
  Search,
  Server,
  Settings,
  Share2,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  Telescope,
  Users,
  Vault,
  Volume2,
  Workflow,
  Zap,
} from 'lucide-react'
import { useState, type ComponentType, type DragEvent, type ReactNode } from 'react'
import { XStack, YStack, Text } from '@hanzo/gui'
import { Toggle } from './Toggle'
export { Toggle, TOGGLE } from './Toggle'
import { route, type Host } from '@hanzo/build'
import { MARKS } from './icons'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@hanzo/ui'
import { MoreMenu } from './MoreMenu'
import { BetasDialog, useBetas } from './Betas'
import { BETAS } from './lib/betas'
import { HOSTED_APPS } from './lib/hosted'
import { Account } from './Account'
import { RailUsageButton } from './Usage'
import { useDevMode } from './lib/dev-mode'
import { usePref } from './pref'
import { HEAD, MARK, TOUCH_HEAD } from './ground'
import { railKeys } from './keys'
import { out } from './help'
import { apex, app, design, flow, hosted, SCIENCE, talk, TERMINALS, WORKSPACE, type Place } from './lib/host'
import { site } from './where'

export { MARK }

export const RAIL_FOLDED = 52

const BETA_ICONS: Record<string, ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
  crm: Contact,
  erp: Boxes,
  commerce: ShoppingCart,
  books: BookOpen,
  finance: Landmark,
  treasury: Vault,
  dataroom: FolderLock,
  sign: FilePenLine,
  company: Building2,
  cms: FileText,
  helpdesk: LifeBuoy,
  marketing: Megaphone,
  ads: Target,
  social: Share2,
  tel: Phone,
  risk: ShieldAlert,
  idv: ScanFace,
  base: Database,
  analytics: BarChart3,
  insights: Telescope,
  search: Search,
  world: Globe,
  crawl: Radar,
  notebook: NotebookPen,
  workspace: Briefcase,
  science: Atom,
  flow: Workflow,
  operative: Monitor,
  tasks: ListChecks,
  functions: Zap,
  visor: Server,
  edge: Network,
  registry: Container,
  ci: GitBranch,
  kms: KeyRound,
  guard: ShieldCheck,
  sentinel: Eye,
  authz: Lock,
  hsm: Cpu,
  studio: Clapperboard,
  koma: Film,
  iro: Palette,
  mori: Box,
  oto: Volume2,
  koe: Mic,
  uta: Music,
  zen7: Sparkles,
}

function betaIcon(id: string): ReactNode {
  const Icon = BETA_ICONS[id] ?? Sparkles
  return <Icon size={17} aria-hidden />
}

/** A mark on a touch screen, px: a thumb's 44. */
const TOUCH = 44

/** Where an earlier version kept the menu (the five apps, then the reader's pins), on the account. Read once, to carry those pins over. */
export const NAV_PINNED_KEY = 'hanzo.nav.pinned'
/** Where the reader's pins are kept, on the account (`usePref`), so they follow them to every device: only what they pinned, in their order. */
export const NAV_PINS_KEY = 'hanzo.nav.pins'

/** The menu as it stands when nothing is pinned, in its order: each app's default place. */
export const DEFAULT_NAV: readonly string[] = ['chat', 'dev', 'design', 'flow', 'library', 'tabs']
/** The old name of `DEFAULT_NAV`, for importers that still read it. */
export const DEFAULT_PINNED_NAV = DEFAULT_NAV

const CORE_NAV_SET = new Set<string>(DEFAULT_NAV)

/** The reader's pins, each once, in their order. */
export function cleanPinnedNav(list: readonly unknown[]): string[] {
  return [
    ...new Set(
      list
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .map((id) => (id === 'research' ? 'science' : id)),
    ),
  ]
}

/**
 * The pins an earlier version kept (`NAV_PINNED_KEY`: the five apps, then what the reader pinned from More): the ones
 * pinned from More stay pinned, and the five go back to their default places.
 */
export function carriedPinnedNav(list: unknown): string[] {
  return Array.isArray(list) ? cleanPinnedNav(list).filter((id) => !CORE_NAV_SET.has(id)) : []
}

/**
 * One unified ordered rail list: default apps stay in their normal order, and any extra apps
 * pinned from More append to the normal list (never split above everything). Once the reader
 * drags to reorder the rail, their exact full order is preserved across every device.
 */
export function unifiedNavOrder(list: readonly string[]): string[] {
  const cleaned = cleanPinnedNav(list)
  const coreCount = cleaned.filter((id) => CORE_NAV_SET.has(id)).length
  if (coreCount >= 2) {
    const missing = DEFAULT_NAV.filter((id) => !cleaned.includes(id))
    return [...cleaned, ...missing]
  }
  const extras = cleaned.filter((id) => !CORE_NAV_SET.has(id))
  return [...DEFAULT_NAV, ...extras]
}

/** `list` with `id` added to the end of the normal rail list (or removed back to More when unpinned). */
export function toggledPinnedNav(list: readonly string[], id: string): string[] {
  const pins = cleanPinnedNav(list)
  if (!id) return pins
  if (CORE_NAV_SET.has(id)) {
    const full = unifiedNavOrder(pins)
    return full.includes(id) ? full : [...full, id]
  }
  return pins.includes(id) ? pins.filter((item) => item !== id) : [...pins, id]
}

/** `list` with `sourceId` dragged to `targetId`'s exact slot inside the unified rail list. */
export function reorderedPinnedNav(list: readonly string[], sourceId: string, targetId: string): string[] {
  const full = unifiedNavOrder(list)
  if (!sourceId || sourceId === targetId) return full
  const without = full.filter((id) => id !== sourceId)
  const at = without.indexOf(targetId)
  without.splice(at < 0 ? without.length : at, 0, sourceId)
  return without
}

/** What `usePinnedNav` answers, held once by the surface and handed to the Rail, the Sidebar and the context menu, so a pin made in one is in the others. */
export type Pins = ReturnType<typeof usePinnedNav>

/** `list` with `id` swapped with its neighbour one place up (-1) or down (1) among `visible`: the keyboard's way to the order a drag makes. */
export function shiftedPinnedNav(list: readonly string[], id: string, delta: -1 | 1, visible?: readonly string[]): string[] {
  const next = unifiedNavOrder(list)
  const seen = visible ?? next
  const other = seen[seen.indexOf(id) + delta]
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
  onFlow,
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
  onFlow?: () => void
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
  const team = mode !== 'design'
  const rawGranted = BETAS.filter((b) => b.href && b.embed === undefined && b.id !== 'flow' && b.id !== 'science' && opened(b.id))
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
      icon: <MARKS.chat.icon aria-hidden />,
      onPress: onChat,
    },
    {
      id: 'dev',
      slot: 'rail-dev',
      label: 'Dev',
      href: app(''),
      on: mode === 'dev' && !here,
      icon: <MARKS.dev.icon aria-hidden />,
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
            icon: <MARKS.design.icon aria-hidden />,
            onPress: () => onDesign?.(),
          } satisfies NavEntry,
          {
            id: 'flow',
            slot: 'rail-flow',
            label: 'Flow',
            href: flow(''),
            on: mode === 'flow',
            icon: <MARKS.flow.icon aria-hidden />,
            onPress: () => (onFlow ? onFlow() : go(flow(''))),
          } satisfies NavEntry,
        ]),
    {
      id: 'library',
      slot: 'rail-library',
      label: t('Library'),
      href: app(RAISED.library),
      on: here === 'library',
      icon: <MARKS.library.icon aria-hidden />,
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
            icon: <MARKS.scheduled.icon aria-hidden />,
            onPress: to(RAISED.scheduled),
          } satisfies NavEntry,
          {
            id: 'customize',
            slot: 'rail-customize',
            label: t('Customize'),
            href: app(RAISED.customize),
            on: here === 'customize',
            icon: <MARKS.customize.icon aria-hidden />,
            onPress: to(RAISED.customize),
          } satisfies NavEntry,
          {
            id: 'tabs',
            slot: 'rail-tabs',
            label: 'Tabs',
            href: TERMINALS,
                  on: mode === 'tabs',
            icon: <MARKS.tabs.icon aria-hidden />,
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
          {
            id: 'science',
            slot: 'rail-science',
            label: t('Science'),
            href: SCIENCE,
            on: mode === 'research',
            icon: <Atom size={17} aria-hidden />,
            onPress: () => go(SCIENCE),
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
              icon: betaIcon(b.id),
              onPress: () => reach(b.href as string),
            }),
          ),
        ]
      : []

  const combinedById = new Map([...allEntries, ...externalEntries].map((item) => [item.id, item]))

  // Anonymous visitors see the public trio (Chat, Dev, Library), and pin nothing.
  // Signed-in readers see ONE unified, freely reorderable rail list (no split "Pinned" section above everything).
  const orderedIds = anon ? [] : unifiedNavOrder(pinnedIds)
  const primaryEntries: NavEntry[] = anon
    ? allEntries
    : orderedIds.map((id) => combinedById.get(id)).filter((item): item is NavEntry => Boolean(item))
  const pinnedEntries: NavEntry[] = anon
    ? []
    : pinnedIds
        .filter((id) => !CORE_NAV_SET.has(id))
        .map((id) => combinedById.get(id))
        .filter((item): item is NavEntry => Boolean(item))
  const defaultEntries: NavEntry[] = primaryEntries

  const shownInPrimary = new Set(primaryEntries.map((item) => item.id))
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
    primaryEntries,
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
      rounded={10}
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

export function Rail({
  host,
  mode,
  at,
  open,
  toggle,
  onOpen,
  compact = false,
  inside = null,
  onChat,
  onDev,
  onDesign,
  onFlow,
  onTabs,
  go,
  onOrg,
  pins,
  footer,
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
  /** Toggle the contextual sidebar beside the rail. */
  onOpen?: () => void
  /** Force compact icons-only layout without toggle header. */
  compact?: boolean
  /** The hosted app (lib/hosted) the reader is in, if any. */
  inside?: string | null
  /** To Chat, Dev, Design and Flow, each where the reader left it. */
  onChat: () => void
  onDev: () => void
  onDesign?: () => void
  onFlow?: () => void
  onTabs: () => void
  /** Moves the app to an address of this page. */
  go: (address: string) => void
  /** Work in another organization. */
  onOrg: (org: string) => void
  /** Optional status slot stacked directly above Usage `(!)` and Account (e.g. desktop Download/Update button). */
  footer?: ReactNode
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
    onFlow,
    onTabs,
    go,
    pins,
  })
  const { anon, primaryEntries, allEntries, externalEntries, shownInPrimary, reach } = nav

  const betasDialog = <BetasDialog open={betas} onOpenChange={setBetas} go={reach} />

  const unpinnedActive = allEntries.filter((item) => !shownInPrimary.has(item.id) && item.on)
  // One unified, drag-and-drop reorderable rail list (pinned extras sit in the normal list, never split above everything).
  const visibleMarks = [...primaryEntries, ...unpinnedActive]
  const extraPinnedSet = new Set(nav.pinnedIds.filter((id) => !CORE_NAV_SET.has(id)))
  const overflowBuiltIn = allEntries.filter((item) => !shownInPrimary.has(item.id) && !item.on)
  const overflowExternal = externalEntries.filter((item) => !shownInPrimary.has(item.id))

  const foldedEntries = [...overflowBuiltIn, ...overflowExternal]

  const toggleHandler = onOpen ?? toggle

  return (
    <TooltipProvider delay={90}>
      <YStack
        data-slot="rail"
        data-expanded={open ? 'true' : 'false'}
        render="nav"
        aria-label={t('Products')}
        {...({ onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => railKeys(e, e.currentTarget) } as object)}
        width={RAIL_FOLDED}
        flex={1}
        minH={0}
        pt={4}
        pb={0}
        gap={4}
        shrink={0}
        items="center"
        $touchable={{ pt: (TOUCH_HEAD - TOUCH) / 2, pb: 0 }}
      >
        {/* Top sidebar toggle, anchored in place above the product marks */}
        {!compact && toggleHandler ? (
          <XStack height={HEAD} items="center" justify="center" shrink={0} $touchable={{ height: TOUCH_HEAD }}>
            <Toggle open={open} tooltip onPress={toggleHandler} />
          </XStack>
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
          {visibleMarks.map((item) => {
            const isDragging = dragId === item.id
            // Every rail item is both draggable and droppable so the reader can freely reorder the entire rail.
            const droppable = !anon
            const isDropTarget = droppable && dropId === item.id && dragId !== null && dragId !== item.id
            return (
              <YStack
                key={item.id}
                width="100%"
                items="center"
                opacity={isDragging ? 0.4 : 1}
                borderTopWidth={isDropTarget ? 2 : 0}
                borderColor="var(--foreground)"
                pt={isDropTarget ? 2 : 0}
                $platform-web={{ cursor: !anon ? (isDragging ? 'grabbing' : 'grab') : 'pointer' }}
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
                <Mark
                  label={item.label}
                  on={item.on}
                  tooltip
                  onClick={item.onPress}
                  data-slot={item.slot}
                  data-nav-id={item.id}
                  data-pinned={extraPinnedSet.has(item.id) ? '' : undefined}
                >
                  {item.icon}
                </Mark>
              </YStack>
            )
          })}
          {!anon && foldedEntries.length > 0 ? (
            <MoreMenu
              placement={dir === 'rtl' ? 'left-start' : 'right-start'}
              minWidth={240}
              maxHeight={320}
              entries={foldedEntries}
              onPin={nav.togglePin}
              t={t}
              trigger={
                <XStack
                  render="button"
                  aria-label={t('More')}
                  {...({ title: t('More') } as object)}
                  data-slot="rail-more"
                  width={MARK}
                  height={MARK}
                  rounded={10}
                  items="center"
                  justify="center"
                  shrink={0}
                  cursor="pointer"
                  opacity={0.76}
                  bg="transparent"
                  hoverStyle={{ bg: '$hover', opacity: 1 }}
                  pressStyle={{ bg: '$raised' }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
                  $touchable={{ width: TOUCH, height: TOUCH }}
                >
                  <Ellipsis size={18} aria-hidden />
                </XStack>
              }
            />
          ) : null}
          {betasDialog}
        </YStack>

        {anon ? (
          <YStack data-slot="rail-footer" gap={8} items="center" pt="$1" pb={10}>
            {footer}
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
          <YStack data-slot="rail-footer" width="100%" items="center" gap={8} pt="$1" pb={10} shrink={0}>
            {footer}
            <RailUsageButton />
            <Account host={host} narrow onOrg={onOrg} />
          </YStack>
        )}
      </YStack>
    </TooltipProvider>
  )
}
