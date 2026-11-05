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
import { SizableText, Text, XStack, YStack } from '@hanzo/gui'
import { ArrowLeft, Bell, ChevronDown, ChevronUp, CircleHelp, Image as ImageMark, Languages, Monitor, Moon, Palette, Puzzle, Search, Settings, Sparkles, SquarePen, Sun } from 'lucide-react'
import { DOTS, Gutter, library, NEW, own, tabs, useLanguage, useScheduled, useSessions, type Host } from '@hanzo/build'

type Theme = NonNullable<Host['theme']>
import { tidy } from './lib/title'
import { Button, Dialog, DialogContent, DialogTitle, DropdownMenu, type DropdownMenuProps } from '@hanzo/ui'
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

/** A row of the sidebar: a pill on a 31px pitch, a thumb's 44 on a touch screen, lit where the reader is. */
const ROW = { rounded: '$4', minH: 31, py: 0, px: '$2', $touchable: { minH: 44 } } as const

/** A sidebar link row hugs its icon and label rather than stretching across the full column width. */
const COMPACT_ROW = { ...ROW, self: 'flex-start', '$platform-web': { width: 'fit-content', maxWidth: '100%' } } as const

/** The run activity behind the bell: the runs that moved last, newest first. */
const RECENT = 6

/** What a place that takes the sidebar is called at its head. */
const TITLE: Record<Raised, string> = { library: phrase('Library'), scheduled: phrase('Scheduled tasks'), customize: phrase('Customize') }

