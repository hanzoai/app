'use client'

// The one unified sidebar list across Chat, Dev, Design, and Studio:
// - Chat reads `/v1/agents/chat/conversations` (`useThreadList`)
// - Dev reads `/v1/agent/sessions` (`@hanzo/dev/builder` `useSessions`)
// - Design & Studio read `@hanzo/studio` `useRecent`
//
// Standard mode (`≡` OFF):
//   - Collapsible `Pinned` section
//   - Collapsible `Projects` section (Chat `[Project]` groups & Dev repos/projects)
//   - `Recents` section with Organize / Sort / Density (1, 2, 3 lines) / Show / Select multiple
//
// Priority / Day-by-Day Context mode (`≡` ON):
//   - `Priority` section at top (running / paused / error / unread / pinned)
//   - Day-by-day chronological sections (`Today`, `Yesterday`, exact weekdays, `Older`)
//   - Defaults to 3-line cards (title + 2 lines of context), while supporting 1/2/3 lines in either view.
//
// ONE `<ConversationMenu>` wraps the whole list so Shift+click range select, Cmd/Ctrl+click,
// click-drag, mobile touch-drag, right-click context menu, and the borderless icon-only
// multi-select bar work identically across every section and every app.

import { useI18n } from '@hanzo/i18n/react'
import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { ScrollView, SizableText, XStack, YStack } from '@hanzo/gui'
import { CheckSquare, ChevronDown, ChevronRight, Folder, GitBranch, GitPullRequest, ListFilter } from 'lucide-react'
import type { Thread } from '@hanzo/ai'
import { DOTS, route, useRunMarks, useSessions, type Host } from '@hanzo/dev/builder'
import * as studioPkg from '@hanzo/studio'
import { DropdownMenu, type DropdownMenuProps } from '@hanzo/ui'
import { SidebarItem, StatusDot } from '@hanzo/ui/chat'
import { useKept } from './kept'
import { app, design, studio } from './lib/host'
import { site } from './where'
import {
  ago,
  arrange,
  arrangePriority,
  chats,
  DENSITIES,
  densityOf,
  designs,
  hasUnreadUpdate,
  MENUS,
  PINNED,
  PLAIN,
  PRIORITY,
  projectGroups,
  PROJECTS,
  runs,
  SINCE,
  UNFILED,
  UNTITLED,
  UNTITLED_RUN,
  viewOf,
  type Density,
  type Mode,
  type Option,
  type Recent,
  type View,
} from './recent'
import type { Say } from '@hanzo/i18n'
import { ConversationMenu, ThreadRow, useThreadList, type ThreadActions } from './thread'

/** A Design/Studio conversation as `@hanzo/studio` lists it (`Listed`). */
type Made = { id: string; title: string; updated: number; state: 'making' | 'done' | 'failed'; count?: number; preview?: string; prompt?: string }

/**
 * Studio's own read of Design/Studio conversations (`@hanzo/studio` `useRecent`):
 * this browser's store, shared with Studio's panes. An older Studio has none,
 * and Design/Studio then lists nothing here, never Chat's.
 */
const useMade = Reflect.get(studioPkg, 'useRecent') as ((host: Host) => { rows: Made[]; error: string }) | undefined

/** The view/organize menu items: Organize by, Sort by, Density (1/2/3 lines), Show, Last activity, Select multiple. */
function items(
  mode: Mode,
  view: View,
  set: (v: View) => void,
  density: Density,
  setDensity: (d: Density) => void,
  priorityMode: boolean,
  t: Say,
  select: boolean,
): NonNullable<DropdownMenuProps['items']> {
  const m = MENUS[mode]
  const section = <K extends keyof View>(key: K, label: string, options: Option<NonNullable<View[K]>>[]): NonNullable<DropdownMenuProps['items']> =>
    options.length
      ? [
          { type: 'label', key: `${key}-label`, label },
          ...options.map((o) => ({
            key: `${key}-${String(o.id)}`,
            label: t(o.label),
            selected: view[key] === o.id,
            closeOnSelect: false,
            onSelect: () => set({ ...view, [key]: o.id }),
          })),
        ]
      : []

  const densitySection: NonNullable<DropdownMenuProps['items']> = [
    { type: 'label', key: 'density-label', label: t('Density') },
    ...DENSITIES.map((d) => ({
      key: `density-${d.id}`,
      label: t(d.label),
      selected: density === d.id,
      closeOnSelect: false,
      onSelect: () => setDensity(d.id),
    })),
  ]

  const parts = [
    ...(priorityMode ? [] : [section('group', t('Organize by'), m.group)]),
    section('sort', t('Sort by'), m.sort),
    densitySection,
    section('status', t('Show'), m.status),
    section('since', t('Last activity'), SINCE),
  ].filter((p) => p.length)

  const base = parts.flatMap((p, i) => (i ? [{ type: 'separator' as const, key: `sep-${i}` }, ...p] : p))
  if (!select) return base
  return [
    ...base,
    { type: 'separator' as const, key: 'sep-select' },
    {
      key: 'select-multiple',
      label: t('Select multiple'),
      onSelect: () => {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('hanzo:recents-select'))
      },
    },
  ]
}

const Note = ({ children }: { children: string }) => (
  <SizableText size="$1" color="$soft" px="$2" py="$1.5">
    {children}
  </SizableText>
)

