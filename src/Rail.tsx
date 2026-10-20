'use client'

// The app's rail: its products as marks down the window's left edge, in one
// order — Chat, Dev, Studio — then More, a menu of the products on hosts of
// their own, and the account at the foot. It is how the app moves between its
// products; a phone, which has no rail, switches Chat and Dev in its bar
// (Top.tsx).
//
// Studio is the app's third mode (@hanzo/studio at /studio), each of the three
// opened where the reader left it.
//
// A mark is a product, and a product owns the sidebar beside the rail: Chat its
// conversations, Dev its places (@hanzo/build's New, Projects, Issues, Library,
// Templates, Scheduled tasks, Machines, Environments, Customize, Docs) and its
// runs, Studio its own. Nothing of Dev's is raised to the rail, and nothing of
// the rail's is listed inside Dev: one level of the app a place.
//
// It stands on the frame's floor, never cut as a pane (ground.ts): the rail and
// the sidebar beside it are the window, and the content is the panel inset in
// it.
//
// The sidebar's toggle leads it (`toggle`) where the host has no bar of its own:
// a browser tab. A host that is a window draws the toggle in its bar beside Back
// and Forward (App.tsx `bar`), and its rail starts with Chat. On a phone the
// rail lies along the foot of the drawer (`flat`), the account at its end.

import { Code2, Ellipsis, MessageSquare, PanelLeft, SquareTerminal, Users, WandSparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { XStack, YStack } from '@hanzo/gui'
import { type Host } from '@hanzo/build'
import { DropdownMenu, type DropdownMenuProps } from '@hanzo/ui'
import { out } from './help'
import { Me } from './Me'
import { TABS, WORKSPACE, type Place } from './lib/host'

/** The rail's width, px. */
export const RAIL = 48

/** A mark, px: a 36px square on a 44px pitch. */
const MARK = 36

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
  open,
  toggle,
  flat = false,
  onChat,
  onDev,
  onStudio,
  onOrg,
}: {
  host: Host
  mode: Place['mode']
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
  /** Work in another organization. */
  onOrg: (org: string) => void
}) {
  // The products on hosts of their own, behind More.
  const rest: NonNullable<DropdownMenuProps['items']> = [
    { key: 'tabs', label: 'Tabs', icon: <SquareTerminal size={16} aria-hidden />, onSelect: () => out(TABS) },
    { key: 'team', label: 'Team', icon: <Users size={16} aria-hidden />, onSelect: () => out(WORKSPACE) },
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
      <Mark label="Dev" on={mode === 'dev'} onPress={onDev} data-slot="rail-dev">
        <Code2 size={18} aria-hidden />
      </Mark>
      <Mark label="Studio" on={mode === 'studio'} onPress={onStudio} data-slot="rail-studio">
        <WandSparkles size={18} aria-hidden />
      </Mark>
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
      <YStack flex={1} />
      <Me host={host} narrow above={flat} onOrg={onOrg} />
    </Stack>
  )
}
