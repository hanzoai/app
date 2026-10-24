'use client'

// A phone's menu (App.tsx, under gui's `md`), drawn the way the ChatGPT iOS app
// draws its own: the menu stands BEHIND, on the window's subdued floor, and the
// pane slides toward the END side over it, raised — the pane's own brighter
// material, its start corners rounded, a drop falling on the menu. A strip of
// the pane stays in sight; a press on it, or a pull back toward the start, slides
// it home.
//
//   ┌──────────────────────────┬────╮
//   │ Hanzo AI           🔔 ⌕  │    │   the pane: STRIP px of it, inert but for
//   │ ✎ New chat                │    │   the press that closes (`drawer-close`)
//   │ ◇ Studio  ⌨ Tabs  ⋯ More  │    │
//   │ Pinned …  Recents …       │    │
//   │ (ZK)            (✎ Chat)  │    │   the foot: the account and the accent New chat
//   └──────────────────────────┴────╯
//
// Three states, because the slide home has to be seen: shut (no menu, the pane
// as it always is), open, and closing (the menu still drawn, the pane sliding
// home), after which the menu unmounts. The pane's offset is a transform, so the
// slide is the compositor's; under reduced motion it is not animated at all.
//
// THE SLIDE IS LOGICAL but for its sign (slide.ts): the menu stands at the
// start, the strip at the end, both by logical insets; the transform's sign is
// read off the pane's own `direction` as the menu opens, so an RTL page (by
// @hanzo/i18n or the host's own `dir`) slides the pane left, and a drag reads
// along the line the same way.
//
// WHILE IT IS OUT the window behind it is inert (`inert` on every other child of
// the window) and the menu is a modal dialog: focus moves into it as it opens and
// back to what opened it as it shuts; Escape closes it, unless a menu or dialog
// it opened holds the focus; Back closes it, because opening it pushed an entry
// of the same address that Back pops. A move made from inside it takes that
// entry's place (`depart`), so the history holds the move and never the menu;
// so does a page the host's router draws outside the app (`exit`: Settings),
// whose address moves only after the press returns.
// Its list's scroll stays its own (Recents' `overscrollBehavior`), and the pane,
// never unmounted, keeps its own.

import { useI18n } from '@hanzo/i18n/react'
import { Text, XStack, YStack, useMedia } from '@hanzo/gui'
import { SquarePen } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Me, type Who } from './Me'
import { axis, OPEN, pull, settle, sign, type State } from './slide'

/** A press that moves the app: told whether it should take the menu's place in history. */
export type Move = (replace: boolean) => void

export interface Drawer {
  state: State
  open: () => void
  close: () => void
  /** Moves the app from the menu: the move replaces the menu's history entry, and the menu goes. */
  depart: (move: Move) => void
  /**
   * Leaves the app from the menu for a page the host's router draws: the page
   * takes the menu's history entry, and the menu goes. Nothing is popped, for
   * the router moves the address after this returns.
   */
  exit: (move: Move) => void
  /** The address moved under the menu, by a way that was not `depart`: the menu goes, and its entry stays behind the move. */
  drop: () => void
  /** The window: everything in it but the menu is inert while the menu is out. */
  window: (node: unknown) => void
  /** The pane that slides. */
  pane: (node: unknown) => void
  /** The menu's layer. */
  layer: (node: unknown) => void
  /** The pane's slide, for its `style`: null while shut, so nothing is transformed and nothing is raised. */
  slide: CSSProperties | null
}

/**
 * The pane's offset as a transform: `--drawer-way` the end side's sign,
 * `--drawer-at` the distance, both written on the pane by the drawer (a drag
 * rewrites the distance every frame, no React commit). Its start corners round.
 */
const SLIDE = {
  transform: 'translateX(calc(var(--drawer-way, 1) * var(--drawer-at, 0px)))',
  borderStartStartRadius: 'var(--radius-composer)',
  borderEndStartRadius: 'var(--radius-composer)',
} as CSSProperties

