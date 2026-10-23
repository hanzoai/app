import { describe, expect, test } from 'vitest'
import { fit, follow, FOOT, HEIGHT, TOP, type Viewport } from './view'

// An iPhone at 440×956 CSS px with a 34px home indicator, its keyboard 345px
// tall (the reference: the keyboard's top at 611, so 956 − 611).
const LAYOUT = 956
const KEYBOARD = 345
const view = (v: Partial<Viewport>): Viewport => ({ height: LAYOUT, offsetTop: 0, scale: 1, ...v })

describe('fit', () => {
  test('the visual viewport is the layout one: the window keeps 100dvh', () => {
    expect(fit(LAYOUT, view({}))).toBeNull()
  })

  test('a keyboard up, the view not panned: the window is the view, at the top', () => {
    expect(fit(LAYOUT, view({ height: LAYOUT - KEYBOARD }))).toEqual({ top: 0, height: 611, keyboard: KEYBOARD })
  })

  test('a keyboard up and the view panned down to the field: the window follows it down', () => {
    expect(fit(LAYOUT, view({ height: 611, offsetTop: KEYBOARD }))).toEqual({ top: KEYBOARD, height: 611, keyboard: KEYBOARD })
    expect(fit(LAYOUT, view({ height: 611, offsetTop: 120 }))).toEqual({ top: 120, height: 611, keyboard: KEYBOARD })
  })

  test('the window ends where the keyboard begins, wherever the view is panned', () => {
    for (const offsetTop of [0, 50, 200, KEYBOARD]) {
      const at = fit(LAYOUT, view({ height: 611, offsetTop }))!
      expect(at.top + at.height).toBe(offsetTop + 611)
    }
  })

  test('a pinch zoom is the reader’s, and the window does not chase it', () => {
    expect(fit(LAYOUT, view({ height: LAYOUT / 2, offsetTop: 300, scale: 2 }))).toBeNull()
  })

  test('fractions round to whole px, so the window never sits half a px off', () => {
    expect(fit(955.6, view({ height: 610.4, offsetTop: 344.6 }))).toEqual({ top: 345, height: 610, keyboard: 346 })
  })

  test('less than a px of difference is no keyboard', () => {
    expect(fit(LAYOUT, view({ height: LAYOUT - 0.4 }))).toBeNull()
    expect(fit(LAYOUT, view({ height: LAYOUT + 2 }))).toBeNull()
  })

  test('the styles fall back to the whole window and the home indicator', () => {
    expect(TOP).toBe('var(--view-top, 0px)')
    expect(HEIGHT).toBe('var(--view-height, 100dvh)')
    expect(FOOT).toBe('max(0px, calc(var(--safe-bottom, 0px) - var(--keyboard, 0px)))')
  })
})

/** A visual viewport, a frame clock and a style to watch `follow` against. */
function rig() {
  const vv = { height: LAYOUT, offsetTop: 0, scale: 1, fns: new Map<string, () => void>() }
  const source = {
    get height() {
      return vv.height
    },
    get offsetTop() {
      return vv.offsetTop
    },
    get scale() {
      return vv.scale
    },
    addEventListener: (type: string, fn: () => void) => vv.fns.set(type, fn),
    removeEventListener: (type: string) => vv.fns.delete(type),
  }
  const frames: (() => void)[] = []
  const frame = {
    innerHeight: LAYOUT,
    requestAnimationFrame: (fn: () => void) => frames.push(fn),
    cancelAnimationFrame: (id: number) => {
      frames[id - 1] = () => {}
    },
  }
  const props = new Map<string, string>()
  const writes: string[] = []
  const style = {
    setProperty: (k: string, v: string) => {
      props.set(k, v)
      writes.push(`${k}=${v}`)
    },
    removeProperty: (k: string) => {
      props.delete(k)
      writes.push(`-${k}`)
      return ''
    },
  }
  const fire = (type: 'resize' | 'scroll') => vv.fns.get(type)?.()
  const tick = () => frames.splice(0).forEach((f) => f())
  return { vv, source, frame, style, props, writes, fire, tick, frames }
}

describe('follow', () => {
  test('writes the place at once, then once a frame however many events arrive', () => {
    const r = rig()
    const stop = follow(r.style, r.source, r.frame)
    expect(r.props.get('--keyboard')).toBe('0px')
    expect(r.props.has('--view-top')).toBe(false)

    r.vv.height = 611
    r.vv.offsetTop = KEYBOARD
    r.fire('resize')
    r.fire('scroll')
    r.fire('resize')
    expect(r.frames).toHaveLength(1)
    const before = r.writes.length
    r.tick()
    expect(r.writes.slice(before)).toEqual(['--view-top=345px', '--view-height=611px', '--keyboard=345px'])

    // The same place again writes nothing.
    r.fire('scroll')
    r.tick()
    expect(r.writes).toHaveLength(before + 3)
    stop()
  })

  test('the keyboard down: the window goes back to 100dvh and the home indicator', () => {
    const r = rig()
    const stop = follow(r.style, r.source, r.frame)
    r.vv.height = 611
    r.fire('resize')
    r.tick()
    expect(r.props.get('--view-height')).toBe('611px')
    r.vv.height = LAYOUT
    r.fire('resize')
    r.tick()
    expect(r.props.has('--view-top')).toBe(false)
    expect(r.props.has('--view-height')).toBe(false)
    expect(r.props.get('--keyboard')).toBe('0px')
    stop()
  })

  test('stopping lets go of the viewport and drops a frame still queued', () => {
    const r = rig()
    const stop = follow(r.style, r.source, r.frame)
    r.vv.height = 611
    r.fire('resize')
    stop()
    expect(r.vv.fns.size).toBe(0)
    const before = r.writes.length
    r.tick()
    expect(r.writes).toHaveLength(before)
  })
})
