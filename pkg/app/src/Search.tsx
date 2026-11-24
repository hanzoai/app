'use client'

// The palette: ⌘K / Ctrl+K from anywhere toggles it, the sidebar's search opens
// it. Every place in the app can be jumped to from it and every action run.
//
// An empty field lists Recent (the reader's chats and Dev tasks, newest first,
// each with its kind's icon), Actions, and Go to: the products, the places of
// the app and the apps in beta the reader may open. A query searches all of it, deeper places too (Settings' pages,
// Customize's tabs, the Library's kinds, Design's places, Help), and the
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

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { isolate, english, type Say } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import {
  Atom,
  Award,
  Bell,
  Blocks,
  BookOpen,
  Bot,
  Brain,
  Building2,
  CalendarClock,
  CircleHelp,
  Cloud,
  Code2,
  Cpu,
  CreditCard,
  FileCheck2,
  FlaskConical,
  FolderGit2,
  Gauge,
  Gift,
  GitBranch,
  Globe,
  HardDrive,
  IdCard,
  KeyRound,
  Keyboard,
  LayoutGrid,
  Link2,
  Lock,
  LogOut,
  MessageCircle,
  Mic,
  Monitor,
  Moon,
  Palette,
  PanelLeft,
  Plug,
  Scale,
  Search as SearchIcon,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  SunMoon,
  Terminal,
  Users,
  UsersRound,
  Wallet,
  Webhook,
  Workflow,
  X,
} from 'lucide-react'
import { useAi } from '@hanzo/ai/react'
import { apply as applyAppearance, read as readAppearance, write as writeAppearance } from '@hanzo/appearance'
import { MARKS } from './icons'
import { library, nav, NEW, path as written, sections, tabs, useSessions, type Host } from '@hanzo/build'
import { nav as made } from '@hanzo/studio'
import * as ui from '@hanzo/ui'
import type { ShortcutKeys } from '@hanzo/ui'
import { CommandMenu, type CommandMenuGroup } from '@hanzo/ui/product/CommandMenu'
import { ordered } from './agents'
import { useCrew } from './crew'
import { called } from './team'
import { empty, openThread, withAgents } from './open'
import { useThreadList } from './thread'
import { useKept } from './kept'
import { payPage } from './lib/pay'
import { openModelPicker } from './lib/model-picker'
import { useSignOut, useSigningOut } from './lib/signout'
import { choose } from './lib/session'
import { getDevMode, rememberSettingsReturn, setDevMode, useDevMode } from './lib/dev-mode'
import { app, design, flow, hosted, paged, science, settings, talk, TERMINALS, WORKSPACE, type Place } from './lib/host'
import { BETAS } from './lib/betas'
import { useBetas } from './Betas'
import { tidy } from './lib/title'
import { legal, out, pages, rows as keyRows } from './help'
import { site } from './where'
import { find, rank, type Group, type Hit } from './seek'

const { Dialog, DialogContent, DialogTitle } = ui

const MAX_RECENT_JUMPS = 5

export interface RecentJump {
  id: string
  label: string
  where?: string
  at: number
}

const NO_JUMPS: RecentJump[] = []

/** The jumps after this one: it goes first, once, and only the last few are kept. */
export function recorded(prev: RecentJump[], item: { id: string; label: string; where?: string }, at: number): RecentJump[] {
  return [
    { id: item.id, label: item.label, ...(item.where ? { where: item.where } : {}), at },
    ...prev.filter((x) => x.id !== item.id),
  ].slice(0, MAX_RECENT_JUMPS)
}

function isLightTheme(host?: Host): boolean {
  if (typeof document !== 'undefined') {
    const cls = document.documentElement.classList
    if (cls.contains('light') || cls.contains('t_light')) return true
    if (cls.contains('dark') || cls.contains('t_dark')) return false
  }
  return host?.theme === 'light'
}

function applyThemeChoice(host: Host | undefined, next: 'light' | 'dark'): void {
  if (host?.chooseTheme) {
    host.chooseTheme(next)
    return
  }
  if (typeof document === 'undefined') return
  const pref = { ...readAppearance(), theme: next }
  writeAppearance(pref)
  applyAppearance(pref, document.documentElement)
}

/** A row: what it is called (in the reader's words), its glyph, where it lives, and what pressing it does. */
export interface Action extends Hit {
  icon?: ReactNode
  shortcut?: ShortcutKeys
  /** Where it lives, dimmed after its name: Settings, Customize, Help. */
  where?: string
  run: () => void
  /** Pressing it keeps the palette open. */
  stay?: boolean
  /** Drawn, and not pressable. */
  disabled?: boolean
}

