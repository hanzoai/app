'use client'

// The inbox: what arrived, on whichever network carried it.
//
// IT READS LIKE MAIL, because that is what it is. The list stands beside what is
// open rather than being replaced by it: picking a message used to swap the
// whole pane, so choosing the next one meant going back first, and the list —
// the thing that tells you which to read — was never on screen while you read.
// Two columns is how every mail client has answered this, and the reason is the
// same here.
//
// ONE READING, MANY TRANSPORTS. `transport` is measured by the server, so the
// mark beside each face is a fact about the message. Nothing here enumerates
// the networks; `network.tsx` names the ones it can draw and falls back for the
// rest, so a fifth transport appears the day the platform reports one.
//
// IT HOLDS WHAT OTHER NETWORKS CARRY IN, and only that. The channels this org
// talks in are places on this platform, read and answered on /home
// (`channels.ts`); an arrival is a thread you REPLY to on the transport it came
// in on, and `conversations.ts` keys the two apart so one selection slot never
// holds two id spaces.
//
// IT IS TWO-WAY. The platform publishes `POST /v1/transport/{transport}/send`
// (HIP-1066), and `@hanzo/ai`'s transports client has no send method, so the
// reply goes through `client.http` here; when the SDK gains one, this call site
// is the only thing that moves.
//
// A reply box that cannot reply is still worse than none, which is why this one
// is drawn only where there is a channel id to address.

import { useCallback, useMemo, useRef, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { useInbox } from '@hanzo/ai/react'
import { ChannelHeader } from '@hanzo/ui/agents'
import { Composer } from '@hanzo/ui/chat'
import { Box, Text, XStack, YStack } from '@hanzo/ui'
import { useIam } from '@hanzo/iam/react'
import { Plus } from 'lucide-react'
import { useAi } from './lib/ai'
import { useOpen } from './open'
import { Face } from './cast'
import { plainly } from './failure'
import { channelName, Network, of, speaker } from './network'
import {
  conversationOf,
  useConversations,
  type Conversation,
} from './conversations'
import { Directory } from './Directory'
import { BAD } from './lib/mix'

/** Unix SECONDS, which is what the platform sends. Milliseconds here read as 1970. */
const when = (seconds: number, locale: string): string =>
  new Date(seconds * 1000).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

/** Today says the time; anything older says the day. A list scans on the part
 *  that differs, and for mail from this morning that is the clock. */
function stamp(seconds: number, locale: string): string {
  const then = new Date(seconds * 1000)
  const now = new Date()
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()
  return then.toLocaleString(
    locale,
    sameDay ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric' },
  )
}

/**
 * WHO WROTE, AND FROM WHERE — one mark.
 *
 * The face is a disc and the network is a square tucked into its corner,
 * because they answer two different questions and a reader should not have to
 * tell two circles apart. The disc draws neither picture nor initials: the
 * platform sends no likeness, and there is no name to reduce to letters — it
 * drew the head of the platform's id, which on Slack is the same letter for
 * everybody, so it told nobody apart while looking like somebody's initials.
 * A disc with nothing to say says '?', which is what it means.
 */
function Sender({ transport, size = 36 }: { transport: string; size?: number }) {
  return (
    <YStack width={size} height={size} shrink={0} position="relative">
      <Face size={size} />
      <YStack position="absolute" b={-2} insetInlineEnd={-2}>
        <Network transport={transport} size={Math.round(size * 0.46)} />
      </YStack>
    </YStack>
  )
}

/** Where a network is connected. Opens My Channels modal. */
function Connect() {
  const { t } = useI18n()
  const [modalOpen, setModalOpen] = useState(false)
  return (
    <>
      <Box
        render="button"
        onClick={() => setModalOpen(true)}
        px="$3"
        py="$2"
        rounded="$3"
        borderWidth={1}
        borderColor="$borderColor"
        hoverStyle={{ bg: '$hover' }}
        cursor="pointer"
      >
        <XStack items="center" gap="$1.5">
          <Plus size={13} aria-hidden />
          <Text fontSize="$2" color="$ink">
            {t('Connect an app')}
          </Text>
        </XStack>
      </Box>
      {/* THE ONE DIRECTORY, opened on its Channels tab: the same grid the rail's
          door reaches, reading the same registry. This used to open a modal of
          its own that marked a provider connected the moment it was pressed. */}
      <Directory open={modalOpen} onClose={() => setModalOpen(false)} tab="channels" />
    </>
  )
}

function Empty({ children, offer }: { children: string; offer?: boolean }) {
  const { t } = useI18n()
  return (
    <YStack flex={1} items="center" justify="center" p="$6" gap="$3">
      {/* THE APP'S ONE HEADING. Every state of an app owes a reader exactly one
          h1, and the empty states are the ones that shipped none — a crawler and
          a screen reader both land here first. It names the app, not the state. */}
      <Text render="h1" fontSize="$4" fontWeight="600" color="$ink">
        {t('Inbox')}
      </Text>
      <Text fontSize="$3" color="$soft" text="center" maxW={420}>
        {children}
      </Text>
      {offer ? <Connect /> : null}
    </YStack>
  )
}

/** The list, which stays on screen while you read down it. */
function Arrivals({
  conversations,
  open,
  onPick,
}: {
  conversations: Conversation[]
  open: string | null
  onPick: (key: string) => void
}) {
  const { t, locale } = useI18n()
  return (
    <YStack flex={1} minH={0}>
      <XStack
        height={48}
        shrink={0}
        items="center"
        px="$3"
        gap="$2"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <Text flex={1} fontSize="$3" fontWeight="600" color="$ink">
          {t('Inbox')}
        </Text>
        <Connect />
      </XStack>

      <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden">
        {/* ALREADY SORTED, by the one function that holds both sources — a
            second sort here would be a second answer to "which is newest", and
            the two would disagree the moment one of them learned about a unit. */}
        {conversations.map((one) => (
          <Box
            key={one.key}
            render="button"
            onClick={() => onPick(one.key)}
            aria-current={one.key === open}
            display="block"
            width="100%"
            cursor="pointer"
            borderBottomWidth={1}
            borderColor="var(--borderColor, var(--white-08))"
            bg={one.key === open ? 'var(--raised, var(--white-06))' : 'transparent'}
            hoverStyle={{ bg: '$hover' }}
          >
            <XStack gap="$3" items="center" p="$3">
              <Sender transport={one.transport} />
              {/* A gui Stack has no textAlign, and a `<button>` centres its text:
                  `alignItems` sets the lines at the start, and the title, which is
                  as wide as the row, says `start` itself. */}
              <YStack flex={1} minW={0} gap="$1" items="flex-start">
                <XStack width="100%" items="baseline" gap="$2">
                  <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1} flex={1} text="start">
                    {one.title}
                  </Text>
                  {/* A channel nobody has spoken in has no time to show, and 1970
                      is not a time. Silence is the honest answer. */}
                  {one.lastAt ? (
                    <Text fontSize="$1" color="$soft">
                      <bdi>{stamp(one.lastAt / 1000, locale)}</bdi>
                    </Text>
                  ) : null}
                </XStack>
                {/* The last thing said, on one line. A preview that wraps is a
                    transcript, and the list stops being scannable. */}
                {one.preview ? (
                  <Text fontSize="$2" color="$soft" numberOfLines={1}>
                    {one.preview}
                  </Text>
                ) : null}
              </YStack>
            </XStack>
          </Box>
        ))}
      </YStack>
    </YStack>
  )
}

