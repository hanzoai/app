'use client'

// The window kept inside what the reader can see, so a phone's keyboard never
// covers the composer.
//
// A phone's keyboard does not shrink the page: the layout viewport keeps its
// height and only the VISUAL viewport (`window.visualViewport`) loses the
// keyboard's height, and the browser pans it down the layout to show the field.
// So the app reads the visual viewport and stands the window in it: its top at
// the visual viewport's top, its height the visual viewport's. The bar stays at
// the top of what shows, the composer sits on the keyboard, and the transcript
// scrolls in what is left between them.
//
//   const view = useView()
//   <YStack ref={view} $max-md={{ position: 'fixed', t: TOP, height: HEIGHT }}>
//
// It writes three custom properties on the element, which every descendant
// reads, and nothing else: no state, so a keyboard opening re-renders nothing.
//
//   --view-top     px from the layout viewport's top to the visual one's
//   --view-height  px of the visual viewport
//   --keyboard     px the keyboard takes from the view; 0 when it is down
//
// While the visual viewport is the layout one, the first two are unset (the
// window keeps 100dvh) and --keyboard is 0. A pinch-zoom shrinks the visual
// viewport too, and the window does not chase it. Events are folded into one
// write per frame.

import { useCallback, useRef } from 'react'

/** The visual viewport, as `window.visualViewport` reports it. */
export interface Viewport {
  height: number
  offsetTop: number
  scale: number
}

/** Where the window stands, px. */
export interface Fit {
  top: number
  height: number
  keyboard: number
}

/** A zoom past this is the reader's pinch, not a keyboard. */
const ZOOM = 1.01

/**
 * Where the window stands in a layout viewport `layout` px tall: null while the
 * visual viewport is all of it, or zoomed in.
 */
export function fit(layout: number, view: Viewport): Fit | null {
  if (view.scale > ZOOM) return null
  const height = Math.round(view.height)
  const keyboard = Math.round(layout) - height
  if (keyboard < 1) return null
  return { top: Math.max(0, Math.round(view.offsetTop)), height, keyboard }
}

/** The window's top, for a style: the visual viewport's while a keyboard is up. */
export const TOP = 'var(--view-top, 0px)'

/** The window's height, for a style: the visual viewport's while a keyboard is up. */
export const HEIGHT = 'var(--view-height, 100dvh)'

/** The home indicator's inset, which the keyboard covers while it is up. */
export const FOOT = 'max(0px, calc(var(--safe-bottom, 0px) - var(--keyboard, 0px)))'

interface Style {
  setProperty(name: string, value: string): void
  removeProperty(name: string): string
}

interface Source extends Viewport {
  addEventListener(type: 'resize' | 'scroll', fn: () => void): void
  removeEventListener(type: 'resize' | 'scroll', fn: () => void): void
}

interface Frame {
  innerHeight: number
  requestAnimationFrame(fn: () => void): number
  cancelAnimationFrame(id: number): void
}

/** Writes the window's place on `style` as `view` moves, once a frame; returns the stop. */
export function follow(style: Style, view: Source, frame: Frame): () => void {
  let queued = 0
  let last: string | null = null
  const write = () => {
    queued = 0
    const at = fit(frame.innerHeight, view)
    const key = at ? `${at.top}/${at.height}/${at.keyboard}` : ''
    if (key === last) return
    last = key
    if (at) {
      style.setProperty('--view-top', `${at.top}px`)
      style.setProperty('--view-height', `${at.height}px`)
      style.setProperty('--keyboard', `${at.keyboard}px`)
    } else {
      style.removeProperty('--view-top')
      style.removeProperty('--view-height')
      style.setProperty('--keyboard', '0px')
    }
  }
  const queue = () => {
    if (!queued) queued = frame.requestAnimationFrame(write)
  }
  view.addEventListener('resize', queue)
  view.addEventListener('scroll', queue)
  write()
  return () => {
    view.removeEventListener('resize', queue)
    view.removeEventListener('scroll', queue)
    if (queued) frame.cancelAnimationFrame(queued)
  }
}

/**
 * The ref for the window: it follows the visual viewport while mounted. A
 * browser without one leaves the window at 100dvh.
 */
export function useView(): (node: unknown) => void {
  const stop = useRef<(() => void) | null>(null)
  return useCallback((node: unknown) => {
    stop.current?.()
    stop.current = null
    // A gui stack hands its host element through a ref typed for native too; on the web it is the element.
    if (node instanceof HTMLElement && window.visualViewport) stop.current = follow(node.style, window.visualViewport, window)
  }, [])
}
