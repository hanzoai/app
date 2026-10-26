'use client'

// The palette: ⌘K / Ctrl+K from anywhere toggles it, the sidebar's search opens
// it. Every place in the app can be jumped to from it and every action run.
//
// An empty field lists Recent (the reader's chats and Dev tasks, newest first,
// each with its kind's icon), Actions, and Go to: the products, the places of
// the app and the apps in beta the reader may open. A query searches all of it, deeper places too (Settings' pages,
// Customize's tabs, the Library's kinds, Studio's places, Help), and the
// reader's chats, Dev tasks, projects, agents, skills and connectors by name;
// each group keeps its best five and the group with the best answer leads
// (seek.ts `find`). A row opens where it lives; an action runs.
//
// GO TO IS DERIVED, never listed here: the places are @hanzo/build's own
// registries (`nav` for Dev's places, `sections` for Settings — the sections
// with a page at /settings (lib/host.ts `paged`), each opened there — `tabs` for
// Customize, `library` for the Library's kinds), @hanzo/studio's `nav`, and
// help.ts's pages, lib/betas.ts's granted apps: the same lists the sidebars and
// menus draw. A page added to
// any of them is in the palette with nothing written here.
//
// MOUNTED ONLY WHILE OPEN, and every list is read once as it opens and searched
// here as the reader types: the conversations store (hanzoai/agent) answers its
// whole list and searches nothing, titles or words, so a title is all there is
// to find a chat by. The chats are the sidebar's last read (thread.tsx
// `useThreadList`), drawn at once; the projects (`/v1/project`), the active
// skills (`/v1/tool/skills?activated=true`), the connectors
// (`/v1/tool/mcp/servers`) and the agents (crew.tsx) arrive while the reader
// types, and a read the palette closes on is aborted.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { isolate } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import {
  BookOpen,
  Bot,
  Building2,
  CircleHelp,
  Clock,
  Code2,
  FlaskConical,
  FolderGit2,
  Gift,
  Keyboard,
  LogOut,
  MessageCircle,
  MessageSquare,
  Plug,
  Settings,
  Sparkles,
  SquarePen,
  SquareTerminal,
  SunMoon,
  Users,
  WandSparkles,
} from 'lucide-react'
import { useAi } from '@hanzo/ai/react'
import { library, nav, NEW, path as written, sections, tabs, useSessions, type Host } from '@hanzo/build'
import { nav as made } from '@hanzo/studio'
import { Dialog, DialogContent, DialogTitle, type ShortcutKeys } from '@hanzo/ui'
import { CommandMenu, type CommandMenuGroup } from '@hanzo/ui/product/CommandMenu'
import { ordered } from './agents'
import { useCrew } from './crew'
import { called } from './team'
import { empty, openThread, withAgents } from './open'
import { useThreadList } from './thread'
import { useSignOut } from './lib/signout'
import { choose } from './lib/session'
import { app, hosted, paged, settings, studio, talk, TERMINALS, WORKSPACE, type Place } from './lib/host'
import { BETAS } from './lib/betas'
import { useBetas } from './Betas'
import { tidy } from './lib/title'
import { KEYS, legal, out, pages } from './help'
import { site } from './where'
import { find, type Group, type Hit } from './seek'
import { english, type Say } from './say'

/** A row: what it is called (in the reader's words), its glyph, where it lives, and what pressing it does. */
export interface Action extends Hit {
  icon?: ReactNode
  shortcut?: ShortcutKeys
  /** Where it lives, dimmed after its name: Settings, Customize, Help. */
  where?: string
  run: () => void
  /** Pressing it keeps the palette open. */
  stay?: boolean
}

const ICON = { size: 16, 'aria-hidden': true } as const

const SKILLS = written({ kind: 'customize', tab: 'skills' })
const CONNECTORS = written({ kind: 'customize', tab: 'connectors' })

/** The words a Settings page is also asked for by: the account menu's names for General, and the obvious ones. */
const ALSO: Record<string, string[]> = {
  general: ['personalization', 'appearance', 'theme', 'profile', 'account'],
  billing: ['plans', 'subscription'],
  members: ['organization', 'team'],
}

/** A registry's groups as rows, each named for where it lives. */
const rows = (groups: { links: { id: string; label: string; icon?: ReactNode; onPress?: () => void }[] }[], where: string, prefix: string): Action[] =>
  groups
    .flatMap((g) => g.links)
    .map((l) => ({ id: `${prefix}-${l.id}`, label: l.label, icon: l.icon, where, keywords: [where, ...(ALSO[l.id] ?? [])].filter(Boolean), run: () => l.onPress?.() }))

