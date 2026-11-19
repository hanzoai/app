'use client'

import { useI18n } from '@hanzo/i18n/react'
import { Text, XStack } from '@hanzo/gui'

/** What marks the page's main area: `Split` spreads it on its pane and the skip link points at it, so the two cannot part. */
export const MAIN = { id: 'main-content', tabIndex: -1, render: 'main' } as const

/** The first stop for the keyboard: out of the sidebar and into the page (`Split` draws `#main-content`). Off screen until focused. */
export function SkipLink() {
  const { t } = useI18n()
  return (
    <XStack
      render={<a href={`#${MAIN.id}`} />}
      data-slot="skip-link"
      position="fixed"
      t={-80}
      l={12}
      z="var(--z-notification)"
      px="$3"
      py="$2"
      minH={44}
      items="center"
      rounded="$3"
      bg="var(--popover)"
      borderWidth={1}
      borderColor="var(--border-strong)"
      boxShadow="var(--shadow-floating)"
      focusStyle={{ t: 12 }}
      focusVisibleStyle={{ t: 12, outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
    >
      <Text fontSize="$2" fontWeight="600" color="$ink">
        {t('Skip to main content')}
      </Text>
    </XStack>
  )
}
