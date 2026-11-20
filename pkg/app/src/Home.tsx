'use client'

// Home: one question at the top, and what to do next underneath.
//
// THE COMPOSER IS THE PAGE. Everything else is a card, and every card is a real
// affordance reading real cloud data — no placeholder feed, no invented metric,
// and no list that renders unknown as zero.
//
// The field is `@hanzo/ui/chat`'s `Composer`, the same component the browser
// extension's home mounts and the same one `Chat.tsx` and `Work.tsx` already
// use. Its `children` is the documented toolbar slot — "where a surface puts
// its ModelSelector, attachment control or mode chips" — so the source chips go
// THERE and the package needs no change to carry them. The four options above
// it are this surface's, for the same reason: a home decides what it starts.

import { dev, go, talk } from './lib/host'
import { phrase } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AtSign, Blocks, Bot, FolderGit2, Hash, Plus, UserPlus } from 'lucide-react'
import { useAgents, usePeople, useSessions, useThreads } from '@hanzo/ai/react'
import type { AiClient } from '@hanzo/ai'
import { Composer } from '@hanzo/ui/chat'
import { MARKS } from '@hanzo/build'
import { Box, Text, View, XStack, YStack } from '@hanzo/ui'
import { tap } from './lib/tap'
import { useIam, useOrganizations } from '@hanzo/iam/react'
import { hasSession } from './lib/session'
import { useAi } from './lib/ai'
import { useHydrated } from './lib/hydrated'
import { useOpen } from './open'
import { plainly, say } from './failure'
import { failed } from './failed'
import { watch } from './watch'
import { Directory } from './Directory'
import { Bar } from './progress'
import { Go, INK, Quiet, Row, SOFT, CHOSEN } from './card'
import { Talk } from './Talk'
import { useMe } from './roster'
import { fromKey, teamKey, useChannels } from './channels'
import { invite, apps, projects } from './lib/home'
import { BAD } from './lib/mix'
import { useDevMode } from './lib/dev-mode'

function HomeCard({
  kind,
  icon,
  title,
  action,
  children,
}: {
  kind: string
  icon: ReactNode
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <YStack
      data-card={kind}
      gap="$3"
      p="$4"
      borderWidth={1}
      borderColor="$edge"
      rounded="$5"
      bg="var(--surface-card)"
      minW={0}
      transition="quickest"
      hoverStyle={{ bg: 'var(--surface-card-emphasis)', borderColor: 'var(--border-strong)' }}
    >
      <XStack items="center" gap="$2.5">
        <View
          width={28}
          height={28}
          rounded="$3"
          bg="$raised"
          display="flex"
          items="center"
          justify="center"
          shrink={0}
        >
          <Text display="flex" items="center" justify="center" color="var(--foreground)">
            {icon}
          </Text>
        </View>
        <Text fontSize="$4" fontWeight="600" color={INK} flex={1} minW={0} numberOfLines={1}>
          {title}
        </Text>
        {action}
      </XStack>
      {children}
    </YStack>
  )
}

/** What a question can start here. Four, in the order they escalate. */
const MODES = [
  { id: 'chat', label: phrase('Chat'), asks: phrase('Ask anything') },
  { id: 'dev', label: phrase('Dev'), asks: phrase('Describe what to build') },
  { id: 'news', label: phrase('News'), asks: phrase('What happened?') },
  { id: 'research', label: phrase('Research'), asks: phrase('What should we dig into?') },
] as const

export type Mode = (typeof MODES)[number]['id']

/**
 * Where a grounded answer may look, as the `@source` hints the answer engine
 * already reads (`SearchOptions.sources` in `@hanzo/ai`). Chat and Dev do not
 * search, so the chips are drawn only for the two modes that do — and they live
 * in the composer's footer row, whose height the send control already sets, so
 * switching modes moves nothing.
 */
const SOURCES = ['web', 'news', 'academic', 'github', 'reddit', 'x']

const GROUNDS = (mode: Mode): boolean => mode === 'news' || mode === 'research'

