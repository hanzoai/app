'use client'

// The directory: who is in this org, and who you can put in a conversation.
//
// IT IS A LIST OF SUBJECTS AND NOTHING ELSE. People, the org's agents, and the
// presets an org can install as one. It holds no conversations, keeps no
// threads, and remembers nothing of its own — the conversations it starts live
// in the thread store with every other conversation, which is
// `conversations.ts`.
//
// WHAT IT USED TO DO. Four `localStorage` keys: a roster of people it invented,
// a list of agents it invented, a set of `direct_…`/`group_…`/`call_…` threads
// nothing on the platform had ever seen, and an event the sidebar merged them
// in through. Adding a person wrote a row into that store — no invitation, no
// account, nobody told — and the row was gone on the next machine. Pressing
// Call minted a thread whose title began with a telephone and rang nowhere.
//
// EVERY ROW IS NOW A READ, and every control a write:
//   people   GET  /v1/iam/scim/v2/Users?owner=<org>   (`usePeople`)
//   agents   GET  /v1/agents                          (`useCrew`, crew.tsx)
//   presets  GET  /v1/agent/chat/presets              (the catalog, public)
//   invite   POST /v1/iam/invitations                 (`createInvitation`)
//   agent    POST /v1/agents                          (`Hire`, the crew's sheet)
//   thread   POST /v1/agents/chat/conversations       (`start`)
//
// THERE IS NO CALL CONTROL, because there is no call. Measured against the
// platform's own contract — 1629 paths in /v1/openapi.json — nothing serves
// signalling, an SFU, a call token or a TURN credential. A button that says
// Call and opens a chat is worse than no button: it reports a thing that did
// not happen. When the estate serves a call, the conversation it attaches to is
// the one `start` already writes, and this file gains a verb rather than a
// store.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { phrase } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { useHost } from './host'
import { Check, Plus, Search, UserPlus } from 'lucide-react'
import { Box, Button, Text, XStack, YStack } from '@hanzo/ui'
import { useAi, useModels, usePeople, useThreads } from '@hanzo/ai/react'
import { useIam, useOrganizations } from '@hanzo/iam/react'
import { enter as enterSignIn, LOGIN } from './lib/destination'
import { hasSession } from './lib/session'
import { useHydrated } from './lib/hydrated'
import { ENSO, served } from './lib/ai'
import { createInvitation, inviteLink } from './lib/invite'
import { reach } from './lib/reach'
import { Face } from './cast'
import { Take } from './copy'
import { Hire, useCrew } from './crew'
import { called } from './team'
import { say } from './failure'
import { openThread } from './open'
import { spokenAt, start } from "./conversations"
import type { Member } from "./roster"
import { useDevMode } from "./lib/dev-mode"

/** A preset, as `/v1/agent/chat/presets` publishes one. */
interface Preset {
  id: string
  title?: string
  systemPrompt?: string
}

/**
 * WHAT A ROW IS, whichever list it came from.
 *
 * `name` is the handle the platform knows — an agent's name, a person's login —
 * and `label` is what a reader is shown. They differ for a person and agree for
 * an agent, and keeping both is what lets a row be pressed into a conversation
 * without the conversation having to look anybody up again.
 */
interface Entry {
  key: string
  kind: Kind
  name: string
  label: string
  /** The one line under the name: an address, what an agent is for. */
  note: string
  avatar?: string
  emoji?: string
  /** When a conversation last named them, or 0. See `spokenAt`. */
  at: number
}

/**
 * THREE KINDS, and the whole taxonomy.
 *
 * A preset is not a fourth sort of contact: it is an agent this org has not
 * installed yet, so it cannot be spoken to and its one control installs it.
 * "Preset" is the platform's own word for it — the id the chat round accepts in
 * `preset` — and a second word here would be a second thing.
 */
type Kind = 'person' | 'agent' | 'preset'

const TABS: { id: Kind | 'all'; label: string }[] = [
  { id: 'all', label: phrase('All') },
  { id: 'person', label: phrase('People') },
  { id: 'agent', label: phrase('Agents') },
  { id: 'preset', label: phrase('Starter agents') },
]

/** A–Z, or who you spoke to last. Two orders, and both are answerable. */
type Order = 'name' | 'recent'