/** The slide's motion: the system's base duration on its entrance curve. */
const MOTION = 'transform var(--duration-base) var(--ease-emphasis)'

/** The element a gui stack hands its ref, on the web. */
const element = (node: unknown): HTMLElement | null => (node instanceof HTMLElement ? node : null)

/** The reader asked for no motion. */
function useStill(): boolean {
  const [still, setStill] = useState(false)
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const read = () => setStill(query.matches)
    read()
    query.addEventListener('change', read)
    return () => query.removeEventListener('change', read)
  }, [])
  return still
}

/** The pane's distance from home, px, measured: where it stands against the layer, which stands where it rests. */
const travel = (pane: HTMLElement, layer: HTMLElement): number =>
  Math.abs(pane.getBoundingClientRect().left - layer.getBoundingClientRect().left)

export function useDrawer(): Drawer {
  const [state, setState] = useState<State>('shut')
  // Which way the end side is; read as the menu opens.
  const [way, setWay] = useState<1 | -1>(1)
  const still = useStill()
  const media = useMedia()
  const win = useRef<HTMLElement | null>(null)
  const pane = useRef<HTMLElement | null>(null)
  const layer = useRef<HTMLElement | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  // The entry opening pushed is the one the history stands on.
  const marked = useRef(false)

  const home = useCallback((now = false) => setState((s) => (s === 'shut' || now || still ? 'shut' : 'closing')), [still])

  const open = useCallback(() => {
    const el = pane.current
    setWay(sign(el ? getComputedStyle(el).direction : 'ltr'))
    const at = document.activeElement
    if (at instanceof HTMLElement && at !== document.body) opener.current = at
    if (!marked.current) {
      window.history.pushState(window.history.state, '')
      marked.current = true
    }
    setState('open')
  }, [])

  const close = useCallback(() => {
    if (marked.current) {
      marked.current = false
      window.history.back()
    }
    home()
  }, [home])

  const depart = useCallback(
    (move: Move) => {
      const replace = marked.current
      marked.current = false
      const before = window.location.href
      move(replace)
      // Nothing moved (the reader was there already): the menu's entry is popped instead.
      if (replace && window.location.href === before) window.history.back()
      home()
    },
    [home],
  )

  const exit = useCallback(
    (move: Move) => {
      const replace = marked.current
      marked.current = false
      move(replace)
      home()
    },
    [home],
  )

  const drop = useCallback(() => {
    marked.current = false
    home()
  }, [home])

  // Back closes it: the entry it pushed is the one popped.
  useEffect(() => {
    if (state !== 'open') return
    const back = () => {
      if (!marked.current) return
      marked.current = false
      home()
    }
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
  }, [state, home])

  // Escape closes it, unless a menu or dialog it opened holds the focus: that one closes first.
  useEffect(() => {
    if (state !== 'open') return
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const at = document.activeElement
      if (at && at !== document.body && !layer.current?.contains(at)) return
      e.preventDefault()
      close()
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [state, close])

  // A window that grows past a phone has no drawer: it goes at once.
  useEffect(() => {
    if (!media.md || state === 'shut') return
    if (marked.current) {
      marked.current = false
      window.history.back()
    }
    home(true)
  }, [media.md, state, home])

  // Everything in the window but the menu is inert while it is out, and the focus goes in.
  useLayoutEffect(() => {
    const w = win.current
    const out = state !== 'shut'
    if (w) for (const child of Array.from(w.children)) if (child !== layer.current && child instanceof HTMLElement) child.inert = out
    if (state === 'open') layer.current?.focus({ preventScroll: true })
    if (state !== 'shut') return
    // Shut: the focus goes back to what opened it, where nothing else took it.
    const back = opener.current
    opener.current = null
    const at = document.activeElement
    if (back?.isConnected && (!at || at === document.body)) back.focus({ preventScroll: true })
  }, [state])

  // The slide, written on the pane: its way, its motion, and how far it stands from home.
  useLayoutEffect(() => {
    const s = pane.current?.style
    if (!s) return
    if (state === 'shut') {
      for (const p of ['--drawer-at', '--drawer-way', 'transition']) s.removeProperty(p)
      return
    }
    s.setProperty('--drawer-way', String(way))
    s.setProperty('transition', still ? 'none' : MOTION)
    s.setProperty('--drawer-at', state === 'open' ? OPEN : '0px')
  }, [state, way, still])

  // Closing ends when the slide does, or after it would have.
  useEffect(() => {
    if (state !== 'closing') return
    const el = pane.current
    const done = () => setState((s) => (s === 'closing' ? 'shut' : s))
    const end = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === 'transform') done()
    }
    el?.addEventListener('transitionend', end)
    const late = window.setTimeout(done, 700)
    return () => {
      el?.removeEventListener('transitionend', end)
      window.clearTimeout(late)
    }
  }, [state])

  // A finger on the menu or the strip pulls the pane along the line; a scroll stays a scroll.
  useEffect(() => {
    const el = pane.current
    const over = layer.current
    if (state !== 'open' || !el || !over) return
    let grip: { id: number; x: number; y: number; reach: number } | null = null
    let pulling = false
    let at = 0
    let last = { along: 0, t: 0 }
    let speed = 0
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      grip = { id: e.pointerId, x: e.clientX, y: e.clientY, reach: travel(el, over) }
      pulling = false
      at = grip.reach
      last = { along: 0, t: e.timeStamp }
      speed = 0
    }
    const move = (e: PointerEvent) => {
      if (!grip || e.pointerId !== grip.id) return
      const dx = e.clientX - grip.x
      if (!pulling) {
        const a = axis(dx, e.clientY - grip.y)
        if (a === null) return
        if (a === 'y') {
          grip = null
          return
        }
        pulling = true
        over.setPointerCapture?.(e.pointerId)
        el.style.setProperty('transition', 'none')
      }
      e.preventDefault()
      at = pull(grip.reach, dx, way, grip.reach)
      const along = dx * way
      const dt = e.timeStamp - last.t
      if (dt > 0) speed = (along - last.along) / dt
      last = { along, t: e.timeStamp }
      el.style.setProperty('--drawer-at', `${at}px`)
    }
    const up = (e: PointerEvent) => {
      if (!grip || e.pointerId !== grip.id) return
      const reach = grip.reach
      grip = null
      if (!pulling) return
      pulling = false
      el.style.setProperty('transition', still ? 'none' : MOTION)
      // The press that ends a pull is not a tap on the strip.
      const swallow = (c: Event) => {
        c.stopPropagation()
        c.preventDefault()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
      if (e.type === 'pointerup' && !settle(at, reach, speed)) close()
      else el.style.setProperty('--drawer-at', OPEN)
    }
    over.addEventListener('pointerdown', down)
    over.addEventListener('pointermove', move)
    over.addEventListener('pointerup', up)
    over.addEventListener('pointercancel', up)
    return () => {
      over.removeEventListener('pointerdown', down)
      over.removeEventListener('pointermove', move)
      over.removeEventListener('pointerup', up)
      over.removeEventListener('pointercancel', up)
    }
  }, [state, way, still, close])

  return {
    state,
    open,
    close,
    depart,
    exit,
    drop,
    window: useCallback((node: unknown) => {
      win.current = element(node)
    }, []),
    pane: useCallback((node: unknown) => {
      pane.current = element(node)
    }, []),
    layer: useCallback((node: unknown) => {
      layer.current = element(node)
    }, []),
    slide: state === 'shut' ? null : SLIDE,
  }
}

