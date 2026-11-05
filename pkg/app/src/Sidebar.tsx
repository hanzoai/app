'use client'

// The app's sidebar, beside the rail on the window's floor (App.tsx): the
// mode's name with the bell and the search at its end, New, Dev's places in
// Dev, the reader's Recents (Pinned first), and the first-run cards. Which
// product it lists is the rail's to say; the account is at the rail's foot, or
// on a phone at the foot of its menu (Drawer.tsx), where this column is the menu.
//
// It is the window, not a panel: no fill, no edge, the floor's own ground. The
// content beside it is the panel, inset by the gutter.
//
// The bell is the org's run activity (@hanzo/build `useSessions`): the runs
// that moved last, each one press from its page.
// The search opens the palette (Search.tsx; ⌘K / Ctrl+K from anywhere).
//
// Dev's places are @hanzo/build's `own`: New run, Projects, Issues, Templates.
// A place the rail holds (Library, Scheduled tasks, Customize) takes the sidebar
// instead (Rail.tsx `raised`): Back, the place's name, and its own rows
// (Customize's tabs, the Library's kinds), never Dev's beside them. Settings is
// the site's pages at /settings, with a column of their own.
//
// Its width is the edge's in the gutter at its end: dragged, keyed or
// double-clicked back (@hanzo/build's `Grip`), kept per browser. Pulled in past
// its floor it shuts (`onShut`), as the sidebar's toggle shuts it. Right to left
// the column stands at the window's right, so the grip is on its left edge.
//
// Its words go through `t`; Dev's places and the places' rows are
// @hanzo/build's own labels, drawn as the package names them.

import { locales, phrase } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { Text, XStack, YStack } from '@hanzo/gui'
import { ArrowLeft, Bell, ChevronDown, ChevronUp, CircleHelp, Cloud, Globe, Image as ImageMark, Monitor, Puzzle, Search, Settings, Sparkles, SquarePen, SquareTerminal } from 'lucide-react'
import { DOTS, Gutter, library, NEW, own, tabs, useLanguage, useScheduled, useSessions, type Host } from '@hanzo/build'

type Theme = NonNullable<Host['theme']>
import { tidy } from './lib/title'
import { Button, DropdownMenu, type DropdownMenuProps } from '@hanzo/ui'
import { Sidebar as Base, SidebarIconButton, SidebarItem, StatusDot, type RailLink } from '@hanzo/ui/chat'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Made } from './Account'
import { Recents } from './Recents'
import { MARK, RAIL, raised, type Raised } from './Rail'
import { Setup } from './Setup'
import { ago, UNTITLED_RUN, type Recent } from './recent'
import { empty } from './open'
import { useSpan } from './span'
import { useFree } from './Upgrade'
import { talk, type Place } from './lib/host'
import { payUrl } from './lib/pay'
import { brand, wordmark } from './where'
import { dragWindow, toggleWindowMaximize } from './WindowControls'
import { BAND, HEAD as LINE, TOUCH_HEAD } from './ground'

/** The sidebar fills the column. Its `width` is typed in px alone, though its frame takes any gui size — the type is
 *  @hanzo/ui's to widen. */
const FILL = { width: '100%' } as object

/** The sidebar's width, px: its default, and the two a drag holds it between. */
const WIDTH = 240
const FLOOR = 200
const CEIL = 420
/** Per reader, per browser. */
const SPAN = 'hanzo.app.column'

/** Enter and Space press a row the way a click does. */
const keys = (press: () => void) => ({
  onKeyDown: (e: { key?: string; preventDefault?: () => void }) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault?.()
    press()
  },
})

/** A row of the sidebar: a pill on a 36px pitch matching the rail's mark height, a thumb's 44 on a touch screen, lit where the reader is. */
const ROW = { rounded: '$4', minH: MARK, py: 0, px: '$2', $touchable: { minH: 44 } } as const

/** A sidebar link row hugs its icon and label rather than stretching across the full column width. */
const COMPACT_ROW = { ...ROW, self: 'flex-start', '$platform-web': { width: 'fit-content', maxWidth: '100%' } } as const

/** The run activity behind the bell: the runs that moved last, newest first. */
const RECENT = 6

/** What a place that takes the sidebar is called at its head. */
const TITLE: Record<Raised, string> = { library: phrase('Library'), scheduled: phrase('Scheduled tasks'), customize: phrase('Customize') }

