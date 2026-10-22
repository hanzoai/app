'use client'

// The app's sidebar, beside the rail on the window's floor (App.tsx): the
// mode's name with the bell and the search at its right, New, Dev's places in
// Dev, the reader's Recents (Pinned first), and the first-run cards. Which
// product it lists is the rail's to say; the account is at the rail's foot, or
// on a phone at the foot of its menu (Drawer.tsx), where this column is the menu.
//
// It is the window, not a panel: no fill, no edge, the floor's own ground. The
// content beside it is the panel, inset by the gutter.
//
// The bell is the org's run activity (@hanzo/build `useSessions`): the runs
// that moved last, each one press from its page.
// The search opens the palette (Palette.tsx; ⌘K / Ctrl+K from anywhere).
//
// Dev's places are @hanzo/build's `own`: New run, Projects, Issues, Templates.
// A place the rail holds (Library, Scheduled tasks, Customize) takes the sidebar
// instead (Rail.tsx `raised`): Back, the place's name, and its own rows
// (Customize's tabs, the Library's kinds), never Dev's beside them. Settings is
// the site's pages at /settings, with a column of their own.
//
// Its width is the edge's in the gutter to its right: dragged, keyed or
// double-clicked back (@hanzo/build's `Grip`), kept per browser. Pulled in past
// its floor it shuts (`onShut`), as the sidebar's toggle shuts it.

import { useI18n } from '@hanzo/i18n/react'
import { Text, XStack, YStack } from '@hanzo/gui'
import { ArrowLeft, Bell, Search, SquarePen } from 'lucide-react'
import { DOTS, Gutter, library, NEW, own, tabs, useScheduled, useSessions, type Host } from '@hanzo/build'
import { tidy } from './lib/title'
import { DropdownMenu, type DropdownMenuProps } from '@hanzo/ui'
import { Sidebar, SidebarIconButton, SidebarItem, StatusDot, type RailLink } from '@hanzo/ui/chat'
import { useId, type ReactNode } from 'react'
import { Made } from './Me'
import { Recents } from './Recents'
import { raised, type Raised } from './Rail'
import { Setup } from './Setup'
import { ago, type Recent } from './recent'
import { empty } from './open'
import { useSpan } from './span'
import { talk, type Place } from './lib/host'
import { brand, wordmark } from './where'

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

/** The run activity behind the bell: the runs that moved last, newest first. */
const RECENT = 6

/** What a place that takes the sidebar is called at its head. */
const TITLE: Record<Raised, string> = { library: 'Library', scheduled: 'Scheduled tasks', customize: 'Customize' }

/** A header mark: a 16px glyph in a 32px target, a thumb's 44 on a touch screen. */
const HEAD = { width: 32, height: 32, rounded: '$3', $touchable: { width: 44, height: 44 } } as const

