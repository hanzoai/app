/**
 * The apps that draw inside the Hanzo app: one table, derived from the apps in
 * beta (lib/betas) that name an `embed`, so an app is listed once.
 *
 * Each stays a standalone app on a host of its own and deploys on its own. The
 * pane at /apps/<id> frames that live host (`frame`), so a deploy of the
 * standalone app reaches hanzo.ai with no release of this package. `?embed=1`
 * asks the standalone app to leave out its own wordmark and sidebar once it
 * knows the flag; an app that does not still works, in its own chrome.
 *
 * Whether a reader may open one is `opens` (lib/betas), the one predicate; this
 * table says only what there is to open and where.
 */

import { ChartColumn, ContactRound, Newspaper, ShoppingCart, Sparkles, Telescope, type LucideIcon } from 'lucide-react'
import { BETAS, key, type Embed } from './betas'

export interface Hosted {
  /** The app's id: `beta.<id>` is its switch, and /apps/<id> its address. */
  id: string
  name: string
  /** Its standalone host, `crm.hanzo.ai`. */
  host: string
  /** Where it opens on its own: the host and the page it starts on. */
  href: string
  icon: LucideIcon
  /** The principal switch, `beta.<id>`. */
  flag: string
  /** How it is drawn: a frame of its live host today; a row may name a module instead. */
  embed: Embed
}

const ICON: Record<string, LucideIcon> = {
  crm: ContactRound,
  commerce: ShoppingCart,
  cms: Newspaper,
  analytics: ChartColumn,
  insights: Telescope,
}

/** The apps that draw inside the app, in the order the list holds them. */
export const HOSTED_APPS: readonly Hosted[] = BETAS.flatMap((b) =>
  b.embed !== undefined && b.href ? [{ id: b.id, name: b.name, host: new URL(b.href).host, href: b.href, icon: ICON[b.id] ?? Sparkles, flag: key(b.id), embed: b.embed }] : [],
)

/** One hosted app by id. */
export const hostedApp = (id: string): Hosted | undefined => HOSTED_APPS.find((a) => a.id === id)

/** The origin of an app's host, the only one a frame of it speaks to and hears from. */
export const origin = (app: Hosted): string => new URL(app.href).origin

/**
 * The address the frame loads: the app's own page (`app.href`), or `at`, a path
 * on the same host the reader was last on, with `embed=1` on it. A path that
 * names another host or is not a path is the start page.
 */
export function frameUrl(app: Hosted, at?: string | null): string {
  const base = new URL(app.href)
  if (at && at.startsWith('/') && !at.startsWith('//')) {
    const to = new URL(at, base.origin)
    if (to.origin === base.origin) return withEmbed(to)
  }
  return withEmbed(base)
}

function withEmbed(url: URL): string {
  url.searchParams.set('embed', '1')
  return url.toString()
}

/** The path and query of an address on the app's own host, without `embed`, or null when it is on another. */
export function pathOn(app: Hosted, href: string): string | null {
  try {
    const to = new URL(href, origin(app))
    if (to.origin !== origin(app)) return null
    to.searchParams.delete('embed')
    return `${to.pathname}${to.search}`
  } catch {
    return null
  }
}
