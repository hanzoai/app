/**
 * What Chat does, kept in this browser. What the composer DRAWS (the key that
 * sends, the chips, the model selector, the mode) is not here: it is one setting
 * for every composer (@hanzo/appearance `composing`, Settings → Appearance).
 * - allowThirdPartyModels: whether 3rd-party models (OpenAI, Anthropic, etc.) are enabled via pre-paid credit (default: false)
 * - approvalMode: whether tools/actions run automatically ('auto') or ask for confirmation first ('manual') (default: 'auto')
 * - effort: the reasoning effort a message asks for (default: high)
 * - showLanguage: dictation listens in the person's own language rather than Auto
 */
import { useEffect, useState } from 'react'
import { EFFORTS as DEV, type Effort as Level } from '@hanzo/build/mind'
import { EFFORTS, type Effort } from '@hanzo/ui/chat/pure'

export type ApprovalMode = 'auto' | 'manual'

export const DEFAULT_EFFORT: Effort = 'high'

export interface ChatPreferences {
  allowThirdPartyModels: boolean
  effort: Effort
  approvalMode: ApprovalMode
  showLanguage?: boolean
  effortVersion?: number
}

const STORAGE_KEY = 'hanzo.chat.preferences'
const AUTONOMY_KEY = 'hanzo.agent.autonomy'
const EVENT_NAME = 'hanzo:chat:preferences'
const EFFORT_SCHEMA_VERSION = 3

const DEFAULT_PREFERENCES: ChatPreferences = {
  allowThirdPartyModels: false,
  effort: DEFAULT_EFFORT,
  approvalMode: 'auto',
  showLanguage: false,
  effortVersion: EFFORT_SCHEMA_VERSION,
}

/** The effort Dev takes for one chosen here (@hanzo/build `EFFORTS`: Auto, High, XHigh, Max), or null for Low and Medium, which only Chat offers. */
export function shared(effort: Effort): Level | null {
  return DEV.some((e) => e.id === effort) ? (effort as Level) : null
}

function validEffort(v: unknown): Effort {
  return EFFORTS.some((s) => s.id === v) ? (v as Effort) : DEFAULT_EFFORT
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
      allowThirdPartyModels: Boolean(parsed.allowThirdPartyModels),
      effort: migratedEffort,
      approvalMode: validApprovalMode(parsed.approvalMode, autonomy),
      showLanguage: Boolean(parsed.showLanguage),
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