/** What is open, beside the list rather than instead of it. */
function Reading({
  channel,
  reload,
}: {
  channel: ReturnType<typeof useInbox>['channels'][number]
  reload: () => void
}) {
  const { t, locale } = useI18n()
  const { client } = useAi()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  /**
   * Say it back, on the transport it arrived on.
   *
   * IDENTITY IS NOT A FIELD: the transport is the path segment and the sender is
   * the caller's validated org, and the route refuses a body carrying `sender`
   * or `account` with a 400 rather than dropping it quietly. So the body is the
   * channel and the words, and nothing else.
   *
   * The channel's own refusals are the reader's situation and are shown as the
   * platform words them — a channel this org has not bound is 403, and one whose
   * route the bot has never learned is 409, which means somebody has to message
   * it there first. `plainly` keeps those and answers for the estate's own.
   *
   * The list is re-read rather than appended to: what the transport accepted is
   * what it assigned an id and a landing second to, and inventing a local row
   * would put a message on screen that may not have gone.
   */
  const send = useCallback(async () => {
    const text = draft.trim()
    if (!client || !text || sending || !channel.channelId) return
    setSending(true)
    setFailed(null)
    try {
      await client.http.json({
        method: 'POST',
        path: `/v1/transport/${encodeURIComponent(channel.transport)}/send`,
        body: { channel: { id: channel.channelId }, text },
      })
      setDraft('')
      reload()
    } catch (e) {
      setFailed(plainly(e, t('this conversation'), t))
    } finally {
      setSending(false)
    }
  }, [client, draft, sending, channel.transport, channel.channelId, reload, t])

  return (
    <YStack flex={1} minH={0}>
      {/* A channel is named by its own address, not by whoever spoke in it last.
          One person is the handle we hold for them; several is the network's
          id for the channel, which useInbox already groups on and which is the
          only thing that tells two channels on one network apart. */}
      <ChannelHeader
        name={channelName(channel)}
      >
        <XStack items="center" gap="$1.5">
          <Network transport={channel.transport} size={14} />
          <Text fontSize="$2" color="$soft">
            {of(channel.transport).name}
          </Text>
        </XStack>
      </ChannelHeader>

      <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden" p="$4" gap="$3">
        {/* Oldest first, so a conversation reads down the way it happened. The
            page arrives newest-first because that is how a cursor pages. */}
        {[...channel.messages]
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((message) => (
            <XStack key={message.id} gap="$3" items="flex-start">
              <Sender transport={channel.transport} size={32} />
              <YStack flex={1} minW={0} gap="$1">
                <XStack gap="$2" items="baseline">
                  <Text fontSize="$3" fontWeight="500" color="$ink">
                    {speaker(channel.transport, message.sender)}
                  </Text>
                  <Text fontSize="$1" color="$soft">
                    <bdi>{when(message.createdAt, locale)}</bdi>
                  </Text>
                </XStack>
                <Text fontSize="$3" color="$ink">
                  {message.text}
                </Text>
              </YStack>
            </XStack>
          ))}
      </YStack>

      <YStack p="$3" gap="$2" borderTopWidth={1} borderColor="$borderColor">
        {/* NO CHANNEL ID, NO REPLY. The send route addresses a channel and refuses a
            body without one, so a composer here would take what somebody typed
            and drop it — which is the thing this pane refused to do while there
            was no route at all. */}
        {channel.channelId ? (
          <>
            <Composer
              value={draft}
              onChange={setDraft}
              onSend={() => void send()}
              busy={sending}
              placeholder={t('Reply on {network}', { network: of(channel.transport).name })}
              label={t('Reply on {network}', { network: of(channel.transport).name })}
            />
            {failed ? (
              <Text fontSize="$2" color={BAD}>
                {failed}
              </Text>
            ) : null}
          </>
        ) : (
          <Text fontSize="$2" color="$soft">
            {t('This message names no channel to answer in.')}
          </Text>
        )}
      </YStack>
    </YStack>
  )
}

