'use client'

// A conversation's own actions, kept where the conversation is: PATCH and DELETE
// /v1/agents/chat/conversations/{id} (hanzoai/agent v1.0.12), the member's own
// only — and the ones that need nothing of the store: its link, a new tab, the
// Share panel.
//
// ONE MENU A LIST. `ConversationMenu` wraps a list of rows and mounts, once for
// all of them, gui's ContextMenu (a right-click at the cursor, a long-press on
// touch), gui's Menu hung from whichever row's ⋯ was pressed (a gui Menu takes
// many triggers and anchors to the one pressed), and the Rename, Delete and
// Share dialogs. A row (`ThreadRow`) is its markup and a trigger. The column's
// Recents and the shell's /chat list both wrap theirs in it. Not
// @hanzo/ui/product/menu's ContextMenu: it portals its panel under gui's
// `pointer-events: none` host, so it drew and took no click (measured: every
// ancestor of its panel reads `none`).
//
// A CHANGE SHOWS AT ONCE, everywhere, and is taken back with a toast if the
// store refuses it (pending.ts): every list on the page draws the changes in
// flight over what it last read, and reads the store again once it answers.
// A pin is the server's, never this browser's: it follows the person to every
// device they sign in on.

import { useI18n } from '@hanzo/i18n/react'
import { tidy } from './lib/title'
import { copyId } from './lib/copy-id'
import { InlineRename } from './InlineRename'
import { archiveWithUndo } from './archive'
import { useRenaming } from './renaming'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import type { AiClient, Thread, ThreadChange } from '@hanzo/ai'
export type { Thread }
import { useAi } from '@hanzo/ai/react'
import { Archive, ArchiveRestore, Check, CheckSquare, Clock, Copy, ExternalLink, FolderInput, GripVertical, Link2, MoreHorizontal, Pencil, Pin, PinOff, Share2, Trash2, X } from 'lucide-react'
import {
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Input,
  SizableText,
  Text,
  XStack,
  YStack,
  toast,
} from '@hanzo/ui'
import { empty } from './open'
import { say } from './lib/org'
import { talk } from './lib/host'
import { BAD } from './lib/mix'
import { site } from './where'
import { attempt, bind, enlist, reread, snapshot, subscribe, sweep, tick, view, type Reader } from './pending'
import { chord, named, said, type Act } from './chord'
import { carry } from './stars'
import { ShareDialog } from './Share'
import { useWindowed } from './windowed'
import { Confirm } from './Confirm'
import { english, phrase, type Say } from '@hanzo/i18n'

export interface ThreadList {
  threads: Thread[]
  loading: boolean
  error: Error | null
  reload: () => void
}

/** Each client's last read of each shelf. */
const last = new WeakMap<AiClient, Record<string, { threads: Thread[]; at: number; archived: boolean }>>()

/**
 * The member's conversations: pinned first, then most recently spoken in, the
 * archived ones left out — or, with `archived`, those alone — with every change
 * in flight drawn over them. It reads again whenever a conversation changes
 * here, and once for `seek` when it does not hold it: a conversation it has not
 * seen is one just begun.
 */
export function useThreadList(archived = false, seek: string | null = null): ThreadList {
  const ai = useAi()
  // What was read, when, and from which shelf: the other shelf's rows are never drawn as this one's.
  // A list mounted later (the palette) draws the client's last read of its shelf at once.
  const [read, setRead] = useState<{ threads: Thread[]; at: number; archived: boolean }>(() => last.get(ai)?.[`${archived}`] ?? { threads: [], at: 0, archived })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [asks, ask] = useState(0)
  const reload = useCallback(() => ask((n) => n + 1), [])
  const me = useRef<Reader>({ at: 0, reload })
  useEffect(() => enlist(me.current), [])
  useEffect(() => bind(ai), [ai])
  useEffect(() => {
    const control = new AbortController()
    const at = tick()
    setLoading(true)
    ai.threads.list({ archived, signal: control.signal }).then(
      (threads) => {
        if (control.signal.aborted) return
        me.current.at = at
        const got = { threads, at, archived }
        last.set(ai, { ...last.get(ai), [`${archived}`]: got })
        setRead(got)
        setError(null)
        setLoading(false)
        sweep()
        // A read that answers is a client the store takes: the browser's old stars can become pins.
        stars(ai)
      },
      (e: unknown) => {
        if (control.signal.aborted) return
        setError(e instanceof Error ? e : new Error(String(e)))
        setLoading(false)
      },
    )
    return () => control.abort()
  }, [ai, archived, asks])
  const changes = useSyncExternalStore(subscribe, snapshot, snapshot)
  const threads = useMemo(() => (read.archived === archived ? view(read.threads, read.at, archived) : view([], 0, archived)), [read, archived, changes])
  const asked = useRef(new Set<string>())
  useEffect(() => {
    if (archived || !seek || loading || asked.current.has(seek) || threads.some((t) => t.id === seek)) return
    asked.current.add(seek)
    reload()
  }, [archived, seek, loading, threads, reload])
  return { threads, loading, error, reload }
}

/** How long a change waits for the store before it is taken back. */
const WAIT = 15_000

/** A refusal in the store's words, or that the store did not answer at all. */
const refused = (e: unknown, t: Say = english): string =>
  e instanceof DOMException && e.name === 'TimeoutError' ? t('The conversation store did not answer. Try again.') : say(e, t)

let carried = false

/** The browser's stars from before pins were the server's, made pins once a page (stars.ts `carry`). */
function stars(ai: AiClient): void {
  if (carried) return
  carried = true
  void carry((id) => ai.threads.update(id, { pinned: true }, { signal: AbortSignal.timeout(WAIT) })).then((done) => {
    if (done) reread()
  })
}

/** What a conversation can be asked to do. Each shows at once; a refusal takes it back and says so in a toast. */
export function useThreadActions() {
  const ai = useAi()
  // Its own name: a conversation is `t` below.
  const words = useI18n().t
  return useMemo(() => {
    const run = async (t: Thread, change: ThreadChange | null, send: (signal: AbortSignal) => Promise<Thread | void>): Promise<boolean> => {
      try {
        // The clock starts when the change is asked, after the ones before it are answered.
        await attempt(t, change, () => send(AbortSignal.timeout(WAIT)))
        return true
      } catch (e) {
        toast.error(refused(e, words))
        return false
      }
    }
    const change = (t: Thread, to: ThreadChange) => run(t, to, (signal) => ai.threads.update(t.id, to, { signal }))
    return {
      pin: (t: Thread) => change(t, { pinned: !t.pinned }),
      archive: (t: Thread) => change(t, { archived: !t.archived }),
      rename: (t: Thread, title: string) => change(t, { title }),
      remove: (t: Thread) => run(t, null, (signal) => ai.threads.remove(t.id, { signal })),
    }
  }, [ai, words])
}

/** A conversation's title as drawn; `untitled` is the reader's word for none. */
const titleOf = (t: Thread, untitled?: string) => tidy(t.title, 80, untitled)

