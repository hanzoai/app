// The page the browser tests draw: @hanzo/sources mounted the way a host with no
// React mounts it (the extension popup does). Query: surface, device, mode
// (view|picker), admin=1, theme=dark. The IAM token is whatever the test left in
// localStorage; every pick lands in window.__picks.
import '@hanzo/design/styles.css'
import '@hanzo/design/roles.css'
import { mountSources } from '../../src/mount'
import type { MountOptions } from '../../src/mount'

const q = new URLSearchParams(location.search)
const theme = q.get('theme') === 'dark' ? 'dark' : 'light'
document.documentElement.classList.add(theme === 'dark' ? 't_dark' : 't_light')
document.documentElement.setAttribute('data-theme', theme)
document.body.style.cssText = 'margin:0;background:var(--background);color:var(--foreground);font-family:var(--font-sans,system-ui)'

const picks: unknown[] = []
;(window as unknown as { __picks: unknown[] }).__picks = picks

const el = document.getElementById('root')!
el.style.cssText = 'max-width:860px;padding:20px;margin:0 auto'
mountSources(el, {
  surface: (q.get('surface') ?? 'web') as MountOptions['surface'],
  deviceId: q.get('device') ?? undefined,
  mode: q.get('mode') === 'picker' ? 'picker' : 'view',
  admin: q.get('admin') === '1',
  theme,
  apiBase: location.origin,
  token: () => localStorage.getItem('token'),
  onPick: q.get('pick') === '0' ? undefined : (p) => picks.push({ via: p.choice?.via ?? 'local', account: p.account?.id ?? null, choice: p.choice }),
})
