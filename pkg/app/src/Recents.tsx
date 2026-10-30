'use client'

// The reader's Recents in the column's mode, and only that mode's: Chat lists its
// conversations (`/v1/agents/chat/conversations`, `useThreadList`), Dev its
// coding runs (`/v1/agent/sessions?kind=coding`, @hanzo/build `useSessions`). Each
// mode reads its own store. The menu beside the heading narrows, groups and sorts
// the list; the choice is kept per mode in this browser. Chat's rows share one
// menu (thread.tsx `ConversationMenu`): pinned ones list first, under Pinned,
// and Chat's Status shows the archived ones apart.

import { useI18n } from '@hanzo/i18n/react'
import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { ScrollView, SizableText, XStack, YStack } from '@hanzo/gui'
import { ListFilter } from 'lucide-react'
import type { Thread } from '@hanzo/ai'
import { DOTS, route, useSessions, type Host } from '@hanzo/build'
import { DropdownMenu, type DropdownMenuProps } from '@hanzo/ui'
import { SidebarItem, StatusDot } from '@hanzo/ui/chat'
import { useKept } from './kept'
import { arrange, chats, MENUS, PINNED, PLAIN, runs, SINCE, UNFILED, UNTITLED, UNTITLED_RUN, viewOf, type Mode, type Option, type Recent, type View } from './recent'
import type { Say } from '@hanzo/i18n'
import { ConversationMenu, ThreadRow, useThreadList } from './thread'

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
  return parts.flatMap((p, i) => (i ? [{ type: 'separator' as const, key: `sep-${i}` }, ...p] : p))
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
    />
  )
}

/** Dev's Recents: the org's coding runs alone. */
function Runs({ host, view, keep, onOpen }: { host: Host; view: View; keep: (v: View) => void; onOpen: (r: Recent) => void }) {
  const store = useSessions(host)
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
  const rows = useMemo(() => runs(store.value), [store.value])
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
}) {
  const { t } = useI18n()
  const label = useId()
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
    const item = (
      <SidebarItem
        data-kind={r.kind}
        active={open(r)}
        rounded="$4"
        minH={31}
        paddingInlineStart="$2"
        paddingInlineEnd={one || r.kind === 'dev' ? '$7' : '$2'}
        // A thumb's 44 on a touch screen; a conversation's ⋯ is a thumb wide there and always there: the title stops short of it.
        $touchable={one ? { minH: 44, paddingInlineEnd: 52 } : { minH: 44 }}
        onKeyDown={(e: { key?: string; preventDefault?: () => void }) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault?.()
          onOpen(r)
        }}
        onPress={() => onOpen(r)}
      >
        <SizableText size="$3" color={open(r) ? '$ink' : '$quiet'} numberOfLines={1} display="block">
          {named(r.title)}
        </SizableText>
      </SidebarItem>
    )
    if (one)
      return (
        <ThreadRow key={r.id} t={one} active={open(r)}>
          {item}
        </ThreadRow>
      )
    return (
      <YStack role="listitem" key={r.id} position="relative">
        {item}
        {r.kind === 'dev' ? (
          <XStack position="absolute" insetInlineEnd="$2.5" t={0} b={0} items="center" pointerEvents="none">
            <StatusDot status={DOTS[r.status as keyof typeof DOTS] ?? 'idle'} />
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
  /** A section's heading: the reference's quiet 14px label, the Recents one carrying the count and the menu. */
  const heading = (title: string, id?: string, lead = false) => (
    <XStack group items="center" justify="space-between" height={31} paddingInlineStart="$2" paddingInlineEnd="$1" mt="$3" shrink={0}>
      <XStack items="center" gap="$2">
        <SizableText id={id} size="$3" color="$soft">
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
      {lead ? menu : null}
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
  const menus = (rows: ReactNode) =>
    threads ? (
      // Held while the list empties, so a dialog its last row opened closes in place.
      <ConversationMenu threads={threads} active={held} onGone={onNew}>
        <YStack>{rows}</YStack>
      </ConversationMenu>
    ) : (
      rows
    )
  const rest = loose.length
    ? loose.map((g) =>
        g.title ? (
          <YStack key={g.title} gap={1} pt="$1">
            <SizableText size="$1" color="$soft" px="$2" pb="$1">
              {head(g.title)}
            </SizableText>
            <YStack role="list" aria-label={head(g.title)} gap={1}>
              {g.rows.map(row)}
            </YStack>
          </YStack>
        ) : (
          <YStack key="all" role="list" aria-label={t('All')} gap={1}>
            {g.rows.map(row)}
          </YStack>
        ),
      )
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
              {heading(t(PINNED))}
              {menus(
                <YStack role="list" aria-label={t(PINNED)} gap={1}>
                  {pinned.rows.map(row)}
                </YStack>,
              )}
            </YStack>
          ) : null}
          <YStack role="listitem" gap={1}>
            {heading(t('Recents'), label, true)}
            {loose.length ? menus(rest) : rest}
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  )
}
