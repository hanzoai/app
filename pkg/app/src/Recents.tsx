'use client'

// The reader's Recents in the column's mode, and only that mode's: Chat lists its
// conversations (`/v1/agents/chat/conversations`, `useThreadList`), Dev its
// coding runs (`/v1/agent/sessions?kind=coding`, @hanzo/build `useSessions`). Each
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
import { DropdownMenu, type DropdownMenuProps } from '@hanzo/ui'
import { SidebarItem, StatusDot } from '@hanzo/ui/chat'
import { useKept } from './kept'
import { app } from './lib/host'
import { site } from './where'
import { ago, arrange, chats, MENUS, PINNED, PLAIN, runs, SINCE, UNFILED, UNTITLED, UNTITLED_RUN, viewOf, type Mode, type Option, type Recent, type View } from './recent'
import type { Say } from '@hanzo/i18n'
import { hasUnreadUpdate, ProjectsTree, useChatProjects } from './ProjectsTree'
import { ConversationMenu, ThreadRow, useThreadList, type ThreadActions } from './thread'

/** The menu's items: each section a heading and its options (recent.ts's phrases, drawn through `t`), the one in force checked. */
function items(mode: Mode, view: View, set: (v: View) => void, t: Say): NonNullable<DropdownMenuProps['items']> {
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
  return mode === 'chat' ? (
    <Chats thread={thread} view={view} keep={keep} onOpen={onOpen} onNew={onNew} />
  ) : (
    <Runs host={host} view={view} keep={keep} onOpen={onOpen} />
  )
}

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
  const projects = useChatProjects(rows)
  const [seenAt, setSeenAt] = useKept<Record<string, number>>('hanzo.chat.seen.v1', {})
  const seenRef = useRef(seenAt)
  seenRef.current = seenAt

  useEffect(() => {
    if (!store.threads.length) return
    const now = Date.now()
    const current = seenRef.current ?? {}
    let changed = false
    const next = { ...current }
    for (const item of store.threads) {
      if (item.id === thread) {
        const ts = item.updatedAt ? Date.parse(item.updatedAt) : now
        const target = Number.isFinite(ts) ? Math.max(now, ts) : now
        if ((next[item.id] ?? 0) < target) {
          next[item.id] = target
          changed = true
        }
      } else if (next[item.id] === undefined) {
        const ts = item.updatedAt ? Date.parse(item.updatedAt) : now
        next[item.id] = Number.isFinite(ts) ? ts : now
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

  const unfiledRows = useMemo(
    () => (view.status === 'archived' ? rows : rows.filter((r) => r.pinned || !projects.filedIds.has(r.id))),
    [rows, projects.filedIds, view.status],
  )

  return (
    <List
      mode="chat"
      rows={unfiledRows}
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
      projectsNode={
        view.status === 'archived' ? null : (
          <ProjectsTree
            folders={projects.folders}
            openMap={projects.openMap}
            byFolder={projects.byFolder}
            threads={byId}
            activeId={thread}
            onToggle={projects.toggleFolder}
            onCreate={projects.createFolder}
            onOpen={onOpen}
            onNew={onNew}
          />
        )
      }
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
        void fetch(`${host.api}/v1/agent/sessions/${encodeURIComponent(t.id)}`, {
          method: 'PATCH',
          headers: {
            ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title }),
        }).catch(() => {})
        return true
      },
      remove: async (t: Thread) => {
        patchMeta(t.id, { deleted: true })
        const tok = host.token?.()
        void fetch(`${host.api}/v1/agent/sessions/${encodeURIComponent(t.id)}`, {
          method: 'DELETE',
          headers: tok ? { Authorization: `Bearer ${tok}` } : {},
        }).catch(() => {})
        return true
      },
    }),
    [host],
  )
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
      hrefOf={(id) => new URL(site(app(id)), window.location.href).href}
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
  projectsNode,
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
  /** Address builder for Copy link / Open in new tab. */
  hrefOf?: (id: string) => string
  /** Background-updated conversation IDs showing a blue unread dot. */
  unreadIds?: Set<string>
  /** Chat's collapsible Projects folder tree above Recents. */
  projectsNode?: ReactNode
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
      <SizableText data-slot="row-age" fontSize={12} lineHeight={16} color="var(--muted-foreground)">
        {age}
      </SizableText>
    ) : null
    const rowAside =
      r.kind === 'dev' ? (
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
        paddingInlineStart="$2"
        paddingInlineEnd={one || rowAside ? 52 : '$2'}
        // A thumb's 44 on a touch screen; a conversation's ⋯ is a thumb wide there and always there: the title stops short of it.
        $touchable={one ? { minH: 44, paddingInlineEnd: 52 } : { minH: 44 }}
        onKeyDown={(e: { key?: string; preventDefault?: () => void }) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault?.()
          onOpen(r)
        }}
        onPress={() => onOpen(r)}
      >
        <SizableText
          fontSize={13}
          lineHeight={18}
          color={open(r) ? 'var(--text-primary)' : 'var(--foreground)'}
          numberOfLines={1}
          display="block"
        >
          {named(r.title)}
        </SizableText>
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
          $touchable={{ opacity: 1 }}
          hoverStyle={{ bg: '$hover' }}
          bg={narrowed ? '$hover' : 'transparent'}
        >
          <ListFilter size={14} aria-hidden />
        </XStack>
      }
      items={items(mode, view, keep, t)}
    />
  )
  /** A section's heading: quiet 11.5px label, the Recents one carrying the count and the menu. */
  const heading = (title: string, id?: string, lead = false) => (
    <XStack group items="center" justify="space-between" height={26} paddingInlineStart="$2" paddingInlineEnd="$1" mt="$2.5" shrink={0}>
      <XStack items="center" gap="$2">
        <SizableText id={id} fontSize={11.5} lineHeight={16} fontWeight="500" color="var(--muted-foreground)">
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
        {lead && rows.length > 0 ? (
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
            $touchable={{ opacity: 1 }}
            hoverStyle={{ bg: '$hover' }}
            onPress={() => {
              if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('hanzo:recents-select'))
            }}
          >
            <CheckSquare size={13} aria-hidden />
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
    <Note>{t(mode === 'chat' ? 'No chats yet.' : 'No runs yet.')}</Note>
  )
  // Each list of conversations holds its own menu (thread.tsx): the view menu
  // in the Recents heading between them is a menu of its own, never inside one.
  const menus = (rows: ReactNode, primary = true) =>
    threads ? (
      // Held while the list empties, so a dialog its last row opened closes in place.
      <ConversationMenu threads={threads} active={held} onGone={onNew} customActions={customActions} hrefOf={hrefOf} primary={primary}>
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
              onPress={() => setCollapsedGroups((prev) => ({ ...prev, [g.title]: !prev[g.title] }))}
              items="center"
              gap="$1"
              px="$2"
              py="$0.5"
              rounded="$2"
              cursor="pointer"
              hoverStyle={{ bg: '$hover' }}
              self="flex-start"
            >
              <SizableText size="$1" color="$soft">
                {head(g.title)}
              </SizableText>
              {isShut ? <ChevronRight size={11} opacity={0.6} aria-hidden /> : <ChevronDown size={11} opacity={0.6} aria-hidden />}
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
        {projectsNode}
        <YStack role="list" aria-labelledby={label} gap={1}>
          {pinned ? (
            <YStack role="listitem" gap={1}>
              {heading(t(PINNED))}
              {menus(
                <YStack role="list" aria-label={t(PINNED)} gap={1}>
                  {pinned.rows.map(row)}
                </YStack>,
                !loose.length,
              )}
            </YStack>
          ) : null}
          <YStack role="listitem" gap={1}>
            {heading(t('Recents'), label, true)}
            {menus(rest, true)}
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  )
}
