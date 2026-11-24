'use client'

// The contextual desktop sidebar (beside the stationary icon rail) and the
// mobile drawer column (when no rail is shown):
// 1. Top Header Row (`data-slot="app-head"`): the active place's name (`Chat`,
//    `Dev`, `Design`, `Flow`, `Tabs`, `Betas`, hosted app, or `← Back` + sub-place
//    like Library / Scheduled tasks / Customize; `Hanzo` in the mobile drawer),
//    Activity bell, and Search (⌘K). The sidebar toggle stays anchored in place on
//    the Rail (or desktop title bar), never duplicated here.
// 2. Primary New Action (`+ New chat` / `+ New run` / `+ New design` / `+ New terminal`).
// 3. On desktop: the active place's own contextual places (`Projects`, `Issues`,
//    `Templates`, Studio places, Tabs sessions/devices) — never duplicating the Rail's
//    product list, More, or Account. In the mobile drawer (no rail): the full product
//    list (`Chat`, `Dev`, `Design`, `Library`, `Tabs`, pinned items), `More`, and `Account`.
// 4. Conversations / Runs (`<Recents>`) below a subtle `$edge` hairline; the part that scrolls.

import { locales, phrase } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { Text, XStack, YStack } from '@hanzo/gui'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronUp,
  Cloud,
  ExternalLink,
  Globe,
  GripVertical,
  Image as ImageMark,
  Info,
  Link2,
  ListFilter,
  LogIn,
  Monitor,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Puzzle,
  Search,
  Settings,
} from 'lucide-react'
import { DOTS, Gutter, library, NEW, own, Rename, tabs, useLanguage, useScheduled, useSessions, type Host } from '@hanzo/build'
import { rename, useDeviceNames, type Names } from '@hanzo/build/names'
import { showDevice, showShell, type Shown } from './lib/devices'

type Theme = NonNullable<Host['theme']>
import { tidy } from './lib/title'
import { Button, Dialog, DialogContent, DialogTitle, DropdownMenu, Switch, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, toast, type DropdownMenuProps } from '@hanzo/ui'
import { Sidebar as Base, SidebarIconButton, SidebarItem, StatusDot, type RailLink } from '@hanzo/ui/chat'
import { useEffect, useId, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { Account, Made } from './Account'
import { useBetas } from './Betas'
import { Recents } from './Recents'
import { MARKS } from './icons'
import { ChatList, DevList, useScope } from './DevPane'
import { DEFAULT_NAV, fullNavUrl, raised, useNavEntries, type NavEntry, type Pins, type Raised } from './Rail'
import { MoreMenu } from './MoreMenu'
import { Setup } from './Setup'
import { ago, PINNED, UNTITLED_RUN, type Recent } from './recent'
import { empty } from './open'
import { useSpan } from './span'
import { useDevMode } from './lib/dev-mode'
import { app, design, flow, hosted, science, talk, TERMINALS, type Place } from './lib/host'
import { enter, LOGIN, signUp } from './lib/destination'
import { HOSTED_APPS } from './lib/hosted'
import { pick } from './lib/session'
import { brand, site } from './where'
import { dragWindow, toggleWindowMaximize } from './WindowControls'
import { BAND, HEAD as LINE, pane, SIDE, TOUCH_HEAD } from './ground'
import { railKeys } from './keys'
import { useWindowed } from './windowed'
import { dispatchTabsAction } from './tabsAction'

/** The sidebar fills the column. Its `width` is typed in px alone, though its frame takes any gui size — the type is
 *  @hanzo/ui's to widen. */
const FILL = { width: '100%' } as object

/** The sidebar's width, px: its default (256px), and the two a drag holds it between. */
const WIDTH = SIDE
const FLOOR = 200
const CEIL = 420
/** Per reader, per browser. */
const SPAN = 'hanzo.app.column'

/** A row on a touch screen, px: a thumb's 44. */
const TOUCH = 44

/** Enter and Space press a row the way a click does. */
const keys = (press: () => void) => ({
  onKeyDown: (e: { key?: string; preventDefault?: () => void }) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault?.()
    press()
  },
})

/** A row of the sidebar: a full-width pill, 44px on a touch screen, lit where the reader is. */
const ROW = {
  rounded: '$3',
  minH: 34,
  py: 0,
  px: '$2.5',
  gap: '$2.5',
  width: '100%' as never,
  $touchable: { minH: TOUCH },
  '$max-sm': { minH: TOUCH },
} as const

/** A sidebar link row spans the column width so hover and active pills align with Recents. */
const COMPACT_ROW = ROW

/** A row under a place: `hint` is its info tip; `rename`, a device's or a shell's, opens Rename from its menu. */
type SidebarPlaceLink = RailLink & { hint?: string; rename?: () => void }

/** The run activity behind the bell: the runs that moved last, newest first. */
const RECENT = 6

/** What a place that takes the sidebar is called at its head. */
const TITLE: Record<Raised, string> = { library: phrase('Library'), scheduled: phrase('Scheduled tasks'), customize: phrase('Customize') }

/** A header mark: 28×28 target aligned directly beneath the title-bar Back/Forward arrows, 44 on touch. */
const HEAD = { width: 28, height: 28, rounded: 8, $touchable: { width: TOUCH, height: TOUCH } } as const
/** Sub-page header mark shares identical 28×28 geometry for strict column alignment under `< >`. */
const SUB_HEAD = HEAD

function resolvePlaceHref(id: string, mode: Place['mode']): string | null {
  if (mode === 'flow') {
    return id === 'canvas' || id === 'flows' ? flow('') : flow(id)
  }
  if (mode === 'research') {
    if (id === NEW) return science('autonomy')
    if (id === 'overview' || id === 'studies' || id === 'autonomy' || id === 'machines' || id === 'schedules') {
      return science(id)
    }
    return null
  }
  switch (id) {
    case NEW:
      return mode === 'dev' ? app('') : mode === 'design' ? design('') : mode === 'tabs' ? TERMINALS : talk()
    case 'projects':
      return app('-/projects')
    case 'issues':
      return app('-/issues')
    case 'templates':
      return app('-/templates')
    case 'agents':
      return app('-/customize/agents')
    case 'bots':
      return app('-/customize/bots')
    case 'skills':
      return app('-/customize/skills')
    case 'connectors':
      return app('-/customize/connectors')
    case 'plugins':
      return app('-/customize/plugins')
    case 'upload':
    case 'all':
    case 'images':
    case 'documents':
      return app('-/artifacts')
    default:
      if (id.startsWith('app-')) return hosted(id.slice('app-'.length))
      return null
  }
}

function fullPlaceUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  if (typeof window === 'undefined') return path
  return new URL(site(path), window.location.href).href
}

