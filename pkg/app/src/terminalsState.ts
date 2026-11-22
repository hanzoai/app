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

/** The event to send the Workspace after the page started a cloud machine:
 *  null for none, 'wait' until the new machine is listed with its screen.
 *  The Workspace opens a default shell on the first live machine it is mounted
 *  with, which is the new one, so asking for a shell as well opened two panes
 *  for one click. A browser or desktop is asked for as that machine's SCREEN: a
 *  'page' event, or a 'desktop' one naming a machine the Workspace does not list
 *  yet, makes the Workspace start ANOTHER machine, so one click leased two. */
export function followUp(
  a: { kind: 'shell' | 'page' | 'desktop'; machine: string },
  live: readonly { machine: string; screen?: unknown }[],
): { kind: 'desktop'; machine: string } | null | 'wait' {
  if (a.kind === 'shell') return null
  return live.some((h) => h.machine === a.machine && h.screen) ? { kind: 'desktop', machine: a.machine } : 'wait'
}

/** Whether the page itself answers a sidebar's Tabs action: only while no
 *  Workspace is drawn. Once one is (the machines read, or failed to), the
 *  Workspace hears the same event, and both answering leased two machines. */
export const answersActions = (s: { calm: boolean; read: boolean; error: boolean }): boolean => s.calm || !(s.read || s.error)