export function Contacts() {
  const { t } = useI18n()
  const hydrated = useHydrated()
  const { isAuthenticated } = useIam()
  const { currentOrgId } = useOrganizations()
  const signedIn = isAuthenticated || hasSession()

  // A prerender knows neither the reader nor the org, so it draws the heading
  // and waits. Announcing "sign in" before hydration tells a signed-in reader
  // they are signed out for a frame.
  if (!hydrated) return <Alone>&nbsp;</Alone>
  if (!signedIn) {
    return (
      <Alone
        action={
          <Button
            size="sm"
            variant="primary"
            rounded="$3"
            minH={36}
            $max-sm={{ minH: 44 }}
            mt="$2"
            onClick={() => enterSignIn(LOGIN)}
          >
            {t('Sign in')}
          </Button>
        }
      >
        {t('Sign in to see who is in your organization.')}
      </Alone>
    )
  }
  if (!currentOrgId) return <Alone>{t('This account is not in an organization yet.')}</Alone>
  return <Roster owner={currentOrgId} />
}

/** The app's one heading, for every state that has nothing to list. */
function Alone({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  const { t } = useI18n()
  return (
    <YStack flex={1} items="center" justify="center" px="$6" pt="$6" pb="$12" $max-sm={{ px: '$4', pb: '$8' }} gap="$1.5">
      <Text render="h1" m={0} fontSize="$6" fontWeight="600" letterSpacing={-0.34} color="$ink" text="center">
        {t('Contacts')}
      </Text>
      <Text fontSize="$3" color="$soft" maxW={460} lineHeight="$4" text="center">
        {children}
      </Text>
      {action}
    </YStack>
  )
}

/** A read that answered no, said once, above whatever else is on screen. */
function Note({ children, error }: { children: string; error?: boolean }) {
  return (
    <YStack width="100%" maxW={960} mx="auto" px="$4" $max-sm={{ px: '$3' }} py="$2">
      <Text role={error ? 'alert' : undefined} fontSize="$2" color={error ? 'var(--state-error)' : '$soft'}>
        {children}
      </Text>
    </YStack>
  )
}

/**
 * The directory itself.
 *
 * SPLIT OUT because `usePeople` needs an owner and a hook cannot be called
 * conditionally — the same reason Home splits its own.
 */
function Roster({ owner }: { owner: string }) {
  const { t } = useI18n()
  const [devMode] = useDevMode()
  const ai = useAi()
  const { router } = useHost()
  const { people, loading: reading, error: unread } = usePeople({ owner, service: false })
  // `create` and not `ai.agents.create`: the hook's own writer refreshes the
  // list it read, which is what moves an installed preset out of the catalog
  // and into the org's agents without a reload.
  const { agents, create, loading: gathering, error: ungathered } = useCrew()
  // WHAT "RECENTLY" MEANS: the conversations this reader has. It is the same
  // read the sidebar makes, and the only record of who a conversation was with.
  const { threads } = useThreads()
  // An installed preset needs a model, and `POST /v1/agents` refuses one this
  // deployment does not serve — so it is named against the served catalog by
  // the one function that does that, rather than typed in and hoped for.
  const { models } = useModels()

  // `null` is the catalog unknown; `[]` is a deployment that publishes none.
  const [presets, setPresets] = useState<Preset[] | null>(null)
  const [unlisted, setUnlisted] = useState<unknown>(null)
  useEffect(() => {
    const stop = new AbortController()
    ai.http
      .collection<Preset>('presets', {
        method: 'GET',
        path: '/v1/agent/chat/presets',
        signal: stop.signal,
      })
      .then(setPresets)
      .catch((e: unknown) => {
        if (!stop.signal.aborted) setUnlisted(e)
      })
    return () => stop.abort()
  }, [ai])

  const [tab, setTab] = useState<Kind | 'all'>('all')
  const [order, setOrder] = useState<Order>('name')
  const [look, setLook] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [hiring, setHiring] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [wrong, setWrong] = useState<string | null>(null)

  const entries = useMemo<Entry[]>(() => {
    const rows: Entry[] = []
    for (const one of people) {
      const label = one.displayName || one.name
      rows.push({
        key: `person:${one.id}`,
        kind: 'person',
        name: one.name,
        label,
        note: one.email ?? '',
        at: spokenAt(threads, label),
      })
    }
    for (const one of agents) {
      rows.push({
        key: `agent:${one.id}`,
        kind: 'agent',
        name: one.name,
        label: called(one.name),
        note: one.description || (devMode ? one.model : '') || '',
        avatar: one.avatar,
        emoji: one.emoji,
        at: spokenAt(threads, one.name),
      })
    }
    for (const one of presets ?? []) {
      if (agents.some((made) => made.name === one.id)) continue
      rows.push({
        key: `preset:${one.id}`,
        kind: 'preset',
        name: one.id,
        label: one.title || one.id,
        note: t('Starter agent'),
        at: 0,
      })
    }
    return rows
  }, [people, agents, presets, threads, devMode, t])

  const shown = useMemo(() => {
    const q = look.trim().toLowerCase()
    return entries
      .filter((one) => tab === 'all' || one.kind === tab)
      .filter((one) => !q || `${one.label} ${one.name} ${one.note}`.toLowerCase().includes(q))
      .sort((a, b) =>
        order === 'name'
          ? a.label.localeCompare(b.label)
          : b.at - a.at || a.label.localeCompare(b.label),
      )
  }, [entries, tab, look, order])

  const install = useCallback(
    async (one: Entry) => {
      const preset = (presets ?? []).find((p) => p.id === one.name)
      if (!preset || busy) return
      setBusy(one.key)
      setWrong(null)
      try {
        // The list this row leaves and the list it joins are both `useAgents`,
        // so the row moves by itself.
        await create({
          name: preset.id,
          model: served(models, ENSO),
          ...(preset.systemPrompt ? { instructions: preset.systemPrompt } : {}),
          ...(preset.title ? { description: preset.title } : {}),
        })
      } catch (e) {
        setWrong(reach(e))
      } finally {
        setBusy(null)
      }
    },
    [busy, create, models, presets],
  )

  /**
   * INTO A CONVERSATION, by the one call that starts one.
   *
   * One selected is a direct conversation, several is a group, and a group of
   * agents or a mix of both is the same act — nothing here branches on how many
   * or on what kind, because the thread store does not either.
   */
  const enter = useCallback(async () => {
    const members: Member[] = picked
      .map((key) => entries.find((one) => one.key === key))
      .filter((one): one is Entry => Boolean(one))
      .map((one) => ({ id: one.key, name: one.label || one.name, agent: one.kind === 'agent' }))
    if (members.length === 0 || busy) return
    setBusy('conversation')
    setWrong(null)
    try {
      const id = await start(ai, members)
      // The selection the chat pane reads, and the address a reload lands on.
      openThread(id)
      router.push(`/chat?thread=${encodeURIComponent(id)}`)
    } catch (e) {
      setWrong(reach(e))
    } finally {
      setBusy(null)
    }
  }, [ai, busy, entries, picked, router])

  const waiting = (reading && people.length === 0) || (gathering && agents.length === 0)
  const hasEmptyPrimary = !waiting && shown.length === 0 && !look.trim() && tab !== 'preset'
  const headerPrimary = picked.length === 0 && !hasEmptyPrimary

  return (
    <YStack flex={1} minH={0} minW={0} overflow="hidden">
      <YStack shrink={0} borderBottomWidth={1} borderColor="$edge">
        <XStack
          width="100%"
          maxW={960}
          mx="auto"
          minH={56}
          items="center"
          flexWrap="wrap"
          gap="$3"
          px="$4"
          py="$2.5"
          $max-sm={{ px: '$3' }}
        >
          <Text
            render="h1"
            m={0}
            flex={1}
            minW={120}
            fontSize="$6"
            fontWeight="600"
            letterSpacing={-0.34}
            color="$ink"
            numberOfLines={1}
          >
            {t('Contacts')}
          </Text>
          <XStack items="center" gap="$2" flexWrap="wrap">
            <Control onPress={() => setInviting(true)} icon={<UserPlus size={13} aria-hidden />}>
              {t('Invite')}
            </Control>
            <Control onPress={() => setHiring(true)} icon={<Plus size={13} aria-hidden />} strong={headerPrimary}>
              {t('New agent')}
            </Control>
          </XStack>
        </XStack>
      </YStack>

      <YStack shrink={0} borderBottomWidth={1} borderColor="$edge">
        <XStack
          width="100%"
          maxW={960}
          mx="auto"
          items="center"
          gap="$3"
          px="$4"
          py="$2.5"
          $max-sm={{ px: '$3', gap: '$2' }}
          flexWrap="wrap"
        >
          <XStack
            items="center"
            gap="$2"
            flex={1}
            minW={180}
            minH={36}
            px="$2.5"
            bg="$panel"
            borderWidth={1}
            borderColor="var(--border-strong)"
            rounded="$3"
            focusWithinStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            $max-sm={{ minW: '100%', minH: 44 }}
          >
            <Search size={14} color="var(--muted-foreground)" aria-hidden />
            <Text
              render={<input value={look} onChange={(e) => setLook(e.target.value)} placeholder={t('Search')} aria-label={t('Search contacts')} />}
              flex={1}
              minW={0}
              bg="transparent"
              borderWidth={0}
              outlineStyle="none"
              color="$ink"
              fontSize="$2"
              px={0}
              py={6}
            />
          </XStack>
          <XStack items="center" gap="$3" flexWrap="wrap">
            <XStack items="center" gap="$1.5" flexWrap="wrap">
              {TABS.map((one) => (
                <Pill key={one.id} on={tab === one.id} onPress={() => setTab(one.id)}>
                  {t(one.label)}
                </Pill>
              ))}
            </XStack>
            {/* WHICH KIND and IN WHAT ORDER are two questions, and the pills that
                ask them are the same shape — so a rule stands between the groups.
                Without it the row reads as six settings of one thing. */}
            <Box display="none" $sm={{ display: 'flex' }} width={1} height={18} bg="$edge" />
            {/* TWO ORDERS, BOTH TRUE. A–Z is the name; Recent is the last
                conversation that named them, which is the only activity the thread
                store records about a contact. */}
            <XStack items="center" gap="$1.5">
              <Pill on={order === 'name'} onPress={() => setOrder('name')}>
                {t('A–Z')}
              </Pill>
              <Pill on={order === 'recent'} onPress={() => setOrder('recent')}>
                {t('Recent')}
              </Pill>
            </XStack>
          </XStack>
        </XStack>
      </YStack>

      {unread ? <Note error>{say(unread, t('your organization'), 'read', t)}</Note> : null}
      {ungathered ? <Note error>{say(ungathered, t("this org's agents"), 'read', t)}</Note> : null}
      {unlisted ? <Note error>{say(unlisted, t('starter agents'), 'read', t)}</Note> : null}
      {wrong ? <Note error>{wrong}</Note> : null}

      <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden">
        {waiting && shown.length === 0 ? (
          <YStack flex={1} items="center" justify="center" pt="$6" pb="$12" px="$4">
            <Text fontSize="$2" color="$soft">
              {t('Loading contacts…')}
            </Text>
          </YStack>
        ) : shown.length === 0 ? (
          <YStack flex={1} items="center" justify="center" pt="$6" pb="$12" $max-sm={{ pb: '$8' }} px="$4" gap="$4">
            <Text fontSize="$3" color="$soft" text="center" maxW={420} lineHeight="$4">
              {look.trim()
                ? t('Nobody here matches “{query}”.', { query: look.trim() })
                : tab === 'agent'
                  ? t('No agents yet. Create one to start working together.')
                  : tab === 'preset'
                    ? t('Every starter agent is already installed.')
                    : t('Just you so far. Invite a teammate or add an agent.')}
            </Text>
            {look.trim() ? (
              <Control onPress={() => setLook('')}>{t('Clear search')}</Control>
            ) : tab === 'agent' ? (
              <Control onPress={() => setHiring(true)} strong>
                {t('New agent')}
              </Control>
            ) : tab !== 'preset' ? (
              <Control onPress={() => setInviting(true)} strong>
                {t('Invite')}
              </Control>
            ) : null}
          </YStack>
        ) : (
          <YStack width="100%" maxW={960} mx="auto">
            {shown.map((one) => (
              <Row
                key={one.key}
                one={one}
                on={picked.includes(one.key)}
                busy={busy === one.key}
                onPress={() =>
                  one.kind === 'preset'
                    ? void install(one)
                    : setPicked((was) =>
                        was.includes(one.key)
                          ? was.filter((k) => k !== one.key)
                          : [...was, one.key],
                      )
                }
              />
            ))}
          </YStack>
        )}
      </YStack>

      {picked.length > 0 ? (
        <YStack shrink={0} bg="$panel" borderTopWidth={1} borderColor="$edge">
          <XStack
            width="100%"
            maxW={960}
            mx="auto"
            items="center"
            flexWrap="wrap"
            gap="$2"
            px="$4"
            py="$3"
            $max-sm={{ px: '$3' }}
          >
            <Text flex={1} minW={100} fontSize="$2" color="$soft" numberOfLines={1}>
              {picked.length === 1 ? t('1 selected') : t('{n} selected', { n: picked.length })}
            </Text>
            <Control onPress={() => setPicked([])}>{t('Clear')}</Control>
            <Control onPress={() => void enter()} strong>
              {t(busy === 'conversation' ? 'Opening…' : 'Start conversation')}
            </Control>
          </XStack>
        </YStack>
      ) : null}

      {inviting ? <Invite owner={owner} onClose={() => setInviting(false)} /> : null}
      {hiring ? <Hire onClose={() => setHiring(false)} onMade={() => setHiring(false)} /> : null}
    </YStack>
  )
}

/** One row: a face, a name, a line about them, and what pressing it does. */
function Row({
  one,
  on,
  busy,
  onPress,
}: {
  one: Entry
  on: boolean
  busy: boolean
  onPress: () => void
}) {
  const { t } = useI18n()
  return (
    <Box
      render={<button type="button" />}
      onClick={onPress}
      aria-label={one.label}
      aria-pressed={one.kind === 'preset' ? undefined : on}
      width="100%"
      display="block"
      cursor="pointer"
      borderWidth={0}
      borderBottomWidth={1}
      borderBottomColor="$edge"
      bg={on ? '$raised' : 'transparent'}
      transition="quickest"
      hoverStyle={{ bg: on ? '$raised' : '$hover' }}
      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)', outlineOffset: -2 }}
      $max-sm={{ minH: 56 }}
    >
      <XStack gap="$3" items="center" px="$4" py="$3" $max-sm={{ px: '$3' }}>
        <Face src={one.avatar} emoji={one.emoji} name={one.name} size={34} />
        {/* A `<button>` centres its text; a row reads from its start. */}
        <YStack flex={1} minW={0} gap="$0.5">
          <Text fontSize="$3" fontWeight="500" color="$ink" numberOfLines={1} text="start">
            {one.label}
          </Text>
          {one.note ? (
            <Text fontSize="$2" color="$soft" numberOfLines={1} text="start">
              {one.note}
            </Text>
          ) : null}
        </YStack>
        {one.kind === 'preset' ? (
          <Text fontSize="$2" fontWeight="500" color="$aside" shrink={0}>
            {t(busy ? 'Installing…' : 'Install')}
          </Text>
        ) : on ? (
          <Check size={15} color="var(--foreground)" aria-hidden />
        ) : null}
      </XStack>
    </Box>
  )
}

