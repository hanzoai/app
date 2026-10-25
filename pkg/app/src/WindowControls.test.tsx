import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { dragWindow, toggleWindowMaximize, WindowControls } from './WindowControls'

describe('WindowControls', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete (globalThis as any).window
    delete (globalThis as any).document
  })

  test('renders null in non-desktop environment', () => {
    const markup = renderToStaticMarkup(<WindowControls />)
    expect(markup).toBe('')
  })

  test('dragWindow calls start_dragging in desktop environment', () => {
    const invoke = vi.fn().mockResolvedValue(undefined)
    const windowObj = {
      __TAURI_INTERNALS__: { invoke },
    }
    ;(globalThis as any).window = windowObj

    const fakeTarget = {
      closest: vi.fn().mockReturnValue(null),
    }

    const fakeEvent = {
      button: 0,
      target: fakeTarget,
    } as unknown as React.MouseEvent

    dragWindow(fakeEvent)
    expect(invoke).toHaveBeenCalledWith('plugin:window|start_dragging', { label: 'main' })
  })

  test('dragWindow ignores right-clicks or button children', () => {
    const invoke = vi.fn().mockResolvedValue(undefined)
    const windowObj = {
      __TAURI_INTERNALS__: { invoke },
    }
    ;(globalThis as any).window = windowObj

    // Right-click
    dragWindow({ button: 2, target: { closest: () => null } } as unknown as React.MouseEvent)
    expect(invoke).not.toHaveBeenCalled()

    // Button target
    const btnTarget = { closest: (sel: string) => sel.includes('button') ? {} : null }
    dragWindow({ button: 0, target: btnTarget } as unknown as React.MouseEvent)
    expect(invoke).not.toHaveBeenCalled()
  })

  test('toggleWindowMaximize calls toggle_maximize in desktop environment', () => {
    const invoke = vi.fn().mockResolvedValue(undefined)
    const windowObj = {
      __TAURI_INTERNALS__: { invoke },
    }
    ;(globalThis as any).window = windowObj

    const fakeTarget = {
      closest: vi.fn().mockReturnValue(null),
    }

    const fakeEvent = {
      target: fakeTarget,
    } as unknown as React.MouseEvent

    toggleWindowMaximize(fakeEvent)
    expect(invoke).toHaveBeenCalledWith('plugin:window|toggle_maximize', { label: 'main' })
  })
})
