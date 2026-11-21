'use client'

// The General pane's Developer mode switch (SettingsPane.tsx draws it under Look).
// Its own module so it is drawn and tested without the pane's world.

import { useI18n } from '@hanzo/i18n/react'
import { Switch, Text, XStack, YStack } from '@hanzo/ui'
import { useDevMode } from './lib/dev-mode'

/**
 * DEVELOPER MODE, where settings are looked for (hanzo-inc/app issue 321). Off,
 * Hanzo shows the result of a run; on, it shows the process: the terminal, the
 * commands it runs and each step. The same switch the account menu, ⌘K, ⌘⇧D and
 * a run's own menu hold, kept on this device.
 */
export function DeveloperMode() {
  const { t } = useI18n()
  const [on, set] = useDevMode()
  const title = t('Developer mode')
  return (
    <YStack p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor" gap="$3" data-slot="settings-dev-mode">
      <XStack items="center" justify="space-between" gap="$3">
        <YStack flex={1} pr="$2">
          <Text fontSize="$3" fontWeight="600" color="$ink">
            {title}
          </Text>
          <Text fontSize="$2" color="$soft">
            {t('Shows the process: the terminal, the commands Hanzo runs and each step. Off, Hanzo shows the result.')}
          </Text>
        </YStack>
        <Switch aria-label={title} checked={on} onCheckedChange={(next: boolean) => set(next)} />
      </XStack>
    </YStack>
  )
}
