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
// sign-in to hanzo.app, which comes back to hanzo.ai's page with its own; hanzo.ai holding that request, and
// hanzo.app itself, sign in where they are.
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
})
