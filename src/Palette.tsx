'use client'

// The one search. ⌘K / Ctrl+K from anywhere and the sidebar's search open it:
// a dialog with the field on top, listing Recent chats while the field is empty
// and, for a query, Chats, Projects, Agents, Skills and Actions, each cut to its
// best five (seek.ts `find`). A row opens where it lives: a chat at its
// address, a project in Dev, an agent in a new chat with it, a skill in Dev's
// Customize, an action runs. Arrows move, Enter opens, Escape closes
// (@hanzo/ui's CommandMenu); Keyboard shortcuts lists the app's keys, and
// Backspace on an empty field comes back.
//
// MOUNTED ONLY WHILE OPEN, and every list is read once as it opens, then
// searched here as the reader types: the conversations store (hanzoai/agent)
// answers its whole list and searches nothing, titles or words, so there is no
// read per key to wait for or to cancel. The chats are the sidebar's last read
// (thread.tsx `useThreadList`), drawn at once and read again behind it; the
// projects (`/v1/projects`), the active skills (`/v1/tool/skills?activated=true`)
// and the agents (crew.tsx) arrive while the reader types, and a read the
// palette closes on is aborted.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BookOpen, Bot, Code2, FolderGit2, Keyboard, LogOut, MessageCircle, Puzzle, Settings, SquarePen } from 'lucide-react'
import { useAi } from '@hanzo/ai/react'
import { path as written } from '@hanzo/build'
import { Dialog, DialogContent, DialogTitle, type ShortcutKeys } from '@hanzo/ui'
import { CommandMenu, type CommandMenuGroup } from '@hanzo/ui/product/CommandMenu'
import { ordered } from './agents'
import { useCrew } from './crew'
import { called } from './team'
import { empty, openThread, withAgents } from './open'
import { useThreadList } from './thread'
import { useSignOut } from './lib/signout'
import { app, talk } from './lib/host'
import { find, type Hit } from './seek'

/** A row: what it is called, its glyph, and what pressing it does. */
export interface Action extends Hit {
  icon?: ReactNode
  shortcut?: ShortcutKeys
  run: () => void
  /** Pressing it keeps the palette open. */
  stay?: boolean
}

const ICON = { size: 16, 'aria-hidden': true } as const

/** The app's keys, as Keyboard shortcuts lists them. */
const KEYS: { id: string; label: string; shortcut: ShortcutKeys }[] = [
  { id: 'search', label: 'Search', shortcut: ['Mod', 'K'] },
  { id: 'settings', label: 'Settings', shortcut: ['Mod', ','] },
  { id: 'panel', label: 'Side panel', shortcut: ['Mod', '.'] },
  { id: 'rename', label: 'Rename chat', shortcut: ['Ctrl', 'Alt', 'R'] },
  { id: 'pin', label: 'Pin or unpin chat', shortcut: ['Ctrl', 'Alt', 'P'] },
  { id: 'back', label: 'Back, in the desktop app', shortcut: ['Alt', 'ArrowLeft'] },
  { id: 'forward', label: 'Forward, in the desktop app', shortcut: ['Alt', 'ArrowRight'] },
]

const SKILLS = written({ kind: 'customize', tab: 'skills' })

