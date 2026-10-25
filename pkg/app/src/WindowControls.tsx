'use client'

import { useEffect, useState } from 'react'

function getWindow() {
  if (typeof window === 'undefined') return null
  const w = window as any
  if (w.__TAURI__?.window?.getCurrentWindow) {
    try {
      return w.__TAURI__.window.getCurrentWindow()
    } catch {}
  }
  return null
}

function getWindowLabel(): string {
  if (typeof window === 'undefined') return 'main'
  const w = window as any
  const win = getWindow()
  return (
    win?.label ||
    w.__TAURI_INTERNALS__?.metadata?.currentWindow?.label ||
    w.__TAURI_INTERNALS__?.metadata?.currentWebview?.windowLabel ||
    'main'
  )
}

function invokeTauri(cmd: string, args: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return Promise.resolve()
  const w = window as any
  const label = getWindowLabel()
  const payload = { label, ...args }

  if (w.__TAURI_INTERNALS__?.invoke) {
    return w.__TAURI_INTERNALS__.invoke(cmd, payload)
  }
  if (w.__TAURI__?.core?.invoke) {
    return w.__TAURI__.core.invoke(cmd, payload)
  }
  if (w.__TAURI__?.invoke) {
    return w.__TAURI__.invoke(cmd, payload)
  }
  return Promise.resolve()
}

const INTERACTIVE_SELECTOR = [
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="option"]',
  '[role="combobox"]',
  '[aria-haspopup]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
  '[data-tauri-drag-region="false"]',
  '[data-slot="window-controls"]',
].join(', ')

function isInteractiveTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof el.closest !== 'function') return false
  if (el.closest(INTERACTIVE_SELECTOR)) return true
  if (el.closest('a:not([data-tauri-drag-region])')) return true
  return false
}

let lastReactMouseDown = 0

export function dragWindow(e: React.MouseEvent) {
  if (e.button !== 0) return
  if (isInteractiveTarget(e.target)) return

  lastReactMouseDown = Date.now()
  e.preventDefault?.()
  e.stopPropagation?.()

  // Let double-clicks be handled by toggleWindowMaximize instead of starting a drag
  if (e.detail && e.detail > 1) return

  const win = getWindow()
  if (win?.startDragging) {
    try {
      win.startDragging()
      return
    } catch {}
  }
  invokeTauri('plugin:window|start_dragging')
}

export function toggleWindowMaximize(e: React.MouseEvent) {
  if (isInteractiveTarget(e.target)) return
  e.preventDefault?.()
  e.stopPropagation?.()

  // When Tauri's built-in drag.js handles double-click on [data-tauri-drag-region],
  // it calls stopImmediatePropagation() on the mousedown event and invokes
  // plugin:window|internal_toggle_maximize before the browser fires dblclick.
  // Skip the duplicate toggle when React did not receive the preceding mousedown.
  const el = e.target as HTMLElement | null
  if (
    e.type === 'dblclick' &&
    Date.now() - lastReactMouseDown > 500 &&
    typeof el?.closest === 'function' &&
    el.closest('[data-tauri-drag-region]')
  ) {
    return
  }

  const win = getWindow()
  if (win?.toggleMaximize) {
    try {
      win.toggleMaximize()
      return
    } catch {}
  }
  invokeTauri('plugin:window|toggle_maximize')
}

export function WindowControls() {
  const [isDesktop, setIsDesktop] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const desktop =
      typeof window !== 'undefined' &&
      Boolean(
        (window as any).__TAURI__ ||
        (window as any).__TAURI_INTERNALS__
      )
    setIsDesktop(desktop)
    if (!desktop) return

    document.documentElement.setAttribute('data-desktop', 'true')

    const syncMaximized = () => {
      const win = getWindow()
      const checkMax = win?.isMaximized
        ? win.isMaximized()
        : invokeTauri('plugin:window|is_maximized')

      Promise.resolve(checkMax)
        .then((val) => {
          const max = Boolean(val)
          setIsMaximized(max)
          if (max) document.documentElement.setAttribute('data-maximized', 'true')
          else document.documentElement.removeAttribute('data-maximized')
        })
        .catch(() => {})
    }

    syncMaximized()
    window.addEventListener('resize', syncMaximized)
    return () => window.removeEventListener('resize', syncMaximized)
  }, [])

  if (!isDesktop) return null

  const handleMinimize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const win = getWindow()
    if (win?.minimize) win.minimize().catch(() => invokeTauri('plugin:window|minimize'))
    else invokeTauri('plugin:window|minimize')
  }

  const handleToggleMaximize = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const win = getWindow()
    if (win?.toggleMaximize) {
      await win.toggleMaximize().catch(() => invokeTauri('plugin:window|toggle_maximize'))
    } else {
      await invokeTauri('plugin:window|toggle_maximize')
    }
    const val = win?.isMaximized
      ? await win.isMaximized().catch(() => !isMaximized)
      : await invokeTauri('plugin:window|is_maximized').catch(() => !isMaximized)
    const max = Boolean(val)
    setIsMaximized(max)
    if (max) document.documentElement.setAttribute('data-maximized', 'true')
    else document.documentElement.removeAttribute('data-maximized')
  }

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const win = getWindow()
    if (win?.close) win.close().catch(() => invokeTauri('plugin:window|close'))
    else invokeTauri('plugin:window|close')
  }

  return (
    <div
      data-slot="window-controls"
      data-tauri-drag-region="false"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        marginInlineStart: 'auto',
        userSelect: 'none',
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      <button
        type="button"
        data-tauri-drag-region="false"
        onClick={handleMinimize}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Minimize"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          background: 'transparent',
          border: 'none',
          color: 'var(--muted-foreground, #888)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
          e.currentTarget.style.color = '#fff'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--muted-foreground, #888)'
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="2" y1="6" x2="10" y2="6" strokeLinecap="round" />
        </svg>
      </button>

      <button
        type="button"
        data-tauri-drag-region="false"
        onClick={handleToggleMaximize}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          background: 'transparent',
          border: 'none',
          color: 'var(--muted-foreground, #888)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
          e.currentTarget.style.color = '#fff'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--muted-foreground, #888)'
        }}
      >
        {isMaximized ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="3.5" y="1.5" width="6.5" height="6.5" rx="1" />
            <path d="M1.5 4.5v5a1 1 0 0 0 1 1h5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="2" y="2" width="8" height="8" rx="1.5" />
          </svg>
        )}
      </button>

      <button
        type="button"
        data-tauri-drag-region="false"
        onClick={handleClose}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Close"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          background: 'transparent',
          border: 'none',
          color: 'var(--muted-foreground, #888)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.85)'
          e.currentTarget.style.color = '#fff'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--muted-foreground, #888)'
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" strokeLinecap="round" />
          <line x1="9.5" y1="2.5" x2="2.5" y2="9.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