export function Recents({
  host,
  mode,
  thread,
  priorityMode = false,
  onOpen,
  onNew,
}: {
  /** The mode's host: Design/Studio's is the one Studio is mounted with (App.tsx `maker`), whose path is Studio's. */
  host: Host
  mode: Mode
  /** The Chat conversation the pane holds, or null. */
  thread: string | null
  /** In-place `≡` Priority / Day-by-Day context mode toggled from Sidebar header. */
  priorityMode?: boolean
  onOpen: (r: Recent) => void
  /** Moves the pane to a new conversation: where it goes when the one it holds is deleted. */
  onNew: () => void
}) {
  const [kept, keep] = useKept<unknown>(`hanzo.recents.${mode}`, PLAIN)
  const [priorityDensity, setPriorityDensity] = useKept<Density | null>(`hanzo.recents.priorityDensity.${mode}`, null)
  const view = viewOf(mode, kept)
  const density = densityOf(mode, view, priorityMode, priorityDensity ?? undefined)
  const updateDensity = (d: Density) => {
    if (priorityMode) setPriorityDensity(d)
    else keep({ ...view, density: d })
  }
  if (mode === 'chat') {
    return (
      <Chats
        thread={thread}
        view={view}
        keep={keep}
        density={density}
        onDensity={updateDensity}
        priorityMode={priorityMode}
        onOpen={onOpen}
        onNew={onNew}
      />
    )
  }
  if (mode === 'design' || mode === 'studio') {
    return useMade ? (
      <CreativeRecents
        host={host}
        mode={mode}
        view={view}
        keep={keep}
        density={density}
        onDensity={updateDensity}
        priorityMode={priorityMode}
      />
    ) : (
      <YStack flex={1} minH={0} />
    )
  }
  return (
    <Runs
      host={host}
      view={view}
      keep={keep}
      density={density}
      onDensity={updateDensity}
      priorityMode={priorityMode}
      onOpen={onOpen}
    />
  )
}

type CreativeMeta = { title?: string; pinned?: boolean; archived?: boolean; deleted?: boolean }

/** Design & Studio Recents: `@hanzo/studio` conversations opened at `/design` or `/studio`. */
function CreativeRecents({
  host,
  mode,
  view,
  keep,
  density,
  onDensity,
  priorityMode,
}: {
  host: Host
  mode: 'design' | 'studio'
  view: View
  keep: (v: View) => void
  density: Density
  onDensity: (d: Density) => void
  priorityMode: boolean
}) {
  const { rows: made, error } = useMade!(host)
  const [meta, setMeta] = useKept<Record<string, CreativeMeta>>(`hanzo.${mode}.meta`, {})
  const metaRef = useRef(meta)
  metaRef.current = meta
  const patchMeta = (id: string, patch: Partial<CreativeMeta>) => {
    const next = {
      ...(metaRef.current ?? {}),
      [id]: { ...(metaRef.current?.[id] ?? {}), ...patch },
    }
    metaRef.current = next
    setMeta(next)
  }
  const visibleMade = useMemo(
    () =>
      made
        .filter((m) => !meta?.[m.id]?.deleted)
        .filter((m) => (view.status === 'archived' ? Boolean(meta?.[m.id]?.archived) : !meta?.[m.id]?.archived)),
    [made, meta, view.status],
  )
  const rows = useMemo(
    () =>
      designs(visibleMade, mode).map((r) => ({
        ...r,
        title: meta?.[r.id]?.title || r.title,
        status: view.status === 'archived' ? 'archived' : r.status,
        ...(meta?.[r.id]?.pinned ? { pinned: true } : {}),
      })),
    [visibleMade, meta, mode, view.status],
  )
  const byId = useMemo(
    () =>
      new Map<string, Thread>(
        rows.map((r) => [
          r.id,
          {
            id: r.id,
            title: r.title || UNTITLED,
            updatedAt: r.at,
            pinned: Boolean(meta?.[r.id]?.pinned),
            archived: Boolean(meta?.[r.id]?.archived),
          },
        ]),
      ),
    [rows, meta],
  )
  const actions = useMemo<ThreadActions>(
    () => ({
      pin: async (t: Thread) => {
        patchMeta(t.id, { pinned: !t.pinned })
        return true
      },
      archive: async (t: Thread) => {
        patchMeta(t.id, { archived: !t.archived })
        return true
      },
      rename: async (t: Thread, next: string) => {
        const title = next.trim()
        if (!title || title === (t.title ?? '')) return true
        patchMeta(t.id, { title })
        return true
      },
      remove: async (t: Thread) => {
        patchMeta(t.id, { deleted: true })
        return true
      },
    }),
    [],
  )
  const routeFor = mode === 'studio' ? studio : design
  const creativeHref = (id: string) => new URL(site(routeFor(studioPkg.path({ kind: 'chat', id }))), window.location.href).href
  const failed = useMemo(() => (error ? new Error(error) : null), [error])
  const at = studioPkg.route(host.path)
  const held = at.kind === 'chat' ? at.id : null
  return (
    <List
      mode={mode}
      rows={rows}
      view={view}
      keep={keep}
      density={density}
      onDensity={onDensity}
      priorityMode={priorityMode}
      open={(r) => r.id === held}
      reading={false}
      error={failed}
      onOpen={(r) => host.go(studioPkg.path({ kind: 'chat', id: r.id }))}
      threads={byId}
      held={held}
      onNew={() => host.go('')}
      customActions={actions}
      hrefOf={creativeHref}
    />
  )
}

const EMPTY_SEEN: Record<string, number> = {}

