// The phone's drawer as numbers (Drawer.tsx draws it): how far the pane slides,
// which way, and where a drag lets it go.
//
// The pane slides toward the END side of the line: right where text runs left to
// right, left under `dir="rtl"`. A transform has no logical form, so its sign is
// the one physical fact in the drawer, and it is read off the page
// (`getComputedStyle(…).direction`), never assumed. Everything else is logical:
// the menu stands at the start, the strip of pane left in sight at the end.
//
// A drag is measured ALONG the line: positive toward the end, whichever way the
// line runs, so the same numbers close an LTR drawer pulled left and an RTL one
// pulled right.

/** The pane left in sight at the end edge while the menu is open, px: a thumb's 44 and space around it. */
export const STRIP = 64

/** The menu's widest, px: a phone held sideways, or a small tablet, keeps the menu a menu. */
export const REACH = 360

/** How far the pane slides, as CSS: the window less the strip, up to `REACH`. `%` is the window's width wherever it is read. */
export const OPEN = `min(100% - ${STRIP}px, ${REACH}px)`

/** Shut (no menu), open, or sliding home before the menu goes. */
export type State = 'shut' | 'open' | 'closing'

/** Which way the end side is, as a sign on the x axis. */
export const sign = (direction: string): 1 | -1 => (direction === 'rtl' ? -1 : 1)

/** px a finger moves before a drag is a drag, and not a tap or a scroll. */
export const SLOP = 8

/**
 * What a finger's first movement is: a pull along the line (`x`), a scroll
 * (`y`), or nothing yet. Along the line has to win clearly: a list scrolls on a
 * slant.
 */
export function axis(dx: number, dy: number): 'x' | 'y' | null {
  const x = Math.abs(dx)
  const y = Math.abs(dy)
  if (x < SLOP && y < SLOP) return null
  return x > y * 1.2 ? 'x' : 'y'
}

/** Where the pane stands while a finger holds it, px from home: where it was, moved along the line, never past home or open. */
export function pull(from: number, dx: number, way: 1 | -1, reach: number): number {
  return Math.min(reach, Math.max(0, from + dx * way))
}

/** A flick, px per ms along the line: faster than this decides by its way, whatever the distance. */
export const FLICK = 0.4

/** Whether a pane let go at `at` px from home, moving `speed` px/ms along the line, stays open. */
export function settle(at: number, reach: number, speed: number): boolean {
  if (speed <= -FLICK) return false
  if (speed >= FLICK) return true
  return at > reach / 2
}
