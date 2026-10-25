// @vitest-environment happy-dom
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/ui', () => {
  const el =
    (tag: string) =>
    ({ children, width, minW, maxW, minH, 'data-slot': slot, role, ...rest }: { children?: ReactNode; [k: string]: unknown }) =>
      createElement(
        tag,
        {
          'data-slot': slot,
          role,
          'data-width': width,
          'data-min-w': minW,
          'data-max-w': maxW,
          'data-min-h': minH,
          'data-valuenow': rest['aria-valuenow'],
          'data-valuetext': rest['aria-valuetext'],
        },
        children,
      )
  return {
    Box: el('div'),
    Popover: el('div'),
    PopoverTrigger: el('div'),
    PopoverContent: el('section'),
    Text: el('span'),
    XStack: el('div'),
    YStack: el('div'),
  }
})

vi.mock('@hanzo/i18n/react', () => ({
  useI18n: () => ({ t: (s: string, vars?: Record<string, string>) => (vars ? s.replace(/{(\w+)}/g, (_, k) => vars[k] ?? '') : s) }),
}))

import { DEFAULT_EFFORT, EFFORT_STEPS, ThinkingEffort } from './ThinkingEffort'
import { getChatPreferences, setChatPreferences } from './lib/chatPreferences'

describe('thinking effort', () => {
  test('defines 6 discrete effort steps with high as default', () => {
    expect(DEFAULT_EFFORT).toBe('high')
    expect(EFFORT_STEPS.map((s) => s.id)).toEqual(['auto', 'low', 'medium', 'high', 'xhigh', 'max'])
  })

  test('provides descriptions for all effort steps', () => {
    for (const step of EFFORT_STEPS) {
      expect(step.label.length).toBeGreaterThan(0)
      expect(step.note.length).toBeGreaterThan(0)
    }
  })

  test('displays the selected effort level in the pill button and locks popover width across every slider position', () => {
    const defaultHtml = renderToStaticMarkup(createElement(ThinkingEffort, { onChange: () => {} }))
    expect(defaultHtml).toContain('data-slot="thinking-effort-pill" role="button"><span>High</span>')
    expect(defaultHtml).not.toContain('>Thinking effort<')
    expect(defaultHtml).not.toContain('>Thinking<')

    for (const step of EFFORT_STEPS) {
      const html = renderToStaticMarkup(createElement(ThinkingEffort, { effort: step.id, onChange: () => {} }))
      expect(html).toContain(`data-slot="thinking-effort-pill" role="button"><span>${step.label}</span>`)
      expect(html).not.toContain('>Thinking effort<')
      expect(html).toContain('data-width="260" data-min-w="260" data-max-w="260"')
      expect(html).toContain('data-slot="thinking-effort-card" role="dialog" data-width="100%" data-min-w="234" data-max-w="234"')
      expect(html).toContain('data-min-h="32"')
      expect(html).toContain(`data-valuetext="${step.label}"`)
    }
  })

  test('migrates unversioned chatPreferences effort to high and persists chosen effort', () => {
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
    map.set('hanzo.chat.preferences', JSON.stringify({ effort: 'auto' }))
    expect(getChatPreferences().effort).toBe('high')
    expect(getChatPreferences().approvalMode).toBe('auto')
    setChatPreferences({ effort: 'xhigh', approvalMode: 'manual' })
    expect(getChatPreferences().effort).toBe('xhigh')
    expect(getChatPreferences().approvalMode).toBe('manual')
    expect(map.get('hanzo.agent.autonomy')).toBe('supervised')
    setChatPreferences({ effort: 'max', approvalMode: 'auto' })
    expect(getChatPreferences().effort).toBe('max')
    expect(getChatPreferences().approvalMode).toBe('auto')
    expect(map.get('hanzo.agent.autonomy')).toBe('autonomous')
    vi.unstubAllGlobals()
  })
})