function NavMenuRow({
  item,
  pinned,
  pinnable = true,
  onTogglePin,
  onMove,
  draggable = false,
  dragging = false,
  dropTarget = false,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  t,
}: {
  item: NavEntry
  pinned: boolean
  /** Whether the reader can pin it (a signed-out visitor pins nothing). */
  pinnable?: boolean
  onTogglePin: (id: string) => void
  /** Where a drag cannot go: a pinned row's way up or down the order by keyboard. Absent for the end it is already at. */
  onMove?: { up?: () => void; down?: () => void }
  draggable?: boolean
  dragging?: boolean
  dropTarget?: boolean
  onDragStart?: (e: DragEvent) => void
  onDragOver?: (e: DragEvent) => void
  onDragLeave?: () => void
  onDrop?: (e: DragEvent) => void
  onDragEnd?: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const windowed = useWindowed()
  const canPin = pinnable && item.pinnable !== false && !DEFAULT_NAV.includes(item.id)
  const handleTogglePin = () => {
    onTogglePin(item.id)
    toast.success(
      !pinned
        ? t('Added {name} to sidebar', { name: item.label })
        : t('Moved {name} back to More', { name: item.label }),
    )
  }

  const menuItems: NonNullable<DropdownMenuProps['items']> = [
    ...(canPin
      ? [
          {
            key: 'pin',
            label: pinned ? t('Remove from sidebar') : t('Pin to sidebar'),
            icon: pinned ? <PinOff size={15} aria-hidden /> : <Pin size={15} aria-hidden />,
            onSelect: handleTogglePin,
          },
        ]
      : []),
    ...(onMove?.up ? [{ key: 'move-up', label: t('Move up'), icon: <ChevronUp size={15} aria-hidden />, onSelect: onMove.up }] : []),
    ...(onMove?.down ? [{ key: 'move-down', label: t('Move down'), icon: <ChevronDown size={15} aria-hidden />, onSelect: onMove.down }] : []),
    // A window of its own (Hanzo Desktop) has no browser tabs to open it in.
    ...(windowed
      ? []
      : [
          {
            key: 'new-tab',
            label: t('Open in new tab'),
            icon: <ExternalLink size={15} aria-hidden />,
            onSelect: () => {
              if (typeof window !== 'undefined') {
                window.open(fullNavUrl(item.href), '_blank', 'noopener,noreferrer')
              }
            },
          },
        ]),
    {
      key: 'copy-link',
      label: t('Copy link'),
      icon: <Link2 size={15} aria-hidden />,
      onSelect: async () => {
        try {
          await navigator.clipboard.writeText(fullNavUrl(item.href))
          toast.success(t('Link copied'))
        } catch {
          toast.error(t('The browser would not copy the link.'))
        }
      },
    },
  ]

  return (
    <XStack
      group
      position="relative"
      width="100%"
      items="center"
      minW={0}
      borderTopWidth={dropTarget ? 2 : 0}
      borderTopColor={dropTarget ? 'var(--border-selected)' : 'transparent'}
      opacity={dragging ? 0.45 : 1}
      {...(draggable
        ? ({
            draggable: true,
            onDragStart,
            onDragOver,
            onDragLeave,
            onDrop,
            onDragEnd,
          } as object)
        : null)}
    >
      {draggable ? (
        <XStack
          position="absolute"
          insetInlineStart={1}
          t={0}
          b={0}
          width={10}
          items="center"
          justify="center"
          pointerEvents="none"
          opacity={dragging ? 0.9 : 0}
          $group-hover={{ opacity: 0.55 }}
          $touchable={{ display: 'none' }}
          $platform-web={{ color: 'var(--muted-foreground)' }}
          aria-hidden
        >
          <GripVertical size={12} aria-hidden />
        </XStack>
      ) : null}
      <XStack
        render={<button type="button" />}
        data-slot={item.slot}
        data-nav-id={item.id}
        aria-label={item.label}
        aria-current={item.on ? 'page' : undefined}
        onClick={item.onPress}
        flex={1}
        minW={0}
        minH={34}
        px="$2.5"
        py="$1"
        paddingInlineEnd={canPin ? 54 : 30}
        rounded="$3"
        borderWidth={0}
        items="center"
        gap="$2.5"
        cursor="pointer"
        $platform-web={draggable ? { cursor: dragging ? 'grabbing' : 'grab' } : undefined}
        bg={item.on ? '$raised' : 'transparent'}
        hoverStyle={{ bg: item.on ? '$raised' : '$hover' }}
        pressStyle={{ bg: '$raised' }}
        focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
        $touchable={{ minH: TOUCH }}
        $max-sm={{ minH: TOUCH }}
      >
        <XStack width={18} height={18} items="center" justify="center" shrink={0} opacity={item.on ? 1 : 0.78}>
          {item.icon}
        </XStack>
        <Text
          flex={1}
          minW={0}
          fontSize="$2"
          fontWeight={item.on ? '500' : '400'}
          color={item.on ? '$ink' : '$aside'}
          numberOfLines={1}
          text="start"
        >
          {item.label}
        </Text>
        {item.external ? <ExternalLink size={12} opacity={0.45} aria-hidden /> : null}
      </XStack>

      <XStack position="absolute" insetInlineEnd={4} t={0} b={0} items="center" gap={2}>
        {canPin ? (
          <XStack
            render={<button type="button" />}
            data-slot="nav-item-pin"
            aria-label={pinned ? t('Unpin {name}', { name: item.label }) : t('Pin {name} to top', { name: item.label })}
            {...({ title: pinned ? t('Unpin from top') : t('Pin to top') } as object)}
            width={24}
            height={24}
            rounded="$2"
            borderWidth={0}
            items="center"
            justify="center"
            cursor="pointer"
            bg="transparent"
            $platform-web={{ color: 'var(--muted-foreground)' }}
            opacity={menuOpen ? 1 : 0}
            $group-hover={{ opacity: 1 }}
            focusVisibleStyle={{ opacity: 1, outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $touchable={{ opacity: 0.7, minW: TOUCH, minH: TOUCH }}
            $max-sm={{ minW: TOUCH, minH: TOUCH }}
            hoverStyle={{ bg: '$hover' }}
            onClick={(e: { stopPropagation?: () => void }) => {
              e.stopPropagation?.()
              handleTogglePin()
            }}
          >
            {pinned ? <PinOff size={13} aria-hidden /> : <Pin size={13} aria-hidden />}
          </XStack>
        ) : null}
        <DropdownMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          placement="bottom-end"
          minWidth={180}
          items={menuItems}
          trigger={
            <XStack
              render={<button type="button" />}
              data-slot="nav-item-options"
              aria-label={t('{name} options', { name: item.label })}
              width={24}
              height={24}
              rounded="$2"
              borderWidth={0}
              items="center"
              justify="center"
              cursor="pointer"
              bg={menuOpen ? '$hover' : 'transparent'}
              opacity={menuOpen ? 1 : 0}
              $group-hover={{ opacity: 1 }}
              focusStyle={{ opacity: 1 }}
              focusVisibleStyle={{ opacity: 1, outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              $touchable={{ opacity: 1, minW: TOUCH, minH: TOUCH }}
              $max-sm={{ minW: TOUCH, minH: TOUCH }}
              hoverStyle={{ bg: '$hover' }}
              onClick={(e: { stopPropagation?: () => void }) => e.stopPropagation?.()}
            >
              <MoreHorizontal size={14} aria-hidden />
            </XStack>
          }
        />
      </XStack>
    </XStack>
  )
}

function PlaceRow({
  link,
  mode,
  makeIcon,
  compact = false,
  t,
}: {
  link: SidebarPlaceLink
  mode: Place['mode']
  makeIcon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
  compact?: boolean
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const windowed = useWindowed()
  const routePath = resolvePlaceHref(link.id, mode)
  const MakeIcon = makeIcon

  const menuItems: NonNullable<DropdownMenuProps['items']> = [
    ...(link.rename
      ? [{ key: 'rename', label: t('Rename…'), icon: <Pencil size={15} aria-hidden />, onSelect: link.rename }]
      : []),
    ...(routePath
      ? [
          ...(windowed
            ? []
            : [
                {
                  key: 'new-tab',
                  label: t('Open in new tab'),
                  icon: <ExternalLink size={15} aria-hidden />,
                  onSelect: () => {
                    if (typeof window !== 'undefined') {
                      window.open(fullPlaceUrl(routePath), '_blank', 'noopener,noreferrer')
                    }
                  },
                },
              ]),
          {
            key: 'copy-link',
            label: t('Copy link'),
            icon: <Link2 size={15} aria-hidden />,
            onSelect: async () => {
              try {
                await navigator.clipboard.writeText(fullPlaceUrl(routePath))
                toast.success(t('Link copied'))
              } catch {
                toast.error(t('The browser would not copy the link.'))
              }
            },
          },
        ]
      : []),
  ]

  const hasInfo = Boolean(link.hint)
  const hasMenu = menuItems.length > 0
  const trailSpace = hasInfo && hasMenu ? 54 : hasInfo || hasMenu ? 30 : '$2.5'

  return (
    <XStack group role="listitem" position="relative" width="100%" minW={0} items="center">
      <SidebarItem
        {...COMPACT_ROW}
        minH={compact ? 30 : 34}
        px={compact ? '$2' : '$2.5'}
        gap="$2.5"
        paddingInlineEnd={trailSpace}
        data-place-id={link.id}
        {...(link.id === NEW ? { 'data-slot': 'app-new' } : {})}
        active={link.active}
        bg={link.active ? '$raised' : 'transparent'}
        hoverStyle={{ bg: link.active ? '$raised' : '$hover' }}
        icon={
          link.icon || link.id === NEW ? (
            <XStack width={compact ? 16 : 18} height={compact ? 16 : 18} items="center" justify="center" shrink={0} opacity={link.active ? 1 : 0.72}>
              {link.icon ?? <MakeIcon size={15} aria-hidden />}
            </XStack>
          ) : null
        }
        onPress={link.onPress}
        {...keys(() => link.onPress?.())}
      >
        <Text fontSize="$2" fontWeight={link.active ? '500' : '400'} color={link.active ? '$ink' : compact ? '$soft' : '$aside'} numberOfLines={1}>
          {link.label}
        </Text>
      </SidebarItem>
      {hasInfo || hasMenu ? (
        <XStack position="absolute" insetInlineEnd={4} t={0} b={0} items="center" gap={2}>
          {link.hint ? (
            <Tooltip placement="right" offset={8}>
              <TooltipTrigger asChild>
                <XStack
                  render={<button type="button" />}
                  data-slot="place-info"
                  aria-label={t('About {name}', { name: link.label })}
                  width={22}
                  height={22}
                  rounded="$2"
                  borderWidth={0}
                  bg="transparent"
                  items="center"
                  justify="center"
                  cursor="pointer"
                  $platform-web={{ color: 'var(--muted-foreground)' }}
                  opacity={0.55}
                  hoverStyle={{ opacity: 1, bg: '$hover' }}
                  focusVisibleStyle={{ opacity: 1, outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  $touchable={{ opacity: 0.85, minW: TOUCH, minH: TOUCH }}
                  $max-sm={{ minW: TOUCH, minH: TOUCH }}
                  onClick={(e: { stopPropagation?: () => void }) => e.stopPropagation?.()}
                >
                  <Info size={13} aria-hidden />
                </XStack>
              </TooltipTrigger>
              <TooltipContent
                maxW={230}
                px="$2.5"
                py="$1.5"
                rounded="$3"
                bg="var(--popover)"
                borderWidth={1}
                borderColor="var(--border-strong)"
                z="var(--z-tooltip)"
              >
                <Text fontFamily="$body" fontSize="$1" color="$ink">
                  {link.hint}
                </Text>
              </TooltipContent>
            </Tooltip>
          ) : null}
          {hasMenu ? (
            <DropdownMenu
              open={menuOpen}
              onOpenChange={setMenuOpen}
              placement="bottom-end"
              minWidth={180}
              items={menuItems}
              trigger={
                <XStack
                  render={<button type="button" />}
                  data-slot="place-options"
                  aria-label={t('{name} options', { name: link.label })}
                  width={24}
                  height={24}
                  rounded="$2"
                  borderWidth={0}
                  items="center"
                  justify="center"
                  cursor="pointer"
                  bg={menuOpen ? '$hover' : 'transparent'}
                  opacity={menuOpen ? 1 : 0}
                  $group-hover={{ opacity: 1 }}
                  focusStyle={{ opacity: 1 }}
                  focusVisibleStyle={{ opacity: 1, outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  $touchable={{ opacity: 1, minW: TOUCH, minH: TOUCH }}
                  $max-sm={{ minW: TOUCH, minH: TOUCH }}
                  hoverStyle={{ bg: '$hover' }}
                  onClick={(e: { stopPropagation?: () => void }) => e.stopPropagation?.()}
                >
                  <MoreHorizontal size={14} aria-hidden />
                </XStack>
              }
            />
          ) : null}
        </XStack>
      ) : null}
    </XStack>
  )
}

/** A machine as Terminals lists it for the sidebar (`hanzo.tabs.fleet`): as the fleet names it, with its hardware. */
interface TabsFleetHost {
  machine: string
  hardware?: string
  sandbox?: boolean
  status?: string
  desktop?: boolean
}

/** A device or shell being renamed from its row: the key its name is kept under, the name it has, and its own. */
interface Renaming {
  key: string
  name: string
  fallback: string
}

interface TabsSavedBind {
  kind: string
  shell?: { machine: string; name: string }
  machine?: string
  url?: string
  want?: string
}

function useTabsGroups(
  t: (key: string, params?: Record<string, string | number>) => string,
  active: boolean,
  devMode: boolean,
  names: Names,
  onRename: (what: Renaming) => void,
): { id: string; label: string; links: SidebarPlaceLink[] }[] {
  const [fleet, setFleet] = useState<TabsFleetHost[]>([])
  const [bind, setBind] = useState<Record<string, TabsSavedBind>>({})

  useEffect(() => {
    if (!active || typeof window === 'undefined') return
    const readFromStorage = () => {
      try {
        const rawFleet = window.localStorage.getItem('hanzo.tabs.fleet')
        if (rawFleet) {
          const parsed = JSON.parse(rawFleet)
          if (Array.isArray(parsed)) setFleet(parsed as TabsFleetHost[])
        }
      } catch {
        // ignore
      }
      try {
        const rawLayout = window.localStorage.getItem('hanzo.tabs.layout.v1')
        if (rawLayout) {
          const parsed = JSON.parse(rawLayout) as { bind?: Record<string, TabsSavedBind> }
          if (parsed && parsed.bind && typeof parsed.bind === 'object') {
            setBind(parsed.bind)
          }
        }
      } catch {
        // ignore
      }
    }
    readFromStorage()
    const onFleet = (e: Event) => {
      const detail = (e as CustomEvent<TabsFleetHost[]>).detail
      if (Array.isArray(detail)) setFleet(detail)
    }
    const onState = (e: Event) => {
      const detail = (e as CustomEvent<{ bind?: Record<string, TabsSavedBind> }>).detail
      if (detail?.bind) setBind(detail.bind)
    }
    window.addEventListener('hanzo:tabs-fleet', onFleet)
    window.addEventListener('hanzo:tabs-state', onState)
    window.addEventListener('storage', readFromStorage)
    return () => {
      window.removeEventListener('hanzo:tabs-fleet', onFleet)
      window.removeEventListener('hanzo:tabs-state', onState)
      window.removeEventListener('storage', readFromStorage)
    }
  }, [active])

  return useMemo(() => {
    if (!active) return []
    const quickLinks: SidebarPlaceLink[] = [
      {
        id: 'new-terminal',
        label: t('Terminal'),
        hint: t('A cloud terminal that keeps your files.'),
        icon: <MARKS.tabs.make size={15} aria-hidden />,
        onPress: () => dispatchTabsAction({ kind: 'shell' }),
      },
      {
        id: 'new-desktop',
        label: t('Desktop'),
        hint: t('Full visual cloud desktop in your browser.'),
        icon: <Monitor size={15} aria-hidden />,
        onPress: () => dispatchTabsAction({ kind: 'desktop' }),
      },
      {
        id: 'new-browser',
        label: t('Browser'),
        hint: t('Isolated workspace browser for live previews.'),
        icon: <Globe size={15} aria-hidden />,
        onPress: () => dispatchTabsAction({ kind: 'page' }),
      },
      ...(devMode
        ? [
            {
              id: 'new-cloud',
              label: t('Cloud sandbox'),
              hint: t('Spin up a fresh isolated cloud environment.'),
              icon: <Cloud size={15} aria-hidden />,
              onPress: () => dispatchTabsAction({ kind: 'cloud' }),
            },
          ]
        : []),
    ]

    // Each device and shell by the name a person reads (hanzo-inc/app issue 311): theirs if they gave it one, else
    // "Alex's MacBook Pro" for Alexs-MacBook-Pro.local; the hostname and hardware stay in the detail.
    const liveFleet = fleet.filter((h) => h.status !== 'offline')
    const device = (machine: string) => {
      const h = fleet.find((f) => f.machine === machine)
      return showDevice({ machine, hardware: h?.hardware, sandbox: h?.sandbox }, names, devMode, t)
    }
    const renamer = (shown: Shown, fallback: string) => () => onRename({ key: shown.key, name: shown.title, fallback })
    const deviceLinks: SidebarPlaceLink[] = liveFleet.map((h) => {
      const shown = device(h.machine)
      return {
        id: `sandbox-${h.machine}`,
        label: shown.title,
        hint: [
          h.desktop ? t('Connect to this device’s live desktop session.') : t('Open a terminal on this connected device.'),
          shown.detail,
        ]
          .filter(Boolean)
          .join(' '),
        icon: h.desktop ? <Monitor size={15} aria-hidden /> : <Cloud size={15} aria-hidden />,
        onPress: () => dispatchTabsAction({ kind: h.desktop ? 'desktop' : 'shell', machine: h.machine }),
        rename: renamer(shown, showDevice({ machine: h.machine, hardware: h.hardware, sandbox: h.sandbox }, {}, devMode, t).title),
      }
    })

    const knownMachines = fleet.length > 0 ? new Set(liveFleet.map((h) => h.machine)) : null
    const recentLinks: SidebarPlaceLink[] = Object.entries(bind)
      .filter(([, b]) => {
        if (b.kind === 'page') return Boolean(b.url)
        if (b.kind === 'screen') return Boolean(b.machine) && (!knownMachines || knownMachines.has(b.machine!))
        if (b.kind === 'shell') {
          const m = b.shell?.machine ?? b.machine
          return Boolean(m) && (!knownMachines || knownMachines.has(m!))
        }
        return false
      })
      .map(([id, b]) => {
        if (b.kind === 'screen') {
          return {
            id: `tab-${id}`,
            label: b.machine ? `${t('Desktop')} · ${device(b.machine).title}` : t('Desktop'),
            icon: <Monitor size={15} aria-hidden />,
            onPress: () => dispatchTabsAction({ kind: 'focus', id }),
          }
        }
        if (b.kind === 'page') {
          let hostLabel = t('Browser')
          if (b.url) {
            try {
              hostLabel = new URL(b.url).hostname || b.url
            } catch {
              hostLabel = b.url
            }
          }
          return {
            id: `tab-${id}`,
            label: hostLabel,
            icon: <Globe size={15} aria-hidden />,
            onPress: () => dispatchTabsAction({ kind: 'focus', id }),
          }
        }
        const machine = b.shell?.machine ?? b.machine
        const name = b.shell?.name
        if (!machine) {
          return {
            id: `tab-${id}`,
            label: t('Terminal'),
            icon: <MARKS.tabs.icon size={15} aria-hidden />,
            onPress: () => dispatchTabsAction({ kind: 'focus', id }),
          }
        }
        const own = device(machine)
        const shown = showShell(own, machine, name, names)
        return {
          id: `tab-${id}`,
          label: shown.title,
          icon: <MARKS.tabs.icon size={15} aria-hidden />,
          onPress: () => dispatchTabsAction({ kind: 'focus', id }),
          rename: renamer(shown, showShell(own, machine, name, {}).title),
        }
      })

    return [
      { id: 'tabs-actions', label: '', links: quickLinks },
      ...(deviceLinks.length > 0 ? [{ id: 'devices', label: t('Devices'), links: deviceLinks }] : []),
      ...(recentLinks.length > 0 ? [{ id: 'recent-tabs', label: t('Open tabs'), links: recentLinks }] : []),
    ]
  }, [active, bind, devMode, fleet, names, onRename, t])
}

function Activity({ host }: { host: Host }) {
  const { t } = useI18n()
  const store = useSessions(host)
  const latest = [...store.value].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, RECENT)
  const hasLive = latest.some((s) => s.status === 'running' || s.status === 'pending' || s.status === 'starting')
  const items: NonNullable<DropdownMenuProps['items']> = [
    { type: 'label', key: 'head', label: t('Activity') },
    ...(latest.length
      ? latest.map((s) => ({
          key: s.id,
          label: tidy(s.title, 56, t(UNTITLED_RUN)),
          // The run's state is the service's word; when it moved is ours.
          description: [s.status, ago(s.updatedAt || s.createdAt, new Date(), t)].filter(Boolean).join(' · '),
          icon: <StatusDot status={DOTS[s.status as keyof typeof DOTS] ?? 'idle'} />,
          onSelect: () => host.go(s.id),
        }))
      : [{ key: 'none', label: t('Nothing new'), disabled: true, onSelect: () => {} }]),
  ]
  return (
    <DropdownMenu
      minWidth={280}
      trigger={
        <XStack
          render={<button type="button" />}
          data-slot="activity-bell"
          aria-label={t('Activity')}
          {...({ title: t('Activity') } as object)}
          {...HEAD}
          position="relative"
          borderWidth={0}
          bg="transparent"
          items="center"
          justify="center"
          cursor="pointer"
          opacity={0.7}
          hoverStyle={{ bg: '$hover', opacity: 1 }}
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
        >
          <ListFilter size={15} aria-hidden />
          {hasLive ? (
            <YStack
              position="absolute"
              t={5}
              r={5}
              width={6}
              height={6}
              rounded={999}
              bg="var(--state-online)"
              aria-hidden
            />
          ) : null}
        </XStack>
      }
      items={items}
    />
  )
}

export function Sidebar({
  pins,
  host,
  mode,
  thread,
  go,
  onShut,
  onSeek,
  onBack,
  onChat,
  onDev,
  onDesign,
  onFlow,
  onTabs,
  onOrg,
  inside = null,
  drawer = false,
  rail,
  foot,
  places,
  made,
}: {
  /** The pinned apps, held once by the surface so the Rail beside this agrees. */
  pins: Pins
  host: Host
  mode: Place['mode']
  /** The Chat conversation the pane holds, or null. */
  thread: string | null
  /** Moves the app to an address of this page. */
  go: (address: string) => void
  /** Fold the sidebar down to the 52px icon rail (omitted when desktop window bar owns the toggle). */
  onShut?: () => void
  /** Opens the palette. */
  onSeek?: () => void
  /** Leaves a place that took the sidebar, for where the reader was before it. */
  onBack: () => void
  /** Navigation handlers for the unified product menu. */
  onChat?: () => void
  onDev?: () => void
  onDesign?: () => void
  onFlow?: () => void
  onTabs?: () => void
  onOrg?: (org: string) => void
  inside?: string | null
  /** Drawn in the phone's drawer (Drawer.tsx): on the floor behind the pane, no edge, no handle. */
  drawer?: boolean
  /** What stands under the mode's own rows: the drawer's places, the rail's as rows. */
  rail?: ReactNode
  /** What stands at its foot: the drawer's account and New chat. */
  foot?: ReactNode
  /** The mode's places, where they are not Dev's (@hanzo/studio's `nav`). */
  places?: { id: string; label: string; links: RailLink[] }[]
  /** The host Design is mounted with (App.tsx `maker`): where its conversations are read and opened. */
  made?: Host
}) {
  const { t, dir } = useI18n()
  const [devMode, setDevMode] = useDevMode()
  const [pinnedIds, togglePin, reorderPin, movePin] = pins
  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds])
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropId, setDropId] = useState<string | null>(null)
  const anon = host.person === null
  const [anonSettingsOpen, setAnonSettingsOpen] = useState(false)
  /** Why a guest's press needs an account ("Sign in to create images"), or null while no prompt is open. */
  const [gated, setGated] = useState<string | null>(null)
  const [anonThreadTitle, setAnonThreadTitle] = useState('')
  useEffect(() => {
    if (!anon || typeof window === 'undefined') return
    try {
      const saved = window.sessionStorage.getItem('hanzo.anon.thread_title')
      if (saved) setAnonThreadTitle(saved)
    } catch {
      // ignore
    }
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ open?: boolean }>).detail
      setAnonSettingsOpen(detail?.open ?? true)
    }
    const onAnonThread = (e: Event) => {
      const detail = (e as CustomEvent<{ title?: string }>).detail
      setAnonThreadTitle(detail?.title ?? '')
    }
    window.addEventListener('hanzo:anon-settings', onOpen)
    window.addEventListener('hanzo:anon-thread', onAnonThread)
    return () => {
      window.removeEventListener('hanzo:anon-settings', onOpen)
      window.removeEventListener('hanzo:anon-thread', onAnonThread)
    }
  }, [anon])

  const uid = useId()
  const span = useSpan(SPAN, WIDTH, FLOOR, CEIL)

  const dev = (p: string) => host.go(p)
  const runtime = useScope()?.runtime
  const at = mode === 'dev' ? raised(host.path) : null
  const Make = mode === 'chat' || mode === 'dev' || mode === 'tabs' ? MARKS[mode].make : MARKS.chat.make

  const scheduled = useScheduled(host, dev, at === 'scheduled')
  // The names a person gave their devices and shells, read from their account once per page (hanzo-inc/app issue 311).
  // A host with no bearer (signed out, or a host that reads none) keeps the names in this browser only.
  const account = !anon && typeof host.token === 'function' ? host : null
  const names = useDeviceNames(account)
  const [renaming, setRenaming] = useState<Renaming | null>(null)
  const tabsGroups = useTabsGroups(t, mode === 'tabs', devMode, names, setRenaming)
  const { open: betaOpen } = useBetas()
  const hostedGroups = useMemo(() => {
    if (mode !== 'hosted') return []
    const path = typeof window !== 'undefined' ? window.location.pathname : host.path
    const links: RailLink[] = HOSTED_APPS.filter((a) => betaOpen(a.id)).map((a) => {
      const href = hosted(a.id)
      const active = path === href || path.startsWith(`${href}/`)
      return {
        id: `app-${a.id}`,
        label: a.name,
        active,
        icon: <a.icon size={16} aria-hidden />,
        onPress: () => go(href),
      }
    })
    return links.length > 0 ? [{ id: 'hosted-apps', label: '', links }] : []
  }, [mode, betaOpen, host.path, go])

  const groups =
    places && places.length > 0
      ? places
      : mode === 'hosted'
        ? hostedGroups
        : places ??
          (mode === 'tabs'
            ? tabsGroups
            : at === 'customize'
              ? tabs(host, dev, t)
              : at === 'library'
                ? library(host, dev, t)
                : at === 'scheduled'
                  ? scheduled
                  : own(host, dev, t))

  const open = (row: Recent) => (row.kind === 'chat' ? go(talk(row.id)) : dev(row.id))
  const setAnonSettings = (next: boolean) => {
    setAnonSettingsOpen(next)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hanzo:anon-settings', { detail: { open: next } }))
    }
  }

  const create = () => {
    if (anon) {
      setAnonSettings(false)
      setAnonThreadTitle('')
      try {
        window.sessionStorage.removeItem('hanzo.anon.thread_title')
      } catch {
        // ignore
      }
    }
    empty()
    go(talk())
  }

  const createPrimary = () => {
    if (anon) create()
    else if (mode === 'tabs') dispatchTabsAction({ kind: 'shell' })
    else if (mode === 'dev') dev('')
    else if (mode === 'design') made ? made.go('') : go(design(''))
    else if (mode === 'flow') go(flow('new'))
    else if (mode === 'research') go(science('autonomy'))
    else create()
  }

  const nav = useNavEntries({
    host,
    mode,
    at: host.path ?? null,
    inside,
    onChat: onChat ?? (() => go(talk())),
    onDev: onDev ?? (() => go(app(''))),
    onDesign: onDesign ?? (() => go(design(''))),
    onFlow: onFlow ?? (() => go(flow(''))),
    onTabs: onTabs ?? (() => go(TERMINALS)),
    go,
    pins,
  })

  // The reader's pins lead (under Pinned), the default apps follow in their places, and an app that lives in More draws
  // its own row (and sub-links) after them while the reader is in it. Only rendered in the phone drawer (desktop keeps
  // the permanent icon Rail beside this sidebar).
  const rest = [...nav.defaultEntries, ...nav.moreEntries.filter((item) => item.on)]
  const showMore = drawer && !at && !anon && nav.moreEntries.length > 0

  const modeTitle =
    drawer
      ? brand()
      : mode === 'chat'
        ? t('Chat')
        : mode === 'dev'
          ? 'Dev'
          : mode === 'design'
            ? 'Design'
            : mode === 'flow'
              ? 'Flow'
              : mode === 'tabs'
                ? t('Tabs')
                : mode === 'research'
                  ? t('Science')
                  : mode === 'beta'
                  ? t('Betas')
                  : mode === 'hosted'
                    ? (HOSTED_APPS.find((a) => a.id === inside)?.name ?? brand())
                    : brand()

  // Active place's own contextual places on desktop (when !at and !drawer); excludes NEW because
  // the primary "+ New …" action row stands above them.
  const desktopGroups: { id: string; label: string; links: SidebarPlaceLink[] }[] = (() => {
    if (drawer || at) return []
    if (mode === 'dev') {
      const links = own(host, dev, t).flatMap((g) => g.links).filter((l) => l.id !== NEW)
      return links.length ? [{ id: 'dev-places', label: '', links }] : []
    }
    if ((mode === 'design' || mode === 'flow' || mode === 'research') && places) {
      return places
        .map((g) => ({ ...g, links: g.links.filter((l) => l.id !== NEW) }))
        .filter((g) => g.links.length > 0)
    }
    if (mode === 'tabs') {
      return tabsGroups.filter((g) => g.links.length > 0)
    }
    if (mode === 'hosted') {
      return hostedGroups
    }
    return []
  })()

  const subGroupsFor = (entryId: string): { id: string; label: string; links: SidebarPlaceLink[] }[] => {
    if (at) return []
    if (entryId === 'dev' && mode === 'dev') {
      const links = own(host, dev, t).flatMap((g) => g.links).filter((l) => l.id !== NEW)
      return links.length ? [{ id: 'dev-sub', label: '', links }] : []
    }
    if (entryId === 'design' && mode === 'design' && places) {
      const links = places.flatMap((g) => g.links).filter((l) => l.id !== NEW)
      return links.length ? [{ id: 'design-sub', label: '', links }] : []
    }
    if (entryId === 'flow' && mode === 'flow' && places) {
      const links = places.flatMap((g) => g.links).filter((l) => l.id !== NEW)
      return links.length ? [{ id: 'flow-sub', label: '', links }] : []
    }
    if (entryId === 'science' && mode === 'research' && places) {
      const links = places.flatMap((g) => g.links).filter((l) => l.id !== NEW)
      return links.length ? [{ id: 'science-sub', label: '', links }] : []
    }
    if (entryId === 'tabs' && mode === 'tabs') {
      return tabsGroups.filter((g) => g.links.length > 0)
    }
    return []
  }

  // All primary apps in one unified reorderable list (no split Pinned header above Chat/Dev/Design).
  const seen = nav.primaryEntries.map((e) => e.id)
  const renderNavEntryWithSublinks = (item: NavEntry, allowDrop: boolean) => {
    const subGroups = item.on ? subGroupsFor(item.id) : []
    const canDrag = !anon
    return (
      <YStack key={item.id} gap={1} width="100%">
        <NavMenuRow
          item={item}
          pinned={pinnedSet.has(item.id)}
          pinnable={!anon}
          onTogglePin={togglePin}
          onMove={
            canDrag && allowDrop
              ? {
                  up: seen.indexOf(item.id) > 0 ? () => movePin(item.id, -1, seen) : undefined,
                  down: seen.indexOf(item.id) < seen.length - 1 ? () => movePin(item.id, 1, seen) : undefined,
                }
              : undefined
          }
          draggable={canDrag}
          dragging={dragId === item.id}
          dropTarget={allowDrop && dropId === item.id && dragId !== item.id}
          onDragStart={(e) => {
            setDragId(item.id)
            e.dataTransfer?.setData('text/plain', item.id)
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={
            allowDrop
              ? (e) => {
                  const src = dragId || e.dataTransfer?.getData('text/plain')
                  if (!src || src === item.id) return
                  e.preventDefault()
                  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                  if (dropId !== item.id) setDropId(item.id)
                }
              : undefined
          }
          onDragLeave={
            allowDrop
              ? () => {
                  if (dropId === item.id) setDropId(null)
                }
              : undefined
          }
          onDrop={
            allowDrop
              ? (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const src = dragId || e.dataTransfer?.getData('text/plain')
                  if (src && src !== item.id) reorderPin(src, item.id)
                  setDragId(null)
                  setDropId(null)
                }
              : undefined
          }
          onDragEnd={() => {
            setDragId(null)
            setDropId(null)
          }}
          t={t}
        />
        {subGroups.length > 0 ? (
          <YStack
            data-slot="nav-sublinks"
            marginInlineStart="$4"
            paddingInlineStart="$2.5"
            borderInlineStartWidth={1}
            borderColor="$edge"
            gap="$1.5"
            py="$1"
          >
            {subGroups.map((group, gi) => (
              <YStack key={group.id} gap={1} pt={gi > 0 && group.label ? '$1' : 0}>
                {group.label ? (
                  <Text px="$2" pb={2} fontSize="$1" fontWeight="500" color="$hint" numberOfLines={1}>
                    {group.label}
                  </Text>
                ) : null}
                <YStack role="list" aria-label={group.label || undefined} gap={1}>
                  {group.links.map((link) => (
                    <PlaceRow
                      key={link.id}
                      link={link}
                      mode={mode}
                      makeIcon={Make}
                      compact
                      t={t}
                    />
                  ))}
                </YStack>
              </YStack>
            ))}
          </YStack>
        ) : null}
        {item.id === 'dev' && mode === 'dev' && !at ? <DevList host={host} path={host.path ?? ''} onGo={go} /> : null}
      </YStack>
    )
  }

  const handleOrg =
    onOrg ??
    ((nextOrg: string) => {
      pick(nextOrg)
      if (typeof window !== 'undefined') window.location.reload()
    })

  // A guest's New is always a chat: Chat is the one place a guest's work goes.
  const primaryNewLabel = anon
    ? t('New chat')
    : mode === 'dev' ? t('New run') : mode === 'design' ? t('New design') : mode === 'flow' ? t('New flow') : mode === 'tabs' ? t('New terminal') : mode === 'research' ? t('New hypothesis') : t('New chat')

  const showPrimaryNew = !at && (drawer || (mode !== 'beta' && mode !== 'hosted'))
  const showRecents = !(mode === 'dev' && runtime) && !(mode === 'hosted' || mode === 'beta' || mode === 'research' || mode === 'tabs' || mode === 'flow' || anon || at)

  return (
    <TooltipProvider delay={120}>
      <YStack
        data-slot="app-column"
        ref={drawer ? undefined : span.ref}
        {...(drawer ? null : ({ '$platform-web': { '--span': `${span.span}px`, ...(anon ? { overflow: 'visible' } : null) } } as object))}
        position="relative"
        flex={drawer ? 1 : undefined}
        shrink={drawer ? 1 : 0}
        minW={0}
        height="100%"
        width={drawer ? undefined : `var(--span, ${WIDTH}px)`}
        maxW={drawer ? undefined : `var(--span, ${WIDTH}px)`}
        {...(drawer ? null : pane())}
      >
        <Base
          data-slot="app-rail"
          role="navigation"
          aria-label={brand()}
          {...({ onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => railKeys(e, e.currentTarget) } as object)}
          bg="transparent"
          borderWidth={0}
          {...FILL}
          px={8}
          pt={drawer ? 'var(--pane-gap)' : 4}
          pb={drawer ? 0 : '$2'}
          gap="$0"
          $platform-web={anon && !drawer ? { overflow: 'visible' } : undefined}
        >
          {/* 1. Single Top Header Row — vertically centered with first rail icon, filter/search aligned directly under < > */}
          {at ? (
            <XStack
              data-slot="app-head"
              items="center"
              gap={4}
              paddingInlineStart={0}
              paddingInlineEnd={2}
              height={drawer ? BAND : LINE}
              $touchable={drawer ? undefined : { height: TOUCH_HEAD }}
              shrink={0}
              minW={0}
              data-tauri-drag-region="deep"
              onMouseDown={dragWindow}
              onDoubleClick={toggleWindowMaximize}
            >
              <SidebarIconButton label={t('Back')} data-slot="place-back" data-tauri-drag-region="false" onPress={onBack} {...SUB_HEAD}>
                <ArrowLeft size={16} aria-hidden data-i18n-mirror />
              </SidebarIconButton>
              <Text flex={1} minW={0} fontSize={17} lineHeight={22} fontWeight="600" letterSpacing={-0.25} color="$ink" numberOfLines={1} data-slot="place-name">
                {t(TITLE[at])}
              </Text>
              {drawer || anon ? null : <Activity host={host} />}
              {anon ? null : (
                <SidebarIconButton
                  label={t('Search')}
                  data-slot="sidebar-search"
                  data-tauri-drag-region="false"
                  onPress={onSeek}
                  aria-haspopup="dialog"
                  {...SUB_HEAD}
                >
                  <Search size={15} aria-hidden />
                </SidebarIconButton>
              )}
            </XStack>
          ) : (
            <XStack
              data-slot="app-head"
              items="center"
              gap={4}
              paddingInlineStart={8}
              paddingInlineEnd={2}
              height={drawer ? BAND : LINE}
              $touchable={drawer ? undefined : { height: TOUCH_HEAD }}
              shrink={0}
              minW={0}
              data-tauri-drag-region="deep"
              onMouseDown={dragWindow}
              onDoubleClick={toggleWindowMaximize}
            >
              <XStack flex={1} minW={0} items="center" gap={4}>
                <Text data-slot="app-head-title" fontSize={18} lineHeight={22} fontWeight="600" letterSpacing={-0.3} color="$ink" numberOfLines={1}>
                  {modeTitle}
                </Text>
              </XStack>
              {drawer || anon ? null : <Activity host={host} />}
              {anon && drawer ? null : (
                <SidebarIconButton
                  label={t('Search')}
                  data-slot="sidebar-search"
                  data-tauri-drag-region="false"
                  onPress={onSeek}
                  aria-haspopup="dialog"
                  {...(drawer
                    ? {
                        width: 40,
                        height: 40,
                        rounded: 9999,
                        borderWidth: 1,
                        borderColor: 'var(--border-strong)',
                        bg: 'var(--background)',
                      }
                    : HEAD)}
                >
                  <Search size={drawer ? 18 : 15} aria-hidden />
                </SidebarIconButton>
              )}
            </XStack>
          )}

          {/* 2. Primary New Action */}
          {showPrimaryNew ? (
            <YStack role="list" gap={2} shrink={0} pt={drawer ? 0 : 2}>
              <YStack role="listitem" width="100%">
                <SidebarItem
                  data-slot="app-new"
                  {...COMPACT_ROW}
                  bg="transparent"
                  hoverStyle={{ bg: '$hover' }}
                  icon={
                    <XStack width={18} height={18} items="center" justify="center" shrink={0}>
                      <Plus size={15} aria-hidden />
                    </XStack>
                  }
                  onPress={createPrimary}
                  {...keys(createPrimary)}
                >
                  <Text fontSize="$2" fontWeight="500" color="$ink">
                    {primaryNewLabel}
                  </Text>
                </SidebarItem>
              </YStack>
              {anon ? (
                <>
                  <YStack role="listitem" self="flex-start" width="100%">
                    <SidebarItem
                      data-slot="app-images"
                      {...COMPACT_ROW}
                      bg="transparent"
                      hoverStyle={{ bg: '$hover' }}
                      icon={
                        <XStack width={18} height={18} items="center" justify="center" shrink={0}>
                          <ImageMark size={15} aria-hidden />
                        </XStack>
                      }
                      // A guest cannot make images: the press says so and offers the way in, never a silent prefill.
                      onPress={() => setGated(t('Sign in to create images'))}
                      {...keys(() => setGated(t('Sign in to create images')))}
                    >
                      <Text fontSize="$2" color="$ink">{t('Images')}</Text>
                    </SidebarItem>
                  </YStack>
                  {/* Only Chat hears hanzo:anon-plugins (its dialog), so the row is Chat's alone; Images is answered here, in every section. */}
                  {mode === 'chat' ? (
                  <YStack role="listitem" self="flex-start" width="100%">
                    <SidebarItem
                      data-slot="app-plugins"
                      {...COMPACT_ROW}
                      bg="transparent"
                      hoverStyle={{ bg: '$hover' }}
                      icon={
                        <XStack width={18} height={18} items="center" justify="center" shrink={0}>
                          <Puzzle size={15} aria-hidden />
                        </XStack>
                      }
                      onPress={() => {
                        setAnonSettings(false)
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('hanzo:anon-plugins'))
                        }
                      }}
                      {...keys(() => {
                        setAnonSettings(false)
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('hanzo:anon-plugins'))
                        }
                      })}
                    >
                      <Text fontSize="$2" color="$ink">{t('Plugins')}</Text>
                    </SidebarItem>
                  </YStack>
                  ) : null}
                </>
              ) : null}
            </YStack>
          ) : null}

          {/* 3. Contextual places (desktop beside the permanent Rail, or sub-page places `at`) */}
          {at || (!drawer && (desktopGroups.length > 0 || mode === 'dev')) || (drawer && Boolean(rail) && mode !== 'chat' && mode !== 'beta') ? (
            <YStack data-slot="app-places" shrink={0} pt={drawer ? 0 : 4}>
              {(at || drawer ? groups : desktopGroups).map((g, i) => {
                const orderedLinks = [
                  ...g.links.filter((l) => l.id === NEW),
                  ...g.links.filter((l) => l.id !== NEW),
                ]
                return (
                  <YStack key={g.id} pt={i ? '$2' : 0}>
                    {(i || (!at && !drawer)) && g.label ? (
                      <Text id={`${uid}-${g.id}`} paddingInlineStart="$2" pb={2} fontSize="$2" color="$soft">
                        {g.label}
                      </Text>
                    ) : null}
                    <YStack
                      role="list"
                      aria-labelledby={(i || (!at && !drawer)) && g.label ? `${uid}-${g.id}` : undefined}
                      aria-label={(i || (!at && !drawer)) && g.label ? undefined : g.label || (at ? t(TITLE[at]) : g.id)}
                      gap={1}
                    >
                      {orderedLinks.map((link) => (
                        <PlaceRow
                          key={link.id}
                          link={link}
                          mode={mode}
                          makeIcon={Make}
                          t={t}
                        />
                      ))}
                    </YStack>
                  </YStack>
                )
              })}
              {!drawer && !at && mode === 'dev' ? <DevList host={host} path={host.path ?? ''} onGo={go} /> : null}
            </YStack>
          ) : null}

          {/* Mobile drawer product menu (desktop keeps the permanent icon Rail beside this sidebar) */}
          {drawer && !at ? (
            <YStack
              data-slot="sidebar-nav"
              render="nav"
              aria-label={t('Products')}
              // The nav takes what it needs; Recents below scrolls in what is left, and More stays under it.
              shrink={1}
              minH={0}
              overflowY="auto"
              overflowX="hidden"
              pt="$1.5"
              gap="$1"
              $platform-web={{ scrollbarWidth: 'none' }}
            >
              {/* The reader's pins first, under Pinned (as Recents lists its pinned conversations), then the default apps
                  (Chat, Dev, Design, Library, Tabs) in their places. A drop anywhere here pins what was dragged. */}
              <YStack
                data-slot="rail-pinned"
                gap={1}
                width="100%"
                borderBottomWidth={dropId === '__pinned_end__' ? 2 : 0}
                borderBottomColor={dropId === '__pinned_end__' ? 'var(--border-selected)' : 'transparent'}
                {...(!anon
                  ? ({
                      onDragOver: (e: DragEvent) => {
                        if (!dragId) return
                        e.preventDefault()
                        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
                      },
                      onDrop: (e: DragEvent) => {
                        e.preventDefault()
                        const src = dragId || e.dataTransfer?.getData('text/plain')
                        if (src && !pinnedSet.has(src)) {
                          togglePin(src)
                        }
                        setDragId(null)
                        setDropId(null)
                      },
                    } as object)
                  : null)}
              >
                {nav.primaryEntries.map((item) => renderNavEntryWithSublinks(item, !anon))}
                {rest
                  .filter((item) => !nav.shownInPrimary.has(item.id))
                  .map((item) => renderNavEntryWithSublinks(item, !anon))}
              </YStack>

            </YStack>
          ) : null}

          {rail}

          {/* Subtle hairline between product menu and Recents */}
          {showRecents ? <XStack height={1} bg="$edge" mx="$1.5" my="$2" shrink={0} /> : null}

          {/* 4. Conversations / Runs (Pinned + Recents) */}
          {mode === 'beta' && !drawer ? (
            <YStack data-slot="beta-sidebar-slot" flex={1} minH={0} pt="$2" mt="$1.5" borderTopWidth={1} borderColor="$edge" />
          ) : anon && mode === 'chat' && anonThreadTitle ? (
            <YStack data-slot="recents" flex={1} minH={0} pt="$3">
              <Text paddingInlineStart="$2" pb="$1" fontSize="$2" color="$soft">
                {t('Recents')}
              </Text>
              <YStack role="list" gap={1}>
                <YStack role="listitem">
                  <SidebarItem
                    {...ROW}
                    active={!anonSettingsOpen}
                    onPress={() => setAnonSettings(false)}
                  >
                    <Text fontSize="$2" color="$ink" numberOfLines={1}>
                      {anonThreadTitle}
                    </Text>
                  </SidebarItem>
                </YStack>
              </YStack>
            </YStack>
          ) : !showRecents ? (
            <YStack flex={1} minH={0} />
          ) : mode === 'design' ? (
            made ? <Recents host={made} mode="design" thread={null} onOpen={open} onNew={create} /> : <YStack flex={1} minH={0} />
          ) : (
            mode === 'chat' ? <ChatList host={host} path={thread ? talk(thread) : (host.path ?? '')} onGo={go} /> : <Recents host={host} mode={mode === 'dev' ? 'dev' : 'chat'} thread={thread} onOpen={open} onNew={create} />
          )}

          {/* More: one small row under Recents that pops a menu, so the sidebar never changes height. */}
          {showMore ? (
            <YStack data-slot="rail-unpinned" shrink={0} pt="$1" width="100%">
              <MoreMenu
                placement="top-start"
                minWidth={240}
                maxHeight={320}
                entries={nav.moreEntries}
                onPin={togglePin}
                t={t}
                trigger={
                  <XStack
                    render={<button type="button" />}
                    data-slot="place-more"
                    aria-label={t('More')}
                    aria-haspopup="menu"
                    width="100%"
                    minW={0}
                    minH={34}
                    px="$2.5"
                    py={0}
                    gap="$2.5"
                    $touchable={{ minH: TOUCH }}
                    $max-sm={{ minH: TOUCH }}
                    rounded="$3"
                    borderWidth={0}
                    items="center"
                    cursor="pointer"
                    bg="transparent"
                    hoverStyle={{ bg: '$hover' }}
                    pressStyle={{ bg: '$raised' }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  >
                    <XStack width={18} height={18} items="center" justify="center" shrink={0} opacity={0.78}>
                      <MoreHorizontal size={15} aria-hidden />
                    </XStack>
                    <Text flex={1} minW={0} fontSize="$2" fontWeight="400" color="$aside" numberOfLines={1} text="start">
                      {t('More')}
                    </Text>
                  </XStack>
                }
              />
            </YStack>
          ) : null}

          {/* 5. Footer: Anonymous CTA OR Signed-in Account Profile Row */}
          {anon ? (
            <YStack
              data-slot="anon-foot"
              gap="$2"
              pt="$2"
              shrink={0}
              z="var(--z-raised)"
            >
              {/* One compact Log in, in every section: only Chat's header has its own, and Dev, Library and Design have none. */}
              <XStack items="center" gap="$1" px="$2" pt="$1" borderTopWidth={1} borderColor="$edge">
                <XStack
                  render={<button type="button" />}
                  data-slot="anon-login"
                  onClick={() => enter(LOGIN)}
                  flex={1}
                  minW={0}
                  items="center"
                  gap="$2"
                  px="$1.5"
                  py="$1"
                  minH={28}
                  $touchable={{ minH: TOUCH }}
                  $max-sm={{ minH: TOUCH }}
                  rounded="$2"
                  borderWidth={0}
                  bg="transparent"
                  cursor="pointer"
                  hoverStyle={{ bg: '$hover' }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                >
                  <LogIn size={15} aria-hidden />
                  <Text fontSize="$2" color="$ink">{t('Log in')}</Text>
                </XStack>
                {!drawer ? (
                  <XStack
                    render={<button type="button" />}
                    data-slot="anon-settings"
                    aria-label={t('Settings')}
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('hanzo:anon-settings', { detail: { open: true } }))
                      }
                    }}
                    items="center"
                    gap="$1"
                    px="$1.5"
                    py="$1"
                    minH={28}
                    $touchable={{ minH: TOUCH }}
                    $max-sm={{ minH: TOUCH }}
                    rounded="$2"
                    borderWidth={0}
                    bg="transparent"
                    cursor="pointer"
                    hoverStyle={{ bg: '$hover' }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  >
                    <Settings size={16} aria-hidden />
                  </XStack>
                ) : null}
              </XStack>
            </YStack>
          ) : at || mode === 'beta' || mode === 'hosted' ? null : devMode ? (
            <YStack gap="$2" pt="$2" shrink={0} minW={0} maxW="100%">
              <Made />
              <Setup go={go} />
            </YStack>
          ) : (
            <Made />
          )}

          <UpdatePill />
          {!anon && devMode ? (
            <XStack
              render={<button type="button" />}
              data-slot="dev-mode-indicator"
              aria-label={t('Turn off developer mode')}
              {...({ title: t('Click to turn off developer mode') } as object)}
              onClick={() => setDevMode(false)}
              items="center"
              justify="space-between"
              gap="$2"
              px="$2.5"
              py="$1"
              mx="$0.5"
              mt="$1"
              minH={28}
              $touchable={{ minH: TOUCH }}
              $max-sm={{ minH: TOUCH }}
              rounded="$3"
              bg="$panel"
              borderWidth={1}
              borderColor="var(--border-strong)"
              cursor="pointer"
              hoverStyle={{ bg: '$hover' }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              shrink={0}
            >
              <XStack items="center" gap="$1.5" minW={0} flex={1}>
                <XStack width={6} height={6} rounded={999} bg="var(--state-online)" shrink={0} aria-hidden />
                <Text fontSize="$1" fontWeight="500" color="$ink" numberOfLines={1}>
                  {t('Developer mode · On')}
                </Text>
              </XStack>
              <Text fontSize="$1" color="$soft" shrink={0}>
                {t('Off')}
              </Text>
            </XStack>
          ) : null}
          {!anon && drawer ? (
            <YStack data-slot="sidebar-account" pt="$2" mt="$1.5" borderTopWidth={1} borderColor="$edge" shrink={0}>
              <Account host={host} onOrg={handleOrg} />
            </YStack>
          ) : null}
          {foot}
        </Base>
        {drawer ? null : (
          <Gutter
            side={dir === 'rtl' ? 'right' : 'left'}
            span={span.span}
            floor={FLOOR}
            ceil={CEIL}
            reset={WIDTH}
            onSpan={span.move}
            onKeep={span.keep}
            onShut={onShut}
            label={t('Resize sidebar')}
          />
        )}
        <Dialog open={gated !== null} onOpenChange={(o) => !o && setGated(null)}>
          <DialogContent data-slot="signin-prompt" width={380} maxW="calc(100vw - 24px)" gap="$3">
            <DialogTitle>{gated ?? ''}</DialogTitle>
            <XStack gap="$2" justify="flex-end">
              <Button variant="outline" rounded={9999} data-slot="signin-prompt-login" onPress={() => enter(LOGIN)}>
                {t('Log in')}
              </Button>
              {/* The host names where an account starts (`where().signUp`: /start on hanzo.team). */}
              <Button rounded={9999} data-slot="signin-prompt-signup" onPress={() => enter(signUp())}>
                {t('Sign up for free')}
              </Button>
            </XStack>
          </DialogContent>
        </Dialog>
        <Rename
          open={renaming !== null}
          onOpenChange={(o) => !o && setRenaming(null)}
          title={t('Rename')}
          name={renaming?.name ?? ''}
          // The name is the person's, kept on their account; typed back to its own name, it keeps none. A save the account
          // refuses still keeps it in this browser.
          run={async (next) => {
            if (!renaming) return
            await rename(renaming.key, next === renaming.fallback ? '' : next, account).catch(() => {})
          }}
        />
      </YStack>
    </TooltipProvider>
  )
}

