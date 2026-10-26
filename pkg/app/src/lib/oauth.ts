/**
 * A provider's OAuth in a popup, and its answer back in the window that opened it.
 *
 * `/v1/provider/:provider/connect` answers an authorize URL; the provider sends the
 * browser to api.hanzo.ai's callback, which 302s to the return page the connect
 * named with `connected=<provider>&account=<label>` or `error=<provider>&reason=<why>`
 * on its query. A connect that names no return lands on the console's /connectors,
 * a whole other app on another origin: the popup stayed open there and the opener
 * never heard. So the connect names `RETURN`, this site's registered return page
 * (cloud brand.Info.Returns), where the site's first script (hanzo.ai app/page.tsx
 * `RETURNED`) hands the answer to the opener and closes the popup.
 *
 * The answer arrives three ways, whichever reaches first: a `message` from the
 * popup (same origin only), a `BroadcastChannel` post or a `storage` write for an
 * opener the popup lost (`window.opener` is null after a cross-origin-isolated
 * page). The opener also reads the popup's address itself once it is back on
 * this origin, and closes it, so a popup that cannot close itself still does.
 */

/** The return page the connect names: hanzo.ai's Settings → Integrations, registered with the API. */
export const RETURN = 'https://hanzo.ai/?at=-/settings/integrations'

/** The message, channel and storage key one answer travels by. */
export const RETURNED = 'hanzo-oauth-return'

/** What the provider answered. */
export type Answer = { type: typeof RETURNED; provider: string; ok: true; account: string } | { type: typeof RETURNED; provider: string; ok: false; reason: string }

/** The answer a return page's query carries, or null when it carries none. */
export function answered(search: string): Answer | null {
  const q = new URLSearchParams(search)
  const ok = q.get('connected')
  if (ok) return { type: RETURNED, provider: ok, ok: true, account: q.get('account') ?? '' }
  const failed = q.get('error')
  if (failed && q.has('reason')) return { type: RETURNED, provider: failed, ok: false, reason: q.get('reason') ?? '' }
  return null
}

/** `data` as an answer for `provider`, or null when it is anything else. */
export function heard(data: unknown, provider: string): Answer | null {
  if (!data || typeof data !== 'object') return null
  const a = data as { type?: unknown; provider?: unknown; ok?: unknown; account?: unknown; reason?: unknown }
  if (a.type !== RETURNED || a.provider !== provider || typeof a.ok !== 'boolean') return null
  const text = (v: unknown) => (typeof v === 'string' ? v : '')
  return a.ok ? { type: RETURNED, provider, ok: true, account: text(a.account) } : { type: RETURNED, provider, ok: false, reason: text(a.reason) }
}

/**
 * Wait for `provider`'s answer to the popup. `done` is called once: with the
 * answer, or with null when the popup closed without one. Answers the cleanup.
 */
export function awaitAnswer(popup: Window, provider: string, done: (answer: Answer | null) => void): () => void {
  let over = false
  let channel: BroadcastChannel | null = null
  const finish = (answer: Answer | null) => {
    if (over) return
    over = true
    stop()
    try {
      if (!popup.closed) popup.close()
    } catch {
      /* already gone */
    }
    done(answer)
  }
  const onMessage = (ev: MessageEvent) => {
    if (ev.origin !== window.location.origin) return
    const a = heard(ev.data, provider)
    if (a) finish(a)
  }
  const onStorage = (ev: StorageEvent) => {
    if (ev.key !== RETURNED || !ev.newValue) return
    try {
      const a = heard(JSON.parse(ev.newValue), provider)
      if (a) finish(a)
    } catch {
      /* not an answer */
    }
  }
  const timer = window.setInterval(() => {
    if (popup.closed) {
      finish(null)
      return
    }
    try {
      // Cross-origin (the provider, api.hanzo.ai) until the return page: reading throws.
      if (popup.location.origin !== window.location.origin) return
      const a = answered(popup.location.search)
      if (a && a.provider === provider) finish(a)
    } catch {
      /* still away */
    }
  }, 250)
  const stop = () => {
    window.clearInterval(timer)
    window.removeEventListener('message', onMessage)
    window.removeEventListener('storage', onStorage)
    channel?.close()
  }
  window.addEventListener('message', onMessage)
  window.addEventListener('storage', onStorage)
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(RETURNED)
    channel.onmessage = (ev) => {
      const a = heard(ev.data, provider)
      if (a) finish(a)
    }
  }
  return () => {
    over = true
    stop()
  }
}