/**
 * Ask, however the host answers.
 *
 * The default sends the question to /chat, which is the one app on this site
 * that reads a question off the address (`?q=`, the name every Hanzo surface
 * takes). A host that already HAS the thread — the chat pane, where this home
 * belongs — passes its own `send` instead and nothing navigates.
 */
export interface HomeProps {
  ask?: (question: string, mode: Mode, sources: string[]) => void
}

/**
 * A CHANNEL IS READ HERE. Home is the org's app: the rail's channels and direct
 * messages open in this pane (`Talk`), keyed `team:<space>/<id>` in the
 * selection slot and in the address, and the Channels card below lists them and
 * opens a new one. What other networks carry in stays in the Inbox, under its
 * own key.
 */
export function Home({ ask }: HomeProps) {
  const { t } = useI18n()
  const [devMode] = useDevMode()
  const [mode, setMode] = useState<Mode>('chat')
  const [draft, setDraft] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [directory, setDirectory] = useState(false)
  const { channel, openChannel } = useOpen()
  const held = useChannels()

  const here = MODES.find((m) => m.id === mode) ?? MODES[0]
  const grounded = GROUNDS(mode)

  const at = fromKey(channel)
  if (at) return <Open at={at} channels={held} back={() => openChannel(null)} />

  const send = () => {
    const question = draft.trim()
    if (!question) return
    setDraft('')
    const hints = grounded ? picked : []
    if (ask) {
      ask(question, mode, hints)
      return
    }
    if (mode === 'dev') {
      const target = dev()
      const sep = target.includes('?') ? '&' : '?'
      window.location.href = `${target}${sep}q=${encodeURIComponent(question)}`
      return
    }
    const q = hints.length ? `${question} ${hints.map((s) => `@${s}`).join(' ')}` : question
    window.location.href = `/chat?q=${encodeURIComponent(q)}`
  }

  return (
    <YStack data-home flex={1} minH={0} width="100%" overflowY="auto" overflowX="hidden">
      <YStack
        width="100%"
        maxW={680}
        mx="auto"
        px="$4"
        pt="$8"
        gap="$4"
        $sm={{ pt: '$9' }}
        $max-sm={{ px: '$3', pt: '$6', gap: '$4' }}
      >
        <Text
          render="h1"
          m={0}
          fontSize="$8"
          lineHeight="$8"
          fontWeight="600"
          letterSpacing={-0.5}
          color={INK}
          text="center"
        >
          {t('What are we building?')}
        </Text>

        <YStack width="100%" gap="$2.5">
          <XStack justify="center">
            <XStack
              items="center"
              gap="$1"
              p={4}
              rounded="$10"
              bg="var(--surface-card)"
              borderWidth={1}
              borderColor="var(--border-strong)"
              flexWrap="wrap"
            >
              {MODES.map((one) => (
                <Box
                  key={one.id}
                  data-tab={one.id}
                  render={<button type="button" />}
                  onClick={() => setMode(one.id)}
                  aria-current={mode === one.id}
                  display="inline-flex"
                  items="center"
                  justify="center"
                  minH={32}
                  $max-sm={{ minH: 40 }}
                  px="$3.5"
                  py="$1.5"
                  rounded="$10"
                  borderWidth={0}
                  bg={mode === one.id ? CHOSEN : 'transparent'}
                  hoverStyle={{ bg: mode === one.id ? CHOSEN : '$hover' }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  cursor="pointer"
                  transition="quickest"
                >
                  <Text
                    fontSize="$2"
                    fontWeight={mode === one.id ? '600' : '500'}
                    color={mode === one.id ? INK : SOFT}
                  >
                    {t(one.label)}
                  </Text>
                </Box>
              ))}
            </XStack>
          </XStack>

          <YStack
            data-slot="home-composer"
            width="100%"
            rounded={17}
            borderWidth={1}
            borderColor="var(--border-strong)"
            bg="var(--surface-card)"
            hoverStyle={{ borderColor: 'var(--border-focus)' }}
          >
            <Composer
              value={draft}
              onChange={setDraft}
              onSend={send}
              placeholder={t(here.asks)}
              label={t(here.asks)}
              rows={2}
              maxHeight={240}
            >
              {grounded && devMode ? (
                <XStack gap="$1" flexWrap="wrap" shrink={1} minW={0}>
                  {SOURCES.map((s) => {
                    const on = picked.includes(s)
                    return (
                      <Box
                        key={s}
                        data-chip={s}
                        render={<button type="button" />}
                        aria-pressed={on}
                        onClick={() =>
                          setPicked((held) => (on ? held.filter((h) => h !== s) : [...held, s]))
                        }
                        display="inline-flex"
                        items="center"
                        justify="center"
                        px="$2"
                        py="$1"
                        $max-sm={{ minH: 36, px: '$2.5' }}
                        rounded="$10"
                        borderWidth={0}
                        cursor="pointer"
                        bg={on ? CHOSEN : 'transparent'}
                        hoverStyle={{ bg: '$hover' }}
                        focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                      >
                        <Text data-i18n-ltr fontSize="$2" color={on ? INK : SOFT}>
                          @{s}
                        </Text>
                      </Box>
                    )
                  })}
                </XStack>
              ) : null}
            </Composer>
          </YStack>
        </YStack>
      </YStack>

      <YStack
        width="100%"
        maxW={960}
        mx="auto"
        px="$4"
        pt="$7"
        pb="$8"
        gap="$5"
        $max-sm={{ px: '$3', pt: '$5', pb: '$6' }}
      >
        <View
          data-slot="home-cards"
          display="grid"
          gridTemplateColumns="repeat(3, minmax(0, 1fr))"
          gap={16}
          $max-lg={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
          $max-md={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}
          $max-sm={{ gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }}
        >
          <Channels {...held} />
          <Projects />
          <Chats />
          <Next onConnect={() => setDirectory(true)} />
          <Apps onConnect={() => setDirectory(true)} />
          <Team />
        </View>
      </YStack>

      <Directory open={directory} onClose={() => setDirectory(false)} />
    </YStack>
  )
}

/**
 * The open channel, in place of the question and the cards.
 *
 * The key names a space and an id; the org's list answers which channel that
 * is. The ladder is the one every card climbs: the session first, because that
 * is the state that never resolves, then the refusal, then the read, then a key
 * no channel answers to — a shared link to a channel this reader cannot see.
 */
function Open({
  at,
  channels,
  back,
}: {
  at: { space: string; id: string }
  channels: ReturnType<typeof useChannels>
  back: () => void
}) {
  const { t } = useI18n()
  const { isAuthenticated, isLoading } = useIam()
  const found = channels.channels?.find((one) => one.space === at.space && one.id === at.id)
  if (found) return <Talk key={teamKey(found)} channel={found} />
  const reading = isLoading || (isAuthenticated && channels.channels === null && !channels.wrong)
  const line = reading
    ? t('Reading the channel.')
    : !isAuthenticated
      ? t('Sign in to read this channel.')
      : channels.wrong
        ? say(channels.wrong, t('this channel'), 'read', t)
        : t('That channel is not here.')
  return (
    <YStack flex={1} items="center" justify="center" px="$6" pt="$6" pb="$12" $max-sm={{ px: '$4', pb: '$8' }} gap="$4">
      <Text fontSize="$3" color={SOFT} text="center" maxW={460} lineHeight="$4">
        {line}
      </Text>
      {reading ? null : (
        <Box
          render={<button type="button" />}
          onClick={back}
          {...tap}
          display="inline-flex"
          items="center"
          justify="center"
          minH={36}
          $max-sm={{ minH: 44 }}
          px="$3.5"
          rounded="$3"
          bg="transparent"
          borderWidth={1}
          borderColor="var(--border-strong)"
          cursor="pointer"
          transition="quickest"
          hoverStyle={{ bg: '$hover' }}
          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
        >
          <Text fontSize="$2" fontWeight="500" color={INK}>
            {t('Back to home')}
          </Text>
        </Box>
      )}
    </YStack>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   The cards. Each one owns its own read, so a card that cannot answer says so
   on its own rather than emptying the grid.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * The org's channels, and the way to open one.
 *
 * The list is the read the rail makes (`useChannels`), so the two cannot
 * disagree about what the org has. A new channel is posted with the reader as
 * its first member — the platform adds nobody on its own — in the space of the
 * org's first channel, which is the space an org with one has; an org with none
 * leaves it unsaid. The row the platform answers with is opened at once.
 */
function Channels({ channels, wrong, open }: ReturnType<typeof useChannels>) {
  const { t } = useI18n()
  const { openChannel } = useOpen()
  const me = useMe()
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [opening, setOpening] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)

  const make = async () => {
    const wanted = name.trim()
    if (!wanted || opening || !me) return
    setOpening(true)
    setRefused(null)
    try {
      const made = await open({ name: wanted, space: channels?.[0]?.space, members: [me] })
      setName('')
      setNaming(false)
      openChannel(teamKey(made))
    } catch (e) {
      setRefused(plainly(e, t('this channel'), t))
    } finally {
      setOpening(false)
    }
  }

  return (
    <HomeCard kind="channels" icon={<Hash size={14} aria-hidden />} title={t('Channels')}>
      {channels === null ? (
        <Waiting wrong={wrong} subject={t('your channels')} />
      ) : channels.length === 0 ? (
        <Quiet>{t('No channels yet.')}</Quiet>
      ) : (
        <YStack gap="$1.5">
          {channels.slice(0, 6).map((one) => (
            <Row
              key={teamKey(one)}
              icon={one.direct ? <AtSign size={12} aria-hidden /> : <Hash size={12} aria-hidden />}
              onPress={() => openChannel(teamKey(one))}
            >
              {one.name || t('Direct message')}
            </Row>
          ))}
        </YStack>
      )}
      {!me ? null : naming ? (
        <YStack gap="$1.5">
          <XStack gap="$1.5" items="center">
            <Text
              render={
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void make()
                    if (e.key === 'Escape') setNaming(false)
                  }}
                  placeholder={t('Name')}
                  aria-label={t('Channel name')}
                  autoFocus
                />
              }
              flex={1}
              minW={0}
              minH={34}
              $max-sm={{ minH: 44 }}
              bg="transparent"
              borderWidth={1}
              borderColor="var(--border-strong)"
              outlineStyle="none"
              focusStyle={{ borderColor: 'var(--ring)' }}
              rounded="$2"
              px={8}
              py={6}
              color="inherit"
              fontSize="$2"
            />
            <Box
              render={<button type="button" disabled={opening || !name.trim()} />}
              onClick={() => void make()}
              aria-disabled={opening || !name.trim()}
              opacity={opening || !name.trim() ? 0.5 : 1}
              display="inline-flex"
              items="center"
              justify="center"
              minH={34}
              $max-sm={{ minH: 44 }}
              px="$2.5"
              rounded="$2"
              bg="transparent"
              borderWidth={1}
              borderColor="var(--border-strong)"
              cursor={opening || !name.trim() ? 'default' : 'pointer'}
              transition="quickest"
              hoverStyle={opening || !name.trim() ? undefined : { bg: '$hover' }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            >
              <Text fontSize="$2" fontWeight="500" color={INK}>
                {t('Open it')}
              </Text>
            </Box>
          </XStack>
          {refused ? (
            <Text fontSize="$2" color={BAD}>
              {refused}
            </Text>
          ) : null}
        </YStack>
      ) : (
        <Row icon={<Plus size={12} aria-hidden />} onPress={() => setNaming(true)}>
          {t('New channel')}
        </Row>
      )}
    </HomeCard>
  )
}

/**
 * A read the SDK has no hook for.
 *
 * `null` while the answer is not in — including when the request failed, which
 * is the case a `[]` would misreport as "the org has none".
 *
 * The reader is passed by REFERENCE (`lib/home.ts`'s own functions), not built
 * in the caller, so the effect's dependency is honest and it runs once per
 * client rather than once per render.
 */
function useRead<T>(
  read: (client: AiClient, signal: AbortSignal) => Promise<T>,
): { held: T | null; wrong: unknown } {
  const { client } = useAi()
  const [held, setHeld] = useState<T | null>(null)
  // WHY THERE IS NOTHING, kept rather than swallowed. `null` alone says only
  // that no answer is held, which is equally true of a request still in flight
  // and one that came back no — and a card cannot choose its sentence without
  // knowing which.
  const [wrong, setWrong] = useState<unknown>(null)
  useEffect(() => {
    if (!client) return
    const stop = new AbortController()
    void read(client, stop.signal)
      .then((got) => {
        if (!stop.signal.aborted) setHeld(got)
      })
      .catch((e: unknown) => {
        if (!stop.signal.aborted) setWrong(e)
      })
    return () => stop.abort()
  }, [client, read])
  return { held, wrong }
}

/**
 * WHAT A CARD SAYS BEFORE IT HAS ANYTHING.
 *
 * Three states wore one word. "Reading." is true only while an answer is on its
 * way — a reader with no session will never be sent one, and a store that
 * refused has already answered. Measured on production: Projects, Apps and Team
 * all still said "Reading." twelve seconds after load, to a visitor nobody was
 * ever going to answer.
 *
 * The session is asked FIRST, because that is the state that never resolves.
 */
function Waiting({ wrong, subject }: { wrong?: unknown; subject: string }) {
  const { t } = useI18n()
  const { isAuthenticated } = useIam()
  const signedIn = isAuthenticated || hasSession()
  if (!signedIn) return <Quiet>{t('Sign in to see {subject}.', { subject })}</Quiet>
  if (wrong) return <Quiet>{say(wrong, subject, 'read', t)}</Quiet>
  return <Quiet>{t('Reading.')}</Quiet>
}

const useProjects = () => useRead(projects)
const useApps = () => useRead(apps)

function Projects() {
  const { t } = useI18n()
  const { held, wrong } = useProjects()
  return (
    <HomeCard kind="projects" icon={<FolderGit2 size={14} aria-hidden />} title={t('Projects')}>
      {held === null ? (
        <Waiting wrong={wrong} subject={t('your projects')} />
      ) : held.length === 0 ? (
        <Quiet>{t('Nothing deployed yet.')}</Quiet>
      ) : (
        <YStack gap="$1.5">
          {held.slice(0, 3).map((p) => (
            <Row key={p.slug} href={p.liveUrl}>
              {p.name || p.slug}
            </Row>
          ))}
        </YStack>
      )}
      <Go href={dev()}>{t('Ship one')}</Go>
    </HomeCard>
  )
}

function Chats() {
  const { t } = useI18n()
  const { threads, loading } = useThreads()
  const { open, empty } = useOpen()
  return (
    <HomeCard kind="chats" icon={<MARKS.chat.icon size={14} aria-hidden />} title={t('Chats')}>
      {loading && threads.length === 0 ? (
        <Waiting subject={t('your chats')} />
      ) : threads.length === 0 ? (
        <Quiet>{t('No chats yet.')}</Quiet>
      ) : (
        <YStack gap="$1.5">
          {threads.slice(0, 3).map((one) => (
            <Row key={one.id} onPress={() => open(one.id)}>
              {one.title || t('Untitled')}
            </Row>
          ))}
        </YStack>
      )}
      <Go
        onPress={() => {
          empty()
          go(talk())
        }}
      >
        {t('New chat')}
      </Go>
    </HomeCard>
  )
}

/**
 * What is going, then what to do next.
 *
 * Both halves are DERIVED — every line is a fact this page measured, and it
 * names the fact rather than a recommendation nobody can check. A running run
 * carries its own bar; see `progress.tsx` for why that bar is usually invisible
 * today.
 */
function Next({ onConnect }: { onConnect: () => void }) {
  const { t } = useI18n()
  const { sessions, error: unread, reload } = useSessions({ limit: 100 })
  const { agents } = useAgents()
  const { held } = useProjects()
  const { held: connected } = useApps()

  const safeSessions = Array.isArray(sessions) ? sessions : []
  const safeAgents = Array.isArray(agents) ? agents : []

  const running = useMemo(() => safeSessions.filter((s) => s && s.status === 'running'), [safeSessions])

  const rows = useMemo(() => {
    const out: { key: string; say: string; href?: string; press?: () => void }[] = []
    // The past 7 days' failures, a tree counted once (./failed): counting every
    // error in the last 100 runs kept old failures on the card indefinitely. The
    // row opens the newest of them on the Work board (./watch), not the board
    // alone. A read that failed is not "nothing failed": it says so, and
    // pressing the row reads the runs again.
    const failing = failed(safeSessions)
    if (unread) out.push({ key: 'failed', say: say(unread, t('your runs'), 'read', t), press: reload })
    else if (failing.length)
      out.push({ key: 'failed', say: t('{n} failed in the past 7 days', { n: failing.length }), href: watch(failing[0].id) })
    if (safeAgents.length === 0) out.push({ key: 'agent', say: t('Hire your first agent'), href: '/work' })
    if (held?.length === 0) out.push({ key: 'ship', say: t('Ship your first project'), href: dev() })
    if (connected && Array.isArray(connected) && !connected.some((a) => a?.connected))
      out.push({ key: 'connect', say: t('Connect an app'), press: onConnect })
    return out
  }, [safeSessions, unread, reload, safeAgents, held, connected, onConnect, t])

  return (
    <HomeCard kind="next" icon={<Bot size={14} aria-hidden />} title={t('Next')}>
      {running.length ? (
        <YStack gap="$2">
          {running.slice(0, 2).map((s) => (
            <YStack key={s.id} gap="$1">
              <Row href="/work">{s.title || s.agent || t('Run')}</Row>
              <Bar run={s} label={false} />
            </YStack>
          ))}
        </YStack>
      ) : null}

      {rows.length === 0 && running.length === 0 ? (
        <Quiet>{t('Nothing needs you.')}</Quiet>
      ) : (
        <YStack gap="$1.5">
          {rows.slice(0, 3).map((r) => (
            <Row key={r.key} href={r.href} onPress={r.press}>
              {r.say}
            </Row>
          ))}
        </YStack>
      )}
    </HomeCard>
  )
}

function Apps({ onConnect }: { onConnect: () => void }) {
  const { t } = useI18n()
  const { held, wrong } = useApps()
  const on = held?.filter((a) => a.connected) ?? []
  return (
    <HomeCard kind="apps" icon={<Blocks size={14} aria-hidden />} title={t('Apps')}>
      {held === null ? (
        <Waiting wrong={wrong} subject={t('connected apps')} />
      ) : on.length === 0 ? (
        <Quiet>{t('Nothing connected.')}</Quiet>
      ) : (
        <YStack gap="$1.5">
          {on.slice(0, 3).map((a) => (
            <Row key={a.id}>{a.name}</Row>
          ))}
        </YStack>
      )}
      <Go onPress={onConnect}>{t('Connect')}</Go>
    </HomeCard>
  )
}

function Team() {
  const { t } = useI18n()
  const hydrated = useHydrated()
  const { currentOrgId } = useOrganizations()
  if (!hydrated || !currentOrgId) {
    return (
      <HomeCard kind="team" icon={<UserPlus size={14} aria-hidden />} title={t('Team')}>
        <Waiting subject={t('your team')} />
        <Go href={invite()}>{t('Invite')}</Go>
      </HomeCard>
    )
  }
  return <Mates owner={currentOrgId} />
}

function Mates({ owner }: { owner: string }) {
  const { t } = useI18n()
  const { people, loading } = usePeople({ owner, service: false })
  return (
    <HomeCard kind="team" icon={<UserPlus size={14} aria-hidden />} title={t('Team')}>
      {loading && people.length === 0 ? (
        <Waiting subject={t('your team')} />
      ) : people.length < 2 ? (
        <Quiet>{t('Just you.')}</Quiet>
      ) : (
        <Quiet>{t('{n} people', { n: people.length })}</Quiet>
      )}
      <Go href={invite()}>{t('Invite')}</Go>
    </HomeCard>
  )
}
