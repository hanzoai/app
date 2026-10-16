import { afterEach, describe, expect, test } from 'vitest'
import { API_DEV, IAM_DEV, api, iam } from './api'
import { devnet } from './host'
import { configure, where } from '../where'

/** The world a page is open in, until `afterEach` takes it away. */
function at(hostname: string): void {
  ;(globalThis as { window?: unknown }).window = { location: { hostname, origin: `https://${hostname}` } }
}

const stated = { api: where().api, iam: where().iam }

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
  configure(stated)
})

describe('a devnet host is one label under hanzo.ai ending in -dev', () => {
  test('app-dev, api-dev and id-dev are the devnet', () => {
    for (const host of ['app-dev.hanzo.ai', 'api-dev.hanzo.ai', 'id-dev.hanzo.ai']) expect(devnet(host), host).toBe(true)
  })

  test('production hosts, deeper names and lookalikes are not', () => {
    for (const host of [
      'hanzo.ai',
      'www.hanzo.ai',
      'dev.hanzo.ai',
      'api.hanzo.ai',
      'a.b-dev.hanzo.ai',
      '-dev.hanzo.ai',
      'app-dev.hanzo.ai.evil.com',
      'app-dev.hanzo.ai.',
      'app-devhanzo.ai',
      'app-dev.hanzo.app',
    ])
      expect(devnet(host), host).toBe(false)
  })
})

describe('a page on a devnet host talks to the devnet only', () => {
  test('app-dev, api-dev and id-dev reach api-dev and id-dev', () => {
    for (const host of ['app-dev.hanzo.ai', 'api-dev.hanzo.ai', 'id-dev.hanzo.ai']) {
      at(host)
      expect(api(), host).toBe(API_DEV)
      expect(iam(), host).toBe(IAM_DEV)
    }
    expect(API_DEV).toBe('https://api-dev.hanzo.ai')
    expect(IAM_DEV).toBe('https://id-dev.hanzo.ai')
  })

  test('a production address the build stated does not reach a devnet page', () => {
    configure({ api: 'https://api.hanzo.ai', iam: 'https://hanzo.id' })
    at('app-dev.hanzo.ai')
    expect(api()).toBe(API_DEV)
    expect(iam()).toBe(IAM_DEV)
  })
})

describe('every other host answers as it did', () => {
  test('the apex, www and a deeper -dev name reach production', () => {
    configure({ api: undefined, iam: undefined })
    for (const host of ['hanzo.ai', 'www.hanzo.ai', 'a.b-dev.hanzo.ai']) {
      at(host)
      expect(api(), host).toBe('https://api.hanzo.ai')
      expect(iam(), host).toBe('https://hanzo.id')
    }
  })

  test('a lookalike keeps its own origin and production identity', () => {
    configure({ api: undefined, iam: undefined })
    at('app-dev.hanzo.ai.evil.com')
    expect(api()).toBe('https://app-dev.hanzo.ai.evil.com')
    expect(iam()).toBe('https://hanzo.id')
  })

  test('the prerender has no window and answers production', () => {
    configure({ api: undefined, iam: undefined })
    expect(api()).toBe('https://api.hanzo.ai')
    expect(iam()).toBe('https://hanzo.id')
  })
})
