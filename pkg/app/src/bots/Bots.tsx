'use client'

// The Bots app on hanzo.bot and hanzo.team:
// - Starts every workspace with up to 1 Primary Bot (default name `"hanzo"`, Layer 0)
//   who directs all subordinate bots (`agent_<name>`) and layered Bot Groups (`group_<name>`).
// - Supports multi-layer Bot Groups (`?bot=group:<name>`) with pluggable Leader,
//   Lux Quasar (Polaris/Aurora/Pulsar SHA3-384 dual-certificate finality), Majority,
//   Weighted, Unanimous, Kai, and Custom policies.
// - Connects @hanzo to Slack with channel sync & routing, real Connectors, and
//   dedicated Desktop Sandbox Computers with full GUI Computer Use for every bot.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Agent, AgentRun } from '@hanzo/ai'
import { useIam } from '@hanzo/iam/react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Gutter } from '@hanzo/build'
import { ENSO, useAi } from '../lib/ai'
import { SIDE } from '../ground'
import { useKept } from '../kept'
import { useSpan } from '../span'
import { say } from '../failure'
import { ROSTER_WIDTH_MAX, ROSTER_WIDTH_MIN } from './grid'
import { Roster } from './Roster'
import { Thread } from './Thread'
import { GroupPanel, GroupThread, MakeGroupDialog } from './Groups'
import { recordedRun, refusal, type Notice } from './refusal'
import type { Pending } from './said'
import { Panel } from './Panel'
import { Make } from './Make'
import {
  ALWAYS,
  ONCE,
  PARAM,
  PRIMARY_BOT,
  bootstrapPrimary,
  deleteGroup,
  groupNameOf,
  isGroupRef,
  listGroups,
  toGroupRef,
  type BotAgent,
  type BotGroup,
} from './api'
import { instant } from './time'
import { FLOOR, GROUND, LINE } from './ink'

const named = (): string | null =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(PARAM)

function address(name: string | null, step: boolean): void {
  const url = new URL(window.location.href)
  if (name) url.searchParams.set(PARAM, name)
  else url.searchParams.delete(PARAM)
  const to = `${url.pathname}${url.search}${url.hash}`
  if (step) window.history.pushState(null, '', to)
  else window.history.replaceState(null, '', to)
}

function lastOf(feed: readonly AgentRun[]): Map<string, AgentRun> {
  const out = new Map<string, AgentRun>()
  for (const r of feed) if (r.agent && !out.has(r.agent)) out.set(r.agent, r)
  return out
}

