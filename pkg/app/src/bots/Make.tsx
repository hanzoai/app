'use client'

// Making a bot: a name, what it does, optional Bot Group / Layer assignment,
// and what it may spend a week. Every bot is created with full tool access
// (`tools: ['*']`) including Desktop Sandbox Computer Use and Connectors.

import { useState, type FormEvent } from 'react'
import type { Agent } from '@hanzo/ai'
import { useI18n } from '@hanzo/i18n/react'
import { Input, Text, XStack, YStack } from '@hanzo/gui'
import { Dialog, DialogContent, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@hanzo/ui'
import { ChevronDown } from 'lucide-react'
import { ENSO, useAi } from '../lib/ai'
import { plainly } from '../failure'
import { NAME, make, updateGroup, type BotGroup } from './api'
import { PILL, WORD } from './kit'
import { DIM, INK, LINE, PICKED, RAISED } from './ink'

const BOT_ROLE_TEMPLATES: readonly {
  id: string
  label: string
  name: string
  weekly: string
  instructions: string
}[] = [
  {
    id: 'researcher',
    label: 'Researcher',
    name: 'research-bot',
    weekly: '15',
    instructions:
      'Research topics using live web sources and workspace knowledge, then deliver concise cited briefs with key findings and next actions.',
  },
  {
    id: 'ops',
    label: 'Ops Triage',
    name: 'ops-triage',
    weekly: '20',
    instructions:
      'Monitor incidents, logs, and alerts; triage severity, summarize root cause, and draft actionable follow-ups for human approval.',
  },
  {
    id: 'support',
    label: 'Support Desk',
    name: 'support-desk',
    weekly: '15',
    instructions:
      'Answer customer questions accurately from workspace docs, flag billing or account escalations, and keep responses short and clear.',
  },
  {
    id: 'writer',
    label: 'Content Writer',
    name: 'content-writer',
    weekly: '10',
    instructions:
      'Turn notes, releases, and product updates into clear changelog entries, email digests, and launch drafts in our brand voice.',
  },
]

const MAX_BOT_NAME = 64

/** Derives a valid `NAME`-matching slug from a bot's job description. */
export function deriveBotName(description: string): string {
  const slug = description
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_BOT_NAME)
    .replace(/-+$/g, '')
  return slug || 'bot'
}

/** Resolves the bot slug: manual `name` when provided, otherwise derived from `does`. */
export function resolveBotName(name: string, does: string): string {
  const manual = name.trim()
  if (manual) return manual
  const desc = does.trim()
  return desc ? deriveBotName(desc) : ''
}

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

