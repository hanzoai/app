'use client'

import { useEffect, useState } from 'react'
import { Button, Text, XStack, YStack } from '@hanzo/ui'
import { useI18n } from '@hanzo/i18n/react'

/** How long a wait goes before the page owns up that it is slow, ms. */
export const SLOW = 5000

/**
 * A page's loading line, in words: grey cards alone said nothing for 10 to 15 s
 * on Tabs. After `SLOW` it adds "Still loading" and, when the page can ask
 * again, Try again, which starts the wait over.
 */
export function Loading({ label, onRetry }: { label: string; onRetry?: () => void }) {
  const { t } = useI18n()
  const [slow, setSlow] = useState(false)
  const [tries, setTries] = useState(0)
  useEffect(() => {
    setSlow(false)
    const id = setTimeout(() => setSlow(true), SLOW)
    return () => clearTimeout(id)
  }, [tries])
  return (
    <YStack role="status" data-slot="loading" gap="$2">
      <Text fontSize="$5" fontWeight="600" color="$ink">
        {label}
      </Text>
      {slow ? (
        <XStack data-slot="loading-slow" items="center" gap="$2">
          <Text fontSize="$2" color="$soft">
            {t('Still loading')}
          </Text>
          {onRetry ? (
            <Button
              size="sm"
              variant="ghost"
              data-slot="loading-retry"
              onPress={() => {
                onRetry()
                setTries((n) => n + 1)
              }}
            >
              {t('Try again')}
            </Button>
          ) : null}
        </XStack>
      ) : null}
    </YStack>
  )
}