/** A header mark: a 16px glyph in a 32px target, a thumb's 44 on a touch screen. */
const HEAD = { width: 32, height: 32, rounded: '$3', $touchable: { width: 44, height: 44 } } as const

interface TabsFleetHost {
  machine: string
  label?: string
  status?: string
  desktop?: boolean
}

interface TabsSavedBind {
  kind: string
  shell?: { machine: string; name: string }
  machine?: string
  url?: string
  want?: string
}

function dispatchTabsAction(detail: { kind: string; id?: string; machine?: string }) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('hanzo:tabs-action', { detail }))
}

function useTabsGroups(t: (key: string, params?: Record<string, string | number>) => string, active: boolean): { id: string; label: string; links: RailLink[] }[] {
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
    const quickLinks: RailLink[] = [
      {
        id: 'new-terminal',
        label: t('New terminal'),
        icon: <SquareTerminal size={16} aria-hidden />,
        onPress: () => dispatchTabsAction({ kind: 'shell' }),
      },
      {
        id: 'new-desktop',
        label: t('New desktop'),
        icon: <Monitor size={16} aria-hidden />,
        onPress: () => dispatchTabsAction({ kind: 'desktop' }),
      },
      {
        id: 'new-browser',
        label: t('New browser'),
        icon: <Globe size={16} aria-hidden />,
        onPress: () => dispatchTabsAction({ kind: 'page' }),
      },
      {
        id: 'new-cloud',
        label: t('New sandbox'),
        icon: <Cloud size={16} aria-hidden />,
        onPress: () => dispatchTabsAction({ kind: 'cloud' }),
      },
    ]

    const sandboxLinks: RailLink[] =
      fleet.length > 0
        ? fleet.map((h) => ({
            id: `sandbox-${h.machine}`,
            label: h.label ? `${h.machine} · ${h.label}` : h.machine,
            icon: h.desktop ? <Monitor size={16} aria-hidden /> : <Cloud size={16} aria-hidden />,
            onPress: () => dispatchTabsAction({ kind: h.desktop ? 'desktop' : 'shell', machine: h.machine }),
          }))
        : [
            {
              id: 'sandbox-launch',
              label: t('Launch cloud sandbox'),
              icon: <Cloud size={16} aria-hidden />,
              onPress: () => dispatchTabsAction({ kind: 'cloud' }),
            },
          ]

    const recentLinks: RailLink[] = Object.entries(bind).map(([id, b]) => {
      if (b.kind === 'screen') {
        return {
          id: `tab-${id}`,
          label: b.machine ? `${t('Desktop')} · ${b.machine}` : t('Desktop'),
          icon: <Monitor size={16} aria-hidden />,
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
          icon: <Globe size={16} aria-hidden />,
          onPress: () => dispatchTabsAction({ kind: 'focus', id }),
        }
      }
      const machine = b.shell?.machine ?? b.machine
      const name = b.shell?.name
      return {
        id: `tab-${id}`,
        label: machine ? `${machine}${name ? ` (${name})` : ''}` : t('Terminal'),
        icon: <SquareTerminal size={16} aria-hidden />,
        onPress: () => dispatchTabsAction({ kind: 'focus', id }),
      }
    })

    return [
      { id: 'tabs-actions', label: '', links: quickLinks },
      { id: 'sandboxes', label: t('Sandboxes'), links: sandboxLinks },
      ...(recentLinks.length > 0 ? [{ id: 'recent-tabs', label: t('Open tabs'), links: recentLinks }] : []),
    ]
  }, [active, bind, fleet, t])
}

function Activity({ host }: { host: Host }) {
  const { t } = useI18n()
  const store = useSessions(host)
  const latest = [...store.value].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, RECENT)
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
          render="button"
          aria-label={t('Activity')}
          {...({ title: t('Activity') } as object)}
          {...HEAD}
          items="center"
          justify="center"
          cursor="pointer"
          opacity={0.7}
          hoverStyle={{ bg: '$hover', opacity: 1 }}
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
        >
          <Bell size={16} aria-hidden />
        </XStack>
      }
      items={items}
    />
  )
}

