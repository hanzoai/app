'use client'

// The General pane's switch for what is experimental (SettingsPane.tsx draws it
// under Look). Its own module so it is drawn and tested without the pane's world.

import { useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { useIam } from '@hanzo/iam/react'
import { Button, Switch, Text, XStack, YStack } from '@hanzo/ui'
import { getAdminBetaAll, hanzoAdmin, setAdminBetaAll } from './lib/betas'
import { CHANGED, opt, optin, type Optin } from './lib/optin'

/**
 * The opt-in to what is experimental (lib/optin): on, the reader gets every
 * public beta; their team or organization can turn it off for everyone in it,
 * and then the switch is held off with a note. Signed out there is nothing to
 * choose, so nothing is drawn.
 */
export function Experimental() {
  const { t } = useI18n()
  const { isAuthenticated, accessToken } = useIam()
  const [held, setHeld] = useState<Optin | null>(null)
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminAll, setAdminAll] = useState<'on' | 'off' | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setIsAdmin(false)
      return
    }
    const sync = () => {
      setIsAdmin(hanzoAdmin())
      setAdminAll(getAdminBetaAll())
    }
    sync()
    window.addEventListener(CHANGED, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(CHANGED, sync)
      window.removeEventListener('storage', sync)
    }
  }, [isAuthenticated, accessToken])

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
  const adminTitle = t('Enable all betas for this account')

  return (
    <YStack p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor" gap="$3" data-slot="optin">
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
      {isAdmin ? (
        <XStack items="center" justify="space-between" gap="$3" pt="$3" borderTopWidth={1} borderColor="$borderColor" flexWrap="wrap" data-slot="optin-admin">
          <YStack flex={1} minW={220} pr="$2">
            <Text fontSize="$3" fontWeight="600" color="$ink">
              {adminTitle}
            </Text>
            <Text fontSize="$2" color="$soft">
              {t('Hanzo / Admin: enable or disable all beta apps (including Studio and Flow) for your account')}
            </Text>
          </YStack>
          <XStack items="center" gap="$2">
            <Button size="sm" variant={adminAll === 'on' ? 'primary' : 'outline'} rounded={999} data-slot="beta-admin-enable-all" onPress={() => setAdminBetaAll('on')}>
              {t('Enable all')}
            </Button>
            <Button size="sm" variant={adminAll === 'off' ? 'primary' : 'outline'} rounded={999} data-slot="beta-admin-disable-all" onPress={() => setAdminBetaAll('off')}>
              {t('Disable all')}
            </Button>
            <Switch aria-label={adminTitle} checked={adminAll === 'on'} onCheckedChange={(on: boolean) => setAdminBetaAll(on ? 'on' : 'off')} />
          </XStack>
        </XStack>
      ) : null}
    </YStack>
  )
}
