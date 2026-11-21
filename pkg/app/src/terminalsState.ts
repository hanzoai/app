/**
 * What the Tabs page shows before the Workspace, and what it still asks of the
 * Workspace once a machine it started is there. Pure, so the two are testable
 * without mounting the page.
 */

/** The signed-out / empty-machines screen. With no token the machine list never
 *  loads, so nothing else can ever replace the skeleton: opening a workspace
 *  earlier must not hide this. With a token, an opened workspace does. */
export function showCalmEmpty(s: { token: string | null; read: boolean; error: boolean; hosts: number; opened: boolean }): boolean {
  return !s.token || (s.read && !s.error && s.hosts === 0 && !s.opened)
}

/** Where @hanzo/tabs' Workspace keeps its layout (components/workspace.tsx `STORE_KEY`). */
export const LAYOUT = 'hanzo.tabs.layout.v1'

/**
 * Whether the Workspace will restore the saved layout `raw` rather than open a
 * default shell: it keeps a page pane (a url), and a shell or screen pane on a
 * machine in `live`, and opens the default shell only when no pane survives
 * (@hanzo/tabs components/workspace.tsx, the restore on mount).
 */
export function restores(raw: string | null, live: ReadonlySet<string>): boolean {
  try {
    const saved = raw ? (JSON.parse(raw) as { tree?: unknown; bind?: Record<string, { kind?: string; url?: string; machine?: string; shell?: { machine?: string } }> }) : null
    if (!saved?.tree || !saved.bind) return false
    return Object.values(saved.bind).some((b) =>
      b.kind === 'page' ? Boolean(b.url) : b.kind === 'shell' || b.kind === 'gone' ? live.has(b.shell?.machine ?? '') : b.kind === 'screen' ? live.has(b.machine ?? '') : false,
    )
  } catch {
    return false // a corrupt layout is no layout, as the Workspace reads it
  }
}

/** The event to send the Workspace after the page started a cloud machine, or
 *  null. With no saved layout to restore, the Workspace opens a default shell on
 *  the first live machine it is mounted with, which is the new one, so asking for
 *  a shell as well opened two panes (both "cloud-1 · shell-1") for one click.
 *  When it restores a layout (`restoring`, e.g. a browser pane) it opens no
 *  shell, so the shell is asked for: the person paid for a machine to get one. */
export function followUp(a: { kind: 'shell' | 'page' | 'desktop'; machine: string }, restoring = false) {
  return a.kind === 'shell' && !restoring ? null : a
}
