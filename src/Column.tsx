'use client'

// The app's sidebar, beside the rail on the window's floor (App.tsx): the
// mode's name with the bell and the search at its right, New, Dev's places in
// Dev, the reader's Recents (Pinned first), and the first-run cards. Which
// product it lists is the rail's to say; the account is at the rail's foot.
//
// It is the window, not a panel: no fill, no edge, the floor's own ground. The
// content beside it is the panel, inset by the gutter.
//
// The bell is the org's run activity (@hanzo/build `useSessions`): the runs
// that moved last, each one press from its page, and Notifications in Settings.
// The search opens the filter over Recents (⌘K / Ctrl+K from anywhere, `seek`).
//
// Dev's places are @hanzo/build's `nav`, the one list every rail draws, each a
// row under a quiet group label.
//
// Its width is the edge's in the gutter to its right: dragged, keyed or
// double-clicked back (@hanzo/build's `Grip`), kept per browser. Pulled in past
// its floor it shuts (`onShut`), as the sidebar's toggle shuts it.

import { Text, XStack, YStack } from '@hanzo/gui'
import { Bell, Search, Settings2, SquarePen, X } from 'lucide-react'
import { DOTS, Grip, nav, NEW, path as written, useSessions, type Host } from '@hanzo/build'
import { DropdownMenu, type DropdownMenuProps } from '@hanzo/ui'
import { Sidebar, SidebarIconButton, SidebarItem, StatusDot } from '@hanzo/ui/chat'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Made } from './Me'
import { Recents } from './Recents'
import { Setup } from './Setup'
import { ago, type Mode, type Recent } from './recent'
import { empty } from './open'
import { useSpan } from './span'
import { pane } from './ground'
import { talk } from './lib/host'
import { brand, wordmark } from './where'

/** The grip stands in the gutter between the sidebar and the panel. gui carries a `calc()` to the page unchanged; its
 *  types only name custom properties. */
const GUTTER_END = 'calc(-1 * var(--pane-gap))' as `var(--${string})`
/** The sidebar fills the column. Its `width` is typed in px alone, though its frame takes any gui size — the type is
 *  @hanzo/ui's to widen. */
const FILL = { width: '100%' } as object

/**
 * The phone's drawer floats over the page under the browser's own glass bar, so
 * it is cut like that bar: the composer's corner, the strong hairline, the lit
 * top edge and the floating drop. Its fill and blur stay the pane's.
 */
const FLOAT = {
  borderRadius: 'var(--radius-composer)',
  borderColor: 'var(--border-strong)',
  boxShadow: 'var(--edge-highlight), var(--shadow-floating)',
} as const

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

/** A row of the sidebar: a pill on a 31px pitch, lit where the reader is. */
const ROW = { rounded: '$4', minH: 31, py: 0, px: '$2' } as const

/** The run activity behind the bell: the runs that moved last, newest first. */
const RECENT = 6

/** A header mark: a 16px glyph in a 32px target. */
const HEAD = { width: 32, height: 32, rounded: '$3' } as const

