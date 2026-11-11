'use client'

/**
 * IAM, called from this page. The embedded sign-in, the silent check for a
 * session and sign-out all go through `useClient`, whose credential calls are
 * answered on this origin where it answers them (universe static-sites
 * `iam-on-hanzo-ai`): that is also where IAM keeps its session cookie, so the
 * session a person signs in with here is the one a later visit finds, and the
 * one sign-out ends. Nobody is sent to hanzo.id to sign in; a plain sign-out
 * passes through its end-session page on the way out (`useSignOut`).
 */

import { useCallback, useMemo } from 'react'
import { IAM } from '@hanzo/iam'
import { useIam } from '@hanzo/iam/react'
import { useSignOut as useUiSignOut } from '@hanzo/ui/auth'
import { track } from './tags'
import { answers, SIGNIN } from './host'
import { where } from '../where'

/**
 * Whether the page in front of us is on an origin that answers IAM itself: one of
 * the Hanzo hosts (`answers` in host.ts) or one the host states with
 * `configure({ answers })` (where.ts).
 */
export const here = (): boolean => typeof window !== 'undefined' && (answers(window.location.hostname) || where().answers?.(window.location.hostname) === true)

/** The IAM client for this page; the token exchange at the callback shares its PKCE store. */
export function useClient(): IAM {
  const { config } = useIam()
  const local = here()
  return useMemo(() => new IAM(local ? { ...config, proxyBaseUrl: window.location.origin } : config), [config, local])
}

/** This site's sign-in after a sign-out, which does not ask IAM for the session just ended. */
export const OUT = '/login?from=logout'

/**
 * Where a plain sign-out lands: this site's home page. Every host this export is
 * served on (hanzo.ai, hanzo.app, hanzo.bot) has a marketing page there, and a
 * person who signed out is brought back to it rather than to a sign-in form. IAM
 * returns the browser to it when the client registered it (universe
 * iam-provision.yaml); otherwise it lands on hanzo.ai/login.
 */
export const HOME = '/'

/** A dev server on this machine, which keeps its sign-out local. */
const loopback = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost')

/**
 * The end-session page a sign-out everywhere leaves through: hanzo.ai's, the
 * origin every Hanzo site signs in on and so the one holding the person's session.
 * IAM ends the session there and walks the issuer's other sign-in origins
 * (hanzo.id, hanzo.market) by the request's own Host, so the page has to be one of
 * them: the configured `serverUrl` (api.hanzo.ai, where the token calls go) is
 * none, and an end-session there ends nothing past it. A brand with an issuer of
 * its own ends on that issuer; a dev server on this machine ends here ('').
 */
export function endsAt(serverUrl: string, hostname: string): string {
  if (loopback(hostname)) return ''
  try {
    const host = new URL(serverUrl).hostname
    if (host === 'api.hanzo.ai' || host === 'hanzo.id' || host === 'hanzo.ai') return SIGNIN
  } catch {
    return ''
  }
  return serverUrl
}

/**
 * Sign-out on this site: @hanzo/ui/auth's `signOut` — the tokens handed back to
 * IAM's /v1/iam routes, IAM's session here ended, the local session cleared —
 * counted as logout_completed, and then this site's home page (or `to`: the
 * account chooser, which signs everyone out and stays on the request it was drawn
 * for).
 *
 * EVERY HANZO SITE AT ONCE (`everywhere`). hanzo.ai and platform.hanzo.ai sign in
 * from one session, so leaving one of them must leave the other: IAM retires the
 * person's grant to every application of this client's organization along with
 * the session. A third-party app the person signed into keeps its own.
 *
 * AND EVERY SIGN-IN ORIGIN (D3). A plain sign-out ends through hanzo.ai's
 * end-session page (`endsAt`, passed to @hanzo/ui 8.31 as `issuer`), which ends
 * the session there and on hanzo.id and hanzo.market too, as well as this
 * origin's. A sign-out with its own `to` is the account chooser's, which must stay
 * on the request in flight, so it ends here only (an empty issuer).
 */
export function useSignOut(to: string = HOME): () => Promise<void> {
  const { config } = useIam()
  const plain = to === HOME || to === OUT
  const issuer = plain && typeof window !== 'undefined' ? endsAt(config.serverUrl, window.location.hostname) : ''
  const signOut: () => Promise<void> = useUiSignOut({ to, track, everywhere: true, issuer })
  return useCallback(async () => {
    // Google One Tap signs a returning person in on its own (`auto_select`), which
    // would put them straight back in the account they just left. Leaving says so.
    ;(window as unknown as { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } }).google?.accounts?.id?.disableAutoSelect?.()
    await signOut()
  }, [signOut])
}