const ICON = { size: 15, color: 'var(--foreground)', 'aria-hidden': true } as const

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
  const anon = host?.person === null
  const builder = (p: string) => go(app(p))
  const top: Action[] = [
    { id: 'chat', label: t('Chat'), icon: <MARKS.chat.icon {...ICON} />, run: () => go(talk()) },
    { id: 'dev', label: 'Dev', icon: <MARKS.dev.icon {...ICON} />, run: () => go(app('')) },
    ...(!anon
      ? [
          { id: 'design', label: 'Design', icon: <MARKS.design.icon {...ICON} />, run: () => go(design('')) },
          { id: 'flow', label: 'Flow', icon: <MARKS.flow.icon {...ICON} />, keywords: ['flow', 'workflow', 'automation', 'schedule', 'pipeline', 'enso', 'agents'], run: () => go(flow('')) },
          { id: 'tabs', label: 'Tabs', icon: <MARKS.tabs.icon {...ICON} />, run: () => go(TERMINALS) },
          { id: 'science', label: t('Science'), icon: <Atom {...ICON} />, keywords: ['research', 'studies', 'autonomy', 'experiments', 'benchmarks'], run: () => go(science()) },
          ...(host ? [{ id: 'team', label: 'Team', icon: <Users {...ICON} />, keywords: ['workspace'], run: () => out(WORKSPACE) }] : []),
          ...(host ? rows(nav(host, builder, t).map((g) => ({ links: g.links.filter((l) => l.id !== NEW) })), '', 'dev') : []),
        ]
      : []),
    { id: 'settings', label: t('Settings'), icon: <Settings {...ICON} />, shortcut: ['Mod', ','], run: () => go(settings()) },
    ...(!anon
      ? [
          // The site's own pages, outside the app: the browser loads them.
          { id: 'referral', label: t('Referral'), icon: <Gift {...ICON} />, keywords: ['invite', 'share'], run: () => window.location.assign(site('/referral')) },
          { id: 'beta', label: t('Beta status'), icon: <FlaskConical {...ICON} />, keywords: ['waitlist'], run: () => window.location.assign(site('/beta/status')) },
        ]
      : []),
    ...pages()
      .filter((p) => p.key === 'help')
      .map((p) => ({ id: `help-${p.key}`, label: t(p.label), icon: <CircleHelp {...ICON} />, keywords: ['support', 'docs'], run: () => out(p.href) })),
  ]
  const help = t('Help')
  const deep: Action[] = [
    ...(host && !anon
      ? [
          ...rows(sections(host, builder, t).map((g) => ({ links: g.links.filter((l) => paged(l.id)) })), t('Settings'), 'settings'),
          ...rows(tabs(host, builder, t), t('Customize'), 'customize'),
          ...rows(library(host, builder, t).slice(1), t('Library'), 'library'),
          ...rows(made(host, (p) => go(design(p))), 'Design', 'design').filter((a) => a.id !== `design-${NEW}`),
          { id: 'flow-scheduled', label: t('Scheduled flows'), where: 'Flow', icon: <CalendarClock {...ICON} />, keywords: ['flow', 'schedule', 'cron', 'automation'], run: () => go(flow('scheduled')) },
          { id: 'flow-runs', label: t('Flow run history'), where: 'Flow', icon: <Workflow {...ICON} />, keywords: ['flow', 'runs', 'history', 'logs'], run: () => go(flow('runs')) },
          { id: 'flow-templates', label: t('Flow templates'), where: 'Flow', icon: <Blocks {...ICON} />, keywords: ['flow', 'templates', 'agent', 'webhook', 'crm'], run: () => go(flow('templates')) },
          { id: 'science-studies', label: t('Studies'), where: t('Science'), icon: <BookOpen {...ICON} />, keywords: ['science', 'studies', 'benchmarks', 'runs', 'experiments', 'compare'], run: () => go(science('studies')) },
          { id: 'science-autonomy', label: t('Autonomy'), where: t('Science'), icon: <Sparkles {...ICON} />, keywords: ['science', 'autonomy', 'hypothesis', 'opportunities', 'preregister'], run: () => go(science('autonomy')) },
          { id: 'science-machines', label: t('Research machines'), where: t('Science'), icon: <Server {...ICON} />, keywords: ['science', 'machines', 'gpu', 'dgx', 'evo', 'hanzod', 'fleet'], run: () => go(science('machines')) },
          { id: 'science-schedules', label: t('Research schedules'), where: t('Science'), icon: <CalendarClock {...ICON} />, keywords: ['science', 'schedules', 'cron', 'autonomous', 'tasks'], run: () => go(science('schedules')) },
        ]
      : host && anon
        ? [...rows(library(host, builder, t).slice(1), t('Library'), 'library')]
        : []),
    ...[...pages(), ...legal()]
      .filter((p) => p.key !== 'help')
      .map((p) => ({ id: `help-${p.key}`, label: t(p.label), where: help, keywords: [help, 'Help'], run: () => out(p.href) })),
  ]
  return { top, deep }
}

