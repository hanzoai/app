'use client'

import { useRef, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { Input } from '@hanzo/ui'
import { XStack } from '@hanzo/gui'

/** Inline rename field drawn directly inside a ThreadRow: Enter saves, Escape cancels, empty string ignored. */
export function InlineRename({
  initial,
  onSave,
  onCancel,
}: {
  initial: string
  onSave: (title: string) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [words, setWords] = useState(initial)
  const doneRef = useRef(false)
  const commit = () => {
    if (doneRef.current) return
    doneRef.current = true
    const clean = words.trim()
    if (!clean) {
      onCancel()
      return
    }
    onSave(clean)
  }
  const cancel = () => {
    if (doneRef.current) return
    doneRef.current = true
    onCancel()
  }
  return (
    <XStack px="$1" py="$0.5" items="center" width="100%" minW={0}>
      <Input
        data-slot="thread-inline-rename"
        size="sm"
        autoFocus
        value={words}
        onChangeText={setWords}
        aria-label={t('Chat title')}
        maxLength={80}
        flex={1}
        minW={0}
        height={29}
        rounded={8}
        bg="$panel"
        color="$ink"
        borderWidth={1}
        borderColor="var(--border-strong)"
        focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
        $touchable={{ minH: 44 }}
        $max-sm={{ minH: 44 }}
        onFocus={(e: { target?: { select?: () => void } }) => e.target?.select?.()}
        onBlur={commit}
        onKeyDown={(e: {
          key?: string
          keyCode?: number
          nativeEvent?: { isComposing?: boolean }
          preventDefault?: () => void
          stopPropagation?: () => void
        }) => {
          e.stopPropagation?.()
          if (e.key === 'Escape') {
            e.preventDefault?.()
            cancel()
            return
          }
          if (e.key === 'Enter' && !e.nativeEvent?.isComposing && e.keyCode !== 229) {
            e.preventDefault?.()
            commit()
          }
        }}
      />
    </XStack>
  )
}