function merged(a: readonly AgentRun[], b: readonly AgentRun[]): AgentRun[] {
  const by = new Map<string, AgentRun>()
  for (const r of [...a, ...b]) by.set(r.id, r)
  return [...by.values()].sort((x, y) => (instant(x.createdAt) ?? 0) - (instant(y.createdAt) ?? 0))
}

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
  foot?: boolean
  bot?: string | null
  onBot?: (name: string | null, step: boolean) => void
} = {}) {
  const { t } = useI18n()
  const { client, ready } = useAi()
  const { user, isAuthenticated } = useIam()
  const live = Boolean(client && isAuthenticated && ready)
  const hosted = held !== undefined

  const [bots, setBots] = useState<BotAgent[] | null>(null)
  const [groups, setGroups] = useState<BotGroup[]>([])
  const [listed, setListed] = useState(false)
  const [feed, setFeed] = useState<AgentRun[]>([])
  const [unread, setUnread] = useState<string | null>(null)
  const [own, setOwn] = useState<string | null>(null)
  const [making, setMaking] = useState(false)
  const [makingGroup, setMakingGroup] = useState(false)
  const [editingGroup, setEditingGroup] = useState<BotGroup | null>(null)
  const [side, setSide] = useKept('hanzo.bots.side', true)
  const [over, setOver] = useState(false)
  const wide = useWide('(min-width: 768px)')
  const laptop = useWide('(min-width: 1280px)')
  const rosterSpan = useSpan('hanzo.bots.roster.width', SIDE, ROSTER_WIDTH_MIN, ROSTER_WIDTH_MAX)
  const [rosterWidth, setRosterWidth] = useState(SIDE)
  useEffect(() => {
    setRosterWidth(rosterSpan.span)
  }, [rosterSpan.span])

  useEffect(() => {
    if (hosted) return
    const readAddr = () => setOwn(named())
    readAddr()
    window.addEventListener('popstate', readAddr)
    return () => window.removeEventListener('popstate', readAddr)
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

  const bootstrapped = useRef(false)
  const reading = useRef(0)
  const read = useCallback(async () => {
    if (!client) return
    const turn = ++reading.current
    const [list, runs, grps] = await Promise.allSettled([
      client.agents.list(),
      client.agents.runs({ limit: 200 }),
      listGroups(client),
    ])
    if (turn !== reading.current) return
    if (grps.status === 'fulfilled') setGroups(grps.value)
    if (list.status === 'fulfilled') {
      const loaded = list.value as BotAgent[]
      const hasPrimary = loaded.some((b) => b.isPrimary || b.name.toLowerCase() === PRIMARY_BOT)
      if (!hasPrimary && !bootstrapped.current) {
        bootstrapped.current = true
        const seeded = await bootstrapPrimary(client, PRIMARY_BOT, ENSO).catch(() => null)
        if (seeded?.agent) {
          const mergedBots = [seeded.agent, ...loaded.filter((b) => b.name !== seeded.agent.name)]
          setBots(mergedBots)
          setListed(true)
          setUnread(null)
          if (runs.status === 'fulfilled') setFeed(runs.value)
          return
        }
      }
      setBots(loaded)
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

  const activeGroup = useMemo<BotGroup | null>(() => {
    if (!isGroupRef(name)) return null
    const slug = groupNameOf(name!)
    return groups.find((g) => g.name === slug || g.id === slug) ?? null
  }, [groups, name])

  const bot = useMemo<BotAgent | null>(() => {
    if (!name || isGroupRef(name)) return null
    return bots?.find((b) => b.name === name) ?? null
  }, [bots, name])

  useEffect(() => {
    if (!bots || bot || activeGroup) return
    if (name) {
      if (listed) {
        if (isGroupRef(name) && !groups.some((g) => g.name === groupNameOf(name) || g.id === groupNameOf(name))) {
          move(null, false)
        } else if (!isGroupRef(name) && !bots.some((b) => b.name === name)) {
          move(null, false)
        }
      }
      return
    }
    if (!wide || !bots.length) return
    // Start with the workspace's Primary Bot ("hanzo") first so users immediately
    // talk to their primary director bot, falling back to most recent or first bot.
    const primary = bots.find((b) => b.isPrimary) ?? bots.find((b) => b.name.toLowerCase() === PRIMARY_BOT)
    const recent = feed.find((r) => r.agent && bots.some((b) => b.name === r.agent))?.agent
    move(primary?.name ?? recent ?? bots[0].name, false)
  }, [bots, groups, bot, activeGroup, name, listed, wide, feed, move])

  const stepped = useRef(false)
  const pick = useCallback(
    (next: string) => {
      setOver(false)
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
  const openRef = activeGroup ? toGroupRef(activeGroup.name) : (bot?.name ?? null)
  const openBotName = bot?.name ?? null
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
    asking.current += 1
    setRuns(null)
    setPending(null)
    setNotice(null)
    setWrong(null)
    if (!client || !openBotName) return
    const stop = new AbortController()
    history(openBotName, stop.signal).catch((e) => {
      if (stop.signal.aborted) return
      setRuns([])
      setWrong(say(e, t('this conversation'), 'read', t))
    })
    return () => stop.abort()
  }, [client, openBotName, history, t])

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
        if (!now()) return true
        const no = refusal(e, who, Date.now(), t, bot.period)
        if (no) {
          setNotice(no)
          return false
        }
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

  const remove = useCallback(async () => {
    if (!client || !bot) return
    await client.agents.delete(bot.name)
    setBots((all) => (all ?? []).filter((b) => b.name !== bot.name))
    setOver(false)
    stepped.current = false
    move(null, false)
    await read()
  }, [client, bot, move, read])

  const removeGroup = useCallback(async () => {
    if (!client || !activeGroup) return
    await deleteGroup(client, activeGroup.name)
    setGroups((all) => all.filter((g) => g.name !== activeGroup.name))
    setOver(false)
    stepped.current = false
    move(null, false)
    await read()
  }, [client, activeGroup, move, read])

  const made = useCallback(
    async (agent: Agent) => {
      setMaking(false)
      setBots((all) => [...(all ?? []).filter((b) => b.name !== agent.name), agent as BotAgent])
      const step = !wide && !name
      if (step) stepped.current = true
      move(agent.name, step)
      await read()
    },
    [move, read, wide, name],
  )

  const savedGroup = useCallback(
    async (group: BotGroup) => {
      setMakingGroup(false)
      setEditingGroup(null)
      setGroups((all) => [...all.filter((g) => g.name !== group.name && g.id !== group.id), group])
      const ref = toGroupRef(group.name)
      const step = !wide && !name
      if (step) stepped.current = true
      move(ref, step)
      await read()
    },
    [move, read, wide, name],
  )

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

  const panel = activeGroup ? (
    <GroupPanel
      key={`grp:${activeGroup.name}`}
      group={activeGroup}
      groups={groups}
      bots={bots ?? []}
      onClose={close}
      onEdit={() => setEditingGroup(activeGroup)}
      onDelete={removeGroup}
      onPickBot={pick}
    />
  ) : bot ? (
    <Panel
      key={bot.name}
      bot={bot}
      groups={groups}
      runs={runs ?? []}
      kept={kept[bot.name] ?? ''}
      onClose={close}
      onSchedule={schedule}
      onDelete={remove}
      onBotChanged={read}
      onPickGroup={pick}
      focus={over && !laptop}
    />
  ) : null

  const shown = laptop ? side : over
  const hasSelection = Boolean(bot || activeGroup)

  return (
    <XStack data-parity-key="bots.window" width="100%" height="100%" overflow="hidden" bg={FLOOR} position="relative">
      <YStack
        ref={rosterSpan.ref}
        data-parity-key="bots.roster"
        position="relative"
        width={rosterWidth}
        shrink={0}
        height="100%"
        bg={FLOOR}
        borderRightWidth={1}
        borderColor={LINE}
        $max-md={{ width: '100%', borderRightWidth: 0, display: hasSelection ? 'none' : 'flex' }}
      >
        <Roster
          bots={bots}
          groups={groups}
          last={last}
          open={openRef}
          unread={unread}
          me={foot ? user : null}
          width={rosterWidth}
          onPick={pick}
          onMake={() => setMaking(true)}
          onMakeGroup={() => setMakingGroup(true)}
          disabled={!live}
        />
        {wide ? (
          <Gutter
            side="left"
            span={rosterWidth}
            floor={ROSTER_WIDTH_MIN}
            ceil={ROSTER_WIDTH_MAX}
            reset={SIDE}
            onSpan={(n) => {
              rosterSpan.move(n)
              setRosterWidth(n)
            }}
            onKeep={(n) => {
              rosterSpan.keep(n)
              setRosterWidth(n)
            }}
            label={t('Resize bots sidebar')}
          />
        ) : null}
      </YStack>

      <YStack
        data-parity-key="bots.center"
        flex={1}
        minW={0}
        height="100%"
        bg={GROUND}
        $max-md={{ display: hasSelection ? 'flex' : 'none' }}
      >
        {activeGroup ? (
          <GroupThread
            group={activeGroup}
            bots={bots ?? []}
            side={shown}
            onSide={() => (laptop ? setSide(!side) : setOver(!over))}
            onBack={back}
            onEdit={() => setEditingGroup(activeGroup)}
            onPickBot={pick}
          />
        ) : (
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
        )}
      </YStack>

      {laptop && side && panel ? (
        <YStack
          data-parity-key="bots.panel"
          width={300}
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
          aria-label={activeGroup?.name || bot?.name}
          position="absolute"
          t={0}
          r={0}
          b={0}
          width={300}
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

      {making ? <Make groups={groups} onDone={made} onCancel={() => setMaking(false)} /> : null}
      {makingGroup || editingGroup ? (
        <MakeGroupDialog
          bots={bots ?? []}
          groups={groups}
          initial={editingGroup}
          onDone={savedGroup}
          onCancel={() => {
            setMakingGroup(false)
            setEditingGroup(null)
          }}
        />
      ) : null}
    </XStack>
  )
}
