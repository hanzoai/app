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

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { IAM } from '@hanzo/iam'
import { useIam } from '@hanzo/iam/react'
import { useSignOut as useUiSignOut } from '@hanzo/ui/auth'
import { track } from './tags'
import { answers, SIGNIN } from './host'
import { where } from '../where'
import { unfinished } from './unfinished'
import { outward } from './outward'

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
 * How long the host's leaving is waited for. Hanzo Desktop revokes the sign-in
 * over the network, and offline that could hang: Log out would then do nothing.
 */
export const PATIENCE = 5000

/**
 * Whether `work` finished within `ms`: false when it failed or is still running.
 * The one wait a sign-out has, for the host's step and for IAM's calls alike.
 */
export async function settles(work: Promise<unknown>, ms: number = PATIENCE): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<false>((done) => (timer = setTimeout(() => done(false), ms)))
  try {
    return await Promise.race([work.then(() => true as const), late])
  } catch (e) {
    console.error('sign-out step', e)
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Whether a sign-out is under way: set until both its finish and the host's leaving have settled. */
let held = false
const heard = new Set<() => void>()
const hold = (on: boolean) => {
  held = on
  heard.forEach((f) => f())
}

/**
 * Whether a sign-out is under way, from the press until the page has moved: the
 * host's step can take seconds (Hanzo Desktop waits for the server), so every
 * sign-out control reads this to say "Signing out…" on the one pressed and to
 * stand disabled.
 */
export function useSigningOut(): boolean {
  return useSyncExternalStore(
    (f) => (heard.add(f), () => void heard.delete(f)),
    () => held,
    () => false,
  )
}

/**
 * THE ONE SIGN-OUT. Every sign-out the person chooses (Log out, Sign out of all
 * accounts, the palette's Log out, Sign out <name> on the account in use) runs
 * through here, so its order cannot drift: the host's own leaving
 * (`configure({ signOut })`), waited for `PATIENCE` at most, then `finish` —
 * IAM's session ended, the tab cleared, the page moved — whatever IAM answers;
 * and Google One Tap told not to sign the person straight back in.
 * A leaving that failed or ran late is said on the page the sign-out moves to
 * (`unfinished`). Never on a token that expired or a refresh that was refused.
 *
 * One at a time: a press while one runs is ignored (false). The lock is held
 * until the host's leaving SETTLES, not only until the wait gives up on it, so a
 * late leaving never overlaps the next sign-out's.
 */
export async function signingOut(finish: () => Promise<void>): Promise<boolean> {
  if (held) return false
  hold(true)
  // Google One Tap signs a returning person in on its own (`auto_select`), which
  // would put them straight back in the account they just left. Leaving says so.
  ;(window as unknown as { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } }).google?.accounts?.id?.disableAutoSelect?.()
  const own = where().signOut
  // Started inside a promise, so a host step that throws at once is a failure like any other.
  const step: Promise<void> = own ? Promise.resolve().then(own) : Promise.resolve()
  const flow = (async () => {
    if (!(await settles(step))) unfinished()
    await finish()
  })()
  void Promise.allSettled([step, flow]).then(() => hold(false))
  await flow
  return true
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
    await signingOut(async () => {
      // IAM's calls inside @hanzo/ui's sign-out take no signal, and offline they can hang. The
      // tokens are cleared before them, so this device is signed out already: past `PATIENCE`
      // the page moves to `to` without waiting for IAM's answer.
      if (!(await settles(signOut()))) outward(to)
    })
  }, [signOut, to])
}
