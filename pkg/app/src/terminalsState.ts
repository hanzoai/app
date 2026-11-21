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
