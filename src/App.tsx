'use client'

// The web app as the whole window, in two modes: Chat, a conversation with the
// product's AI, and Dev, @hanzo/build's `<Builder>` without a rail of its own.
//
//   OUTER  the rail (Rail.tsx) and the sidebar beside it (Column.tsx), on the
//          window's floor, with the window's bar above them where the host has
//          no browser around it (`bar`).
//   INNER  the content, cut as one rounded panel inset from the window's edges
//          and from the sidebar by the gutter (`--pane-gap`): Chat's
//          conversation with its tabs beside it (Paned), or Dev's builder.
//
// The rail moves between the modes; the sidebar holds the mode's name, its
// search, New, Dev's places and the reader's Recents. The address says the
// mode, as a path (lib/host `talk`, `app`, `place`): `/` and `/chat` are Chat on
// a new conversation, `/chat/<id>` one of the reader's, and a path under `/dev`
// is Dev: `/dev/run/<id>` a run, `/dev/projects/<org>/<repo>` a project. Moving
// between the modes is a history entry (`go`), never a load, so a host serves
// this one component for every path under each.
//
// Every host draws this: hanzo.ai at `/`, `/chat` and `/dev`, and the desktop
// app as its main window. The host mounts IamProvider and `<Rooms>` with its
// router and the path, and draws this only for a signed-in reader; what a
// stranger sees is the host's.
//
// THE SIDEBAR'S TOGGLE IS AT THE WINDOW'S TOP-LEFT. In a browser tab it leads
// the rail. A host that is a window of its own (`bar`) has no browser around
// it, so the app draws the window's bar: the toggle, then Back and Forward
// through the host's router, clear of the window's own controls, and the bar
// drags the window. Shut, the sidebar leaves the rail alone at the edge; the
// choice is kept per browser under the key the builder's rail kept it under.
//
// THE KEYS: ⌘K / Ctrl+K searches the sidebar (opening it first), ⌘, / Ctrl+,
// opens Settings, and in a window ⌘[ ⌘] / Alt+← Alt+→ are Back and Forward —
// never while the reader types.
//
// DEV'S PANE HAS NO COLUMN BESIDE IT. The column beside a pane is Chat's (its
// tabs, `useOpen().aside`), and that choice outlives a move to Dev, where
// nothing fills it. So Dev's pane is cut on its own and the tabs are Chat's.
//
// EVERY MOVE PUTS THE DRAWER AWAY, the one to where the reader already is
// included.
//
// THE PLANS' OWN ADDRESS LEAVES for the pay site in its place (dev.tsx `leave`),
// so the builder's own plans are never drawn.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Menu } from 'lucide-react'
import { AiProvider } from '@hanzo/ai/react'
import { Text, XStack, YStack } from '@hanzo/gui'
import { Builder, HostProvider, path as written, route } from '@hanzo/build'
import { SidebarIconButton } from '@hanzo/ui/chat'
import { useAi } from './lib/ai'
import { Chat } from './Chat'
import { Column } from './Column'
import { isPlans, leave, useDevHost } from './dev'
import { useRooms } from './host'
import { useKept } from './kept'
import { Mark, Rail, Toggle } from './Rail'
import { empty, openThread, useOpen } from './open'
import { Paned } from './Shell'
import { floor, pane } from './ground'
import { pick } from './lib/session'
import { app, go, place, talk, type Place } from './lib/host'
import { wordmark } from './where'

/** `/` is Chat on a new conversation. */
const HOME: Place = { mode: 'chat', thread: null }

/**
 * The window's bar, for a host that is a window of its own: `inset` px kept
 * clear at its left for the window's own controls (macOS paints its traffic
 * lights over the page there), and `drag`, the attributes the host's shell
 * reads as the region that moves the window.
 */
export interface Bar {
  inset?: number
  drag?: Record<string, unknown>
}

/** The bar's height, px: the reference window's title bar. */
const BAR = 40

/**
 * The dim under the phone's drawer: design's scrim at two fifths, so the page
 * still reads through the drawer's glass. gui carries a `color-mix()` to the
 * page unchanged; its types only name custom properties.
 */
const DIM = 'color-mix(in srgb, var(--surface-scrim) 40%, transparent)' as `var(--${string})`