export function Make({
  groups = [],
  onDone,
  onCancel,
}: {
  groups?: readonly BotGroup[]
  onDone: (a: Agent) => void | Promise<void>
  onCancel: () => void
}) {
  const { t } = useI18n()
  const { client } = useAi()
  const [name, setName] = useState('')
  const [does, setDoes] = useState('')
  const [groupId, setGroupId] = useState('')
  const [layer, setLayer] = useState<number>(1)
  const [weekly, setWeekly] = useState('10')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)

  const dollars = Number(weekly)
  const trimmedName = name.trim()
  const trimmedDoes = does.trim()
  const resolvedName = resolveBotName(name, does)
  const named = trimmedName ? NAME.test(trimmedName) : Boolean(trimmedDoes && NAME.test(resolvedName))
  const ok = named && Number.isInteger(dollars) && dollars > 0 && dollars <= 10_000 && !busy

  const selectedGroup = groups.find((g) => g.id === groupId || g.name === groupId) ?? null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!client || !ok) return
    setBusy(true)
    setWrong(null)
    try {
      const botName = resolveBotName(name, does)
      const created = await make(client, {
        name: botName,
        instructions:
          trimmedDoes ||
          `You are ${botName}, a Layer ${layer} worker bot directed by Primary Bot hanzo. Use your desktop sandbox computer and connected tools to complete tasks accurately.`,
        model: ENSO,
        weekly: dollars,
        groupId: selectedGroup?.id || undefined,
        layer: selectedGroup?.layer ?? layer,
      })
      if (selectedGroup && !selectedGroup.members.includes(created.name)) {
        await updateGroup(client, selectedGroup.name, { members: [...selectedGroup.members, created.name] }).catch(() => null)
      }
      await onDone(created)
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
        maxW={460}
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
        <YStack gap={6} data-slot="bots-make-templates">
          <Text fontSize={12} lineHeight={16} color={DIM}>
            {t('Quick-start role')}
          </Text>
          <XStack gap={6} flexWrap="wrap">
            {BOT_ROLE_TEMPLATES.map((tpl) => {
              const active = name.trim() === tpl.name && does.trim() === tpl.instructions
              return (
                <XStack
                  key={tpl.id}
                  render="button"
                  {...{ type: 'button' }}
                  data-slot={`bots-make-tpl-${tpl.id}`}
                  aria-pressed={active}
                  onClick={() => {
                    setName(tpl.name)
                    setDoes(tpl.instructions)
                    setWeekly(tpl.weekly)
                  }}
                  height={28}
                  px={10}
                  rounded={999}
                  items="center"
                  bg={active ? PICKED : RAISED}
                  borderWidth={1}
                  borderColor={active ? INK : LINE}
                  cursor="pointer"
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                >
                  <Text fontSize={12} lineHeight={16} fontWeight={active ? '600' : '400'} color={INK}>
                    {t(tpl.label)}
                  </Text>
                </XStack>
              )
            })}
          </XStack>
        </YStack>
        <YStack render="form" {...{ onSubmit: submit }} gap={12}>
          <Input
            {...FIELD}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Name (optional)')}
            aria-label={t('Bot name')}
          />
          {trimmedName && !named ? (
            <Text fontSize={13} lineHeight={18} color={DIM} px={4}>
              {t('Letters, digits, dot, dash and underscore; it starts with a letter or a digit.')}
            </Text>
          ) : !trimmedName && trimmedDoes ? (
            <Text data-slot="bots-make-derived-name" fontSize={12} lineHeight={16} color={DIM} px={4}>
              {t('Slug: {name}', { name: resolvedName })}
            </Text>
          ) : null}
          <Input
            {...FIELD}
            render="textarea"
            rows={4}
            value={does}
            onChange={(e) => setDoes(e.target.value)}
            placeholder={t('What it does (directed by Primary Bot hanzo, with full Desktop Computer Use)')}
            aria-label={t('What it does')}
          />

          <XStack items="center" justify="space-between" gap={10} px={4}>
            <Text fontSize={14} lineHeight={19} color={DIM}>
              {t('Coordination Layer')}
            </Text>
            <XStack gap={6}>
              {[1, 2, 3].map((lv) => {
                const locked = Boolean(selectedGroup)
                const active = (selectedGroup?.layer ?? layer) === lv
                return (
                  <XStack
                    key={lv}
                    render="button"
                    {...{ type: 'button', disabled: locked }}
                    aria-pressed={active}
                    aria-disabled={locked}
                    onClick={() => {
                      if (!locked) setLayer(lv)
                    }}
                    height={28}
                    px={10}
                    rounded={999}
                    items="center"
                    bg={active ? PICKED : RAISED}
                    borderWidth={1}
                    borderColor={active ? INK : LINE}
                    opacity={locked ? 0.5 : 1}
                    cursor={locked ? 'not-allowed' : 'pointer'}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  >
                    <Text fontSize={12} lineHeight={16} fontWeight={active ? '600' : '400'} color={INK}>
                      {`L${lv}`}
                    </Text>
                  </XStack>
                )
              })}
            </XStack>
          </XStack>

          {groups.length > 0 ? (
            <XStack items="center" justify="space-between" px={4}>
              <Text fontSize={14} lineHeight={19} color={DIM}>
                {t('Assign to Group')}
              </Text>
              <DropdownMenu placement="bottom-end" offset={6}>
                <DropdownMenuTrigger asChild>
                  <XStack
                    render="button"
                    {...{ type: 'button' }}
                    height={30}
                    px={11}
                    rounded={999}
                    items="center"
                    gap={5}
                    bg={RAISED}
                    borderWidth={1}
                    borderColor={LINE}
                    cursor="pointer"
                  >
                    <Text fontSize={13} lineHeight={18} color={INK}>
                      {selectedGroup ? `${selectedGroup.name} (L${selectedGroup.layer || 1})` : t('None')}
                    </Text>
                    <ChevronDown size={13} color={DIM} aria-hidden />
                  </XStack>
                </DropdownMenuTrigger>
                <DropdownMenuContent minW={180}>
                  <DropdownMenuItem onSelect={() => setGroupId('')}>
                    <Text fontSize="$3" color="$ink">
                      {t('None')}
                    </Text>
                  </DropdownMenuItem>
                  {groups.map((g) => (
                    <DropdownMenuItem key={g.id} onSelect={() => setGroupId(g.id)}>
                      <Text fontSize="$3" color="$ink">
                        {`${g.name} (Layer ${g.layer || 1})`}
                      </Text>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </XStack>
          ) : null}

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
