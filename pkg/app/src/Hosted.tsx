'use client'

// The apps in beta that stand inside the app, at /apps/<id> (lib/hosted): one
// pane for CRM, Commerce, CMS, Analytics and Insights. Each is a standalone app
// on a host of its own, and the pane frames that live host, so the app deploys
// on its own and hanzo.ai shows the deploy at once.
//
// WHO MAY OPEN ONE is `useBetas().open`, the one predicate (lib/betas): a reader
// the switch is off for is shown the app's request path, the Betas list's own
// action, never a frame. Still reading the switches, or the cloud not
// answering, shows the loader and then the request path, never the app.
//
// THE FRAME is `?embed=1` on the app's own address, same registrable domain, so
// IAM's session cookie is first-party in it. The host tells the frame how it
// looks (`hanzo:host`: theme, accent, density, organization) when it has loaded
// and whenever the look or the organization changes; the frame may say where it
// is (`hanzo:navigate`, kept in this address as `?at=`) and that it is up
// (`hanzo:ready`). A message is heard only from that host's origin and that one
// frame, and an app that never speaks still works.
//
// A frame the host refuses to draw fires no error a page can read, so a frame
// that has not loaded after `PATIENCE` is said to have failed, with the way out:
// the app in a tab.

import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, RotateCw } from 'lucide-react'
import { current, dark } from '@hanzo/appearance'
import { useI18n } from '@hanzo/i18n/react'
import { Button, Spinner, Text, XStack, YStack } from '@hanzo/ui'
import { View } from '@hanzo/gui'
import { Ask, useBetas } from './Betas'
import { out } from './help'
import { useOrg } from './host'
import { BETAS } from './lib/betas'
import { go as replace, hosted } from './lib/host'
import { frameUrl, hostedApp, origin, pathOn, type Hosted } from './lib/hosted'

/** How long a frame may take to load before the pane says it did not. */
export const PATIENCE = 20_000

/** What the frame may use of the browser: the clipboard and full screen, which the apps' own pages ask for. */
const ALLOW = 'clipboard-read; clipboard-write; fullscreen'

/** What the host tells a frame about how it looks. */
export interface Hostly {
  type: 'hanzo:host'
  theme: 'light' | 'dark'
  accent?: string
  density?: string
  org?: string
}

/**
 * How the page looks as the reader has it, read off their stored choice for the
 * organization and read again whenever the document's own look is repainted
 * (a class or a variable on <html>), so a change in Settings reaches the frame
 * without a second reading of the account.
 */
function useLooks(orgId?: string): Omit<Hostly, 'type' | 'org'> {
  const read = useCallback((): Omit<Hostly, 'type' | 'org'> => {
    const { pref } = current({ orgId })
    return { theme: dark(pref.theme ?? 'system') ? 'dark' : 'light', accent: pref.accent, density: pref.density }
  }, [orgId])
  const [looks, setLooks] = useState(read)
  useEffect(() => {
    const again = () => setLooks((was) => {
      const now = read()
      return was.theme === now.theme && was.accent === now.accent && was.density === now.density ? was : now
    })
    again()
    const watch = new MutationObserver(again)
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-scheme', 'data-theme'] })
    return () => watch.disconnect()
  }, [read])
  return looks
}

/** The page the address names inside the app, when it names one: `?at=/path` on the app's own host. */
const started = (): string | null => {
  const at = new URLSearchParams(window.location.search).get('at')
  return at && at.startsWith('/') && !at.startsWith('//') ? at : null
}

export function HostedPane({ id, go }: { id: string; go: (address: string) => void }) {
  const { open, ready } = useBetas()
  const app = hostedApp(id)
  if (!app) return null
  if (!ready) return <Waiting />
  if (!open(app.id)) return <Request app={app} go={go} />
  return <Frame key={app.id} app={app} />
}

/** The loader: the shell's spinner, centred in the pane. */
function Waiting() {
  return (
    <YStack flex={1} items="center" justify="center" data-slot="hosted-loading">
      <Spinner size={28} color="$color10" />
    </YStack>
  )
}

/** The request path: the app, what it is, and the Betas list's own action for it. */
function Request({ app, go }: { app: Hosted; go: (address: string) => void }) {
  const { t } = useI18n()
  const beta = BETAS.find((b) => b.id === app.id)
  const Icon = app.icon
  return (
    <YStack flex={1} items="center" justify="center" gap="$3" p="$6" data-slot="hosted-request" data-app={app.id}>
      <Icon size={28} aria-hidden />
      <Text fontSize="$6" fontWeight="600" color="$color12">
        {app.name}
      </Text>
      {beta ? (
        <Text fontSize="$3" color="$color11" text="center" maxW={420}>
          {t(beta.line)}
        </Text>
      ) : null}
      {beta ? <Ask beta={beta} go={go} /> : null}
      <Button size="sm" variant="ghost" rounded={999} onPress={() => go('/beta')}>
        {t('All betas')}
      </Button>
    </YStack>
  )
}

