'use client'

// The web app as the whole window, in three modes: Chat, a conversation with
// the product's AI; Dev, @hanzo/dev-core's thread view and its thread list (one Dev, no Builder);
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
import { ChevronLeft, ChevronRight, Clapperboard, RefreshCw, Sparkles, Workflow } from 'lucide-react'
import { AiProvider } from '@hanzo/ai/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Text } from '@hanzo/ui'
import { HostProvider, PrefsProvider, route, tabs, type Host } from '@hanzo/build'
import * as studioPkg from '@hanzo/studio'
import { nav as places } from '@hanzo/studio'
import { useAi } from './lib/ai'
import { UsageProvider } from './Usage'
import { AnonSettingsPane, dispatchTabsAction, Sidebar } from './Sidebar'
import { Learning } from './Learning'
import { isPlans, leave, useDevHost } from './dev'
import { Gate } from './Gate'
import { Chat } from './Chat'
import { DevInterior, DevScope } from './DevPane'
import { useHost } from './host'
import { useKept } from './kept'
import { CHEVRON } from './icons'
import { Mark, raised, Rail, RAIL_FOLDED, Toggle, usePinnedNav } from './Rail'
import { Layer, Lift, useDrawer } from './Drawer'
import { empty, openThread, showSettings, useOpen } from './open'
import { SkipLink } from './SkipLink'
import { Split } from './Shell'
import { Search } from './Search'
import { cyclePanel, focusSidebar, useGlobalKeys } from './keys'
import { Shortcuts } from './Shortcuts'
import { BAR, floor, pane } from './ground'
import { org as currentOrg, pick } from './lib/session'
import { rememberSettingsReturn } from './lib/dev-mode'
import { useFree } from './Upgrade'
import { payUrl } from './lib/pay'
import { Ask, useBetas } from './Betas'
import { BETAS } from './lib/betas'
import { app, design, flow, go, hosted, place, settings, studio, talk, TERMINALS, visit, type Place } from './lib/host'
import { Bar } from './Bar'
import { Report } from './Report'
import { FOOT, HEIGHT, TOP, useView } from './view'
import { dragWindow, toggleWindowMaximize, WindowControls } from './WindowControls'
import { AppContextMenu } from './ContextMenu'

const flowNav = (Reflect.get(studioPkg, 'flowNav') as typeof places | undefined) ?? places

/** Studio, fetched the first time the reader stands in it. */
const Studio = lazy(() => import('@hanzo/studio').then((m) => ({ default: m.Studio })))
const FlowStudio = lazy(() =>
  import('@hanzo/studio').then((m) => ({
    default: (m as unknown as { FlowStudio?: React.ComponentType<{ host: Host }> }).FlowStudio ?? m.Studio,
  })),
)
/** Tabs, the same way: the terminals on the reader's machines (Terminals.tsx). */
const Terminals = lazy(() => import('./Terminals'))
/** The apps in beta that draw inside the app (lib/hosted), fetched when one is opened at /apps/<id>. */
const Hosted = lazy(() => import('./Hosted').then((m) => ({ default: m.HostedPane })))
/** Betas, fetched when opening /beta in the app. */
const Betas = lazy(() => import('./Betas').then((m) => ({ default: m.BetasPane })))
/** `/` is Chat on a new conversation. */
const HOME: Place = { mode: 'chat', thread: null }

/** What a window's bar names the page by; Chat names itself in the sidebar. */
const TITLES: Record<string, string> = { dev: 'Dev', studio: 'Studio', design: 'Design', flow: 'Flow', tabs: 'Tabs' }

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


