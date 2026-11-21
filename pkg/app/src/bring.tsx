'use client'

// The composer's choice of how skills, agents and personas join a message
// (chosen.ts, hanzo-inc/app issue 314). Its own module so it is drawn and tested
// without Chat's world.

import { useI18n } from '@hanzo/i18n/react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Text, XStack, YStack } from '@hanzo/ui'
import { Check, Sparkles } from 'lucide-react'
import type { Bring as Way } from './lib/chatPreferences'

/**
 * "Skills: Auto" or "Skills: Preload", opening onto the two ways. `last` is what
 * Hanzo brought into the last message, said under them so the choice is seen.
 */
export function Bring({ value, onChange, last = [] }: { value: Way; onChange: (next: Way) => void; last?: readonly string[] }) {
  const { t } = useI18n()
  const label = value === 'preload' ? t('Skills: Preload') : t('Skills: Auto')
  const ways: { id: Way; title: string; note: string }[] = [
    { id: 'choose', title: t('Let Hanzo choose'), note: t('Hanzo brings in the skills, agents and personas each message needs. No / commands needed.') },
    {
      id: 'preload',
      title: t('Preload into this chat'),
      note: t('Only what you pick from + or with / joins, and it goes into every message here. Preloading uses context.'),
    },
  ]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <XStack
          render="button"
          data-slot="composer-bring"
          data-bring={value}
          aria-label={t('Skills, agents and personas: {way}', { way: value === 'preload' ? t('Preload') : t('Auto') })}
          items="center"
          gap="$1"
          height={28}
          px="$1.5"
          rounded="$3"
          cursor="pointer"
          borderWidth={1}
          borderColor="transparent"
          transition="quickest"
          hoverStyle={{ bg: '$hover', borderColor: 'var(--border-strong)' }}
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
          $max-sm={{ minH: 44 }}
        >
          <Sparkles size={13.5} strokeWidth={1.8} color="var(--text-secondary)" aria-hidden />
          <Text fontSize="$1" lineHeight={16} fontWeight="500" color="$aside" numberOfLines={1}>
            {label}
          </Text>
        </XStack>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" minW={260} maxW={320} data-slot="bring-menu">
        <DropdownMenuLabel>{t('Skills, agents and personas')}</DropdownMenuLabel>
        {ways.map((way) => (
          <DropdownMenuItem key={way.id} data-slot={`bring-${way.id}`} aria-label={way.title} onSelect={() => onChange(way.id)}>
            <XStack flex={1} minW={0} gap="$2" items="flex-start">
              <YStack flex={1} minW={0} gap="$0.5">
                <Text fontSize="$2" fontWeight="600" color="$ink">
                  {way.title}
                </Text>
                <Text fontSize="$1" color="$soft">
                  {way.note}
                </Text>
              </YStack>
              {value === way.id ? <Check size={14} color="var(--primary)" aria-hidden /> : null}
            </XStack>
          </DropdownMenuItem>
        ))}
        {value === 'choose' && last.length ? (
          <>
            <DropdownMenuSeparator />
            <Text fontSize="$1" color="$soft" px="$2" py="$1.5" data-slot="bring-last">
              {t('Brought into your last message: {names}', { names: last.join(', ') })}
            </Text>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
