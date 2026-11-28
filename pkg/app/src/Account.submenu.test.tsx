// @vitest-environment happy-dom
import { act, createElement, Fragment, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { settings, remembered, subPlacements, subOnOpenChange, Draw, through } = vi.hoisted(() => {
  const settings = vi.fn()
  const remembered = vi.fn()
  const subPlacements = new Map<string, { placement?: string; offset?: number; allowFlip?: unknown }>()
  const subOnOpenChange = new Map<string, (open: boolean) => void>()

  const Draw = ({
    children,
    'data-slot': slot,
    onMouseEnter,
    onMouseLeave,
    onPointerEnter,
    onPointerLeave,
    onClick,
    onPress,
    onKeyDown,
    placement,
    offset,
    allowFlip,
    open,
    onOpenChange,
    onSelect,
  }: {
    children?: ReactNode
    'data-slot'?: string
    onMouseEnter?: () => void
    onMouseLeave?: () => void
    onPointerEnter?: (e?: unknown) => void
    onPointerLeave?: (e?: unknown) => void
    onClick?: (e?: unknown) => void
    onPress?: (e?: unknown) => void
    onKeyDown?: (e?: unknown) => void
    placement?: string
    offset?: number
    allowFlip?: unknown
    open?: boolean
    onOpenChange?: (next: boolean) => void
    onSelect?: () => void
  }) => {
    if (placement && onOpenChange) {
      const first = Array.isArray(children) ? children[0] : children
      const key = (first as { props?: { 'data-slot'?: string } } | null)?.props?.['data-slot'] ?? 'sub'
      subPlacements.set(key, { placement, offset, allowFlip })
      subOnOpenChange.set(key, onOpenChange)
    }
    return createElement(
      'div',
      {
        'data-slot': slot,
        'data-open': open === undefined ? undefined : String(open),
        onMouseEnter,
        onMouseLeave,
        onPointerEnter,
        onPointerLeave,
        onClick: (e: unknown) => {
          onClick?.(e)
          onSelect?.()
        },
        onKeyDown,
        'data-has-press': onPress ? 'true' : undefined,
      },
      children,
    )
  }

  const through = ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children)

  return { settings, remembered, subPlacements, subOnOpenChange, Draw, through }
})

vi.mock('@hanzo/gui', () => ({ SizableText: Draw, XStack: Draw, YStack: Draw }))
vi.mock('@hanzo/ui', () => ({
  Button: () => null,
  Dialog: () => null,
  DialogContent: () => null,
  DialogTitle: () => null,
  DropdownMenu: Draw,
  DropdownMenuContent: Draw,
  DropdownMenuItem: Draw,
  DropdownMenuLabel: Draw,
  DropdownMenuSeparator: () => null,
  DropdownMenuShortcut: Draw,
  DropdownMenuSub: Draw,
  DropdownMenuSubContent: Draw,
  DropdownMenuSubTrigger: Draw,
  DropdownMenuTrigger: Draw,
  Box: Draw,
  HoverCard: Draw,
  HoverCardContent: Draw,
  HoverCardTrigger: Draw,
  Input: () => null,
  Kbd: Draw,
  Switch: Draw,
  Text: Draw,
  Tooltip: through,
  TooltipContent: Draw,
  TooltipProvider: through,
  TooltipTrigger: through,
  View: Draw,
}))
vi.mock('@hanzo/iam/react', () => ({ useOrganizations: () => ({ roles: { acme: 'owner' } }) }))
vi.mock('@hanzo/dev/builder', async () => {
  const { label, said } = await import('@hanzo/dev/plan')
  return {
    label,
    Meter: () => null,
    said,
    useStanding: () => ({
      value: { kind: 'plan', label: { name: 'Unlimited', tag: '' }, limits: null, allowance: null, balance: null },
      error: null,
      loading: false,
      reload: () => {},
    }),
  }
})
vi.mock('./lib/session', () => ({
  choose: () => {},
  org: () => 'acme',
  orgs: () => ['acme'],
  pick: () => {},
  renew: () => {},
  reopen: () => {},
  scope: () => ({}),
  superAdmin: () => false,
}))
vi.mock('./lib/org', () => ({ createOrg: async () => '', say: String }))
vi.mock('./lib/spend', () => ({ trusts: () => false, forget: vi.fn() }))
vi.mock('./dev', () => ({ leave: vi.fn() }))
vi.mock('./lib/dev-mode', () => ({ rememberSettingsReturn: remembered, useDevMode: () => [false, () => {}] }))
vi.mock('./open', () => ({ showSettings: settings }))
vi.mock('./lib/signout', () => ({ useSigningOut: () => false }))
vi.mock('./lib/accounts', () => ({
  label: (a: { displayName: string; name: string; email: string }) => ({ title: a.displayName || a.name, line: a.email }),
  useAccounts: () => ({ accounts: [], current: null, switchTo: vi.fn(), add: vi.fn(), leave: vi.fn() }),
}))

import { Account, SUBMENU_CLOSE_GRACE_MS, submenuPlacement } from './Account'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