/**
 * Every place the reader can be taken: `top` is what an empty field lists, the
 * products and the places of the app; `deep` is what only a query reaches.
 * Without a host (hanzo.team's frame) the builder's registries are not there,
 * and the products and the site's pages are. The rows this module authors are
 * named through `t`; a registry's rows keep the words its package wrote.
 */
export function places(host: Host | undefined, go: (address: string) => void, t: Say = english): { top: Action[]; deep: Action[] } {
  const builder = (p: string) => go(app(p))
  const top: Action[] = [
    { id: 'chat', label: t('Chat'), icon: <MessageSquare {...ICON} />, run: () => go(talk()) },
    { id: 'dev', label: 'Dev', icon: <Code2 {...ICON} />, run: () => go(app('')) },
    { id: 'studio', label: 'Studio', icon: <WandSparkles {...ICON} />, run: () => go(studio('')) },
    { id: 'tabs', label: 'Tabs', icon: <SquareTerminal {...ICON} />, run: () => go(TERMINALS) },
    ...(host ? [{ id: 'team', label: 'Team', icon: <Users {...ICON} />, keywords: ['workspace'], run: () => out(WORKSPACE) }] : []),
    ...(host ? rows(nav(host, builder, t).map((g) => ({ links: g.links.filter((l) => l.id !== NEW) })), '', 'dev') : []),
    { id: 'settings', label: t('Settings'), icon: <Settings {...ICON} />, shortcut: ['Mod', ','], run: () => go(settings()) },
    // The site's own pages, outside the app: the browser loads them.
    { id: 'referral', label: t('Referral'), icon: <Gift {...ICON} />, keywords: ['invite', 'share'], run: () => window.location.assign(site('/referral')) },
    { id: 'beta', label: t('Beta status'), icon: <FlaskConical {...ICON} />, keywords: ['waitlist'], run: () => window.location.assign(site('/beta/status')) },
    ...pages()
      .filter((p) => p.key === 'help')
      .map((p) => ({ id: `help-${p.key}`, label: t(p.label), icon: <CircleHelp {...ICON} />, keywords: ['support', 'docs'], run: () => out(p.href) })),
  ]
  const help = t('Help')
  const deep: Action[] = [
    ...(host
      ? [
          ...rows(sections(host, builder, t).map((g) => ({ links: g.links.filter((l) => paged(l.id)) })), t('Settings'), 'settings'),
          ...rows(tabs(host, builder, t), t('Customize'), 'customize'),
          ...rows(library(host, builder, t).slice(1), t('Library'), 'library'),
          ...rows(made(host, (p) => go(studio(p))), 'Studio', 'studio').filter((a) => a.id !== `studio-${NEW}`),
        ]
      : []),
    ...[...pages(), ...legal()]
      .filter((p) => p.key !== 'help')
      .map((p) => ({ id: `help-${p.key}`, label: t(p.label), where: help, keywords: [help, 'Help'], run: () => out(p.href) })),
  ]
  return { top, deep }
}

/** The composer's model menu, opened as a press would: a page without a composer opens New chat's. */
function tune(go: (address: string) => void) {
  const open = () => {
    const chip = document.querySelector<HTMLElement>('[data-slot="mind"][aria-haspopup="menu"]')
    chip?.focus()
    chip?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    return !!chip
  }
  let tries = 0
  const wait = () => {
    if (!open() && ++tries < 120) requestAnimationFrame(wait)
  }
  // After the palette has closed and handed focus back, so the menu keeps it.
  setTimeout(() => {
    if (!open()) {
      go(talk())
      requestAnimationFrame(wait)
    }
  }, 0)
}

/** The palette's actions, named through `t`; a host that cannot do one (no theme to change, no org to pick) is not offered it. */
export function actions(host: Host | undefined, go: (address: string) => void, signOut: () => void, keys: () => void, t: Say = english): Action[] {
  const upload = host ? library(host, (p) => go(app(p)), t)[0]?.links.find((l) => l.id === 'upload') : undefined
  const list: (Action | false | undefined)[] = [
    { id: 'new-chat', label: t('New chat'), icon: <SquarePen {...ICON} />, run: () => (empty(), go(talk())) },
    { id: 'new-task', label: t('New Dev task'), icon: <Code2 {...ICON} />, keywords: ['run'], run: () => go(app('')) },
    { id: 'new-creation', label: t('New Studio creation'), icon: <WandSparkles {...ICON} />, keywords: ['image', 'video'], run: () => go(studio('')) },
    { id: 'new-scheduled', label: t('New scheduled task'), icon: <Clock {...ICON} />, keywords: ['automation'], run: () => go(app(written({ kind: 'automation', id: 'new' }))) },
    !!upload && { id: 'upload', label: t('Upload'), icon: upload.icon, keywords: ['file', 'library'], run: () => upload.onPress?.() },
    { id: 'model', label: t('Switch model'), icon: <Sparkles {...ICON} />, keywords: ['model'], run: () => tune(go) },
    !!host?.chooseTheme && {
      id: 'theme',
      label: t('Toggle theme'),
      icon: <SunMoon {...ICON} />,
      keywords: ['dark', 'light', 'appearance'],
      run: () => host.chooseTheme?.(document.documentElement.classList.contains('dark') ? 'light' : 'dark'),
    },
    !!host && { id: 'org', label: t('Switch organization'), icon: <Building2 {...ICON} />, keywords: ['org', 'team', 'workspace'], run: choose },
    { id: 'keys', label: t('Keyboard shortcuts'), icon: <Keyboard {...ICON} />, stay: true, run: keys },
    { id: 'logout', label: t('Log out'), icon: <LogOut {...ICON} data-i18n-mirror />, keywords: ['sign out'], run: signOut },
  ]
  return list.filter((a): a is Action => !!a)
}

