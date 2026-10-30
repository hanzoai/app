'use client'

// Tabs in the app: the terminals on the reader's linked machines and sandboxes,
// tiled (@hanzo/tabs `Workspace`), wired by `useFleet` with the reader's own
// bearer against this host's cloud. The workspace holds no token; the fleet
// mints each pane's address. hanzo.ai/tabs draws it for a signed-in reader, the
// way /studio draws Studio.

import { Text, YStack } from '@hanzo/gui'
import { useFleet, Workspace } from '@hanzo/tabs'
import { useI18n } from '@hanzo/i18n/react'
import { api } from './lib/api'
import { bearer } from './lib/session'

export default function Terminals() {
  const { t } = useI18n()
  const fleet = useFleet(bearer(), api())
  return (
    <YStack data-slot="terminals" flex={1} minH={0} minW={0}>
      {fleet.error ? (
        <Text role="alert" px="$4" py="$2" fontSize="$2" color="$soft">
          {t('The machines could not be read: {error}', { error: fleet.error })}
        </Text>
      ) : null}
      <Workspace hosts={fleet.hosts} mint={fleet.mint} onLaunch={fleet.launch} />
    </YStack>
  )
}
