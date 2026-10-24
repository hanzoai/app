'use client'

// A phone's bar, which has neither rail nor sidebar to move the app: the
// drawer's button at the start, Chat | Dev in the middle, and New at the end
// (the owner's iPhone reference; LLM.md "The app is `App`"). Right to left the
// row turns with the page, and the drawer's mark is mirrored.
//
//   (≡)        ( Chat | Dev )        (✎)
//
// The three are glass: the pane's material (ground.ts) cut round, its edge one
// step stronger so a circle on the bare floor reads as one. Measured on the
// reference at 440×956: the buttons are 44px circles 20px in from each edge,
// the pill 158×48 with a 40px segment inside a 4px rim, its labels at 15px
// medium, all centred on one line 48px tall under the device's top inset.
//
// Chat | Dev moves the app the way the rail does (`onChat`, `onDev`: where each
// was last). In Studio neither is lit. New is Chat's New chat, and elsewhere the
// mode's own New row (@hanzo/build's and @hanzo/studio's `nav`, `NEW`), so the
// bar names it as the sidebar does.

import { useI18n } from '@hanzo/i18n/react'
import { SquarePen } from 'lucide-react'
import type { ReactNode } from 'react'
import { Text, XStack } from '@hanzo/gui'
import { nav, NEW, type Host } from '@hanzo/build'
import { ToggleGroup, ToggleGroupItem } from '@hanzo/ui'
import type { RailLink } from '@hanzo/ui/chat'
import { pane } from './ground'
import { empty } from './open'
import { talk, type Place } from './lib/host'

/** A button, px: a thumb's 44. */
const ROUND = 44

/** The bar's line under the device's top inset, px: the pill's height. */
const LINE = 48

/** A segment, px: the pill's 150px inside its rim, less the group's 4px gap, halved. */
const SEGMENT = 73

/** The glass the three are cut from. */
const GLASS = {
  ...pane(),
  borderColor: 'var(--border-strong)',
  borderRadius: 9999,
  boxShadow: 'inset 0 1px 1px 0 var(--white-15), var(--shadow-sheet-1)',
  backdropFilter: 'blur(24px) saturate(190%) contrast(102%)',
} as const

/** A round glass button named for what it does (`label`, already in the reader's language). */
function Round({
  label,
  onPress,
  opacity,
  pointerEvents,
  children,
  ...rest
}: {
  label: string
  onPress?: () => void
  opacity?: number
  pointerEvents?: 'none' | 'auto'
  children: ReactNode
  [attribute: `data-${string}` | `aria-${string}`]: unknown
}) {
  return (
    <XStack
      render="button"
      aria-label={label}
      onPress={onPress}
      {...GLASS}
      width={ROUND}
      height={ROUND}
      items="center"
      justify="center"
      shrink={0}
      cursor="pointer"
      opacity={opacity}
      pointerEvents={pointerEvents}
      pressStyle={{ bg: '$raised', scale: 0.96 }}
      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
      {...rest}
    >
      {children}
    </XStack>
  )
}

/** The drawer's mark: two strokes, the lower one shorter and flush with the start, 19×11 as the reference draws it. */
function Lines() {
  return (
    <svg width={19} height={11} viewBox="0 0 19 11" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden data-i18n-mirror>
      <path d="M1 1h17M1 10h10.7" />
    </svg>
  )
}

/** One side of the pill. */
function Side({ value, children }: { value: Place['mode']; children: string }) {
  return (
    <ToggleGroupItem
      value={value}
      size="lg"
      width={SEGMENT}
      rounded={9999}
      bg="transparent"
      borderColor="transparent"
      hoverStyle={{ bg: '$hover' }}
      activeStyle={{ bg: '$raised', borderColor: 'transparent' }}
    >
      <Text fontSize="$4" fontWeight="500" color="$ink" numberOfLines={1}>
        {children}
      </Text>
    </ToggleGroupItem>
  )
}

export function Top({
  host,
  mode,
  places,
  open = false,
  go,
  onMenu,
  onChat,
  onDev,
}: {
  host: Host
  mode: Place['mode']
  /** The mode's places, where they are not Dev's (Studio's `nav`). */
  places?: { id: string; links: RailLink[] }[]
  /** The drawer is open: hide the pane's open button so it does not peek through the strip. */
  open?: boolean
  /** Moves the app, the drawer away first. */
  go: (address: string) => void
  onMenu: () => void
  onChat: () => void
  onDev: () => void
}) {
  const { t } = useI18n()
  const made = mode === 'chat' ? null : (places ?? nav(host, (p) => host.go(p), t)).flatMap((g) => g.links).find((l) => l.id === NEW)
  const fresh =
    mode === 'chat'
      ? {
          label: t('New chat'),
          onPress: () => {
            empty()
            go(talk())
          },
        }
      : { label: made?.label ?? t('New'), onPress: made?.onPress }
  return (
    <XStack data-slot="app-bar" height={`calc(${LINE}px + var(--safe-top))`} pt="var(--safe-top)" px="$4.5" items="center" justify="space-between" shrink={0} $md={{ display: 'none' }}>
      <Round label={t('Open sidebar')} data-slot="bar-menu" onPress={onMenu} opacity={open ? 0 : 1} pointerEvents={open ? 'none' : 'auto'}>
        <Lines />
      </Round>
      <XStack data-slot="bar-mode" {...GLASS} height={LINE} p="$1" items="center">
        <ToggleGroup type="single" aria-label={t('App')} value={mode === 'chat' || mode === 'dev' ? mode : ''} disableDeactivation onValueChange={(v) => (v === 'chat' ? onChat() : v === 'dev' ? onDev() : undefined)}>
          <Side value="chat">{t('Chat')}</Side>
          <Side value="dev">Dev</Side>
        </ToggleGroup>
      </XStack>
      <Round label={fresh.label} data-slot="bar-new" onPress={fresh.onPress}>
        <SquarePen size={20} aria-hidden />
      </Round>
    </XStack>
  )
}
