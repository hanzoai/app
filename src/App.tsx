'use client'

// The web app as the whole window, in two modes: Chat, a conversation with the
// product's AI, and Dev, @hanzo/build's `<Builder>` without a rail of its own.
// One column serves both (Column.tsx): the wordmark and the switch, New, Dev's
// places, the reader's Recents in both modes, and the account. The address says
// the mode, as a path (lib/host `talk`, `app`, `place`): `/` and `/chat` are
// Chat on a new conversation, `/chat/<id>` one of the reader's, and a path under
// `/dev` is Dev: `/dev/run/<id>` a run, `/dev/projects/<org>/<repo>` a project.
// Moving between the modes is a history entry (`go`), never a load, so a host
// serves this one component for every path under each.
//
// Every host draws this: hanzo.ai at `/`, the desktop app as its main window.
// The host mounts IamProvider and `<Rooms>` with its router and the path, and
// draws this only for a signed-in reader; what a stranger sees is the host's.
//
// DEV'S PANE HAS NO COLUMN BESIDE IT. The column beside a pane is Chat's (its
// pinned summary, `useOpen().aside`), and that choice outlives a move to Dev,
// where nothing fills it: drawn there it was an empty pane to the right of the
// builder. So Dev's pane is cut on its own and the summary is Chat's alone.
//
// EVERY MOVE PUTS THE DRAWER AWAY, the one to where the reader already is
// included. Pressed on the page it names, a row moves nothing, and a drawer
// that closed only on a new address stayed open over the page it had asked for.
//
// THE PLANS' OWN ADDRESS LEAVES for the pay site in its place (dev.tsx `leave`),
// so the builder's own plans are never drawn.
//
// THE WINDOW IS A FRAME (`data-slot="frame"`): the column, the pane and the
// column beside it are three panes floating on a lit floor (ground.ts), one
// gutter round them and between them, `--pane-gap`, each sized by the edge
// beside it.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Menu } from 'lucide-react'
import { AiProvider } from '@hanzo/ai/react'
import { Text, XStack, YStack } from '@hanzo/gui'
import { Builder, HostProvider, route } from '@hanzo/build'
import { SidebarIconButton } from '@hanzo/ui/chat'
import { useAi } from './lib/ai'
import { Chat } from './Chat'
import { Column } from './Column'
import { isPlans, leave, useDevHost } from './dev'
import { useRooms } from './host'
import { wordmark } from './ModeMark'
import { empty, openThread, useOpen } from './open'
import { Paned } from './Shell'
import { floor, pane } from './ground'
import { app, go, place, talk, type Place } from './lib/host'

/** `/` is Chat on a new conversation. */
const HOME: Place = { mode: 'chat', thread: null }

/**
 * The dim under the phone's drawer: design's scrim at two fifths, so the page
 * still reads through the drawer's glass the way it reads through the browser's
 * own bar, rather than a black wall the glass has nothing to show of. gui
 * carries a `color-mix()` to the page unchanged; its types only name custom
 * properties.
 */
const DIM = 'color-mix(in srgb, var(--surface-scrim) 40%, transparent)' as `var(--${string})`

/** The phone's drawer stands the gutter off each edge, or the device's inset where that is wider. */
const INSET = {
  top: 'max(var(--pane-gap), var(--safe-top))',
  bottom: 'max(var(--pane-gap), var(--safe-bottom))',
  left: 'max(var(--pane-gap), var(--safe-left))',
} as const

/** Where each mode was last, so the switch goes back to it. */
const last = { chat: '', dev: '' }

export function App() {
  const [drawer, setDrawer] = useState(false)
  const shut = useCallback(() => setDrawer(false), [])
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
  const here = useRooms().path ?? '/'
  const at = place(here) ?? HOME
  const mode = at.mode
  // A run floats two panes of its own, so the pane it stands in is not cut.
  const run = at.mode === 'dev' && route(at.at).kind === 'run'
  const asked = at.mode === 'chat' ? at.thread : null
  const { thread } = useOpen()
  const plans = at.mode === 'dev' && isPlans(at.at)
  useEffect(() => {
    if (plans) leave('app')
  }, [plans])

  // An address names Chat's conversation, and one just begun writes its id back.
  useEffect(() => {
    if (mode !== 'chat') return
    if (asked && asked !== thread) openThread(asked)
    else if (!asked && thread) empty()
    // The address decides; the selection follows it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, asked])
  useEffect(() => {
    if (mode === 'chat' && thread && thread !== asked) go(talk(thread), true)
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
  const toChat = () => move(last.chat || talk())
  const toDev = () => move(last.dev || app(''))

  return (
    <AiProvider client={client ?? undefined}>
      <HostProvider host={host}>
        <XStack
          data-room=""
          data-app={mode}
          data-slot="frame"
          {...floor}
          flex={1}
          minW={0}
          p="var(--pane-gap)"
          gap="var(--pane-gap)"
          height="100dvh"
          overflow="hidden"
          // A phone's frame is full-bleed on the floor, which follows the theme,
          // so the top of the page the browser's bar tints from does too.
          $max-md={{ p: 0, gap: 0 }}
        >
          <Column host={host} mode={mode} thread={thread} onChat={toChat} onDev={toDev} go={move} />
          <YStack data-slot="stage" flex={1} minW={0} minH={0} gap="var(--pane-gap)" $max-md={{ gap: 0 }}>
            {/* A phone has no column: the bar opens it as a drawer, whose top row holds the switch. */}
            <XStack data-slot="app-bar" height={44} px="$1" gap="$1" items="center" shrink={0} $md={{ display: 'none' }}>
              <SidebarIconButton label="Open sidebar" onPress={() => setDrawer(true)} width={44} height={44} rounded={999}>
                <Menu size={18} />
              </SidebarIconButton>
              <Text fontSize="$4" fontWeight="600" color="$ink" numberOfLines={1}>
                {wordmark(mode)}
              </Text>
            </XStack>
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
              {/* A phone's column is a drawer: the same pane, floating in from
                  the left with the gutter round it, clear of the notch and the
                  home indicator. */}
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
                <Column host={host} mode={mode} thread={thread} onChat={toChat} onDev={toDev} go={move} drawer />
              </YStack>
            </>
          ) : null}
        </XStack>
      </HostProvider>
    </AiProvider>
  )
}
