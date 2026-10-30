'use client'

// The web app as the whole window, in three modes: Chat, a conversation with
// the product's AI; Dev, @hanzo/build's `<Builder>` without a rail of its own;
// and Studio, @hanzo/studio's `<Studio>` the same way, its places (`nav`) in the
// sidebar where Dev's stand for Dev.
//
//   OUTER  the rail (Rail.tsx) and the sidebar beside it (Sidebar.tsx), on the
//          window's floor, with the window's bar above them where the host has
//          no browser around it (`bar`).
//   INNER  the content, cut as one rounded panel inset from the window's edges
//          and from the sidebar by the gutter (`--pane-gap`): Chat's
//          conversation with its tabs beside it (Split), or Dev's builder.
//
// The rail moves between the modes; the sidebar holds the mode's name, the
// search (the palette, Search.tsx), New, Dev's places and the reader's
// Recents. The address says the mode, as a path (lib/host `talk`, `app`,
// `place`): `/` and `/chat` are Chat on a new conversation, `/chat/<id>` one of
// the reader's, and a path under `/dev` is Dev: `/dev/run/<id>` a run, `/dev/projects/<org>/<repo>` a project; a path
// under `/studio` is Studio, its own address after it (`c/<id>`, `library`). Moving
// between the modes is a history entry (`go`), never a load, so a host serves
// this one component for every path under each.
//
// Every host draws this: hanzo.ai at `/`, `/chat`, `/dev` and `/studio`, and the desktop
// app as its main window. The host mounts IamProvider and `<Host>` with its
// router and the path, and draws this only for a signed-in reader; what a
// stranger sees is the host's.
//
// THE ORGANIZATION COMES FIRST (Gate.tsx), and the app mounts it itself, so no
// host draws the app without it: a reader with none makes one and a reader
// with several picks one. No plan is asked for here: that is the workspace's,
// on its own host (hanzo.team) and behind its front door.
//
// THE SIDEBAR'S TOGGLE IS AT THE WINDOW'S TOP-START (top-left; top-right read
// right to left, where the rail and the sidebar stand at the right and the pane
// is inset from the start by logical sides). In a browser tab it leads the rail. A host that is a window of its own (`bar`) has no browser around
// it, so the app draws the window's bar: the toggle, then Back and Forward
// through the host's router, clear of the window's own controls, and the bar
// drags the window. Shut, the sidebar leaves the rail alone at the edge; the
// choice is kept per browser under the key the builder's rail kept it under.
//
// THE KEYS: ⌘K / Ctrl+K opens the palette, from a field too, ⌘, / Ctrl+,
// opens Settings, and in a window ⌘[ ⌘] / Alt+← Alt+→ are Back and Forward —
// never while the reader types.
//
// DEV'S PANE HAS NO COLUMN BESIDE IT. The column beside a pane is Chat's (its
// tabs, `useOpen().aside`), and that choice outlives a move to Dev, where
// nothing fills it. So Dev's pane is cut on its own and the tabs are Chat's.
//
// EVERY MOVE PUTS THE DRAWER AWAY, the one to where the reader already is
// included. A phone's drawer (Drawer.tsx) is the menu behind the pane, the pane
// sliding toward the end side over it; a move made from it takes its place in
// the history (`depart`), so Back never reopens it.
//
// STUDIO LOADS WITH ITS MODE. Its module (and three.js behind a 3D tab) is
// fetched the first time the reader stands in Studio; its places are a few
// lines and come with the app. Another organization opens it at its New, so
// nothing it read under the last one stays.
//
// THE PLANS' OWN ADDRESS LEAVES for the pay site in its place (dev.tsx `leave`),
// so the builder's own plans are never drawn.

