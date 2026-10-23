'use client'

// Support mode: a SuperAdmin steps into any organization to see what it sees.
//
// Everything here is IAM's. The list of every organization is the chooser's
// (Orgs.tsx `Everyone`), IAM's organization list, which answers a SuperAdmin
// every organization and anyone else only their own; the step in and the step
// out are IAM's `assume` and `release`, which answer the operator's own token
// re-scoped and record each step in the organization's audit log
// (lib/session.ts `support`). This file draws the strip that says so while it
// lasts; nothing here decides who may.

import { useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { Text, XStack } from '@hanzo/gui'
import { Button } from '@hanzo/ui'
import { useHydrated } from './lib/hydrated'
import { abandon, assumed, named, support } from './lib/session'

/** The banner rides above the room's sheets. gui carries a `calc()` to the page unchanged; its types only name custom properties. */
const BANNER = 'calc(var(--z-modal) + 30)' as `var(--${string})`

/**
 * The strip across the top of every page while a SuperAdmin is inside an
 * organization that is not theirs: which one, as whom, and the way out. It reads
 * the token's `assumed` claim, so it is there exactly as long as IAM's re-scoped
 * token is.
 */
export function SupportBanner() {
  const { t } = useI18n()
  const hydrated = useHydrated()
  const [org, setOrg] = useState<string | null>(null)
  const [who, setWho] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    setOrg(assumed())
    setWho(named()?.email || named()?.name || '')
  }, [hydrated])

  if (!org) return null
  // Leaving asks IAM to release. When IAM cannot answer, the way out is the
  // person's own session: the SDK's next refresh assumes nothing.
  const leave = () => {
    setBusy(true)
    support(null).catch(() => abandon())
  }
  return (
    <XStack
      role="status"
      aria-label={t('Support mode')}
      position="fixed"
      t={52}
      l="50%"
      x="-50%"
      maxW="calc(100vw - 32px)"
      z={BANNER}
      items="center"
      justify="center"
      gap={12}
      flexWrap="wrap"
      pt={6}
      paddingInlineEnd={8}
      pb={6}
      paddingInlineStart={16}
      rounded={999}
      bg="var(--foreground)"
    >
      <Text fontSize="$2" color="var(--background)">
        {who
          ? t('Support mode: you are in {org} as {who}. IAM records it under your name.', { org: <strong>{org}</strong>, who })
          : t('Support mode: you are in {org}. IAM records it under your name.', { org: <strong>{org}</strong> })}
      </Text>
      <Button size="sm" onClick={leave} disabled={busy}>
        {t(busy ? 'Leaving' : 'Leave')}
      </Button>
    </XStack>
  )
}
