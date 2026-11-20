'use client'

// The reader's Recents in the column's mode, and only that mode's: Chat lists its
// conversations (`/v1/agents/chat/conversations`, `useThreadList`), Dev its
// coding runs (`/v1/agent/sessions?kind=coding`, @hanzo/build `useSessions`),
// Design what Studio keeps of its conversations (@hanzo/studio `useRecent`). Each
// mode reads its own store. The menu beside the heading narrows, groups and sorts
// the list; the choice is kept per mode in this browser. Chat's rows share one
// menu (thread.tsx `ConversationMenu`): pinned ones list first, under Pinned,
// and Chat's Status shows the archived ones apart.

import { useI18n } from '@hanzo/i18n/react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { ScrollView, SizableText, XStack, YStack } from '@hanzo/gui'
import { CheckSquare, ChevronDown, ChevronRight, GitPullRequest, ListFilter } from 'lucide-react'
import type { Thread } from '@hanzo/ai'
import { DOTS, route, useSessions, type Host } from '@hanzo/build'
import * as studio from '@hanzo/studio'
import { DropdownMenu, type DropdownMenuProps } from '@hanzo/ui'
import { SidebarItem, StatusDot } from '@hanzo/ui/chat'
import { useKept } from './kept'
import { app, design } from './lib/host'
import { site } from './where'
import { ago, arrange, chats, designs, hasUnreadUpdate, MENUS, PINNED, PLAIN, runs, SINCE, UNFILED, UNTITLED, UNTITLED_RUN, viewOf, type Mode, type Option, type Recent, type View } from './recent'
import type { Say } from '@hanzo/i18n'
import { ConversationMenu, ThreadRow, useThreadList, type ThreadActions } from './thread'

/** A Design conversation as Studio lists it (@hanzo/studio `Listed`). */
type Made = { id: string; title: string; updated: number; state: 'making' | 'done' | 'failed' }

/**
 * Studio's own read of Design's conversations (@hanzo/studio `useRecent`, from
 * 0.1.11): this browser's store, shared with Studio's panes. An older Studio has
 * none, and Design then lists nothing here, never Chat's.
 */
const useMade = Reflect.get(studio, 'useRecent') as ((host: Host) => { rows: Made[]; error: string }) | undefined

/** The menu's items: each section a heading and its options (recent.ts's phrases, drawn through `t`), the one in force checked; Select multiple where the rows carry a menu. */
function items(mode: Mode, view: View, set: (v: View) => void, t: Say, select: boolean): NonNullable<DropdownMenuProps['items']> {
  const m = MENUS[mode]
  const section = <K extends keyof View>(key: K, label: string, options: Option<View[K]>[]): NonNullable<DropdownMenuProps['items']> =>
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
  const parts = [section('status', t('Status'), m.status), section('since', t('Last activity'), SINCE), section('group', t('Group by'), m.group), section('sort', t('Sort by'), m.sort)].filter(
    (p) => p.length,
  )
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
  onOpen,
  onNew,
}: {
  /** The mode's host: Design's is the one Studio is mounted with (App.tsx `maker`), whose path is Studio's. */
  host: Host
  mode: Mode
  /** The Chat conversation the pane holds, or null. */
  thread: string | null
  onOpen: (r: Recent) => void
  /** Moves the pane to a new conversation: where it goes when the one it holds is deleted. */
  onNew: () => void
}) {
  const [kept, keep] = useKept<unknown>(`hanzo.recents.${mode}`, PLAIN)
  const view = viewOf(mode, kept)
  if (mode === 'chat') return <Chats thread={thread} view={view} keep={keep} onOpen={onOpen} onNew={onNew} />
  if (mode === 'design') return useMade ? <Designs host={host} view={view} keep={keep} /> : <YStack flex={1} minH={0} />
  return <Runs host={host} view={view} keep={keep} onOpen={onOpen} />
}

type DesignMeta = { title?: string; pinned?: boolean; archived?: boolean; deleted?: boolean }

