import { afterEach, describe, expect, test, vi } from 'vitest'
import { money, topUpUrl } from './pay'

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
    expect(to.origin + to.pathname).toBe('https://hanzo.app/pay/amount/card')
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
