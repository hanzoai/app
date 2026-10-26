import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { answered, awaitAnswer, heard, RETURN, RETURNED } from './oauth'

const ORIGIN = 'https://hanzo.ai'

/** The opener: a window that hears `message` and `storage`, on hanzo.ai. */
function opener() {
  const w = new EventTarget() as EventTarget & Record<string, unknown>
  w.location = { origin: ORIGIN }
  w.setInterval = setInterval
  w.clearInterval = clearInterval
  return w
}

/** The popup: away on another origin until `back` puts it on the return page. */
function popup() {
  const p = { closed: false, close: vi.fn(() => void (p.closed = true)), at: null as null | { origin: string; search: string } }
  Object.defineProperty(p, 'location', {
    get() {
      if (!p.at) throw new DOMException('cross-origin', 'SecurityError')
      return p.at
    },
  })
  return p as typeof p & Window
}

describe('the return page', () => {
  test('is the one hanzo.ai registers with the API, on its own origin', () => {
    expect(new URL(RETURN).origin).toBe(ORIGIN)
    expect(new URL(RETURN).searchParams.get('at')).toBe('-/settings/integrations')
  })

  test('reads what the callback put on its query', () => {
    expect(answered('?at=-/settings/integrations&connected=github&account=acme')).toEqual({ type: RETURNED, provider: 'github', ok: true, account: 'acme' })
    expect(answered('?at=-/settings/integrations&error=github&reason=invalid+state')).toEqual({ type: RETURNED, provider: 'github', ok: false, reason: 'invalid state' })
    expect(answered('?at=-/settings/integrations')).toBeNull()
    expect(answered('?error=access_denied')).toBeNull()
  })

  test('hears only an answer for the provider it waits on', () => {
    expect(heard({ type: RETURNED, provider: 'github', ok: true, account: 'acme' }, 'github')).toMatchObject({ ok: true, account: 'acme' })
    expect(heard({ type: RETURNED, provider: 'slack', ok: true }, 'github')).toBeNull()
    expect(heard({ type: 'other', provider: 'github', ok: true }, 'github')).toBeNull()
    expect(heard('connected', 'github')).toBeNull()
  })
})

describe('waiting on the popup', () => {
  let w: ReturnType<typeof opener>
  beforeEach(() => {
    vi.useFakeTimers()
    w = opener()
    vi.stubGlobal('window', w)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  test('a message from this origin answers, and the opener closes the popup', () => {
    const p = popup()
    const done = vi.fn()
    awaitAnswer(p, 'github', done)
    w.dispatchEvent(Object.assign(new Event('message'), { origin: ORIGIN, data: { type: RETURNED, provider: 'github', ok: true, account: 'acme' } }))
    expect(done).toHaveBeenCalledExactlyOnceWith({ type: RETURNED, provider: 'github', ok: true, account: 'acme' })
    expect(p.close).toHaveBeenCalled()
  })

  test('a message from another origin is not an answer', () => {
    const done = vi.fn()
    const stop = awaitAnswer(popup(), 'github', done)
    w.dispatchEvent(Object.assign(new Event('message'), { origin: 'https://evil.example', data: { type: RETURNED, provider: 'github', ok: true } }))
    expect(done).not.toHaveBeenCalled()
    stop()
  })

  test('a storage write answers an opener the popup lost', () => {
    const done = vi.fn()
    awaitAnswer(popup(), 'github', done)
    w.dispatchEvent(Object.assign(new Event('storage'), { key: RETURNED, newValue: JSON.stringify({ type: RETURNED, provider: 'github', ok: false, reason: 'denied' }) }))
    expect(done).toHaveBeenCalledExactlyOnceWith({ type: RETURNED, provider: 'github', ok: false, reason: 'denied' })
  })

  test('the popup back on this origin is read and closed by the opener', () => {
    const p = popup()
    const done = vi.fn()
    awaitAnswer(p, 'github', done)
    vi.advanceTimersByTime(300)
    expect(done).not.toHaveBeenCalled()
    p.at = { origin: ORIGIN, search: '?at=-/settings/integrations&connected=github&account=acme' }
    vi.advanceTimersByTime(300)
    expect(done).toHaveBeenCalledExactlyOnceWith({ type: RETURNED, provider: 'github', ok: true, account: 'acme' })
    expect(p.close).toHaveBeenCalled()
  })

  test('a popup closed with no answer still ends the wait, once', () => {
    const p = popup()
    const done = vi.fn()
    awaitAnswer(p, 'github', done)
    p.closed = true
    vi.advanceTimersByTime(1000)
    expect(done).toHaveBeenCalledExactlyOnceWith(null)
  })
})
