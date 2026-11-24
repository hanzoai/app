'use client'

// The web app as the whole window, in three modes: Chat, a conversation with
// the product's AI; Dev, @hanzo/dev's thread view and its thread list (and Cloud Dev Builder);
// and Design, @hanzo/studio's `<Studio>` the same way, its places (`nav`) in the
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
// under `/design` is Design, its own address after it (`c/<id>`, `explore`). Moving
// between the modes is a history entry (`go`), never a load, so a host serves
// this one component for every path under each.
//
// Every host draws this: hanzo.ai at `/`, `/chat`, `/dev` and `/design`, and the desktop
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
// fetched the first time the reader stands in Design; its places are a few
// lines and come with the app. Another organization opens it at its New, so
// nothing it read under the last one stays.
//
// THE PLANS' OWN ADDRESS LEAVES for the pay site in its place (dev.tsx `leave`),
// so the builder's own plans are never drawn.

import { useI18n } from '@hanzo/i18n/react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Sparkles } from 'lucide-react'
import { AiProvider } from '@hanzo/ai/react'
import { XStack, YStack } from '@hanzo/gui'
import { Text } from '@hanzo/ui'
import { HostProvider, PrefsProvider, route, tabs, type Host } from '@hanzo/build'
import { nav as places } from '@hanzo/studio'
import { useAi } from './lib/ai'
import { UsageProvider } from './Usage'
import { AnonSettingsPane, Sidebar } from './Sidebar'
import { Learning } from './Learning'
import { isPlans, leave, useDevHost } from './dev'
import { useBuildSpend } from './Confirm'
import { Gate } from './Gate'
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
import { BAR, floor, pane, SIDE } from './ground'
import { org as currentOrg, pick } from './lib/session'
import { readSettingsReturn, rememberSettingsReturn } from './lib/dev-mode'
import { Upgrade, useFree } from './Upgrade'
import { payUrl } from './lib/pay'
import { FIRST, isSettingsPath, settingsPathFor, settingsRowOf, SettingsList, type Row as SettingsRow } from './Settings'
import { useMaking } from './Confirm'
import { app, CHAT, design, flow, go, hosted, place, SCIENCE, science, settings, talk, TERMINALS, visit, type Place } from './lib/host'
import { flowNav } from './flow/nav'
import { parseFlowRoute } from './flow/types'
import { scienceNav } from './science/nav'
import { parseScienceTab } from './science/types'
import { Bar } from './Bar'
import { Report } from './Report'
import { FOOT, HEIGHT, TOP, useView } from './view'
import { dragWindow, toggleWindowMaximize, WindowControls } from './WindowControls'
import { AppContextMenu } from './ContextMenu'
import { Windowed } from './windowed'

/** Design (@hanzo/studio's `Studio`), fetched the first time the reader stands in it. */
const Studio = lazy(() => import('@hanzo/studio').then((m) => ({ default: m.Studio })))
/** Flow: native Hanzo Flow visual agentic workflow builder & scheduler (`/flow`). */
const FlowPane = lazy(() => import('./flow/FlowPane'))
/** Tabs, the same way: the terminals on the reader's machines (Terminals.tsx). */
const Terminals = lazy(() => import('./Terminals'))
/** Science: native Hanzo Science research, studies, autonomy, machines, and schedules (`/science`). */
const Science = lazy(() => import('./science/Science'))
/** The apps in beta that draw inside the app (lib/hosted), fetched when one is opened at /apps/<id>. */
const Hosted = lazy(() => import('./Hosted').then((m) => ({ default: m.HostedPane })))
/** Betas, fetched when opening /beta in the app. */
const Betas = lazy(() => import('./Betas').then((m) => ({ default: m.BetasPane })))
/** Settings pane, fetched when a host delegates `/settings*` to `<App />`. */
const SettingsPane = lazy(() => import('./SettingsPane').then((m) => ({ default: m.SettingsPane })))
/** `/` is Chat on a new conversation. */
const HOME: Place = { mode: 'chat', thread: null }

/** What a window's bar names the page by; Chat names itself in the sidebar. */
const TITLES: Record<string, string> = { dev: 'Dev', design: 'Design', flow: 'Flow', tabs: 'Tabs', research: 'Science' }

/**
 * The window's bar, for a host that is a window of its own: `inset` px kept
 * clear at its left for the window's own controls (macOS paints its traffic
 * lights over the page there), and `drag`, the attributes the host's shell
 * reads as the region that moves the window.
 */