export function Sidebar({
  host,
  mode,
  thread,
  go,
  onShut,
  onSeek,
  onBack,
  drawer = false,
  rail,
  foot,
  places,
}: {
  host: Host
  mode: Place['mode']
  /** The Chat conversation the pane holds, or null. */
  thread: string | null
  /** Moves the app to an address of this page. */
  go: (address: string) => void
  /** Shut the sidebar: its edge pulled in past the floor. */
  onShut: () => void
  /** Opens the palette. */
  onSeek?: () => void
  /** Leaves a place that took the sidebar, for where the reader was before it. */
  onBack: () => void
  /** Drawn in the phone's drawer (Drawer.tsx): on the floor behind the pane, no edge, no handle. */
  drawer?: boolean
  /** What stands under the mode's own rows: the drawer's places, the rail's as rows. */
  rail?: ReactNode
  /** What stands at its foot: the drawer's account and New chat. */
  foot?: ReactNode
  /** The mode's places, where they are not Dev's (Studio's `nav`). */
  places?: { id: string; label: string; links: RailLink[] }[]
}) {
  const { t, dir } = useI18n()
  const anon = host.person === null
  const free = useFree(Boolean(host.token?.())) || anon
  const [anonSettingsOpen, setAnonSettingsOpen] = useState(false)
  const [tailoredOpen, setTailoredOpen] = useState(true)
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
  // The desktop sidebar and a phone's drawer can both be in the page: each names its own group labels.
  const uid = useId()
  const span = useSpan(SPAN, WIDTH, FLOOR, CEIL)

  const dev = (p: string) => host.go(p)
  const at = mode === 'dev' ? raised(host.path) : null
  // Each place the rail holds lists its own rows: Library its kinds and Upload, Scheduled tasks its tasks and New task.
  const scheduled = useScheduled(host, dev, at === 'scheduled')
  const tabsGroups = useTabsGroups(t, mode === 'tabs')
  const groups =
    places ??
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
  // Chat's New; Dev's is the first of its places.
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

  return (
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
    >
      <Base
        data-slot="app-rail"
        role="navigation"
        aria-label={brand()}
        bg="transparent"
        borderWidth={0}
        {...FILL}
        px="$2"
        pt={drawer ? 'var(--pane-gap)' : 0}
        // In the drawer the menu's own foot padding is the gap; its foot row stands on it.
        pb={drawer ? 0 : '$2'}
        gap="$0"
        $platform-web={anon && !drawer ? { overflow: 'visible' } : undefined}
      >
        {at ? (
          <XStack
            data-slot="app-head"
            items="center"
            gap="$1"
            paddingInlineStart={2}
            paddingInlineEnd={2}
            // The phone's drawer lines up with its bar (BAND); beside the rail, with the rail's first mark (ground.ts HEAD).
            height={drawer ? BAND : LINE}
            $touchable={drawer ? undefined : { height: TOUCH_HEAD }}
            shrink={0}
            minW={0}
            data-tauri-drag-region="deep"
            onMouseDown={dragWindow}
            onDoubleClick={toggleWindowMaximize}
          >
            <SidebarIconButton label={t('Back')} data-slot="place-back" data-tauri-drag-region="false" onPress={onBack} {...HEAD}>
              <ArrowLeft size={16} aria-hidden data-i18n-mirror />
            </SidebarIconButton>
            <Text flex={1} minW={0} fontSize={18} lineHeight={24} fontWeight="600" color="$ink" numberOfLines={1} data-slot="place-name">
              {t(TITLE[at])}
            </Text>
          </XStack>
        ) : (
          <XStack
            data-slot="app-head"
            items="center"
            gap="$1"
            paddingInlineStart={4}
            paddingInlineEnd={2}
            // The phone's drawer lines up with its bar (BAND); beside the rail, with the rail's first mark (ground.ts HEAD).
            height={drawer ? BAND : LINE}
            $touchable={drawer ? undefined : { height: TOUCH_HEAD }}
            shrink={0}
            minW={0}
            data-tauri-drag-region="deep"
            onMouseDown={dragWindow}
            onDoubleClick={toggleWindowMaximize}
          >
            <Text flex={1} minW={0} fontSize={24} lineHeight={28} fontWeight="700" color="$ink" numberOfLines={1}>
              {wordmark(mode)}
            </Text>
            {drawer || anon ? null : <Activity host={host} />}
            {anon ? null : (
              <SidebarIconButton
                label={t('Search')}
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
                      bg: 'var(--pane-fill)',
                    }
                  : HEAD)}
              >
                <Search size={drawer ? 18 : 16} aria-hidden />
              </SidebarIconButton>
            )}
          </XStack>
        )}
        {mode === 'chat' ? (
          <YStack role="list" gap={2} shrink={0} pt={drawer ? 0 : 4}>
            <YStack role="listitem" self="flex-start">
              {/* Current while the pane holds a new conversation, and never lit: the reference lights the conversation open, not New. */}
              <SidebarItem
                data-slot="app-new"
                {...COMPACT_ROW}
                active={!thread && !anonSettingsOpen && !anonThreadTitle}
                bg="transparent"
                hoverStyle={{ bg: '$hover' }}
                icon={
                  <XStack width={20} height={20} items="center" justify="center" shrink={0}>
                    <SquarePen size={16} aria-hidden />
                  </XStack>
                }
                onPress={create}
                {...keys(create)}
              >
                <Text fontSize="$3" color="$ink">{t('New chat')}</Text>
              </SidebarItem>
            </YStack>
            {anon ? (
              <>
                <YStack role="listitem" self="flex-start">
                  <SidebarItem
                    data-slot="app-images"
                    {...COMPACT_ROW}
                    bg="transparent"
                    hoverStyle={{ bg: '$hover' }}
                    icon={
                      <XStack width={20} height={20} items="center" justify="center" shrink={0}>
                        <ImageMark size={16} aria-hidden />
                      </XStack>
                    }
                    onPress={() => {
                      create()
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('hanzo:anon-prompt', { detail: { text: t('Create an image of ') } }))
                      }
                    }}
                    {...keys(() => {
                      create()
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('hanzo:anon-prompt', { detail: { text: t('Create an image of ') } }))
                      }
                    })}
                  >
                    <Text fontSize="$3" color="$ink">{t('Images')}</Text>
                  </SidebarItem>
                </YStack>
                <YStack role="listitem" self="flex-start">
                  <SidebarItem
                    data-slot="app-plugins"
                    {...COMPACT_ROW}
                    bg="transparent"
                    hoverStyle={{ bg: '$hover' }}
                    icon={
                      <XStack width={20} height={20} items="center" justify="center" shrink={0}>
                        <Puzzle size={16} aria-hidden />
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
                    <Text fontSize="$3" color="$ink">{t('Plugins')}</Text>
                  </SidebarItem>
                </YStack>
              </>
            ) : null}
          </YStack>
        ) : mode === 'beta' && !drawer ? null : (
          <YStack data-slot="app-places" shrink={0} pt={drawer ? 0 : 4}>
            {groups.map((g, i) => (
              <YStack key={g.id} pt={i ? '$2' : 0}>
                {/* The same quiet label Recents wears, so the sidebar reads as one list of headed parts. */}
                {i && g.label ? (
                  <Text id={`${uid}-${g.id}`} paddingInlineStart="$2" pb={2} fontSize="$3" color="$soft">
                    {g.label}
                  </Text>
                ) : null}
                <YStack role="list" aria-labelledby={i && g.label ? `${uid}-${g.id}` : undefined} aria-label={i && g.label ? undefined : g.label || (at ? t(TITLE[at]) : g.id)} gap={1}>
                  {g.links.map((link) => (
                    <YStack key={link.id} role="listitem" self="flex-start">
                      <SidebarItem
                        {...COMPACT_ROW}
                        data-place-id={link.id}
                        {...(link.id === NEW ? { 'data-slot': 'app-new' } : {})}
                        active={link.active}
                        icon={
                          link.id === NEW ? (
                            <XStack width={20} height={20} items="center" justify="center" shrink={0}>
                              <SquarePen size={16} aria-hidden />
                            </XStack>
                          ) : link.icon ? (
                            <XStack width={20} height={20} items="center" justify="center" shrink={0}>
                              {link.icon}
                            </XStack>
                          ) : null
                        }
                        onPress={link.onPress}
                        {...keys(() => link.onPress?.())}
                      >
                        <Text fontSize="$3" color={link.active ? '$ink' : '$quiet'}>
                          {link.label}
                        </Text>
                      </SidebarItem>
                    </YStack>
                  ))}
                </YStack>
              </YStack>
            ))}
          </YStack>
        )}
        {rail}
        {/* Recents fills the column; where there are none the foot is still pushed to the column's foot, on the rail's line. */}
        {mode === 'beta' && !drawer ? (
          <YStack data-slot="beta-sidebar-slot" flex={1} minH={0} pt={4} />
        ) : anon && mode === 'chat' && anonThreadTitle ? (
          <YStack data-slot="recents" flex={1} minH={0} pt="$3">
            <Text paddingInlineStart="$2" pb="$1" fontSize="$3" color="$soft">
              {t('Recents')}
            </Text>
            <YStack role="list" gap={1}>
              <YStack role="listitem">
                <SidebarItem
                  {...ROW}
                  active={!anonSettingsOpen}
                  onPress={() => setAnonSettings(false)}
                >
                  <Text fontSize="$3" color="$ink" numberOfLines={1}>
                    {anonThreadTitle}
                  </Text>
                </SidebarItem>
              </YStack>
            </YStack>
          </YStack>
        ) : mode === 'hosted' || mode === 'beta' || anon || at ? (
          <YStack flex={1} minH={0} />
        ) : (
          <Recents host={host} mode={mode === 'dev' ? 'dev' : 'chat'} thread={thread} onOpen={open} onNew={create} />
        )}
        {anon ? (
          <YStack
            data-slot="anon-foot"
            gap="$2"
            pt="$2"
            shrink={0}
            z={10}
          >
            <YStack data-slot="anon-tailored" gap="$2" pt="$1" pb="$1" px="$2">
              <XStack
                render="button"
                aria-expanded={tailoredOpen}
                aria-label={t('Get responses tailored to you')}
                items="center"
                justify="space-between"
                gap="$1.5"
                cursor="pointer"
                onPress={() => setTailoredOpen((v) => !v)}
                hoverStyle={{ opacity: 0.85 }}
              >
                <Text fontSize={13} lineHeight={18} fontWeight="700" color="$ink" numberOfLines={1} flex={1}>
                  {t('Get responses tailored to you')}
                </Text>
                {tailoredOpen ? (
                  <ChevronDown size={14} aria-hidden color="var(--soft, var(--muted-foreground))" />
                ) : (
                  <ChevronUp size={14} aria-hidden color="var(--soft, var(--muted-foreground))" />
                )}
              </XStack>
              {tailoredOpen ? (
                <Text fontSize={12} lineHeight={17} color="$soft">
                  {t('Log in to get answers based on saved chats, plus create images and upload files.')}
                </Text>
              ) : null}
              <XStack gap="$2" pt="$0.5">
                <Button
                  size="sm"
                  variant="outline"
                  flex={1}
                  rounded={9999}
                  data-slot="column-login"
                  onPress={() => {
                    if (typeof window !== 'undefined') window.location.assign('/login?next=%2Fchat')
                  }}
                >
                  {t('Log in')}
                </Button>
                <Button
                  size="sm"
                  flex={1}
                  rounded={9999}
                  data-slot="column-signup"
                  onPress={() => {
                    if (typeof window !== 'undefined') window.location.assign('/signup?next=%2Fchat')
                  }}
                >
                  {t('Sign up')}
                </Button>
              </XStack>
            </YStack>
          </YStack>
        ) : at || mode === 'beta' || mode === 'hosted' ? null : (
          <YStack gap="$2" pt="$2" shrink={0} minW={0} maxW="100%">
            <Made />
            <Setup go={go} />
          </YStack>
        )}
        {!anon && free && (drawer || (mode !== 'beta' && mode !== 'hosted')) ? (
          <YStack role="list" gap={2} shrink={0} pt="$2">
            {/* A mark's height, centred: the rail's account beside it stands on the same line. */}
            <YStack role="listitem" minH={MARK} justify="center">
              <SidebarItem
                {...ROW}
                data-slot="column-upgrade"
                icon={
                  <XStack width={20} height={20} items="center" justify="center" shrink={0}>
                    <Sparkles size={16} aria-hidden color="var(--primary)" />
                  </XStack>
                }
                onPress={() => window.location.assign(payUrl('/cart', { returnUrl: window.location.href }))}
                {...keys(() => window.location.assign(payUrl('/cart', { returnUrl: window.location.href })))}
              >
                <Text fontSize="$3" color="$ink">{t('Upgrade plan')}</Text>
              </SidebarItem>
            </YStack>
          </YStack>
        ) : null}
        {foot}
      </Base>
      {drawer ? null : (
        // In the gutter between the sidebar and the pane, the side panel's handle on this edge:
        // the column is pinned to the start, the window's left, or its right read right to left.
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
    </YStack>
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
  return (
    <XStack
      render="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-slot={slot}
      width={40}
      height={22}
      p={2}
      rounded={9999}
      items="center"
      cursor="pointer"
      shrink={0}
      bg={checked ? '#0285ff' : 'rgba(128, 128, 128, 0.35)'}
      onPress={() => onChange(!checked)}
      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
    >
      <XStack
        width={18}
        height={18}
        rounded={9999}
        bg="#ffffff"
        style={{
          transform: checked ? 'translateX(18px)' : 'translateX(0px)',
          transition: 'transform 150ms ease',
        }}
      />
    </XStack>
  )
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
          render="button"
          aria-label={t('Back')}
          data-slot="anon-settings-back"
          width={36}
          height={36}
          rounded={9999}
          borderWidth={0}
          items="center"
          justify="center"
          cursor="pointer"
          hoverStyle={{ bg: '$hover' }}
          onPress={onClose}
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
        >
          <ArrowLeft size={16} aria-hidden data-i18n-mirror />
        </XStack>
        <Text fontSize={16} fontWeight="600" color="$ink">
          {t('Settings')}
        </Text>
        <XStack width={36} height={36} />
      </XStack>

      <YStack width="100%" maxW={600} mx="auto" px="$4" py="$5" gap="$6">
        <YStack gap="$2.5">
          <Text fontSize={14} fontWeight="600" color="$ink">
            {t('General')}
          </Text>
          <YStack rounded="$5" borderWidth={1} borderColor="$borderColor" bg="var(--white-03, $panel)" px="$4">
            <XStack py="$3.5" items="center" justify="space-between" gap="$3">
              <Text fontSize={14} color="$ink">
                {t('Appearance')}
              </Text>
              <DropdownMenu
                minWidth={160}
                items={themeItems}
                trigger={
                  <XStack
                    render="button"
                    data-slot="anon-settings-appearance"
                    items="center"
                    gap="$1.5"
                    px="$2.5"
                    py="$1.5"
                    rounded="$3"
                    cursor="pointer"
                    hoverStyle={{ bg: '$hover' }}
                  >
                    <Text fontSize={14} color="$ink">
                      {themeLabel}
                    </Text>
                    <ChevronDown size={14} aria-hidden color="var(--soft, var(--muted-foreground))" />
                  </XStack>
                }
              />
            </XStack>

            <XStack py="$3.5" items="center" justify="space-between" gap="$3">
              <Text fontSize={14} color="$ink">
                {t('Language')}
              </Text>
              <DropdownMenu
                minWidth={200}
                items={langItems}
                trigger={
                  <XStack
                    render="button"
                    data-slot="anon-settings-language"
                    items="center"
                    gap="$1.5"
                    px="$2.5"
                    py="$1.5"
                    rounded="$3"
                    cursor="pointer"
                    hoverStyle={{ bg: '$hover' }}
                  >
                    <Text fontSize={14} color="$ink">
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
          <Text fontSize={14} fontWeight="600" color="$ink">
            {t('Data controls')}
          </Text>
          <YStack rounded="$5" borderWidth={1} borderColor="$borderColor" bg="var(--white-03, $panel)" px="$4">
            <XStack py="$3.5" items="center" justify="space-between" gap="$4">
              <YStack flex={1} minW={0} gap="$1">
                <Text fontSize={14} fontWeight="500" color="$ink">
                  {t('Improve the model for everyone')}
                </Text>
                <Text fontSize={12} lineHeight={18} color="$soft">
                  {t('Allow your content to be used to train our models, which makes Hanzo better for you and everyone who uses it. We take steps to protect your privacy.')}{' '}
                  <Text
                    render="a"
                    {...({ href: '/privacy', target: '_blank', rel: 'noopener noreferrer' } as object)}
                    fontSize={12}
                    lineHeight={18}
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
                <Text fontSize={14} fontWeight="500" color="$ink">
                  {t('Personalize ads')}
                </Text>
                <Text fontSize={12} lineHeight={18} color="$soft">
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
                <Text fontSize={14} fontWeight="500" color="$ink">
                  {t('Marketing measurement')}
                </Text>
                <Text fontSize={12} lineHeight={18} color="$soft">
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
                <Text fontSize={14} fontWeight="500" color="$ink">
                  {t('Personalized marketing')}
                </Text>
                <Text fontSize={12} lineHeight={18} color="$soft">
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
