// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createScrollAnchor, isPinned, ThreadScrollMemory, PIN_SLACK } from './scrollAnchor'

function makeScroller(initial: { scrollHeight: number; clientHeight: number; scrollTop: number }) {
  const root = document.createElement('div')
  const scroller = document.createElement('div')
  scroller.setAttribute('data-slot', 'thread')
  root.appendChild(scroller)
  document.body.appendChild(root)

  let sh = initial.scrollHeight
  let ch = initial.clientHeight
  let st = initial.scrollTop

  Object.defineProperty(scroller, 'scrollHeight', {
    configurable: true,
    get: () => sh,
  })
  Object.defineProperty(scroller, 'clientHeight', {
    configurable: true,
    get: () => ch,
  })
  Object.defineProperty(scroller, 'scrollTop', {
    configurable: true,
    get: () => st,
    set: (v: number) => {
      st = Math.max(0, Math.min(v, Math.max(0, sh - ch)))
    },
  })
  scroller.scrollTo = ((arg: ScrollToOptions | number, y?: number) => {
    const next = typeof arg === 'number' ? (y ?? arg) : (arg.top ?? 0)
    st = Math.max(0, Math.min(next, Math.max(0, sh - ch)))
  }) as typeof scroller.scrollTo

  return {
    root,
    scroller,
    setScrollHeight: (next: number) => {
      sh = next
    },
    getScrollTop: () => st,
    cleanup: () => root.remove(),
  }
}

describe('5-mode scroll stability controller (§7.3)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  it('isPinned respects PIN_SLACK threshold', () => {
    expect(isPinned({ scrollHeight: 1000, clientHeight: 400, scrollTop: 600 })).toBe(true)
    expect(isPinned({ scrollHeight: 1000, clientHeight: 400, scrollTop: 600 - PIN_SLACK })).toBe(true)
    expect(isPinned({ scrollHeight: 1000, clientHeight: 400, scrollTop: 600 - PIN_SLACK - 1 })).toBe(false)
  })

  it('(a) at bottom while streaming follows smoothly as content grows', async () => {
    const { root, scroller, setScrollHeight, getScrollTop, cleanup } = makeScroller({
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 600,
    })
    const memory = new ThreadScrollMemory()
    const anchor = createScrollAnchor({
      root,
      findScroller: (r) => r.querySelector('[data-slot="thread"]'),
      threadKey: 'thread-a',
      memory,
    })

    expect(anchor.mode()).toBe('at-bottom')

    // Simulate streaming token arrival growing the thread
    setScrollHeight(1400)
    const msg = document.createElement('p')
    msg.textContent = 'streamed token chunk'
    scroller.appendChild(msg)
    await Promise.resolve()

    expect(getScrollTop()).toBe(1000)
    expect(anchor.mode()).toBe('at-bottom')

    anchor.dispose()
    cleanup()
  })

  it('(b) scrolled up reading history preserves viewport while streaming', async () => {
    const { root, scroller, setScrollHeight, getScrollTop, cleanup } = makeScroller({
      scrollHeight: 1600,
      clientHeight: 400,
      scrollTop: 1200,
    })
    const memory = new ThreadScrollMemory()
    const anchor = createScrollAnchor({
      root,
      findScroller: (r) => r.querySelector('[data-slot="thread"]'),
      threadKey: 'thread-b',
      memory,
    })

    // User scrolls up to read earlier messages
    scroller.scrollTop = 220
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
    expect(anchor.mode()).toBe('reading-history')

    // Assistant streams more tokens below
    setScrollHeight(2200)
    const chunk = document.createElement('p')
    chunk.textContent = 'more streamed tokens'
    scroller.appendChild(chunk)
    await Promise.resolve()

    expect(getScrollTop()).toBe(220)
    expect(anchor.mode()).toBe('reading-history')

    anchor.dispose()
    cleanup()
  })

  it('(c) selecting text suspends auto-scroll even when anchored at bottom', async () => {
    const { root, scroller, setScrollHeight, getScrollTop, cleanup } = makeScroller({
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 600,
    })
    const textEl = document.createElement('span')
    textEl.textContent = 'Important snippet to copy'
    scroller.appendChild(textEl)

    const memory = new ThreadScrollMemory()
    const anchor = createScrollAnchor({
      root,
      findScroller: (r) => r.querySelector('[data-slot="thread"]'),
      threadKey: 'thread-c',
      memory,
    })

    const spy = vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      toString: () => 'Important snippet',
      anchorNode: textEl.firstChild,
      focusNode: textEl.firstChild,
    } as unknown as Selection)

    document.dispatchEvent(new Event('selectionchange'))
    expect(anchor.mode()).toBe('selecting-text')

    // Streaming appends more content; scrollTop must stay locked at 600
    setScrollHeight(1500)
    const extra = document.createElement('p')
    extra.textContent = 'new streamed output'
    scroller.appendChild(extra)
    await Promise.resolve()

    expect(getScrollTop()).toBe(600)

    spy.mockRestore()
    anchor.dispose()
    cleanup()
  })

  it('(d) returning to an existing thread restores saved reading position', async () => {
    const memory = new ThreadScrollMemory()

    // First visit: scroll up to position 310 and leave
    const first = makeScroller({ scrollHeight: 1800, clientHeight: 400, scrollTop: 1400 })
    const a1 = createScrollAnchor({
      root: first.root,
      findScroller: (r) => r.querySelector('[data-slot="thread"]'),
      threadKey: 'thread-d',
      memory,
    })
    first.scroller.scrollTop = 310
    first.scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
    a1.dispose()
    first.cleanup()

    // Return visit: initially mounts at top 0 while messages hydrate, then content arrives
    const second = makeScroller({ scrollHeight: 1800, clientHeight: 400, scrollTop: 0 })
    const a2 = createScrollAnchor({
      root: second.root,
      findScroller: (r) => r.querySelector('[data-slot="thread"]'),
      threadKey: 'thread-d',
      memory,
    })

    expect(second.getScrollTop()).toBe(310)
    expect(a2.mode()).toBe('reading-history')

    a2.dispose()
    second.cleanup()
  })

  it('(e) sending a new message re-engages bottom anchoring and brings message into view', async () => {
    const { root, scroller, setScrollHeight, getScrollTop, cleanup } = makeScroller({
      scrollHeight: 1600,
      clientHeight: 400,
      scrollTop: 1200,
    })
    const memory = new ThreadScrollMemory()
    const anchor = createScrollAnchor({
      root,
      findScroller: (r) => r.querySelector('[data-slot="thread"]'),
      threadKey: 'thread-e',
      memory,
    })

    // User was scrolled up reading earlier content
    scroller.scrollTop = 180
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
    expect(anchor.mode()).toBe('reading-history')

    // User sends a new message
    setScrollHeight(1850)
    anchor.onSubmit()
    expect(anchor.mode()).toBe('at-bottom')
    expect(getScrollTop()).toBe(1450)

    anchor.dispose()
    cleanup()
  })
})
