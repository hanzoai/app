'use client'

// The working view: what is running, what it did, and what it made.
//
// Every piece here comes from `@hanzo/ui/agents` and every fact from
// `@hanzo/ai`. This file is arrangement — it owns no pixels and no transport,
// which is the test of whether the lift actually landed: a stranger with the
// two packages can assemble this app, and a channel workspace will assemble
// the same one from the same parts.
//
// THE BOARD IS A TREE, not a list. `sessions.list` answers ROOT sessions only,
// so a fan-out is invisible until you ask for it: each root with `children > 0`
// gets one `tree` read, and `nest` is not needed here because the server
// already materialises the nesting. A root with no children costs no request.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { useAi, useSession, useSessions } from '@hanzo/ai/react'
import { useOpen } from './open'
import { asked, KEY } from './watch'
import type { Session, SessionEvent, TreeNode } from '@hanzo/ai'
import {
  AgentBoard,
  ChannelHeader,
  Pane,
  ProgressBlock,
  Steer,
  steps,
  type Command,
  type Run,
  type RunStatus,
} from '@hanzo/ui/agents'
import { Box, Button, Skeleton, Text, XStack, YStack } from '@hanzo/ui'
import { useIam } from '@hanzo/iam/react'
import { enter, LOGIN } from './lib/destination'
import { useI18n } from '@hanzo/i18n/react'
import type { Say } from '@hanzo/i18n'
import { Composer } from '@hanzo/ui/chat'
import { Start } from './Start'
import { Bar } from './progress'

/** The server's four statuses, plus the honest fallback for anything else. */
const STATUS = (s?: string): RunStatus =>
  s === 'running' || s === 'paused' || s === 'done' || s === 'error' ? s : 'unknown'

type RunFilter = 'all' | 'running' | 'review' | 'done' | 'failed'

/** Format elapsed duration in crisp human units: `14s`, `2m 10s`, `1h 4m`. */
function formatDuration(startedAt?: string, endedAt?: string, nowMs = Date.now()): string | null {
  if (!startedAt) return null
  const start = Date.parse(startedAt)
  const end = endedAt ? Date.parse(endedAt) : nowMs
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  const totalSec = Math.max(0, Math.floor((end - start) / 1000))
  if (totalSec < 60) return `${totalSec}s`
  if (totalSec < 3600) {
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }
  const hours = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function statusLabel(status: RunStatus, t: Say): string {
  switch (status) {
    case 'running':
      return t('Running')
    case 'paused':
      return t('Needs review')
    case 'done':
      return t('Done')
    case 'error':
      return t('Failed')
    default:
      return t('Queued')
  }
}

function matchesFilter(status: RunStatus, filter: RunFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'running') return status === 'running'
  if (filter === 'review') return status === 'paused'
  if (filter === 'done') return status === 'done'
  return status === 'error'
}

/** Calm monochrome layout-matched skeleton for the runs sidebar list. */
function RunsSkeleton({ label }: { label: string }) {
  return (
    <YStack role="status" aria-busy={true} aria-label={label} gap="$2.5" p="$3" width="100%">
      <Skeleton layout="block" width={72} height={11} rounded="$2" />
      {[0, 1, 2, 3].map((i) => (
        <XStack
          key={i}
          items="center"
          gap="$2.5"
          p="$2.5"
          rounded="$3"
          borderWidth={1}
          borderColor="$edge"
          bg="$panel"
        >
          <Skeleton layout="block" width={8} height={8} rounded={9999} shrink={0} />
          <YStack flex={1} minW={0} gap="$1.5">
            <Skeleton layout="block" width={i % 2 === 0 ? '78%' : '64%'} height={13} rounded="$2" />
            <Skeleton layout="block" width={i % 2 === 0 ? '48%' : '38%'} height={10} rounded="$2" />
          </YStack>
          <Skeleton layout="block" width={36} height={11} rounded="$2" shrink={0} />
        </XStack>
      ))}
    </YStack>
  )
}

