'use client'

// Every shortcut, listed: ⌘/ or ? opens it, Esc closes it. The rows are the one keymap's
// (@hanzo/dev-core/keymap), so a rebinding shows here as it is.

import { useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { Dialog, DialogContent, DialogTitle, Text, XStack, YStack } from '@hanzo/ui'

type Keymap = typeof import('@hanzo/dev-core/keymap')

export function Shortcuts({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [km, setKm] = useState<Keymap | null>(null)
  useEffect(() => {
    let live = true
    void import('@hanzo/dev-core/keymap').then((m) => live && setKm(m))
    return () => {
      live = false
    }
  }, [])
  const groups = new Map<string, Array<{ label: string; keys: string }>>()
  for (const row of km?.KEYMAP_ROWS ?? []) {
    const keys = km!.shortcutFor(row.command)
    if (!keys) continue
    groups.set(row.group, [...(groups.get(row.group) ?? []), { label: t(row.label), keys }])
  }
  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent data-slot="shortcuts" maxW={640} p="$4" gap="$3">
        <DialogTitle fontSize="$5" fontWeight="600" color="$ink">
          {t('Keyboard shortcuts')}
        </DialogTitle>
        <XStack flexWrap="wrap" gap="$4">
          {[...groups].map(([group, rows]) => (
            <YStack key={group} minW={240} flex={1} gap="$1">
              <Text fontSize="$2" fontWeight="600" color="$soft">
                {t(group)}
              </Text>
              {rows.map((row) => (
                <XStack key={row.label} justify="space-between" gap="$3">
                  <Text fontSize="$3" color="$ink">
                    {row.label}
                  </Text>
                  <Text render="kbd" fontSize="$2" color="$soft">
                    {row.keys}
                  </Text>
                </XStack>
              ))}
            </YStack>
          ))}
        </XStack>
      </DialogContent>
    </Dialog>
  )
}
