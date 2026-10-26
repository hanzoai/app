import { beforeEach, describe, expect, test, vi } from 'vitest'

const { auth } = vi.hoisted(() => ({ auth: { value: {} as Record<string, string> } }))
vi.mock('./lib/session', () => ({ scope: () => auth.value }))
vi.mock('./lib/api', () => ({ api: () => 'https://api.test' }))

const { send } = await import('./pref')

const calls: { url: string; init?: RequestInit }[] = []
beforeEach(() => {
  calls.length = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify({ prefs: { 'hanzo.onboarding.later': true } }), { status: 200 })
  }))
})

describe('the account holds what usePref keeps', () => {
  test('signed in, a write is one PATCH of the one key to /v1/pref', () => {
    auth.value = { Authorization: 'Bearer t1' }
    send({ 'hanzo.onboarding.later': true })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.test/v1/pref')
    expect(calls[0].init?.method).toBe('PATCH')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ 'hanzo.onboarding.later': true })
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer t1')
  })

  test('signed out, nothing leaves the browser', () => {
    auth.value = {}
    send({ 'hanzo.onboarding.later': true })
    expect(calls).toHaveLength(0)
  })
})
