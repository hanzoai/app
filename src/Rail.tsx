'use client'

// The app's rail: its products as marks down the window's left edge, in one
// order — Chat, Dev, Studio, Tabs, Library, Scheduled tasks, Customize — then
// More (Team, on a host of its own, never in Studio), and the account at the foot. It
// is how the app moves between its products; a phone, which has no rail,
// switches Chat and Dev in its bar (Top.tsx).
//
// Studio is the app's third mode (@hanzo/studio at /studio), each of the three
// opened where the reader left it.
//
// A mark is a place, and a place owns the sidebar beside the rail: Chat its
// conversations, Dev its own places (@hanzo/build `own`: New run, Projects,
// Issues, Templates) and its runs, Studio its own; Library, Scheduled tasks and
// Customize (@hanzo/build's Artifacts, Automations and Customize) each their
// own, and Settings its sections (Column.tsx). Nothing on the rail is listed
// inside Dev: one level of the app a place, each lit while the reader is on it.
//
// It stands on the frame's floor, never cut as a pane (ground.ts): the rail and
// the sidebar beside it are the window, and the content is the panel inset in
// it.
//
// The sidebar's toggle leads it (`toggle`) where the host has no bar of its own:
// a browser tab. A host that is a window draws the toggle in its bar beside Back
// and Forward (App.tsx `bar`), and its rail starts with Chat. On a phone the
// rail lies along the foot of the drawer (`flat`), the account at its end; the
// drawer is too narrow for every mark, so Library, Scheduled tasks and
// Customize lead More there.