/** Chat's Recents: the conversation store alone, the archived ones when the view asks for them. */
function Chats({
  thread,
  view,
  keep,
  density,
  onDensity,
  priorityMode,
  onOpen,
  onNew,
}: {
  thread: string | null
  view: View
  keep: (v: View) => void
  density: Density
  onDensity: (d: Density) => void
  priorityMode: boolean
  onOpen: (r: Recent) => void
  onNew: () => void
}) {
  const store = useThreadList(view.status === 'archived', thread)
  const byId = useMemo(() => new Map(store.threads.map((t) => [t.id, t])), [store.threads])
  const [seenAt, setSeenAt] = useKept<Record<string, number>>('hanzo.chat.seen.v1', EMPTY_SEEN)
  const seenRef = useRef(seenAt)
  seenRef.current = seenAt

  useEffect(() => {
    if (!store.threads.length) return
    const current = seenRef.current ?? EMPTY_SEEN
    let changed = false
    const next = { ...current }
    for (const item of store.threads) {
      const parsedTs = item.updatedAt ? Date.parse(item.updatedAt) : Number.NaN
      const itemTs = Number.isFinite(parsedTs) && parsedTs > 0 ? parsedTs : 1
      if (item.id === thread) {
        if ((next[item.id] ?? 0) < itemTs) {
          next[item.id] = itemTs
          changed = true
        }
      } else if (next[item.id] === undefined) {
        next[item.id] = itemTs
        changed = true
      }
    }
    if (changed) {
      seenRef.current = next
      setSeenAt(next)
    }
  }, [store.threads, thread, setSeenAt])

  const unreadIds = useMemo(() => {
    const out = new Set<string>()
    for (const item of store.threads) {
      if ((item as { unread?: boolean }).unread || hasUnreadUpdate(item.id, item.updatedAt, thread, seenAt ?? {})) {
        out.add(item.id)
      }
    }
    return out
  }, [store.threads, thread, seenAt])

  const rows = useMemo(
    () =>
      chats(store.threads).map((r) => (unreadIds.has(r.id) ? { ...r, unread: true } : r)),
    [store.threads, unreadIds],
  )

  return (
    <List
      mode="chat"
      rows={rows}
      view={view}
      keep={keep}
      density={density}
      onDensity={onDensity}
      priorityMode={priorityMode}
      open={(r) => r.id === thread}
      reading={store.loading && !store.threads.length}
      error={store.error}
      onOpen={onOpen}
      threads={byId}
      held={thread}
      onNew={onNew}
      unreadIds={unreadIds}
    />
  )
}

