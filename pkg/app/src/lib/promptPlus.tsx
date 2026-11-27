'use client'

import { useCallback, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { FileText, Globe, Sparkles, Telescope } from 'lucide-react'
import type { ComposerProps } from '@hanzo/ui/chat'

interface AttachedItem {
  id: string
  label: string
  snippet?: string
  kind: 'file' | 'web' | 'research' | 'thinking'
}

/**
 * Shared `+` menu & carried-chip controller for secondary `<Composer>` surfaces
 * (Home, Start, Talk, Inbox, Work, FlowPlayground) so `+` works consistently everywhere.
 */
export function usePromptPlus(setDraft: (updater: (prev: string) => string) => void): {
  plus: NonNullable<ComposerProps['plus']>
  carried: NonNullable<ComposerProps['carried']>
  composeText: (draft: string) => string
  clearCarried: () => void
  hasCarried: boolean
} {
  const { t } = useI18n()
  const [items, setItems] = useState<AttachedItem[]>([])
  const [researchOn, setResearchOn] = useState(false)
  const [thinkingOn, setThinkingOn] = useState(false)

  const pickFiles = useCallback(() => {
    if (typeof document === 'undefined') return
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = async () => {
      const files = Array.from(input.files ?? [])
      for (const file of files) {
        let snippet: string | undefined
        if (file.size <= 128 * 1024 && (file.type.startsWith('text/') || /\.(md|txt|json|yaml|yml|toml|ts|tsx|js|py|rs|go|sql|csv)$/i.test(file.name))) {
          try {
            snippet = await file.text()
          } catch {
            // keep filename attachment only
          }
        }
        setItems((prev) =>
          prev.some((x) => x.id === `file:${file.name}`)
            ? prev
            : [...prev, { id: `file:${file.name}`, label: file.name, snippet, kind: 'file' }],
        )
      }
    }
    input.click()
  }, [])

  const remove = useCallback((id: string) => {
    if (id === 'tool:research') setResearchOn(false)
    if (id === 'tool:thinking') setThinkingOn(false)
    setItems((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const toggleWeb = useCallback(() => {
    setItems((prev) =>
      prev.some((x) => x.id === 'tool:web')
        ? prev
        : [...prev, { id: 'tool:web', label: t('Web search'), kind: 'web' }],
    )
  }, [t])

  const plus: NonNullable<ComposerProps['plus']> = {
    upload: pickFiles,
    library: pickFiles,
    createImage: () => {
      setDraft((prev) => (prev.trim() ? prev : t('Create an image of ')))
    },
    webSearch: toggleWeb,
    research: {
      on: researchOn,
      set: (on: boolean) => {
        setResearchOn(on)
        setItems((prev) =>
          on
            ? prev.some((x) => x.id === 'tool:research')
              ? prev
              : [...prev, { id: 'tool:research', label: t('Deep research'), kind: 'research' }]
            : prev.filter((x) => x.id !== 'tool:research'),
        )
      },
    },
    thinking: {
      on: thinkingOn,
      set: (on: boolean) => {
        setThinkingOn(on)
        setItems((prev) =>
          on
            ? prev.some((x) => x.id === 'tool:thinking')
              ? prev
              : [...prev, { id: 'tool:thinking', label: t('Thinking'), kind: 'thinking' }]
            : prev.filter((x) => x.id !== 'tool:thinking'),
        )
      },
    },
  }

  const carried: NonNullable<ComposerProps['carried']> = items.map((item) => ({
    id: item.id,
    label: item.label,
    icon:
      item.kind === 'web' ? (
        <Globe size={14} aria-hidden />
      ) : item.kind === 'research' ? (
        <Telescope size={14} aria-hidden />
      ) : item.kind === 'thinking' ? (
        <Sparkles size={14} aria-hidden />
      ) : (
        <FileText size={14} aria-hidden />
      ),
    onRemove: () => remove(item.id),
  }))

  const composeText = useCallback(
    (draft: string): string => {
      const base = draft.trim()
      const fileBlocks = items
        .filter((x) => x.kind === 'file')
        .map((f) => (f.snippet ? `\n\n--- ${f.label} ---\n${f.snippet}` : `\n\n[Attached: ${f.label}]`))
        .join('')
      const prefix = [
        researchOn ? '[Deep research] ' : '',
        items.some((x) => x.kind === 'web') ? '[Web search] ' : '',
      ].join('')
      const combined = `${prefix}${base}${fileBlocks}`.trim()
      return combined
    },
    [items, researchOn],
  )

  const clearCarried = useCallback(() => {
    setItems([])
    setResearchOn(false)
    setThinkingOn(false)
  }, [])

  return { plus, carried, composeText, clearCarried, hasCarried: items.length > 0 }
}
