// @vitest-environment happy-dom
// Turning credits on is a request: while it runs the button says so and takes no second press.
import { act, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/ui', () => {
  // A part that renders as an element (`render`) takes that element's own attributes, as gui does.
  const part = ({ children, 'data-slot': slot, onClick, render }: { children?: ReactNode; 'data-slot'?: string; onClick?: () => void; render?: { type: string; props: Record<string, unknown> } }) =>
    createElement(render?.type ?? 'div', { ...(render?.props ?? {}), 'data-slot': slot, onClick }, children)
  return { Box: part, Dialog: ({ children }: { children?: ReactNode }) => createElement('div', null, children), DialogContent: part, DialogTitle: part, Text: part, XStack: part, YStack: part }
})

import { NeedMoreUsageModal } from './NeedMoreUsage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('Buy usage credits', () => {
  test('while the request runs it reads Turning on credits… and a press does nothing; after, it buys again', async () => {
    const buy = vi.fn()
    const at = document.createElement('div')
    const root = createRoot(at)
    const draw = (busy: boolean) => act(() => root.render(createElement(NeedMoreUsageModal, { open: true, onClose: () => {}, onBuyCredits: buy, onSetupTeam: () => {}, busy })))
    await draw(true)
    const button = () => at.querySelector('[data-slot="buy-usage-credits"]') as HTMLButtonElement
    expect(button().textContent).toBe('Turning on credits…')
    expect(button().disabled).toBe(true)
    act(() => button().click())
    expect(buy).not.toHaveBeenCalled()
    await draw(false)
    expect(button().textContent).toBe('Buy usage credits')
    act(() => button().click())
    expect(buy).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
  })
})