/** Dev's Recents: the org's coding runs with repo, branch, git work status, PR badge, and unified controls. */
function Runs({
  host,
  view,
  keep,
  density,
  onDensity,
  priorityMode,
  onOpen,
}: {
  host: Host
  view: View
  keep: (v: View) => void
  density: Density
  onDensity: (d: Density) => void
  priorityMode: boolean
  onOpen: (r: Recent) => void
}) {
  const store = useSessions(host)
  const [meta, patchMeta] = useRunMarks()
  const r = route(host.path)
  const run = r.kind === 'run' ? r.id : null
  const asked = useRef(new Set<string>())
  const reload = store.reload
  useEffect(() => {
    if (!run || store.loading || asked.current.has(run) || store.value.some((s) => s.id === run)) return
    asked.current.add(run)
    reload()
  }, [run, store.loading, store.value, reload])
  const visibleSessions = useMemo(
    () =>
      store.value
        .filter((s) => !meta?.[s.id]?.deleted)
        .filter((s) => (view.status === 'archived' ? Boolean(meta?.[s.id]?.archived) : !meta?.[s.id]?.archived))
        .map((s) => ({
          ...s,
          title: meta?.[s.id]?.title || s.title,
          status: view.status === 'archived' ? 'archived' : s.status,
          pinned: Boolean(meta?.[s.id]?.pinned),
        })),
    [store.value, meta, view.status],
  )
  const rows = useMemo(() => runs(visibleSessions), [visibleSessions])
  const byId = useMemo(
    () =>
      new Map<string, Thread>(
        visibleSessions.map((s) => [
          s.id,
          {
            id: s.id,
            title: s.title || UNTITLED_RUN,
            updatedAt: s.updatedAt || s.createdAt,
            pinned: Boolean(s.pinned),
            archived: Boolean(meta?.[s.id]?.archived),
          },
        ]),
      ),
    [visibleSessions, meta],
  )
  const devActions = useMemo<ThreadActions>(
    () => ({
      pin: async (t: Thread) => {
        patchMeta(t.id, { pinned: !t.pinned })
        return true
      },
      archive: async (t: Thread) => {
        patchMeta(t.id, { archived: !t.archived })
        return true
      },
      rename: async (t: Thread, next: string) => {
        const title = next.trim()
        if (!title || title === (t.title ?? '')) return true
        patchMeta(t.id, { title })
        const tok = host.token?.()
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (tok) headers.Authorization = `Bearer ${tok}`
        if (host.org) headers['X-Org-Id'] = host.org
        void fetch(`${host.api}/v1/agent/sessions/${encodeURIComponent(t.id)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ title }),
        }).catch(() => {})
        return true
      },
      remove: async (t: Thread) => {
        patchMeta(t.id, { deleted: true })
        const tok = host.token?.()
        const headers: Record<string, string> = {}
        if (tok) headers.Authorization = `Bearer ${tok}`
        if (host.org) headers['X-Org-Id'] = host.org
        void fetch(`${host.api}/v1/agent/sessions/${encodeURIComponent(t.id)}`, {
          method: 'DELETE',
          headers,
        }).catch(() => {})
        return true
      },
    }),
    [host],
  )
  const runHref = (id: string) => new URL(site(app(id)), window.location.href).href
  return (
    <List
      mode="dev"
      rows={rows}
      view={view}
      keep={keep}
      density={density}
      onDensity={onDensity}
      priorityMode={priorityMode}
      open={(row) => row.id === run}
      reading={store.loading && !store.value.length}
      error={store.error}
      onOpen={onOpen}
      threads={byId}
      held={run}
      onNew={() => host.go('')}
      customActions={devActions}
      hrefOf={runHref}
    />
  )
}

/** Reorder an id list by dragging `sourceId` onto `targetId`. */
export function reorderRecentsIds(
  ids: readonly string[],
  sourceId: string,
  targetId: string,
  position?: 'before' | 'after',
): string[] {
  if (!sourceId || !targetId || sourceId === targetId) return [...ids]
  const from = ids.indexOf(sourceId)
  const to = ids.indexOf(targetId)
  if (to < 0) return [...ids.filter((id) => id !== sourceId), sourceId]
  const next = ids.filter((id) => id !== sourceId)
  const at = next.indexOf(targetId)
  const insertAfter = position ? position === 'after' : from >= 0 && from < to
  next.splice(insertAfter ? at + 1 : at, 0, sourceId)
  return next
}

/** Apply a saved manual drag order within a group while keeping brand-new items at the top. */
export function applyRecentsOrder<T extends { id: string }>(rows: readonly T[], savedOrder: readonly string[]): T[] {
  if (!savedOrder.length || rows.length < 2) return [...rows]
  const rank = new Map<string, number>()
  savedOrder.forEach((id, i) => rank.set(id, i))
  const unranked: T[] = []
  const ranked: T[] = []
  for (const r of rows) {
    if (rank.has(r.id)) ranked.push(r)
    else unranked.push(r)
  }
  ranked.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
  return [...unranked, ...ranked]
}

function List({
  mode,
  rows,
  view,
  keep,
  density,
  onDensity,
  priorityMode,
  open,
  reading,
  error,
  onOpen,
  threads,
  held = null,
  onNew,
  customActions,
  hrefOf,
  unreadIds,
}: {
  mode: Mode
  rows: Recent[]
  view: View
  keep: (v: View) => void
  density: Density
  onDensity: (d: Density) => void
  priorityMode: boolean
  open: (r: Recent) => boolean
  reading: boolean
  error: Error | null | undefined
  onOpen: (r: Recent) => void
  threads?: Map<string, Thread>
  held?: string | null
  onNew?: () => void
  customActions?: ThreadActions
  hrefOf?: (id: string) => string
  unreadIds?: Set<string>
}) {
  const { t } = useI18n()
  const label = useId()
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
  const [savedOrder, setSavedOrder] = useKept<string[]>(`hanzo.recents.order.${mode}`, [])
  const [dragRowId, setDragRowId] = useState<string | null>(null)
  const [dropRowId, setDropRowId] = useState<string | null>(null)

  const groups = useMemo(() => {
    const raw = priorityMode ? arrangePriority(rows, view) : arrange(rows, view)
    return raw.map((g) => ({
      ...g,
      rows: applyRecentsOrder(g.rows, savedOrder ?? []),
    }))
  }, [rows, view, priorityMode, savedOrder])

  const projects = useMemo(
    () => (!priorityMode && view.group !== 'project' ? projectGroups(rows) : []),
    [rows, priorityMode, view.group],
  )

  const visibleRowIds = useMemo(() => groups.flatMap((g) => g.rows.map((r) => r.id)), [groups])
  const handleRowReorder = (src: string, target: string) => {
    if (!src || !target || src === target) return
    setSavedOrder(reorderRecentsIds(visibleRowIds, src, target))
  }

  const head = (title: string) => (view.group === 'project' && title !== UNFILED && title !== PINNED ? title : t(title))
  const named = (title: string) => (title === UNTITLED || title === UNTITLED_RUN ? t(title) : title)
  const narrowed = view.status !== PLAIN.status || view.since !== PLAIN.since
  const running = mode === 'dev' ? rows.filter((r) => r.status === 'running').length : 0

  const renderRow = (r: Recent, keyPrefix = '') => {
    const one = threads?.get(r.id)
    const active = open(r)
    const isUnread = Boolean(r.kind === 'chat' && !active && (r.unread || unreadIds?.has(r.id)))
    const age = ago(r.at, new Date(), t)
    const when = age ? (
      <SizableText data-slot="row-age" size="$1" color="var(--muted-foreground)">
        {age}
      </SizableText>
    ) : null

    const settled = (r.kind === 'design' || r.kind === 'studio') && r.status === 'done'
    const rowAside =
      r.kind === 'design' || r.kind === 'studio' ? (
        <XStack items="center" gap="$1.5">
          {when}
          {settled ? null : <StatusDot status={DOTS[r.status as keyof typeof DOTS] ?? 'idle'} />}
        </XStack>
      ) : r.kind === 'dev' ? (
        <XStack items="center" gap="$1.5">
          {when}
          {r.pr ? <GitPullRequest size={13} color="var(--state-success)" aria-hidden /> : null}
          <StatusDot status={DOTS[r.status as keyof typeof DOTS] ?? 'idle'} />
        </XStack>
      ) : isUnread || when ? (
        <XStack items="center" gap="$1.5">
          {when}
          {isUnread ? (
            <XStack data-slot="thread-unread-dot" width={6} height={6} rounded={999} bg="var(--foreground)" aria-hidden />
          ) : null}
        </XStack>
      ) : undefined

    const titleText = named(r.title)
    const devMetaLine = r.meta || [r.repo || r.project, r.branch].filter(Boolean).join(' · ')
    const contextLine1 =
      r.kind === 'dev'
        ? devMetaLine || r.preview || (r.status ? t(r.status) : '')
        : r.kind === 'design' || r.kind === 'studio'
          ? r.meta || r.preview || ''
          : r.preview || [r.project, r.status === 'archived' ? t('Archived') : ''].filter(Boolean).join(' · ')
    const contextLine2 =
      r.kind === 'dev'
        ? r.preview && r.preview !== devMetaLine
          ? r.preview
          : ''
        : r.kind === 'design' || r.kind === 'studio'
          ? r.preview && r.preview !== r.meta
            ? r.preview
            : ''
          : r.preview
            ? r.preview
            : ''

    const handleKeyDown = (e: { key?: string; preventDefault?: () => void }) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault?.()
      onOpen(r)
    }

    const item =
      density === 1 ? (
        <SidebarItem
          data-kind={r.kind}
          data-density="1"
          active={active}
          rounded={8}
          minH={29}
          minW={0}
          width="100%"
          overflow="hidden"
          pl="$2"
          pr={one || rowAside ? 68 : '$2'}
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)', outlineOffset: -2 }}
          $touchable={one ? { minH: 44, pr: 68 } : { minH: 44 }}
          $max-sm={one ? { minH: 44, pr: 68 } : { minH: 44 }}
          onKeyDown={handleKeyDown}
          onPress={() => onOpen(r)}
        >
          {titleText}
        </SidebarItem>
      ) : (
        <XStack
          render={<button type="button" />}
          data-slot="sidebar-item"
          data-kind={r.kind}
          data-density={String(density)}
          aria-current={active ? 'page' : undefined}
          width="100%"
          minW={0}
          minH={density === 3 ? 62 : 46}
          px="$2"
          py={density === 3 ? '$1.5' : '$1'}
          rounded={8}
          borderWidth={0}
          bg={active ? '$edge' : 'transparent'}
          hoverStyle={{ bg: active ? '$edge' : '$hover' }}
          pressStyle={{ bg: '$raised' }}
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)', outlineOffset: -2 }}
          cursor="pointer"
          items="flex-start"
          overflow="hidden"
          $touchable={{ minH: density === 3 ? 64 : 48 }}
          $max-sm={{ minH: density === 3 ? 64 : 48 }}
          onKeyDown={handleKeyDown}
          onClick={() => onOpen(r)}
        >
          <YStack flex={1} minW={0} gap={2} items="flex-start">
            <XStack width="100%" minW={0} pr={one || rowAside ? 60 : 0} items="center">
              <SizableText
                size="$2"
                fontWeight="500"
                color={active ? '$ink' : '$color'}
                numberOfLines={1}
                flex={1}
                minW={0}
                text="start"
                $platform-web={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', display: 'block' }}
              >
                {titleText}
              </SizableText>
            </XStack>

            {density === 2 ? (
              <XStack width="100%" minW={0} items="center" gap="$1" pr="$1">
                {r.kind === 'dev' && (r.branch || r.repo) ? (
                  <XStack shrink={0} items="center">
                    <GitBranch size={11} color="var(--muted-foreground)" aria-hidden />
                  </XStack>
                ) : null}
                <SizableText
                  data-slot="row-context"
                  size="$1"
                  color="$soft"
                  numberOfLines={1}
                  flex={1}
                  minW={0}
                  text="start"
                  $platform-web={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', display: 'block' }}
                >
                  {contextLine1 || (age ? age : t(r.kind === 'dev' ? 'Coding run' : 'Conversation'))}
                </SizableText>
              </XStack>
            ) : (
              <YStack width="100%" minW={0} gap={1.5} pr="$1">
                {r.kind === 'dev' ? (
                  <>
                    {devMetaLine ? (
                      <XStack width="100%" minW={0} items="center" gap="$1">
                        <XStack shrink={0} items="center">
                          <GitBranch size={11} color="var(--muted-foreground)" aria-hidden />
                        </XStack>
                        <SizableText
                          data-slot="row-meta"
                          size="$1"
                          color="$soft"
                          numberOfLines={1}
                          flex={1}
                          minW={0}
                          text="start"
                          $platform-web={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', display: 'block' }}
                        >
                          {devMetaLine}
                        </SizableText>
                      </XStack>
                    ) : null}
                    <SizableText
                      data-slot="row-context"
                      size="$1"
                      color="$hint"
                      lineHeight={15}
                      numberOfLines={devMetaLine ? 1 : 2}
                      width="100%"
                      text="start"
                    >
                      {contextLine2 || r.preview || (r.status ? t(r.status) : t('Coding run'))}
                    </SizableText>
                  </>
                ) : r.kind === 'design' || r.kind === 'studio' ? (
                  <>
                    {r.meta ? (
                      <SizableText data-slot="row-meta" size="$1" color="$soft" numberOfLines={1} width="100%" text="start">
                        {r.meta}
                      </SizableText>
                    ) : null}
                    {r.preview ? (
                      <SizableText
                        data-slot="row-context"
                        size="$1"
                        color="$hint"
                        lineHeight={15}
                        numberOfLines={r.meta ? 1 : 2}
                        width="100%"
                        text="start"
                      >
                        {r.preview}
                      </SizableText>
                    ) : null}
                  </>
                ) : (
                  <>
                    {r.project ? (
                      <SizableText data-slot="row-meta" size="$1" color="$soft" numberOfLines={1} width="100%" text="start">
                        {r.project}
                      </SizableText>
                    ) : null}
                    <SizableText
                      data-slot="row-context"
                      size="$1"
                      color="$hint"
                      lineHeight={15}
                      numberOfLines={r.project ? 1 : 2}
                      width="100%"
                      text="start"
                    >
                      {r.preview || (r.status === 'archived' ? t('Archived conversation') : age ? t('Updated {age}', { age }) : t('Conversation'))}
                    </SizableText>
                  </>
                )}
              </YStack>
            )}
          </YStack>
        </XStack>
      )

    const key = keyPrefix ? `${keyPrefix}:${r.id}` : r.id
    if (one) {
      return (
        <ThreadRow
          key={key}
          t={one}
          active={active}
          aside={rowAside}
          dragging={dragRowId === r.id}
          dropTarget={dropRowId === r.id && dragRowId !== null && dragRowId !== r.id}
          onReorderDragStart={(e: DragEvent) => {
            setDragRowId(r.id)
            e.dataTransfer?.setData('text/plain', r.id)
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
          }}
          onReorderDragOver={(e: DragEvent) => {
            if (!dragRowId || dragRowId === r.id) return
            e.preventDefault()
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
            if (dropRowId !== r.id) setDropRowId(r.id)
          }}
          onReorderDragLeave={() => {
            if (dropRowId === r.id) setDropRowId(null)
          }}
          onReorderDrop={(e: DragEvent) => {
            e.preventDefault()
            const src = dragRowId || e.dataTransfer?.getData('text/plain')
            if (src && src !== r.id) handleRowReorder(src, r.id)
            setDragRowId(null)
            setDropRowId(null)
          }}
          onReorderDragEnd={() => {
            setDragRowId(null)
            setDropRowId(null)
          }}
        >
          {item}
        </ThreadRow>
      )
    }
    return (
      <YStack role="listitem" key={key} position="relative">
        {item}
        {rowAside ? (
          <XStack position="absolute" insetInlineEnd="$2.5" t={0} b={0} items="center" pointerEvents="none">
            {rowAside}
          </XStack>
        ) : null}
      </YStack>
    )
  }

  const menu = (
    <DropdownMenu
      minWidth={210}
      trigger={
        <XStack
          render="button"
          data-slot="recents-view-menu"
          aria-label={t('Recents view')}
          width={26}
          height={26}
          rounded="$2"
          items="center"
          justify="center"
          cursor="pointer"
          opacity={narrowed ? 1 : 0}
          $group-hover={{ opacity: 1 }}
          focusStyle={{ opacity: 1 }}
          focusVisibleStyle={{ opacity: 1, outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
          $touchable={{ opacity: 1, minW: 44, minH: 44 }}
          $max-sm={{ opacity: 1, minW: 44, minH: 44 }}
          borderWidth={1}
          borderColor={narrowed ? 'var(--border-strong)' : 'transparent'}
          transition="quickest"
          hoverStyle={{ bg: '$hover', borderColor: 'var(--border-strong)' }}
          bg={narrowed ? '$raised' : 'transparent'}
        >
          <ListFilter size={14} color={narrowed ? 'var(--foreground)' : 'var(--muted-foreground)'} aria-hidden />
        </XStack>
      }
      items={items(mode, view, keep, density, onDensity, priorityMode, t, Boolean(threads))}
    />
  )

  const heading = (title: string, id?: string, lead = false) => (
    <XStack group items="center" justify="space-between" minH={26} paddingInlineStart="$2" paddingInlineEnd="$1" mt="$2" shrink={0}>
      <XStack items="center" gap="$2">
        <SizableText id={id} size="$1" fontWeight="500" color="var(--muted-foreground)">
          {title}
        </SizableText>
        {lead && running ? (
          <XStack aria-label={t('{n} running', { n: running })} minW={18} height={18} px="$1.5" rounded={999} items="center" justify="center" bg="$edge" borderWidth={1} borderColor="$borderColor">
            <SizableText size="$1" fontWeight="600" color="$ink" aria-hidden data-i18n-ltr>
              {String(running)}
            </SizableText>
          </XStack>
        ) : null}
      </XStack>
      <XStack items="center" gap={2}>
        {lead && threads && rows.length > 0 ? (
          <XStack
            render="button"
            aria-label={t('Select multiple')}
            {...({ title: t('Select multiple') } as object)}
            width={26}
            height={26}
            rounded="$2"
            items="center"
            justify="center"
            cursor="pointer"
            opacity={0}
            $group-hover={{ opacity: 1 }}
            focusStyle={{ opacity: 1 }}
            focusVisibleStyle={{ opacity: 1, outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $touchable={{ opacity: 1, minW: 44, minH: 44 }}
            $max-sm={{ opacity: 1, minW: 44, minH: 44 }}
            borderWidth={1}
            borderColor="transparent"
            transition="quickest"
            hoverStyle={{ bg: '$hover', borderColor: 'var(--border-strong)' }}
            onClick={() => {
              if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('hanzo:recents-select'))
            }}
          >
            <CheckSquare size={13} color="var(--muted-foreground)" aria-hidden />
          </XStack>
        ) : null}
        {lead ? menu : null}
      </XStack>
    </XStack>
  )

  const note = reading ? (
    <Note>{t(mode === 'chat' ? 'Reading your chats…' : 'Reading your runs…')}</Note>
  ) : error ? null : view.status === 'archived' ? (
    <Note>{t(mode === 'dev' ? 'No archived runs.' : mode === 'design' ? 'No archived designs.' : mode === 'studio' ? 'No archived creations.' : 'No archived chats.')}</Note>
  ) : narrowed ? (
    <Note>{t('Nothing in this view.')}</Note>
  ) : (
    <Note>{t(mode === 'chat' ? 'No chats yet.' : mode === 'design' || mode === 'studio' ? 'Nothing made yet.' : 'No runs yet.')}</Note>
  )

  const wrapMenu = (body: ReactNode) =>
    threads ? (
      <ConversationMenu
        threads={threads}
        active={held}
        onGone={onNew}
        customActions={customActions}
        canShare={mode === 'chat'}
        noun={mode === 'dev' ? 'run' : mode === 'studio' ? 'studio' : mode === 'design' ? 'design' : 'chat'}
        hrefOf={hrefOf}
        primary
      >
        <YStack gap={1}>{body}</YStack>
      </ConversationMenu>
    ) : (
      <YStack gap={1}>{body}</YStack>
    )

  // Priority / Day-by-Day Context mode (`≡` ON)
  if (priorityMode) {
    const priorityGroup = groups.find((g) => g.title === PRIORITY)
    const dayGroups = groups.filter((g) => g.title !== PRIORITY)
    return (
      <YStack data-slot="recents" data-mode={mode} data-view="priority" data-density={String(density)} flex={1} minH={0}>
        {heading(t(PRIORITY), label, true)}
        <ScrollView flex={1} showsVerticalScrollIndicator={false} {...({ overscrollBehavior: 'contain' } as object)}>
          {error ? <Note>{error.message}</Note> : null}
          {wrapMenu(
            <YStack role="list" aria-labelledby={label} gap={2}>
              {priorityGroup ? (
                <YStack role="listitem" data-slot="priority-section" gap={1}>
                  <YStack role="list" aria-label={t(PRIORITY)} gap={1}>
                    {priorityGroup.rows.map((r) => renderRow(r))}
                  </YStack>
                </YStack>
              ) : null}
              {dayGroups.length > 0
                ? dayGroups.map((g) => {
                    const isShut = Boolean(collapsedGroups[`day:${g.title}`])
                    return (
                      <YStack key={g.title} role="listitem" data-slot="day-group" data-day={g.title} gap={1} pt="$1.5">
                        <XStack
                          render="button"
                          aria-expanded={!isShut}
                          onClick={() => setCollapsedGroups((prev) => ({ ...prev, [`day:${g.title}`]: !prev[`day:${g.title}`] }))}
                          items="center"
                          justify="space-between"
                          minH={24}
                          px="$2"
                          rounded="$2"
                          cursor="pointer"
                          transition="quickest"
                          hoverStyle={{ bg: '$hover' }}
                          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                          $max-sm={{ minH: 44 }}
                        >
                          <SizableText size="$1" fontWeight="500" color="var(--muted-foreground)">
                            {t(g.title)}
                          </SizableText>
                          {isShut ? (
                            <ChevronRight size={11} color="var(--muted-foreground)" aria-hidden />
                          ) : (
                            <ChevronDown size={11} color="var(--muted-foreground)" aria-hidden />
                          )}
                        </XStack>
                        {isShut ? null : (
                          <YStack role="list" aria-label={t(g.title)} gap={1}>
                            {g.rows.map((r) => renderRow(r))}
                          </YStack>
                        )}
                      </YStack>
                    )
                  })
                : !priorityGroup
                  ? note
                  : null}
            </YStack>,
          )}
        </ScrollView>
      </YStack>
    )
  }

  // Standard mode (`≡` OFF): Pinned -> Projects -> Recents
  const pinned = groups.find((g) => g.title === PINNED)
  const loose = groups.filter((g) => g.title !== PINNED)

  const rest = loose.length
    ? loose.map((g) => {
        if (!g.title) {
          return (
            <YStack key="all" role="list" aria-label={t('All')} gap={1}>
              {g.rows.map((r) => renderRow(r))}
            </YStack>
          )
        }
        const isShut = Boolean(collapsedGroups[g.title])
        return (
          <YStack key={g.title} gap={1} pt="$1">
            <XStack
              render="button"
              aria-expanded={!isShut}
              onClick={() => setCollapsedGroups((prev) => ({ ...prev, [g.title]: !prev[g.title] }))}
              items="center"
              gap="$1"
              px="$2"
              py="$0.5"
              rounded="$2"
              cursor="pointer"
              transition="quickest"
              hoverStyle={{ bg: '$hover' }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              $max-sm={{ minH: 44 }}
              self="flex-start"
            >
              <SizableText size="$1" color="$soft">
                {head(g.title)}
              </SizableText>
              {isShut ? <ChevronRight size={11} color="var(--muted-foreground)" aria-hidden /> : <ChevronDown size={11} color="var(--muted-foreground)" aria-hidden />}
            </XStack>
            {isShut ? null : (
              <YStack role="list" aria-label={head(g.title)} gap={1}>
                {g.rows.map((r) => renderRow(r))}
              </YStack>
            )}
          </YStack>
        )
      })
    : pinned
      ? null
      : note

  return (
    <YStack data-slot="recents" data-mode={mode} data-view="standard" data-density={String(density)} flex={1} minH={0}>
      <ScrollView flex={1} showsVerticalScrollIndicator={false} {...({ overscrollBehavior: 'contain' } as object)}>
        {error ? <Note>{error.message}</Note> : null}
        {wrapMenu(
          <YStack role="list" aria-labelledby={label} gap={1}>
            {/* 1. Pinned section (collapsible) */}
            {pinned ? (
              <YStack role="listitem" gap={1}>
                <XStack
                  render="button"
                  data-slot="pinned-group-toggle"
                  aria-expanded={!collapsedGroups[PINNED]}
                  onClick={() => setCollapsedGroups((prev) => ({ ...prev, [PINNED]: !prev[PINNED] }))}
                  items="center"
                  justify="space-between"
                  minH={26}
                  px="$2"
                  mt="$2"
                  rounded="$2"
                  cursor="pointer"
                  transition="quickest"
                  hoverStyle={{ bg: '$hover' }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  $max-sm={{ minH: 44 }}
                >
                  <XStack items="center" gap="$1.5">
                    <SizableText size="$1" fontWeight="500" color="var(--muted-foreground)">
                      {t(PINNED)}
                    </SizableText>
                    <SizableText size="$1" color="$hint" aria-hidden data-i18n-ltr>
                      {String(pinned.rows.length)}
                    </SizableText>
                  </XStack>
                  {collapsedGroups[PINNED] ? (
                    <ChevronRight size={12} color="var(--muted-foreground)" aria-hidden />
                  ) : (
                    <ChevronDown size={12} color="var(--muted-foreground)" aria-hidden />
                  )}
                </XStack>
                {collapsedGroups[PINNED] ? null : (
                  <YStack role="list" aria-label={t(PINNED)} gap={1}>
                    {pinned.rows.map((r) => renderRow(r))}
                  </YStack>
                )}
              </YStack>
            ) : null}

            {/* 2. Projects section (collapsible, for Chat project groups & Dev repos/projects) */}
            {projects.length > 0 ? (
              <YStack role="listitem" data-slot="projects-group" gap={1}>
                <XStack
                  render="button"
                  data-slot="projects-group-toggle"
                  aria-expanded={!collapsedGroups[PROJECTS]}
                  onClick={() => setCollapsedGroups((prev) => ({ ...prev, [PROJECTS]: !prev[PROJECTS] }))}
                  items="center"
                  justify="space-between"
                  minH={26}
                  px="$2"
                  mt="$2"
                  rounded="$2"
                  cursor="pointer"
                  transition="quickest"
                  hoverStyle={{ bg: '$hover' }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  $max-sm={{ minH: 44 }}
                >
                  <XStack items="center" gap="$1.5">
                    <SizableText size="$1" fontWeight="500" color="var(--muted-foreground)">
                      {t(PROJECTS)}
                    </SizableText>
                    <SizableText size="$1" color="$hint" aria-hidden data-i18n-ltr>
                      {String(projects.length)}
                    </SizableText>
                  </XStack>
                  {collapsedGroups[PROJECTS] ? (
                    <ChevronRight size={12} color="var(--muted-foreground)" aria-hidden />
                  ) : (
                    <ChevronDown size={12} color="var(--muted-foreground)" aria-hidden />
                  )}
                </XStack>
                {collapsedGroups[PROJECTS] ? null : (
                  <YStack role="list" aria-label={t(PROJECTS)} gap={1}>
                    {projects.map((p) => {
                      const isOpen = Boolean(expandedProjects[p.name])
                      return (
                        <YStack key={p.name} role="listitem" gap={1}>
                          <XStack
                            render="button"
                            data-project={p.name}
                            aria-expanded={isOpen}
                            onClick={() => setExpandedProjects((prev) => ({ ...prev, [p.name]: !prev[p.name] }))}
                            items="center"
                            justify="space-between"
                            minH={29}
                            px="$2"
                            rounded={8}
                            cursor="pointer"
                            hoverStyle={{ bg: '$hover' }}
                            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                            $max-sm={{ minH: 44 }}
                          >
                            <XStack items="center" gap="$2" flex={1} minW={0}>
                              <Folder size={13} color="var(--muted-foreground)" aria-hidden />
                              <SizableText size="$2" color="$aside" numberOfLines={1} flex={1} minW={0} text="start">
                                {p.name}
                              </SizableText>
                            </XStack>
                            <XStack items="center" gap="$1">
                              <SizableText size="$1" color="$hint" data-i18n-ltr>
                                {String(p.rows.length)}
                              </SizableText>
                              {isOpen ? (
                                <ChevronDown size={11} color="var(--muted-foreground)" aria-hidden />
                              ) : (
                                <ChevronRight size={11} color="var(--muted-foreground)" aria-hidden />
                              )}
                            </XStack>
                          </XStack>
                          {isOpen ? (
                            <YStack paddingInlineStart="$2.5" gap={1}>
                              {p.rows.map((r) => renderRow(r, `proj:${p.name}`))}
                            </YStack>
                          ) : null}
                        </YStack>
                      )
                    })}
                  </YStack>
                )}
              </YStack>
            ) : null}

            {/* 3. Recents section */}
            <YStack role="listitem" gap={1}>
              {heading(t('Recents'), label, true)}
              {rest}
            </YStack>
          </YStack>,
        )}
      </ScrollView>
    </YStack>
  )
}
