import { afterEach, describe, expect, test, vi } from 'vitest'
import { entry, handoff } from './destination'

describe('entry', () => {
  test('a campaign rides to the sign-in page as its own parameters, and the page as next=', () => {
    const to = entry('/signup', '/chat?utm_source=hanzo&utm_medium=email&utm_campaign=again&utm_content=hero&gclid=G1&fbclid=F1&q=hi')
    const u = new URL(to, 'https://hanzo.ai')
    expect(u.pathname).toBe('/signup')
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      utm_source: 'hanzo', utm_medium: 'email', utm_campaign: 'again', utm_content: 'hero', gclid: 'G1', fbclid: 'F1',
    })
    expect(u.searchParams.get('next')).toBe('/chat?utm_source=hanzo&utm_medium=email&utm_campaign=again&utm_content=hero&gclid=G1&fbclid=F1&q=hi')
    expect(u.searchParams.has('q'), 'only the campaign is lifted').toBe(false)
  })

  test('a visit with no campaign is the page as next= alone, and the home page is no next', () => {
    expect(entry('/signup', '/chat/c/42')).toBe('/signup?next=%2Fchat%2Fc%2F42')
    expect(entry('/login', '/')).toBe('/login')
    expect(entry('/login', '/?utm_source=x')).toBe('/login?next=%2F%3Futm_source%3Dx&utm_source=x')
  })

  test('a page that restarts sign-in is never next=, and its campaign still rides', () => {
    expect(entry('/signup', '/login?utm_campaign=again')).toBe('/signup?utm_campaign=again')
  })

  test('the sign-in page keeps a parameter it already names', () => {
    expect(entry('/signup?utm_source=site', '/chat?utm_source=email')).toBe('/signup?utm_source=site&next=%2Fchat%3Futm_source%3Demail')
  })
})

// HANZO SIGNS IN ON HANZO.AI, AND THE APP STARTS IT. A guest, and hanzo.ai opened with no app's request, send the
// sign-in to hanzo.app, which comes back to hanzo.ai's page with its own; hanzo.ai holding that request, hanzo.ai
// signing in for its own checkout, and hanzo.app itself, sign in where they are.
describe('handoff', () => {
  afterEach(() => vi.unstubAllGlobals())
  const at = (hostname: string) => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { hostname, assign } })
    return assign
  }

  test('a guest and a bare hanzo.ai send the sign-in to hanzo.app', () => {
    for (const host of ['acme.hanzo.app', 'hanzo.chat', 'hanzo.ai', 'www.hanzo.ai']) {
      const assign = at(host)
      expect(handoff('/login?next=%2Fchat'), host).toBe(true)
      expect(assign, host).toHaveBeenCalledWith('https://hanzo.app/login?next=%2Fchat')
    }
  })

  test("hanzo.ai holding an app's request, and hanzo.app, sign in where they are", () => {
    const request = '/login?client_id=hanzo-app&redirect_uri=https%3A%2F%2Fhanzo.app%2Fauth%2Fcallback&response_type=code'
    for (const [host, address] of [['hanzo.ai', request], ['hanzo.app', '/login'], ['cloud.hanzo.ai', '/login']]) {
      const assign = at(host)
      expect(handoff(address), host).toBe(false)
      expect(assign, host).not.toHaveBeenCalled()
    }
  })

  // THE CHECKOUT IS hanzo.ai's, SO IS ITS SIGN-IN. pay at hanzo.ai/pay reads hanzo.ai's session, and hanzo.app sends
  // /pay back to hanzo.ai/pay. Handed to hanzo.app, "Add funds" went hanzo.ai/pay → hanzo.ai/login → hanzo.app/login →
  // hanzo.app/pay → hanzo.ai/pay, without end (2026-11-13).
  test("a sign-in on its way to hanzo.ai's checkout stays on hanzo.ai", () => {
    // Exactly as pay leaves (hanzo-inc/pay lib/auth `login`: `${VITE_SIGNIN}?next=${encodeURIComponent(here)}`).
    const deposit = `/login?next=${encodeURIComponent('/pay/amount/card?org=acme&returnUrl=https%3A%2F%2Fhanzo.app%2F')}`
    const addresses = [
      deposit,
      '/login?next=%2Fpay',
      '/signup?next=%2Fpay%2Fconfirm%2Fcard%3Fplan%3Ddev',
      '/login?redirect=%2Fpay%2Ftransactions',
    ]
    for (const host of ['hanzo.ai', 'www.hanzo.ai']) {
      for (const address of addresses) {
        const assign = at(host)
        expect(handoff(address), `${host}${address}`).toBe(false)
        expect(assign, `${host}${address}`).not.toHaveBeenCalled()
      }
    }
  })

  test('only the checkout stays: a lookalike path, or an address off this site, still goes to hanzo.app', () => {
    for (const address of [
      '/login?next=%2Fpayments',
      '/login?next=%2Fpayouts%2Fpay',
      '/login?next=%2F%2Fevil.example%2Fpay',
      '/login?next=https%3A%2F%2Fevil.example%2Fpay',
    ]) {
      const assign = at('hanzo.ai')
      expect(handoff(address), address).toBe(true)
      expect(assign, address).toHaveBeenCalledWith(`https://hanzo.app${address}`)
    }
  })
})
