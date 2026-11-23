'use client'

import { useState } from 'react'
import { phrase } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { PhoneCall, ShieldAlert, UserCheck } from 'lucide-react'
import { Box, Button, Separator, Switch, Text, XStack, YStack } from '@hanzo/ui'
import { emergencyStopOn, refuseOutbound, saveEmergencyStop } from './lib/cloudControl'

/**
 * Settings → Cloud control.
 *
 * Emergency stop: one switch. While it is on, outbound calls, texts and AI are
 * refused on this client (lib/cloudControl `refuseOutbound`), and the flag is
 * saved to the account so it follows the reader to every surface.
 */

export function CloudControlPane() {
  const { t } = useI18n()
  const [on, setOn] = useState<boolean>(emergencyStopOn())
  const [saved, setSaved] = useState(false)

  const stop = async (next: boolean) => {
    setOn(next)
    await saveEmergencyStop(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <YStack gap="$5" maxW={560}>
      <XStack items="center" gap="$2">
        <ShieldAlert size={18} aria-hidden />
        <Text fontSize="$4" fontWeight="600" color="$ink">
          {t('Cloud control')}
        </Text>
      </XStack>
      <Text fontSize="$2" color="$soft">
        {t('Stop outbound calls, texts and AI across every surface you are signed in to.')}
      </Text>

      <Separator />

      <XStack items="center" justify="space-between" gap="$3">
        <YStack flex={1} pr="$2">
          <Text fontSize="$3" fontWeight="600" color="$ink">
            {t('Emergency stop')}
          </Text>
          <Text fontSize="$2" color="$soft">
            {t('Refuses outbound calls, texts and AI while on. Saved to your account.')}
          </Text>
        </YStack>
        <Switch
          aria-label={t('Emergency stop')}
          checked={on}
          onCheckedChange={stop}
          disabled={false}
        />
      </XStack>
      {saved ? (
        <Text fontSize="$1" color="$soft" data-slot="cloud-saved">
          {t('Saved')}
        </Text>
      ) : null}

      <Separator />

      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="600" color="$ink">
          {t('What stops')}
        </Text>
        {[
          { id: 'call', title: t('Outbound calls'), icon: <PhoneCall size={13} aria-hidden /> },
          { id: 'text', title: t('Outbound texts'), icon: <UserCheck size={13} aria-hidden /> },
          { id: 'ai', title: t('Outbound AI'), icon: <ShieldAlert size={13} aria-hidden /> },
        ].map((row) => (
          <XStack key={row.id} items="center" gap="$2" p="$2" rounded="$2" borderWidth={1} borderColor="$borderColor">
            {row.icon}
            <Text fontSize="$2" color="$ink">
              {row.title}
            </Text>
            <Text fontSize="$1" color="$soft">
              {t(refuseOutbound(row.id as any) ? 'Refused while emergency stop is on.' : 'Allowed.')}
            </Text>
          </XStack>
        ))}
      </YStack>

      <Separator />

      <XStack self="flex-start">
        <Button size="sm" onClick={() => void stop(false)} disabled={!on}>
          {t('Turn emergency stop off')}
        </Button>
      </XStack>
    </YStack>
  )
}
