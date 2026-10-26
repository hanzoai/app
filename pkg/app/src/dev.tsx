'use client'

// The web app's host: everything @hanzo/build's `<Builder>` needs from hanzo.ai,
// as values, so the builder imports neither IAM nor a router. hanzo.build's own
// host (hanzoai/build `src/app/root.tsx`) is the other one, and this answers
// each field the way that one does — who is signed in, the organizations they
// belong to and the one they work in, the theme, where the address is, and how
// to leave. The name drawn at the top left is Hanzo Dev: this host is the
// dev agent. Chat, on the rooms shell, is Hanzo AI.
//
// THE ADDRESS IS A PATH. Dev is /dev, and every place the builder shows is a
// path under it in the builder's real-path grammar (lib/host.ts `app`, `place`;
// @hanzo/build/route `href`, `parse`): a run, a screen, a Customize tab, the
// plans and a project all survive a reload, and Back steps through them. The
// host hands the rooms the path (`<Rooms path>`); a move is a native history
// entry, which the Next router folds into `usePathname`, so reading the address
// and moving it are one path.
//
// SETTINGS IS THE SITE'S, never Dev's: one tree at /settings, the host's own
// pages (lib/host.ts `settings`). A builder section the builder moves to
// (`go`) and a link it opens (`open`) reach that page through the host's router
// (`visit`); a pane that asks for Settings (`showSettings`, open.ts) is App's to
// answer, where the phone's menu is. The rooms' shell draws its own Settings
// pane; the app has none.
//
// THE PLANS ARE THE PAY SITE'S. Every way the app reaches the plans — the
// account menu's View all plans and its plan's Upgrade, Billing's Adjust plan,
// an automation's See plans — names the builder's plans address, and `go`
// leaves for the pay site's plans there (`leave`), for the organization in use,
// coming back once paid. A typed or reloaded plans address leaves the same way
// (App.tsx). A page load, at once, not a move inside the app: the pay site is
// where a plan is bought.

import { useMemo } from 'react'
import { useLook, useRooms } from './host'
import { useIam } from '@hanzo/iam/react'
import { useSignOut } from './lib/signout'
import { administers, path, route, type Host } from '@hanzo/build'
import { bearer, named, org, orgs, pick } from './lib/session'
import { enter } from './lib/destination'
import { api } from './lib/api'
import { CAST } from './agents'
import { app, place, settings, visit } from './lib/host'
import { link } from './lib/tags'
import { payUrl } from './lib/pay'
import { useChatPreferences } from './lib/chatPreferences'

/** Where the builder links out: every one of them an address of this site. */
const LINKS: Host['links'] = {
  github: app('-/sync'),
  customize: app('-/customize'),
  settings: settings(),
  home: '/',
}

/** The builder's address for the plans. */
const PLANS = path({ kind: 'screen', screen: 'plans' })

/** Whether a builder address names the plans. */
export const isPlans = (to: string): boolean => path(route(to)) === PLANS

/**
 * Leaves for the plans on the pay site (`/pay/cart`), for the organization in
 * use. `from` is the page to come back to once paid: this one, or Dev when the
 * address itself named the plans, which is replaced rather than returned to so
 * Back and the pay site's return both land in the app.
 */
export function leave(from: 'here' | 'app'): void {
  const back = from === 'here' ? window.location.href : `${window.location.origin}${app('')}`
  const to = payUrl('/cart', { org: org(), returnUrl: back })
  if (from === 'here') window.location.assign(to)
  else window.location.replace(to)
}

/** The person's theme, when they have chosen one the builder can name. */
const theme = (t: string | undefined): Host['theme'] => (t === 'light' || t === 'dark' || t === 'system' ? t : undefined)

/** The builder address a pathname names: Dev's place, or New for a path that is not Dev's. */
const at = (pathname: string | null): string => {
  const p = pathname ? place(pathname) : null
  return p?.mode === 'dev' ? p.at : ''
}

/** The host for a signed-in reader. */
export function useDevHost(): Host {
  const { user, accessToken } = useIam()
  const logout = useSignOut()
  const { router, path: pathname } = useRooms()
  const here = path(route(at(pathname)))
  const look = useLook()
  const [prefs] = useChatPreferences()

  // The token's claims change only when the token does: a sign-in, a refresh.
  const memberships = useMemo(() => orgs(), [accessToken]) // eslint-disable-line react-hooks/exhaustive-deps
  const scoped = useMemo(() => org(), [accessToken]) // eslint-disable-line react-hooks/exhaustive-deps
  const claimed = useMemo(() => named(), [accessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const u = user as { displayName?: string; name?: string; email?: string; avatar?: string } | null
  const name = u?.displayName || u?.name || claimed?.name || ''
  const email = u?.email || claimed?.email || ''
  const avatar = typeof u?.avatar === 'string' && u.avatar.startsWith('https://') ? u.avatar : ''

  return useMemo<Host>(
    () => ({
      name: 'Hanzo Dev',
      api: api(),
      token: bearer,
      org: scoped,
      memberships,
      // Scope this browser to one of the token's organizations and open Dev's
      // New in it: a run or a project read under the last one is not this one's.
      chooseOrg: (next) => {
        if (!orgs().includes(next)) return
        pick(next)
        window.location.assign(app(''))
      },
      theme: theme(look.pref.theme),
      chooseTheme: (t) => look.set({ theme: theme(t) }),
      person: { name, email, avatar },
      admin: administers(bearer(), scoped),
      path: here,
      go: (to, how) => (isPlans(to) ? leave('here') : visit(router, app(to), how?.replace)),
      links: LINKS,
      // The sidebar lists Settings' sections and Customize's tabs (Column.tsx), and Customize › Agents offers the cast.
      sections: true,
      // The model is named, and its picker offered, only where Settings' model selector is on (as in Chat).
      models: prefs.showModelSelector,
      cast: CAST,
      // An address of the app moves the app, another of this site moves in the
      // router, and another origin is left in this tab. platform.hanzo.ai is
      // another product, and a click that names it stays here — everything the
      // builder had it for is in its Settings.
      open: (href) => {
        let url: URL
        try {
          url = new URL(href, window.location.origin)
        } catch {
          return
        }
        if (url.hostname === 'platform.hanzo.ai') return
        const to = `${url.pathname}${url.search}${url.hash}`
        if (url.origin !== window.location.origin) window.location.assign(link(url.href))
        else visit(router, to)
      },
      signIn: () => enter(),
      signOut: () => void logout(),
    }),
    [scoped, memberships, look.pref.theme, look.set, prefs.showModelSelector, name, email, avatar, here, router, logout],
  )
}
