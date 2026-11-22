// A plain module, so the package entry can export it without loading the apps.
/**
 * Ask the Tabs workspace for something, the one way a host does: a shell, desktop, page or cloud
 * machine, `focus` a pane, or, once the host states `tabs.shortcuts`, `split` (with `dir`, `row` or
 * `col`) and `close` (`res.handled` says whether a pane answered).
 */
export function dispatchTabsAction(detail: {
  kind: string
  id?: string
  machine?: string
  dir?: 'row' | 'col'
  res?: { handled: boolean }
}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('hanzo:tabs-action', { detail }))
}
