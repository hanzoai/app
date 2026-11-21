/**
 * THE ONE WAY OUT of the app's page: every document load, new tab or popup the
 * app starts goes through here (outward.test.ts fails on any other).
 *
 * In a browser tab nothing changes: an address loads in this tab, or opens a
 * tab of its own. A window of its own (App's `bar`: Hanzo Desktop) has no
 * browser around it, so a document load to another origin would replace the
 * app with a website and leave the person no way back, and `window.open` opens
 * nothing at all there. App hands this module the host's router while it is
 * such a window (`windowed`), and every outside address, and every new tab,
 * goes to that router: the desktop opens another origin in the system browser
 * and moves to one of its own addresses in place.
 *
 * A plain module, not React context, because the callers that leave are plain
 * modules too (sign-in, checkout, accounts) and run outside any component.
 */

type Open = (href: string) => void

let host: Open | null = null
// A host router that itself leaves (App's own default, with no Host) comes back
// here; the second time through it loads the page rather than going round.
let handing = false

/** App, while it is a window of its own: outside addresses go to `open`. Returns the undo. */
export function windowed(open: Open): () => void {
  host = open
  return () => {
    if (host === open) host = null
  }
}

/** Whether `href` is on another origin than this page. */
function foreign(href: string): boolean {
  try {
    return new URL(href, window.location.href).origin !== window.location.origin
  } catch {
    return false
  }
}

/** The schemes the way out takes: a page, or a mail. A relative address is this page's own scheme. */
const SAFE = new Set(['http:', 'https:', 'mailto:'])

/** Whether `href` is an address the way out may take: never `javascript:`, `data:`, `file:` or an app's scheme. */
export function safe(href: string): boolean {
  try {
    // A relative address takes this page's scheme; read against any http base when the page names none.
    return SAFE.has(new URL(href, window.location?.href || 'http://localhost/').protocol)
  } catch {
    return false
  }
}

/**
 * Go to `href`: in this page (`'assign'`, a history entry; `'replace'`, in place
 * of this one) or in a tab of its own (`'tab'`). In a window of its own, another
 * origin, or any new tab, is the host's to open instead.
 */
export function outward(href: string, how: 'assign' | 'replace' | 'tab' = 'assign'): void {
  // An address from a page, a link or a server is never run as script here, nor handed on.
  if (typeof window === 'undefined' || !safe(href)) return
  if (host && !handing && (how === 'tab' || foreign(href))) {
    handing = true
    try {
      return host(href)
    } finally {
      handing = false
    }
  }
  if (how === 'tab') window.open(href, '_blank', 'noopener,noreferrer')
  else if (how === 'replace') window.location.replace(href)
  else window.location.assign(href)
}

/**
 * A sign-in popup the caller watches (OAuth). Blocked, the address opens in a
 * tab instead and the answer arrives through the site's callback; in a window
 * of its own it opens in the host's browser. Null whenever there is no popup to watch.
 */
export function openPopup(href: string, name: string, features: string): Window | null {
  if (typeof window === 'undefined' || !safe(href)) return null
  if (host) {
    outward(href, 'tab')
    return null
  }
  const opened = window.open(href, name, features)
  if (!opened) outward(href, 'tab')
  return opened
}