function UpdatePill() {
  const { t } = useI18n()
  const [available, setAvailable] = useState(() => {
    if (typeof window === 'undefined') return false
    return Boolean((window as unknown as { __HANZO_UPDATE_AVAILABLE__?: boolean }).__HANZO_UPDATE_AVAILABLE__)
  })
  useEffect(() => {
    const onUpdate = () => setAvailable(true)
    window.addEventListener('hanzo:update-available', onUpdate)
    return () => window.removeEventListener('hanzo:update-available', onUpdate)
  }, [])
  if (!available) return null
  return (
    <XStack
      render={<button type="button" />}
      data-slot="update-available"
      onClick={() => window.location.reload()}
      items="center"
      justify="space-between"
      px="$3"
      py="$1.5"
      mx="$1"
      mt="$1.5"
      minH={32}
      $touchable={{ minH: TOUCH }}
      $max-sm={{ minH: TOUCH }}
      rounded="$3"
      bg="$hover"
      borderWidth={1}
      borderColor="$borderColor"
      cursor="pointer"
      hoverStyle={{ opacity: 0.9 }}
      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
    >
      <Text fontSize="$2" fontWeight="500" color="$ink">
        {t('Update available')}
      </Text>
      <ArrowRight size={13} aria-hidden />
    </XStack>
  )
}

