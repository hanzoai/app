'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Check, FileCode, MessageSquare, Save, X } from 'lucide-react'
import { Button, Text, XStack, YStack } from '@hanzo/ui'
import { useI18n } from '@hanzo/i18n/react'
import { readLocalFile, writeLocalFile } from './lib/local-fs'

export interface EditorProps {
  filePath: string
  fileName?: string
  onClose: () => void
  onAskInChat?: (filePath: string, fileName: string) => void
}

export function Editor({ filePath, fileName, onClose, onAskInChat }: EditorProps) {
  const { t } = useI18n()
  const name = fileName || filePath.split(/[/\\]/).pop() || 'Untitled'

  const [content, setContent] = useState<string>('')
  const [initialContent, setInitialContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = content !== initialContent

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    readLocalFile(filePath)
      .then((text) => {
        if (!live) return
        setContent(text)
        setInitialContent(text)
        setLoading(false)
      })
      .catch((err) => {
        if (!live) return
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
    return () => {
      live = false
    }
  }, [filePath])

  const handleSave = useCallback(async () => {
    if (saving || !isDirty) return
    setSaving(true)
    setError(null)
    try {
      await writeLocalFile(filePath, content)
      setInitialContent(content)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [filePath, content, saving, isDirty])

  // Handle Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleSave()
      }
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, onClose])

  const lineCount = content.split('\n').length

  return (
    <YStack
      position="absolute"
      t={0}
      r={0}
      b={0}
      l={0}
      z={30}
      bg="$background"
      overflow="hidden"
      data-slot="local-file-editor"
    >
      {/* Top Header Bar */}
      <XStack
        height={52}
        items="center"
        justify="space-between"
        px="$4"
        borderBottomWidth={1}
        borderColor="$borderColor"
        bg="$panel"
        shrink={0}
      >
        <XStack items="center" gap="$3" minW={0} flex={1}>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('Back')}>
            <ArrowLeft size={16} />
          </Button>

          <FileCode size={18} color="var(--primary)" aria-hidden />

          <YStack minW={0} flex={1}>
            <XStack items="center" gap="$2">
              <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
                {name}
              </Text>
              {isDirty ? (
                <Text fontSize="$1" color="var(--primary)" fontWeight="600">
                  ● {t('Modified')}
                </Text>
              ) : null}
            </XStack>
            <Text fontSize="$1" color="$soft" numberOfLines={1}>
              {filePath}
            </Text>
          </YStack>
        </XStack>

        <XStack items="center" gap="$2">
          {error ? (
            <Text fontSize="$1" color="var(--destructive)" numberOfLines={1} maxW={240}>
              {error}
            </Text>
          ) : null}

          {onAskInChat ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAskInChat(filePath, name)}
              aria-label={t('Ask in Chat')}
            >
              <MessageSquare size={14} />
              {t('Ask in Chat')}
            </Button>
          ) : null}

          <Button
            variant={isDirty ? 'default' : 'secondary'}
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            aria-label={t('Save')}
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? t('Saved') : saving ? t('Saving…') : t('Save (⌘S)')}
          </Button>

          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t('Close')}>
            <X size={16} />
          </Button>
        </XStack>
      </XStack>

      {/* Main Editor Body */}
      {loading ? (
        <YStack flex={1} items="center" justify="center" gap="$3">
          <Text fontSize="$3" color="$soft">
            {t('Loading file…')}
          </Text>
        </YStack>
      ) : error && !content ? (
        <YStack flex={1} items="center" justify="center" p="$6" gap="$3">
          <Text fontSize="$4" color="var(--destructive)" fontWeight="600">
            {t('Failed to open file')}
          </Text>
          <Text fontSize="$2" color="$soft" text="center" maxW={480}>
            {error}
          </Text>
          <Button variant="outline" size="sm" onClick={onClose} mt="$3">
            {t('Go back')}
          </Button>
        </YStack>
      ) : (
        <XStack flex={1} minH={0} overflow="hidden">
          {/* Line Numbers Gutter */}
          <YStack
            width={48}
            py="$3"
            px="$2"
            bg="$panel"
            borderRightWidth={1}
            borderColor="$borderColor"
            // inline-style: user-select is needed to prevent selection of line numbers
            style={{ userSelect: 'none' }}
            overflow="hidden"
            items="flex-end"
          >
            {Array.from({ length: Math.min(lineCount, 5000) }).map((_, i) => (
              <Text
                key={i}
                fontSize={12}
                lineHeight={20}
                fontFamily="$mono"
                color="$faint"
              >
                {i + 1}
              </Text>
            ))}
          </YStack>

          {/* Textarea Code Editor */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            // inline-style: raw textarea styling for code editing
            style={{
              flex: 1,
              height: '100%',
              backgroundColor: 'transparent',
              color: 'var(--foreground)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 'var(--text-sm)',
              lineHeight: '20px',
              padding: '12px 16px',
              border: 'none',
              outline: 'none',
              resize: 'none',
              whiteSpace: 'pre',
              overflowWrap: 'normal',
              overflowX: 'auto',
              overflowY: 'auto',
            }}
          />
        </XStack>
      )}
    </YStack>
  )
}
