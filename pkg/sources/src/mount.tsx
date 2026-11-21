// `mountSources`: the sources view or the picker in any page, with no React in
// the host. The Hanzo extension's popup and a plain page call it; a React host
// (hanzo.app, Dev's web) renders `SourcesView` / `AccountPicker` itself.
//
// The host loads @hanzo/design's `styles.css` (the tokens); this mounts gui's
// provider and its generated sheet once, so nothing else is needed.

import { createRoot, type Root } from 'react-dom/client'
import { GuiProvider } from '@hanzo/gui'
import { css, monochrome } from '@hanzo/ui/gui-config'
import { createClient } from './client'
import { AccountPicker } from './picker'
import type { Picked } from './accounts'
import { SourcesView } from './view'
import type { Choice, Surface } from './types'

export interface MountOptions {
  surface: Surface
  /** The IAM bearer, or a function that reads it when a request is made. */
  token: string | null | (() => string | null)
  /** The gateway's origin, e.g. https://api.hanzo.ai. */
  apiBase: string
  /** The source id of the device this surface runs on, when it is a linked one. */
  deviceId?: string
  org?: string | null | (() => string | null)
  /** An org admin: adds the People tab. */
  admin?: boolean
  /** `picker` draws the account picker alone; `view` (default) the whole view. */
  mode?: 'view' | 'picker'
  /** Makes account rows choosable. Required for `picker`. */
  onPick?: (pick: Picked) => void
  selected?: Choice | null
  /** Where a signed-out person goes; defaults to https://hanzo.ai/login. */
  signIn?: string
  /** `light` or `dark`; the gui theme the mount carries. */
  theme?: 'light' | 'dark'
}

export interface Mounted {
  /** Redraw with changed options (a new token, a different surface). */
  update(next: Partial<MountOptions>): void
  unmount(): void
}

const SHEET = 'hanzo-sources-gui'

export function mountSources(element: HTMLElement, options: MountOptions): Mounted {
  if (!document.getElementById(SHEET)) {
    const sheet = document.createElement('style')
    sheet.id = SHEET
    sheet.textContent = css(monochrome)
    document.head.append(sheet)
  }
  let opts = options
  const root: Root = createRoot(element)
  const draw = () => {
    const client = createClient({ apiBase: opts.apiBase, token: opts.token, org: opts.org })
    const props = { client, surface: opts.surface, deviceId: opts.deviceId, selected: opts.selected, signIn: opts.signIn }
    root.render(
      <GuiProvider config={monochrome} defaultTheme={opts.theme ?? 'light'} disableInjectCSS>
        {opts.mode === 'picker' ? (
          <AccountPicker {...props} onPick={opts.onPick ?? (() => {})} />
        ) : (
          <SourcesView {...props} admin={opts.admin} onPick={opts.onPick} />
        )}
      </GuiProvider>,
    )
  }
  draw()
  return {
    update(next) {
      opts = { ...opts, ...next }
      draw()
    },
    unmount: () => root.unmount(),
  }
}
