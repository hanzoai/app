/**
 * 5-mode scroll stability controller for chat timelines (§7.3):
 *  (a) At bottom while streaming -> follow smoothly as tokens/content arrive.
 *  (b) Scrolled up reading earlier content -> preserve viewport; never yank to bottom.
 *  (c) Selecting/copying text -> suspend auto-scroll so selection is never ripped away.
 *  (d) Returning to an existing thread -> restore saved reading position.
 *  (e) Sending a new message -> re-engage bottom anchoring and bring message into view.
 *
 * Also preserves the visible turn anchor when the thread container width changes
 * (e.g. opening, resizing, or closing an artifact/right split panel).
 */

import { useCallback, useEffect, useRef } from 'react'

/** Distance from the bottom (px) that still counts as anchored at the bottom. */
export const PIN_SLACK = 64

/** Maximum per-thread scroll positions remembered in memory. */
const MAX_SAVED_THREADS = 64

export interface ScrollMetrics {
  scrollHeight: number
  clientHeight: number
  scrollTop: number
}

export interface SavedScrollState {
  scrollTop: number
  pinned: boolean
}

export type ScrollMode = 'at-bottom' | 'reading-history' | 'selecting-text'

/** True when the scroll container is within `slack` px of its bottom edge (or has no overflow). */
export function isPinned(el: ScrollMetrics, slack = PIN_SLACK): boolean {
  const remaining = el.scrollHeight - el.clientHeight - el.scrollTop
  return remaining <= slack
}

/** True when the browser currently holds a non-collapsed text selection inside `container`. */
export function hasSelectionInside(container: Node | null): boolean {
  if (!container || typeof window === 'undefined' || typeof window.getSelection !== 'function') return false
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.toString().length) return false
  const anchor = sel.anchorNode
  const focus = sel.focusNode
  return Boolean((anchor && container.contains(anchor)) || (focus && container.contains(focus)))
}

/** Bounded in-memory LRU store of per-thread scroll positions. */
export class ThreadScrollMemory {
  private readonly store = new Map<string, SavedScrollState>()

  get(key: string): SavedScrollState | undefined {
    const found = this.store.get(key)
    if (!found) return undefined
    // Refresh recency
    this.store.delete(key)
    this.store.set(key, found)
    return found
  }

