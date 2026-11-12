'use client'

// Making a bot: a name, what it does, and what it may spend a week.
//
// The platform keeps every bot on a budget and refuses one without it, so the
// budget is asked for here rather than chosen silently. Whatever the platform
// refuses — a name already taken, a model it does not serve — is shown in its
// own words.

import { useState, type FormEvent } from 'react'
import type { Agent } from '@hanzo/ai'
import { useI18n } from '@hanzo/i18n/react'
import { Input, Text, XStack, YStack } from '@hanzo/gui'
import { Dialog, DialogContent, DialogTitle } from '@hanzo/ui'
import { ENSO, useAi } from '../lib/ai'
import { plainly } from '../failure'
import { NAME, make } from './api'
import { PILL, WORD } from './kit'
import { DIM, INK, LINE, RAISED } from './ink'

const FIELD = {
  unstyled: true,
  width: '100%',
  px: 14,
  py: 10,
  rounded: 12,
  bg: RAISED,
  borderWidth: 1,
  borderColor: LINE,
  color: INK,
  fontSize: 15,
  placeholderTextColor: '$placeholderColor',
} as const

export function Make({ onDone, onCancel }: { onDone: (a: Agent) => void | Promise<void>; onCancel: () => void }) {
  const { t } = useI18n()
  const { client } = useAi()
  const [name, setName] = useState('')
  const [does, setDoes] = useState('')
  const [weekly, setWeekly] = useState('10')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)

  const dollars = Number(weekly)
  const named = NAME.test(name.trim())
  // Up to ten thousand dollars a week: a cap is a guard, and past it a typo is a fortune.
  const ok = named && Number.isInteger(dollars) && dollars > 0 && dollars <= 10_000 && !busy

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!client || !ok) return
    setBusy(true)
    setWrong(null)
    try {
      await onDone(await make(client, { name: name.trim(), instructions: does.trim(), model: ENSO, weekly: dollars }))
    } catch (err) {
      setWrong(plainly(err, t('this bot'), t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => (v ? undefined : onCancel())}>
      <DialogContent
        data-parity-key="bots.make"
        width="calc(100vw - 32px)"
        maxW={440}
        bg="var(--popover)"
        rounded={20}
        p={20}
        gap={14}
        borderWidth={1}
        borderColor={LINE}
      >
        <DialogTitle fontSize={18} lineHeight={24} fontWeight="500" color="$ink">
          {t('New bot')}
        </DialogTitle>
        <YStack render="form" {...{ onSubmit: submit }} gap={12}>
          <Input
            {...FIELD}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Name')}
            aria-label={t('Bot name')}
          />
          {name.trim() && !named ? (
            <Text fontSize={13} lineHeight={18} color={DIM} px={4}>
              {t('Letters, digits, dot, dash and underscore; it starts with a letter or a digit.')}
            </Text>
          ) : null}
          <Input
            {...FIELD}
            render="textarea"
            rows={4}
            value={does}
            onChange={(e) => setDoes(e.target.value)}
            placeholder={t('What it does')}
            aria-label={t('What it does')}
          />
          <XStack items="center" gap={10} px={4}>
            <Text fontSize={15} lineHeight={20} color={DIM}>
              {t('Spend up to $')}
            </Text>
            <Input
              {...FIELD}
              width={88}
              py={8}
              inputMode="numeric"
              value={weekly}
              onChange={(e) => setWeekly(e.target.value.replace(/[^\d]/g, ''))}
              aria-label={t('Weekly budget in US dollars')}
            />
            <Text fontSize={15} lineHeight={20} color={DIM}>
              {t('a week')}
            </Text>
          </XStack>
          {wrong ? (
            <Text role="alert" fontSize={13} lineHeight={18} color={DIM} px={4}>
              {wrong}
            </Text>
          ) : null}
          <XStack justify="flex-end" gap={8} pt={4}>
            <XStack {...PILL} onClick={onCancel}>
              <Text {...WORD}>{t('Cancel')}</Text>
            </XStack>
            <XStack
              {...PILL}
              {...{ type: 'submit' }}
              disabled={!ok}
              opacity={ok ? 1 : 0.5}
              bg={INK}
              borderColor={INK}
              hoverStyle={{ bg: INK, opacity: 0.9 }}
            >
              <Text {...WORD} color="var(--background)">
                {t(busy ? 'Making…' : 'Make bot')}
              </Text>
            </XStack>
          </XStack>
        </YStack>
      </DialogContent>
    </Dialog>
  )
}