/** A named control. One shape for every button in this app. */
function Control({
  children,
  onPress,
  icon,
  strong,
}: {
  children: React.ReactNode
  onPress: () => void
  icon?: React.ReactNode
  strong?: boolean
}) {
  return (
    <Box
      render={<button type="button" />}
      onClick={onPress}
      display="inline-flex"
      items="center"
      justify="center"
      minH={36}
      px="$3.5"
      py="$1.5"
      rounded="$3"
      borderWidth={1}
      borderColor={strong ? '$ink' : 'var(--border-strong)'}
      bg={strong ? '$ink' : 'transparent'}
      $platform-web={{ color: strong ? 'var(--background)' : 'var(--foreground)' }}
      transition="quickest"
      hoverStyle={{ bg: strong ? '$ink' : '$hover', opacity: strong ? 0.9 : 1 }}
      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
      $max-sm={{ minH: 44 }}
      cursor="pointer"
    >
      <XStack items="center" gap="$1.5">
        {icon ? (
          <Text display="inline-flex" items="center" color={strong ? '$background' : '$ink'}>
            {icon}
          </Text>
        ) : null}
        <Text fontSize="$2" color={strong ? '$background' : '$ink'} fontWeight={strong ? '600' : '500'} numberOfLines={1}>
          {children}
        </Text>
      </XStack>
    </Box>
  )
}

