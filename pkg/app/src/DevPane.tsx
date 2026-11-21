'use client'

// Dev's interior when the person has a runtime (devRuntime.ts): the Dev core's
// thread view with a dock beside it. The dock is Tabs' own panes for the
// runtime's sandbox (@hanzo/tabs `frameUrl`): the terminal, and the browser as
// pixels with Watching / Take control (the screen page's own view-only switch,
// as the bot computer's dialog drives it).

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Text, XStack, YStack } from '@hanzo/ui'
import { frameUrl, type Door } from '@hanzo/tabs'
import type { DevRuntime } from '@hanzo/dev-core'
import { useI18n } from '@hanzo/i18n/react'
import { api } from './lib/api'
import { bearer } from './lib/session'
import { resolveRuntime, useDevRuntime } from './devRuntime'
import type { Host } from '@hanzo/build'
import { app, TERMINALS } from './lib/host'

const Core = lazy(() => import('./core').then((m) => ({ default: m.DevWorkspace })))
const Provider = lazy(() => import('./core').then((m) => ({ default: m.DevProvider })))
const Start = lazy(() => import('./core').then((m) => ({ default: m.DevStart })))
const List = lazy(() => import('./core').then((m) => ({ default: m.DevThreadList })))

/** A dock pane: one single-use ticket per mount, so a reload mints a fresh one. */
function Pane({ sandbox, door, arg, watching }: { sandbox: string; door: Door; arg?: string; watching?: boolean }) {
  const { t } = useI18n()
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    let live = true
    setSrc(null)
    setFailed(false)
    void frameUrl(bearer() ?? '', sandbox, door, arg, api())
      .then((u) => live && setSrc(u))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [sandbox, door, arg])
  useEffect(() => {
    if (door === 'screen') frame.current?.contentWindow?.postMessage({ type: 'hanzo-screen-control', viewOnly: watching !== false }, '*')
  }, [door, watching, src])
  if (failed) return <Text p="$3" color="$soft">{t('This could not be opened.')}</Text>
  if (!src) return null
  return <iframe ref={frame} src={src} title={door} width="100%" height="100%" frameBorder="0" allow="clipboard-read; clipboard-write" />
}

type Tab = 'terminal' | 'browser'

export function Dock({ runtime, thread }: { runtime: DevRuntime; thread: string | null }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('terminal')
  const [watching, setWatching] = useState(true)
  const sandbox = runtime.sandbox
  if (!sandbox) return null
  return (
    <YStack data-slot="dev-dock" width={420} $max-lg={{ display: 'none' }} minH={0} borderLeftWidth={1} borderColor="$edge">
      <XStack gap="$1" p="$2" items="center">
        {(['terminal', 'browser'] as const).map((k) => (
          <Button key={k} size="sm" variant={tab === k ? 'secondary' : 'ghost'} onPress={() => setTab(k)}>
            {k === 'terminal' ? t('Terminal') : t('Browser')}
          </Button>
        ))}
        {tab === 'browser' ? (
          <Button size="sm" variant="ghost" ml="auto" onPress={() => setWatching((w) => !w)}>
            {watching ? t('Take control') : t('Watching')}
          </Button>
        ) : null}
      </XStack>
      <YStack flex={1} minH={0}>
        {tab === 'terminal' ? (
          <Pane sandbox={sandbox} door="terminal" arg={thread ? `dev-${thread.replace(/[^\w-]/g, '-')}` : undefined} />
        ) : (
          <Pane sandbox={sandbox} door="screen" watching={watching} />
        )}
      </YStack>
    </YStack>
  )
}

export const Scope = createContext<DevRuntime | null | undefined>(undefined)

/** Resolves the runtime once Dev is entered and mounts the Dev core's provider over everything that draws it: the sidebar's thread list and the interior share one connection. */
export function DevScope({ active, children }: { active: boolean; children: ReactNode }) {
  const [on, setOn] = useState(active)
  useEffect(() => {
    if (active) setOn(true)
  }, [active])
  const runtime = useDevRuntime(on)
  return (
    <Scope.Provider value={runtime}>
      {runtime ? (
        <Suspense fallback={null}>
          <Provider runtime={runtime}>{children}</Provider>
        </Suspense>
      ) : (
        children
      )}
    </Scope.Provider>
  )
}

export const useScope = () => useContext(Scope)

const REF = /^\/dev\/thread\/(.+)$/
const refOf = (path: string): string | null => REF.exec(path)?.[1] ?? null

/** The thread list nested under Dev in the sidebar; nothing without a runtime. */
export function DevList({ host, path }: { host: Host; path: string }) {
  const runtime = useScope()
  if (!runtime) return null
  return (
    <Suspense fallback={null}>
      <List tools active={refOf(path)} onOpen={(ref) => host.go(app(ref ? `thread/${ref}` : ''))} />
    </Suspense>
  )
}

/** Dev's interior: the Dev core when the person has a runtime, Dev's own start state when they have none. */
export function DevInterior({ host, path }: { host: Host; path: string }) {
  const runtime = useScope()
  const project = path.startsWith('/dev/projects/')
  useEffect(() => {
    if (runtime && project) host.go(app(''), { replace: true })
  }, [runtime, project, host])
  if (runtime === undefined) return null
  if (runtime === null) {
    // No runtime is Dev's own state, not a second UI: lease a cell, or link a machine (Tabs lists the devices).
    return (
      <Suspense fallback={null}>
        <Start onCloud={() => void resolveRuntime(new AbortController().signal).then((r) => r && window.location.reload())} onLink={() => host.go(TERMINALS)} />
      </Suspense>
    )
  }
  const dock = (ctx: { runtime: DevRuntime; thread: string | null }) => <Dock {...ctx} />
  return (
    <Suspense fallback={null}>
      <Core thread={refOf(path)} onNavigate={(ref) => host.go(app(ref ? `thread/${ref}` : ''))} dock={dock} />
    </Suspense>
  )
}
