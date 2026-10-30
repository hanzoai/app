'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { GuiElement } from '@hanzo/ui'

/**
 * The clock the product previews play on: a script of beats, each arriving
 * `wait` ms after the one before it, played while the preview is on screen.
 * Hanzo Team's (`@hanzo/app/TeamPreview`) and Hanzo Bot's (hanzo.ai) play on
 * it, on their pages' heroes and inside the landing's.
 */

const REDUCE = '(prefers-reduced-motion: reduce)'
const listen = (on: () => void) => {
  const q = window.matchMedia(REDUCE)
  q.addEventListener('change', on)
  return () => q.removeEventListener('change', on)
}

/** Whether the reader asked for less motion. The server and the first paint assume so, so nothing moves before the page knows. */
export function useStill(): boolean {
  return useSyncExternalStore(listen, () => window.matchMedia(REDUCE).matches, () => true)
}

/** A beat of a script: how long after the one before it it arrives. */
export type Beat = { wait: number }

/** How long a whole script holds before it plays again. */
export const REST = 4200

/**
 * Where a preview stands: whether it has been on screen (`seen`), whether it is
 * now (`visible`), whether the pointer is over it (`held`, kept by the `hold`
 * handlers the preview spreads on its box), and how wide it is (`width`, 0
 * until measured), which is how a preview decides its own layout wherever it
 * is placed.
 */
export function useStage() {
  const box = useRef<GuiElement>(null)
  const [seen, setSeen] = useState(false)
  const [width, setWidth] = useState(0)
  const visible = useRef(false)
  const held = useRef(false)
  useEffect(() => {
    const el = box.current as unknown as HTMLElement | null
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([e]) => {
        visible.current = !!e?.isIntersecting
        if (e?.isIntersecting) setSeen(true)
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    const fit = new ResizeObserver(([e]) => setWidth(Math.round(e?.contentRect.width ?? 0)))
    fit.observe(el)
    return () => {
      io.disconnect()
      fit.disconnect()
    }
  }, [])
  const hold = useMemo(() => ({ onPointerEnter: () => void (held.current = true), onPointerLeave: () => void (held.current = false) }), [])
  return { box, seen, width, visible, held, hold }
}

/**
 * How many of `beats` are drawn. All of them until `run`; then none, and one
 * more after each beat's wait while the preview is `visible`, `live` (its host
 * has not paused it) and, for a loop, while the pointer is elsewhere (`held`).
 * When the script reaches its end, `end` is called and the last frame holds
 * (the host moves on from it); with no `end`, a loop starts again after
 * `REST`. `loop` is read as it stands, so a reader taking over mid-script lets
 * it finish rather than start over. Bumping `replay` plays it again.
 */
export function usePlay<B extends Beat>(
  beats: B[],
  run: boolean,
  replay: number,
  gate: {
    visible: { current: boolean }
    held: { current: boolean }
    loop: { current: boolean }
    live: { current: boolean }
    end: { current: (() => void) | undefined }
  },
) {
  const [state, setState] = useState<{ beats: B[]; replay: number; at: number } | null>(null)
  const { visible, held, loop, live, end } = gate
  useEffect(() => {
    if (!run) return
    let i = 0
    let t = 0
    const step = () => {
      if (!visible.current || !live.current || (loop.current && held.current)) return void (t = window.setTimeout(step, 250))
      if (i >= beats.length) {
        // A host that listens for the end moves on from the last frame, so it holds.
        if (end.current) return void end.current()
        if (!loop.current) return
        i = 0
        setState({ beats, replay, at: 0 })
        return void (t = window.setTimeout(step, beats[0].wait))
      }
      i += 1
      setState({ beats, replay, at: i })
      t = window.setTimeout(step, i < beats.length ? beats[i].wait : REST)
    }
    t = window.setTimeout(step, beats[0].wait)
    return () => window.clearTimeout(t)
  }, [beats, run, replay, visible, held, loop, live, end])
  if (!run) return beats.length
  return state && state.beats === beats && state.replay === replay ? state.at : 0
}

/** What a page or a host (the landing's hero) tells a preview. */
export interface PreviewProps {
  /** Plays while true, the default; false holds the frame it is on. */
  play?: boolean
  /**
   * Called when the script has played to its end, which then holds its last
   * frame; mount it again (a new key) to replay. Never called under reduced
   * motion, which plays nothing.
   */
  onEnd?: () => void
  /** Fills the box it is given (a device's screen) and lays itself out by its own width rather than the window's. */
  compact?: boolean
  /** Draws the phone app whatever the width. */
  phone?: boolean
}

/** The host's `play` and `onEnd`, as the refs `usePlay` reads. */
export function useHost({ play = true, onEnd }: PreviewProps) {
  const live = useRef(play)
  const end = useRef(onEnd)
  useEffect(() => {
    live.current = play
    end.current = onEnd
  }, [play, onEnd])
  return { live, end }
}

/** The width from which a compact preview draws the desktop app rather than the phone's. */
const DESK = 600

/**
 * Whether the desktop app is drawn: always or never once the preview is told
 * (`phone`) or measures itself (`compact`), and by the window otherwise
 * (`null`: from 768px, through `md`).
 */
export function useDesk(width: number, { compact, phone }: PreviewProps): boolean | null {
  if (phone) return false
  if (compact) return width ? width >= DESK : null
  return null
}

/** A style for the desktop app: from 768px when the window decides, always or never when the preview does. */
export const md = <S extends object>(desk: boolean | null, style: S): S | { $md: S } | Record<string, never> => (desk === null ? { $md: style } : desk ? style : {})