function Activity({ host }: { host: Host }) {
  const { t } = useI18n();
  const store = useSessions(host)
  const latest = [...store.value].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, RECENT)
  const items: NonNullable<DropdownMenuProps['items']> = [
    { type: 'label', key: 'head', label: 'Activity' },
    ...(latest.length
      ? latest.map((s) => ({
          key: s.id,
          label: tidy(s.title, 56, 'Untitled run'),
          description: [s.status, ago(s.updatedAt || s.createdAt)].filter(Boolean).join(' · '),
          icon: <StatusDot status={DOTS[s.status as keyof typeof DOTS] ?? 'idle'} />,
          onSelect: () => host.go(s.id),
        }))
      : [{ key: 'none', label: 'Nothing new', disabled: true, onSelect: () => {} }]),
  ]
  return (
    <DropdownMenu
      minWidth={280}
      trigger={
        <XStack
          render="button"
          aria-label={t("Activity")}
          {...({ title: 'Activity' } as object)}
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

export function Column({
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
  const { t } = useI18n();
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
      ? tabs(host, dev)
      : at === 'library'
        ? library(host, dev)
        : at === 'scheduled'
          ? scheduled
          : own(host, dev))
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
      // inline-style: `--span`, the width a drag rewrites on the element itself (span.ts); no prop sets a variable.
      style={drawer ? undefined : span.style}
      position="relative"
      flex={drawer ? 1 : undefined}
      shrink={drawer ? 1 : 0}
      minW={0}
      height="100%"
      width={drawer ? undefined : 'var(--span)'}
    >
      <Sidebar
        data-slot="app-rail"
        role="navigation"
        aria-label={brand()}
        bg="transparent"
        borderWidth={0}
        {...FILL}
        px="$2"
        pt={drawer ? '$2' : 0}
        pb="$2"
        gap="$0"
      >
        {at ? (
          <XStack data-slot="app-head" items="center" gap="$1" pl={2} pr={2} height={52} shrink={0} minW={0}>
            <SidebarIconButton label={t("Back")} data-slot="place-back" onPress={onBack} {...HEAD}>
              <ArrowLeft size={16} aria-hidden />
            </SidebarIconButton>
            <Text flex={1} minW={0} fontSize={18} lineHeight={24} fontWeight="600" color="$ink" numberOfLines={1} data-slot="place-name">
              {TITLE[at]}
            </Text>
          </XStack>
        ) : (
          <XStack data-slot="app-head" items="center" gap="$1" pl="$2" pr={2} height={52} shrink={0} minW={0}>
            <Text flex={1} minW={0} fontSize={18} lineHeight={24} fontWeight="600" color="$ink" numberOfLines={1}>
              {wordmark(mode)}
            </Text>
            <Activity host={host} />
            <SidebarIconButton label={t("Search")} onPress={onSeek} aria-haspopup="dialog" {...HEAD}>
              <Search size={16} aria-hidden />
            </SidebarIconButton>
          </XStack>
        )}
        {mode === 'chat' ? (
          <YStack role="list" gap={2} shrink={0}>
            <YStack role="listitem">
              {/* Current while the pane holds a new conversation, and never lit: the reference lights the conversation open, not New. */}
              <SidebarItem data-slot="app-new" {...ROW} active={!thread} bg="transparent" hoverStyle={{ bg: '$hover' }} icon={<SquarePen size={16} aria-hidden />} onPress={create} {...keys(create)}>
                <Text fontSize="$3" color="$ink">{t("New chat")}</Text>
              </SidebarItem>
            </YStack>
          </YStack>
        ) : (
          <YStack data-slot="app-places" shrink={0}>
            {groups.map((g, i) => (
              <YStack key={g.id} pt={i ? '$2' : 0}>
                {/* The same quiet label Recents wears, so the sidebar reads as one list of headed parts. */}
                {i && g.label ? (
                  <Text id={`${uid}-${g.id}`} pl="$2" pb={2} fontSize="$3" color="$soft">
                    {g.label}
                  </Text>
                ) : null}
                <YStack role="list" aria-labelledby={i && g.label ? `${uid}-${g.id}` : undefined} aria-label={i && g.label ? undefined : g.label || (at ? TITLE[at] : g.id)} gap={1}>
                  {g.links.map((link) => (
                    <YStack key={link.id} role="listitem">
                      <SidebarItem
                        {...ROW}
                        {...(link.id === NEW ? { 'data-slot': 'app-new' } : {})}
                        active={link.active}
                        icon={link.id === NEW ? <SquarePen size={16} aria-hidden /> : link.icon}
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
        {mode === 'studio' || mode === 'tabs' || at ? null : <Recents host={host} mode={mode} thread={thread} onOpen={open} onNew={create} />}
        {at ? null : (
          <YStack gap="$2" pt="$2" shrink={0}>
            <Made />
            <Setup />
          </YStack>
        )}
        {foot}
      </Sidebar>
      {drawer ? null : (
        // In the gutter between the sidebar and the pane, the side panel's handle on this edge.
        <Gutter
          side="left"
          span={span.span}
          floor={FLOOR}
          ceil={CEIL}
          reset={WIDTH}
          onSpan={span.move}
          onKeep={span.keep}
          onShut={onShut}
          label={t("Resize sidebar")}
        />
      )}
    </YStack>
  )
}
