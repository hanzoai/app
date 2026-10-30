'use client'

// "Schedule this": a prompt from Chat that runs itself.
//
// The dialog holds the prompt, a "When" said in the reader's words — read live
// by the platform's scheduler (`POST /v1/auto/cron`) in their own time zone and
// said back with the next run — and the model it thinks with. Create keeps it
// as an automation made in Chat (lib/auto); its runs land in the Library, and
// the list of them is Scheduled tasks.

import { useEffect, useRef, useState } from 'react'
import { useAi } from '@hanzo/ai/react'
import { useI18n } from '@hanzo/i18n/react'
import { Anchor, Button, Dialog, DialogContent, DialogTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SizableText, Text, Textarea, XStack, YStack } from '@hanzo/ui'
import { cron, schedule, zone, type When } from './lib/auto'
import { app } from './lib/host'
import { site } from './where'
import { BAD } from './lib/mix'

/** A model the dialog offers: its id and the name a reader knows it by. */
export interface Choice {
  id: string
  name: string
}

/** How long the "When" field rests before it is read. */
const REST = 400

/** A moment as the reader's clock says it, in the language they chose. */
function local(at: string, locale: string): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function Schedule({
  open,
  onOpenChange,
  prompt,
  model,
  models,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The prompt it opens with. */
  prompt: string
  /** The model it opens on: the conversation's. */
  model: string
  models: readonly Choice[]
}) {
  const { t, locale } = useI18n()
  const ai = useAi()
  const [words, setWords] = useState('')
  const [said, setSaid] = useState('')
  const [chose, setChose] = useState(model)
  const [read, setRead] = useState<When | null>(null)
  const [reading, setReading] = useState(false)
  const [wrong, setWrong] = useState('')
  const [busy, setBusy] = useState(false)
  const [made, setMade] = useState(false)

  // Each opening starts from what it was opened on; the typing that follows is the reader's.
  useEffect(() => {
    if (!open) return
    setWords(prompt)
    setSaid('')
    setChose(model)
    setRead(null)
    setWrong('')
    setMade(false)
  }, [open, prompt, model])

  // The "When", read once the reader rests, and the last read only.
  const asked = useRef(0)
  useEffect(() => {
    const text = said.trim()
    if (!open || !text) {
      setRead(null)
      setReading(false)
      return
    }
    const n = ++asked.current
    const stop = new AbortController()
    setReading(true)
    const timer = setTimeout(() => {
      cron(ai, text, zone(), stop.signal).then(
        (got) => {
          if (n !== asked.current) return
          setRead(got)
          setWrong('')
          setReading(false)
        },
        (e: unknown) => {
          if (n !== asked.current || stop.signal.aborted) return
          setRead(null)
          setWrong((e as Error)?.message || t('That is not a time the scheduler can read.'))
          setReading(false)
        },
      )
    }, REST)
    return () => {
      clearTimeout(timer)
      stop.abort()
    }
  }, [said, open, ai])

  const ready = Boolean(words.trim() && read && !reading && !busy)
  const create = async () => {
    if (!ready || !read) return
    setBusy(true)
    setWrong('')
    try {
      await schedule(ai, words, read.schedule, chose || undefined)
      setMade(true)
    } catch (e) {
      setWrong((e as Error)?.message || t('The task was not scheduled.'))
    } finally {
      setBusy(false)
    }
  }

  const options = models.some((m) => m.id === chose) || !chose ? models : [{ id: chose, name: chose }, ...models]
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxW={520} rounded="$6" gap="$3" data-slot="schedule">
        <DialogTitle>{t('Schedule this')}</DialogTitle>
        {made ? (
          <YStack gap="$3">
            <SizableText size="$3" color="$ink" role="status">
              {t('Scheduled. {link}', {
                link: (
                  <Anchor href={site(app('-/automations'))} color="$ink" textDecorationLine="underline">
                    {t('See it in Scheduled tasks.')}
                  </Anchor>
                ),
              })}
            </SizableText>
            <XStack justify="flex-end">
              <Button size="sm" rounded={999} onPress={() => onOpenChange(false)}>
                {t('Done')}
              </Button>
            </XStack>
          </YStack>
        ) : (
          <YStack gap="$3">
            <YStack gap="$1">
              <Text fontSize="$1" color="$soft">
                {t('Prompt')}
              </Text>
              <Textarea value={words} onChangeText={setWords} rows={4} aria-label={t('Prompt')} />
            </YStack>
            <YStack gap="$1">
              <Text fontSize="$1" color="$soft">
                {t('When')}
              </Text>
              <Input
                autoFocus
                value={said}
                onChangeText={setSaid}
                placeholder={t('Every Monday at 9am')}
                aria-label={t('When it runs')}
                aria-describedby="schedule-when"
                onKeyDown={(e: { key?: string; nativeEvent?: { isComposing?: boolean } }) => {
                  if (e.key === 'Enter' && !e.nativeEvent?.isComposing) void create()
                }}
              />
              <Text id="schedule-when" fontSize="$1" color={wrong ? BAD : '$soft'} role="status" minH={18}>
                {wrong
                  ? wrong
                  : reading
                    ? t('Reading.')
                    : read
                      ? [read.says, read.next ? t('next {when}', { when: local(read.next, locale) }) : t('when you run it')].filter(Boolean).join(' · ')
                      : t('Say it the way you would: every weekday at 8, every 5 minutes, tomorrow at noon.')}
              </Text>
            </YStack>
            {options.length ? (
              <YStack gap="$1">
                <Text fontSize="$1" color="$soft">
                  {t('Model')}
                </Text>
                <Select value={chose} onValueChange={setChose}>
                  <SelectTrigger aria-label={t('Model')} width="100%">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </YStack>
            ) : null}
            <XStack gap="$2" justify="flex-end">
              <Button size="sm" variant="outline" rounded={999} onPress={() => onOpenChange(false)}>
                {t('Cancel')}
              </Button>
              <Button size="sm" rounded={999} disabled={!ready} onPress={() => void create()}>
                {busy ? t('Scheduling…') : t('Create')}
              </Button>
            </XStack>
          </YStack>
        )}
      </DialogContent>
    </Dialog>
  )
}