/**
 * The pane while the menu is out: raised over the floor, its edge drawn and a
 * drop falling on the menu, clipped to its corners. Spread on the pane beside
 * `slide`; `Lift` is its fill.
 */
export const RAISED = {
  z: 'var(--z-raised)',
  overflow: 'hidden',
  boxShadow: '0 0 0 1px var(--pane-edge), var(--shadow-floating)',
} as const

/**
 * The raised pane's fill: the pane's own material composited opaque, a step
 * brighter than the floor the menu stands on, in both themes. Drawn UNDER the
 * pane's content (`--z-under` inside the pane's own stacking) rather than as the
 * pane's background, which is the frame's and a host may paint it at rest.
 */
export function Lift() {
  return <YStack data-slot="lift" position="absolute" inset={0} bg="var(--pane-solid)" z="var(--z-under)" pointerEvents="none" />
}

/**
 * The menu's layer: the menu at the start on the floor, and over the strip of
 * pane left in sight the press that closes it. Drawn while the drawer is not shut.
 */
export function Layer({ drawer, top = 0, children }: { drawer: Drawer; top?: number; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <YStack
      ref={drawer.layer}
      role="dialog"
      aria-modal
      aria-label={t('Menu')}
      tabIndex={-1}
      data-slot="drawer"
      data-state={drawer.state}
      position="absolute"
      t={top}
      b={0}
      insetInlineStart={0}
      insetInlineEnd={0}
      outlineStyle="none"
      $md={{ display: 'none' }}
    >
      {/* The menu, on the floor: clear of the notch, the home indicator and the start edge's inset. */}
      <YStack
        data-slot="menu"
        position="absolute"
        t={0}
        b={0}
        insetInlineStart={0}
        width={OPEN}
        bg="var(--pane-floor)"
        pt="var(--safe-top)"
        pb="max(var(--pane-gap), var(--safe-bottom))"
        // gui carries these to the page; its types name px alone for an inset and lack the web-only touch action.
        // A finger moving down the menu scrolls its list; along the line it is the drawer's.
        {...({ paddingInlineStart: 'max(var(--safe-left), var(--safe-right))', touchAction: 'pan-y' } as object)}
      >
        {children}
      </YStack>
      {drawer.state === 'open' ? (
        <YStack
          render="button"
          data-slot="drawer-close"
          aria-label={t('Close sidebar')}
          onPress={drawer.close}
          position="absolute"
          t={0}
          b={0}
          insetInlineEnd={0}
          z="var(--z-panel)"
          bg="var(--surface-overlay)"
          backdropFilter="blur(2px)"
          borderInlineStartWidth={1}
          borderColor="var(--edge, var(--white-10))"
          borderWidth={0}
          cursor="pointer"
          {...({ insetInlineStart: OPEN, touchAction: 'none' } as object)}
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
        />
      ) : null}
    </YStack>
  )
}

/** The menu's foot: the account (its menu opens above it) and the accent New chat. */
export function Foot({ host, onChat, onOrg }: { host: Who; onChat: () => void; onOrg: (org: string) => void }) {
  const { t } = useI18n()
  return (
    <XStack data-slot="drawer-foot" items="center" justify="space-between" gap="$2" pt="$2" px="$1" shrink={0}>
      <Me host={host} narrow above onOrg={onOrg} />
      <XStack
        render="button"
        data-slot="drawer-chat"
        aria-label={t('New chat')}
        onPress={onChat}
        height={44}
        px="$4"
        gap="$2"
        rounded={9999}
        items="center"
        justify="center"
        bg="var(--accent)"
        borderWidth={0}
        cursor="pointer"
        hoverStyle={{ bg: 'var(--accent-hover)' }}
        pressStyle={{ bg: 'var(--accent-hover)' }}
        focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
      >
        <SquarePen size={18} color="var(--accent-foreground)" aria-hidden />
        <Text fontSize="$4" fontWeight="600" color="var(--accent-foreground)">
          {t('Chat')}
        </Text>
      </XStack>
    </XStack>
  )
}
