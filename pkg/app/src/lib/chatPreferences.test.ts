import { EFFORTS as DEV } from '@hanzo/dev/mind'
import { EFFORTS } from '@hanzo/ui/chat/pure'
import { describe, expect, test, vi } from 'vitest'

import { DEFAULT_EFFORT, getChatPreferences, setChatPreferences, shared } from './chatPreferences'

describe('what Chat does', () => {
  test('offers the composer’s efforts, auto by default', () => {
    expect(DEFAULT_EFFORT).toBe('auto')
    expect(EFFORTS.map((s) => s.id)).toEqual(['auto', 'off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
    for (const step of EFFORTS) {
      expect(step.label.length).toBeGreaterThan(0)
      expect(step.note.length).toBeGreaterThan(0)
    }
  })

  test('hands Dev every effort it offers, Auto, Low (Fast), High and Max, in Chat’s order and words', () => {
    const dev = DEV.map((e) => e.id)
    expect(dev).toEqual(['auto', 'low', 'high', 'max']) // Low/Fast added for Dev: a Fast mode for coding
    // Same labels as Chat's, except Dev calls Low "Fast"; the notes are each side's own wording, so are not compared.
    expect(EFFORTS.filter((s) => dev.includes(s.id as never)).map((s) => [s.id, s.id === 'low' ? 'Fast' : s.label])).toEqual(DEV.map((e) => [e.id, e.label]))
    expect(EFFORTS.map((s) => shared(s.id))).toEqual(['auto', null, null, 'low', null, 'high', null, 'max'])
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
    // Hanzo chooses the skills, agents and personas a message needs until the person preloads instead (issue 314).
    expect(getChatPreferences().bring).toBe('choose')
    setChatPreferences({ bring: 'preload' })
    expect(getChatPreferences().bring).toBe('preload')
    vi.unstubAllGlobals()
  })

  test('keeps nothing of what the composer draws: that is the composer setting’s', () => {
    const map = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => map.set(k, v) } })
    map.set('hanzo.chat.preferences', JSON.stringify({ effortVersion: 4, showModelSelector: true, showTurboApproval: true }))
    expect(Object.keys(getChatPreferences()).sort()).toEqual(['allowThirdPartyModels', 'approvalMode', 'bring', 'effort', 'effortVersion', 'showLanguage'])
    vi.unstubAllGlobals()
  })

  test('hides third-party models by default until enabled, and keeps the person’s choice', () => {
    const map = new Map<string, string>()
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => map.set(k, v) }, dispatchEvent: () => true })
    expect(getChatPreferences().allowThirdPartyModels).toBe(false)
    map.set('hanzo.chat.preferences', JSON.stringify({ effortVersion: 4, allowThirdPartyModels: false }))
    expect(getChatPreferences().allowThirdPartyModels).toBe(false)
    setChatPreferences({ allowThirdPartyModels: true, thirdPartyChosen: true })
    expect(getChatPreferences().allowThirdPartyModels).toBe(true)
    setChatPreferences({ allowThirdPartyModels: false, thirdPartyChosen: true })
    expect(getChatPreferences().allowThirdPartyModels).toBe(false)
    vi.unstubAllGlobals()
  })
})
