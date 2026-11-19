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

/** Where the pinned apps are kept: on the account (`usePref`), under the key this browser has always used, so earlier pins stay. */
export const NAV_PINNED_KEY = 'hanzo.nav.pinned'
export const DEFAULT_PINNED_NAV: readonly string[] = ['chat', 'dev', 'design', 'library', 'tabs']

const CORE_NAV_SET = new Set<string>(DEFAULT_PINNED_NAV)

/** The reader's own order, with all 5 core apps (Chat, Dev, Design, Library, Tabs) anchored at the top and never dropped into More. */
export function normalizePinnedNav(list: readonly string[]): string[] {
  const ordered = [...new Set(list.filter(Boolean))]
  return [...DEFAULT_PINNED_NAV.filter((id) => !ordered.includes(id)), ...ordered]
}

/** `list` with `id` pinned or unpinned; the core apps stay. */
export function toggledPinnedNav(list: readonly string[], id: string): string[] {
  if (!id || CORE_NAV_SET.has(id)) return normalizePinnedNav(list)
  return normalizePinnedNav(list.includes(id) ? list.filter((item) => item !== id) : [...list, id])
}

/** `list` with `sourceId` moved to where `targetId` stands. */
export function reorderedPinnedNav(list: readonly string[], sourceId: string, targetId: string): string[] {
  if (!sourceId || !targetId || sourceId === targetId) return normalizePinnedNav(list)
  const without = list.filter((id) => id !== sourceId)
  const at = without.indexOf(targetId)
  without.splice(at < 0 ? without.length : at, 0, sourceId)
  return normalizePinnedNav(without)
}

/** What `usePinnedNav` answers, held once by the surface and handed to the Rail and the Sidebar, so a pin made in one is in the other. */
export type Pins = ReturnType<typeof usePinnedNav>

/** The pinned apps, a toggle for one and a reorder, kept on the account. */
export function usePinnedNav(): [string[], (id: string) => void, (sourceId: string, targetId: string) => void] {
  const [kept, keep] = usePref<string[]>(NAV_PINNED_KEY, [...DEFAULT_PINNED_NAV])
  const pinned = normalizePinnedNav(Array.isArray(kept) ? kept : DEFAULT_PINNED_NAV)
  return [pinned, (id) => keep(toggledPinnedNav(pinned, id)), (src, target) => keep(reorderedPinnedNav(pinned, src, target))]
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
      pinnable: false,
      on: mode === 'chat',
      icon: <MARKS.chat.icon size={17} aria-hidden />,
      onPress: onChat,
    },
    {
      id: 'dev',
      slot: 'rail-dev',
      label: 'Dev',
      href: app(''),
      pinnable: false,
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
            pinnable: false,
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
      pinnable: false,
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
            pinnable: false,
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

  // Anonymous visitors see the public trio (Chat, Dev, Library).
  const pinnedEntries: NavEntry[] = anon
    ? allEntries
    : pinnedIds.map((id) => combinedById.get(id)).filter((item): item is NavEntry => Boolean(item))

  const shownInPrimary = new Set(pinnedEntries.map((item) => item.id))
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
  const { anon, apps, pinnedEntries, allEntries, externalEntries, shownInPrimary, reach } = nav

  const betasDialog = <BetasDialog open={betas} onOpenChange={setBetas} go={reach} />

  const unpinnedActive = allEntries.filter((item) => !shownInPrimary.has(item.id) && item.on)
  const visibleMarks = [...pinnedEntries, ...unpinnedActive]
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
          {visibleMarks.map((item) => {
            const isDragging = dragId === item.id
            const isDropTarget = dropId === item.id && dragId !== null && dragId !== item.id
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
                    if (!dragId || dragId === item.id) return
                    e.preventDefault()
                    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                    if (dropId !== item.id) setDropId(item.id)
                  },
                  onDragLeave: () => {
                    if (dropId === item.id) setDropId(null)
                  },
                  onDrop: (e: DragEvent) => {
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
                >
                  {item.icon}
                </Mark>
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
                <XStack
                  render="button"
                  aria-label={t('More')}
                  {...({ title: t('More') } as object)}
                  data-slot="rail-more"
                  width={MARK}
                  height={MARK}
                  rounded={12}
                  items="center"
                  justify="center"
                  cursor="pointer"
                  opacity={0.68}
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
