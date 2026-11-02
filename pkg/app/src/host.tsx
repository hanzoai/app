'use client'

/**
 * What a host tells the apps.
 *
 * The apps name no framework and no site. Everything that differs between the
 * surfaces that mount them arrives here, in two halves, because two kinds of
 * caller read them:
 *
 *   configure({ site: 'https://hanzo.ai', home: '/', signUp: '/start' })
 *
 *   <Host router={useRouter()} path={usePathname()} route={route} Link={Link}>
 *     <Shell mode="cal"><CalScheduler /></Shell>
 *   </Host>
 *
 * The ADDRESSES — where the app's pages live, which gateway and IAM to talk to,
 * the plan catalogue to paint first — do not change while the page is open, and
 * plain modules (`api()`, `iam()`, `site()`, the plan reads) call them outside
 * any component and on pages the apps never draw. So the host states them once
 * with `configure()`, in a module its root imports, before anything renders.
 *
 * The ROUTER, the path and the route change as the page moves, so they ride
 * React context, and an app reads them with `useHost()`. So does `upgrade`, a
 * host that draws its own plans in place of the checkout (`useUpgrade`).
 */

import { createContext, useCallback, useContext, type AnchorHTMLAttributes, type ComponentType, type ReactNode } from 'react'
import { useIam, useOrganizations } from '@hanzo/iam/react'
import { useAppearance } from '@hanzo/appearance'
import { api } from './lib/api'

/** A link the host's router owns: next/link under Next, an anchor elsewhere. */
export type Link = ComponentType<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }>

export interface Router {
  push(href: string): void
  replace(href: string): void
  back(): void
  forward(): void
}


interface Moving {
  router: Router
  /** The address's path, for the apps that read one (Dev's, under `/dev`). */
  path: string | null
  route: string
  Link: Link
  /**
   * The host's own plans, drawn in place: given, every upgrade press in the apps
   * calls it and leaves nothing (`useUpgrade`); absent, a press opens the
   * checkout. A stable function, as `router` is.
   */
  upgrade?: () => void
}

export interface HostProps extends Omit<Moving, 'path'> {
  /** Absent where no mounted app reads the path. */
  path?: string | null
  children?: ReactNode
}

const Plain: Link = ({ prefetch: _prefetch, ...rest }) => <a {...rest} />

const Context = createContext<Moving>({
  router: {
    push: (href) => window.location.assign(href),
    replace: (href) => window.location.replace(href),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
  },
  path: null,
  route: '/',
  Link: Plain,
})

/** The router, the route and the link the host mounted the apps with. */
export const useHost = (): Moving => useContext(Context)

/**
 * An upgrade press: the host's plans where it draws its own (`upgrade`), else
 * the checkout at `address` (lib/pay `payUrl`), in this tab, or in place of
 * this page with `replace`.
 */
export function useUpgrade(): (address: string, replace?: boolean) => void {
  const { upgrade } = useHost()
  return useCallback(
    (address: string, replace = false) => {
      if (upgrade) upgrade()
      else if (replace) window.location.replace(address)
      else window.location.assign(address)
    },
    [upgrade],
  )
}

/** The org in scope, by the id the appearance layers are keyed on. */
export function useOrg(): { id?: string; name?: string } {
  const { currentOrg } = useOrganizations()
  const one = currentOrg as { id?: string; name?: string; displayName?: string } | null
  return { id: one?.id || one?.name, name: one?.displayName || one?.name }
}

/**
 * The person's appearance — theme, type, spacing, corners, accent — resolved
 * for the org in scope and kept with their IAM account, so a choice made here
 * follows them to every Hanzo origin. Every control that changes how the apps
 * look goes through this, and only this.
 */
export function useLook() {
  const { accessToken } = useIam()
  const org = useOrg()
  // Signed out there is no person to ask about, so IAM is not asked: a stranger
  // passing through an app on the way to sign in sends nothing to the issuer.
  return useAppearance({
    org: org.id,
    account: accessToken ? { base: api(), token: accessToken } : undefined,
  })
}

/**
 * The look, applied: mounted once at the host's root, inside its IamProvider,
 * so every page — an app or not — opens in the person's theme and accent and
 * keeps their choice in step with IAM.
 */
export function Look() {
  useLook()
  return null
}

export function Host({ router, path = null, route, Link, upgrade, children }: HostProps) {
  return <Context.Provider value={{ router, path, route, Link, upgrade }}>{children}</Context.Provider>
}
