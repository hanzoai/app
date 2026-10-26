'use client'

// The General pane's switch for what is experimental (SettingsPane.tsx draws it
// under Look). Its own module so it is drawn and tested without the pane's world.

import { useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { useIam } from '@hanzo/iam/react'
import { Switch, Text, XStack, YStack } from '@hanzo/ui'
import { opt, optin, type Optin } from './lib/optin'

/**
 * The opt-in to what is experimental (lib/optin): on, the reader gets every
 * public beta; their team or organization can turn it off for everyone in it,
 * and then the switch is held off with a note. Signed out there is nothing to
 * choose, so nothing is drawn.
 */
export function Experimental() {
  const { t } = useI18n()
  const { isAuthenticated } = useIam()
  const [held, setHeld] = useState<Optin | null>(null)
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    let live = true
    optin()
      .then((o) => live && setHeld(o))
      .catch((e: unknown) => live && setWrong(e instanceof Error ? e.message : String(e)))
    return () => {
      live = false
    }
  }, [isAuthenticated])

  if (!isAuthenticated) return null
  const blocked = held?.blocked === true
  const title = t('Automatically opt-in for future experimental features')

  return (
    <YStack p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor" gap="$2" data-slot="optin">
      <XStack items="center" justify="space-between" gap="$3">
        <YStack flex={1} pr="$2">
          <Text fontSize="$3" fontWeight="600" color="$ink">
            {title}
          </Text>
          <Text fontSize="$2" color="$soft">
            {t('Automatically opt into new experimental features, unless disabled by your team or organization')}
          </Text>
        </YStack>
        <Switch
          aria-label={title}
          checked={held?.on === true && !blocked}
          disabled={!held || busy || blocked}
          onCheckedChange={(on: boolean) => {
            setBusy(true)
            setWrong(null)
            opt(on)
              .then(setHeld)
              .catch((e: unknown) => setWrong(e instanceof Error ? e.message : String(e)))
              .finally(() => setBusy(false))
          }}
        />
      </XStack>
      {blocked ? (
        <Text fontSize="$2" color="$soft" data-slot="optin-blocked">
          {t('Turned off by your team or organization.')}
        </Text>
      ) : null}
      {wrong ? (
        <Text fontSize="$2" color="$red10">
          {t(wrong)}
        </Text>
      ) : null}
    </YStack>
  )
}
