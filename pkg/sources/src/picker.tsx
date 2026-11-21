'use client'

// The account picker: the model/provider picker's contract for Hanzo's own
// accounts. It lists the Hanzo cell and every account the person has, those
// usable on this surface first and the rest greyed with their reason, and calls
// `onPick` with the account and its route: `{via:"desktop", source, instance}`
// for a login on another device, `{via:"key", account}` for a key, `{via:"cell"}`
// for the default. A login on this very device returns `choice: null`: the host
// runs it itself.

import { useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { Text, YStack } from '@hanzo/ui'
import { Accounts, type Picked } from './accounts'
import type { Client } from './client'
import { useRead } from './data'
import type { Choice, Surface } from './types'
import { Failed, Loading, SIGN_IN, SignedOut } from './view'

export type { Picked }

export interface AccountPickerProps {
  client: Client
  surface: Surface
  deviceId?: string
  onPick: (pick: Picked) => void
  /** The route in use; the Hanzo cell when none. */
  selected?: Choice | null
  signIn?: string
}

export function AccountPicker({ client, surface, deviceId, onPick, selected, signIn = SIGN_IN }: AccountPickerProps) {
  const { t } = useI18n()
  const [bump, setBump] = useState(0)
  const read = useRead(client, 7, bump, false)
  if (!client.signedIn()) return <SignedOut href={signIn} />
  if (read.is === 'loading') return <Loading />
  if (read.is === 'error') return <Failed status={read.status} onRetry={() => setBump((n) => n + 1)} signIn={signIn} />
  return (
    <YStack gap="$2" data-slot="picker">
      <Accounts accounts={read.accounts} sources={read.sources} usage={read.provider} surface={surface} deviceId={deviceId} now={read.at} selected={selected} onPick={onPick} />
      {read.accounts.length === 0 ? <Text fontSize="$2" color="$aside">{t('No provider accounts yet. Link the Hanzo Dev desktop app to bring your logins here.')}</Text> : null}
    </YStack>
  )
}
