// @vitest-environment happy-dom
import { act, createElement, Fragment, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ExtendedLimits } from './lib/limits'

const { mockState, toastSpy, resetSpy, reloadSpy } = vi.hoisted(() => ({
  mockState: {
    signedIn: true,
    orgId: 'acme',
    limits: null as ExtendedLimits | null,
    tier: null as { plan?: string; tier?: { displayName?: string }; balance?: { effectiveAvailable: number; currency?: string } } | null,
  },
  toastSpy: { success: vi.fn(), error: vi.fn() },
  resetSpy: vi.fn(async () => ({ ok: true })),
  reloadSpy: vi.fn(),
}))

vi.mock('@hanzo/i18n/react', () => ({
  useI18n: () => ({
    t: (s: string, vars?: Record<string, unknown>) => (vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : s),
    format: {
      number: (n: number) => String(n),
      date: () => '5:00 PM',
    },
  }),
}))

vi.mock('@hanzo/ui', () => {
  type Props = Record<string, unknown> & { children?: ReactNode }
  const part = ({ children, 'data-slot': slot, 'aria-label': aria, onClick, onPress, disabled, role }: Props) =>
    createElement('div', { 'data-slot': slot, 'aria-label': aria, onClick: onClick ?? onPress, 'data-disabled': disabled ? 'true' : undefined, role }, children)
  const through = ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children)
  return {
    Anchor: part,
    Box: part,
    Popover: through,
    PopoverContent: part,
    PopoverTrigger: through,
    Progress: ({ value, indicatorColor, 'aria-label': aria }: Props) =>
      createElement('div', { 'data-slot': 'progress', 'data-value': String(value), 'data-color': String(indicatorColor), 'aria-label': aria }),
    ProgressRing: ({ value, barColor, 'aria-label': aria }: Props) =>
      createElement('div', { 'data-slot': 'progress-ring', 'data-value': String(value), 'data-color': String(barColor), 'aria-label': aria }),
    Text: part,
    XStack: part,
    YStack: part,
    toast: toastSpy,
  }
})
vi.mock('@hanzo/ui/chat', () => ({
  ComposerStatusProvider: ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children),
}))
vi.mock('@hanzo/dev/plan', () => ({
  label: (id: string) => ({ name: id[0]!.toUpperCase() + id.slice(1), tag: '' }),
}))
vi.mock('./open', () => ({ showSettings: vi.fn() }))
vi.mock('./lib/session', () => ({
  hasSession: () => mockState.signedIn,
  org: () => mockState.orgId,
  subject: () => 'user_1',
}))
vi.mock('./lib/org', () => ({
  cents: (amount: number) => `$${(amount / 100).toFixed(2)}`,
}))
vi.mock('./lib/pay', () => ({ payPage: (p: string) => p }))
vi.mock('./lib/limits', () => ({
  resets: () => ({ date: '', time: '5:00 PM' }),
  resetUsageLimits: () => resetSpy(),
  useLimits: () => ({ limits: mockState.limits, answered: true, reload: reloadSpy }),
}))
vi.mock('./lib/tier', () => ({
  useTier: () => ({ tier: mockState.tier }),
}))
vi.mock('./lib/dev-mode', () => ({
  rememberSettingsReturn: vi.fn(),
  useDevMode: () => [false, vi.fn()],
}))
vi.mock('./lib/tokens', () => ({
  contextOf: () => null,
  readTokens: () => null,
  subscribeTokens: () => () => {},
  tokenKey: () => '',
}))

import { RailUsageButton, summarizeUsage, UsageControl } from './Usage'

let root: Root
let host: HTMLElement

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mockState.signedIn = true
  mockState.orgId = 'acme'
  mockState.limits = null
  mockState.tier = null
  toastSpy.success.mockClear()
  toastSpy.error.mockClear()
  resetSpy.mockClear()
  reloadSpy.mockClear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('summarizeUsage', () => {
  test('never flags exhaustion when classes.ours is unbounded even if premium is 100% credit-paid (live $1.16M enterprise bug)', () => {
    const limits: ExtendedLimits = {
      plan: 'enterprise',
      state: 'ok',
      creditsAfterAllowance: true,
      limited: null,
      actions: [],
      classes: {
        ours: { percent: 0, state: 'ok', resets_at: null, paying: 'plan', unbounded: true },
        premium: { percent: 100, state: 'limited', resets_at: null, paying: 'credits' },
      },
      session: { percent: 0, state: 'ok', resets_at: null },
      reset: { available: true, used: 0, limit: 1 },
    }
    const s = summarizeUsage(limits, 116_000_000, null)
    expect(s.oursUnbounded).toBe(true)
    expect(s.isCapped).toBe(false)
    expect(s.isNear).toBe(false)
    expect(s.weeklyPercent).toBe(0)
    expect(s.sessionPercent).toBe(0)
    expect(s.canFreeReset).toBe(false)
  })

  test('ignores credit-paid premium class at 100% when user has positive prepaid credits and bounded ours is healthy', () => {
    const limits: ExtendedLimits = {
      plan: 'pro',
      state: 'ok',
      creditsAfterAllowance: true,
      limited: null,
      actions: [],
      classes: {
        ours: { percent: 40, state: 'ok', resets_at: '2026-10-14T00:00:00Z', paying: 'plan', window: { percent: 35, state: 'ok', resets_at: '2026-10-14T00:00:00Z' } },
        premium: { percent: 100, state: 'limited', resets_at: null, paying: 'credits' },
      },
      session: { percent: 25, state: 'ok', resets_at: '2026-10-07T17:00:00Z' },
      reset: { available: true, used: 0, limit: 1 },
    }
    const s = summarizeUsage(limits, 5000, null)
    expect(s.isCapped).toBe(false)
    expect(s.isNear).toBe(false)
    expect(s.sessionPercent).toBe(25)
    expect(s.weeklyPercent).toBe(35)
    expect(s.canFreeReset).toBe(true)
  })

  test('flags isCapped when bounded plan-paid Hanzo class (ours) reaches 100% / limited', () => {
    const limits: ExtendedLimits = {
      plan: 'pro',
      state: 'limited',
      creditsAfterAllowance: false,
      limited: null,
      actions: [],
      classes: {
        ours: { percent: 100, state: 'limited', resets_at: '2026-10-14T00:00:00Z', paying: 'plan' },
      },
      session: { percent: 100, state: 'limited', resets_at: '2026-10-07T17:00:00Z' },
      reset: { available: true, used: 0, limit: 1 },
    }
    const s = summarizeUsage(limits, 0, null)
    expect(s.isCapped).toBe(true)
    expect(s.sessionCapped).toBe(true)
    expect(s.weeklyCapped).toBe(true)
    expect(s.canFreeReset).toBe(true)
  })

  test('falls back to highest bounded window when top-level session is omitted', () => {
    const limits: ExtendedLimits = {
      plan: 'max-5x',
      state: 'near',
      creditsAfterAllowance: false,
      limited: null,
      actions: [],
      classes: {
        ours: { percent: 60, state: 'ok', resets_at: null, paying: 'plan', window: { percent: 88, state: 'near', resets_at: '2026-10-07T17:00:00Z' } },
      },
      reset: { available: false, used: 1, limit: 1 },
    }
    const s = summarizeUsage(limits, 0, null)
    expect(s.sessionPercent).toBe(88)
    expect(s.weeklyPercent).toBe(88)
    expect(s.isNear).toBe(true)
    expect(s.isCapped).toBe(false)
    expect(s.canFreeReset).toBe(false)
  })
})