/** A conversation's own address, whole: the app at `/?chat=<id>` (lib/host `talk`), wherever the apps are drawn. */
export const href = (id: string): string => new URL(site(talk(id)), window.location.href).href

/** Opens a conversation in a tab of its own. */
const away = (id: string, toUrl: (id: string) => string = href): void => {
  window.open(toUrl(id), '_blank', 'noopener')
}

/** Puts a conversation's address on the clipboard. */
async function copy(id: string, t: Say, toUrl: (id: string) => string = href): Promise<void> {
  try {
    await navigator.clipboard.writeText(toUrl(id))
    toast.success(t('Link copied'))
  } catch {
    toast.error(t('The browser would not copy the link.'))
  }
}

/** The one colour in the menu: Delete's — design's destructive mixed toward the theme's ink, 4.5:1 on either theme's panel. */
const DANGER = BAD

const mac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

type Dialogue = 'rename' | 'delete' | 'deleteMany' | 'share' | 'organize'

/** What a list holds, and the menu's words for it. */
export type Noun = 'chat' | 'run' | 'design'

const FOREVER = phrase('“{title}” is deleted for good, with every link it was shared by. To keep it out of the list instead, archive it.')
const MANY = phrase('These are deleted for good, with every link they were shared by. To keep them out of the list instead, archive them.')

const NOUNS = {
  chat: {
    archived: phrase('Archived chat'),
    archivedMany: phrase('Archived {n} chats'),
    unarchived: phrase('Unarchived chat'),
    unarchivedMany: phrase('Unarchived {n} chats'),
    options: phrase('Chat options'),
    rename: phrase('Rename chat'),
    name: phrase('Chat title'),
    remove: phrase('Delete chat?'),
    removeMany: phrase('Delete {n} chats?'),
    gone: FOREVER,
    goneMany: MANY,
  },
  run: {
    archived: phrase('Archived run'),
    archivedMany: phrase('Archived {n} runs'),
    unarchived: phrase('Unarchived run'),
    unarchivedMany: phrase('Unarchived {n} runs'),
    options: phrase('Run options'),
    rename: phrase('Rename run'),
    name: phrase('Run title'),
    remove: phrase('Delete run?'),
    removeMany: phrase('Delete {n} runs?'),
    gone: FOREVER,
    goneMany: MANY,
  },
  design: {
    archived: phrase('Archived design'),
    archivedMany: phrase('Archived {n} designs'),
    unarchived: phrase('Unarchived design'),
    unarchivedMany: phrase('Unarchived {n} designs'),
    options: phrase('Design options'),
    rename: phrase('Rename design'),
    name: phrase('Design title'),
    remove: phrase('Delete design?'),
    removeMany: phrase('Delete {n} designs?'),
    gone: phrase('“{title}” is deleted for good. To keep it out of the list instead, archive it.'),
    goneMany: phrase('These are deleted for good. To keep them out of the list instead, archive them.'),
  },
} as const

/** What a row needs of the list's menu. */
interface Menus {
  /** What the list holds, for the words on a row's own ⋯. */
  noun: Noun
  /** This menu's own id: its rows carry it (`data-menu-of`), so the keys find the rows of the list whose menu is open. */
  list: string
  /** The conversation the ⋯ that was just pressed belongs to, and the ⋯. */
  aim: (t: Thread, from: HTMLElement) => void
  /** The conversation whose menu is open, or null. */
  open: string | null
  /** The conversation currently being renamed inline, or null. */
  renaming: string | null
  /** Commit an inline rename (empty string ignored). */
  commitRename: (t: Thread, next: string) => void
  /** Cancel an inline rename. */
  cancelRename: () => void
  /** Currently multi-selected conversation IDs. */
  selected: Set<string>
  /** Whether iOS-style selection mode is active. */
  selecting: boolean
  /** Enter or exit iOS-style selection mode. */
  setSelectMode: (v: boolean) => void
  /** Anchor conversation ID for Shift-click range selection. */
  anchorRef: { current: string | null }
  /** Drag-select start conversation ID. */
  dragStartRef: { current: string | null }
  /** Drag-select start Y coordinate. */
  dragStartYRef: { current: number }
  /** Whether the current mouse gesture performed a drag selection. */
  didDragSelectRef: { current: boolean }
  /** Active conversation ID. */
  active: string | null
  /** Select all conversations between fromId and toId in DOM order. */
  selectRange: (fromId: string, toId: string, additive?: boolean) => void
  /** Toggle a single conversation in the multi-selection. */
  toggleSelect: (id: string) => void
  /** Clear multi-selection. */
  clearSelect: () => void
  /** Address builder for Copy link / Open in new tab. */
  hrefOf: (id: string) => string
}

const Rows = createContext<Menus | null>(null)

/** A menu's rows in page order: the rows that carry its id. */
function listRows(list: string): Element[] {
  return typeof document === 'undefined' ? [] : [...document.querySelectorAll(`[data-thread][data-menu-of="${CSS.escape(list)}"]`)]
}

/** One entry of the menu: an act — its keys printed, and named for assistive technology — or the line before Delete. */
type Entry =
  | { key: string; label: string; icon: ReactNode; shortcut?: string; keys?: string; destructive?: boolean; run: () => void }
  | { key: string; line: true }

/** The keys of every list's menu on the page, heard once (`chord`). */
interface Keys {
  /** Whether this list's menu is open. */
  open: boolean
  /** Whether one of this list's dialogs is: the keys are the dialog's then. */
  held: boolean
  /** The conversation the keys act on here: the one whose menu is open, or the one the pane holds. */
  target: () => Thread | null
  act: (a: Act, t: Thread) => void
}

const keyed = new Set<{ current: Keys | null }>()

/**
 * A keydown anywhere on the page, before anything inside it handles it (an
 * open menu takes its keys): the list whose menu is open, or else the first
 * that holds the open conversation, acts.
 */
function hear(e: KeyboardEvent): void {
  const act = chord(e)
  if (!act) return
  const all = [...keyed].map((one) => one.current).filter((one): one is Keys => one !== null)
  if (all.some((one) => one.held)) return
  const list = all.find((one) => one.open) ?? all.find((one) => one.target() !== null)
  const t = list?.target()
  if (!list || !t) return
  e.preventDefault()
  list.act(act, t)
}

function listen(keys: { current: Keys | null }): () => void {
  if (!keyed.size) window.addEventListener('keydown', hear, true)
  keyed.add(keys)
  return () => {
    keyed.delete(keys)
    if (!keyed.size) window.removeEventListener('keydown', hear, true)
  }
}

/** The element of a row that takes focus: the row itself, a button. */
const own = (row: Element | null): HTMLElement | null => row?.querySelector<HTMLElement>('[data-slot="sidebar-item"], [role="button"]') ?? null

