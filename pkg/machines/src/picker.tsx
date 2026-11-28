'use client'

// The provider picker: lists the Hanzo cell and every provider account the
// person has, those usable on this surface first and the rest greyed with their
// reason, and calls `onPick` with the account and its route.

import { useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { Text, YStack } from '@hanzo/ui'
import { Accounts, type Picked } from './accounts'
import type { Client } from './client'
import { useRead } from './data'
import type { Choice, Surface } from './types'
import { Failed, Loading, SIGN_IN, SignedOut } from './view'

export type { Picked }

export interface ProviderPickerProps {
  client: Client
  surface: Surface
  deviceId?: string
  onPick: (pick: Picked) => void
  /** The route in use; the Hanzo cell when none. */
  selected?: Choice | null
  signIn?: string
}

export function ProviderPicker({ client, surface, deviceId, onPick, selected, signIn = SIGN_IN }: ProviderPickerProps) {
  const { t } = useI18n()
  const [bump, setBump] = useState(0)
  const read = useRead(client, 7, bump, false)
  if (!client.signedIn()) return <SignedOut href={signIn} />
  if (read.is === 'loading') return <Loading />
  if (read.is === 'error') return <Failed status={read.status} onRetry={() => setBump((n) => n + 1)} signIn={signIn} />
  return (
    <YStack gap="$2" data-slot="picker">
      <Accounts accounts={read.accounts} machines={read.machines} usage={read.provider} surface={surface} deviceId={deviceId} now={read.at} selected={selected} onPick={onPick} />
      {read.accounts.length === 0 ? <Text fontSize="$2" color="$aside">{t('No provider accounts yet. Link Hanzo Desktop to bring your logins here.')}</Text> : null}
    </YStack>
  )
}
