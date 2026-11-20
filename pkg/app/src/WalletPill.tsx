'use client'

import { useI18n } from '@hanzo/i18n/react'
import { useIam } from '@hanzo/iam/react'
import { Text, XStack } from '@hanzo/gui'
import { Plus, Wallet } from 'lucide-react'
import { cents } from './lib/org'
import { payPage } from './lib/pay'
import { org } from './lib/session'
import { useTier } from './lib/tier'
import { useDevMode } from './lib/dev-mode'

export function WalletPill({
  alwaysShow = false,
  compact = false,
}: {
  alwaysShow?: boolean
  compact?: boolean
}) {
  const { t } = useI18n()
  const [devMode] = useDevMode()
  const { isAuthenticated } = useIam()
  const currentOrg = org()
  const { tier, wrong } = useTier(isAuthenticated && Boolean(currentOrg), currentOrg)

  if (!isAuthenticated) return null
  const hasBalance = typeof tier?.balance?.effectiveAvailable === 'number'
  const positiveBalance = hasBalance && tier!.balance.effectiveAvailable > 0
  // Extra credits are merged into the live UsageControl hover breakdown so compact bars don't duplicate billing pills unless Developer mode is active.
  if (!alwaysShow && compact && !devMode) return null
  if (!alwaysShow && !positiveBalance && !devMode) return null

  const balance = hasBalance
    ? cents(tier!.balance.effectiveAvailable, tier!.balance.currency || 'usd')
    : wrong
      ? t('Wallet')
      : '…'

  return (
    <XStack
      render="a"
      {...{ href: payPage('/amount/card') }}
      data-slot="wallet-pill"
      aria-label={t('Wallet credits: {balance}. Add funds', { balance })}
      height={compact ? 26 : 30}
      px={compact ? '$2' : '$2.5'}
      gap="$1.5"
      rounded="$3"
      items="center"
      bg="var(--surface-card)"
      borderWidth={1}
      borderColor="$edge"
      cursor="pointer"
      hoverStyle={{ bg: '$hover' }}
      $platform-web={{ textDecoration: 'none' }}
    >
      <Wallet size={compact ? 12 : 13} color="var(--text-secondary)" aria-hidden />
      {!compact ? (
        <Text fontSize="$1" lineHeight={16} color="$aside" numberOfLines={1}>
          {t('Credits')}
        </Text>
      ) : null}
      <Text fontSize="$1" lineHeight={16} fontWeight="600" color="$ink" fontVariant={['tabular-nums']} numberOfLines={1}>
        {balance}
      </Text>
      {!compact ? (
        <XStack
          height={20}
          px="$1.5"
          gap="$0.5"
          rounded="$2"
          items="center"
          bg="$raised"
          borderWidth={1}
          borderColor="$edge"
        >
          <Plus size={11} color="var(--foreground)" aria-hidden />
          <Text fontSize="$1" lineHeight={15} fontWeight="500" color="$ink" numberOfLines={1}>
            {t('Add funds')}
          </Text>
        </XStack>
      ) : null}
    </XStack>
  )
}