import { useI18n } from '@hanzo/i18n/react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react'
import { AiProvider } from '@hanzo/ai/react'
import { XStack, YStack } from '@hanzo/gui'
import { Builder, HostProvider, PrefsProvider, route, tabs, type Host } from '@hanzo/build'
import { nav as places } from '@hanzo/studio'
import { useAi } from './lib/ai'
import { Chat } from './Chat'
import { UsageProvider } from './Usage'
import { Sidebar } from './Sidebar'
import { Learning } from './Learning'
import { isPlans, leave, useDevHost } from './dev'
import { Gate } from './Gate'
import { useHost } from './host'
import { useKept } from './kept'
import { Mark, raised, Rail, Toggle } from './Rail'
import { Layer, Lift, useDrawer } from './Drawer'
import { empty, openThread, showSettings, useOpen } from './open'
import { Split } from './Shell'
import { Search } from './Search'
import { summons } from './seek'
import { floor, pane } from './ground'
import { pick } from './lib/session'
import { app, go, hosted, place, settings, studio, talk, TERMINALS, visit, type Place } from './lib/host'
import { Bar } from './Bar'
import { FOOT, HEIGHT, TOP, useView } from './view'
import { dragWindow, toggleWindowMaximize, WindowControls } from './WindowControls'

/** Studio, fetched the first time the reader stands in it. */
const Studio = lazy(() => import('@hanzo/studio').then((m) => ({ default: m.Studio })))
/** Tabs, the same way: the terminals on the reader's machines (Terminals.tsx). */
const Terminals = lazy(() => import('./Terminals'))
/** The apps in beta that draw inside the app (lib/hosted), fetched when one is opened at /apps/<id>. */
const Hosted = lazy(() => import('./Hosted').then((m) => ({ default: m.HostedPane })))
/** Betas, fetched when opening /beta in the app. */
const Betas = lazy(() => import('./Betas').then((m) => ({ default: m.BetasPane })))

/** `/` is Chat on a new conversation. */
const HOME: Place = { mode: 'chat', thread: null }

/**
 * The window's bar, for a host that is a window of its own: `inset` px kept
 * clear at its left for the window's own controls (macOS paints its traffic
 * lights over the page there), and `drag`, the attributes the host's shell
 * reads as the region that moves the window.
 */
export interface Titlebar {
  inset?: number
  drag?: Record<string, unknown>
  controls?: React.ReactNode
}

/**
 * `betas`, what a host draws as Betas' whole pane (`/beta`) in place of the
 * app's own list (Betas.tsx `BetasPane`): a site that runs its own beta program
 * (its application, its plan, its referral board) shows it inside the app's
 * window. Betas stands alone, as Tabs does: the rail and the pane, no sidebar.
 */
export interface Hosted {
  bar?: Titlebar
  betas?: React.ReactNode
}

/** The bar's height, px: the reference window's title bar. */
const BAR = 40

/** Where each mode was last, so the rail goes back to it. */
const last = { chat: '', dev: '', studio: '', tabs: '' }

/** Whether a key press is the reader typing, where the app's keys are the field's. */
const typing = (e: KeyboardEvent): boolean => {
  const el = e.target as HTMLElement | null
  return !!el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
}

export function App({ bar, betas }: Hosted = {}) {
  return (
    <Gate>
      <Window bar={bar} betas={betas} />
    </Gate>
  )
}