/** A list read once as the palette opens; a refusal leaves it empty and the rest still answer. */
function useRead(path: string, shape: (body: unknown) => Hit[]): Hit[] {
  const ai = useAi()
  const [found, setFound] = useState<Hit[]>([])
  useEffect(() => {
    const stop = new AbortController()
    ai.http.json<unknown>({ path, signal: stop.signal }).then(
      (body) => setFound(shape(body)),
      () => {},
    )
    return () => stop.abort()
    // `shape` is a module constant at each call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, path])
  return found
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** `/v1/project`: a project by its slug, found by its name, slug and repository. */
/**
 * The builder as a frame without it holds it (hanzo.team's Shell): nobody signed
 * in to it, so `useSessions` reads no runs. The hook reads `api`, `token`, `org`
 * and `person` off whatever it is handed, and handed nothing it throws.
 */
const NOBODY = { api: '', token: () => null, org: null, person: null } as unknown as Host

const projects = (body: unknown): Hit[] =>
  (Array.isArray(body) ? body : list(obj(body).data))
    .map(obj)
    .filter((p) => str(p.slug))
    .map((p) => ({ id: str(p.slug), label: str(p.name) || str(p.slug), keywords: [str(p.slug), str(obj(p.repo).url)] }))

/** `/v1/tool/skills?activated=true`: a skill by its name, its tool's less `skill_`. */
const skills = (body: unknown): Hit[] =>
  list(obj(body).tools)
    .map(obj)
    .filter((t) => str(t.name))
    .map((t) => ({ id: str(t.name), label: str(t.name).replace(/^skill_/, ''), keywords: [str(t.description)] }))

/** `/v1/tool/mcp/servers`: a connector by its name. */
const connectors = (body: unknown): Hit[] =>
  list(obj(body).servers)
    .map(obj)
    .filter((s) => str(s.id))
    .map((s) => ({ id: str(s.id), label: str(s.name) || str(s.id), keywords: [str(s.url)] }))

export function Palette({
  onClose,
  go,
  actions: frame = [],
  mode = 'chat',
  host,
}: {
  onClose: () => void
  /** Moves the app to one of its addresses (lib/host `talk`, `app`, `studio`). */
  go: (address: string) => void
  /** The frame's own places; one with a palette row's id stands in for it, the rest follow under Go to. */
  actions?: Action[]
  /** The product the reader is in: its own things lead a tie. */
  mode?: Place['mode']
  /** The builder's host: its registries, its runs, its theme and organization. */
  host?: Host
}) {
  const { t, dir } = useI18n()
  const [query, setQuery] = useState('')
  const [keys, setKeys] = useState(false)
  const { threads } = useThreadList()
  const { agents } = useCrew()
  const repos = useRead('/v1/project', projects)
  const known = useRead('/v1/tool/skills?activated=true', skills)
  const plugged = useRead('/v1/tool/mcp/servers', connectors)
  const signOut = useSignOut()
  const runs = useSessions(host ?? NOBODY)
  const { open: opened } = useBetas()

  const groups = useMemo<CommandMenuGroup[]>(() => {
    const { top, deep } = places(host, go, t)
    const swap = (a: Action) => frame.find((b) => b.id === a.id) ?? a
    // The apps in beta this reader may open, each where it lives (the rail's More).
    const granted: Action[] = BETAS.filter((b) => b.href && opened(b.id)).map((b) => ({
      id: `beta-${b.id}`,
      label: b.name,
      icon: <Sparkles {...ICON} />,
      where: t('Beta'),
      keywords: ['beta', b.line],
      // One that draws inside the app opens there; any other at its own host.
      run: () => (b.embed !== undefined ? go(hosted(b.id)) : out(b.href as string)),
    }))
    const here = [...top.map(swap), ...frame.filter((b) => !top.some((a) => a.id === b.id)), ...granted]
    const doing = actions(host, go, () => void signOut(), () => (setQuery(''), setKeys(true)), t)
    const untitled = t('Untitled')
    const chats: Action[] = threads.map((c) => ({
      id: `chat-${c.id}`,
      label: tidy(c.title, 80, untitled),
      at: c.updatedAt,
      icon: <MessageCircle {...ICON} />,
      run: () => (openThread(c.id), go(talk(c.id))),
    }))
    const tasks: Action[] = (runs?.value ?? []).map((s) => ({
      id: `run-${s.id}`,
      label: tidy(s.title, 80, t('Untitled run')),
      at: s.updatedAt || s.createdAt,
      keywords: [s.status ?? ''],
      icon: <Code2 {...ICON} />,
      run: () => go(app(s.id)),
    }))
    const mine: Group<Action>[] =
      mode === 'dev'
        ? [
            { id: 'runs', label: t('Dev tasks'), items: tasks },
            { id: 'chats', label: t('Chats'), items: chats },
          ]
        : [
            { id: 'chats', label: t('Chats'), items: chats },
            { id: 'runs', label: t('Dev tasks'), items: tasks },
          ]
    const shown = find<Action>(
      query,
      [...chats, ...tasks],
      [
        { id: 'actions', label: t('Actions'), items: doing },
        { id: 'go', label: t('Go to'), items: here },
      ],
      [
        { id: 'go', label: t('Go to'), items: [...here, ...deep] },
        { id: 'actions', label: t('Actions'), items: doing },
        ...mine,
        { id: 'projects', label: t('Projects'), items: repos.map((p) => ({ ...p, id: `project-${p.id}`, icon: <FolderGit2 {...ICON} />, run: () => go(app(p.id)) })) },
        {
          id: 'agents',
          label: t('Agents'),
          items: ordered(agents).map((one) => {
            const name = called(one.name)
            return { id: `agent-${one.id || one.name}`, label: name, icon: <Bot {...ICON} />, run: () => (withAgents([name]), go(talk())) }
          }),
        },
        { id: 'skills', label: t('Skills'), items: known.map((s) => ({ ...s, id: `skill-${s.id}`, icon: <BookOpen {...ICON} />, run: () => go(app(SKILLS)) })) },
        { id: 'connectors', label: t('Connectors'), items: plugged.map((c) => ({ ...c, id: `connector-${c.id}`, icon: <Plug {...ICON} />, run: () => go(app(CONNECTORS)) })) },
      ],
    )
    return shown.map((g) => ({
      ...g,
      // Recent is seek.ts's own group, its name written there with phrase().
      label: g.id === 'recent' ? t(g.label) : g.label,
      items: g.items.map((a) => ({
        id: a.id,
        label: a.label,
        icon: a.icon,
        contextual: a.where || undefined,
        shortcut: a.shortcut,
        // The palette ranked these against the query; the menu's own filter passes what it kept.
        keywords: [query],
        onSelect: () => {
          if (!a.stay) onClose()
          a.run()
        },
      })),
    }))
  }, [query, threads, agents, repos, known, plugged, frame, go, onClose, signOut, mode, runs, host, opened, t])

  const apple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
  // A key's spelling keeps its writing order in right-to-left prose (`contextual` is plain text, so Unicode's isolate, not <bdi>).
  const spelled = (spelling: string) => (dir === 'rtl' ? isolate(spelling) : spelling)
  const listed: CommandMenuGroup[] = keys
    ? [
        {
          id: 'keys',
          label: t('Keyboard shortcuts'),
          items: KEYS.map((k) => ({ id: `key-${k.does}`, label: t(k.does), contextual: spelled(apple ? k.mac : k.pc), onSelect: () => setKeys(false) })),
        },
      ]
    : groups

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent
        data-slot="palette"
        showCloseButton={false}
        p={0}
        gap={0}
        width="100%"
        maxW={640}
        // As tall as its rows, under a fixed top, so typing never moves the field.
        maxH="min(520px, 76dvh)"
        mt="12dvh"
        mb="auto"
        rounded="$6"
        overflow="hidden"
        // A phone's palette is a sheet the width and height of the screen.
        $max-md={{ width: '100vw', maxW: '100vw', height: '100dvh', maxH: '100dvh', mt: 0, mb: 0, rounded: 0, borderWidth: 0 }}
      >
        <DialogTitle position="absolute" width={1} height={1} overflow="hidden" opacity={0}>
          {t('Search')}
        </DialogTitle>
        <CommandMenu
          groups={listed}
          query={query}
          onQueryChange={setQuery}
          placeholder={t('Search or jump to…')}
          label={t('Search')}
          empty={keys ? t('No such key.') : t('Nothing matches “{query}”.', { query: query.trim() })}
          onBack={keys ? () => setKeys(false) : undefined}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
