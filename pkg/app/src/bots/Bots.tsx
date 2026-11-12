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
// press opens, with the panel over it.

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
import { refusal, type Notice } from './refusal'
import type { Pending } from './said'
import { Panel } from './Panel'
import { Make } from './Make'
import { ALWAYS, ONCE } from './api'
import { instant } from './time'
import { FLOOR, GROUND, LINE } from './ink'

/** The address names the open bot, so a reload, a link and Share all reopen it. */
const PARAM = 'bot'

const named = (): string | null =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(PARAM)

function address(name: string | null): void {
  const url = new URL(window.location.href)
  if (name) url.searchParams.set(PARAM, name)
  else url.searchParams.delete(PARAM)
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

/** The newest run of each bot, from the org's feed (newest first). */
function lastOf(feed: readonly AgentRun[]): Map<string, AgentRun> {
  const out = new Map<string, AgentRun>()
  for (const r of feed) if (r.agent && !out.has(r.agent)) out.set(r.agent, r)
  return out
}


export function Bots({ foot = true }: {
  /** The reader and the other apps at the roster's foot. A host whose own chrome
   *  already holds both (hanzo.team's rail and bar) passes false. */
  foot?: boolean
} = {}) {
  const { t } = useI18n()
  const { client, ready } = useAi()
  const { user, isAuthenticated } = useIam()
  const live = Boolean(client && isAuthenticated && ready)

  const [bots, setBots] = useState<Agent[] | null>(null)
  const [feed, setFeed] = useState<AgentRun[]>([])
  const [unread, setUnread] = useState<string | null>(null)
  const [name, setName] = useState<string | null>(null)
  // The phone shows one column: the roster, or the thread once one is opened.
  const [inside, setInside] = useState(false)
  const [making, setMaking] = useState(false)
  // The panel beside the thread, kept per browser; over the thread below a laptop.
  const [side, setSide] = useKept('hanzo.bots.side', true)
  const [over, setOver] = useState(false)

  // From a tablet up the thread stands beside the roster, so the bot it shows is
  // the open one; on a phone nothing is open until one is pressed.
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const asked = named()
    setName(asked)
    setInside(Boolean(asked))
    const query = window.matchMedia('(min-width: 768px)')
    const on = () => setWide(query.matches)
    on()
    query.addEventListener('change', on)
    return () => query.removeEventListener('change', on)
  }, [])

  const read = useCallback(async () => {
    if (!client) return
    const [list, runs] = await Promise.allSettled([client.agents.list(), client.agents.runs({ limit: 200 })])
    if (list.status === 'fulfilled') {
      setBots(list.value)
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

  // The open bot: the one the address names, else the one last spoken to, else the first.
  const bot = useMemo<Agent | null>(() => {
    if (!bots?.length) return null
    const asked = name ? bots.find((b) => b.name === name) : undefined
    if (asked) return asked
    const recent = feed.find((r) => r.agent && bots.some((b) => b.name === r.agent))
    return bots.find((b) => b.name === recent?.agent) ?? bots[0]
  }, [bots, name, feed])

  const pick = useCallback((next: string) => {
    setName(next)
    setInside(true)
    setOver(false)
    address(next)
  }, [])

  const back = useCallback(() => {
    setInside(false)
    setOver(false)
    address(null)
  }, [])

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
      // The route answers newest first; a thread reads down to the newest.
      setRuns([...rows].sort((a, b) => (instant(a.createdAt) ?? 0) - (instant(b.createdAt) ?? 0)))
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
      const turn = ++asking.current
      setNotice(null)
      setWrong(null)
      setPending({ input, at: Date.now() })
      try {
        const ran = await client.agents.run(bot.name, input)
        if (turn === asking.current) setRuns((rs) => [...(rs ?? []), ran])
        return true
      } catch (e) {
        // A thread since left: its words are not handed to the one now open.
        if (turn !== asking.current) return true
        const no = refusal(e, t)
        if (no) {
          setNotice(no)
          return false
        }
        // A run that reached its model and failed is recorded (502, the run as
        // its body); the thread reads it back. Anything else never arrived.
        const recorded = (e as { status?: unknown } | null)?.status === 502
        if (recorded) await history(bot.name).catch(() => undefined)
        setWrong(say(e, bot.name, 'save', t))
        return recorded
      } finally {
        if (turn === asking.current) setPending(null)
        void read()
      }
    },
    [client, bot, history, read, t],
  )

  /** Runs on its schedule, or only when asked. The record is the answer. */
  const schedule = useCallback(
    async (on: boolean) => {
      if (!client || !bot) return
      const saved = await client.agents.update(bot.name, { executionMode: on ? ALWAYS : ONCE })
      setBots((all) => (all ?? []).map((b) => (b.name === saved.name ? { ...b, ...saved } : b)))
    },
    [client, bot],
  )

  const made = useCallback(
    async (agent: Agent) => {
      setMaking(false)
      setBots((all) => [...(all ?? []).filter((b) => b.name !== agent.name), agent])
      pick(agent.name)
      await read()
    },
    [pick, read],
  )

  const panel = bot ? (
    <Panel
      key={bot.name}
      bot={bot}
      onClose={() => {
        setSide(false)
        setOver(false)
      }}
      onSchedule={schedule}
    />
  ) : null

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
        $max-md={{ width: '100%', borderRightWidth: 0, display: inside ? 'none' : 'flex' }}
      >
        <Roster
          bots={bots}
          last={last}
          open={wide || inside ? open : null}
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
        $max-md={{ display: inside ? 'flex' : 'none' }}
      >
        <Thread
          bot={bot}
          bots={bots ?? []}
          runs={runs}
          pending={pending}
          notice={notice}
          wrong={wrong}
          side={side}
          live={live}
          onSend={send}
          onDismiss={() => setNotice(null)}
          onSide={() => {
            // Beside the thread from a laptop up; over it below one.
            if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches) setSide(!side)
            else setOver(!over)
          }}
          onBack={back}
          onMake={() => setMaking(true)}
        />
      </YStack>

      {side && panel ? (
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

      {over && panel ? (
        <YStack
          data-parity-key="bots.panel.over"
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
          $xl={{ display: 'none' }}
        >
          {panel}
        </YStack>
      ) : null}

      {making ? <Make onDone={made} onCancel={() => setMaking(false)} /> : null}
    </XStack>
  )
}