  set(key: string, state: SavedScrollState): void {
    if (!key) return
    if (this.store.has(key)) this.store.delete(key)
    this.store.set(key, state)
    if (this.store.size > MAX_SAVED_THREADS) {
      const oldest = this.store.keys().next().value
      if (oldest !== undefined) this.store.delete(oldest)
    }
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

/** Shared thread scroll memory across Chat & Dev panes in this browsing session. */
export const threadScrollMemory = new ThreadScrollMemory()

export interface ScrollAnchorHandle {
  /** Call when the user submits a new message (mode e): pins to bottom and scrolls into view. */
  onSubmit: () => void
  /** Call when the user explicitly requests jumping to the bottom (e.g. ToBottom button). */
  scrollToBottom: (smooth?: boolean) => void
  /** Current scroll stability mode. */
  mode: () => ScrollMode
  /** Tear down all listeners and observers. */
  dispose: () => void
}

export interface CreateScrollAnchorOptions {
  /** Container that holds (or is) the scrollable thread element. */
  root: HTMLElement
  /** Resolves the actual scrollable element inside `root`. */
  findScroller: (root: HTMLElement) => HTMLElement | null
  /** Stable thread identifier for save/restore across thread switches. */
  threadKey: string
  /** Optional custom scroll memory (defaults to shared `threadScrollMemory`). */
  memory?: ThreadScrollMemory
  /** Optional slack px override (default `PIN_SLACK`). */
  slack?: number
}

interface VisibleTurnAnchor {
  id: string
  offset: number
}

function captureTurnAnchor(scroller: HTMLElement): VisibleTurnAnchor | null {
  const turns = scroller.querySelectorAll<HTMLElement>('[data-turn-id]')
  if (!turns.length) return null
  const top = scroller.getBoundingClientRect().top
  for (const turn of turns) {
    const rect = turn.getBoundingClientRect()
    if (rect.bottom > top + 4) {
      const id = turn.getAttribute('data-turn-id')
      if (id) return { id, offset: rect.top - top }
    }
  }
  return null
}

function restoreTurnAnchor(scroller: HTMLElement, anchor: VisibleTurnAnchor): void {
  const turns = scroller.querySelectorAll<HTMLElement>('[data-turn-id]')
  const top = scroller.getBoundingClientRect().top
  for (const turn of turns) {
    if (turn.getAttribute('data-turn-id') === anchor.id) {
      const delta = turn.getBoundingClientRect().top - top - anchor.offset
      if (Math.abs(delta) > 1) scroller.scrollTop += delta
      return
    }
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

/**
 * Attaches 5-mode scroll anchoring to a chat container.
 */
export function createScrollAnchor({
  root,
  findScroller,
  threadKey,
  memory = threadScrollMemory,
  slack = PIN_SLACK,
}: CreateScrollAnchorOptions): ScrollAnchorHandle {
  const saved = threadKey ? memory.get(threadKey) : undefined
  let pinned = saved ? saved.pinned : true
  let pendingRestore: number | null = saved && !saved.pinned && saved.scrollTop > 0 ? saved.scrollTop : null
  let selecting = false
  let selectionLockTop: number | null = null
  let userScrolling = false
  let userScrollTimer: ReturnType<typeof setTimeout> | null = null
  let lastWidth = 0
  let visibleAnchor: VisibleTurnAnchor | null = null
  let raf = 0

  const getScroller = () => findScroller(root)

  const saveCurrent = (el: HTMLElement) => {
    if (!threadKey) return
    memory.set(threadKey, { scrollTop: el.scrollTop, pinned })
  }

  const refreshSelection = () => {
    const el = getScroller()
    const next = hasSelectionInside(el ?? root)
    if (next && !selecting && el) {
      selectionLockTop = el.scrollTop
    } else if (!next) {
      selectionLockTop = null
    }
    selecting = next
  }

  const scrollEnd = (el: HTMLElement, smooth = false) => {
    const target = el.scrollHeight
    if (smooth && !prefersReducedMotion() && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: target, behavior: 'smooth' })
    } else {
      el.scrollTop = target
    }
  }

  const tryRestore = (el: HTMLElement): boolean => {
    if (pendingRestore === null) return false
    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight)
    if (maxTop === 0) return false
    el.scrollTop = Math.min(pendingRestore, maxTop)
    if (maxTop >= pendingRestore || el.scrollHeight > el.clientHeight) {
      pendingRestore = null
    }
    pinned = false
    visibleAnchor = captureTurnAnchor(el)
    return true
  }

  const syncAfterGrowth = () => {
    const el = getScroller()
    if (!el) return
    refreshSelection()
    if (pendingRestore !== null) {
      tryRestore(el)
      return
    }
    if (selecting) {
      if (selectionLockTop !== null && Math.abs(el.scrollTop - selectionLockTop) > 1) {
        el.scrollTop = selectionLockTop
      }
      return
    }
    if (pinned) {
      scrollEnd(el, false)
    }
  }

  const scheduleSync = () => {
    if (raf || typeof window === 'undefined') return
    raf = window.requestAnimationFrame(() => {
      raf = 0
      syncAfterGrowth()
    })
  }

  const markUserScroll = () => {
    userScrolling = true
    if (userScrollTimer !== null) clearTimeout(userScrollTimer)
    userScrollTimer = setTimeout(() => {
      userScrolling = false
    }, 150)
  }

  const onScroll = (ev: Event) => {
    const el = getScroller()
    if (!el) return
    if (ev.target && ev.target !== el && ev.target !== root) return
    refreshSelection()
    // If text is selected and a programmatic scroll (not user wheel/touch) nudged us, hold steady.
    if (selecting && !userScrolling && selectionLockTop !== null) {
      if (Math.abs(el.scrollTop - selectionLockTop) > 1) {
        el.scrollTop = selectionLockTop
      }
      return
    }
    if (selecting && userScrolling) {
      selectionLockTop = el.scrollTop
    }
    if (pendingRestore !== null && !userScrolling) {
      return
    }
    pendingRestore = null
    pinned = isPinned(el, slack)
    visibleAnchor = pinned ? null : captureTurnAnchor(el)
    saveCurrent(el)
  }

  const onWheel = () => markUserScroll()
  const onTouchMove = () => markUserScroll()
  const onPointerUp = () => refreshSelection()
  const onSelectionChange = () => refreshSelection()

  const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(scheduleSync) : null
  mo?.observe(root, { childList: true, subtree: true, characterData: true })

  const ro =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          const el = getScroller()
          if (!el) return
          const w = el.clientWidth
          if (lastWidth > 0 && w !== lastWidth && !pinned && !selecting && visibleAnchor) {
            restoreTurnAnchor(el, visibleAnchor)
            saveCurrent(el)
          } else {
            scheduleSync()
          }
          lastWidth = w
        })
      : null
  ro?.observe(root)

  const initialEl = getScroller()
  if (initialEl) {
    lastWidth = initialEl.clientWidth
    ro?.observe(initialEl)
    if (pendingRestore !== null) {
      tryRestore(initialEl)
    } else if (pinned) {
      scrollEnd(initialEl, false)
    }
  }

  root.addEventListener('scroll', onScroll, { capture: true, passive: true })
  root.addEventListener('wheel', onWheel, { capture: true, passive: true })
  root.addEventListener('touchmove', onTouchMove, { capture: true, passive: true })
  root.addEventListener('pointerup', onPointerUp, { capture: true, passive: true })
  if (typeof document !== 'undefined') {
    document.addEventListener('selectionchange', onSelectionChange)
  }

  const scrollToBottom = (smooth = false) => {
    const el = getScroller()
    pendingRestore = null
    selecting = false
    selectionLockTop = null
    pinned = true
    visibleAnchor = null
    if (el) {
      scrollEnd(el, smooth)
      saveCurrent(el)
    }
  }

  const onSubmit = () => {
    scrollToBottom(false)
    // Follow up after React commits the newly appended user message.
    scheduleSync()
  }

  const mode = (): ScrollMode => {
    refreshSelection()
    if (selecting) return 'selecting-text'
    return pinned ? 'at-bottom' : 'reading-history'
  }

  const dispose = () => {
    const el = getScroller()
    if (el) saveCurrent(el)
    if (raf && typeof window !== 'undefined') window.cancelAnimationFrame(raf)
    if (userScrollTimer !== null) clearTimeout(userScrollTimer)
    mo?.disconnect()
    ro?.disconnect()
    root.removeEventListener('scroll', onScroll, { capture: true })
    root.removeEventListener('wheel', onWheel, { capture: true })
    root.removeEventListener('touchmove', onTouchMove, { capture: true })
    root.removeEventListener('pointerup', onPointerUp, { capture: true })
    if (typeof document !== 'undefined') {
      document.removeEventListener('selectionchange', onSelectionChange)
    }
  }

  return { onSubmit, scrollToBottom, mode, dispose }
}

/**
 * React hook binding `createScrollAnchor` to a container element and thread key.
 */
export function useThreadScrollAnchor(
  container: HTMLElement | null,
  threadKey: string,
  findScroller: (root: HTMLElement) => HTMLElement | null,
): { onSubmit: () => void; scrollToBottom: (smooth?: boolean) => void } {
  const handleRef = useRef<ScrollAnchorHandle | null>(null)
  const finderRef = useRef(findScroller)
  finderRef.current = findScroller

  useEffect(() => {
    if (!container) {
      handleRef.current = null
      return
    }
    const handle = createScrollAnchor({
      root: container,
      findScroller: (r) => finderRef.current(r),
      threadKey,
    })
    handleRef.current = handle
    return () => {
      handle.dispose()
      if (handleRef.current === handle) handleRef.current = null
    }
  }, [container, threadKey])

  const onSubmit = useCallback(() => {
    handleRef.current?.onSubmit()
  }, [])

  const scrollToBottom = useCallback((smooth = false) => {
    handleRef.current?.scrollToBottom(smooth)
  }, [])

  return { onSubmit, scrollToBottom }
}
