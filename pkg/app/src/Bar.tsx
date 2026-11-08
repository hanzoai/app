'use client'

// A phone's bar, which has neither rail nor sidebar to move the app: the
// drawer's button at the start and New at the end. The drawer lists the places
// (Chat, Dev, Studio, Tabs, Library, Scheduled tasks, Customize) as rows, so the
// bar carries no switch of its own. Right to left the row turns with the page,
// and the drawer's mark is mirrored.
//
//   (≡)                                (✎)
//
// Both are glass: the pane's material (ground.ts) cut round, its edge one step
// stronger so a circle on the bare floor reads as one. Measured on the
// reference at 440×956: the buttons are 44px circles 20px in from each edge,
// all centred on one line 48px tall under the device's top inset.
//
// New is Chat's New chat, and elsewhere the mode's own New row (@hanzo/build's
// and @hanzo/studio's `nav`, `NEW`), so the bar names it as the sidebar does;
// its icon is the mode's `make` mark (@hanzo/build `MARKS`): the pen in Chat,
// `</>` in Dev, the terminal in Tabs.

import { useI18n } from '@hanzo/i18n/react'
import type { ReactNode } from 'react'
import { XStack } from '@hanzo/gui'
import { MARKS, nav, NEW, type Host } from '@hanzo/build'
import type { RailLink } from '@hanzo/ui/chat'
import { BAND, pane } from './ground'
import { empty } from './open'
import { talk, type Place } from './lib/host'
import { dispatchTabsAction } from './Sidebar'

/** A button, px: compact and refined. */
const ROUND = 34

/** The glass the two are cut from. */
const GLASS = {
  ...pane(),
  borderWidth: 1,
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

export function Bar({
  host,
  mode,
  places,
  open = false,
  go,
  onMenu,
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
      : mode === 'tabs'
        ? { label: t('New terminal'), onPress: () => dispatchTabsAction({ kind: 'shell' }) }
        : { label: made?.label ?? t('New'), onPress: made?.onPress }
  const Make = mode === 'chat' || mode === 'dev' || mode === 'tabs' || mode === 'studio' ? MARKS[mode].make : MARKS.chat.make
  return (
    // The gap above the bar is the gap the pane keeps all round, under the device's inset; the bar's row is the
    // head band (BAND), the drawer's title row on the same line.
    <XStack
      data-slot="app-bar"
      items="center"
      justify="space-between"
      height={`calc(${BAND}px + var(--safe-top) + var(--pane-gap))`}
      pt="calc(var(--safe-top) + var(--pane-gap))"
      px="$4.5"
      shrink={0}
      $md={{ display: 'none' }}
    >
      <Round label={t('Open sidebar')} data-slot="bar-menu" onPress={onMenu} pointerEvents={open ? 'none' : 'auto'}>
        <Lines />
      </Round>
      {/* A mode with nothing to make (Betas) has no New: the bar keeps its menu. */}
      {fresh.onPress ? (
        <Round label={fresh.label} data-slot="bar-new" onPress={fresh.onPress}>
          <Make size={16} strokeWidth={1.75} aria-hidden />
        </Round>
      ) : (
        <XStack width={ROUND} height={ROUND} aria-hidden />
      )}
    </XStack>
  )
}