/** A switch that is on or off — a tab, an order. Same shape, so they read alike. */
function Pill({
  children,
  on,
  onPress,
}: {
  children: React.ReactNode
  on: boolean
  onPress: () => void
}) {
  return (
    <Box
      render={<button type="button" />}
      onClick={onPress}
      aria-pressed={on}
      display="inline-flex"
      items="center"
      justify="center"
      minH={32}
      px="$2.5"
      py="$1"
      rounded="$3"
      borderWidth={1}
      borderColor={on ? '$ink' : 'var(--border-strong)'}
      bg={on ? '$raised' : 'transparent'}
      transition="quickest"
      hoverStyle={{ bg: on ? '$raised' : '$hover' }}
      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
      $max-sm={{ minH: 44 }}
      cursor="pointer"
    >
      <Text fontSize="$2" fontWeight={on ? '500' : '400'} color={on ? '$ink' : '$soft'} numberOfLines={1}>
        {children}
      </Text>
    </Box>
  )
}

/**
 * ADDING A PERSON IS AN INVITATION, and it is the only honest shape for it.
 *
 * The other way in is `POST /v1/iam/users`, which takes the password the person
 * will sign in with — so adding a colleague would mean choosing their
 * credential and then telling it to them. An invitation is a code they redeem
 * on hanzo.id under a password only they ever see.
 *
 * The link is the deliverable. Nothing here sends mail: no route on the
 * platform mails an invitation, so this hands over the address instead of
 * claiming to have sent one.
 */
