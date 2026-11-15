'use client'

import { useI18n } from '@hanzo/i18n/react'
import { useIam } from '@hanzo/iam/react'
import { Text, XStack } from '@hanzo/gui'
import { Plus, Wallet } from 'lucide-react'
import { cents } from './lib/org'
import { payPage } from './lib/pay'
import { org } from './lib/session'
import { useTier } from './lib/tier'

export function WalletPill({
  alwaysShow = false,
  compact = false,
}: {
  alwaysShow?: boolean
  compact?: boolean
}) {
  const { t } = useI18n()
  const { isAuthenticated } = useIam()
  const currentOrg = org()
  const { tier, wrong } = useTier(isAuthenticated && Boolean(currentOrg), currentOrg)

  if (!isAuthenticated) return null
  const hasBalance = typeof tier?.balance?.effectiveAvailable === 'number'
  if (!alwaysShow && !hasBalance) return null

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
      px={compact ? 9 : 11}
      gap={6}
      rounded={8}
      items="center"
      bg="var(--pane-fill, var(--card))"
      borderWidth={1}
      borderColor="var(--pane-edge, var(--border))"
      cursor="pointer"
      hoverStyle={{ bg: 'var(--muted)' }}
      $platform-web={{ textDecoration: 'none' }}
    >
      <Wallet size={compact ? 12.5 : 13.5} color="var(--muted-foreground)" aria-hidden />
      {!compact ? (
        <Text fontSize={12.5} lineHeight={16} color="var(--muted-foreground)" numberOfLines={1}>
          {t('Credits')}
        </Text>
      ) : null}
      <Text fontSize={12.5} lineHeight={16} fontWeight="600" color="var(--foreground)" numberOfLines={1}>
        {balance}
      </Text>
      {!compact ? (
        <XStack
          height={20}
          px={7}
          gap={3}
          rounded={6}
          items="center"
          bg="var(--secondary)"
          borderWidth={1}
          borderColor="var(--pane-edge, var(--border))"
        >
          <Plus size={11} color="var(--foreground)" aria-hidden />
          <Text fontSize={11.5} lineHeight={15} fontWeight="500" color="var(--foreground)" numberOfLines={1}>
            {t('Add funds')}
          </Text>
        </XStack>
      ) : null}
    </XStack>
  )
}