/** Where each mode was last, so the rail goes back to it. */
const last = { chat: '', dev: '', studio: '', design: '', flow: '', tabs: '' }

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
  const [listing, setListing] = useState(false)
  const [learning, setLearning] = useState(false)
  const [anonSettings, setAnonSettings] = useState(false)
  const found = useCallback(() => setFinding(false), [])
  const closedRef = useRef(closed)
  closedRef.current = closed
  const flip = useCallback(() => setClosed(!closedRef.current), [setClosed])
  const pins = usePinnedNav()
  const dev = useDevHost()
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onAnonSettings = (e: Event) => {
      const detail = (e as CustomEvent<{ open?: boolean }>).detail
      setAnonSettings(detail?.open ?? true)
    }
    window.addEventListener('hanzo:anon-settings', onAnonSettings)
    return () => window.removeEventListener('hanzo:anon-settings', onAnonSettings)
  }, [])
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
  const free = useFree(Boolean(host.token?.()))
  const { router, path } = useHost()
  const here = path ?? '/'
  const at = place(here) ?? HOME
  const mode = at.mode
  const { open: betaOpen } = useBetas()
  const blockedBeta = (mode === 'studio' || mode === 'flow') && !betaOpen(mode)
  // Every mode carries its sidebar beside the rail (or its title when it has no places of its own).
  const alone = false
  // The hosted app the address names (lib/hosted), for the rail to light.
  const inside = at.mode === 'hosted' ? at.id : null
  const where = at.mode === 'dev' ? at.at : null
  // Studio, Design & Flow host: Dev's, at Studio's (/studio), Design's (/design) or Flow's (/flow) address.
  const inDesign = at.mode === 'design'
  const inStudio = at.mode === 'studio'
  const inFlow = at.mode === 'flow'
  const made = inDesign || inStudio || inFlow ? at.at : ''
  const modeRoute = inDesign ? design : inFlow ? flow : studio
  const modeName = inDesign ? 'Design' : inFlow ? 'Flow' : 'Studio'
  const maker = useMemo<Host>(
    () => ({
      ...host,
      name: modeName,
      path: made,
      go: (to, how) => depart((replace) => go(modeRoute(to), replace || how?.replace)),
      chooseOrg: (next) => {
        pick(next)
        window.location.assign(modeRoute(''))
      },
    }),
    [host, modeName, modeRoute, made, depart],
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
  // Where the reader was before a place that takes the sidebar (Library, Scheduled
  // tasks, Customize): its Back returns there, Chat or Dev alike.
  const away = useRef('')
  const inPlace = mode === 'dev' && raised(where) !== null
  useEffect(() => {
    const devChat = where !== null && (route(where).kind === 'new' || route(where).kind === 'run')
    if (!inPlace && (mode !== 'dev' || devChat)) {
      last[mode] = `${window.location.pathname}${window.location.search}`
    }
    drop()
  }, [mode, here, drop, inPlace, where])
  useEffect(() => {
    if (!inPlace) away.current = `${window.location.pathname}${window.location.search}`
  }, [inPlace, here])

  /**
   * A move: the drawer away, the address in its place. One of the app's moves
   * the app; any other page of the site (Settings) is the router's, and leaves it.
   */
  const move = useCallback(
    (address: string) => {
      const clean = address.split(/[?#]/)[0]
      if (!host.token?.() && clean.startsWith('/settings')) {
        shut()
        setAnonSettings(true)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('hanzo:anon-settings', { detail: { open: true } }))
        }
        return
      }
      setAnonSettings(false)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hanzo:anon-settings', { detail: { open: false } }))
      }
      ;(place(clean) ? depart : exit)((replace) => visit(router, address, replace))
    },
    [depart, exit, router, host, shut],
  )

  // A pane asks for Settings — the account menu's rows, Chat's See usage: its
  // page (lib/host `settings`), through the router, the drawer away.
  useEffect(() => {
    if (!wanted) return
    showSettings(null)
    if (!host.token?.() && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hanzo:anon-settings'))
      return
    }
    rememberSettingsReturn()
    move(settings(wanted))
  }, [wanted, move, host])

  // The app's keys: the one keymap's, handled once (keys.ts). A section is the nth of the rail.
  const sections = [() => toChat(), () => toDev(), () => toDesign(), () => toStudio(), () => toTabs()]
  useGlobalKeys({
    desktop: Boolean(bar),
    find: () => setFinding((open) => !open),
    newChat: () => {
      empty()
      move(mode === 'dev' ? app('') : talk())
    },
    sidebar: flip,
    shortcuts: () => setListing((open) => !open),
    back: () => router.back(),
    forward: () => router.forward(),
    section: (n) => sections[n - 1]?.(),
    focusComposer: () => {
      if (mode === 'dev') void import('@hanzo/dev-core').then((m) => m.focusComposer())
      else document.querySelector<HTMLElement>('#main-content textarea, #main-content [contenteditable="true"]')?.focus()
    },
    focusList: () => {
      if (mode === 'dev') void import('@hanzo/dev-core').then((m) => m.focusThreadList() || focusSidebar())
      else focusSidebar()
    },
    panel: (step) => cyclePanel(step),
    settings: () => {
      if (!host.token?.()) {
        window.dispatchEvent(new CustomEvent('hanzo:anon-settings'))
        return
      }
      rememberSettingsReturn()
      move(settings('account'))
    },
    chooseTheme: host.chooseTheme,
    say: (message) => void import('@hanzo/ui').then((m) => m.toast?.success(message)),
  })

  const back = () => move(away.current || app(''))
  const toChat = () => move(last.chat || talk())
  const toDev = () => move(mode === 'dev' && !inPlace ? app('') : last.dev || app(''))
  const toDesign = () => move(last.design || design(''))
  const toStudio = () => move(last.studio || studio(''))
  const toTabs = () => move(TERMINALS)
  // Another organization: picked, and the app opened in it at the mode's New.
  const org = (o: string) => {
    pick(o)
    window.location.assign(mode === 'dev' ? app('') : mode === 'design' ? design('') : mode === 'flow' ? flow('') : mode === 'studio' ? studio('') : mode === 'tabs' ? TERMINALS : inside ? hosted(inside) : talk())
  }
  const sidebar = mode === 'beta' || mode === 'hosted' ? [] : mode === 'design' ? places(maker, (p) => maker.go(p)) : mode === 'flow' ? flowNav(maker, (p) => maker.go(p)) : mode === 'studio' ? places(maker, (p) => maker.go(p)) : mode === 'dev' && raised(where) === 'customize'
    ? tabs(host, (p) => host.go(p), t).map((group) => ({ ...group, links: [...group.links, {
      id: 'learning', label: t('Learning'), active: learning, icon: <RefreshCw size={16} aria-hidden />,
      onPress: () => { shut(); setLearning(true) },
    }] })) : undefined
  const seek = () => {
    shut()
    setFinding(true)
  }

  return (
    <Report>
    <AiProvider client={client ?? undefined}>
      <HostProvider host={host}>
        {/* The person's preferences, read once for Chat and Dev: the side panel's width is one of them. */}
        <PrefsProvider>
          <UsageProvider>
            <DevScope active={mode === 'dev'} path={here}>
        {/* The floor runs under the bar where there is one, so the window is one ground. */}
        <YStack
          ref={windowRef}
          data-slot="window"
          {...floor}
          flex={1}
          minW={0}
          height={bar ? '100%' : '100dvh'}
          overflow="hidden"
          // Clipped, not hidden, on a phone: the drawer slides the pane past the window's edge, and a
          // hidden overflow is still a scroller that a `scrollIntoView` inside the pane would move.
          $max-md={{ position: 'fixed', t: TOP, l: 0, r: 0, height: HEIGHT, ...({ overflow: 'clip' } as object) }}
        >
          <SkipLink />
          {bar ? (
            <XStack data-slot="title-bar" height={BAR} shrink={0} items="center" onMouseDown={dragWindow} onDoubleClick={toggleWindowMaximize} {...bar.drag}>
              <XStack
                data-slot="title-bar-start"
                height="100%"
                items="center"
                gap={2}
                pl={(bar.inset ?? 0) + 4}
                pr={6}
                shrink={0}
                width={closed ? RAIL_FOLDED : ('calc(var(--pane-gap) + var(--app-sidebar-span, 256px))' as never)}
                {...bar.drag}
              >
                <XStack $md={{ display: 'none' }}>
                  <Toggle open={drawer.state === 'open'} onPress={drawer.open} />
                </XStack>
                <XStack $max-md={{ display: 'none' }}>
                  <Toggle open={!closed} onPress={flip} />
                </XStack>
                <Mark label={t('Back')} data-slot="back" onPress={() => router.back()}>
                  <ChevronLeft size={16} strokeWidth={CHEVRON} aria-hidden data-i18n-mirror />
                </Mark>
                <Mark label={t('Forward')} data-slot="forward" onPress={() => router.forward()}>
                  <ChevronRight size={16} strokeWidth={CHEVRON} aria-hidden data-i18n-mirror />
                </Mark>
              </XStack>
              <XStack data-slot="title-bar-main" flex={1} minW={0} self="stretch" items="center" justify="space-between" pl={14} pr={8} gap={6} {...bar.drag}>
                <Text fontSize="$2" fontWeight="500" color="$ink" numberOfLines={1}>
                  {TITLES[mode] ?? ''}
                </Text>
                {bar.controls !== undefined ? bar.controls : !bar.inset ? <WindowControls /> : null}
              </XStack>
            </XStack>
          ) : null}
          <XStack
            ref={drawer.pane}
            data-app={mode}
            data-slot="frame"
            bg="transparent"
            // While a phone's drawer is out the pane is raised over it, sliding toward the end side.
            {...drawer.slide}
            flex={1}
            minW={0}
            minH={0}
            paddingInlineEnd="var(--pane-gap)"
            pb="var(--pane-gap)"
            pt="var(--pane-gap)"
            // A phone's frame is full-bleed on the floor, which follows the theme,
            // so the top of the page the browser's bar tints from does too. Under a window's bar the
            // panel still stands the gap from it.
            $max-md={{ p: 0, ...(bar ? { pt: 'var(--pane-gap)' } : null) }}
          >
            {drawer.slide ? <Lift /> : null}
            <YStack height="100%" position="relative" display={closed ? 'flex' : 'none'} $max-md={{ display: 'none' }}>
              <Rail
                pins={pins}
                host={host}
                mode={mode}
                at={where}
                inside={inside}
                open={!closed}
                onOpen={bar ? undefined : () => setClosed(false)}
                onNew={() => {
                  if (mode === 'dev') move(app(''))
                  else if (mode === 'design') move(design(''))
                  else if (mode === 'studio') move(studio(''))
                  else if (mode === 'flow') move(flow(''))
                  else if (mode === 'tabs') dispatchTabsAction({ kind: 'shell' })
                  else {
                    empty()
                    move(talk())
                  }
                }}
                onChat={toChat}
                onDev={toDev}
                onDesign={toDesign}
                onStudio={toStudio}
                onTabs={toTabs}
                go={move}
                onOrg={org}
              />
              {closed ? (
                <YStack
                  data-slot="sidebar-reopen-edge"
                  position="absolute"
                  t={0}
                  b={0}
                  r={-4}
                  width={8}
                  z="var(--z-raised)"
                  cursor="ew-resize"
                  onDoubleClick={() => setClosed(false)}
                  onMouseDown={(down: unknown) => {
                    const e = down as { clientX?: number; preventDefault?: () => void }
                    const startX = e.clientX ?? 0
                    const onMove = (mv: MouseEvent) => {
                      if (Math.abs(mv.clientX - startX) > 12) {
                        setClosed(false)
                        window.removeEventListener('mousemove', onMove)
                        window.removeEventListener('mouseup', onUp)
                      }
                    }
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove)
                      window.removeEventListener('mouseup', onUp)
                    }
                    window.addEventListener('mousemove', onMove)
                    window.addEventListener('mouseup', onUp)
                  }}
                />
              ) : null}
            </YStack>
            {/* Unified desktop sidebar (hidden when folded to the 52px icon rail). */}
            {closed || alone ? null : (
              <YStack marginInlineStart="var(--pane-gap)" $max-md={{ display: 'none' }}>
                <Sidebar
                  pins={pins}
                  host={host}
                  mode={mode}
                  thread={thread}
                  inside={inside}
                  go={move}
                  onShut={bar ? undefined : () => setClosed(true)}
                  onSeek={seek}
                  onBack={back}
                  onChat={toChat}
                  onDev={toDev}
                  onDesign={toDesign}
                  onStudio={toStudio}
                  onTabs={toTabs}
                  onOrg={org}
                  places={sidebar}
                  made={maker}
                />
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
              // On a phone the bar above the panel is the page's own: the panel stands the same gap from it as from the foot.
              $max-md={{ marginInlineStart: 0, gap: 'var(--pane-gap)', pb: `max(var(--pane-gap), ${FOOT})` }}
            >
              {/* A phone has no rail and no sidebar: its bar opens them as a drawer, and the drawer lists the places. */}
              {bar ? null : <Bar host={host} mode={mode} places={sidebar} open={drawer.state !== 'shut'} go={move} onMenu={drawer.open} />}
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
                {anonSettings && host.person === null ? (
                  <YStack id="main-content" tabIndex={-1} render="main" data-slot="pane" {...pane()} overflow="hidden" flex={1} minW={0} minH={0}>
                    <AnonSettingsPane
                      host={host}
                      onClose={() => {
                        setAnonSettings(false)
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('hanzo:anon-settings', { detail: { open: false } }))
                        }
                      }}
                    />
                  </YStack>
                ) : mode === 'chat' ? (
                  <Split framed>
                    <Chat />
                  </Split>
                ) : mode === 'tabs' ? (
                  <YStack id="main-content" tabIndex={-1} render="main" data-slot="pane" {...pane()} overflow="hidden" flex={1} minW={0} minH={0}>
                    <Suspense fallback={null}>
                      <Terminals />
                    </Suspense>
                  </YStack>
                ) : mode === 'design' ? (
                  <YStack id="main-content" tabIndex={-1} render="main" data-slot="pane" {...pane()} overflow="hidden" flex={1} minW={0} minH={0}>
                    <YStack flex={1} minH={0} height="100%">
                      <Suspense fallback={null}>
                        <Studio host={maker} rail={false} />
                      </Suspense>
                    </YStack>
                  </YStack>
                ) : mode === 'flow' ? (
                  <YStack id="main-content" tabIndex={-1} render="main" data-slot="pane" {...pane()} overflow="hidden" flex={1} minW={0} minH={0}>
                    {blockedBeta ? (
                      <YStack data-slot="hosted-request" flex={1} minH={0} items="center" justify="center" p="$6">
                        <YStack width="100%" maxW={440} gap="$4">
                          <XStack items="center" gap="$3">
                            <XStack width={44} height={44} rounded="$4" bg="$hover" items="center" justify="center" shrink={0}>
                              <Workflow size={22} aria-hidden />
                            </XStack>
                            <YStack gap={2} minW={0}>
                              <XStack items="center" gap="$2">
                                <Text fontSize="$6" fontWeight="600" color="$ink">Flow</Text>
                                <Text fontSize="$1" color="$quiet" px="$2" py={2} rounded="$2" bg="$hover">{t('Beta')}</Text>
                              </XStack>
                              <Text fontSize="$3" color="$quiet">{BETAS.find((b) => b.id === 'flow')?.line ?? 'Visual workflows and multi-agent pipelines.'}</Text>
                            </YStack>
                          </XStack>
                          <XStack items="center" gap="$2" pt="$1">
                            <Ask beta={BETAS.find((b) => b.id === 'flow')!} go={move} />
                            <Button variant="ghost" size="sm" onPress={() => move('/beta')}>{t('All betas')}</Button>
                          </XStack>
                        </YStack>
                      </YStack>
                    ) : (
                      <YStack flex={1} minH={0} height="100%">
                        <Suspense fallback={null}>
                          <FlowStudio host={maker} />
                        </Suspense>
                      </YStack>
                    )}
                  </YStack>
                ) : mode === 'studio' ? (
                  <YStack id="main-content" tabIndex={-1} render="main" data-slot="pane" {...pane()} overflow="hidden" flex={1} minW={0} minH={0}>
                    {blockedBeta ? (
                      <YStack data-slot="hosted-request" flex={1} minH={0} items="center" justify="center" p="$6">
                        <YStack width="100%" maxW={440} gap="$4">
                          <XStack items="center" gap="$3">
                            <XStack width={44} height={44} rounded="$4" bg="$hover" items="center" justify="center" shrink={0}>
                              <Clapperboard size={22} aria-hidden />
                            </XStack>
                            <YStack gap={2} minW={0}>
                              <XStack items="center" gap="$2">
                                <Text fontSize="$6" fontWeight="600" color="$ink">Studio</Text>
                                <Text fontSize="$1" color="$quiet" px="$2" py={2} rounded="$2" bg="$hover">{t('Beta')}</Text>
                              </XStack>
                              <Text fontSize="$3" color="$quiet">{BETAS.find((b) => b.id === 'studio')?.line ?? 'Director Studio for AI film, video, and creative production.'}</Text>
                            </YStack>
                          </XStack>
                          <XStack items="center" gap="$2" pt="$1">
                            <Ask beta={BETAS.find((b) => b.id === 'studio')!} go={move} />
                            <Button variant="ghost" size="sm" onPress={() => move('/beta')}>{t('All betas')}</Button>
                          </XStack>
                        </YStack>
                      </YStack>
                    ) : (
                      <YStack flex={1} minH={0} height="100%">
                        <Suspense fallback={null}>
                          <Studio host={maker} rail={false} />
                        </Suspense>
                      </YStack>
                    )}
                  </YStack>
                ) : at.mode === 'hosted' ? (
                  <YStack id="main-content" tabIndex={-1} render="main" data-slot="pane" {...pane()} overflow="hidden" flex={1} minW={0} minH={0}>
                    <Suspense fallback={null}>
                      <Hosted id={at.id} go={move} />
                    </Suspense>
                  </YStack>
                ) : mode === 'beta' ? (
                  <YStack id="main-content" tabIndex={-1} render="main" data-slot="pane" {...pane()} overflowY="auto" overflowX="hidden" flex={1} minW={0} minH={0} p="$4" $md={{ p: '$6' }}>
                    {betas ?? (
                      <Suspense fallback={null}>
                        <Betas go={move} />
                      </Suspense>
                    )}
                  </YStack>
                ) : (
                  <YStack id="main-content" tabIndex={-1} render="main" data-slot="pane" {...(run ? null : { ...pane(), overflow: 'hidden' })} position="relative" flex={1} minW={0} minH={0}>
                    {!plans && !run && !inPlace && closed && free && host.person !== null ? (
                      <XStack position="absolute" t={8} r={12} z="var(--z-raised)" items="center" $max-md={{ display: 'none' }}>
                        <XStack
                          render="button"
                          data-slot="header-upgrade"
                          aria-label={t('Upgrade plan')}
                          items="center"
                          gap="$1.5"
                          px="$2"
                          py="$1"
                          rounded="$3"
                          bg="transparent"
                          cursor="pointer"
                          hoverStyle={{ bg: '$hover' }}
                          onClick={() => window.location.assign(payUrl('/cart', { org: currentOrg(), returnUrl: window.location.href }))}
                        >
                          <Sparkles size={14} color="var(--muted-foreground)" aria-hidden />
                          <Text fontSize="$3" fontWeight="500" color="$soft" numberOfLines={1}>
                            {t('Upgrade plan')}
                          </Text>
                        </XStack>
                      </XStack>
                    ) : null}
                    {plans ? null : <DevInterior host={host} path={here} />}
                  </YStack>
                )}
              </XStack>
            </YStack>
          </XStack>
          {drawer.state === 'shut' ? null : (
            // Single unified mobile drawer sidebar — zero side-by-side double rail.
            <Layer drawer={drawer} top={bar ? BAR : 0}>
              <XStack flex={1} minH={0}>
                <YStack flex={1} minW={0}>
                  <Sidebar
                    pins={pins}
                    host={host}
                    mode={mode}
                    thread={thread}
                    inside={inside}
                    go={move}
                    onShut={shut}
                    onSeek={seek}
                    onBack={back}
                    onChat={toChat}
                    onDev={toDev}
                    onDesign={toDesign}
                    onStudio={toStudio}
                    onTabs={toTabs}
                    onOrg={org}
                    drawer
                    places={sidebar}
                    made={maker}
                  />
                </YStack>
              </XStack>
            </Layer>
          )}
          {finding ? <Search go={move} onClose={found} mode={mode} host={host} /> : null}
          {listing ? <Shortcuts onClose={() => setListing(false)} /> : null}
          {learning ? <Learning open onClose={() => setLearning(false)} /> : null}
          <AppContextMenu
            pins={pins}
            host={host}
            mode={mode}
            closed={closed}
            onToggleSidebar={flip}
            onSeek={seek}
            onNewChat={() => {
              empty()
              move(talk())
            }}
            go={move}
          />
        </YStack>
            </DevScope>
          </UsageProvider>
        </PrefsProvider>
      </HostProvider>
    </AiProvider>
    </Report>
  )
}
