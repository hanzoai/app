'use client'

// The app's rail: its products as marks down the window's left edge, in one
// order — Chat, Dev, Studio, Tabs, Library, Scheduled tasks, Customize — then
// More (Team, on a host of its own, then the apps in beta this reader may open
// and Betas, the list of every app in beta; none of it in Studio), and the
// account at the foot. It
// is how the app moves between its products; a phone, which has no rail,
// switches Chat and Dev in its bar (Top.tsx).
//
// Studio is the app's third mode (@hanzo/studio at /studio), each of the three
// opened where the reader left it.
//
// Dev, Studio, Tabs and Team are products, named as they are in every
// language; the rest of the rail's words go through `t`.
//
// A mark is a place, and a place owns the sidebar beside the rail: Chat its
// conversations, Dev its own places (@hanzo/build `own`: New run, Projects,
// Issues, Templates) and its runs, Studio its own; Library, Scheduled tasks and
// Customize (@hanzo/build's Artifacts, Automations and Customize) each their
// own (Column.tsx); Settings is the site's pages at /settings, beside the app
// (lib/host.ts `settings`). Nothing on the rail is listed inside Dev: one level
// of the app a place, each lit while the reader is on it.
//
// It stands on the frame's floor, never cut as a pane (ground.ts): the rail and
// the sidebar beside it are the window, and the content is the panel inset in
// it.
//
// The sidebar's toggle leads it (`toggle`) where the host has no bar of its own:
// a browser tab. A host that is a window draws the toggle in its bar beside Back
// and Forward (App.tsx `bar`), and its rail starts with Chat. A phone has no
// rail: its menu (Drawer.tsx) lists the places as rows (`rows`) under the mode's
// own — Studio, Tabs, then More, which Library, Scheduled tasks and Customize
// lead there. Chat and Dev are the phone's bar's (Top.tsx), and the account is
// the menu's foot.

import { useI18n } from '@hanzo/i18n/react'
import { Clock, Code2, Compass, Ellipsis, FlaskConical, Library, MessageSquare, PanelLeft, Puzzle, Sparkles, SquareTerminal, Users, WandSparkles } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Text, XStack, YStack } from '@hanzo/gui'
import { route, type Host } from '@hanzo/build'
import { DropdownMenu, type DropdownMenuProps } from '@hanzo/ui'
import { SidebarItem } from '@hanzo/ui/chat'
import { BetasDialog, useBetas } from './Betas'
import { out } from './help'
import { BETAS } from './lib/betas'
import { Me } from './Me'
import { app, WORKSPACE, type Place } from './lib/host'

/** The rail's width, px. */
export const RAIL = 44

/** A mark, px: a 36px square on a 44px pitch. */
const MARK = 36

/** The places the rail holds beside the products, by the builder address each opens. */
export const RAISED = { library: '-/artifacts', scheduled: '-/automations', customize: '-/customize' } as const
export type Raised = keyof typeof RAISED

/** Which of them a builder address stands on, if any, and so takes the sidebar: an agent's page is Customize's, an automation Scheduled tasks'. */
export function raised(at: string | null): Raised | null {
  if (at === null) return null
  const r = route(at)
  if (r.kind === 'screen' && r.screen === 'artifacts') return 'library'
  if ((r.kind === 'screen' && r.screen === 'automations') || r.kind === 'automation') return 'scheduled'
  if (r.kind === 'customize' || r.kind === 'agent' || (r.kind === 'screen' && r.screen === 'mcp')) return 'customize'
  return null
}

/** One mark: an icon button named for where it goes (`label`, already in the reader's language), its name its tooltip, lit where the reader is. */
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

/** A place as a phone's menu lists it (`label`, already in the reader's language): a row on the sidebar's pitch, a thumb's 44 on a touch screen, lit where the reader is. */
function Row({
  label,
  on = false,
  onPress,
  icon,
  ...rest
}: {
  label: string
  on?: boolean
  onPress?: () => void
  icon: ReactNode
  [attribute: `data-${string}` | `aria-${string}`]: unknown
}) {
  return (
    <SidebarItem
      rounded="$4"
      minH={31}
      py={0}
      px="$2"
      $touchable={{ minH: 44 }}
      active={on}
      icon={
        icon ? (
          <XStack width={20} height={20} items="center" justify="center" shrink={0}>
            {icon}
          </XStack>
        ) : null
      }
      onPress={onPress}
      onKeyDown={(e: { key?: string; preventDefault?: () => void }) => {
        if (!onPress || (e.key !== 'Enter' && e.key !== ' ')) return
        e.preventDefault?.()
        onPress()
      }}
      {...rest}
    >
      <Text fontSize="$3" color={on ? '$ink' : '$quiet'}>
        {label}
      </Text>
    </SidebarItem>
  )
}

