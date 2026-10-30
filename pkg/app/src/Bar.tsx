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
import { BAND, pane } from './ground'
import { empty } from './open'
import { talk, type Place } from './lib/host'

/** A button, px: compact and refined. */
const ROUND = 34

/** The bar's line under the device's top inset, px: the pill's height. */
const LINE = 34

/** A segment, px: compact switcher button. */
const SEGMENT = 56

/** The glass the three are cut from. */
const GLASS = {
  ...pane(),
  borderColor: 'var(--border-strong)',
  borderRadius: 9999,
  boxShadow: 'var(--shadow-sheet-1)',
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

/** The drawer's mark: two strokes, the lower one shorter and flush with the start, 15×9. */
function Lines() {
  return (
    <svg width={15} height={9} viewBox="0 0 19 11" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden data-i18n-mirror>
      <path d="M1 1h17M1 10h10.7" />
    </svg>
  )
}

/** One side of the pill. */
function Segment({ value, children }: { value: Place['mode']; children: string }) {
  return (
    <ToggleGroupItem
      value={value}
      size="sm"
      width={SEGMENT}
      height={26}
      rounded={9999}
      bg="transparent"
      borderColor="transparent"
      hoverStyle={{ bg: '$hover' }}
      activeStyle={{ bg: '$raised', borderColor: 'transparent' }}
    >
      <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1}>
        {children}
      </Text>
    </ToggleGroupItem>
  )
}

export function Bar({
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
    // The gap above the bar is the gap the pane keeps all round, under the device's inset; the bar's row is the
    // head band (BAND), the drawer's title row on the same line.
    <XStack
      data-slot="app-bar"
      display="grid"
      gridTemplateColumns="1fr auto 1fr"
      items="center"
      height={`calc(${BAND}px + var(--safe-top) + var(--pane-gap))`}
      pt="calc(var(--safe-top) + var(--pane-gap))"
      px="$4.5"
      shrink={0}
      $md={{ display: 'none' }}
    >
      <XStack justifySelf="start">
        <Round label={t('Open sidebar')} data-slot="bar-menu" onPress={onMenu} pointerEvents={open ? 'none' : 'auto'}>
          <Lines />
        </Round>
      </XStack>
      <XStack data-slot="bar-mode" {...GLASS} height={LINE} p="$1" items="center" justifySelf="center">
        <ToggleGroup type="single" aria-label={t('App')} value={mode === 'chat' || mode === 'dev' ? mode : ''} disableDeactivation onValueChange={(v) => (v === 'chat' ? onChat() : v === 'dev' ? onDev() : undefined)}>
          <Segment value="chat">{t('Chat')}</Segment>
          <Segment value="dev">Dev</Segment>
        </ToggleGroup>
      </XStack>
      {/* A mode with nothing to make (Betas) has no New: the bar keeps its menu and Chat | Dev. */}
      <XStack justifySelf="end">
        {fresh.onPress ? (
          <Round label={fresh.label} data-slot="bar-new" onPress={fresh.onPress}>
            <SquarePen size={16} strokeWidth={1.75} aria-hidden />
          </Round>
        ) : (
          <XStack width={ROUND} height={ROUND} aria-hidden />
        )}
      </XStack>
    </XStack>
  )
}