function readAnonFlag(key: string, fallback = true): boolean {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === '0' || raw === 'false') return false
    if (raw === '1' || raw === 'true') return true
  } catch {
    // ignore storage errors
  }
  return fallback
}

function writeAnonFlag(key: string, value: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // ignore storage errors
  }
}

function AnonSwitch({
  checked,
  onChange,
  label,
  slot,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  slot: string
}) {
  return <Switch checked={checked} onCheckedChange={onChange} aria-label={label} data-slot={slot} />
}

export function AnonSettingsPane({
  host,
  onClose,
}: {
  host: Host
  onClose: () => void
}) {
  const { t, locale, setLocale } = useI18n()
  const themeVal: Theme = host.theme ?? 'system'
  const setThemeVal = (next: Theme) => host.chooseTheme?.(next)
  const target = useMemo(() => ({ api: host.api, token: host.token, org: host.org }), [host.api, host.token, host.org])
  const [spoken, speakIn] = useLanguage(target)
  const [autoLang, setAutoLang] = useState(() => !spoken)
  const currentLang = spoken || locale || 'en'

  const [improveModel, setImproveModel] = useState(() => readAnonFlag('hanzo.anon.improve_model', true))
  const [personalizeAds, setPersonalizeAds] = useState(() => readAnonFlag('hanzo.anon.personalize_ads', true))
  const [marketingMeasurement, setMarketingMeasurement] = useState(() => readAnonFlag('hanzo.anon.marketing_measurement', true))
  const [personalizedMarketing, setPersonalizedMarketing] = useState(() => readAnonFlag('hanzo.anon.personalized_marketing', true))

  const themeLabel = themeVal === 'light' ? t('Light') : themeVal === 'dark' ? t('Dark') : t('System')
  const langLabel = autoLang ? t('Auto-detect') : (locales.find((l) => l.code === currentLang)?.name ?? 'English')

  const themeItems: NonNullable<DropdownMenuProps['items']> = [
    { key: 'system', label: t('System'), onSelect: () => setThemeVal('system') },
    { key: 'dark', label: t('Dark'), onSelect: () => setThemeVal('dark') },
    { key: 'light', label: t('Light'), onSelect: () => setThemeVal('light') },
  ]

  const langItems: NonNullable<DropdownMenuProps['items']> = [
    {
      key: 'auto',
      label: t('Auto-detect'),
      onSelect: () => {
        setAutoLang(true)
        speakIn(null)
      },
    },
    ...locales.map((loc) => ({
      key: loc.code,
      label: loc.name,
      description: loc.englishName !== loc.name ? loc.englishName : undefined,
      onSelect: () => {
        setAutoLang(false)
        void setLocale?.(loc.code)
        speakIn(loc.code)
      },
    })),
  ]

  return (
    <YStack data-slot="anon-settings-pane" flex={1} minW={0} minH={0} overflowY="auto" overflowX="hidden">
      <XStack height={56} px="$4" items="center" justify="space-between" shrink={0}>
        <XStack
          render={<button type="button" />}
          aria-label={t('Back')}
          data-slot="anon-settings-back"
          width={36}
          height={36}
          $touchable={{ minW: TOUCH, minH: TOUCH }}
          $max-sm={{ minW: TOUCH, minH: TOUCH }}
          rounded={9999}
          borderWidth={0}
          bg="transparent"
          items="center"
          justify="center"
          cursor="pointer"
          hoverStyle={{ bg: '$hover' }}
          onClick={onClose}
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
        >
          <ArrowLeft size={16} aria-hidden data-i18n-mirror />
        </XStack>
        <Text fontSize="$4" fontWeight="600" color="$ink">
          {t('Settings')}
        </Text>
        <XStack width={36} height={36} />
      </XStack>

      <YStack width="100%" maxW={600} mx="auto" px="$4" py="$5" gap="$6">
        <YStack gap="$2.5">
          <Text fontSize="$3" fontWeight="600" color="$ink">
            {t('General')}
          </Text>
          <YStack rounded="$5" borderWidth={1} borderColor="$borderColor" bg="var(--surface-card)" px="$4">
            <XStack py="$3.5" items="center" justify="space-between" gap="$3">
              <Text fontSize="$3" color="$ink">
                {t('Appearance')}
              </Text>
              <DropdownMenu
                minWidth={160}
                items={themeItems}
                trigger={
                  <XStack
                    render={<button type="button" />}
                    data-slot="anon-settings-appearance"
                    items="center"
                    gap="$1.5"
                    px="$2.5"
                    py="$1.5"
                    minH={32}
                    $touchable={{ minH: TOUCH }}
                    $max-sm={{ minH: TOUCH }}
                    rounded="$3"
                    borderWidth={0}
                    bg="transparent"
                    cursor="pointer"
                    hoverStyle={{ bg: '$hover' }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  >
                    <Text fontSize="$3" color="$ink">
                      {themeLabel}
                    </Text>
                    <ChevronDown size={14} aria-hidden color="var(--soft, var(--muted-foreground))" />
                  </XStack>
                }
              />
            </XStack>

            <XStack py="$3.5" items="center" justify="space-between" gap="$3">
              <Text fontSize="$3" color="$ink">
                {t('Language')}
              </Text>
              <DropdownMenu
                minWidth={200}
                items={langItems}
                trigger={
                  <XStack
                    render={<button type="button" />}
                    data-slot="anon-settings-language"
                    items="center"
                    gap="$1.5"
                    px="$2.5"
                    py="$1.5"
                    minH={32}
                    $touchable={{ minH: TOUCH }}
                    $max-sm={{ minH: TOUCH }}
                    rounded="$3"
                    borderWidth={0}
                    bg="transparent"
                    cursor="pointer"
                    hoverStyle={{ bg: '$hover' }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  >
                    <Text fontSize="$3" color="$ink">
                      {langLabel}
                    </Text>
                    <ChevronDown size={14} aria-hidden color="var(--soft, var(--muted-foreground))" />
                  </XStack>
                }
              />
            </XStack>
          </YStack>
        </YStack>

        <YStack gap="$2.5">
          <Text fontSize="$3" fontWeight="600" color="$ink">
            {t('Data controls')}
          </Text>
          <YStack rounded="$5" borderWidth={1} borderColor="$borderColor" bg="var(--surface-card)" px="$4">
            <XStack py="$3.5" items="center" justify="space-between" gap="$4">
              <YStack flex={1} minW={0} gap="$1">
                <Text fontSize="$3" fontWeight="500" color="$ink">
                  {t('Improve the model for everyone')}
                </Text>
                <Text fontSize="$1" color="$soft">
                  {t('Allow your content to be used to train our models, which makes Hanzo better for you and everyone who uses it. We take steps to protect your privacy.')}{' '}
                  <Text
                    render="a"
                    {...({ href: '/privacy', target: '_blank', rel: 'noopener noreferrer' } as object)}
                    fontSize="$1"
                    color="$ink"
                    textDecorationLine="none"
                  >
                    {t('Learn more')}
                  </Text>
                </Text>
              </YStack>
              <AnonSwitch
                checked={improveModel}
                label={t('Improve the model for everyone')}
                slot="anon-switch-improve"
                onChange={(next) => {
                  setImproveModel(next)
                  writeAnonFlag('hanzo.anon.improve_model', next)
                }}
              />
            </XStack>

            <XStack py="$3.5" items="center" justify="space-between" gap="$4">
              <YStack flex={1} minW={0} gap="$1">
                <Text fontSize="$3" fontWeight="500" color="$ink">
                  {t('Personalize ads')}
                </Text>
                <Text fontSize="$1" color="$soft">
                  {t('Allow Hanzo to use your past chats, activity, and preferences to select ads. Ads may still be based on your current chat.')}
                </Text>
              </YStack>
              <AnonSwitch
                checked={personalizeAds}
                label={t('Personalize ads')}
                slot="anon-switch-ads"
                onChange={(next) => {
                  setPersonalizeAds(next)
                  writeAnonFlag('hanzo.anon.personalize_ads', next)
                }}
              />
            </XStack>

            <XStack py="$3.5" items="center" justify="space-between" gap="$4">
              <YStack flex={1} minW={0} gap="$1">
                <Text fontSize="$3" fontWeight="500" color="$ink">
                  {t('Marketing measurement')}
                </Text>
                <Text fontSize="$1" color="$soft">
                  {t('These cookies help us measure the effectiveness of our marketing campaigns.')}
                </Text>
              </YStack>
              <AnonSwitch
                checked={marketingMeasurement}
                label={t('Marketing measurement')}
                slot="anon-switch-measurement"
                onChange={(next) => {
                  setMarketingMeasurement(next)
                  writeAnonFlag('hanzo.anon.marketing_measurement', next)
                }}
              />
            </XStack>

            <XStack py="$3.5" items="center" justify="space-between" gap="$4">
              <YStack flex={1} minW={0} gap="$1">
                <Text fontSize="$3" fontWeight="500" color="$ink">
                  {t('Personalized marketing')}
                </Text>
                <Text fontSize="$1" color="$soft">
                  {t("This helps us personalize and measure Hanzo's own marketing on third-party platforms.")}
                </Text>
              </YStack>
              <AnonSwitch
                checked={personalizedMarketing}
                label={t('Personalized marketing')}
                slot="anon-switch-marketing"
                onChange={(next) => {
                  setPersonalizedMarketing(next)
                  writeAnonFlag('hanzo.anon.personalized_marketing', next)
                }}
              />
            </XStack>
          </YStack>
        </YStack>
      </YStack>
    </YStack>
  )
}