/** The sidebar's toggle: the same mark wherever a host draws it. Its icon is the sidebar at the start edge, mirrored right to left. */
export function Toggle({ open, onPress, label }: { open: boolean; onPress: () => void; label?: string }) {
  const { t } = useI18n()
  return (
    <Mark label={label ?? t(open ? 'Close sidebar' : 'Open sidebar')} data-slot="sidebar-toggle" aria-expanded={open} onPress={onPress}>
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
  rows = false,
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
  /** Listed as rows in a phone's menu rather than marks down the window's edge. */
  rows?: boolean
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
  const { t, dir } = useI18n()
  const here = mode === 'dev' ? raised(at) : null
  const to = (p: string) => () => go(app(p))
  // The products on hosts of their own, behind More; on a phone the raised places lead it.
  // Studio offers no Team, so on a laptop it draws no More.
  const team = mode !== 'studio'
  const { open: opened } = useBetas()
  const [betas, setBetas] = useState(false)
  // The apps in beta this reader may open, each where it lives.
  const granted = BETAS.filter((b) => b.href && opened(b.id))
  const rest: NonNullable<DropdownMenuProps['items']> = [
    ...(rows
      ? [
          { key: 'library', label: t('Library'), icon: <Library size={16} aria-hidden />, onSelect: to(RAISED.library) },
          { key: 'scheduled', label: t('Scheduled tasks'), icon: <Clock size={16} aria-hidden />, onSelect: to(RAISED.scheduled) },
          { key: 'customize', label: t('Customize'), icon: <Puzzle size={16} aria-hidden />, onSelect: to(RAISED.customize) },
          ...(team ? [{ type: 'separator' as const, key: 'raised' }] : []),
        ]
      : []),
    ...(team
      ? [
          { key: 'team', label: 'Team', icon: <Users size={16} aria-hidden />, onSelect: () => out(WORKSPACE) },
          ...granted.map((b) => ({ key: `beta-${b.id}`, label: b.name, icon: <Sparkles size={16} aria-hidden />, onSelect: () => out(b.href as string) })),
          { type: 'separator' as const, key: 'betas-rule' },
          { key: 'betas', label: t('Betas'), icon: <FlaskConical size={16} aria-hidden />, onSelect: () => setBetas(true) },
          { key: 'market', label: t('Explore on hanzo.market'), icon: <Compass size={16} aria-hidden />, onSelect: () => out('https://hanzo.market') },
        ]
      : []),
  ]
  const betasDialog = <BetasDialog open={betas} onOpenChange={setBetas} go={out} />
  if (rows)
    return (
      <YStack data-slot="places" render="nav" aria-label={t('Products')} pt="$2" shrink={0}>
        <YStack role="list" gap={2}>
          <YStack role="listitem">
            <Row label="Studio" on={mode === 'studio'} onPress={onStudio} data-slot="place-studio" icon={<WandSparkles size={16} aria-hidden />} />
          </YStack>
          <YStack role="listitem">
            <Row label="Tabs" on={mode === 'tabs'} onPress={onTabs} data-slot="place-tabs" icon={<SquareTerminal size={16} aria-hidden />} />
          </YStack>
          <YStack role="listitem">
            <DropdownMenu placement="bottom-start" minWidth={220} trigger={<Row label={t('More')} data-slot="place-more" aria-haspopup="menu" icon={<Ellipsis size={16} aria-hidden />} />} items={rest} />
          </YStack>
        </YStack>
        {betasDialog}
      </YStack>
    )
  return (
    <YStack data-slot="rail" render="nav" aria-label={t('Products')} width={RAIL} flex={1} pt={4} pb={4} gap={4} shrink={0} items="center">
      {toggle ? (
        <YStack pb={4}>
          <Toggle open={open} onPress={toggle} />
        </YStack>
      ) : null}
      <Mark label={t('Chat')} on={mode === 'chat'} onPress={onChat} data-slot="rail-chat">
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
      <Mark label={t('Library')} on={here === 'library'} onPress={to(RAISED.library)} data-slot="rail-library">
        <Library size={18} aria-hidden />
      </Mark>
      <Mark label={t('Scheduled tasks')} on={here === 'scheduled'} onPress={to(RAISED.scheduled)} data-slot="rail-scheduled">
        <Clock size={18} aria-hidden />
      </Mark>
      <Mark label={t('Customize')} on={here === 'customize'} onPress={to(RAISED.customize)} data-slot="rail-customize">
        <Puzzle size={18} aria-hidden />
      </Mark>
      {betasDialog}
      {rest.length ? (
        <DropdownMenu
          // Toward the content: right of the rail, left of it right to left.
          placement={dir === 'rtl' ? 'left-start' : 'right-start'}
          minWidth={220}
          trigger={
            <XStack
              render="button"
              aria-label={t('More')}
              {...({ title: t('More') } as object)}
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
      <Me host={host} narrow onOrg={onOrg} />
    </YStack>
  )
}
