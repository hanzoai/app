'use client'

// Dev's and Chat's interior is the Dev core, always. With nothing open it is the composer
// ("Build what's next.": `DevHome`, runnable with no environment: Cloud is plain chat on the
// account); a turn aimed at a linked Mac (`GET /v1/sources`) hands over to that Mac's runtime
// (`DevProvider` + `DevWorkspace`), a thread view with a dock beside it. The dock is Tabs' own panes for the
// runtime's sandbox (@hanzo/tabs `frameUrl`): the terminal, and the browser as
// pixels with Watching / Take control (the screen page's own view-only switch,
// as the bot computer's dialog drives it).

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Text, XStack, YStack } from '@hanzo/ui'
import { frameUrl, type Door } from '@hanzo/tabs'
import type { DevEnvironment, DevRuntime } from '@hanzo/dev-core'
import { useI18n } from '@hanzo/i18n/react'
import { api } from './lib/api'
import { bearer } from './lib/session'
import { machines } from './devRuntime'
import type { Host } from '@hanzo/build'
import { app, talk } from './lib/host'
import { org as currentOrg } from './lib/session'

const Core = lazy(() => import('./core').then((m) => ({ default: m.DevWorkspace })))
const Provider = lazy(() => import('./core').then((m) => ({ default: m.DevProvider })))
const Home = lazy(() => import('./core').then((m) => ({ default: m.DevHome })))
const Chats = lazy(() => import('./core').then((m) => ({ default: m.DevChatList })))
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

/** Where a turn can run: Cloud first (plain chat on the account; sandbox sessions are not there yet), then each linked Mac that would pair. */
export const environmentsOf = (t: (s: string) => string, linked: readonly DevRuntime[], skip: ReadonlySet<string>): readonly DevEnvironment[] => [
  { id: 'cloud', kind: 'cloud', label: t('Cloud'), available: false, note: t('Not available yet') },
  ...linked
    .filter((m) => !skip.has(m.id))
    .map((m): DevEnvironment => ({ id: m.id, kind: 'machine', label: m.label, available: true, runtime: m })),
]

const CHOSEN = 'hanzo.dev.environment'
const remembered = (): string | null => {
  try {
    return window.localStorage.getItem(CHOSEN)
  } catch {
    return null
  }
}
const remember = (id: string): void => {
  try {
    window.localStorage.setItem(CHOSEN, id)
  } catch {}
}

/** What the scope gives the sidebar's list and the interior. */
interface Dev {
  /** The Mac the Dev core is mounted on, null until a turn went to one or a thread of one is open. */
  runtime: DevRuntime | null
  environments: readonly DevEnvironment[]
  environment: string | null
  choose: (id: string) => void
  /** A turn for a Mac: mount its runtime. */
  handoff: (environment: DevEnvironment, prompt: string) => void
  /** The Mac would not pair: it is not offered again this session. */
  fail: (runtime: DevRuntime) => void
}

export const Scope = createContext<Dev | undefined>(undefined)

/**
 * Finds the person's linked Macs once Dev or Chat is entered and keeps the environment they chose.
 * The Dev core's provider wraps everything that draws it (the sidebar's thread list and the interior
 * share one connection) only once a Mac is in use; before that the composer needs no connection.
 */
export function DevScope({ active, path, children }: { active: boolean; path: string; children: ReactNode }) {
  const { t } = useI18n()
  const [on, setOn] = useState(active)
  useEffect(() => {
    if (active) setOn(true)
  }, [active])
  const [linked, setLinked] = useState<readonly DevRuntime[]>([])
  const [skip, setSkip] = useState<ReadonlySet<string>>(() => new Set())
  const [chosen, setChosen] = useState<string | null>(null)
  const [using, setUsing] = useState<DevRuntime | null>(null)
  useEffect(() => {
    if (!on) return
    const ctl = new AbortController()
    void machines(ctl.signal).then((m) => !ctl.signal.aborted && setLinked(m))
    setChosen(remembered())
    return () => ctl.abort()
  }, [on])
  const environments = environmentsOf(t, linked, skip)
  const environment = environments.some((e) => e.id === chosen) ? chosen : 'cloud'
  // A thread of a Mac is open (a reload, a shared link): the first Mac that is there.
  const open = REF.test(path)
  const runtime = using ?? (open ? (linked.find((m) => !skip.has(m.id)) ?? null) : null)
  const dev: Dev = {
    runtime,
    environments,
    environment,
    choose: (id) => {
      remember(id)
      setChosen(id)
    },
    handoff: (e, _prompt) => e.runtime && setUsing(e.runtime),
    fail: (r) => {
      setSkip((prev) => new Set(prev).add(r.id))
      setUsing((u) => (u?.id === r.id ? null : u))
    },
  }
  return (
    <Scope.Provider value={dev}>
      {runtime ? (
        <Suspense fallback={null}>
          <Provider runtime={runtime} onFail={dev.fail}>{children}</Provider>
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

/** The thread list nested under Dev in the sidebar; the shell's own Recents until a Mac is in use. */
export function DevList({ host, path }: { host: Host; path: string }) {
  const dev = useScope()
  if (!dev?.runtime) return null
  return (
    <Suspense fallback={null}>
      <List tools active={refOf(path)} onOpen={(ref) => host.go(app(ref ? `thread/${ref}` : ''))} />
    </Suspense>
  )
}

/** The account's conversations under Chat in the sidebar: the Dev core's list of them (the cloud holds them, so the history survives). */
export function ChatList({ host, path }: { host: Host; path: string }) {
  const id = /^\/chat\/([^/]+)/.exec(path)?.[1]
  return (
    <YStack data-slot="recents" data-mode="chat" flex={1} minH={0} overflow="scroll">
      <Suspense fallback={null}>
        <Chats cloud={cloud()} active={id ? decodeURIComponent(id) : null} onOpen={(ref) => host.go(talk(ref ?? undefined))} />
      </Suspense>
    </YStack>
  )
}

/** The Dev core's cloud account: plain chat needs no environment. */
const cloud = () => ({ api: api(), token: async () => bearer() ?? '', org: currentOrg() ?? undefined })

/**
 * The interior of Dev and of Chat: the Dev core, always. A Mac's thread is the thread view with the
 * dock; everything else is the composer. `mode` says which of the two the address is: Chat hides
 * the code tools, and its conversation is the shell's `/chat/<id>`.
 */
export function DevInterior({ host, path, mode = 'dev', conversation = null }: { host: Host; path: string; mode?: 'dev' | 'chat'; conversation?: string | null }) {
  const dev = useScope()
  const project = path.startsWith('/dev/projects/')
  useEffect(() => {
    if (project) host.go(app(''), { replace: true })
  }, [project, host])
  if (!dev) return null
  const thread = mode === 'dev' ? refOf(path) : null
  if (dev.runtime && thread) {
    const dock = (ctx: { runtime: DevRuntime; thread: string | null }) => <Dock {...ctx} />
    return (
      <Suspense fallback={null}>
        <Core thread={thread} onNavigate={(ref) => host.go(app(ref ? `thread/${ref}` : ''))} dock={dock} />
      </Suspense>
    )
  }
  return (
    <Suspense fallback={null}>
      <Home
        cloud={cloud()}
        mode={mode}
        environments={dev.environments}
        environment={dev.environment}
        onEnvironment={dev.choose}
        onHandoff={dev.handoff}
        conversation={conversation}
        onConversation={(id) => host.go(talk(id ?? undefined))}
      />
    </Suspense>
  )
}