/** A list read once as the palette opens; a refusal leaves it empty and the rest still answer. */
function useRead(path: string, shape: (body: unknown) => Hit[]): Hit[] {
  const ai = useAi()
  const [rows, setRows] = useState<Hit[]>([])
  useEffect(() => {
    const stop = new AbortController()
    ai.http.json<unknown>({ path, signal: stop.signal }).then(
      (body) => setRows(shape(body)),
      () => {},
    )
    return () => stop.abort()
    // `shape` is a module constant at each call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, path])
  return rows
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const rows = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** `/v1/projects`: a project by its slug, found by its name, slug and repository. */
const projects = (body: unknown): Hit[] =>
  (Array.isArray(body) ? body : rows(obj(body).data))
    .map(obj)
    .filter((p) => str(p.slug))
    .map((p) => ({ id: str(p.slug), label: str(p.name) || str(p.slug), keywords: [str(p.slug), str(obj(p.repo).url)] }))

/** `/v1/tool/skills?activated=true`: a skill by its name, its tool's less `skill_`. */
const skills = (body: unknown): Hit[] =>
  rows(obj(body).tools)
    .map(obj)
    .filter((t) => str(t.name))
    .map((t) => ({ id: str(t.name), label: str(t.name).replace(/^skill_/, ''), keywords: [str(t.description)] }))

export function Palette({
  onClose,
  go,
  actions = [],
}: {
  onClose: () => void
  /** Moves the app to one of its addresses (lib/host `talk`, `app`). */
  go: (address: string) => void
  /** The frame's own actions, after the palette's; one with a palette action's id stands in for it. */
  actions?: Action[]
}) {
  const [query, setQuery] = useState('')
  const [keys, setKeys] = useState(false)
  const { threads } = useThreadList()
  const { agents } = useCrew()
  const made = useRead('/v1/projects', projects)
  const known = useRead('/v1/tool/skills?activated=true', skills)
  const signOut = useSignOut()

  const groups = useMemo<CommandMenuGroup[]>(() => {
    const own: Action[] = [
      { id: 'new-chat', label: 'New chat', icon: <SquarePen {...ICON} />, run: () => (empty(), go(talk())) },
      { id: 'new-task', label: 'New Dev task', icon: <Code2 {...ICON} />, run: () => go(app('')) },
      { id: 'settings', label: 'Settings', icon: <Settings {...ICON} />, shortcut: ['Mod', ','], run: () => go(app(written({ kind: 'settings', section: 'general' }))) },
      { id: 'customize', label: 'Customize', icon: <Puzzle {...ICON} />, run: () => go(app(SKILLS)) },
      { id: 'keys', label: 'Keyboard shortcuts', icon: <Keyboard {...ICON} />, stay: true, run: () => (setQuery(''), setKeys(true)) },
      { id: 'logout', label: 'Log out', icon: <LogOut {...ICON} />, run: () => void signOut() },
    ]
    const doing = [...own.map((a) => actions.find((b) => b.id === a.id) ?? a), ...actions.filter((b) => !own.some((a) => a.id === b.id))]
    const chats: Action[] = threads.map((t) => ({
      id: `chat-${t.id}`,
      label: t.title || 'Untitled',
      at: t.updatedAt,
      icon: <MessageCircle {...ICON} />,
      run: () => (openThread(t.id), go(talk(t.id))),
    }))
    const shown = find<Action>(query, chats, [
      { id: 'projects', label: 'Projects', items: made.map((p) => ({ ...p, id: `project-${p.id}`, icon: <FolderGit2 {...ICON} />, run: () => go(app(p.id)) })) },
      {
        id: 'agents',
        label: 'Agents',
        items: ordered(agents).map((one) => {
          const name = called(one.name)
          return { id: `agent-${one.id || one.name}`, label: name, icon: <Bot {...ICON} />, run: () => (withAgents([name]), go(talk())) }
        }),
      },
      { id: 'skills', label: 'Skills', items: known.map((s) => ({ ...s, id: `skill-${s.id}`, icon: <BookOpen {...ICON} />, run: () => go(app(SKILLS)) })) },
      { id: 'actions', label: 'Actions', items: doing },
    ])
    return shown.map((g) => ({
      ...g,
      items: g.items.map((a) => ({
        id: a.id,
        label: a.label,
        icon: a.icon,
        shortcut: a.shortcut,
        // The palette ranked these against the query; the menu's own filter passes what it kept.
        keywords: [query],
        onSelect: () => {
          if (!a.stay) onClose()
          a.run()
        },
      })),
    }))
  }, [query, threads, agents, made, known, actions, go, onClose, signOut])

  const listed: CommandMenuGroup[] = keys
    ? [{ id: 'keys', label: 'Keyboard shortcuts', items: KEYS.map((k) => ({ ...k, id: `key-${k.id}`, onSelect: () => setKeys(false) })) }]
    : groups

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent
        data-slot="palette"
        p={0}
        gap={0}
        width="100%"
        maxW={680}
        height="min(520px, calc(100dvh - 32px))"
        rounded="$6"
        overflow="hidden"
        // A phone's palette is the whole screen, a sheet under the browser's bar.
        $max-md={{ width: '100vw', maxW: '100vw', height: '100dvh', rounded: 0, borderWidth: 0 }}
      >
        <DialogTitle position="absolute" width={1} height={1} overflow="hidden" opacity={0}>
          Search
        </DialogTitle>
        <CommandMenu
          groups={listed}
          query={query}
          onQueryChange={setQuery}
          placeholder="Search…"
          label="Search"
          empty={keys ? 'No such key.' : query.trim() ? `Nothing matches “${query.trim()}”.` : 'No chats yet.'}
          onBack={keys ? () => setKeys(false) : undefined}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