/** Calm monochrome layout-matched skeleton for the full Mission Control workspace. */
function WorkWorkspaceSkeleton({ label }: { label: string }) {
  return (
    <YStack role="status" aria-busy={true} aria-label={label} flex={1} minH={0} width="100%" overflow="hidden" $lg={{ flexDirection: 'row' }}>
      <YStack width="100%" height={200} shrink={0} borderBottomWidth={1} borderColor="$edge" $lg={{ width: 280, height: '100%', borderBottomWidth: 0, borderRightWidth: 1 }}>
        <RunsSkeleton label={label} />
      </YStack>
      <YStack flex={1} minW={0} minH={0} p="$5" gap="$4">
        <XStack items="center" justify="space-between" gap="$3">
          <Skeleton layout="block" width={220} height={20} rounded="$2" />
          <Skeleton layout="block" width={68} height={20} rounded="$10" />
        </XStack>
        <YStack gap="$3" p="$4" rounded="$4" borderWidth={1} borderColor="$edge" bg="$panel">
          <Skeleton layout="block" width="60%" height={14} rounded="$2" />
          <Skeleton layout="block" width="88%" height={12} rounded="$2" />
          <Skeleton layout="block" width="72%" height={12} rounded="$2" />
        </YStack>
      </YStack>
    </YStack>
  )
}

/**
 * A session as the board reads it.
 *
 * `doing` is `lastEvent.preview` — the first 240 BYTES of a payload, cut
 * without regard for JSON or rune boundaries. It is rendered, never parsed, and
 * never re-cut here: a second truncation of an already-truncated string is how
 * a preview becomes a fragment of a fragment.
 */
/**
 * What the run is doing, in words.
 *
 * The preview is the first 240 bytes of the raw event, so for a machine payload
 * it arrives as `{"type":"done","finishRea…` — a fragment of JSON with the
 * closing brace cut off. Rendering that put twenty-five lines of escaped JSON
 * down the board where the summaries belong, which reads as a crash.
 *
 * It cannot be parsed back (it is truncated by construction), so this reads the
 * one field that survives the cut — `type` is written first by every producer —
 * and says it. Anything that does not look like a payload is human text already
 * and passes through untouched.
 */
const previewOf = (preview: string | undefined, t: Say): string | undefined => {
  if (!preview) return undefined
  const raw = preview.trim()
  if (!raw.startsWith('{') && !raw.startsWith('"{') && !raw.startsWith('[')) return preview
  const kind = /"type"\s*:\s*\\?"([a-z_]+)/i.exec(raw)?.[1]
  switch (kind) {
    case 'done': return t('Finished')
    case 'error': return t('Failed')
    case 'start': return t('Starting')
    case 'tool': case 'tool_call': return t('Using a tool')
    case 'text': case 'delta': return t('Writing')
    case undefined: return undefined
    default: return kind.replace(/_/g, ' ')
  }
}

const toRun = (s: Session, t: Say, nowMs: number, children: Run[] = []): Run => {
  const status = STATUS(s.status)
  const ended = status === 'running' ? undefined : (s.endedAt || s.updatedAt)
  const elapsed = formatDuration(s.startedAt || s.createdAt, ended, nowMs)
  const meta = [s.target, elapsed].filter(Boolean).join(' · ')
  return {
    id: s.id,
    agent: s.title || s.agent || s.id,
    status,
    doing: previewOf(s.lastEvent?.preview, t),
    target: meta || undefined,
    project: s.project,
    children,
  }
}

/** Flatten the server's tree into the board's, dropping the node we asked for. */
const kidsOf = (node: TreeNode | null, t: Say, nowMs: number): Run[] =>
  // `children` is NULL on a leaf, not `[]` — the guard is load-bearing.
  (node?.children ?? []).map((child) =>
    child.session ? toRun(child.session, t, nowMs, kidsOf(child, t, nowMs)) : null,
  ).filter((r): r is Run => r !== null)