export interface Titlebar {
  inset?: number
  drag?: Record<string, unknown>
  /** Optional leading control before the sidebar toggle (e.g. stacked `_-` File/App menu on Windows/Linux). */
  leading?: React.ReactNode
  controls?: React.ReactNode
  /** Optional status slot stacked directly above Usage `(!)` and Account at the bottom of the left rail. */
  railFooter?: React.ReactNode
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
const last: Record<string, string> = { chat: '', dev: '', design: '', flow: '', tabs: '', research: '' }

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
  // The builder's spends ask through the app's one question (Confirm `useBuildSpend`), never its own.
  const spend = useBuildSpend()
  const dev = useDevHost(spend.confirm)
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
      go: (to, how) => {
        const dest = to === CHAT || to.startsWith(`${CHAT}/`) ? to : app(to)
        ;(place(dest) ? depart : exit)((replace) => dev.go(to, replace ? { ...how, replace } : how))
      },
    }),
    [dev, depart, exit],
  )
  const { client } = useAi()
  const free = useFree(Boolean(host.token?.()))
  const { router, path } = useHost()
  const here = path ?? '/'
  const inSettings = host.person !== null && isSettingsPath(here)
  const settingsRow = inSettings ? settingsRowOf(here) : FIRST
  const at = place(here) ?? HOME
  const mode = at.mode
  // Every mode carries its sidebar beside the rail (or its title when it has no places of its own).
  const alone = false
  // The hosted app the address names (lib/hosted), for the rail to light.
  const inside = at.mode === 'hosted' ? at.id : null
  const where = at.mode === 'dev' ? at.at : null
  // Design's & Flow's host: Dev's, at Design's (/design) or Flow's (/flow) address.
  const inDesign = at.mode === 'design'
  const inFlow = at.mode === 'flow'
  const made = inDesign || inFlow ? at.at : ''
  const modeRoute = inFlow ? flow : design
  const modeName = inFlow ? 'Flow' : 'Design'
  // Design's and Flow's paid calls ask through the one spend confirm: @hanzo/studio reads `spend` off its host.
  const making = useMaking()
  const maker = useMemo<Host & { spend: typeof making.spend }>(
    () => ({
      ...host,
      name: modeName,
      path: made,
      go: (to, how) => depart((replace) => go(modeRoute(to), replace || how?.replace)),
      chooseOrg: (next) => {
        pick(next)
        window.location.assign(modeRoute(''))
      },
      spend: making.spend,
    }),
    [host, modeName, modeRoute, made, depart, making.spend],
  )
  // A run floats two panes of its own, so the pane it stands in is not cut.
  const run = where !== null && route(where).kind === 'run'
  const asked = at.mode === 'chat' ? at.thread : null
  const { thread, settings: wanted } = useOpen()
  const plans = where !== null && isPlans(where)
  useEffect(() => {
    if (plans) leave('app')
  }, [plans])

  // Recover any stale/misrouted `/dev/projects/chat/t-…` URL back to `/chat/t-…`.
  useEffect(() => {
    if (mode === 'chat' && asked && here.startsWith('/dev/projects/chat/')) {
      go(talk(asked), true)
    }
  }, [mode, asked, here])

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
    (address: string, replace = false) => {
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
      ;(place(clean) ? depart : exit)((r) => visit(router, address, replace || r))
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
  const sections = [() => toChat(), () => toDev(), () => toDesign(), () => toFlow(), () => toTabs()]
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
      if (mode === 'dev') void import('@hanzo/dev').then((m) => m.focusComposer())
      else document.querySelector<HTMLElement>('#main-content textarea, #main-content [contenteditable="true"]')?.focus()
    },
    focusList: () => {
      if (mode === 'dev') void import('@hanzo/dev').then((m) => m.focusThreadList() || focusSidebar())
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
  const leaveSettings = () => move(readSettingsReturn(talk()))
  const pickSettings = (row: SettingsRow) => {
    if (row.href) {
      if (/^https?:\/\//.test(row.href)) window.open(row.href, '_blank', 'noopener,noreferrer')
      else move(row.href)
      return
    }
    move(settingsPathFor(row.id))
  }
  const toChat = () => move(last.chat || talk())
  const toDev = () => move(mode === 'dev' && !inPlace ? app('') : last.dev || app(''))
  const toDesign = () => move(last.design || design(''))
  const toFlow = () => move(last.flow || flow(''))
  const toTabs = () => move(TERMINALS)
  // Another organization: picked, and the app opened in it at the mode's New.
  const org = (o: string) => {
    pick(o)
    window.location.assign(mode === 'dev' ? app('') : mode === 'design' ? design('') : mode === 'flow' ? flow('') : mode === 'tabs' ? TERMINALS : mode === 'research' ? SCIENCE : inside ? hosted(inside) : talk())
  }
  const sidebar =
    mode === 'beta' || mode === 'hosted'
      ? []
      : mode === 'research'
        ? scienceNav(parseScienceTab(here), move, t)
        : mode === 'design'
          ? places(maker, (p) => maker.go(p))
          : mode === 'flow'
            ? flowNav(parseFlowRoute(here).view, move, t)
            : mode === 'dev' && raised(where) === 'customize'
              ? tabs(host, (p) => host.go(p), t).map((group) => ({ ...group, links: [...group.links, {
                id: 'learning', label: t('Learning'), active: learning, icon: <RefreshCw size={16} aria-hidden />,
                onPress: () => { shut(); setLearning(true) },
              }] }))
              : undefined
  const seek = () => {
    shut()
    setFinding(true)
  }

  return (
    <Windowed.Provider value={Boolean(bar)}>
    <Report>
    <AiProvider client={client ?? undefined}>
      <HostProvider host={host}>
        {spend.dialog}
        {/* The person's preferences, read once for Chat and Dev: the side panel's width is one of them. */}
        <PrefsProvider>
          <UsageProvider>
            <DevScope active={mode === 'dev' || mode === 'chat'} path={here}>
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
            <XStack
              data-slot="title-bar"
              display="grid"
              gridTemplateColumns="auto minmax(0, 1fr)"
              height={BAR}
              shrink={0}
              items="center"
              onMouseDown={dragWindow}
              onDoubleClick={toggleWindowMaximize}
              {...bar.drag}
            >
              <XStack
                data-slot="title-bar-start"
                data-sidebar-open={closed ? 'false' : 'true'}
                height="100%"
                items="center"
                justify={closed ? 'flex-start' : 'space-between'}
                gap={4}
                pl={(bar.inset ?? 0) + 4}
                pr={10}
                shrink={0}
                width={closed ? 'auto' : ('calc(52px + var(--app-sidebar-span, 256px))' as never)}
                $max-md={{ width: 'auto', justify: 'flex-start' }}
                {...bar.drag}
              >
                <XStack data-slot="title-bar-left-group" items="center" gap={4} data-tauri-drag-region="false">
                  {bar.leading}
                  <XStack $md={{ display: 'none' }} data-tauri-drag-region="false">
                    <Toggle open={drawer.state === 'open'} onPress={drawer.open} />
                  </XStack>
                  <XStack $max-md={{ display: 'none' }} data-tauri-drag-region="false">
                    <Toggle open={!closed} onPress={flip} />
                  </XStack>
                </XStack>
                <XStack data-slot="title-bar-nav-group" items="center" gap={4} data-tauri-drag-region="false">
                  <Mark label={t('Back')} data-slot="back" data-tauri-drag-region="false" onPress={() => router.back()}>
                    <ChevronLeft size={16} strokeWidth={CHEVRON} aria-hidden data-i18n-mirror />
                  </Mark>
                  <Mark label={t('Forward')} data-slot="forward" data-tauri-drag-region="false" onPress={() => router.forward()}>
                    <ChevronRight size={16} strokeWidth={CHEVRON} aria-hidden data-i18n-mirror />
                  </Mark>
                </XStack>
              </XStack>
              <XStack
                data-slot="title-bar-main"
                display="grid"
                gridTemplateColumns="minmax(0, 1fr) auto"
                minW={0}
                self="stretch"
                items="center"
                pl={14}
                pr={8}
                gap={6}
                {...bar.drag}
              >
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
            display="grid"
            gridTemplateColumns="auto auto minmax(0, 1fr)"
            gridTemplateRows="minmax(0, 1fr)"
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
            // so the top of the page the browser's bar tints from does too. On narrow
            // desktop windows, keep the 52px icon rail visible beside the active pane.
            $max-md={{
              p: 0,
              gridTemplateColumns: bar ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
              ...(bar ? { pt: 'var(--pane-gap)' } : null),
            }}
          >
            {drawer.slide ? <Lift /> : null}
            {/* Persistent desktop icon rail: stays anchored in place while the contextual sidebar opens and closes beside it. */}
            <YStack height="100%" position="relative" display="flex" $max-md={bar ? undefined : { display: 'none' }}>
              <Rail
                pins={pins}
                host={host}
                mode={mode}
                at={where}
                inside={inside}
                open={!closed}
                onOpen={bar ? undefined : flip}
                onChat={toChat}
                onDev={toDev}
                onDesign={toDesign}
                onFlow={toFlow}
                onTabs={toTabs}
                go={move}
                onOrg={org}
                footer={bar?.railFooter}
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
            {/* Contextual desktop sidebar: expands/collapses smoothly beside the stationary rail. */}
            <XStack
              data-slot="sidebar-shell"
              data-open={closed || alone ? 'false' : 'true'}
              aria-hidden={closed || alone ? true : undefined}
              {...(closed || alone ? ({ inert: '' } as object) : null)}
              display="grid"
              gridTemplateColumns={closed || alone ? '0fr' : '1fr'}
              gridTemplateRows="minmax(0, 1fr)"
              opacity={closed || alone ? 0 : 1}
              height="100%"
              minH={0}
              overflow="hidden"
              pointerEvents={closed || alone ? 'none' : 'auto'}
              $max-md={{ display: 'none' }}
              $platform-web={{
                transition: 'grid-template-columns 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 160ms ease',
              }}
            >
              <YStack minW={0} minH={0} height="100%" overflow="hidden">
                {inSettings ? (
                  <YStack
                    data-slot="settings-column"
                    width={SIDE}
                    height="100%"
                    px={8}
                    py="$2"
                    overflowY="auto"
                    overflowX="hidden"
                    {...pane()}
                  >
                    <SettingsList active={settingsRow} filter="" onPick={pickSettings} onBack={leaveSettings} />
                  </YStack>
                ) : (
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
                    onFlow={toFlow}
                    onTabs={toTabs}
                    onOrg={org}
                    places={sidebar}
                    made={maker}
                  />
                )}
              </YStack>
            </XStack>
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
              marginInlineStart={0}
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
                {inSettings ? (
                  <YStack id="main-content" tabIndex={-1} render="main" data-slot="pane" {...pane()} overflow="hidden" flex={1} minW={0} minH={0}>
                    <Suspense fallback={null}>
                      <SettingsPane id={settingsRow} />
                    </Suspense>
                  </YStack>
                ) : anonSettings && host.person === null ? (
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
                    <DevInterior host={host} path={here} mode="chat" conversation={asked} onGo={move} />
                  </Split>
                ) : mode === 'tabs' ? (
                  <YStack id="main-content" tabIndex={-1} render="main" data-slot="pane" {...pane()} overflow="hidden" flex={1} minW={0} minH={0}>
                    <Suspense fallback={null}>
                      <Terminals />
                    </Suspense>
                  </YStack>
                ) : mode === 'research' ? (
                  <YStack id="main-content" tabIndex={-1} render="main" data-slot="pane" {...pane()} overflow="hidden" flex={1} minW={0} minH={0}>
                    <Suspense fallback={null}>
                      <Science onNavigate={move} />
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
                    <YStack flex={1} minH={0} height="100%">
                      <Suspense fallback={null}>
                        <FlowPane host={host} path={here} onNavigate={move} />
                      </Suspense>
                    </YStack>
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
                    {plans ? null : <DevInterior host={host} path={here} onGo={move} />}
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
                  {inSettings ? (
                    <YStack flex={1} minW={0} px={8} py="$2" overflowY="auto" overflowX="hidden">
                      <SettingsList active={settingsRow} filter="" onPick={pickSettings} onBack={leaveSettings} />
                    </YStack>
                  ) : (
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
                      onFlow={toFlow}
                      onTabs={toTabs}
                      onOrg={org}
                      drawer
                      places={sidebar}
                      made={maker}
                    />
                  )}
                </YStack>
              </XStack>
            </Layer>
          )}
          {finding ? <Search go={move} onClose={found} mode={mode} host={host} /> : null}
          {listing ? <Shortcuts onClose={() => setListing(false)} /> : null}
          {learning ? <Learning open onClose={() => setLearning(false)} onOpenScience={() => { setLearning(false); move(science('studies')) }} /> : null}
          <Upgrade />
          {making.dialog}
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
    </Windowed.Provider>
  )
}
