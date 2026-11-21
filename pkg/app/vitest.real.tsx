// A real-kit test's frame: the app's own gui config (hanzo.ai's monochrome), mounted for real.
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { GuiProvider } from '@hanzo/gui'
import { monochrome } from '@hanzo/ui/gui-config'

export interface Mounted {
  box: HTMLElement
  draw(node: ReactNode): Promise<void>
  done(): Promise<void>
}

/** A frame mounted in the document, and the kit's animations given time to settle. */
export async function mount(): Promise<Mounted> {
  const box = document.createElement('div')
  document.body.append(box)
  const root: Root = createRoot(box)
  return {
    box,
    draw: (node) =>
      act(async () => {
        root.render(createElement(GuiProvider as never, { config: monochrome, defaultTheme: 'dark' } as never, node))
        await new Promise((r) => setTimeout(r, 120))
      }),
    done: () =>
      act(async () => {
        root.unmount()
        box.remove()
      }),
  }
}

/**
 * Presses `key` where focus is, as a keyboard does, and lets the kit answer. Enter or Space on a
 * focused button also activates it, as a browser does (happy-dom has no default activation).
 */
export const press = (key: string) =>
  act(async () => {
    const at = (document.activeElement ?? document.body) as HTMLElement
    const pressed = at.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    if (pressed && (key === 'Enter' || key === ' ') && at.tagName === 'BUTTON') at.click()
    await new Promise((r) => setTimeout(r, 120))
  })

/** Clicks an element as a pointer does (gui's press handlers listen for the pointer, then the click). */
export const tap = (el: Element) =>
  act(async () => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    ;(el as HTMLElement).click()
    await new Promise((r) => setTimeout(r, 120))
  })