function InboxGrip({
  span,
  onSpan,
}: {
  span: number
  onSpan: (n: number) => void
}) {
  const { t, dir } = useI18n()
  // The list stands at the start: under right to left a pull toward the start widens it.
  const way = dir === 'rtl' ? -1 : 1
  const held = useRef(0)
  return (
    <Box
      render="div"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('Resize inbox channel list')}
      aria-valuenow={span}
      tabIndex={0}
      position="absolute"
      t={0}
      b={0}
      insetInlineEnd={-3}
      width={6}
      z={10}
      cursor="col-resize"
      hoverStyle={{ bg: '$borderColor' }}
      onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        held.current = e.clientX * way - span
      }}
      onPointerMove={(e: React.PointerEvent<HTMLDivElement>) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        const want = e.clientX * way - held.current
        const clamped = Math.min(540, Math.max(220, want))
        onSpan(clamped)
      }}
      onPointerUp={() => {
        try {
          localStorage.setItem('hanzo.inbox.span', String(span))
        } catch {}
      }}
    />
  )
}

function ReadingInbox() {
  const { t } = useI18n()
  const { channel, openChannel } = useOpen()
  const { conversations, loading, reload } = useConversations()
  const [listSpan, setListSpan] = useState<number>(() => {
    if (typeof window === 'undefined') return 320
    try {
      const stored = localStorage.getItem('hanzo.inbox.span')
      return stored ? Math.max(220, Math.min(540, parseInt(stored, 10))) : 320
    } catch {
      return 320
    }
  })

  const open = useMemo(() => conversationOf(conversations, channel), [conversations, channel])

  if (loading && conversations.length === 0) return <Empty>{t('Reading your messages.')}</Empty>

  if (conversations.length === 0) {
    return (
      <Empty offer>
        {t('Nothing has arrived yet. Connect an app and the messages it carries land here — mail, chat, and the networks your work already happens on.')}
      </Empty>
    )
  }

  return (
    <XStack flex={1} minH={0} position="relative">
      {/* THE LIST IS A COLUMN, not the whole pane. On a phone there is space for
          one of the two, so what is open takes it and the list is a step back;
          from a tablet up they stand side by side, which is the shape the
          reading is actually done in. */}
      <YStack
        display={open ? 'none' : 'flex'}
        $md={{ display: 'flex', width: listSpan, shrink: 0, borderInlineEndWidth: 1 }}
        flex={1}
        minH={0}
        borderColor="$borderColor"
        position="relative"
      >
        <Arrivals conversations={conversations} open={channel} onPick={openChannel} />
        <InboxGrip span={listSpan} onSpan={setListSpan} />
      </YStack>

      {/* An arrival is replied to on the transport it came in on. */}
      {open ? (
        <YStack flex={1} minW={0} minH={0}>
          <Reading channel={open.arrival} reload={reload} />
        </YStack>
      ) : (
        <YStack display="none" $md={{ display: 'flex' }} flex={1} minW={0}>
          <Empty>{t('Pick a conversation to read it.')}</Empty>
        </YStack>
      )}
    </XStack>
  )
}

/**
 * The pane, and the session its reads need.
 *
 * SPLIT so the hooks below never run for a reader with none: every route this
 * pane reads is org-scoped and answers 403 without one, and a hook cannot be
 * called conditionally — so the condition is a component boundary rather than
 * an `if` the rules forbid.
 */
export function Inbox() {
  const { isLoading } = useIam()
  if (isLoading) return <Empty>&nbsp;</Empty>
  return <ReadingInbox />
}