/** The frame, with its quiet toolbar, its loader and its failure. */
function Frame({ app }: { app: Hosted }) {
  const { t } = useI18n()
  const org = useOrg()
  const looks = useLooks(org.id)
  const frame = useRef<HTMLIFrameElement | null>(null)
  // The page the frame is on, as the app last said (or the address asked for): reload and the tab keep it.
  const at = useRef<string | null>(started())
  const [src, setSrc] = useState(() => frameUrl(app, at.current))
  const [turn, setTurn] = useState(0)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const host = origin(app)

  // What the frame is told: each time it loads, and whenever the look or the organization changes after.
  const tell = useCallback(() => {
    const to = frame.current?.contentWindow
    if (!to) return
    const said: Hostly = { type: 'hanzo:host', ...looks, org: org.id }
    try {
      to.postMessage(said, host)
    } catch {
      /* a window that is no longer the app's: nothing to tell */
    }
  }, [looks, org.id, host])
  const up = useRef(false)
  useEffect(() => {
    up.current = state === 'ready'
  }, [state])
  useEffect(() => {
    if (up.current) tell()
  }, [tell])
  const loaded = () => {
    setState((was) => (was === 'failed' ? was : 'ready'))
    tell()
  }

  // What the frame says: heard from its host and from it alone.
  useEffect(() => {
    const hear = (e: MessageEvent) => {
      if (e.origin !== host || e.source !== frame.current?.contentWindow) return
      const said = e.data as { type?: unknown; href?: unknown } | null
      if (said?.type === 'hanzo:ready') setState('ready')
      else if (said?.type === 'hanzo:navigate' && typeof said.href === 'string') {
        const to = pathOn(app, said.href)
        if (!to) return
        at.current = to
        replace(hosted(app.id, to === '/' ? undefined : to), true)
      }
    }
    window.addEventListener('message', hear)
    return () => window.removeEventListener('message', hear)
  }, [app, host])

  // A frame that never loads is said not to have.
  useEffect(() => {
    if (state !== 'loading') return
    const late = window.setTimeout(() => setState('failed'), PATIENCE)
    return () => window.clearTimeout(late)
  }, [state, turn])

  const reload = () => {
    setSrc(frameUrl(app, at.current))
    setState('loading')
    setTurn((n) => n + 1)
  }
  const tab = () => out(at.current ? `${host}${at.current}` : app.href)
  const Icon = app.icon

  return (
    <YStack flex={1} minH={0} data-slot="hosted" data-app={app.id}>
      <XStack items="center" gap="$2" px="$3" height={36} shrink={0} borderBottomWidth={1} borderColor="$borderColor" data-slot="hosted-bar">
        <Icon size={14} aria-hidden />
        <Text fontSize="$2" fontWeight="500" color="$color12">
          {app.name}
        </Text>
        <Text fontSize="$2" color="$color10" numberOfLines={1} flex={1} minW={0}>
          {app.host}
        </Text>
        <Button size="sm" variant="ghost" rounded={999} aria-label={t('Reload')} onPress={reload} data-slot="hosted-reload">
          <RotateCw size={14} aria-hidden />
        </Button>
        <Button size="sm" variant="ghost" rounded={999} aria-label={t('Open in a tab')} onPress={tab} data-slot="hosted-tab">
          <ExternalLink size={14} aria-hidden />
        </Button>
      </XStack>
      <YStack flex={1} minH={0} position="relative">
        <View
          flex={1}
          width="100%"
          height="100%"
          borderWidth={0}
          bg="transparent"
          render={
            <iframe
              key={turn}
              ref={frame}
              src={src}
              title={app.name}
              allow={ALLOW}
              referrerPolicy="strict-origin-when-cross-origin"
              data-slot="hosted-frame"
              onLoad={loaded}
            />
          }
        />
        {state === 'loading' ? (
          <YStack position="absolute" t={0} l={0} r={0} b={0} items="center" justify="center" pointerEvents="none" data-slot="hosted-loading">
            <Spinner size={28} color="$color10" />
          </YStack>
        ) : null}
        {state === 'failed' ? (
          <YStack position="absolute" t={0} l={0} r={0} b={0} items="center" justify="center" gap="$3" bg="$background" data-slot="hosted-failed">
            <Text fontSize="$3" color="$color11">
              {t('{name} did not open here.', { name: app.name })}
            </Text>
            <Button size="sm" rounded={999} onPress={tab}>
              {t('Open in a tab')}
            </Button>
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  )
}