/** The composer's model menu, opened as a press would: a page without a composer opens New chat's. */
function tune(go: (address: string) => void) {
  let tries = 0
  const wait = () => {
    if (!openModelPicker() && ++tries < 120) requestAnimationFrame(wait)
  }
  // After the palette has closed and handed focus back, so the menu keeps it.
  setTimeout(() => {
    if (!openModelPicker()) {
      go(talk())
      requestAnimationFrame(wait)
    }
  }, 0)
}

/** The palette's actions, named through `t`; a host that cannot do one (no theme to change, no org to pick) is not offered it. */
export function actions(host: Host | undefined, go: (address: string) => void, signOut: () => void, keys: () => void, t: Say = english, out = false): Action[] {
  const anon = host?.person === null
  // The Library's own acts (@hanzo/build `library`): Make something new and Upload, where the build has them.
  const acts = host && !anon ? (library(host, (p) => go(app(p)), t)[0]?.links ?? []) : []
  const make = acts.find((l) => l.id === 'make')
  const upload = acts.find((l) => l.id === 'upload')
  const list: (Action | false | undefined)[] = [
    { id: 'new-chat', label: t('New chat'), icon: <MARKS.chat.make {...ICON} />, keywords: ['chat', 'new', 'conversation'], run: () => (empty(), go(talk())) },
    { id: 'new-task', label: t('New run'), icon: <MARKS.dev.make {...ICON} />, keywords: ['run', 'dev', 'task', 'build'], run: () => go(app('')) },
    !anon && { id: 'new-scheduled', label: t('New scheduled task'), icon: <MARKS.scheduled.icon {...ICON} />, keywords: ['automation'], run: () => go(app(written({ kind: 'automation', id: 'new' }))) },
    !!make && { id: 'make', label: t('Make something new'), icon: make.icon, keywords: ['template', 'gallery', 'library'], run: () => make.onPress?.() },
    !!upload && { id: 'upload', label: t('Upload'), icon: upload.icon, keywords: ['file', 'library'], run: () => upload.onPress?.() },
    { id: 'model', label: t('Switch model'), icon: <Sparkles {...ICON} />, keywords: ['model'], run: () => tune(go) },
    !!host?.chooseTheme && {
      id: 'theme',
      label: t('Toggle theme'),
      icon: <SunMoon {...ICON} />,
      keywords: ['dark', 'light', 'appearance'],
      run: () => host.chooseTheme?.(isLightTheme(host) ? 'dark' : 'light'),
    },
    !!host && !anon && { id: 'org', label: t('Switch organization'), icon: <Building2 {...ICON} />, keywords: ['org', 'team', 'workspace'], run: choose },
    { id: 'keys', label: t('Keyboard shortcuts'), icon: <Keyboard {...ICON} />, stay: true, run: keys },
    // It keeps the palette open, saying "Signing out…" until the page moves (lib/signout `useSigningOut`);
    // its own words stay among its keywords, so "log out" still finds it once the label has changed.
    !anon && { id: 'logout', label: out ? t('Signing out…') : t('Log out'), icon: <LogOut {...ICON} data-i18n-mirror />, keywords: ['log out', 'sign out'], stay: true, disabled: out, run: signOut },
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

export function Search({
  onClose,
  go,
  actions: frame = [],
  mode = 'chat',
  host,
}: {
  onClose: () => void
  /** Moves the app to one of its addresses (lib/host `talk`, `app`, `design`). */
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
  const [devMode] = useDevMode()
  const [recentJumps, setRecentJumps] = useKept<RecentJump[]>('hanzo.cmdk.recent', NO_JUMPS)
  const { threads } = useThreadList()
  const { agents } = useCrew()
  const repos = useRead('/v1/project', projects)
  const known = useRead('/v1/tool/skills?activated=true', skills)
  const plugged = useRead('/v1/tool/mcp/servers', connectors)
  const signOut = useSignOut()
  const signingOut = useSigningOut()
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
      run: () => (b.embed !== undefined ? go(hosted(b.id)) : (b.href as string).startsWith('/') ? go(b.href as string) : out(b.href as string)),
    }))
    const here = [...top.map(swap), ...frame.filter((b) => !top.some((a) => a.id === b.id)), ...granted]
    const baseDoing = actions(host, go, () => void signOut(), () => (setQuery(''), setKeys(true)), t, signingOut)
    const lightNow = isLightTheme(host)
    const openKeys = () => {
      setQuery('')
      setKeys(true)
    }
    const quick: Action[] = [
      {
        id: 'new-chat',
        label: t('New chat'),
        icon: <MARKS.chat.make {...ICON} />,
        shortcut: ['Mod', 'Shift', 'O'],
        keywords: ['chat', 'new', 'conversation', 'prompt', 'ask'],
        run: () => {
          empty()
          go(talk())
        },
      },
      {
        id: 'new-task',
        label: t('New Dev run'),
        icon: <MARKS.dev.make {...ICON} />,
        keywords: ['run', 'dev', 'task', 'build', 'code', 'new'],
        run: () => go(app('')),
      },
      {
        id: 'new-design',
        label: t('New Design'),
        icon: <MARKS.design.make {...ICON} />,
        keywords: ['design', 'canvas', 'studio', 'image', 'ui', 'new'],
        run: () => go(design('')),
      },
      {
        id: 'open-flow',
        label: t('Open Flow'),
        icon: <Workflow {...ICON} />,
        keywords: ['flow', 'workflow', 'pipeline', 'agents', 'open'],
        run: () => go(flow('')),
      },
      {
        id: 'theme',
        label: lightNow ? t('Switch to dark theme') : t('Switch to light theme'),
        icon: lightNow ? <Moon {...ICON} /> : <Sun {...ICON} />,
        shortcut: ['Mod', 'Shift', 'L'],
        keywords: ['theme', 'dark', 'light', 'mode', 'appearance', 'toggle', 'color'],
        run: () => {
          const next = isLightTheme(host) ? 'dark' : 'light'
          applyThemeChoice(host, next)
          ui.toast?.success(next === 'light' ? t('Switched to light theme') : t('Switched to dark theme'))
        },
      },
      {
        id: 'toggle-dev-mode',
        label: t('Toggle Developer mode'),
        icon: <Terminal {...ICON} />,
        where: devMode ? t('On') : t('Off'),
        shortcut: ['Mod', 'Shift', 'D'],
        keywords: ['developer', 'dev', 'mode', 'github', 'branches', 'terminals', 'advanced', 'toggle'],
        run: () => {
          const next = !getDevMode()
          setDevMode(next)
          ui.toast?.success(next ? t('Developer mode enabled') : t('Developer mode disabled'))
        },
      },
      {
        id: 'toggle-sidebar',
        label: t('Toggle sidebar'),
        icon: <PanelLeft {...ICON} />,
        shortcut: ['Mod', 'B'],
        keywords: ['sidebar', 'navigation', 'nav', 'rail', 'collapse', 'expand', 'toggle', 'panel'],
        run: () => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hanzo:toggle-sidebar'))
          }
        },
      },
      {
        id: 'upgrade-credits',
        label: t('Upgrade plan / Add credits'),
        icon: <CreditCard {...ICON} />,
        keywords: ['upgrade', 'plan', 'credits', 'top', 'up', 'billing', 'pricing', 'pro', 'max'],
        run: () => {
          if (typeof window !== 'undefined') {
            window.location.assign(payPage('/cart', window.location.href))
          }
        },
      },
      {
        id: 'open-billing',
        label: t('Manage billing & payments'),
        icon: <Wallet {...ICON} />,
        keywords: ['billing', 'pay', 'payment', 'invoices', 'receipts', 'card', 'subscription'],
        run: () => {
          if (typeof window !== 'undefined') {
            window.location.assign(payPage('/', window.location.href))
          }
        },
      },
      {
        id: 'open-settings',
        label: t('Open settings'),
        icon: <Settings {...ICON} />,
        shortcut: ['Mod', ','],
        keywords: ['settings', 'preferences', 'account', 'profile', 'open'],
        run: () => {
          rememberSettingsReturn()
          go(settings('account'))
        },
      },
      {
        id: 'keys',
        label: t('Keyboard shortcuts'),
        icon: <Keyboard {...ICON} />,
        shortcut: ['Mod', '/'],
        keywords: ['keyboard', 'shortcuts', 'hotkeys', 'keys', 'help'],
        stay: true,
        run: openKeys,
      },
      {
        id: 'copy-link',
        label: t('Copy current link'),
        icon: <Link2 {...ICON} />,
        keywords: ['copy', 'link', 'url', 'share', 'address', 'clipboard'],
        run: () => {
          if (typeof window === 'undefined' || !navigator.clipboard) return
          void navigator.clipboard.writeText(window.location.href).then(
            () => ui.toast?.success(t('Link copied')),
            () => ui.toast?.error(t('The browser would not copy the link.')),
          )
        },
      },
    ]
    const quickIds = new Set(quick.map((a) => a.id))
    const doing = [...quick, ...baseDoing.filter((a) => !quickIds.has(a.id))]
    const untitled = t('Untitled')
    const chats: Action[] = threads.map((c) => ({
      id: `chat-${c.id}`,
      label: tidy(c.title, 80, untitled),
      where: t('Chat'),
      at: c.updatedAt,
      icon: <MessageCircle {...ICON} />,
      run: () => (openThread(c.id), go(talk(c.id))),
    }))
    const tasks: Action[] = (runs?.value ?? []).map((s) => ({
      id: `run-${s.id}`,
      label: tidy(s.title, 80, t('Untitled run')),
      where: s.status ? `${t('Dev')} · ${s.status}` : t('Dev'),
      at: s.updatedAt || s.createdAt,
      keywords: [s.status ?? ''],
      icon: <MARKS.dev.icon {...ICON} />,
      run: () => go(app(s.id)),
    }))
    const projectRows: Action[] = repos.map((p) => ({
      ...p,
      id: `project-${p.id}`,
      icon: <FolderGit2 {...ICON} />,
      run: () => go(app(p.id)),
    }))
    const agentRows: Action[] = ordered(agents).map((one) => {
      const name = called(one.name)
      return { id: `agent-${one.id || one.name}`, label: name, icon: <Bot {...ICON} />, run: () => (withAgents([name]), go(talk())) }
    })
    const skillRows: Action[] = known.map((s) => ({
      ...s,
      id: `skill-${s.id}`,
      icon: <BookOpen {...ICON} />,
      run: () => go(app(SKILLS)),
    }))
    const connectorRows: Action[] = plugged.map((c) => ({
      ...c,
      id: `connector-${c.id}`,
      icon: <Plug {...ICON} />,
      run: () => go(app(CONNECTORS)),
    }))

    const allById = new Map<string, Action>()
    for (const row of [...doing, ...here, ...deep, ...chats, ...tasks, ...projectRows, ...agentRows, ...skillRows, ...connectorRows]) {
      if (!allById.has(row.id)) allById.set(row.id, row)
    }

    const trimmedStart = query.trimStart()
    const isCommandMode = trimmedStart.startsWith('>')
    let shown: Group<Action>[]

    if (isCommandMode) {
      const cmdQuery = trimmedStart.slice(1).trim()
      const matched = cmdQuery ? rank(doing, cmdQuery, doing.length) : doing
      shown = matched.length ? [{ id: 'commands', label: t('Commands'), items: matched }] : []
    } else {
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
      const recentJumpActions: Action[] = !query.trim()
        ? recentJumps
            .map((j) => allById.get(j.id))
            .filter((a): a is Action => Boolean(a))
            .slice(0, 3)
        : []
      const idleCommands = doing.filter((a) =>
        a.id === 'new-chat' || a.id === 'new-task' || a.id === 'open-settings' || a.id === 'theme',
      ).slice(0, 4)
      if (!query.trim()) {
        // Progressive disclosure at rest: 5–7 focused items total (max 3 recent + 4 key actions).
        const recentChatsAndRuns = [...chats, ...tasks]
          .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
          .slice(0, 3)
        const topRecent: Group<Action> | null =
          recentJumpActions.length > 0
            ? { id: 'recent-jumps', label: t('Recent jumps'), items: recentJumpActions }
            : recentChatsAndRuns.length > 0
              ? { id: 'recent', label: t('Recent'), items: recentChatsAndRuns }
              : null
        shown = [
          ...(topRecent ? [topRecent] : []),
          { id: 'actions', label: t('Commands'), items: idleCommands },
        ].filter((g) => g.items.length > 0)
      } else {
        shown = find<Action>(
          query,
          [...chats, ...tasks],
          [
            { id: 'actions', label: t('Commands'), items: idleCommands },
            { id: 'go', label: t('Go to'), items: here },
          ],
          [
            { id: 'actions', label: t('Commands'), items: doing },
            { id: 'go', label: t('Go to'), items: [...here, ...deep] },
            ...mine,
            { id: 'projects', label: t('Projects'), items: projectRows },
            { id: 'agents', label: t('Agents'), items: agentRows },
            { id: 'skills', label: t('Skills'), items: skillRows },
            { id: 'connectors', label: t('Connectors'), items: connectorRows },
          ],
        )
      }
    }

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
        disabled: a.disabled,
        // The palette ranked these against the query; the menu's own filter passes what it kept.
        keywords: [query],
        onSelect: () => {
          if (!a.stay && a.id !== 'logout') {
            setRecentJumps(recorded(recentJumps, { id: a.id, label: a.label, where: a.where }, Date.now()))
          }
          if (!a.stay) onClose()
          a.run()
        },
      })),
    }))
  }, [query, devMode, recentJumps, threads, agents, repos, known, plugged, frame, go, onClose, signOut, signingOut, mode, runs, host, opened, t])

  const apple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
  // A key's spelling keeps its writing order in right-to-left prose (`contextual` is plain text, so Unicode's isolate, not <bdi>).
  const spelled = (spelling: string) => (dir === 'rtl' ? isolate(spelling) : spelling)
  const listed: CommandMenuGroup[] = keys
    ? [
        {
          id: 'keys',
          label: t('Keyboard shortcuts'),
          items: keyRows().map((k) => ({ ...k, chord: k.chords.map((c) => (apple ? c.mac : c.pc)).join(' · ') })).filter((k) => {
            const needle = query.trim().toLowerCase()
            if (!needle) return true
            return t(k.does).toLowerCase().includes(needle) || k.chord.toLowerCase().includes(needle)
          }).map((k) => ({ id: `key-${k.does}`, label: t(k.does), contextual: spelled(k.chord), onSelect: () => setKeys(false) })),
        },
      ]
    : groups

  const XStack = ui.XStack
  const YStack = ui.YStack
  const Text = ui.Text
  const Input = ui.Input
  const ScrollView = ui.ScrollView
  const Kbd = ui.Kbd
  const Shortcut = ui.Shortcut

  const paletteId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const movedRef = useRef(false)
  const [activeId, setActiveId] = useState<string | undefined>(undefined)

  const visibleGroups = useMemo(() => listed.filter((g) => g.items.length > 0), [listed])
  const reachable = useMemo(() => visibleGroups.flatMap((g) => g.items.filter((it) => !it.disabled)), [visibleGroups])
  const current = reachable.find((it) => it.id === activeId) ?? reachable[0]
  const optionId = (id: string) => `${paletteId}-option-${id}`
  const listId = `${paletteId}-list`

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus?.(), 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!movedRef.current || !current || typeof document === 'undefined') return
    movedRef.current = false
    document.getElementById(optionId(current.id))?.scrollIntoView?.({ block: 'nearest' })
  })

  const isCommandMode = !keys && query.trimStart().startsWith('>')
  const canRenderNativePalette = Boolean(XStack && YStack && Text && Input && ScrollView)

  const handlePaletteKeyDown = (e: { key?: string; preventDefault?: () => void }) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!reachable.length) return
      e.preventDefault?.()
      const idx = current ? reachable.indexOf(current) : -1
      const delta = e.key === 'ArrowDown' ? 1 : -1
      const next = reachable[(idx + delta + reachable.length) % reachable.length]
      if (next) {
        movedRef.current = true
        setActiveId(next.id)
      }
    } else if (e.key === 'Enter') {
      if (!current) return
      e.preventDefault?.()
      current.onSelect()
    } else if (e.key === 'Escape') {
      e.preventDefault?.()
      if (keys) setKeys(false)
      else onClose()
    } else if (e.key === 'Backspace' && !query && keys) {
      e.preventDefault?.()
      setKeys(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent
        data-slot="palette"
        showCloseButton={false}
        p={0}
        gap={0}
        bg="var(--popover)"
        borderWidth={1}
        borderColor="var(--border-strong)"
        boxShadow="var(--shadow-floating)"
        width={640}
        maxW="calc(100vw - 24px)"
        // As tall as its rows, under a fixed top, so typing never moves the field.
        maxH="min(540px, 78dvh)"
        mt="12dvh"
        mb="auto"
        rounded="$6"
        overflow="hidden"
        onKeyDown={(e: { key?: string; defaultPrevented?: boolean; preventDefault?: () => void }) => {
          if (e.key === 'Escape' && !e.defaultPrevented) {
            e.preventDefault?.()
            if (keys) setKeys(false)
            else onClose()
          }
        }}
        $max-md={{
          width: 'calc(100vw - 24px)',
          maxW: 'calc(100vw - 24px)',
          maxH: 'min(540px, 82dvh)',
          mt: '6dvh',
          mb: 'auto',
          rounded: '$5',
        }}
      >
        <DialogTitle position="absolute" width={1} height={1} overflow="hidden" opacity={0}>
          {t('Search')}
        </DialogTitle>
        {canRenderNativePalette ? (
          <YStack data-slot="command-menu" shrink={1} minH={0}>
            <XStack
              data-slot="command-menu-bar"
              height={48}
              shrink={0}
              items="center"
              gap="$2.5"
              px="$3.5"
              borderBottomWidth={1}
              borderColor="$borderColor"
            >
              <SearchIcon size={15} color="var(--muted-foreground)" aria-hidden />
              <Input
                ref={inputRef as never}
                data-slot="command-menu-input"
                {...({
                  role: 'combobox',
                  'aria-expanded': true,
                  'aria-controls': listId,
                  'aria-autocomplete': 'list',
                  'aria-activedescendant': current ? optionId(current.id) : undefined,
                  'aria-label': t('Search'),
                } as object)}
                flex={1}
                minW={0}
                height={46}
                px={0}
                borderWidth={0}
                rounded={0}
                bg="transparent"
                outlineWidth={0}
                hoverStyle={{ bg: 'transparent' }}
                focusStyle={{ outlineWidth: 0 }}
                focusVisibleStyle={{ outlineWidth: 0 }}
                color="$ink"
                fontFamily="$body"
                fontSize="$3"
                // 16px on a phone so the browser never zooms into the input.
                $max-md={{ fontSize: 16 }}
                placeholder={t('Search, jump to settings, or type > for commands…')}
                placeholderTextColor="$hint"
                value={query}
                onChangeText={(text: string) => {
                  setQuery(text)
                  setActiveId(undefined)
                }}
                onKeyDown={handlePaletteKeyDown as never}
              />
              {query ? (
                <XStack
                  render={<button type="button" />}
                  aria-label={t('Clear search')}
                  onClick={() => {
                    setQuery('')
                    setActiveId(undefined)
                    inputRef.current?.focus?.()
                  }}
                  width={26}
                  height={26}
                  $touchable={{ minW: 44, minH: 44 }}
                  $max-sm={{ minW: 44, minH: 44 }}
                  rounded="$2"
                  borderWidth={0}
                  bg="transparent"
                  items="center"
                  justify="center"
                  cursor="pointer"
                  hoverStyle={{ bg: '$hover' }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  shrink={0}
                >
                  <X size={14} color="var(--muted-foreground)" aria-hidden />
                </XStack>
              ) : null}
              <XStack
                render={<button type="button" />}
                aria-label={keys ? t('Back') : t('Close')}
                onClick={keys ? () => setKeys(false) : onClose}
                minH={26}
                px="$1.5"
                $touchable={{ minW: 44, minH: 44 }}
                $max-sm={{ minW: 44, minH: 44 }}
                rounded="$2"
                borderWidth={0}
                bg="transparent"
                shrink={0}
                items="center"
                justify="center"
                cursor="pointer"
                opacity={0.75}
                hoverStyle={{ opacity: 1, bg: '$hover' }}
                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              >
                <XStack $max-md={{ display: 'none' }}>
                  {Kbd ? <Kbd>esc</Kbd> : <Text fontFamily="$mono" fontSize="$1" color="$soft">esc</Text>}
                </XStack>
                <Text display="none" $max-md={{ display: 'flex' }} fontSize="$2" fontWeight="500" color="$ink">
                  {t('Cancel')}
                </Text>
              </XStack>
            </XStack>

            <ScrollView
              data-slot="command-menu-scroll"
              shrink={1}
              minH={0}
              $platform-web={{ overscrollBehavior: 'contain' }}
            >
              <YStack id={listId} data-slot="command-menu-list" p="$2" gap="$1">
                {visibleGroups.map((g, gi) => {
                  const head = `${paletteId}-group-${g.id}`
                  return (
                    <YStack key={g.id} data-slot="command-menu-group" pt={gi > 0 ? '$1.5' : 0}>
                      <XStack id={head} data-slot="command-menu-heading" px="$2.5" pt="$1" pb="$1.5" items="center">
                        <Text fontFamily="$body" fontSize="$1" fontWeight="500" color="$soft" numberOfLines={1}>
                          {g.label}
                        </Text>
                      </XStack>
                      <YStack {...({ role: 'listbox' } as object)} aria-labelledby={head} gap={1}>
                        {g.items.map((it) => {
                          const on = current?.id === it.id
                          return (
                            <XStack
                              key={it.id}
                              id={optionId(it.id)}
                              data-slot="command-menu-item"
                              {...({
                                role: 'option',
                                'aria-selected': on,
                                'aria-disabled': it.disabled || undefined,
                              } as object)}
                              data-active={on ? '' : undefined}
                              items="center"
                              gap="$2.5"
                              px="$2.5"
                              py="$1.5"
                              minH={38}
                              $touchable={{ minH: 44 }}
                              $max-sm={{ minH: 44 }}
                              rounded="$3"
                              cursor={it.disabled ? 'default' : 'pointer'}
                              opacity={it.disabled ? 0.5 : 1}
                              bg={on ? '$hover' : 'transparent'}
                              hoverStyle={it.disabled ? undefined : { bg: '$hover' }}
                              onMouseEnter={it.disabled ? undefined : () => setActiveId(it.id)}
                              onClick={it.disabled ? undefined : it.onSelect}
                            >
                              <XStack width={18} height={18} shrink={0} items="center" justify="center" opacity={on ? 0.95 : 0.65} aria-hidden>
                                {it.icon}
                              </XStack>
                              <XStack flex={1} minW={0} items="baseline" gap="$2">
                                <Text
                                  fontFamily="$body"
                                  fontSize="$2"
                                  fontWeight="500"
                                  color="$ink"
                                  numberOfLines={1}
                                  shrink={1}
                                >
                                  {it.label}
                                </Text>
                                {it.contextual ? (
                                  <Text
                                    fontFamily="$body"
                                    fontSize="$1"
                                    fontWeight="400"
                                    color="$soft"
                                    numberOfLines={1}
                                    shrink={0}
                                  >
                                    {it.contextual}
                                  </Text>
                                ) : null}
                              </XStack>
                              {it.shortcut && Shortcut ? (
                                <XStack shrink={0} $max-md={{ display: 'none' }}>
                                  <Shortcut keys={it.shortcut} />
                                </XStack>
                              ) : null}
                            </XStack>
                          )
                        })}
                      </YStack>
                    </YStack>
                  )
                })}
                {visibleGroups.length === 0 ? (
                  <YStack data-slot="command-menu-empty" role="status" aria-live="polite" py="$6" items="center" justify="center">
                    <Text fontFamily="$body" fontSize="$2" color="$soft">
                      {keys ? t('No such key.') : t('Nothing matches “{query}”.', { query: query.trim() })}
                    </Text>
                  </YStack>
                ) : null}
              </YStack>
            </ScrollView>
          </YStack>
        ) : (
          <CommandMenu
            groups={listed}
            query={query}
            onQueryChange={setQuery}
            placeholder={t('Search, jump to settings, or type > for commands…')}
            label={t('Search')}
            empty={keys ? t('No such key.') : t('Nothing matches “{query}”.', { query: query.trim() })}
            onBack={keys ? () => setKeys(false) : undefined}
            onClose={onClose}
          />
        )}
        {XStack && Text ? (
          <XStack
            data-slot="palette-footer"
            shrink={0}
            items="center"
            justify="space-between"
            gap="$3"
            px="$3.5"
            py="$2"
            borderTopWidth={1}
            borderColor="$edge"
            bg="$panel"
            $max-sm={{ display: 'none' }}
          >
            <XStack items="center" gap="$3" flexWrap="wrap">
              <XStack items="center" gap="$1">
                {Kbd ? <Kbd>↑↓</Kbd> : <Text fontFamily="$mono" fontSize="$1" color="$soft">↑↓</Text>}
                <Text fontFamily="$body" fontSize="$1" color="$soft">
                  {t('Navigate')}
                </Text>
              </XStack>
              <XStack items="center" gap="$1">
                {Kbd ? <Kbd>↵</Kbd> : <Text fontFamily="$mono" fontSize="$1" color="$soft">↵</Text>}
                <Text fontFamily="$body" fontSize="$1" color="$soft">
                  {t('Open')}
                </Text>
              </XStack>
              <XStack items="center" gap="$1">
                {Kbd ? <Kbd>&gt;</Kbd> : <Text fontFamily="$mono" fontSize="$1" color="$soft">&gt;</Text>}
                <Text fontFamily="$body" fontSize="$1" color="$soft">
                  {t('Commands')}
                </Text>
              </XStack>
              <XStack items="center" gap="$1">
                {Kbd ? <Kbd>Esc</Kbd> : <Text fontFamily="$mono" fontSize="$1" color="$soft">Esc</Text>}
                <Text fontFamily="$body" fontSize="$1" color="$soft">
                  {t('Close')}
                </Text>
              </XStack>
            </XStack>
            {isCommandMode ? (
              <Text fontFamily="$body" fontSize="$1" fontWeight="500" color="$ink" shrink={0}>
                {t('Command mode')}
              </Text>
            ) : null}
          </XStack>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
