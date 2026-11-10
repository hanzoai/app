'use client'

// Tabs in the app: the terminals on the reader's linked machines and sandboxes,
// tiled (@hanzo/tabs `Workspace`), wired by `useFleet` with the reader's own
// bearer against this host's cloud. The workspace holds no token; the fleet
// mints each pane's address. hanzo.ai/tabs draws it for a signed-in reader, the
// way /studio draws Studio.

import { useEffect } from 'react'
import { Text, YStack } from '@hanzo/gui'
import { useFleet, Workspace } from '@hanzo/tabs'
import { useI18n } from '@hanzo/i18n/react'
import { api } from './lib/api'
import { bearer } from './lib/session'

export default function Terminals() {
  const { t } = useI18n()
  const token = bearer()
  const fleet = useFleet(token, api())
  useEffect(() => {
    if (typeof window === 'undefined' || !fleet.read) return
    try {
      const lite = fleet.hosts
        .filter((h) => (h.base || h.sandbox) && h.status !== 'offline')
        .map((h) => ({ machine: h.machine, label: h.label, status: h.status, desktop: Boolean(h.screen) }))
      window.localStorage.setItem('hanzo.tabs.fleet', JSON.stringify(lite))
      window.dispatchEvent(new CustomEvent('hanzo:tabs-fleet', { detail: lite }))
    } catch {
      // ignore storage errors
    }
  }, [fleet.hosts, fleet.read])
  return (
    <YStack data-slot="terminals" flex={1} minH={0} minW={0}>
      {fleet.error ? (
        <Text role="alert" px="$4" py="$2" fontSize="$2" color="$soft">
          {t('The machines could not be read: {error}', { error: fleet.error })}
        </Text>
      ) : null}
      {fleet.read || fleet.error || !token ? (
        <Workspace hosts={fleet.hosts} mint={fleet.mint} onLaunch={fleet.launch} agent={fleet.agent} />
      ) : (
        <YStack flex={1} items="center" justify="center">
          <Text fontSize="$2" color="$soft">
            {t('Reading your machines…')}
          </Text>
        </YStack>
      )}
    </YStack>
  )
}