function Activity({ host }: { host: Host }) {
  const store = useSessions(host)
  const latest = [...store.value].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, RECENT)
  const items: NonNullable<DropdownMenuProps['items']> = [
    { type: 'label', key: 'head', label: 'Activity' },
    ...(latest.length
      ? latest.map((s) => ({
          key: s.id,
          label: s.title || 'Untitled run',
          description: [s.status, ago(s.updatedAt || s.createdAt)].filter(Boolean).join(' · '),
          icon: <StatusDot status={DOTS[s.status as keyof typeof DOTS] ?? 'idle'} />,
          onSelect: () => host.go(s.id),
        }))
      : [{ key: 'none', label: 'Nothing new', disabled: true, onSelect: () => {} }]),
    { type: 'separator', key: 'line' },
    { key: 'settings', label: 'Notification settings', icon: <Settings2 size={16} aria-hidden />, onSelect: () => host.go(written({ kind: 'settings', section: 'notifications' })) },
  ]
  return (
    <DropdownMenu
      minWidth={280}
      trigger={
        <XStack
          render="button"
          aria-label="Activity"
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
  seek = 0,
  drawer = false,
  foot,
}: {
  host: Host
  mode: Mode
  /** The Chat conversation the pane holds, or null. */
  thread: string | null
  /** Moves the app to an address of this page. */
  go: (address: string) => void
  /** Shut the sidebar: its edge pulled in past the floor. */
  onShut: () => void
  /** Each new value asks for the search, focused (⌘K). */
  seek?: number
  /** Drawn in the phone's drawer: no edge, cut as a floating pane. */
  drawer?: boolean
  /** What stands at its foot: the drawer's rail, laid flat. */
  foot?: ReactNode
}) {
  const [words, setWords] = useState('')
  // The search field shows once asked for, and while it holds words.
  const [seeking, setSeeking] = useState(false)
  const field = useRef<HTMLInputElement | null>(null)
  // The desktop sidebar and a phone's drawer can both be in the page: each names its own group labels.
  const uid = useId()
  const span = useSpan(SPAN, WIDTH, FLOOR, CEIL)

  const dev = (p: string) => host.go(p)
  const groups = nav(host, dev)
  const open = (row: Recent) => (row.kind === 'chat' ? go(talk(row.id)) : dev(row.id))
  // Chat's New; Dev's is the first of its places.
  const create = () => {
    empty()
    go(talk())
  }
  const ask = () => {
    setSeeking(true)
    requestAnimationFrame(() => field.current?.focus())
  }
  const done = () => {
    setWords('')
    setSeeking(false)
  }
  useEffect(() => {
    if (seek) ask()
  }, [seek])

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
        {...(drawer ? { ...pane(), ...FLOAT } : { bg: 'transparent', borderWidth: 0 })}
        {...FILL}
        px="$2"
        pt={drawer ? '$2' : 0}
        pb="$2"
        gap="$0"
      >
        <XStack data-slot="app-head" items="center" gap="$1" pl="$2" pr={2} height={52} shrink={0} minW={0}>
          <Text flex={1} minW={0} fontSize={18} lineHeight={24} fontWeight="600" color="$ink" numberOfLines={1}>
            {wordmark(mode)}
          </Text>
          <Activity host={host} />
          <SidebarIconButton
            label={mode === 'chat' ? 'Search chats' : 'Search runs'}
            onPress={seeking ? done : ask}
            aria-expanded={seeking || !!words}
            {...HEAD}
          >
            <Search size={16} aria-hidden />
          </SidebarIconButton>
        </XStack>
        {seeking || words ? (
          <XStack data-slot="app-filter" items="center" gap="$2" pl="$3" pr="$1" height={36} rounded={999} borderWidth={1} borderColor="$borderColor" bg="$edge" shrink={0} mb="$1.5">
            <Search size={15} aria-hidden color="var(--soft, var(--muted-foreground))" />
            <Text
              render={
                <input
                  ref={field}
                  value={words}
                  onChange={(e) => setWords(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') done()
                  }}
                  onBlur={() => {
                    if (!words) setSeeking(false)
                  }}
                  placeholder={mode === 'chat' ? 'Search chats' : 'Search runs'}
                  aria-label="Filter recents"
                />
              }
              flex={1}
              minW={0}
              bg="transparent"
              borderWidth={0}
              outlineStyle="none"
              color="inherit"
              fontSize="$3"
            />
            {words ? (
              <SidebarIconButton label="Clear search" onPress={done} width={28} height={28} rounded={999}>
                <X size={14} aria-hidden />
              </SidebarIconButton>
            ) : null}
          </XStack>
        ) : null}
        {mode === 'chat' ? (
          <YStack role="list" gap={2} shrink={0}>
            <YStack role="listitem">
              {/* Current while the pane holds a new conversation, and never lit: the reference lights the conversation open, not New. */}
              <SidebarItem data-slot="app-new" {...ROW} active={!thread} bg="transparent" hoverStyle={{ bg: '$hover' }} icon={<SquarePen size={16} aria-hidden />} onPress={create} {...keys(create)}>
                <Text fontSize="$3" color="$ink">
                  New chat
                </Text>
              </SidebarItem>
            </YStack>
          </YStack>
        ) : (
          <YStack data-slot="app-places" shrink={0}>
            {groups.map((g, i) => (
              <YStack key={g.id} pt={i ? '$2' : 0}>
                {/* The same quiet label Recents wears, so the sidebar reads as one list of headed parts. */}
                {i ? (
                  <Text id={`${uid}-${g.id}`} pl="$2" pb={2} fontSize="$3" color="$soft">
                    {g.label}
                  </Text>
                ) : null}
                <YStack role="list" aria-labelledby={i ? `${uid}-${g.id}` : undefined} aria-label={i ? undefined : g.label} gap={1}>
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
        <Recents host={host} mode={mode} thread={thread} words={words} onOpen={open} onNew={create} />
        <YStack gap="$2" pt="$2" shrink={0}>
          <Made />
          <Setup />
        </YStack>
        {foot}
      </Sidebar>
      {drawer ? null : (
        <Grip
          side="left"
          span={span.span}
          floor={FLOOR}
          ceil={CEIL}
          reset={WIDTH}
          onSpan={span.move}
          onKeep={span.keep}
          onShut={onShut}
          label="Resize sidebar"
          // In the gutter between the sidebar and the panel, not over the sidebar's own rows.
          r={GUTTER_END}
          width="var(--pane-gap)"
        />
      )}
    </YStack>
  )
}
