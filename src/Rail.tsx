'use client'

// The app's rail: its products as marks down the window's left edge, in one
// order — Chat, Dev, Library, Scheduled tasks, Customize — then More, a menu of
// the rest, and the account at the foot. It is how the app moves between Chat
// and Dev; there is no switch anywhere else.
//
// Library, Scheduled tasks and Customize are Dev's own places (@hanzo/build's
// Artifacts, Automations and Customize), raised to the rail; each is lit while
// the reader stands on it, and Dev is lit for the rest of Dev.
//
// It stands on the frame's floor, never cut as a pane (ground.ts): the rail and
// the sidebar beside it are the window, and the content is the panel inset in
// it.
//
// The sidebar's toggle leads it (`toggle`) where the host has no bar of its own:
// a browser tab. A host that is a window draws the toggle in its bar beside Back
// and Forward (App.tsx `bar`), and its rail starts with Chat. On a phone the
// rail lies along the foot of the drawer (`flat`), the account at its end.

import { Boxes, Clock, Code2, Ellipsis, FolderGit2, LayoutTemplate, Library, ListTodo, MessageSquare, PanelLeft, Puzzle, Server, SquareTerminal, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { XStack, YStack } from '@hanzo/gui'
import { route, type Host } from '@hanzo/build'
import { DropdownMenu, type DropdownMenuProps } from '@hanzo/ui'
import { Me } from './Me'
import { app, TABS, WORKSPACE } from './lib/host'
import type { Mode } from './recent'

/** The rail's width, px. */
export const RAIL = 48

/** A mark, px: a 36px square on a 44px pitch. */
const MARK = 36

/**
 * Opens an address of another product in a tab of its own, through an anchor,
 * so a host that sends links out of its window (the desktop's system browser)
 * hears it as the link it is.
 */
function out(href: string): void {
  const a = document.createElement('a')
  a.href = href
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** The places the rail raises out of Dev, by the builder address each opens. */
const RAISED = { library: '-/artifacts', scheduled: '-/automations', customize: '-/customize' } as const
type Raised = keyof typeof RAISED

/** Which raised place a builder address stands on, if any. */
function raised(at: string | null): Raised | null {
  if (at === null) return null
  const r = route(at)
  if (r.kind === 'screen' && r.screen === 'artifacts') return 'library'
  if ((r.kind === 'screen' && r.screen === 'automations') || r.kind === 'automation') return 'scheduled'
  if (r.kind === 'customize') return 'customize'
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
  go,
  onOrg,
}: {
  host: Host
  mode: Mode
  /** Dev's builder address, or null in Chat. */
  at: string | null
  /** The sidebar beside the rail is open. */
  open: boolean
  /** Lead with the sidebar's toggle; absent where the host's bar holds it. */
  toggle?: () => void
  /** Laid along the foot of the phone's drawer rather than down the window's edge. */
  flat?: boolean
  /** To Chat and to Dev, each where the reader left it. */
  onChat: () => void
  onDev: () => void
  /** Moves the app to an address of this page. */
  go: (address: string) => void
  /** Work in another organization. */
  onOrg: (org: string) => void
}) {
  const here = mode === 'dev' ? raised(at) : null
  const to = (p: string) => () => go(app(p))
  // Everything else the app reaches, behind More: Dev's other places, then the products on hosts of their own.
  const rest: NonNullable<DropdownMenuProps['items']> = [
    { key: 'projects', label: 'Projects', icon: <FolderGit2 size={16} aria-hidden />, onSelect: to('-/projects') },
    { key: 'templates', label: 'Templates', icon: <LayoutTemplate size={16} aria-hidden />, onSelect: to('-/templates') },
    { key: 'issues', label: 'Issues', icon: <ListTodo size={16} aria-hidden />, onSelect: to('-/issues') },
    { key: 'machines', label: 'Machines', icon: <Server size={16} aria-hidden />, onSelect: to('-/settings/machines') },
    { key: 'environments', label: 'Environments', icon: <Boxes size={16} aria-hidden />, onSelect: to('-/settings/environments') },
    { type: 'separator', key: 'away' },
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
      <Mark label="Dev" on={mode === 'dev' && !here} onPress={onDev} data-slot="rail-dev">
        <Code2 size={18} aria-hidden />
      </Mark>
      <Mark label="Library" on={here === 'library'} onPress={to(RAISED.library)} data-slot="rail-library">
        <Library size={18} aria-hidden />
      </Mark>
      <Mark label="Scheduled tasks" on={here === 'scheduled'} onPress={to(RAISED.scheduled)} data-slot="rail-scheduled">
        <Clock size={18} aria-hidden />
      </Mark>
      <Mark label="Customize" on={here === 'customize'} onPress={to(RAISED.customize)} data-slot="rail-customize">
        <Puzzle size={18} aria-hidden />
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
      <Me host={host} narrow onOrg={onOrg} />
    </Stack>
  )
}