function mountAccount() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const host = {
    api: '',
    token: () => null,
    org: 'acme',
    person: { name: 'Melissa McPhun', email: 'melissa@hanzo.ai', avatar: '' },
    signOut: vi.fn(),
  }
  act(() => {
    root!.render(createElement(Account, { host, onOrg: () => {} }))
  })
  return container
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })))
  settings.mockClear()
  remembered.mockClear()
  subPlacements.clear()
  subOnOpenChange.clear()
})

afterEach(() => {
  act(() => {
    root?.unmount()
  })
  container?.remove()
  container = null
  root = null
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Account submenu positioning, hover-grace, hover-bridge, and click-to-toggle', () => {
  test('positions submenus to the inline-end side (right in LTR, left in RTL) with horizontal fallbacks before below', () => {
    const ltr = submenuPlacement(false)
    expect(ltr.placement).toBe('right-start')
    expect(ltr.offset).toBe(4)
    expect(ltr.allowFlip.fallbackPlacements).toEqual(['right-end', 'left-start', 'left-end', 'bottom-start'])

    const rtl = submenuPlacement(true)
    expect(rtl.placement).toBe('left-start')
    expect(rtl.offset).toBe(4)
    expect(rtl.allowFlip.fallbackPlacements).toEqual(['left-end', 'right-start', 'right-end', 'bottom-start'])
  })

  test('hovering trigger then moving pointer across seam/bridge to Personalization keeps submenu open and clickable', () => {
    const dom = mountAccount()
    const trigger = dom.querySelector('[data-slot="me-account"]')!
    expect(trigger).toBeTruthy()
    expect(dom.querySelector('[data-slot="me-account-submenu"]')).toBeNull()

    // Hover the Account trigger row -> submenu opens immediately beside parent menu.
    act(() => {
      trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    expect(dom.querySelector('[data-slot="me-account-submenu"]')).not.toBeNull()
    expect(dom.querySelector('[data-slot="me-account-bridge"]')).not.toBeNull()
    expect(subPlacements.get('me-account')?.placement).toBe('right-start')

    // Pointer leaves trigger toward Personalization (and parent menu may emit a transient onOpenChange(false)).
    act(() => {
      trigger.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
      subOnOpenChange.get('me-account')?.(false)
    })

    // Still open during the grace window (< SUBMENU_CLOSE_GRACE_MS).
    act(() => {
      vi.advanceTimersByTime(SUBMENU_CLOSE_GRACE_MS - 60)
    })
    expect(dom.querySelector('[data-slot="me-account-submenu"]')).not.toBeNull()

    // Pointer enters the invisible hover-bridge -> cancels close timer.
    const bridge = dom.querySelector('[data-slot="me-account-bridge"]')!
    act(() => {
      bridge.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })

    // Well past the grace timer, submenu stays open and Personalization is clickable.
    act(() => {
      vi.advanceTimersByTime(SUBMENU_CLOSE_GRACE_MS * 3)
    })
    const personalization = dom.querySelector('[data-slot="me-personalization"]')!
    expect(personalization).not.toBeNull()

    act(() => {
      personalization.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(settings).toHaveBeenCalledWith('personalization')
    expect(remembered).toHaveBeenCalledTimes(1)
  })

  test('leaving trigger without entering submenu closes it cleanly after the close grace timer', () => {
    const dom = mountAccount()
    const trigger = dom.querySelector('[data-slot="me-account"]')!

    act(() => {
      trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    expect(dom.querySelector('[data-slot="me-account-submenu"]')).not.toBeNull()

    act(() => {
      trigger.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
    })
    act(() => {
      vi.advanceTimersByTime(SUBMENU_CLOSE_GRACE_MS - 10)
    })
    expect(dom.querySelector('[data-slot="me-account-submenu"]')).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(20)
    })
    expect(dom.querySelector('[data-slot="me-account-submenu"]')).toBeNull()
  })

  test('clicking the account row pins the submenu open across mouse leaves and toggles closed on a second click', () => {
    const dom = mountAccount()
    const trigger = dom.querySelector('[data-slot="me-account"]')!

    // Click to open & pin.
    act(() => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(dom.querySelector('[data-slot="me-account-submenu"]')).not.toBeNull()

    // Mouse leave + elapsed time does NOT dismiss a click-pinned submenu.
    act(() => {
      trigger.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
      subOnOpenChange.get('me-account')?.(false)
      vi.advanceTimersByTime(SUBMENU_CLOSE_GRACE_MS * 3)
    })
    expect(dom.querySelector('[data-slot="me-account-submenu"]')).not.toBeNull()
    expect(dom.querySelector('[data-slot="me-personalization"]')).not.toBeNull()

    // Second click toggles it closed.
    act(() => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(dom.querySelector('[data-slot="me-account-submenu"]')).toBeNull()
  })

  test('hovering a sibling submenu immediately closes the account submenu', () => {
    const dom = mountAccount()
    const accountTrigger = dom.querySelector('[data-slot="me-account"]')!
    const orgsTrigger = dom.querySelector('[data-slot="me-orgs"]')!

    act(() => {
      accountTrigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    expect(dom.querySelector('[data-slot="me-account-submenu"]')).not.toBeNull()

    act(() => {
      orgsTrigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    })
    expect(dom.querySelector('[data-slot="me-account-submenu"]')).toBeNull()
    expect(dom.querySelector('[data-slot="me-orgs-submenu"]')).not.toBeNull()
  })
})
