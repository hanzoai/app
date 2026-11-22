import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/tabs', () => ({ frameUrl: async () => '' }))
vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/ui', () => ({ Button: 'button', Text: 'span', XStack: 'div', YStack: 'div' }))
vi.mock('./core', () => ({}))
vi.mock('./lib/api', () => ({ api: () => 'https://api.test' }))
let session = true
vi.mock('./lib/session', () => ({ bearer: () => 't', org: () => 'hanzo', hasSession: () => session }))
vi.mock('./lib/host', () => ({ app: (p: string) => `/dev/${p}`, talk: (id?: string) => `/chat/${id ?? ''}` }))

import { DevInterior, DevList, environmentsOf, guestChat, Scope } from './DevPane'

const host = { go: () => {}, path: '/dev' } as never
const mac = (id: string) => ({ kind: 'machine', id, label: id, zap: `https://${id}.test`, token: async () => 't' }) as never
const dev = (runtime: unknown) => ({ runtime, environments: [], environment: 'cloud', choose: () => {}, handoff: () => {}, fail: () => {} }) as never
const draw = (value: unknown, el = createElement(DevInterior, { host, path: '/dev' })) =>
  renderToStaticMarkup(createElement(Scope.Provider, { value: value as never }, el))

describe('Dev and Chat interior', () => {
  test('nothing is drawn before the scope is there', () => {
    expect(draw(undefined)).toBe('')
  })
  test('the thread list nests under Dev only once a Mac is in use; before that the shell lists its own', () => {
    expect(draw(dev(null), createElement(DevList, { host, path: '/dev' }))).toBe('')
  })
})

describe('guestChat', () => {
  test('a guest at Chat gets the Chat surface, not the Dev core: the core sends a turn on the account, and a guest has none', () => {
    session = false
    expect(guestChat('chat')).toBe(true)
  })
  test('a signed-in reader keeps the Dev core at Chat', () => {
    session = true
    expect(guestChat('chat')).toBe(false)
  })
  test('Dev keeps the core for everyone, guest or not', () => {
    session = false
    expect(guestChat('dev')).toBe(false)
    session = true
    expect(guestChat('dev')).toBe(false)
  })
})

describe('environments', () => {
  const t = (s: string) => s
  test('Cloud is first and says it is not available yet; each linked Mac follows, available', () => {
    const list = environmentsOf(t, [mac('mac1'), mac('mac2')], new Set())
    expect(list.map((e) => e.id)).toEqual(['cloud', 'mac1', 'mac2'])
    expect(list[0]).toMatchObject({ kind: 'cloud', available: false, note: 'Not available yet' })
    expect(list[1]).toMatchObject({ kind: 'machine', available: true })
  })
  test('a Mac that would not pair is not offered again', () => {
    expect(environmentsOf(t, [mac('mac1'), mac('mac2')], new Set(['mac1'])).map((e) => e.id)).toEqual(['cloud', 'mac2'])
  })
  test('no linked Mac leaves Cloud alone, so the composer is still there', () => {
    expect(environmentsOf(t, [], new Set()).map((e) => e.id)).toEqual(['cloud'])
  })
})
