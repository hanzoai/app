'use client'

// The Bots app: make a bot, open it, talk to it.
//
// Three columns, as the desktop app draws them: the roster (the bots as a grid
// of faces, then the rest with their last word, then you), the thread with the
// open bot, and the panel of what that bot has. Every row, message and switch is
// a platform record — `/v1/agents` and the runs it records — and a section with
// nothing behind it is not drawn.
//
// The same component is the app on hanzo.bot (hanzo.ai's /bots) and on
// hanzo.team, so a bot made in one is in the other: one list, one thread, one
// API, read with the reader's own token.
//
// Below a tablet the columns are one at a time: the roster, then the thread a
// press opens (a step in the history, so Back returns to the roster), with the
// panel over it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Agent, AgentRun } from '@hanzo/ai'
import { useIam } from '@hanzo/iam/react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { useAi } from '../lib/ai'
import { useKept } from '../kept'
import { say } from '../failure'
import { Roster } from './Roster'
import { Thread } from './Thread'
import { recordedRun, refusal, type Notice } from './refusal'
import type { Pending } from './said'
import { Panel } from './Panel'
import { Make } from './Make'
import { ALWAYS, ONCE, PARAM } from './api'
import { instant } from './time'
import { FLOOR, GROUND, LINE } from './ink'


const named = (): string | null =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(PARAM)

/** Writes the open bot into the address: a new step when a phone enters a thread, else in place. */
function address(name: string | null, step: boolean): void {
  const url = new URL(window.location.href)
  if (name) url.searchParams.set(PARAM, name)
  else url.searchParams.delete(PARAM)
  const to = `${url.pathname}${url.search}${url.hash}`
  // Null, not the current state: Next's router stamps its own entries and syncs
  // only a write that does not carry its stamp.
  if (step) window.history.pushState(null, '', to)
  else window.history.replaceState(null, '', to)
}

/** The newest run of each bot, from the org's feed (newest first). */
function lastOf(feed: readonly AgentRun[]): Map<string, AgentRun> {
  const out = new Map<string, AgentRun>()
  for (const r of feed) if (r.agent && !out.has(r.agent)) out.set(r.agent, r)
  return out
}

/** Runs by id, oldest first: a late read never drops a run this page already drew. */
function merged(a: readonly AgentRun[], b: readonly AgentRun[]): AgentRun[] {
  const by = new Map<string, AgentRun>()
  for (const r of [...a, ...b]) by.set(r.id, r)
  return [...by.values()].sort((x, y) => (instant(x.createdAt) ?? 0) - (instant(y.createdAt) ?? 0))
}

/** Whether a media query holds, kept current. False until mounted. */
function useWide(query: string): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const q = window.matchMedia(query)
    const set = () => setOn(q.matches)
    set()
    q.addEventListener('change', set)
    return () => q.removeEventListener('change', set)
  }, [query])
  return on
}

