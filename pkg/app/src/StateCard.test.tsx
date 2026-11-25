// @vitest-environment happy-dom
import { act, createElement, type ReactElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const { part } = vi.hoisted(() => {
  type PartProps = {
    children?: ReactNode
    render?: ReactElement | string
    role?: string
    onClick?: () => void
    'data-slot'?: string
    'data-state-kind'?: string
  }
  const part = ({ children, render, role, onClick, 'data-slot': slot, 'data-state-kind': kind }: PartProps) => {
    const tag = typeof render === 'string' ? render : onClick ? 'button' : 'div'
    return createElement(tag, { role, onClick, 'data-slot': slot, 'data-state-kind': kind }, children)
  }
  return { part }
})

vi.mock('@hanzo/ui', () => ({ Box: part, Text: part, YStack: part }))

const { StateCard } = await import('./StateCard')

describe('StateCard shared empty/error/access states', () => {
  let host: HTMLDivElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    host.remove()
  })

  test('renders empty and access variants with status role and optional CTA', () => {
    const emptyHtml = renderToStaticMarkup(
      createElement(StateCard, {
        kind: 'empty',
        title: 'Sandboxes',
        detail: 'Nothing is running.',
        dataSlot: 'boxes-state',
      }),
    )
    expect(emptyHtml).toContain('role="status"')
    expect(emptyHtml).toContain('data-state-kind="empty"')
    expect(emptyHtml).toContain('Nothing is running.')

    const accessHtml = renderToStaticMarkup(
      createElement(StateCard, {
        kind: 'access',
        title: 'Marketplace',
        detail: 'Sign in to browse agents.',
        actionLabel: 'Sign in',
        onAction: () => {},
        dataSlot: 'market-state',
      }),
    )
    expect(accessHtml).toContain('role="status"')
    expect(accessHtml).toContain('data-state-kind="access"')
    expect(accessHtml).toContain('Sign in')
  })

  test('renders error variant with alert role and invokes recovery onAction', () => {
    const onRetry = vi.fn()
    const root = createRoot(host)
    act(() => {
      root.render(
        createElement(StateCard, {
          kind: 'error',
          title: 'Marketplace',
          detail: 'Could not read marketplace.',
          actionLabel: 'Try again',
          onAction: onRetry,
          dataSlot: 'market-state',
        }),
      )
    })

    const container = host.querySelector('[data-slot="market-state"]')
    expect(container?.getAttribute('role')).toBe('alert')
    expect(container?.getAttribute('data-state-kind')).toBe('error')

    const btn = host.querySelector('[data-slot="market-state-action"]') as HTMLButtonElement
    expect(btn.textContent).toBe('Try again')
    act(() => {
      btn.click()
    })
    expect(onRetry).toHaveBeenCalledTimes(1)
    act(() => root.unmount())
  })
})
