import { describe, expect, test } from 'vitest'
import { brand, configure, site, where, wordmark } from './where'
import { safe, signUp } from './lib/destination'

describe('addresses', () => {
  test('a host states only what differs, and reads happen at call time', () => {
    expect(where()).toMatchObject({ site: '', home: '/home', signUp: '/signup' })
    configure({ site: 'https://hanzo.ai', home: '/', signUp: '/start' })
    expect(site('/pricing')).toBe('https://hanzo.ai/pricing')
    expect(signUp()).toBe('/start')
    configure({ api: 'https://api.hanzo.ai' })
    expect(where()).toMatchObject({ site: 'https://hanzo.ai', home: '/', api: 'https://api.hanzo.ai' })
  })
})

describe('brand', () => {
  test("the apps print the host's product name, Hanzo in chat and unprefixed section names elsewhere", () => {
    configure({ brand: undefined })
    expect(brand()).toBe('Hanzo')
    expect(wordmark('chat')).toBe('Hanzo')
    expect(wordmark('dev')).toBe('Dev')
    expect(wordmark('design')).toBe('Design')
    expect(wordmark('studio')).toBe('Studio')
    expect(wordmark('flow')).toBe('Flow')
    expect(wordmark('tabs')).toBe('Tabs')
    expect(wordmark('beta')).toBe('Betas')
    configure({ brand: 'Hanzo Team' })
    expect(brand()).toBe('Hanzo Team')
  })
})

describe('safe', () => {
  test('keeps a path on this origin', () => {
    expect(safe('/cal?at=1')).toBe('/cal?at=1')
    expect(safe('/start')).toBe('/start')
  })

  test('refuses an address that leaves the origin', () => {
    for (const away of ['//evil.example', '/\\evil.example', '/\t/evil.example', 'https://evil.example', 'cal'])
      expect(safe(away)).toBe('/')
  })

  test('refuses the pages that restart sign-in', () => {
    expect(safe('/login')).toBe('/')
    expect(safe('/login/', '/home')).toBe('/home')
  })
})