/** Design's Recents: Studio's conversations, each opened in Design at its own address (@hanzo/studio `path`). */
function Designs({ host, view, keep }: { host: Host; view: View; keep: (v: View) => void }) {
  const { rows: made, error } = useMade!(host)
  const [meta, setMeta] = useKept<Record<string, DesignMeta>>('hanzo.design.meta', {})
  const metaRef = useRef(meta)
  metaRef.current = meta
  const patchMeta = (id: string, patch: Partial<DesignMeta>) => {
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
      designs(visibleMade).map((r) => ({
        ...r,
        title: meta?.[r.id]?.title || r.title,
        status: view.status === 'archived' ? 'archived' : r.status,
        ...(meta?.[r.id]?.pinned ? { pinned: true } : {}),
      })),
    [visibleMade, meta, view.status],
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
  const designActions = useMemo<ThreadActions>(
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
  const designHref = (id: string) => new URL(site(design(studio.path({ kind: 'chat', id }))), window.location.href).href
  const failed = useMemo(() => (error ? new Error(error) : null), [error])
  const at = studio.route(host.path)
  const held = at.kind === 'chat' ? at.id : null
  return (
    <List
      mode="design"
      rows={rows}
      view={view}
      keep={keep}
      open={(r) => r.id === held}
      reading={false}
      error={failed}
      onOpen={(r) => host.go(studio.path({ kind: 'chat', id: r.id }))}
      threads={byId}
      held={held}
      onNew={() => host.go('')}
      customActions={designActions}
      hrefOf={designHref}
    />
  )
}

const EMPTY_SEEN: Record<string, number> = {}

/** Chat's Recents: the conversation store alone, the archived ones when the view asks for them. */
function Chats({
  thread,
  view,
  keep,
  onOpen,
  onNew,
}: {
  thread: string | null
  view: View
  keep: (v: View) => void
  onOpen: (r: Recent) => void
  onNew: () => void
}) {
  const store = useThreadList(view.status === 'archived', thread)
  const rows = useMemo(() => chats(store.threads), [store.threads])
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

  return (
    <List
      mode="chat"
      rows={rows}
      view={view}
      keep={keep}
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

type RunMeta = { title?: string; pinned?: boolean; archived?: boolean; deleted?: boolean }

/** Dev's Recents: the org's coding runs alone. */
function Runs({ host, view, keep, onOpen }: { host: Host; view: View; keep: (v: View) => void; onOpen: (r: Recent) => void }) {
  const store = useSessions(host)
  const [meta, setMeta] = useKept<Record<string, RunMeta>>('hanzo.dev.runs.meta', {})
  const metaRef = useRef(meta)
  metaRef.current = meta
  const patchMeta = (id: string, patch: Partial<RunMeta>) => {
    const next = {
      ...(metaRef.current ?? {}),
      [id]: { ...(metaRef.current?.[id] ?? {}), ...patch },
    }
    metaRef.current = next
    setMeta(next)
  }
  const r = route(host.path)
  const run = r.kind === 'run' ? r.id : null
  // A run this list has not seen is one just begun: read the store again, once for it.
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

function List({
  mode,
  rows,
  view,
  keep,
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
  open: (r: Recent) => boolean
  reading: boolean
  error: Error | null | undefined
  onOpen: (r: Recent) => void
  /** Chat's conversations by id: a row of one carries its menu. */
  threads?: Map<string, Thread>
  /** The conversation the pane holds, listed or not: a deleted one leaves the list before the store answers. */
  held?: string | null
  /** Moves the pane to a new conversation: where it goes when the one it holds is deleted. */
  onNew?: () => void
  /** Custom actions for non-Chat threads (e.g. Dev runs). */
  customActions?: ThreadActions
  /** Custom Markdown export for non-Chat threads (e.g. Dev runs, Design). */
  /** Address builder for Copy link / Open in new tab. */
  hrefOf?: (id: string) => string
  /** Background-updated conversation IDs showing a blue unread dot. */
  unreadIds?: Set<string>
}) {
  const { t } = useI18n()
  const label = useId()
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const groups = arrange(rows, view)
  // A heading is authored (recent.ts's phrases), save a project's name in a list grouped by project.
  const head = (title: string) => (view.group === 'project' && title !== UNFILED && title !== PINNED ? title : t(title))
  // A row's title is the reader's; only the name a row without one is given is ours.
  const named = (title: string) => (title === UNTITLED || title === UNTITLED_RUN ? t(title) : title)
  const narrowed = view.status !== PLAIN.status || view.since !== PLAIN.since
  const running = mode === 'dev' ? rows.filter((r) => r.status === 'running').length : 0
  // A row is its title alone, as the reference draws it: a conversation's ⋯
  // shows on hover and focus, a run's state is a dot at its end.
  const row = (r: Recent) => {
    const one = threads?.get(r.id)
    const isUnread = Boolean(r.kind === 'chat' && !open(r) && unreadIds?.has(r.id))
    const age = ago(r.at, new Date(), t)
    const when = age ? (
      <SizableText data-slot="row-age" size="$1" color="var(--muted-foreground)">
        {age}
      </SizableText>
    ) : null
    // A Design conversation's dot is there while it works or when it failed; at rest it wears its age alone.
    const settled = r.kind === 'design' && r.status === 'done'
    const rowAside =
      r.kind === 'design' ? (
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
    const item = (
      <SidebarItem
        data-kind={r.kind}
        active={open(r)}
        rounded={8}
        minH={29}
        minW={0}
        width="100%"
        overflow="hidden"
        pl="$2"
        pr={one || rowAside ? 68 : '$2'}
        focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)', outlineOffset: -2 }}
        // A thumb's 44 on a touch screen; a conversation's ⋯ is a thumb wide there and always there: the title stops short of it.
        $touchable={one ? { minH: 44, pr: 68 } : { minH: 44 }}
        $max-sm={one ? { minH: 44, pr: 68 } : { minH: 44 }}
        onKeyDown={(e: { key?: string; preventDefault?: () => void }) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault?.()
          onOpen(r)
        }}
        onPress={() => onOpen(r)}
      >
        {named(r.title)}
      </SidebarItem>
    )
    if (one)
      return (
        <ThreadRow
          key={r.id}
          t={one}
          active={open(r)}
          aside={rowAside}
        >
          {item}
        </ThreadRow>
      )
    return (
      <YStack role="listitem" key={r.id} position="relative">
        {item}
        {rowAside ? (
          <XStack position="absolute" insetInlineEnd="$2.5" t={0} b={0} items="center" pointerEvents="none">
            {rowAside}
          </XStack>
        ) : null}
      </YStack>
    )
  }

  // The view menu stands at the end of the Recents heading: the target's own, quiet until the pointer is near.
  const menu = (
    <DropdownMenu
      minWidth={200}
      trigger={
        <XStack
          render="button"
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
      items={items(mode, view, keep, t, Boolean(threads))}
    />
  )
  /** A section's heading: quiet label, the Recents one carrying the count and the menu. */
  const heading = (title: string, id?: string, lead = false) => (
    <XStack group items="center" justify="space-between" minH={26} paddingInlineStart="$2" paddingInlineEnd="$1" mt="$2.5" shrink={0}>
      <XStack items="center" gap="$2">
        <SizableText id={id} size="$1" fontWeight="500" color="var(--muted-foreground)">
          {title}
        </SizableText>
        {lead && running ? (
          // A count where there is one to keep an eye on: the runs still working.
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

  const loose = groups.filter((g) => g.title !== PINNED)
  const pinned = groups.find((g) => g.title === PINNED)
  const note = reading ? (
    <Note>{t(mode === 'chat' ? 'Reading your chats…' : 'Reading your runs…')}</Note>
  ) : error ? null : view.status === 'archived' ? (
    <Note>{t('No archived chats.')}</Note>
  ) : narrowed ? (
    <Note>{t('Nothing in this view.')}</Note>
  ) : (
    <Note>{t(mode === 'chat' ? 'No chats yet.' : mode === 'design' ? 'Nothing made yet.' : 'No runs yet.')}</Note>
  )
  // Each list of conversations holds its own menu (thread.tsx): the view menu
  // in the Recents heading between them is a menu of its own, never inside one.
  const menus = (rows: ReactNode, primary = true) =>
    threads ? (
      // Held while the list empties, so a dialog its last row opened closes in place.
      <ConversationMenu
        threads={threads}
        active={held}
        onGone={onNew}
        customActions={customActions}
        canShare={mode === 'chat'}
        hrefOf={hrefOf}
        primary={primary}
      >
        <YStack>{rows}</YStack>
      </ConversationMenu>
    ) : (
      rows
    )
  const rest = loose.length
    ? loose.map((g) => {
        if (!g.title) {
          return (
            <YStack key="all" role="list" aria-label={t('All')} gap={1}>
              {g.rows.map(row)}
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
                {g.rows.map(row)}
              </YStack>
            )}
          </YStack>
        )
      })
    : pinned
      ? null
      : note

  return (
    <YStack data-slot="recents" flex={1} minH={0}>

      {/* Its end is its own: a scroll that reaches it does not move the page behind (a phone's menu). */}
      <ScrollView flex={1} showsVerticalScrollIndicator={false} {...({ overscrollBehavior: 'contain' } as object)}>
        {error ? <Note>{error.message}</Note> : null}
        <YStack role="list" aria-labelledby={label} gap={1}>
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
                mt="$2.5"
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
              {collapsedGroups[PINNED]
                ? null
                : menus(
                    <YStack role="list" aria-label={t(PINNED)} gap={1}>
                      {pinned.rows.map(row)}
                    </YStack>,
                    !loose.length,
                  )}
            </YStack>
          ) : null}
          <YStack role="listitem" gap={1}>
            {/* The heading stays: it holds the view menu (Archived, grouping) and Select multiple. */}
            {heading(t('Recents'), label, true)}
            {menus(
              rest,
              true,
            )}
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  )
}
