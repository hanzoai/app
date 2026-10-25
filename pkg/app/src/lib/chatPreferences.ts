/**
 * Chat composer preferences:
 * - showModelSelector: whether model selector is visible in composer (default: false, paid plan feature)
 * - allowThirdPartyModels: whether 3rd-party models (OpenAI, Anthropic, etc.) are enabled via pre-paid credit (default: false)
 */
import { useEffect, useState } from 'react'
import { DEFAULT_EFFORT, EFFORT_STEPS, type EffortLevel } from '../ThinkingEffort'

export interface ChatPreferences {
  showModelSelector: boolean
  allowThirdPartyModels: boolean
  effort: EffortLevel
}

const STORAGE_KEY = 'hanzo.chat.preferences'
const EVENT_NAME = 'hanzo:chat:preferences'

const DEFAULT_PREFERENCES: ChatPreferences = {
  showModelSelector: false,
  allowThirdPartyModels: false,
  effort: DEFAULT_EFFORT,
}

function validEffort(v: unknown): EffortLevel {
  return EFFORT_STEPS.some((s) => s.id === v) ? (v as EffortLevel) : DEFAULT_EFFORT
}

export function getChatPreferences(): ChatPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<ChatPreferences>
    return {
      showModelSelector: Boolean(parsed.showModelSelector),
      allowThirdPartyModels: Boolean(parsed.allowThirdPartyModels),
      effort: validEffort(parsed.effort),
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function setChatPreferences(patch: Partial<ChatPreferences>): ChatPreferences {
  const current = getChatPreferences()
  const next: ChatPreferences = { ...current, ...patch }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }))
  }
  return next
}

export function useChatPreferences(): [ChatPreferences, (patch: Partial<ChatPreferences>) => void] {
  const [prefs, setPrefs] = useState<ChatPreferences>(getChatPreferences)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ChatPreferences>).detail
      if (detail) setPrefs(detail)
      else setPrefs(getChatPreferences())
    }
    window.addEventListener(EVENT_NAME, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(EVENT_NAME, handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  return [prefs, setChatPreferences]
}
