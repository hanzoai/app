/**
 * The way out of the app's page for the callers that use it (sign-in, checkout,
 * accounts, Chat): an address loads in this page, or opens a tab of its own.
 * Many other places still call `window.location.assign` or `window.open` directly.
 *
 * A plain module, not React context, because the callers that leave are plain
 * modules too and run outside any component.
 */

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
 * of this one) or in a tab of its own (`'tab'`).
 */
export function outward(href: string, how: 'assign' | 'replace' | 'tab' = 'assign'): void {
  // An address from a page, a link or a server is never run as script here, nor handed on.
  if (typeof window === 'undefined' || !safe(href)) return
  if (how === 'tab') window.open(href, '_blank', 'noopener,noreferrer')
  else if (how === 'replace') window.location.replace(href)
  else window.location.assign(href)
}