function Invite({ owner, onClose }: { owner: string; onClose: () => void }) {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  const make = async () => {
    if (busy) return
    setBusy(true)
    setWrong(null)
    try {
      const invitation = await createInvitation(owner, email.trim() || undefined)
      setLink(inviteLink(invitation.owner, invitation.code))
    } catch (e) {
      setWrong(reach(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box
      position="fixed"
      inset={0}
      z="var(--z-modal)"
      display="flex"
      items="center"
      justify="center"
      p="$3"
      bg="var(--surface-scrim)"
      onClick={(e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <YStack
        role="dialog"
        aria-modal
        aria-label={t('Invite')}
        width="calc(100vw - 24px)"
        maxW={440}
        gap="$4"
        p="$5"
        $max-sm={{ p: '$4' }}
        rounded="$6"
        borderWidth={1}
        borderColor="var(--border-strong)"
        bg="$background"
        boxShadow="var(--shadow-lg)"
      >
        <YStack gap="$1.5">
          <Text fontSize="$6" fontWeight="600" letterSpacing={-0.34} color="$ink">
            {t('Invite')}
          </Text>
          {link ? (
            <Text fontSize="$2" color="$soft" lineHeight="$3">
              {t('Share this one-time link to invite someone to {owner}.', { owner })}
            </Text>
          ) : (
            <Text fontSize="$2" color="$soft" lineHeight="$3">
              {t('Create a one-time invitation link for {owner}.', { owner })}
            </Text>
          )}
        </YStack>
        {link ? (
          <XStack items="center" gap="$2" minW={0} p="$2.5" rounded="$3" bg="$panel" borderWidth={1} borderColor="$edge">
            <Text data-i18n-ltr flex={1} minW={0} fontFamily="$mono" fontSize="$2" color="$ink" numberOfLines={1}>
              {link}
            </Text>
            <Take text={link} says={t('the invitation link')} label={t('Copy')} />
          </XStack>
        ) : (
          <YStack gap="$2">
            <Text
              render={
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void make()
                  }}
                  placeholder={t('Their email — or leave it open to anyone with the link')}
                  aria-label={t('Email')}
                  autoFocus
                />
              }
              width="100%"
              minH={38}
              bg="$panel"
              borderWidth={1}
              borderColor="var(--border-strong)"
              rounded="$3"
              px={12}
              py={8}
              $max-sm={{ minH: 44 }}
              outlineStyle="none"
              focusStyle={{ borderColor: 'var(--ring)' }}
              color="$ink"
              fontSize="$2"
            />
            {wrong ? (
              <Text role="alert" fontSize="$2" color="var(--state-error)">
                {wrong}
              </Text>
            ) : null}
          </YStack>
        )}
        <XStack justify="flex-end" gap="$2" pt="$1" flexWrap="wrap">
          <Control onPress={onClose}>{t(link ? 'Done' : 'Cancel')}</Control>
          {link ? null : (
            <Control onPress={() => void make()} strong>
              {t(busy ? 'Creating…' : 'Create invite link')}
            </Control>
          )}
        </XStack>
      </YStack>
    </Box>
  )
}
