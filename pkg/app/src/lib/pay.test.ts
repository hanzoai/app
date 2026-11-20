import { afterEach, describe, expect, test, vi } from 'vitest'
import { money, topUpAmountUrl, topUpUrl } from './pay'

describe('money', () => {
  test('English stays $20, and another locale writes its own', () => {
    expect(money(20)).toBe('$20')
    expect(money(16.67)).toBe('$16.67')
    expect(money(20, 'de-DE')).not.toBe('$20')
    expect(money(20, 'de-DE')).toContain('20')
  })
})

describe('the top-up', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('is pay’s plain top-up, coming back to this page with the model it was for', () => {
    vi.stubGlobal('window', { location: { href: 'https://hanzo.app/chat/abc?x=1', hostname: 'hanzo.app', assign: () => {} }, localStorage: { getItem: () => null } })
    const to = new URL(topUpUrl('anthropic/claude-sonnet-4.5'))
    expect(to.origin + to.pathname).toBe('https://hanzo.ai/pay/amount/card')
    const back = new URL(to.searchParams.get('returnUrl')!)
    expect(back.origin + back.pathname).toBe('https://hanzo.app/chat/abc')
    expect(back.searchParams.get('model')).toBe('anthropic/claude-sonnet-4.5')
    expect(back.searchParams.get('x')).toBe('1')
  })

  test('returns to the page as it is when no model was chosen', () => {
    vi.stubGlobal('window', { location: { href: 'https://hanzo.ai/dev', hostname: 'hanzo.ai', assign: () => {} }, localStorage: { getItem: () => null } })
    expect(new URL(new URL(topUpUrl()).searchParams.get('returnUrl')!).search).toBe('')
  })
})

describe('a fixed top-up', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('opens pay’s confirm page for the card with the amount, as Billing does', () => {
    vi.stubGlobal('window', { location: { href: 'https://hanzo.app/', hostname: 'hanzo.app', assign: () => {} }, localStorage: { getItem: () => null } })
    const to = new URL(topUpAmountUrl(25, 'https://hanzo.app/chat'))
    expect(to.origin + to.pathname).toBe('https://hanzo.ai/pay/confirm/card')
    expect(to.searchParams.get('amount')).toBe('25.00')
    expect(to.searchParams.get('returnUrl')).toBe('https://hanzo.app/chat')
  })
})