function Watching({ idle }: { idle?: ReactNode }) {
  const { t } = useI18n()
  const ai = useAi()
  const { sessions, loading, reload } = useSessions({ limit: 100 })
  // THE OPEN RUN IS THE SHELL'S, not this pane's. `Start` announces a new run by
  // writing `openSession`, which is how /dev picks it up; this pane kept its own
  // useState and so never heard, and the one control the idle state offers spent
  // money on a real run and left the reader reading "No runs yet". Same store,
  // and the list is re-read when the id changes so the new row is there to open.
  const { session: open, openSession: setOpen } = useOpen()
  const [trees, setTrees] = useState<Record<string, Run[]>>({})
  const [filter, setFilter] = useState<RunFilter>('all')
  const [nowMs, setNowMs] = useState(() => Date.now())

  const safeSessions = useMemo(() => (Array.isArray(sessions) ? sessions : []), [sessions])
  const hasRunning = useMemo(() => safeSessions.some((s) => STATUS(s?.status) === 'running'), [safeSessions])

  useEffect(() => {
    if (!hasRunning) return
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [hasRunning])

  // A run the address names opens on arrival: Home's "{n} failed" sends
  // /work?session=<id> (./watch). The param is then dropped, the way Chat drops
  // `?thread=`, so the address is the board's own again and a reload does not
  // reopen a run the reader has moved on from.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(KEY)) return
    const id = asked(url.search)
    url.searchParams.delete(KEY)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    if (id) setOpen(id)
  }, [setOpen])

  useEffect(() => {
    if (open) reload()
  }, [open, reload])

  // One `tree` read per root that says it has children. Roots without a
  // fan-out are left alone, so an org of solo runs costs exactly one request.
  useEffect(() => {
    const swarms = safeSessions.filter((s) => (s?.children ?? 0) > 0)
    if (!swarms.length) return
    const stop = new AbortController()
    const snapshotNow = Date.now()
    void Promise.all(
      swarms.map((s) =>
        ai.sessions
          .tree(s.id, { signal: stop.signal })
          .then((node) => [s.id, kidsOf(node, t, snapshotNow)] as const)
          .catch(() => [s.id, [] as Run[]] as const),
      ),
    ).then((pairs) => {
      if (!stop.signal.aborted) setTrees(Object.fromEntries(pairs))
    })
    return () => stop.abort()
  }, [ai, safeSessions, t])

  const runs = useMemo(
    () => safeSessions.map((s) => toRun(s, t, nowMs, trees[s.id] ?? [])),
    [safeSessions, trees, t, nowMs],
  )

  const counts = useMemo(() => {
    let running = 0
    let review = 0
    let done = 0
    let failed = 0
    for (const r of runs) {
      if (r.status === 'running') running += 1
      else if (r.status === 'paused') review += 1
      else if (r.status === 'done') done += 1
      else if (r.status === 'error') failed += 1
    }
    return { all: runs.length, running, review, done, failed }
  }, [runs])

  const visibleRuns = useMemo(() => runs.filter((r) => matchesFilter(r.status, filter)), [runs, filter])

  const [composing, setComposing] = useState(false)
  const didAutoSelectRef = useRef(false)

  useEffect(() => {
    if (open) setComposing(false)
  }, [open])

  // Auto-select the first active (or most recent) run on mount/load so /work opens directly to live activity.
  useEffect(() => {
    if (didAutoSelectRef.current || composing || open || runs.length === 0) return
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has(KEY)) return
    const latest = runs.find((r) => r.status === 'running') ?? runs[0]
    if (latest) {
      didAutoSelectRef.current = true
      setOpen(latest.id)
    }
  }, [composing, open, runs, setOpen])

  const filterPills: ReadonlyArray<{ id: RunFilter; label: string; count: number }> = [
    { id: 'all', label: t('All'), count: counts.all },
    { id: 'running', label: t('Running'), count: counts.running },
    { id: 'review', label: t('Needs review'), count: counts.review },
    { id: 'done', label: t('Done'), count: counts.done },
    { id: 'failed', label: t('Failed'), count: counts.failed },
  ]

  return (
    // A COLUMN THAT BECOMES A ROW, never a wrapped row. `flexWrap` put the
    // board on one line and the pane on the next, and a wrapped container with
    // a definite height distributes its free space across the LINES
    // (`align-content: stretch`): measured at 960, two lines of 424px each, so
    // the 220px board reserved 424 and the pane began 204px below the bottom of
    // the list. That gap is what made /dev read as broken. Stating the axis
    // per breakpoint is the same layout with no line-box arithmetic in it.
    <YStack flex={1} minH={0} width="100%" overflow="hidden" $lg={{ flexDirection: 'row' }}>
      <YStack
        // AN EMPTY BOARD DRAWS NOTHING ACROSS THE TOP once settled. While loading,
        // keep it mounted so the calm shimmer skeleton shows without layout jump.
        display={runs.length === 0 && !loading ? 'none' : 'flex'}
        width="100%"
        height={220}
        $sm={{ height: 248 }}
        shrink={0}
        borderBottomWidth={1}
        $lg={{
          display: 'flex',
          width: 300,
          shrink: 0,
          height: '100%',
          borderBottomWidth: 0,
          borderRightWidth: 1,
        }}
        borderColor="$borderColor"
      >
        <YStack gap="$2" px="$3" pt="$3" pb="$2.5" borderBottomWidth={1} borderColor="$edge" shrink={0}>
          <XStack items="center" justify="space-between" gap="$2">
            <XStack items="center" gap="$2" minW={0} flex={1}>
            <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
              {t('Runs')}
            </Text>
            <XStack
              data-slot="work-run-count"
              items="center"
              gap="$1.5"
              px="$2"
              py={2}
              rounded="$10"
              bg="$panel"
              borderWidth={1}
              borderColor="var(--border-strong)"
              shrink={0}
            >
              {counts.running > 0 ? (
                <YStack data-motion="pulse" width={6} height={6} rounded={9999} bg="var(--state-success)" shrink={0} aria-hidden />
              ) : null}
              <Text fontFamily="$mono" fontSize="$1" fontWeight="500" color="$ink" fontVariant={['tabular-nums']}>
                {counts.running > 0 ? t('{count} live', { count: counts.running }) : String(counts.all)}
              </Text>
            </XStack>
            </XStack>
            <Box
              render={<button type="button" />}
              data-slot="work-new-run"
              aria-label={t('New run')}
              onClick={() => {
                didAutoSelectRef.current = true
                setComposing(true)
                setOpen(null)
              }}
              px="$2"
              py="$1"
              minH={26}
              $max-sm={{ minH: 44, px: '$2.5' }}
              rounded="$2"
              borderWidth={1}
              borderColor="var(--border-strong)"
              bg={composing && !open ? '$panel' : 'transparent'}
              display="inline-flex"
              items="center"
              gap="$1"
              shrink={0}
              cursor="pointer"
              hoverStyle={{ bg: '$hover' }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            >
              <Plus size={12} color="var(--foreground)" aria-hidden />
              <Text fontSize="$1" fontWeight="500" color="$ink" numberOfLines={1}>
                {t('New run')}
              </Text>
            </Box>
          </XStack>

          <XStack data-slot="work-status-filters" items="center" gap="$1" flexWrap="wrap" role="group" aria-label={t('Filter runs by status')}>
            {filterPills.map((pill) => {
              const active = filter === pill.id
              return (
                <Box
                  key={pill.id}
                  render={<button type="button" />}
                  aria-pressed={active}
                  onClick={() => setFilter(pill.id)}
                  px="$2"
                  py="$1"
                  rounded="$10"
                  minH={26}
                  $max-sm={{ minH: 44, px: '$2.5' }}
                  display="inline-flex"
                  items="center"
                  gap="$1"
                  cursor="pointer"
                  borderWidth={1}
                  borderColor={active ? 'var(--border-strong)' : '$edge'}
                  bg={active ? '$raised' : 'transparent'}
                  hoverStyle={{ bg: active ? '$raised' : '$hover' }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                >
                  <Text fontSize="$1" fontWeight={active ? '600' : '500'} color={active ? '$ink' : '$quiet'}>
                    {pill.label}
                  </Text>
                  {pill.count > 0 && pill.id !== 'all' ? (
                    <Text fontFamily="$mono" fontSize="$1" color="$soft" fontVariant={['tabular-nums']}>
                      {pill.count}
                    </Text>
                  ) : null}
                </Box>
              )
            })}
          </XStack>
        </YStack>

        {loading && runs.length === 0 ? (
          <RunsSkeleton label={t('Loading runs')} />
        ) : (
          <AgentBoard
            runs={visibleRuns}
            active={open ?? undefined}
            onOpen={(id) => {
              setComposing(false)
              setOpen(id)
            }}
            empty={
              runs.length > 0 && filter !== 'all' ? (
                <YStack gap="$2" items="flex-start">
                  <Text fontSize="$2" color="$soft">
                    {t('No runs in this state.')}
                  </Text>
                  <Box
                    render={<button type="button" />}
                    onClick={() => setFilter('all')}
                    px="$2.5"
                    py="$1.5"
                    minH={32}
                    $max-sm={{ minH: 44 }}
                    rounded="$2"
                    borderWidth={1}
                    borderColor="var(--border-strong)"
                    bg="transparent"
                    hoverStyle={{ bg: '$hover' }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    cursor="pointer"
                  >
                    <Text fontSize="$1" fontWeight="500" color="$ink">
                      {t('Show all runs')}
                    </Text>
                  </Box>
                </YStack>
              ) : (
                <Text fontSize="$2" color="$soft">
                  {t('No runs yet. Start one and it appears here.')}
                </Text>
              )
            }
          />
        )}
      </YStack>
      {/*
        `minWidth={0}` is load-bearing. A flex child's default `min-width: auto`
        refuses to shrink below its content, so the pane kept its desktop width
        on a phone and the install cards' link row reached 546px inside a 390px
        viewport — off the side, and unreachable, because `overflow-x: clip` on
        body hides it rather than scrolling to it.
      */}
      {/* The pane takes what the board leaves — the rest of the column below
          $lg, the rest of the row above it. `minHeight: 0` is what lets a
          scrolling child inside it actually scroll instead of growing. */}
      <YStack width="100%" flex={1} minW={0} minH={0} overflow="hidden" $lg={{ width: 'auto' }}>
        {open ? <Watch key={open} id={open} /> : loading && runs.length === 0 ? (
          <YStack flex={1} minH={0} p="$5" gap="$4" role="status" aria-busy={true} aria-label={t('Loading runs')}>
            <Skeleton layout="block" width={200} height={20} rounded="$2" />
            <YStack gap="$2.5" p="$4" rounded="$4" borderWidth={1} borderColor="$edge" bg="$panel">
              <Skeleton layout="block" width="55%" height={14} rounded="$2" />
              <Skeleton layout="block" width="84%" height={12} rounded="$2" />
              <Skeleton layout="block" width="68%" height={12} rounded="$2" />
            </YStack>
          </YStack>
        ) : composing ? (
          <Idle runs={0} />
        ) : (idle ?? <Idle runs={runs.length} />)}
      </YStack>
    </YStack>
  )
}

/**
 * Nothing is open. What that MEANS depends on whether there is anything to
 * open: with runs on the board it is an instruction, and with none the pane is
 * the whole width (the board draws nothing) and the honest thing to show is the
 * home — the composer and what to do next.
 */
function Idle({ runs }: { runs: number }) {
  const { t } = useI18n()
  if (runs === 0) {
    return (
      <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden">
        <YStack
          width="100%"
          maxW={640}
          mx="auto"
          px="$5"
          pt="$10"
          gap="$4"
        >
          <YStack gap="$2">
            <Text render="h1" fontSize="$7" fontWeight="500" color="$ink">
              {t('Start a run')}
            </Text>
            <Text fontSize="$3" color="$soft" maxW={520}>
              {t('Give an agent a task. Its plan, progress, and output will appear here.')}
            </Text>
          </YStack>
          <Start />
          <Text fontSize="$1" color="$soft">
            {t('Runs stay visible in Working so you can inspect or steer them at any time.')}
          </Text>
        </YStack>
      </YStack>
    )
  }
  return (
    <YStack flex={1} items="center" justify="center" p="$6">
      <Text fontSize="$3" color="$soft">
        {t('Pick a run to watch it work.')}
      </Text>
    </YStack>
  )
}

/**
 * One run: its steps on the left, whatever it produced on the right.
 *
 * KEYED BY THE RUN at the call site, so opening a different one REMOUNTS — the
 * live tail, the draft and the last confirmation all start empty rather than
 * carrying the previous run's.
 */
function Watch({ id }: { id: string }) {
  const { t } = useI18n()
  const ai = useAi()
  const { session } = useSession(id)
  const [live, setLive] = useState<SessionEvent[]>([])
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState<string | null>(null)

  // The live feed, narrowed to this run's tree. There is no per-session stream
  // — `/v1/agents/sessions/{id}/stream` does not exist — so `root` is how one
  // run is watched, and it brings its sub-agents' turns with it.
  useEffect(() => {
    const stop = new AbortController()
    void (async () => {
      try {
        for await (const frame of ai.sessions.stream({ root: id }, { signal: stop.signal })) {
          if (stop.signal.aborted) return
          if (frame.kind === 'event') setLive((prev) => [...prev, frame.event])
        }
      } catch {
        // A dropped feed is ordinary. What is on screen stands.
      }
    })()
    return () => stop.abort()
  }, [ai, id])

  // The 50 the detail carries, then everything the feed added, deduped by seq —
  // the two overlap whenever a turn lands between the read and the subscribe.
  const events = useMemo(() => {
    const seen = new Map<string, SessionEvent>()
    for (const [i, e] of [...(session?.recentEvents ?? []), ...live].entries()) {
      seen.set(e.seq !== undefined ? `s${e.seq}` : (e.id ?? `i${i}`), e)
    }
    return [...seen.values()].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
  }, [session?.recentEvents, live])

  const { steps: shown, message } = useMemo(() => steps(events), [events])
  const status = STATUS(session?.status)
  const finished = status === 'done' || status === 'error'
  const [tickNow, setTickNow] = useState(() => Date.now())
  useEffect(() => {
    if (status !== 'running') return
    const timer = window.setInterval(() => setTickNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [status])
  const elapsed = formatDuration(
    session?.startedAt || session?.createdAt,
    status === 'running' ? undefined : (session?.endedAt || session?.updatedAt),
    tickNow,
  )

  const steer = useCallback(
    async (command: Command) => {
      setNote(null)
      try {
        await ai.sessions.steer(id, command)
        setNote(
          command === 'pause'
            ? t('Pause queued — it takes effect between turns')
            : command === 'resume'
              ? t('Resume queued — it takes effect between turns')
              : command === 'stop'
                ? t('Stop queued — it takes effect between turns')
                : t('Sent — the agent reads it between turns'),
        )
      } catch {
        setNote(
          command === 'pause'
            ? t('Could not pause this run')
            : command === 'resume'
              ? t('Could not resume this run')
              : command === 'stop'
                ? t('Could not stop this run')
                : t('Could not reach this run'),
        )
      }
    },
    [ai, id, t],
  )

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    setNote(null)
    try {
      await ai.sessions.steer(id, 'message', { message: text })
      setNote(t('Sent — the agent reads it between turns'))
    } catch {
      setNote(t('Could not reach this run'))
    }
  }, [ai, draft, id, t])

  return (
    <YStack flex={1} minH={0} minW={0} overflow="hidden" $xl={{ flexDirection: 'row' }}>
      <YStack flex={1} minH={0} minW={0} overflow="hidden">
        <ChannelHeader name={session?.title || session?.agent || id} artifacts={0}>
          <XStack items="center" gap="$2">
            <XStack items="center" gap="$1.5" px="$2" py={2} rounded="$10" bg="$panel" borderWidth={1} borderColor="$edge">
              {status === 'running' ? (
                <YStack data-motion="pulse" width={6} height={6} rounded={9999} bg="var(--state-success)" shrink={0} aria-hidden />
              ) : null}
              <Text fontSize="$1" fontWeight="500" color={status === 'error' ? 'var(--state-error)' : '$quiet'}>
                {statusLabel(status, t)}
              </Text>
            </XStack>
            {elapsed ? (
              <Text fontFamily="$mono" fontSize="$1" color="$quiet" fontVariant={['tabular-nums']}>
                {elapsed}
              </Text>
            ) : null}
          </XStack>
        </ChannelHeader>
        {/* How far, under the name. `Bar` draws nothing when the run says
            nothing, so this costs a row only once there is something to say —
            and it is the SAME bar the home and the chat draw. */}
        <XStack px="$4" pb="$2">
          <Bar run={session} />
        </XStack>
        <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden" p="$4" gap="$4">
          <ProgressBlock steps={shown} done={finished}>
            {message ? (
              <Text fontSize="$4" color="$ink">
                {message}
              </Text>
            ) : null}
          </ProgressBlock>
        </YStack>
        <YStack p="$3" gap="$2" borderTopWidth={1} borderColor="$borderColor" shrink={0}>
          <Steer
            onCommand={(c) => void steer(c)}
            withhold={finished ? ['pause', 'resume', 'stop'] : []}
            note={note}
          />
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={() => void send()}
            placeholder={t('Steer this run…')}
            label={t('Steer this run')}
          />
        </YStack>
      </YStack>

      {/* The reserved right pane. Its tabs are the three things a run produces;
          each is honest-empty until the run has actually produced one. */}
      <YStack
        width="100%"
        height={190}
        $max-sm={{ height: 168 }}
        shrink={0}
        p="$3"
        borderTopWidth={1}
        $xl={{ width: 360, height: '100%', shrink: 0, borderTopWidth: 0, borderLeftWidth: 1 }}
        borderColor="$borderColor"
        overflow="hidden"
      >
        <Pane
          tabs={[
            { id: 'code', label: t('Code'), kind: 'code', content: <Nothing what="changes" /> },
            { id: 'view', label: t('View'), kind: 'view', content: <Nothing what="preview" /> },
            { id: 'canvas', label: t('Canvas'), kind: 'canvas', content: <Nothing what="summary" /> },
          ]}
        />
      </YStack>
    </YStack>
  )
}

function Nothing({ what }: { what: 'changes' | 'preview' | 'summary' }) {
  const { t } = useI18n()
  const line =
    what === 'changes'
      ? t('This run has produced no changes yet.')
      : what === 'preview'
        ? t('This run has produced no preview yet.')
        : t('This run has produced no summary yet.')
  return (
    <Text fontSize="$2" color="$soft">
      {line}
    </Text>
  )
}

/**
 * The board, and the session its reads need.
 *
 * SPLIT so the hooks below never run for a reader with none: sessions and their
 * trees are the org's, answered 403 without a session, and a hook cannot be
 * called conditionally — so the condition is a component boundary rather than
 * an `if` the rules forbid.
 */
export function Work({ idle }: { idle?: ReactNode }) {
  const { t } = useI18n()
  const { user, isLoading } = useIam()
  if (isLoading) {
    return <WorkWorkspaceSkeleton label={t('Loading runs')} />
  }
  if (!user) {
    return (
      <YStack flex={1} items="center" justify="center" p="$6" gap="$2">
        <Text render="h1" fontSize="$5" fontWeight="600" color="$ink">
          {t('Agents')}
        </Text>
        <Text fontSize="$3" color="$soft" text="center">
          {t('Sign in to watch your agents work.')}
        </Text>
        <Button size="sm" variant="primary" rounded="$3" minH={36} $max-sm={{ minH: 44 }} mt="$2" onClick={() => enter(LOGIN)}>
          {t('Sign in')}
        </Button>
      </YStack>
    )
  }
  return <Watching idle={idle} />
}
