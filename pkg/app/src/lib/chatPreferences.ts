/**
 * Chat composer preferences:
 * - showModelSelector: whether model selector is visible in composer (default: false, paid plan feature)
 * - allowThirdPartyModels: whether 3rd-party models (OpenAI, Anthropic, etc.) are enabled via pre-paid credit (default: false)
 * - approvalMode: whether tools/actions run automatically ('auto') or ask for confirmation first ('manual') (default: 'auto')
 */
import { useEffect, useState } from 'react'
import { DEFAULT_EFFORT, EFFORT_STEPS, type EffortLevel } from '../ThinkingEffort'

export type ApprovalMode = 'auto' | 'manual'

export interface ChatPreferences {
  showModelSelector: boolean
  allowThirdPartyModels: boolean
  effort: EffortLevel
  approvalMode: ApprovalMode
  showLanguage?: boolean
  showTurboApproval?: boolean
  effortVersion?: number
}

const STORAGE_KEY = 'hanzo.chat.preferences'
const AUTONOMY_KEY = 'hanzo.agent.autonomy'
const EVENT_NAME = 'hanzo:chat:preferences'
const EFFORT_SCHEMA_VERSION = 3

const DEFAULT_PREFERENCES: ChatPreferences = {
  showModelSelector: false,
  allowThirdPartyModels: false,
  effort: DEFAULT_EFFORT,
  approvalMode: 'auto',
  showLanguage: false,
  showTurboApproval: false,
  effortVersion: EFFORT_SCHEMA_VERSION,
}

function validEffort(v: unknown): EffortLevel {
  return EFFORT_STEPS.some((s) => s.id === v) ? (v as EffortLevel) : DEFAULT_EFFORT
}

function validApprovalMode(v: unknown, fallbackAutonomy?: string | null): ApprovalMode {
  if (v === 'manual' || v === 'auto') return v
  if (fallbackAutonomy === 'supervised') return 'manual'
  return 'auto'
}

export function getChatPreferences(): ChatPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const autonomy = window.localStorage.getItem(AUTONOMY_KEY)
    if (!raw) {
      return {
        ...DEFAULT_PREFERENCES,
        approvalMode: validApprovalMode(undefined, autonomy),
      }
    }
    const parsed = JSON.parse(raw) as Partial<ChatPreferences>
    const migratedEffort =
      parsed.effortVersion === EFFORT_SCHEMA_VERSION ? validEffort(parsed.effort) : DEFAULT_EFFORT
    return {
      showModelSelector: Boolean(parsed.showModelSelector),
      allowThirdPartyModels: Boolean(parsed.allowThirdPartyModels),
      effort: migratedEffort,
      approvalMode: validApprovalMode(parsed.approvalMode, autonomy),
      showLanguage: Boolean(parsed.showLanguage),
      showTurboApproval: Boolean(parsed.showTurboApproval),
      effortVersion: EFFORT_SCHEMA_VERSION,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function setChatPreferences(patch: Partial<ChatPreferences>): ChatPreferences {
  const current = getChatPreferences()
  const next: ChatPreferences = { ...current, ...patch, effortVersion: EFFORT_SCHEMA_VERSION }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      if (patch.approvalMode) {
        window.localStorage.setItem(AUTONOMY_KEY, patch.approvalMode === 'manual' ? 'supervised' : 'autonomous')
      }
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
