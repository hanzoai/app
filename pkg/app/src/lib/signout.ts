'use client'

/**
 * IAM, called from this page. The embedded sign-in, the silent check for a
 * session and sign-out all go through `useClient`, whose credential calls are
 * answered on this origin where it answers them (universe static-sites
 * `iam-on-hanzo-ai`): that is also where IAM keeps its session cookie, so the
 * session a person signs in with here is the one a later visit finds, and the
 * one sign-out ends. Nobody is sent to hanzo.id for any of it.
 */

import { useCallback, useMemo } from 'react'
import { IAM } from '@hanzo/iam'
import { useIam } from '@hanzo/iam/react'
import { useSignOut as useUiSignOut } from '@hanzo/ui/auth'
import { track } from './tags'
import { answers } from './host'

/** Whether the page in front of us is on an origin that answers IAM itself (`answers` in host.ts). */
export const here = (): boolean => typeof window !== 'undefined' && answers(window.location.hostname)

/** The IAM client for this page; the token exchange at the callback shares its PKCE store. */
export function useClient(): IAM {
  const { config } = useIam()
  const local = here()
  return useMemo(() => new IAM(local ? { ...config, proxyBaseUrl: window.location.origin } : config), [config, local])
}

/** Where a sign-out lands: this site's sign-in, which does not ask IAM for the session just ended. */
export const OUT = '/login?from=logout'

/**
 * Sign-out on this site: @hanzo/ui/auth's `signOut` — the tokens handed back to
 * IAM's /v1/iam routes, IAM's session here ended, the local session cleared —
 * counted as logout_completed, and then /login?from=logout, where the person can
 * sign straight back in. IAM's own logout page is never visited.
 *
 * EVERY HANZO SITE AT ONCE (`everywhere`). hanzo.ai and platform.hanzo.ai sign in
 * from one session, so leaving one of them must leave the other: IAM retires the
 * person's grant to every application of this client's organization along with
 * the session. A third-party app the person signed into keeps its own.
 */
export function useSignOut(): () => Promise<void> {
  // @ts-expect-error everywhere option added in @hanzo/ui / IAM shared sign-out
  const signOut: () => Promise<void> = useUiSignOut({ to: OUT, track, everywhere: true })
  return useCallback(async () => {
    // Google One Tap signs a returning person in on its own (`auto_select`), which
    // would put them straight back in the account they just left. Leaving says so.
    ;(window as unknown as { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } }).google?.accounts?.id?.disableAutoSelect?.()
    await signOut()
  }, [signOut])
}