import { Clock, Code2, Ellipsis, Library, MessageSquare, PanelLeft, Puzzle, SquareTerminal, Users, WandSparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { XStack, YStack } from '@hanzo/gui'
import { route, type Host } from '@hanzo/build'
import { DropdownMenu, type DropdownMenuProps } from '@hanzo/ui'
import { out } from './help'
import { Me } from './Me'
import { app, WORKSPACE, type Place } from './lib/host'

/** The rail's width, px. */
export const RAIL = 48

/** A mark, px: a 36px square on a 44px pitch. */
const MARK = 36

/** The places the rail holds beside the products, by the builder address each opens. */
export const RAISED = { library: '-/artifacts', scheduled: '-/automations', customize: '-/customize' } as const
export type Raised = keyof typeof RAISED

/** A place that takes the sidebar: one of the rail's, or Settings (the account menu's). */
export type Spot = Raised | 'settings'

/** The place a builder address stands on, if it is one that takes the sidebar. */
export const spot = (at: string | null): Spot | null => (at !== null && route(at).kind === 'settings' ? 'settings' : raised(at))

/** Which of them a builder address stands on, if any: an agent's page is Customize's, an automation Scheduled tasks'. */
export function raised(at: string | null): Raised | null {
  if (at === null) return null
  const r = route(at)
  if (r.kind === 'screen' && r.screen === 'artifacts') return 'library'
  if ((r.kind === 'screen' && r.screen === 'automations') || r.kind === 'automation') return 'scheduled'
  if (r.kind === 'customize' || r.kind === 'agent' || (r.kind === 'screen' && r.screen === 'mcp')) return 'customize'
  return null
}

/** One mark: an icon button named for where it goes, its name its tooltip, lit where the reader is. */
export function Mark({
  label,
  on = false,
  onPress,
  children,
  ...rest
}: {
  label: string
  /** The reader is there. */
  on?: boolean
  onPress?: () => void
  children: ReactNode
  [attribute: `data-${string}` | `aria-${string}`]: unknown
}) {
  return (
    <XStack
      render="button"
      aria-label={label}
      {...({ title: label } as object)}
      aria-current={on ? 'page' : undefined}
      onPress={onPress}
      width={MARK}
      height={MARK}
      rounded="$4"
      items="center"
      justify="center"
      shrink={0}
      cursor="pointer"
      opacity={on ? 1 : 0.62}
      bg={on ? '$edge' : 'transparent'}
      hoverStyle={{ bg: on ? '$edge' : '$hover', opacity: 1 }}
      pressStyle={{ bg: '$raised' }}
      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
      // A thumb's 44px on a touch screen.
      $touchable={{ width: 44, height: 44 }}
      {...rest}
    >
      {children}
    </XStack>
  )
}

/** The sidebar's toggle: the same mark wherever a host draws it. */
export function Toggle({ open, onPress, label }: { open: boolean; onPress: () => void; label?: string }) {
  return (
    <Mark label={label ?? (open ? 'Close sidebar' : 'Open sidebar')} data-slot="sidebar-toggle" aria-expanded={open} onPress={onPress}>
      <PanelLeft size={18} aria-hidden />
    </Mark>
  )
}

export function Rail({
  host,
  mode,
  at,
  open,
  toggle,
  flat = false,
  onChat,
  onDev,
  onStudio,
  onTabs,
  go,
  onOrg,
}: {
  host: Host
  mode: Place['mode']
  /** Dev's builder address, or null outside Dev. */
  at: string | null
  /** The sidebar beside the rail is open. */
  open: boolean
  /** Lead with the sidebar's toggle; absent where the host's bar holds it. */
  toggle?: () => void
  /** Laid along the foot of the phone's drawer rather than down the window's edge. */
  flat?: boolean
  /** To Chat, Dev and Studio, each where the reader left it. */
  onChat: () => void
  onDev: () => void
  onStudio: () => void
  onTabs: () => void
  /** Moves the app to an address of this page. */
  go: (address: string) => void
  /** Work in another organization. */
  onOrg: (org: string) => void
}) {
  const here = mode === 'dev' ? spot(at) : null
  const to = (p: string) => () => go(app(p))
  // The products on hosts of their own, behind More; on a phone the raised places lead it.
  // Studio offers no Team, so on a laptop it draws no More.
  const team = mode !== 'studio'
  const rest: NonNullable<DropdownMenuProps['items']> = [
    ...(flat
      ? [
          { key: 'library', label: 'Library', icon: <Library size={16} aria-hidden />, onSelect: to(RAISED.library) },
          { key: 'scheduled', label: 'Scheduled tasks', icon: <Clock size={16} aria-hidden />, onSelect: to(RAISED.scheduled) },
          { key: 'customize', label: 'Customize', icon: <Puzzle size={16} aria-hidden />, onSelect: to(RAISED.customize) },
          ...(team ? [{ type: 'separator' as const, key: 'raised' }] : []),
        ]
      : []),
    ...(team ? [{ key: 'team', label: 'Team', icon: <Users size={16} aria-hidden />, onSelect: () => out(WORKSPACE) }] : []),
  ]
  const Stack = flat ? XStack : YStack
  return (
    <Stack
      data-slot="rail"
      render="nav"
      aria-label="Products"
      {...(flat ? { pt: '$2', mt: '$2', borderTopWidth: 1, borderColor: '$borderColor', gap: '$1' } : { width: RAIL, flex: 1, pt: '$2', pb: '$2', gap: 8 })}
      shrink={0}
      items="center"
    >
      {toggle ? (
        <YStack pb={8}>
          <Toggle open={open} onPress={toggle} />
        </YStack>
      ) : null}
      <Mark label="Chat" on={mode === 'chat'} onPress={onChat} data-slot="rail-chat">
        <MessageSquare size={18} aria-hidden />
      </Mark>
      <Mark label="Dev" on={mode === 'dev' && !here} onPress={onDev} data-slot="rail-dev">
        <Code2 size={18} aria-hidden />
      </Mark>
      <Mark label="Studio" on={mode === 'studio'} onPress={onStudio} data-slot="rail-studio">
        <WandSparkles size={18} aria-hidden />
      </Mark>
      <Mark label="Tabs" on={mode === 'tabs'} onPress={onTabs} data-slot="rail-tabs">
        <SquareTerminal size={18} aria-hidden />
      </Mark>
      {flat ? null : (
        <>
          <Mark label="Library" on={here === 'library'} onPress={to(RAISED.library)} data-slot="rail-library">
            <Library size={18} aria-hidden />
          </Mark>
          <Mark label="Scheduled tasks" on={here === 'scheduled'} onPress={to(RAISED.scheduled)} data-slot="rail-scheduled">
            <Clock size={18} aria-hidden />
          </Mark>
          <Mark label="Customize" on={here === 'customize'} onPress={to(RAISED.customize)} data-slot="rail-customize">
            <Puzzle size={18} aria-hidden />
          </Mark>
        </>
      )}
      {rest.length ? (
        <DropdownMenu
          placement={flat ? 'top-start' : 'right-start'}
          minWidth={220}
          trigger={
            <XStack
              render="button"
              aria-label="More"
              {...({ title: 'More' } as object)}
              data-slot="rail-more"
              width={MARK}
              height={MARK}
              rounded="$4"
              items="center"
              justify="center"
              cursor="pointer"
              opacity={0.62}
              hoverStyle={{ bg: '$hover', opacity: 1 }}
              pressStyle={{ bg: '$raised' }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
              $touchable={{ width: 44, height: 44 }}
            >
              <Ellipsis size={18} aria-hidden />
            </XStack>
          }
          items={rest}
        />
      ) : null}
      <YStack flex={1} />
      <Me host={host} narrow above={flat} onOrg={onOrg} />
    </Stack>
  )
}