describe('RailUsageButton & UsageControl', () => {
  test('RailUsageButton renders nothing for unbounded enterprise plan with 100% credit-paid premium and $1.16M balance', () => {
    mockState.limits = {
      plan: 'enterprise',
      state: 'ok',
      creditsAfterAllowance: true,
      limited: null,
      actions: [],
      classes: {
        ours: { percent: 0, state: 'ok', resets_at: null, paying: 'plan', unbounded: true },
        premium: { percent: 100, state: 'limited', resets_at: null, paying: 'credits' },
      },
    }
    mockState.tier = { plan: 'enterprise', balance: { effectiveAvailable: 116_000_000, currency: 'usd' } }
    act(() => root.render(createElement(RailUsageButton)))
    expect(host.innerHTML).toBe('')
    expect(host.textContent).not.toContain('out of Hanzo usage')
  })

  test('RailUsageButton renders capped alert and working 1×/wk free reset button when bounded Hanzo usage is exhausted', async () => {
    mockState.limits = {
      plan: 'pro',
      state: 'limited',
      creditsAfterAllowance: false,
      limited: null,
      actions: [],
      classes: {
        ours: { percent: 100, state: 'limited', resets_at: '2026-10-14T00:00:00Z', paying: 'plan' },
      },
      session: { percent: 100, state: 'limited', resets_at: '2026-10-07T17:00:00Z' },
      reset: { available: true, used: 0, limit: 1 },
    }
    mockState.tier = { plan: 'pro', balance: { effectiveAvailable: 0, currency: 'usd' } }
    act(() => root.render(createElement(RailUsageButton)))
    expect(host.textContent).toContain('You’re out of Hanzo usage')
    const resetBtn = host.querySelector<HTMLElement>('[data-slot="rail-usage-free-reset"]')!
    expect(resetBtn).not.toBeNull()
    expect(resetBtn.textContent).toContain('Reset usage (1×/wk free)')

    await act(async () => {
      resetBtn.click()
    })
    expect(resetSpy).toHaveBeenCalledTimes(1)
    expect(reloadSpy).toHaveBeenCalled()
    expect(toastSpy.success).toHaveBeenCalledWith('Usage reset for this week')
  })

  test('UsageControl reads 5-hour session and weekly limits cleanly and triggers 1×/wk free reset', async () => {
    mockState.limits = {
      plan: 'pro',
      state: 'ok',
      creditsAfterAllowance: true,
      limited: null,
      actions: [],
      classes: {
        ours: { percent: 45, state: 'ok', resets_at: '2026-10-14T00:00:00Z', paying: 'plan' },
        premium: { percent: 100, state: 'limited', resets_at: null, paying: 'credits' },
      },
      session: { percent: 30, state: 'ok', resets_at: '2026-10-07T17:00:00Z' },
      reset: { available: true, used: 0, limit: 1 },
    }
    mockState.tier = { plan: 'pro', balance: { effectiveAvailable: 2500, currency: 'usd' } }
    act(() => root.render(createElement(UsageControl)))
    expect(host.querySelector('[data-slot="composer-current-window"]')?.textContent).toContain('30%')
    expect(host.querySelector('[data-slot="composer-plan-usage"]')?.textContent).toContain('45%')
    expect(host.querySelector('[data-slot="composer-credit-safety-net"]')).toBeNull()

    const resetBtn = host.querySelector<HTMLElement>('[data-slot="composer-usage-free-reset"]')!
    expect(resetBtn).not.toBeNull()
    await act(async () => {
      resetBtn.click()
    })
    expect(resetSpy).toHaveBeenCalledTimes(1)
    expect(reloadSpy).toHaveBeenCalled()
    expect(toastSpy.success).toHaveBeenCalledWith('Usage reset for this week')
  })
})