/** A header mark: a 16px glyph in a 32px target, a thumb's 44 on a touch screen. */
const HEAD = { width: 32, height: 32, rounded: '$3', $touchable: { width: 44, height: 44 } } as const

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
  const [tallEnoughForRailShift, setTallEnoughForRailShift] = useState(true)
  useEffect(() => {
    if (!anon || typeof window === 'undefined') return
    const onOpen = () => setAnonSettingsOpen(true)
    const onResize = () => setTallEnoughForRailShift(window.innerHeight >= 520)
    onResize()
    window.addEventListener('hanzo:anon-settings', onOpen)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('hanzo:anon-settings', onOpen)
      window.removeEventListener('resize', onResize)
    }
  }, [anon])
  // The desktop sidebar and a phone's drawer can both be in the page: each names its own group labels.
  const uid = useId()
  const span = useSpan(SPAN, WIDTH, FLOOR, CEIL)

  const dev = (p: string) => host.go(p)
  const at = mode === 'dev' ? raised(host.path) : null
  // Each place the rail holds lists its own rows: Library its kinds and Upload, Scheduled tasks its tasks and New task.
  const scheduled = useScheduled(host, dev, at === 'scheduled')
  const groups =
    places ??
    (at === 'customize'
      ? tabs(host, dev, t)
      : at === 'library'
        ? library(host, dev, t)
        : at === 'scheduled'
          ? scheduled
          : own(host, dev, t))
  const open = (row: Recent) => (row.kind === 'chat' ? go(talk(row.id)) : dev(row.id))
  // Chat's New; Dev's is the first of its places.
  const create = () => {
    empty()
    go(talk())
  }

  return (
    <YStack
      data-slot="app-column"
      ref={drawer ? undefined : span.ref}
      {...(drawer ? null : span.props)}
      position="relative"
      flex={drawer ? 1 : undefined}
      shrink={drawer ? 1 : 0}
      minW={0}
      height="100%"
      width={drawer ? undefined : 'var(--span)'}
      $platform-web={anon && !drawer ? { overflow: 'visible' } : undefined}
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
            paddingInlineStart="$2"
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
            <Text flex={1} minW={0} fontSize={drawer ? 20 : 18} lineHeight={24} fontWeight={drawer ? '700' : '600'} color="$ink" numberOfLines={1}>
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
          <YStack role="list" gap={2} shrink={0}>
            <YStack role="listitem" self="flex-start">
              {/* Current while the pane holds a new conversation, and never lit: the reference lights the conversation open, not New. */}
              <SidebarItem
                data-slot="app-new"
                {...COMPACT_ROW}
                active={!thread}
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
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('hanzo:anon-plugins'))
                      }
                    }}
                    {...keys(() => {
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
        ) : (
          <YStack data-slot="app-places" shrink={0}>
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
        {anon || at ? <YStack flex={1} minH={0} /> : <Recents host={host} mode={mode === 'dev' ? 'dev' : 'chat'} thread={thread} onOpen={open} onNew={create} />}
        {anon ? (
          <YStack
            data-slot="anon-foot"
            gap="$2"
            pt="$2"
            shrink={0}
            z={10}
            marginInlineStart={!drawer && tallEnoughForRailShift ? -(RAIL - 8) : 0}
          >
            <YStack role="list" gap={2}>
              <YStack role="listitem" self="flex-start">
                <SidebarItem
                  data-slot="anon-pricing"
                  {...COMPACT_ROW}
                  bg="transparent"
                  hoverStyle={{ bg: '$hover' }}
                  icon={
                    <XStack width={20} height={20} items="center" justify="center" shrink={0}>
                      <Sparkles size={16} aria-hidden />
                    </XStack>
                  }
                  onPress={() => {
                    if (typeof window !== 'undefined') window.location.assign('/pricing')
                  }}
                  {...keys(() => {
                    if (typeof window !== 'undefined') window.location.assign('/pricing')
                  })}
                >
                  <Text fontSize="$3" color="$ink">{t('See plans and pricing')}</Text>
                </SidebarItem>
              </YStack>
              <YStack role="listitem" self="flex-start">
                <SidebarItem
                  data-slot="anon-help"
                  {...COMPACT_ROW}
                  bg="transparent"
                  hoverStyle={{ bg: '$hover' }}
                  icon={
                    <XStack width={20} height={20} items="center" justify="center" shrink={0}>
                      <CircleHelp size={16} aria-hidden />
                    </XStack>
                  }
                  onPress={() => {
                    if (typeof window !== 'undefined') window.open('https://docs.hanzo.ai', '_blank', 'noopener,noreferrer')
                  }}
                  {...keys(() => {
                    if (typeof window !== 'undefined') window.open('https://docs.hanzo.ai', '_blank', 'noopener,noreferrer')
                  })}
                >
                  <Text fontSize="$3" color="$ink">{t('Help')}</Text>
                </SidebarItem>
              </YStack>
              <YStack role="listitem" self="flex-start">
                <SidebarItem
                  data-slot="anon-settings"
                  {...COMPACT_ROW}
                  bg="transparent"
                  hoverStyle={{ bg: '$hover' }}
                  icon={
                    <XStack width={20} height={20} items="center" justify="center" shrink={0}>
                      <Settings size={16} aria-hidden />
                    </XStack>
                  }
                  onPress={() => setAnonSettingsOpen(true)}
                  {...keys(() => setAnonSettingsOpen(true))}
                >
                  <Text fontSize="$3" color="$ink">{t('Settings')}</Text>
                </SidebarItem>
              </YStack>
            </YStack>
            <YStack data-slot="anon-tailored" gap="$2" pt="$2.5" pb="$1" px="$2" borderTopWidth={1} borderColor="$borderColor">
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
            <AnonSettingsDialog open={anonSettingsOpen} onOpenChange={setAnonSettingsOpen} host={host} />
          </YStack>
        ) : at ? null : (
          <YStack gap="$2" pt="$2" shrink={0}>
            <Made />
            <Setup go={go} />
          </YStack>
        )}
        {!anon && free ? (
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

function AnonSettingsDialog({
  open,
  onOpenChange,
  host,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  host: Host
}) {
  const { t, locale, setLocale } = useI18n()
  const [tab, setTab] = useState<'appearance' | 'language'>('appearance')
  const themeVal: Theme = host.theme ?? 'system'
  const setThemeVal = (next: Theme) => host.chooseTheme?.(next)
  const target = useMemo(() => ({ api: host.api, token: host.token, org: host.org }), [host.api, host.token, host.org])
  const [spoken, speakIn] = useLanguage(target)
  const currentLang = spoken || locale || 'en'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxW={580} width="100%" p="$0" overflow="hidden" data-slot="anon-settings-dialog">
        <XStack minH={340} width="100%">
          <YStack width={180} p="$3" gap="$1" borderRightWidth={1} borderColor="$borderColor" bg="$panel" shrink={0}>
            <DialogTitle>
              <SizableText size="$3" fontWeight="600" color="$ink" px="$2" py="$1.5">
                {t('Settings')}
              </SizableText>
            </DialogTitle>
            <SidebarItem
              {...ROW}
              active={tab === 'appearance'}
              icon={
                <XStack width={18} height={18} items="center" justify="center" shrink={0}>
                  <Palette size={15} aria-hidden />
                </XStack>
              }
              onPress={() => setTab('appearance')}
            >
              <Text fontSize="$2" color={tab === 'appearance' ? '$ink' : '$soft'}>
                {t('Appearance')}
              </Text>
            </SidebarItem>
            <SidebarItem
              {...ROW}
              active={tab === 'language'}
              icon={
                <XStack width={18} height={18} items="center" justify="center" shrink={0}>
                  <Languages size={15} aria-hidden />
                </XStack>
              }
              onPress={() => setTab('language')}
            >
              <Text fontSize="$2" color={tab === 'language' ? '$ink' : '$soft'}>
                {t('Language')}
              </Text>
            </SidebarItem>
          </YStack>
          <YStack flex={1} p="$4" gap="$4" minW={0}>
            {tab === 'appearance' ? (
              <YStack gap="$3">
                <YStack gap="$1">
                  <Text fontSize="$4" fontWeight="600" color="$ink">
                    {t('Appearance')}
                  </Text>
                  <Text fontSize="$2" color="$soft">
                    {t('Choose how Hanzo looks on your device.')}
                  </Text>
                </YStack>
                <XStack gap="$2" flexWrap="wrap">
                  {(
                    [
                      { id: 'light' as const, label: t('Light'), icon: <Sun size={15} aria-hidden /> },
                      { id: 'dark' as const, label: t('Dark'), icon: <Moon size={15} aria-hidden /> },
                      { id: 'system' as const, label: t('System'), icon: <Monitor size={15} aria-hidden /> },
                    ]
                  ).map((opt) => {
                    const active = themeVal === opt.id
                    return (
                      <Button
                        key={opt.id}
                        size="sm"
                        variant={active ? 'primary' : 'outline'}
                        gap="$2"
                        onPress={() => setThemeVal(opt.id)}
                      >
                        {opt.icon}
                        {opt.label}
                      </Button>
                    )
                  })}
                </XStack>
              </YStack>
            ) : (
              <YStack gap="$3">
                <YStack gap="$1">
                  <Text fontSize="$4" fontWeight="600" color="$ink">
                    {t('Language')}
                  </Text>
                  <Text fontSize="$2" color="$soft">
                    {t('Choose the language used across the interface and voice.')}
                  </Text>
                </YStack>
                <YStack maxH={220} overflow="scroll" gap="$1">
                  {locales.map((loc) => {
                    const active = currentLang === loc.code
                    return (
                      <SidebarItem
                        key={loc.code}
                        {...ROW}
                        active={active}
                        onPress={() => {
                          void setLocale?.(loc.code)
                          speakIn(loc.code)
                        }}
                      >
                        <XStack flex={1} items="center" justify="space-between">
                          <Text fontSize="$2" color="$ink">
                            {loc.name}
                          </Text>
                          <Text fontSize="$1" color="$soft">
                            {loc.englishName}
                          </Text>
                        </XStack>
                      </SidebarItem>
                    )
                  })}
                </YStack>
              </YStack>
            )}
          </YStack>
        </XStack>
      </DialogContent>
    </Dialog>
  )
}