export function Bots({
  foot = true,
  bot: held,
  onBot,
}: {
  /** The reader and the other apps at the roster's foot. A host whose own chrome
   *  already holds both (hanzo.team's rail and bar) passes false. */
  foot?: boolean
  /** The open bot, when the host's router holds the address (`?bot=`); with it,
   *  `onBot` is how a press or Back moves it. Absent, the app keeps the address. */
  bot?: string | null
  onBot?: (name: string | null, step: boolean) => void
} = {}) {
  const { t } = useI18n()
  const { client, ready } = useAi()
  const { user, isAuthenticated } = useIam()
  const live = Boolean(client && isAuthenticated && ready)
  const hosted = held !== undefined

  const [bots, setBots] = useState<Agent[] | null>(null)
  // The roster has been read once, so a name it lacks is not this org's.
  const [listed, setListed] = useState(false)
  const [feed, setFeed] = useState<AgentRun[]>([])
  const [unread, setUnread] = useState<string | null>(null)
  const [own, setOwn] = useState<string | null>(null)
  const [making, setMaking] = useState(false)
  // The panel beside the thread, kept per browser; over the thread below a laptop.
  const [side, setSide] = useKept('hanzo.bots.side', true)
  const [over, setOver] = useState(false)
  const wide = useWide('(min-width: 768px)')
  const laptop = useWide('(min-width: 1280px)')

  // The address, read on arrival and on every Back and Forward.
  useEffect(() => {
    if (hosted) return
    const read = () => setOwn(named())
    read()
    window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [hosted])

  const name = hosted ? (held ?? null) : own
  const move = useCallback(
    (next: string | null, step: boolean) => {
      if (hosted) return onBot?.(next, step)
      setOwn(next)
      address(next, step)
    },
    [hosted, onBot],
  )

  const reading = useRef(0)
  const read = useCallback(async () => {
    if (!client) return
    const turn = ++reading.current
    const [list, runs] = await Promise.allSettled([client.agents.list(), client.agents.runs({ limit: 200 })])
    if (turn !== reading.current) return
    if (list.status === 'fulfilled') {
      setBots(list.value)
      setListed(true)
      setUnread(null)
    } else {
      setBots((b) => b ?? [])
      setUnread(say(list.reason, t('your bots'), 'read', t))
    }
    if (runs.status === 'fulfilled') setFeed(runs.value)
  }, [client, t])

  useEffect(() => {
    if (live) void read()
  }, [live, read])

  const last = useMemo(() => lastOf(feed), [feed])

  // The open bot is the one the address names. With none — or one this org does
  // not keep — a laptop opens the one last spoken to (else the first) and writes
  // it into the address, so it stays open while the feed moves; a phone stays on
  // the roster.
  const bot = useMemo<Agent | null>(() => (name && bots?.find((b) => b.name === name)) || null, [bots, name])
  useEffect(() => {
    if (!bots || bot) return
    if (name) {
      if (listed && !bots.some((b) => b.name === name)) move(null, false)
      return
    }
    if (!wide || !bots.length) return
    const recent = feed.find((r) => r.agent && bots.some((b) => b.name === r.agent))?.agent
    move(recent ?? bots[0].name, false)
  }, [bots, bot, name, listed, wide, feed, move])

  // Whether this page stepped into the thread, so Back can step out of it.
  const stepped = useRef(false)
  const pick = useCallback(
    (next: string) => {
      setOver(false)
      // A phone steps into the thread, so Back returns to the roster.
      const step = !wide && !name
      if (step) stepped.current = true
      move(next, step)
    },
    [move, wide, name],
  )

  const back = useCallback(() => {
    setOver(false)
    if (stepped.current) {
      stepped.current = false
      window.history.back()
    } else move(null, false)
  }, [move])

  // ── the open bot's thread ────────────────────────────────────────────────
  const [runs, setRuns] = useState<AgentRun[] | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [wrong, setWrong] = useState<string | null>(null)
  const open = bot?.name ?? null
  const asking = useRef(0)

  const history = useCallback(
    async (who: string, signal?: AbortSignal) => {
      if (!client) return
      const rows = await client.agents.runs({ agent: who, limit: 200 }, signal ? { signal } : undefined)
      if (!signal?.aborted) setRuns((drawn) => merged(drawn ?? [], rows))
    },
    [client],
  )

  useEffect(() => {
    // Another bot is open: whatever the last one's run answers, it is not this thread's.
    asking.current += 1
    setRuns(null)
    setPending(null)
    setNotice(null)
    setWrong(null)
    if (!client || !open) return
    const stop = new AbortController()
    history(open, stop.signal).catch((e) => {
      if (stop.signal.aborted) return
      setRuns([])
      setWrong(say(e, t('this conversation'), 'read', t))
    })
    return () => stop.abort()
  }, [client, open, history, t])

  /**
   * Says `input` to the open bot. Answers whether the platform recorded it: a
   * message it refused, or never received, is handed back to the composer so
   * the thread holds only what was said.
   */
  const send = useCallback(
    async (input: string): Promise<boolean> => {
      if (!client || !bot) return false
      const who = bot.name
      const turn = ++asking.current
      const now = () => turn === asking.current
      setNotice(null)
      setWrong(null)
      setPending({ input, at: Date.now() })
      try {
        const ran = await client.agents.run(who, input)
        if (now()) setRuns((rs) => merged(rs ?? [], [ran]))
        return true
      } catch (e) {
        // A thread since left: its words are not handed to the one now open.
        if (!now()) return true
        const no = refusal(e, who, Date.now(), t, (bot as Agent & { period?: string }).period)
        if (no) {
          setNotice(no)
          return false
        }
        // A run that reached its model and failed is recorded and comes back as
        // the body; it is drawn with its own error. Anything else never arrived.
        const ran = recordedRun<AgentRun>(e)
        if (ran) {
          setRuns((rs) => merged(rs ?? [], [ran]))
          return true
        }
        setWrong(say(e, t('your message to {name}', { name: who }), 'save', t))
        return false
      } finally {
        if (now()) setPending(null)
        void read()
      }
    },
    [client, bot, read, t],
  )

  /**
   * Runs on its schedule, or only when asked. The platform keeps no schedule for
   * a bot that runs only when asked, so turning it back on states the schedule.
   */
  // The schedule each bot last had on this page. The platform keeps none for a bot
  // that runs only when asked, so a schedule turned off is held here to turn back on.
  const [kept, setKept] = useState<Record<string, string>>({})
  const schedule = useCallback(
    async (on: boolean, cron: string) => {
      if (!client || !bot) return
      setKept((k) => ({ ...k, [bot.name]: cron }))
      const saved = await client.agents.update(bot.name, on ? { executionMode: ALWAYS, schedule: cron } : { executionMode: ONCE })
      setBots((all) => (all ?? []).map((b) => (b.name === saved.name ? { ...b, ...saved, schedule: saved.schedule } : b)))
    },
    [client, bot],
  )

  /** Deletes the open bot and every run recorded against it. */
  const remove = useCallback(async () => {
    if (!client || !bot) return
    await client.agents.delete(bot.name)
    setBots((all) => (all ?? []).filter((b) => b.name !== bot.name))
    setOver(false)
    stepped.current = false
    move(null, false)
    await read()
  }, [client, bot, move, read])

  const made = useCallback(
    async (agent: Agent) => {
      setMaking(false)
      setBots((all) => [...(all ?? []).filter((b) => b.name !== agent.name), agent])
      const step = !wide && !name
      if (step) stepped.current = true
      move(agent.name, step)
      await read()
    },
    [move, read, wide, name],
  )

  // Escape closes the panel over the thread, as it closes any dialog.
  useEffect(() => {
    if (!over) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOver(false)
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [over])

  const close = () => {
    if (laptop) setSide(false)
    setOver(false)
  }
  const panel = bot ? (
    <Panel
      key={bot.name}
      bot={bot}
      kept={kept[bot.name] ?? ''}
      onClose={close}
      onSchedule={schedule}
      onDelete={remove}
      focus={over && !laptop}
    />
  ) : null
  const shown = laptop ? side : over

  return (
    <XStack data-parity-key="bots.window" width="100%" height="100%" overflow="hidden" bg={FLOOR} position="relative">
      <YStack
        data-parity-key="bots.roster"
        width={279}
        shrink={0}
        height="100%"
        bg={FLOOR}
        borderRightWidth={1}
        borderColor={LINE}
        $max-md={{ width: '100%', borderRightWidth: 0, display: bot ? 'none' : 'flex' }}
      >
        <Roster
          bots={bots}
          last={last}
          open={open}
          unread={unread}
          me={foot ? user : null}
          onPick={pick}
          onMake={() => setMaking(true)}
          disabled={!live}
        />
      </YStack>

      <YStack
        data-parity-key="bots.center"
        flex={1}
        minW={0}
        height="100%"
        bg={GROUND}
        $max-md={{ display: bot ? 'flex' : 'none' }}
      >
        <Thread
          bot={bot}
          bots={bots ?? []}
          runs={runs}
          pending={pending}
          notice={notice}
          wrong={wrong}
          side={shown}
          live={live}
          loaded={bots !== null}
          onSend={send}
          onDismiss={() => setNotice(null)}
          onSide={() => (laptop ? setSide(!side) : setOver(!over))}
          onBack={back}
          onMake={() => setMaking(true)}
        />
      </YStack>

      {laptop && side && panel ? (
        <YStack
          data-parity-key="bots.panel"
          width={319}
          shrink={0}
          height="100%"
          bg={GROUND}
          borderLeftWidth={1}
          borderColor={LINE}
          $max-xl={{ display: 'none' }}
        >
          {panel}
        </YStack>
      ) : null}

      {over && panel && !laptop ? (
        <YStack
          data-parity-key="bots.panel.over"
          role="dialog"
          aria-modal
          aria-label={bot?.name}
          position="absolute"
          t={0}
          r={0}
          b={0}
          width={319}
          maxW="100%"
          z={10}
          bg={GROUND}
          borderLeftWidth={1}
          borderColor={LINE}
          boxShadow="var(--shadow-floating)"
        >
          {panel}
        </YStack>
      ) : null}

      {making ? <Make onDone={made} onCancel={() => setMaking(false)} /> : null}
    </XStack>
  )
}