/** The window itself, drawn once the organization is settled. */
function Window({ bar, betas }: Hosted) {
  const { t } = useI18n()
  const drawer = useDrawer()
  const { close: shut, depart, exit } = drawer
  // On a phone the window stands in the visual viewport, so the keyboard never covers the composer (view.ts).
  const view = useView()
  const hold = drawer.window
  const windowRef = useCallback(
    (node: unknown) => {
      view(node)
      hold(node)
    },
    [view, hold],
  )
  // The sidebar shut, kept per browser under the key the builder's rail kept it under.
  const [closed, setClosed] = useKept('hanzo.build.rail', false)
  // The palette is open (the sidebar's search; ⌘K toggles it).
  const [finding, setFinding] = useState(false)
  const [learning, setLearning] = useState(false)
  const found = useCallback(() => setFinding(false), [])
  const dev = useDevHost()
  // The builder's moves put the drawer away, in its place in the history; one to
  // a page outside the app (Settings) leaves it through the router.
  const host = useMemo<typeof dev>(
    () => ({
      ...dev,
      go: (to, how) => (place(app(to)) ? depart : exit)((replace) => dev.go(to, replace ? { ...how, replace } : how)),
    }),
    [dev, depart, exit],
  )
  const { client } = useAi()
  const { router, path } = useHost()
  const here = path ?? '/'
  const at = place(here) ?? HOME
  const mode = at.mode
  // Tabs, Betas and the hosted apps are their panes alone: no sidebar beside them, and no Dev places in a phone's menu.
  const alone = mode === 'tabs' || mode === 'beta' || mode === 'hosted'
  // The hosted app the address names (lib/hosted), for the rail to light.
  const inside = at.mode === 'hosted' ? at.id : null
  const where = at.mode === 'dev' ? at.at : null
  // Studio's host: Dev's, at Studio's address, its moves under /studio, and
  // another organization opening Studio's New in it.
  const made = at.mode === 'studio' ? at.at : ''
  const maker = useMemo<Host>(
    () => ({
      ...host,
      name: 'Hanzo Studio',
      path: made,
      go: (to, how) => depart((replace) => go(studio(to), replace || how?.replace)),
      chooseOrg: (next) => {
        pick(next)
        window.location.assign(studio(''))
      },
    }),
    [host, made, depart],
  )
  // A run floats two panes of its own, so the pane it stands in is not cut.
  const run = where !== null && route(where).kind === 'run'
  const asked = at.mode === 'chat' ? at.thread : null
  const { thread, settings: wanted } = useOpen()
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

  // The address moved under the drawer: it goes, and the history keeps the move.
  const drop = drawer.drop
  useEffect(() => {
    last[mode] = `${window.location.pathname}${window.location.search}`
    drop()
  }, [mode, here, drop])
  // Where the reader was before a place that takes the sidebar (Library, Scheduled
  // tasks, Customize): its Back returns there, Chat or Dev alike.
  const away = useRef('')
  const inPlace = mode === 'dev' && raised(where) !== null
  useEffect(() => {
    if (!inPlace) away.current = `${window.location.pathname}${window.location.search}`
  }, [inPlace, here])

  /**
   * A move: the drawer away, the address in its place. One of the app's moves
   * the app; any other page of the site (Settings) is the router's, and leaves it.
   */
  const move = useCallback(
    (address: string) => (place(address.split(/[?#]/)[0]) ? depart : exit)((replace) => visit(router, address, replace)),
    [depart, exit, router],
  )

  // A pane asks for Settings — the account menu's rows, Chat's See usage: its
  // page (lib/host `settings`), through the router, the drawer away.
  useEffect(() => {
    if (!wanted) return
    showSettings(null)
    move(settings(wanted))
  }, [wanted, move])

  // The app's keys.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (summons(e)) {
        e.preventDefault()
        setFinding((open) => !open)
        return
      }
      if (typing(e)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && !e.altKey && e.key === ',') {
        e.preventDefault()
        move(settings())
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
  }, [bar, router, move])

  const back = () => move(away.current || app(''))
  const toChat = () => move(last.chat || talk())
  const toDev = () => move(last.dev || app(''))
  const toStudio = () => move(last.studio || studio(''))
  const toTabs = () => move(TERMINALS)
  // Another organization: picked, and the app opened in it at the mode's New.
  const org = (o: string) => {
    pick(o)
    window.location.assign(mode === 'dev' ? app('') : mode === 'studio' ? studio('') : mode === 'tabs' ? TERMINALS : inside ? hosted(inside) : talk())
  }
  const sidebar = mode === 'beta' || mode === 'hosted' ? [] : mode === 'studio' ? places(maker, (p) => maker.go(p)) : mode === 'dev' && raised(where) === 'customize'
    ? tabs(host, (p) => host.go(p), t).map((group) => ({ ...group, links: [...group.links, {
      id: 'learning', label: t('Learning'), active: learning, icon: <RefreshCw size={16} aria-hidden />,
      onPress: () => { shut(); setLearning(true) },
    }] })) : undefined
  const flip = () => setClosed(!closed)
  const seek = () => {
    shut()
    setFinding(true)
  }

  return (
    <AiProvider client={client ?? undefined}>
      <HostProvider host={host}>
        {/* The person's preferences, read once for Chat and Dev: the side panel's width is one of them. */}
        <PrefsProvider>
          <UsageProvider>
        {/* The floor runs under the bar where there is one, so the window is one ground. */}
        <YStack
          ref={windowRef}
          data-slot="window"
          {...(bar ? floor : null)}
          flex={1}
          minW={0}
          height={bar ? '100%' : '100dvh'}
          overflow="hidden"
          rounded={bar ? '$3' : undefined}
          // Clipped, not hidden, on a phone: the drawer slides the pane past the window's edge, and a
          // hidden overflow is still a scroller that a `scrollIntoView` inside the pane would move.
          $max-md={{ position: 'fixed', t: TOP, l: 0, r: 0, height: HEIGHT, ...({ overflow: 'clip' } as object) }}
        >
          {bar ? (
            // The inset is the window's own controls', which the host's shell paints at the window's left whatever the page's direction.
            <XStack
              data-slot="title-bar"
              height={BAR}
              shrink={0}
              items="center"
              gap={2}
              pl={(bar.inset ?? 0) + 6}
              pr="$2"
              onMouseDown={dragWindow}
              onDoubleClick={toggleWindowMaximize}
              {...bar.drag}
            >
              {/* From a tablet up the toggle shuts the sidebar; on a phone it opens the drawer. */}
              <XStack $max-md={{ display: 'none' }}>
                <Toggle open={!closed} onPress={flip} />
              </XStack>
              <XStack $md={{ display: 'none' }}>
                <Toggle open={drawer.state === 'open'} onPress={drawer.open} label={t('Open sidebar')} />
              </XStack>
              <Mark label={t('Back')} data-slot="back" onPress={() => router.back()}>
                <ArrowLeft size={18} aria-hidden data-i18n-mirror />
              </Mark>
              <Mark label={t('Forward')} data-slot="forward" onPress={() => router.forward()}>
                <ArrowRight size={18} aria-hidden data-i18n-mirror />
              </Mark>
              <XStack
                flex={1}
                self="stretch"
                {...bar.drag}
              />
              {bar.controls !== undefined ? (
                bar.controls
              ) : !bar.inset ? (
                <WindowControls />
              ) : null}
            </XStack>
          ) : null}
          <XStack
            ref={drawer.pane}
            data-app={mode}
            data-slot="frame"
            {...(bar ? null : floor)}
            // While a phone's drawer is out the pane is raised over it, sliding toward the end side.
            {...drawer.slide}
            flex={1}
            minW={0}
            minH={0}
            paddingInlineEnd="var(--pane-gap)"
            pb="var(--pane-gap)"
            // The gap above the pane is the gap at its end and foot; a window's own bar above it is that gap.
            pt={bar ? 0 : 'var(--pane-gap)'}
            // A phone's frame is full-bleed on the floor, which follows the theme,
            // so the top of the page the browser's bar tints from does too.
            $max-md={{ p: 0 }}
          >
            {drawer.slide ? <Lift /> : null}
            <YStack height="100%" $max-md={{ display: 'none' }}>
              <Rail host={host} mode={mode} at={where} inside={inside} open={!closed} toggle={bar ? undefined : flip} onChat={toChat} onDev={toDev} onStudio={toStudio} onTabs={toTabs} go={move} onOrg={org} />
            </YStack>
            {/* Tabs and Betas stand alone: no sidebar beside them. */}
            {closed || alone ? null : (
              <YStack $max-md={{ display: 'none' }}>
                <Sidebar host={host} mode={mode} thread={thread} go={move} onShut={() => setClosed(true)} onSeek={seek} onBack={back} places={sidebar} />
              </YStack>
            )}
            <YStack
              data-slot="stage"
              // A column: the phone's bar, then the panes taking the rest. Not a grid of `auto` and
              // `1fr` rows: from md the bar is display none, which leaves the grid, so the panes were
              // placed in the `auto` row and stood their content's height, and Dev's pane, which
              // scrolls inside, collapsed to its border (Projects drew blank). The rest of the row
              // beside the rail and the sidebar, never width 100%: a View does not shrink, so at the
              // row's full width again the pane stood past the window's edge.
              flex={1}
              minW={0}
              minH={0}
              marginInlineStart={closed || alone ? 0 : 'var(--pane-gap)'}
              $max-md={{ marginInlineStart: 0, pb: `max(var(--pane-gap), ${FOOT})` }}
            >
              {/* A phone has no rail and no sidebar: its bar opens them as a drawer and switches Chat and Dev. */}
              {bar ? null : <Bar host={host} mode={mode} places={sidebar} open={drawer.state !== 'shut'} go={move} onMenu={drawer.open} onChat={toChat} onDev={toDev} />}
              {/* The stage's rest: the pane, and beside it the column a pane opens (Split names
                  them `pane` and `side`). The areas are named here because Split places its two by
                  name; unnamed, `grid-area: pane` made implicit tracks and Chat's pane stood its
                  content's size in the far corner. A pane scrolls inside its cell rather than
                  growing past it. */}
              <XStack
                data-slot="panes"
                flex={1}
                display="grid"
                gridTemplateAreas={'"pane side"'}
                gridTemplateColumns="minmax(0, 1fr) auto"
                gridTemplateRows="minmax(0, 1fr)"
                minW={0}
                minH={0}
              >
                {mode === 'chat' ? (
                  <Split framed>
                    <Chat />
                  </Split>
                ) : mode === 'tabs' ? (
                  <YStack render="main" data-slot="pane" {...pane()} overflow="hidden" flex={1} minW={0} minH={0}>
                    <Suspense fallback={null}>
                      <Terminals />
                    </Suspense>
                  </YStack>
                ) : mode === 'studio' ? (
                  <YStack render="main" data-slot="pane" {...pane()} overflow="hidden" flex={1} minW={0} minH={0}>
                    <YStack flex={1} minH={0} height="100%">
                      <Suspense fallback={null}>
                        <Studio host={maker} rail={false} />
                      </Suspense>
                    </YStack>
                  </YStack>
                ) : at.mode === 'hosted' ? (
                  <YStack render="main" data-slot="pane" {...pane()} overflow="hidden" flex={1} minW={0} minH={0}>
                    <Suspense fallback={null}>
                      <Hosted id={at.id} go={move} />
                    </Suspense>
                  </YStack>
                ) : mode === 'beta' ? (
                  <YStack render="main" data-slot="pane" {...pane()} overflowY="auto" overflowX="hidden" flex={1} minW={0} minH={0} p="$4" $md={{ p: '$6' }}>
                    {betas ?? (
                      <Suspense fallback={null}>
                        <Betas go={move} />
                      </Suspense>
                    )}
                  </YStack>
                ) : (
                  <YStack render="main" data-slot="pane" {...(run ? null : { ...pane(), overflow: 'hidden' })} flex={1} minW={0} minH={0}>
                    {plans ? null : <Builder host={host} rail={false} />}
                  </YStack>
                )}
              </XStack>
            </YStack>
          </XStack>
          {drawer.state === 'shut' ? null : (
            // A phone's sidebar is the menu behind the pane: the rail down its start edge, every
            // product a mark and the account at its foot as on a laptop, then the same column on
            // the floor. New chat is the bar's, so the foot carries nothing of its own.
            <Layer drawer={drawer} top={bar ? BAR : 0}>
              <XStack flex={1} minH={0}>
                <YStack data-slot="drawer-rail" shrink={0} pt="$2">
                  <Rail host={host} mode={mode} at={where} inside={inside} open onChat={toChat} onDev={toDev} onStudio={toStudio} onTabs={toTabs} go={move} onOrg={org} />
                </YStack>
                <YStack flex={1} minW={0}>
                  <Sidebar
                    host={host}
                    mode={mode}
                    thread={thread}
                    go={move}
                    onShut={shut}
                    onSeek={seek}
                    onBack={back}
                    drawer
                    places={sidebar}
                  />
                </YStack>
              </XStack>
            </Layer>
          )}
          {finding ? <Search go={move} onClose={found} mode={mode} host={host} /> : null}
          {learning ? <Learning open onClose={() => setLearning(false)} /> : null}
        </YStack>
          </UsageProvider>
        </PrefsProvider>
      </HostProvider>
    </AiProvider>
  )
}