/**
 * A list of conversations with their menu: a right-click on a row or a
 * long-press opens it at the point, a row's ⋯ hangs it from itself. Its one
 * child holds the rows (`ThreadRow`). `threads` are the list's conversations by
 * id, `active` the one the pane holds (what the keys act on with no menu open),
 * and `onGone` runs after that one is deleted — the pane moves to a new chat —
 * defaulting to emptying the pane. `onSchedule`, where the list's host can say
 * what the conversation asks, adds Schedule…: the conversation's question as a
 * task that runs itself.
 */
export type ThreadActions = ReturnType<typeof useThreadActions>

export function ConversationMenu({
  threads,
  active = null,
  onGone = empty,
  onSchedule,
  customActions,
  canShare = !customActions,
  hrefOf = href,
  primary = true,
  noun = 'chat',
  children,
}: {
  noun?: Noun
  threads: Map<string, Thread>
  active?: string | null
  onGone?: () => void
  onSchedule?: (t: Thread) => void
  customActions?: ThreadActions
  canShare?: boolean
  hrefOf?: (id: string) => string
  primary?: boolean
  children: ReactElement
}) {
  const { t } = useI18n()
  const windowed = useWindowed()
  const defaultAct = useThreadActions()
  const act = customActions ?? defaultAct
  // The conversation the pane holds NOW: a delete answered after the reader moved on leaves the conversation they moved to.
  const holds = useRef(active)
  holds.current = active
  // The list's own element, for the row after one deleted.
  const list = useId()
  const [menu, setMenu] = useState<'point' | 'dots' | null>(null)
  const [dialogue, setDialogue] = useState<Dialogue | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [organizeGroup, setOrganizeGroup] = useState('')
  const anchorRef = useRef<string | null>(active)
  const dragStartRef = useRef<string | null>(null)
  const dragStartYRef = useRef<number>(0)
  const didDragSelectRef = useRef<boolean>(false)
  const selecting = selectMode || selected.size > 0

  const orderedIds = useCallback((): string[] => {
    if (typeof document === 'undefined') return [...threads.keys()]
    const own = listRows(list)
    if (!own.length) return [...threads.keys()]
    return own.map((el) => el.getAttribute('data-thread') ?? '').filter(Boolean)
  }, [list, threads])

  const selectRange = useCallback(
    (fromId: string, toId: string, additive = false) => {
      const ids = orderedIds()
      const a = ids.indexOf(fromId)
      const b = ids.indexOf(toId)
      if (a < 0 || b < 0) return
      const [lo, hi] = a <= b ? [a, b] : [b, a]
      const slice = ids.slice(lo, hi + 1)
      setSelectMode(true)
      setSelected((prev) => {
        const next = additive ? new Set(prev) : new Set<string>()
        for (const id of slice) next.add(id)
        return next
      })
    },
    [orderedIds],
  )

  const toggleSelect = useCallback((id: string) => {
    setSelectMode(true)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelect = useCallback(() => {
    setSelectMode(false)
    setSelected((prev) => (prev.size ? new Set() : prev))
  }, [])

  useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev
      const next = new Set([...prev].filter((id) => threads.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [threads])

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const startId = dragStartRef.current
      if (!startId) return
      if ((e.buttons & 1) !== 1) {
        dragStartRef.current = null
        return
      }
      const dy = Math.abs(e.clientY - dragStartYRef.current)
      const hit = typeof document !== 'undefined' ? document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-thread]') : null
      const hitId = hit?.getAttribute('data-thread') ?? null
      const inThisList = hit ? hit.getAttribute('data-menu-of') === list : false
      if (dy > 6 || (hitId && inThisList && hitId !== startId)) {
        didDragSelectRef.current = true
        window.getSelection?.()?.removeAllRanges?.()
        const targetId = hitId && inThisList ? hitId : startId
        selectRange(startId, targetId, e.metaKey || e.ctrlKey)
      }
    }
    const onUp = () => {
      dragStartRef.current = null
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('mouseup', onUp)
    }
  }, [list, selectRange])

  useEffect(() => {
    const onSelectEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<{ mode?: 'toggle' | 'all' | 'clear' }>).detail
      if (detail?.mode === 'clear') {
        clearSelect()
        return
      }
      if (detail?.mode === 'all') {
        setSelectMode(true)
        setSelected(new Set(orderedIds()))
        return
      }
      setSelectMode((v) => {
        if (v) setSelected(new Set())
        return !v
      })
    }
    window.addEventListener('hanzo:recents-select', onSelectEvent)
    return () => window.removeEventListener('hanzo:recents-select', onSelectEvent)
  }, [clearSelect, orderedIds])

  const selectedThreads = useMemo(
    () => [...selected].map((id) => threads.get(id)).filter((th): th is Thread => Boolean(th)),
    [selected, threads],
  )

  const batchRemove = useCallback(
    (targets: Thread[]) => {
      if (!targets.length) return
      setSelectMode(false)
      setSelected(new Set())
      setMenu(null)
      setDialogue(null)
      const removingActive = Boolean(holds.current && targets.some((th) => th.id === holds.current))
      void Promise.all(targets.map((th) => act.remove(th))).then(() => {
        if (removingActive) onGone()
      })
    },
    [act, onGone],
  )

  const archiveOne = useCallback((target: Thread) => archiveWithUndo(act, t, target), [act, t])

  const batchArchive = useCallback(
    (targets: Thread[]) => {
      if (!targets.length) return
      const allArchived = targets.every((th) => th.archived)
      setSelectMode(false)
      setSelected(new Set())
      setMenu(null)
      const toToggle = targets.filter((th) => Boolean(th.archived) === allArchived)
      void Promise.all(toToggle.map((th) => act.archive(th))).then((results) => {
        const succeeded = toToggle.filter((_, i) => results[i])
        if (!succeeded.length) return
        if (!allArchived) {
          const snapshots = succeeded.map((th) => ({ ...th, archived: true }))
          toast(
            snapshots.length === 1 ? t(NOUNS[noun].archived) : t(NOUNS[noun].archivedMany, { n: snapshots.length }),
            {
              duration: 5000,
              action: {
                label: t('Undo'),
                onClick: () => {
                  void Promise.all(snapshots.map((th) => act.archive(th)))
                },
              },
            },
          )
        } else {
          toast.success(
            succeeded.length === 1 ? t(NOUNS[noun].unarchived) : t(NOUNS[noun].unarchivedMany, { n: succeeded.length }),
          )
        }
      })
    },
    [act, t, noun],
  )

  const batchPin = useCallback(
    (targets: Thread[]) => {
      if (!targets.length) return
      const allPinned = targets.every((th) => th.pinned)
      setSelectMode(false)
      setSelected(new Set())
      setMenu(null)
      void Promise.all(targets.map((th) => (Boolean(th.pinned) === allPinned ? act.pin(th) : Promise.resolve(true))))
    },
    [act],
  )

  const batchOrganize = useCallback(
    (targets: Thread[], groupName: string) => {
      const cleanGroup = groupName.trim()
      if (!targets.length || !cleanGroup) return
      setSelectMode(false)
      setSelected(new Set())
      setMenu(null)
      setDialogue(null)
      setOrganizeGroup('')
      const untitledWord = t('Untitled')
      void Promise.all(
        targets.map((th) => {
          const base = titleOf(th, untitledWord).replace(/^\[[^\]]+\]\s*/, '')
          const nextTitle = `[${cleanGroup}] ${base}`.slice(0, 80)
          return act.rename(th, nextTitle)
        }),
      )
    },
    [act, t],
  )

  useEffect(() => {
    if (!selected.size) return
    const onKey = (e: KeyboardEvent) => {
      if (dialogue !== null) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        clearSelect()
        return
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // One key never deletes a whole selection: it asks first, naming them.
        e.preventDefault()
        if (selectedThreads.length) setDialogue('deleteMany')
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
        const inSidebar = el?.closest?.('[data-slot="app-column"], [data-menu]')
        if (inSidebar || selected.size > 0) {
          e.preventDefault()
          setSelected(new Set(orderedIds()))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected.size, selectedThreads, dialogue, clearSelect, orderedIds])

  // The conversation the menu or a dialog acts on, by id, read from the list so
  // it is current; the last one read stands in once the list lets it go (a
  // closing Delete dialog still names it).
  const [aimed, setAimed] = useState<string | null>(null)
  const last = useRef<Thread | null>(null)
  const listed = aimed ? (threads.get(aimed) ?? null) : null
  if (listed) last.current = listed
  const subject = aimed ? (listed ?? (last.current?.id === aimed ? last.current : null)) : null
  // Where focus goes back to: the ⋯ pressed, or the row right-clicked.
  const from = useRef<HTMLElement | null>(null)
  // What a right-click or a long-press landed on, before the menu decides to open.
  const pointed = useRef<Thread | null>(null)

  const ask = useCallback(
    (d: Dialogue, thread: Thread) => {
      setAimed(thread.id)
      setMenu(null)
      if (d === 'rename' && typeof document !== 'undefined') {
        const hasRow = listRows(list).some(
          (el) => el.getAttribute('data-thread') === thread.id,
        )
        if (hasRow) {
          setDialogue(null)
          setRenaming(thread.id)
          return
        }
      }
      setRenaming(null)
      setDialogue(d)
    },
    [list],
  )

  const { commit: commitRename, cancel: cancelRename } = useRenaming(from, setRenaming, (thread, title) => void act.rename(thread, title), t('Untitled'))

  const aim = useCallback((t: Thread, el: HTMLElement) => {
    from.current = el
    setAimed(t.id)
  }, [])

  const point = (e: { target: EventTarget | null }) => {
    const row = (e.target as Element | null)?.closest?.('[data-thread]') ?? null
    pointed.current = row ? (threads.get(row.getAttribute('data-thread') ?? '') ?? null) : null
    if (pointed.current) {
      from.current = own(row)
      if (selected.size > 1 && !selected.has(pointed.current.id)) {
        const pid = pointed.current.id
        setSelected((prev) => new Set([...prev, pid]))
      }
    }
  }

  // A menu shut by Escape, a choice or a press outside gives focus back where it
  // was opened from — unless what was chosen opened a dialog, which takes it.
  const back = (e: Event) => {
    e.preventDefault()
    requestAnimationFrame(() => {
      const now = document.activeElement
      if (!now || now === document.body) from.current?.focus()
    })
  }
  const shut = (open: boolean) => {
    if (!open) setDialogue(null)
  }
  const after = (e: Event) => {
    e.preventDefault()
    if (from.current?.isConnected) from.current.focus()
  }

  const keys = useRef<Keys | null>(null)
  keys.current = {
    open: menu !== null,
    held: dialogue !== null || renaming !== null,
    target: () => (menu !== null ? subject : active ? (threads.get(active) ?? null) : null),
    act: (a, t) => {
      // With no menu open, focus goes back to wherever the keys were pressed.
      if (menu === null && document.activeElement instanceof HTMLElement) from.current = document.activeElement
      if (a === 'rename') return ask('rename', t)
      setMenu(null)
      void act.pin(t)
    },
  }
  useEffect(() => listen(keys), [])

  const rows = useMemo<Menus>(
    () => ({
      noun,
      list,
      aim,
      open: menu ? aimed : null,
      renaming,
      commitRename,
      cancelRename,
      selected,
      selecting,
      setSelectMode,
      anchorRef,
      dragStartRef,
      dragStartYRef,
      didDragSelectRef,
      active,
      selectRange,
      toggleSelect,
      clearSelect,
      hrefOf,
    }),
    [noun, list, aim, menu, aimed, renaming, commitRename, cancelRename, selected, selecting, active, selectRange, toggleSelect, clearSelect, hrefOf],
  )

  // The menu is named by its conversation: gui would name it by its trigger, the
  // list itself for a right-click, and the ⋯ for the other.
  const untitled = t('Untitled')
  const isMultiMenu = (selecting && selectedThreads.length > 0 && (!subject || selected.has(subject.id))) || (selectedThreads.length > 1 && (!subject || selected.has(subject.id)))
  const title = isMultiMenu ? t('{n} selected', { n: selectedThreads.length }) : subject ? titleOf(subject, untitled) : undefined
  const apple = mac()
  const allPinned = selectedThreads.length > 0 && selectedThreads.every((th) => th.pinned)
  const allArchived = selectedThreads.length > 0 && selectedThreads.every((th) => th.archived)
  const allSelected = threads.size > 0 && selected.size >= threads.size
  const entries: Entry[] = isMultiMenu
    ? [
        {
          key: 'batch-pin',
          label: t(allPinned ? 'Unpin ({n})' : 'Pin ({n})', { n: selectedThreads.length }),
          icon: allPinned ? <PinOff size={16} aria-hidden /> : <Pin size={16} aria-hidden />,
          run: () => batchPin(selectedThreads),
        },
        {
          key: 'batch-archive',
          label: t(allArchived ? 'Unarchive ({n})' : 'Archive ({n})', { n: selectedThreads.length }),
          icon: allArchived ? <ArchiveRestore size={16} aria-hidden /> : <Archive size={16} aria-hidden />,
          run: () => batchArchive(selectedThreads),
        },
        {
          key: 'batch-organize',
          label: t('Organize ({n})…', { n: selectedThreads.length }),
          icon: <FolderInput size={16} aria-hidden />,
          run: () => {
            setMenu(null)
            setDialogue('organize')
          },
        },
        {
          key: 'batch-select-all',
          label: allSelected ? t('Deselect all') : t('Select all ({n})', { n: threads.size }),
          icon: <CheckSquare size={16} aria-hidden />,
          shortcut: apple ? '⌘A' : 'Ctrl+A',
          run: () => {
            if (allSelected) setSelected(new Set())
            else setSelected(new Set(orderedIds()))
          },
        },
        {
          key: 'batch-clear',
          label: t('Done'),
          icon: <X size={16} aria-hidden />,
          shortcut: 'Esc',
          run: () => clearSelect(),
        },
      ]
    : subject
      ? [
          {
            key: 'rename',
            label: t('Rename'),
            icon: <Pencil size={16} aria-hidden />,
            shortcut: said('rename', apple),
            keys: named('rename'),
            run: () => ask('rename', subject),
          },
          {
            key: 'pin',
            label: t(subject.pinned ? 'Unpin' : 'Pin'),
            icon: subject.pinned ? <PinOff size={16} aria-hidden /> : <Pin size={16} aria-hidden />,
            shortcut: said('pin', apple),
            keys: named('pin'),
            run: () => void act.pin(subject),
          },
          ...(canShare ? [{ key: 'share', label: t('Share…'), icon: <Share2 size={16} aria-hidden />, run: () => ask('share', subject) }] : []),
          ...(onSchedule ? [{ key: 'schedule', label: t('Schedule…'), icon: <Clock size={16} aria-hidden />, run: () => onSchedule(subject) }] : []),
          { key: 'copy', label: t('Copy link'), icon: <Link2 size={16} aria-hidden />, run: () => void copy(subject.id, t, hrefOf) },
          { key: 'copy-id', label: t('Copy id'), icon: <Copy size={16} aria-hidden />, run: () => void copyId(subject.id, t) },
          // A window of its own (Hanzo Desktop) has no browser tabs to open it in.
          ...(windowed ? [] : [{ key: 'tab', label: t('Open in new tab'), icon: <ExternalLink size={16} aria-hidden />, run: () => away(subject.id, hrefOf) }]),
          {
            key: 'archive',
            label: t(subject.archived ? 'Unarchive' : 'Archive'),
            icon: subject.archived ? <ArchiveRestore size={16} aria-hidden /> : <Archive size={16} aria-hidden />,
            run: () => void archiveOne(subject),
          },
          { key: 'gone', line: true },
          { key: 'delete', label: t('Delete'), icon: <Trash2 size={16} aria-hidden />, destructive: true, run: () => ask('delete', subject) },
        ]
      : []

  return (
    <Rows.Provider value={rows}>
      <DropdownMenu open={menu === 'dots'} onOpenChange={(open) => setMenu(open ? 'dots' : null)}>
        <ContextMenu
          // Held here as well as inside gui's ContextMenu, so the keys can shut it.
          open={menu === 'point'}
          onOpenChange={(open, e) => {
            if (!open) return setMenu((m) => (m === 'point' ? null : m))
            // Not on a conversation: the browser's own menu answers.
            if (!pointed.current) {
              const ev = e as unknown as { target?: Element | null; clientX?: number; clientY?: number } | undefined
              const row = ev?.target?.closest?.('[data-thread]') ?? (typeof document !== 'undefined' ? document.elementFromPoint?.(ev?.clientX ?? -1, ev?.clientY ?? -1)?.closest?.('[data-thread]') : null)
              pointed.current = row ? (threads.get(row.getAttribute('data-thread') ?? '') ?? null) : null
              if (!pointed.current) return e?.preventDefault?.()
            }
            setAimed(pointed.current.id)
            setMenu('point')
          }}
        >
          <ContextMenuTrigger
            asChild
            data-menu={list}
            {...({
              onContextMenuCapture: point,
            } as object)}
            onContextMenu={point}
            onPointerDown={(e: { pointerType?: string; target: EventTarget | null }) => {
              if (e.pointerType !== 'mouse') point(e)
            }}
          >
            {children}
          </ContextMenuTrigger>
          <ContextMenuContent minW={220} onCloseAutoFocus={back} aria-labelledby={undefined} aria-label={title}>
            {entries.map((one) =>
              'line' in one ? (
                <ContextMenuSeparator key={one.key} />
              ) : (
                <ContextMenuItem key={one.key} variant={one.destructive ? 'destructive' : 'default'} aria-keyshortcuts={one.keys} onSelect={one.run}>
                  <Face entry={one} Shortcut={ContextMenuShortcut} />
                </ContextMenuItem>
              ),
            )}
          </ContextMenuContent>
        </ContextMenu>
        <DropdownMenuContent align="end" minW={220} onCloseAutoFocus={back} aria-labelledby={undefined} aria-label={title}>
          {entries.map((one) =>
            'line' in one ? (
              <DropdownMenuSeparator key={one.key} />
            ) : (
              <DropdownMenuItem key={one.key} variant={one.destructive ? 'destructive' : 'default'} aria-keyshortcuts={one.keys} onSelect={one.run}>
                <Face entry={one} Shortcut={DropdownMenuShortcut} />
              </DropdownMenuItem>
            ),
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {(primary && selecting) || (!primary && selected.size > 0) ? (
        <YStack
          data-slot="batch-bar"
          gap="$1.5"
          p="$2"
          mt="$2"
          rounded="$4"
          bg="$panel"
          borderWidth={1}
          borderColor="var(--border-strong)"
          // Pinned to the list's foot, over the rows (their marks sit at 2).
          position="sticky"
          b={0}
          z="var(--z-raised)"
          $platform-web={{
            backdropFilter: 'blur(16px)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <XStack items="center" justify="space-between" gap="$2" px="$1">
            <XStack
              render="button"
              {...({ type: 'button' } as object)}
              cursor="pointer"
              px="$1.5"
              py="$0.5"
              rounded="$2"
              onClick={() => {
                if (allSelected) setSelected(new Set())
                else setSelected(new Set(orderedIds()))
              }}
              hoverStyle={{ bg: '$hover' }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              $max-sm={{ minH: 44, items: 'center' }}
            >
              <SizableText size="$1" fontWeight="500" color="$soft">
                {allSelected ? t('Deselect all') : t('Select all')}
              </SizableText>
            </XStack>
            <SizableText size="$1" fontWeight="600" color="$ink" numberOfLines={1}>
              {t('{n} selected', { n: selectedThreads.length })}
            </SizableText>
            <XStack
              render="button"
              {...({ type: 'button' } as object)}
              aria-label={t('Clear selection')}
              cursor="pointer"
              px="$1.5"
              py="$0.5"
              rounded="$2"
              onClick={clearSelect}
              hoverStyle={{ bg: '$hover' }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              $max-sm={{ minH: 44, items: 'center' }}
            >
              <SizableText size="$1" fontWeight="600" color="$ink">
                {t('Done')}
              </SizableText>
            </XStack>
          </XStack>
          <XStack items="center" justify="space-between" gap="$1" pt="$0.5" flexWrap="wrap">
            <XStack
              render="button"
              {...({ type: 'button' } as object)}
              aria-label={t(allPinned ? 'Unpin selected' : 'Pin selected')}
              disabled={!selectedThreads.length}
              opacity={selectedThreads.length ? 1 : 0.4}
              flex={1}
              minW={52}
              height={28}
              px="$1.5"
              rounded="$3"
              items="center"
              justify="center"
              gap={4}
              borderWidth={1}
              borderColor="transparent"
              cursor={selectedThreads.length ? 'pointer' : 'default'}
              transition="quickest"
              hoverStyle={selectedThreads.length ? { bg: '$hover', borderColor: 'var(--border-strong)' } : undefined}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              $max-sm={{ minH: 44 }}
              onClick={() => batchPin(selectedThreads)}
            >
              {allPinned ? <PinOff size={13} color="var(--foreground)" aria-hidden /> : <Pin size={13} color="var(--foreground)" aria-hidden />}
              <SizableText size="$1" fontWeight="500" color="$ink">
                {t(allPinned ? 'Unpin' : 'Pin')}
              </SizableText>
            </XStack>
            <XStack
              render="button"
              {...({ type: 'button' } as object)}
              aria-label={t(allArchived ? 'Unarchive selected' : 'Archive selected')}
              disabled={!selectedThreads.length}
              opacity={selectedThreads.length ? 1 : 0.4}
              flex={1}
              minW={56}
              height={28}
              px="$1.5"
              rounded="$3"
              items="center"
              justify="center"
              gap={4}
              borderWidth={1}
              borderColor="transparent"
              cursor={selectedThreads.length ? 'pointer' : 'default'}
              transition="quickest"
              hoverStyle={selectedThreads.length ? { bg: '$hover', borderColor: 'var(--border-strong)' } : undefined}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              $max-sm={{ minH: 44 }}
              onClick={() => batchArchive(selectedThreads)}
            >
              {allArchived ? <ArchiveRestore size={13} color="var(--foreground)" aria-hidden /> : <Archive size={13} color="var(--foreground)" aria-hidden />}
              <SizableText size="$1" fontWeight="500" color="$ink">
                {t(allArchived ? 'Unarchive' : 'Archive')}
              </SizableText>
            </XStack>
            <XStack
              render="button"
              {...({ type: 'button' } as object)}
              aria-label={t('Organize selected')}
              disabled={!selectedThreads.length}
              opacity={selectedThreads.length ? 1 : 0.4}
              flex={1}
              minW={52}
              height={28}
              px="$1.5"
              rounded="$3"
              items="center"
              justify="center"
              gap={4}
              borderWidth={1}
              borderColor="transparent"
              cursor={selectedThreads.length ? 'pointer' : 'default'}
              transition="quickest"
              hoverStyle={selectedThreads.length ? { bg: '$hover', borderColor: 'var(--border-strong)' } : undefined}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              $max-sm={{ minH: 44 }}
              onClick={() => setDialogue('organize')}
            >
              <FolderInput size={13} color="var(--foreground)" aria-hidden />
              <SizableText size="$1" fontWeight="500" color="$ink">
                {t('Group')}
              </SizableText>
            </XStack>
          </XStack>
        </YStack>
      ) : null}
      <Rename
        noun={noun}
        t={subject}
        open={dialogue === 'rename'}
        onOpenChange={shut}
        onCloseAutoFocus={after}
        save={(t, words) => {
          if (words !== titleOf(t, untitled)) void act.rename(t, words)
        }}
      />
      <Delete
        noun={noun}
        t={subject ? [subject] : []}
        open={dialogue === 'delete'}
        onOpenChange={shut}
        onCloseAutoFocus={after}
        remove={([t]) => {
          // Focus goes on to the row after it, or the one before, not to the page.
          const rows = listRows(list)
          const at = rows.findIndex((row) => row.getAttribute('data-thread') === t.id)
          if (at >= 0) from.current = own(rows[at + 1] ?? rows[at - 1] ?? null)
          void act.remove(t).then((ok) => {
            if (ok && holds.current === t.id) onGone()
          })
        }}
      />
      <Delete noun={noun} t={selectedThreads} open={dialogue === 'deleteMany'} onOpenChange={shut} onCloseAutoFocus={after} remove={batchRemove} />
      {canShare ? <ShareDialog thread={subject?.id ?? null} open={dialogue === 'share'} onOpenChange={shut} onCloseAutoFocus={after} /> : null}
      <Dialog open={dialogue === 'organize'} onOpenChange={shut}>
        <DialogContent maxW={440} width="calc(100vw - 24px)" rounded="$6" gap="$3" onCloseAutoFocus={after}>
          <DialogTitle>{t('Organize {n} chats', { n: selectedThreads.length })}</DialogTitle>
          <SizableText size="$2" color="$soft">
            {t('Group and tag the selected chats under a shared project or topic label.')}
          </SizableText>
          <Input
            autoFocus
            value={organizeGroup}
            onChangeText={setOrganizeGroup}
            placeholder={t('e.g. Research, Architecture, Q4 Launch')}
            aria-label={t('Group or project name')}
            borderColor="var(--border-strong)"
            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $max-sm={{ minH: 44 }}
            maxLength={40}
            onKeyDown={(e: { key?: string; keyCode?: number; nativeEvent?: { isComposing?: boolean } }) => {
              if (e.key === 'Enter' && !e.nativeEvent?.isComposing && e.keyCode !== 229 && organizeGroup.trim()) {
                batchOrganize(selectedThreads, organizeGroup)
              }
            }}
          />
          <XStack gap="$2" justify="flex-end" flexWrap="wrap">
            <Button
              size="sm"
              variant="outline"
              rounded={999}
              borderColor="var(--border-strong)"
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              $max-sm={{ minH: 44 }}
              onPress={() => shut(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              size="sm"
              rounded={999}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              $max-sm={{ minH: 44 }}
              disabled={!organizeGroup.trim()}
              onPress={() => batchOrganize(selectedThreads, organizeGroup)}
            >
              {t('Apply to {n} chats', { n: selectedThreads.length })}
            </Button>
          </XStack>
        </DialogContent>
      </Dialog>
    </Rows.Provider>
  )
}

/** One entry's line: its icon in a 16px well, its name, and its keys at the end. */
function Face({
  entry,
  Shortcut,
}: {
  entry: Extract<Entry, { run: () => void }>
  Shortcut: typeof ContextMenuShortcut | typeof DropdownMenuShortcut
}) {
  return (
    <>
      <XStack width={16} height={16} items="center" justify="center" shrink={0}>
        {entry.icon}
      </XStack>
      <Text flex={1} minW={0} fontSize="$2" color={entry.destructive ? DANGER : '$ink'} numberOfLines={1}>
        {entry.label}
      </Text>
      {/* Printed for the eye; the item's aria-keyshortcuts says it to assistive technology. */}
      {entry.shortcut ? (
        <Shortcut aria-hidden {...{ 'data-i18n-ltr': '' }}>
          {entry.shortcut}
        </Shortcut>
      ) : null}
    </>
  )
}

/**
 * One conversation's row, inside a `ConversationMenu`: its menu opens by a
 * right-click anywhere on it, a long-press, or its ⋯; a middle-click or a
 * ⌘/Ctrl-click opens it in a new tab.
 *
 * The ⋯ stands where `aside` (the row's age) stands, and takes its place while
 * the row is hovered, focused, open in the pane or has its menu open, and
 * always on a touch screen, which has no hover to find it by; the rest of the
 * time the age reads there.
 */
export function ThreadRow({
  t: thread,
  active = false,
  aside,
  listed = true,
  dragging = false,
  dropTarget = false,
  onReorderDragStart,
  onReorderDragOver,
  onReorderDragLeave,
  onReorderDrop,
  onReorderDragEnd,
  children,
}: {
  t: Thread
  active?: boolean
  aside?: ReactNode
  /** A row of a list (`role="listitem"`); false where it stands among other rows. */
  listed?: boolean
  dragging?: boolean
  dropTarget?: boolean
  onReorderDragStart?: (e: DragEvent) => void
  onReorderDragOver?: (e: DragEvent) => void
  onReorderDragLeave?: () => void
  onReorderDrop?: (e: DragEvent) => void
  onReorderDragEnd?: () => void
  children: ReactElement
}) {
  const { t } = useI18n()
  const menus = useContext(Rows)
  if (!menus) throw new Error('ThreadRow is drawn inside a ConversationMenu, which holds its menu.')
  const [focused, setFocused] = useState(false)
  // Its own id: gui gives every trigger of one menu the menu's one id.
  const id = useId()
  // What the ⋯ is for, said after its name: the row's title.
  const about = useId()
  const isSelected = menus.selected.has(thread.id)
  const isRenaming = menus.renaming === thread.id
  // The ⋯ and the age share one place: on hover, focus, or when the row's menu is open, ⋯ replaces the age.
  const menuOrFocus = menus.open === thread.id || focused
  // gui types these handlers by React Native's event; on the web they carry the DOM's.
  const aim = (e: unknown) => menus.aim(thread, (e as MouseEvent<HTMLElement>).currentTarget)
  // A new tab / drag-select for the row itself, never for its ⋯ or drag-reorder grip.
  const onDots = (target: EventTarget | null) =>
    Boolean((target as Element | null)?.closest?.('[data-slot="thread-options"], [data-slot="thread-drag-handle"]'))
  const canReorder = Boolean(onReorderDragStart && onReorderDrop && !menus.selecting)
  if (isRenaming) {
    return (
      <YStack
        {...(listed ? { role: 'listitem' } : null)}
        position="relative"
        rounded="$4"
        data-thread={thread.id}
        data-menu-of={menus.list}
        data-renaming=""
      >
        <InlineRename
          initial={titleOf(thread, t('Untitled'))}
          onSave={(next) => menus.commitRename(thread, next)}
          onCancel={menus.cancelRename}
        />
      </YStack>
    )
  }
  return (
    <YStack
      {...(listed ? { role: 'listitem' } : null)}
      position="relative"
      group
      rounded="$4"
      opacity={dragging ? 0.45 : 1}
      borderTopWidth={dropTarget ? 2 : 0}
      borderTopColor={dropTarget ? 'var(--border-selected)' : 'transparent'}
      bg={isSelected ? '$hover' : undefined}
      $platform-web={{
        userSelect: 'none',
        ...(isSelected ? { backgroundColor: 'var(--glass)' } : null),
      }}
      data-thread={thread.id}
      data-menu-of={menus.list}
      data-selected={isSelected ? '' : undefined}
      data-pinned={thread.pinned ? '' : undefined}
      data-archived={thread.archived ? '' : undefined}
      {...(canReorder
        ? ({
            onDragOver: onReorderDragOver,
            onDragLeave: onReorderDragLeave,
            onDrop: onReorderDrop,
          } as object)
        : null)}
      onPointerDownCapture={(down: unknown) => {
        const e = down as MouseEvent<HTMLElement> & { pointerType?: string }
        if (e.button !== 0 || onDots(e.target)) return
        if (e.pointerType && e.pointerType !== 'mouse') return
        menus.dragStartRef.current = thread.id
        menus.dragStartYRef.current = e.clientY
        menus.didDragSelectRef.current = false
      }}
      onPointerUpCapture={(up: unknown) => {
        const e = up as MouseEvent<HTMLElement>
        if (onDots(e.target)) return
        if (menus.didDragSelectRef.current || menus.selecting || e.shiftKey || e.metaKey || e.ctrlKey) {
          e.stopPropagation()
        }
      }}
      onClickCapture={(press: unknown) => {
        const e = press as MouseEvent<HTMLElement>
        if (onDots(e.target)) return
        if (menus.didDragSelectRef.current) {
          e.preventDefault()
          e.stopPropagation()
          menus.didDragSelectRef.current = false
          menus.anchorRef.current = thread.id
          return
        }
        if (e.shiftKey) {
          e.preventDefault()
          e.stopPropagation()
          const anchor = menus.anchorRef.current || menus.active || thread.id
          menus.selectRange(anchor, thread.id, e.metaKey || e.ctrlKey)
          return
        }
        if (menus.selecting) {
          e.preventDefault()
          e.stopPropagation()
          menus.toggleSelect(thread.id)
          menus.anchorRef.current = thread.id
          return
        }
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          e.stopPropagation()
          away(thread.id, menus.hrefOf)
          return
        }
        menus.anchorRef.current = thread.id
      }}
      onMouseDown={(e: MouseEvent<HTMLElement>) => {
        // The middle button's own autoscroll would start here.
        if (e.button === 1) {
          e.preventDefault()
          return
        }
        if (e.button !== 0 || onDots(e.target)) return
        menus.dragStartRef.current = thread.id
        menus.dragStartYRef.current = e.clientY
        menus.didDragSelectRef.current = false
        if (e.shiftKey) {
          e.preventDefault()
          window.getSelection?.()?.removeAllRanges?.()
          const anchor = menus.anchorRef.current || menus.active || thread.id
          menus.selectRange(anchor, thread.id, e.metaKey || e.ctrlKey)
        }
      }}
      onMouseEnter={(enter: unknown) => {
        const e = enter as MouseEvent<HTMLElement>
        if (!menus.dragStartRef.current || e.buttons !== 1) return
        if (menus.dragStartRef.current !== thread.id || menus.didDragSelectRef.current) {
          menus.didDragSelectRef.current = true
          window.getSelection?.()?.removeAllRanges?.()
          menus.selectRange(menus.dragStartRef.current, thread.id, e.metaKey || e.ctrlKey)
        }
      }}
      onMouseUp={(e: MouseEvent<HTMLElement>) => {
        if (e.button !== 1 || onDots(e.target)) return
        e.preventDefault()
        away(thread.id, menus.hrefOf)
      }}
    >
      {canReorder ? (
        <XStack
          data-slot="thread-drag-handle"
          aria-label={t('Drag to reorder')}
          {...({
            title: t('Drag to reorder'),
            draggable: true,
            onDragStart: onReorderDragStart,
            onDragEnd: onReorderDragEnd,
            onMouseDown: (e: MouseEvent<HTMLElement>) => e.stopPropagation(),
            onPointerDown: (e: MouseEvent<HTMLElement>) => e.stopPropagation(),
          } as object)}
          position="absolute"
          insetInlineStart={1}
          t={0}
          b={0}
          width={14}
          items="center"
          justify="center"
          z="var(--z-raised)"
          opacity={dragging ? 1 : 0}
          $group-hover={{ opacity: 0.55 }}
          hoverStyle={{ opacity: 1 }}
          $platform-web={{ cursor: dragging ? 'grabbing' : 'grab' }}
        >
          <GripVertical size={11} color="var(--muted-foreground)" aria-hidden />
        </XStack>
      ) : null}
      {menus.selecting ? (
        <XStack
          position="absolute"
          insetInlineStart={6}
          t={0}
          b={0}
          items="center"
          justify="center"
          pointerEvents="none"
          z="var(--z-raised)"
          aria-hidden
        >
          <XStack
            width={18}
            height={18}
            rounded={999}
            items="center"
            justify="center"
            borderWidth={1.5}
            borderStyle="solid"
            bg={isSelected ? 'var(--foreground)' : 'transparent'}
            borderColor={isSelected ? 'var(--foreground)' : 'var(--muted-foreground)'}
            opacity={isSelected ? 1 : 0.65}
          >
            {isSelected ? <Check size={11} strokeWidth={3} color="var(--background)" aria-hidden /> : null}
          </XStack>
        </XStack>
      ) : null}
      {menus.selecting ? <YStack paddingInlineStart={22}>{children}</YStack> : children}
      <Text id={about} display="none">
        {titleOf(thread, t('Untitled'))}
      </Text>
      {aside ? (
        <XStack
          position="absolute"
          insetInlineEnd="$2"
          t={0}
          b={0}
          items="center"
          pointerEvents="none"
          opacity={menuOrFocus ? 0 : 1}
          $group-hover={{ opacity: 0 }}
          $touchable={{ opacity: 0 }}
        >
          {aside}
        </XStack>
      ) : null}
      <XStack position="absolute" insetInlineEnd="$1" t={0} b={0} items="center">
        <DropdownMenuTrigger asChild>
          <XStack
            render="button"
            // Named for what it is, not for the row: the row's own name is its title,
            // and a second button named with that title would answer for it too.
            aria-label={t(NOUNS[menus.noun].options)}
            aria-describedby={about}
            id={id}
            data-slot="thread-options"
            width={26}
            height={26}
            rounded="$2"
            items="center"
            justify="center"
            cursor="pointer"
            bg={menus.open === thread.id ? '$hover' : 'transparent'}
            display="flex"
            opacity={menuOrFocus ? 1 : 0}
            $group-hover={{ opacity: 1 }}
            focusStyle={{ opacity: 1 }}
            focusVisibleStyle={{ opacity: 1, outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $touchable={{ opacity: 1, minW: 44, minH: 44 }}
            $max-sm={{ opacity: 1, minW: 44, minH: 44 }}
            transition="quickest"
            hoverStyle={{ bg: '$hover' }}
            // Before gui's own press handler, which opens the menu and stops there.
            onPointerDownCapture={aim}
            onKeyDownCapture={aim}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          >
            <MoreHorizontal size={15} color="var(--muted-foreground)" aria-hidden />
          </XStack>
        </DropdownMenuTrigger>
      </XStack>
    </YStack>
  )
}

/** A conversation's title, written again: one line, never empty. */
function Rename({
  noun,
  t: thread,
  open,
  onOpenChange,
  onCloseAutoFocus,
  save,
}: {
  noun: Noun
  t: Thread | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus: (e: Event) => void
  save: (t: Thread, title: string) => void
}) {
  const { t } = useI18n()
  const untitled = t('Untitled')
  const [words, setWords] = useState('')
  // The title as it stood when the dialog opened; a list read again meanwhile does not overwrite the typing.
  const id = thread?.id
  useEffect(() => {
    if (open && thread) setWords(titleOf(thread, untitled))
  }, [open, id])
  const submit = () => {
    const title = words.trim()
    // Once: a second Enter while the dialog closes asks nothing.
    if (!open || !title || !thread) return
    onOpenChange(false)
    save(thread, title)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxW={440} width="calc(100vw - 24px)" rounded="$6" gap="$3" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogTitle>{t(NOUNS[noun].rename)}</DialogTitle>
        <Input
          autoFocus
          value={words}
          onChangeText={setWords}
          aria-label={t(NOUNS[noun].name)}
          borderColor="var(--border-strong)"
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
          $max-sm={{ minH: 44 }}
          maxLength={80}
          onKeyDown={(e: { key?: string; keyCode?: number; nativeEvent?: { isComposing?: boolean } }) => {
            if (e.key === 'Escape') {
              onOpenChange(false)
              return
            }
            // An Enter that ends an IME composition writes the word; it does not save.
            if (e.key === 'Enter' && !e.nativeEvent?.isComposing && e.keyCode !== 229) submit()
          }}
        />
        <XStack gap="$2" justify="flex-end" flexWrap="wrap">
          <Button
            size="sm"
            variant="outline"
            rounded={999}
            borderColor="var(--border-strong)"
            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $max-sm={{ minH: 44 }}
            onPress={() => onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            size="sm"
            rounded={999}
            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $max-sm={{ minH: 44 }}
            disabled={!words.trim()}
            onPress={submit}
          >
            {t('Save')}
          </Button>
        </XStack>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Deleting asks first, through the one confirm (Confirm.tsx), and says what goes
 * with it: every turn, and every link it was shared by. Several at once are
 * counted and named. `unsaved` is a conversation kept nowhere (private, or a
 * guest's): clearing it cannot be undone either.
 */
export function Delete({
  noun,
  t: targets,
  open,
  onOpenChange,
  onCloseAutoFocus,
  remove,
  unsaved = false,
}: {
  noun: Noun
  t: Thread[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseAutoFocus?: (e: Event) => void
  remove: (t: Thread[]) => void
  unsaved?: boolean
}) {
  const { t } = useI18n()
  const untitled = t('Untitled')
  const many = targets.length > 1
  const SHOWN = 5
  return (
    <Confirm
      open={open && targets.length > 0}
      danger
      title={unsaved ? t('Clear this conversation?') : many ? t(NOUNS[noun].removeMany, { n: targets.length }) : t(NOUNS[noun].remove)}
      body={
        unsaved
          ? t('It was never saved, so once it is cleared it cannot be brought back.')
          : many
            ? t(NOUNS[noun].goneMany)
            : t(NOUNS[noun].gone, { title: targets[0] ? titleOf(targets[0], untitled) : '' })
      }
      detail={
        many && !unsaved ? (
          <YStack data-slot="delete-confirm-titles" render="ul" gap="$1" pl="$4" m={0}>
            {targets.slice(0, SHOWN).map((one) => (
              <SizableText key={one.id} render="li" size="$2" color="$ink" numberOfLines={1}>
                {titleOf(one, untitled)}
              </SizableText>
            ))}
            {targets.length > SHOWN ? (
              <SizableText render="li" size="$2" color="$soft">
                {t('and {n} more', { n: targets.length - SHOWN })}
              </SizableText>
            ) : null}
          </YStack>
        ) : null
      }
      yes={unsaved ? t('Clear') : t('Delete')}
      onYes={() => remove(targets)}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
    />
  )
}
