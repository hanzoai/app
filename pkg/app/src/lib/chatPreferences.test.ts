import { EFFORTS as DEV } from '@hanzo/build/mind'
import { EFFORTS } from '@hanzo/ui/chat/pure'
import { describe, expect, test, vi } from 'vitest'

import { DEFAULT_EFFORT, getChatPreferences, setChatPreferences, shared } from './chatPreferences'

describe('what Chat does', () => {
  test('offers the composer’s efforts, auto by default', () => {
    expect(DEFAULT_EFFORT).toBe('auto')
    expect(EFFORTS.map((s) => s.id)).toEqual(['auto', 'instant', 'low', 'medium', 'high', 'max'])
    for (const step of EFFORTS) {
      expect(step.label.length).toBeGreaterThan(0)
      expect(step.note.length).toBeGreaterThan(0)
    }
  })

  test('hands Dev every effort it offers, Auto, High and Max, in Chat’s order and words', () => {
    const dev = DEV.map((e) => e.id)
    expect(dev).toEqual(['auto', 'high', 'max'])
    expect(EFFORTS.filter((s) => dev.includes(s.id as never)).map((s) => [s.id, s.label, s.note])).toEqual(DEV.map((e) => [e.id, e.label, e.note]))
    expect(EFFORTS.map((s) => shared(s.id))).toEqual(['auto', null, null, null, 'high', 'max'])
  })

  test('resets an effort kept under an older default to auto, and persists a chosen effort', () => {
    const map = new Map<string, string>()
    const targets = new EventTarget()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => map.set(k, v),
      },
      dispatchEvent: (e: Event) => targets.dispatchEvent(e),
      addEventListener: targets.addEventListener.bind(targets),
      removeEventListener: targets.removeEventListener.bind(targets),
    })
    map.set('hanzo.chat.preferences', JSON.stringify({ effortVersion: 3, effort: 'high' }))
    expect(getChatPreferences().effort).toBe('auto')
    expect(getChatPreferences().approvalMode).toBe('auto')
    setChatPreferences({ effort: 'low', approvalMode: 'manual' })
    expect(getChatPreferences().effort).toBe('low')
    expect(getChatPreferences().approvalMode).toBe('manual')
    expect(map.get('hanzo.agent.autonomy')).toBe('supervised')
    setChatPreferences({ effort: 'max', approvalMode: 'auto', showLanguage: true })
    expect(getChatPreferences().effort).toBe('max')
    expect(getChatPreferences().approvalMode).toBe('auto')
    expect(getChatPreferences().showLanguage).toBe(true)
    expect(map.get('hanzo.agent.autonomy')).toBe('autonomous')
    vi.unstubAllGlobals()
  })

  test('keeps nothing of what the composer draws: that is the composer setting’s', () => {
    const map = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => map.set(k, v) } })
    map.set('hanzo.chat.preferences', JSON.stringify({ effortVersion: 4, showModelSelector: true, showTurboApproval: true }))
    expect(Object.keys(getChatPreferences()).sort()).toEqual(['allowThirdPartyModels', 'approvalMode', 'effort', 'effortVersion', 'showLanguage'])
    vi.unstubAllGlobals()
  })

  test('lists third-party models until the person turns them off, and then keeps their word', () => {
    const map = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => map.set(k, v) }, dispatchEvent: () => true })
    expect(getChatPreferences().allowThirdPartyModels).toBe(true)
    // An old default of off, written before the person chose anything, reads as on.
    map.set('hanzo.chat.preferences', JSON.stringify({ effortVersion: 4, allowThirdPartyModels: false }))
    expect(getChatPreferences().allowThirdPartyModels).toBe(true)
    setChatPreferences({ allowThirdPartyModels: false, thirdPartyChosen: true })
    expect(getChatPreferences().allowThirdPartyModels).toBe(false)
    setChatPreferences({ allowThirdPartyModels: true, thirdPartyChosen: true })
    expect(getChatPreferences().allowThirdPartyModels).toBe(true)
    vi.unstubAllGlobals()
  })
})