/** The phone's drawer stands the gutter off each edge, or the device's inset where that is wider. */
const INSET = {
  top: 'max(var(--pane-gap), var(--safe-top))',
  bottom: 'max(var(--pane-gap), var(--safe-bottom))',
  left: 'max(var(--pane-gap), var(--safe-left))',
} as const

/** Where each mode was last, so the rail goes back to it. */
const last = { chat: '', dev: '' }

/** Whether a key press is the reader typing, where the app's keys are the field's. */
const typing = (e: KeyboardEvent): boolean => {
  const el = e.target as HTMLElement | null
  return !!el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
}

/** The builder's Settings, general section. */
const SETTINGS = written({ kind: 'settings', section: 'general' })

export function App({ bar }: { bar?: Bar } = {}) {
  const [drawer, setDrawer] = useState(false)
  const shut = useCallback(() => setDrawer(false), [])
  // The sidebar shut, kept per browser under the key the builder's rail kept it under.
  const [closed, setClosed] = useKept('hanzo.build.rail', false)
  // Each ⌘K: the sidebar's search, asked for again.
  const [seek, setSeek] = useState(0)
  const dev = useDevHost()
  // The builder's moves put the drawer away first.
  const host = useMemo<typeof dev>(
    () => ({
      ...dev,
      go: (to, how) => {
        shut()
        dev.go(to, how)
      },
    }),
    [dev, shut],
  )
  const { client } = useAi()
  const { router, path } = useRooms()
  const here = path ?? '/'
  const at = place(here) ?? HOME
  const mode = at.mode
  const where = at.mode === 'dev' ? at.at : null
  // A run floats two panes of its own, so the pane it stands in is not cut.
  const run = where !== null && route(where).kind === 'run'
  const asked = at.mode === 'chat' ? at.thread : null
  const { thread } = useOpen()
  const plans = where !== null && isPlans(where)
  useEffect(() => {
    if (plans) leave('app')
  }, [plans])

  // An address names Chat's conversation, a conversation just begun writes its
  // id back, and one emptied (New chat, wherever it was pressed) leaves for /chat.
  useEffect(() => {
    if (mode !== 'chat') return
    if (asked && asked !== thread) openThread(asked)
    else if (!asked && thread) empty()
    // The address decides; the selection follows it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, asked])
  // The conversation the pane held before this render: an emptied one is the
  // address's own conversation let go of, never a first render before it opens.
  const held = useRef<string | null>(null)
  useEffect(() => {
    const was = held.current
    held.current = thread
    if (mode !== 'chat') return
    if (thread && thread !== asked) go(talk(thread), true)
    else if (!thread && was && asked === was) go(talk())
    // The selection writes the address only when it moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, thread])

  useEffect(() => {
    last[mode] = `${window.location.pathname}${window.location.search}`
    setDrawer(false)
  }, [mode, here])

  /** A move of the app's own: the drawer away, then the address. */
  const move = useCallback(
    (address: string) => {
      shut()
      go(address)
    },
    [shut],
  )

  // The app's keys.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setClosed(false)
        if (window.matchMedia('(max-width: 767.98px)').matches) setDrawer(true)
        setSeek((n) => n + 1)
        return
      }
      if (typing(e)) return
      if (mod && !e.shiftKey && !e.altKey && e.key === ',') {
        e.preventDefault()
        move(app(SETTINGS))
        return
      }
      if (!bar) return
      const back = (e.metaKey && e.key === '[') || (e.altKey && e.key === 'ArrowLeft')
      const forth = (e.metaKey && e.key === ']') || (e.altKey && e.key === 'ArrowRight')
      if ((!back && !forth) || e.ctrlKey || e.shiftKey) return
      e.preventDefault()
      if (back) router.back()
      else router.forward()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // setClosed is the kept setter of this render; the keys read it fresh each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bar, router, move])

  const toChat = () => move(last.chat || talk())
  const toDev = () => move(last.dev || app(''))
  // Another organization: picked, and the app opened in it at the mode's New.
  const org = (o: string) => {
    pick(o)
    window.location.assign(mode === 'dev' ? app('') : talk())
  }
  const flip = () => setClosed(!closed)

  return (
    <AiProvider client={client ?? undefined}>
      <HostProvider host={host}>
        {/* The floor runs under the bar where there is one, so the window is one ground. */}
        <YStack data-slot="window" {...(bar ? floor : null)} flex={1} minW={0} height="100dvh" overflow="hidden">
          {bar ? (
            <XStack data-slot="title-bar" height={BAR} shrink={0} items="center" gap={2} pl={(bar.inset ?? 0) + 6} pr="$2" {...bar.drag}>
              {/* From a tablet up the toggle shuts the sidebar; on a phone it opens the drawer. */}
              <XStack $max-md={{ display: 'none' }}>
                <Toggle open={!closed} onPress={flip} />
              </XStack>
              <XStack $md={{ display: 'none' }}>
                <Toggle open={drawer} onPress={() => setDrawer(true)} label="Open sidebar" />
              </XStack>
              <Mark label="Back" data-slot="back" onPress={() => router.back()}>
                <ArrowLeft size={18} aria-hidden />
              </Mark>
              <Mark label="Forward" data-slot="forward" onPress={() => router.forward()}>
                <ArrowRight size={18} aria-hidden />
              </Mark>
              <XStack flex={1} self="stretch" {...bar.drag} />
            </XStack>
          ) : null}
          <XStack
            data-room=""
            data-app={mode}
            data-slot="frame"
            {...(bar ? null : floor)}
            flex={1}
            minW={0}
            minH={0}
            pr="var(--pane-gap)"
            pb="var(--pane-gap)"
            pt={bar ? 0 : 'var(--pane-gap)'}
            // A phone's frame is full-bleed on the floor, which follows the theme,
            // so the top of the page the browser's bar tints from does too.
            $max-md={{ p: 0 }}
          >
            <YStack height="100%" $max-md={{ display: 'none' }}>
              <Rail host={host} mode={mode} at={where} open={!closed} toggle={bar ? undefined : flip} onChat={toChat} onDev={toDev} go={move} onOrg={org} />
            </YStack>
            {closed ? null : (
              <YStack $max-md={{ display: 'none' }}>
                <Column host={host} mode={mode} thread={thread} go={move} onShut={() => setClosed(true)} seek={seek} />
              </YStack>
            )}
            <YStack data-slot="stage" flex={1} minW={0} minH={0} ml="var(--pane-gap)" $max-md={{ ml: 0 }}>
              {/* A phone has no rail and no sidebar: the bar opens them as a drawer. */}
              {bar ? null : (
                <XStack data-slot="app-bar" height={44} px="$1" gap="$1" items="center" shrink={0} $md={{ display: 'none' }}>
                  <SidebarIconButton label="Open sidebar" onPress={() => setDrawer(true)} width={44} height={44} rounded={999}>
                    <Menu size={18} />
                  </SidebarIconButton>
                  <Text fontSize="$4" fontWeight="600" color="$ink" numberOfLines={1}>
                    {wordmark(mode)}
                  </Text>
                </XStack>
              )}
              <XStack data-slot="panes" flex={1} minW={0} minH={0}>
                {mode === 'chat' ? (
                  <Paned framed>
                    <Chat />
                  </Paned>
                ) : (
                  <YStack render="main" data-slot="pane" {...(run ? null : { ...pane(), overflow: 'hidden' })} flex={1} minW={0} minH={0}>
                    {plans ? null : <Builder host={host} rail={false} />}
                  </YStack>
                )}
              </XStack>
            </YStack>
          </XStack>
          {drawer ? (
            <>
              <YStack
                render="button"
                aria-label="Close sidebar"
                onPress={() => setDrawer(false)}
                bg={DIM}
                position="absolute"
                t={0}
                r={0}
                b={0}
                l={0}
                z="var(--z-overlay)"
                $md={{ display: 'none' }}
              />
              {/* A phone's sidebar is a drawer: the same column, floating in from
                  the left with the gutter round it, clear of the notch and the
                  home indicator, the rail laid along its foot. */}
              <YStack
                data-slot="drawer"
                position="absolute"
                t={INSET.top}
                b={INSET.bottom}
                l={INSET.left}
                width="min(320px, calc(100% - 2 * var(--pane-gap) - 48px))"
                z="var(--z-modal)"
                $md={{ display: 'none' }}
              >
                <Column
                  host={host}
                  mode={mode}
                  thread={thread}
                  go={move}
                  onShut={shut}
                  seek={seek}
                  drawer
                  foot={<Rail host={host} mode={mode} at={where} open flat onChat={toChat} onDev={toDev} go={move} onOrg={org} />}
                />
              </YStack>
            </>
          ) : null}
        </YStack>
      </HostProvider>
    </AiProvider>
  )
}
