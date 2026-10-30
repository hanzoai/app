'use client'

// The org's channels: the one reader and writer for /v1/team/channels
// (HIP-0523 §2.1).
//
// A channel is not the sidebar's private business. The rail lists them, /home
// reads one, and the composer needs the space off it to address anything — so
// the list, the key, the transcript and the two writes live here, in one shape,
// and no second module holds another opinion about what a channel is.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useIam } from '@hanzo/iam/react'
import { useAi } from './lib/ai'
import { where } from './where'

/**
 * A channel as Team keeps it: an open one, a direct message, or one bound to
 * work.
 *
 * `direct` is the distinction the sidebar draws — a channel anyone in the org
 * can read against a conversation between two people — so it decides the sigil
 * and the section rather than a guess from the name.
 *
 * `space` is half of a channel's address: two spaces of one org may each hold a
 * #general, so the pair identifies one and the id alone does not. It is also
 * the box a file goes in — `/v1/team/files/{space}` is addressed by space, never
 * by channel. The field is the server's own name for it.
 */
export interface Channel {
  id: string
  space: string
  name: string
  topic?: string
  desc?: string
  direct: boolean
  private: boolean
  visibility?: 'public' | 'org' | 'private'
  orgId?: string
  archived: boolean
  members: string[]
  count?: number
  /**
   * What the channel is FOR — "standing" for one meant to outlive any task,
   * "bound" for one opened for a single piece of work. Absent reads standing.
   * It is intent, not state: whether the channel is open now is `archived`.
   */
  life?: string
  /**
   * What the channel is ABOUT, each a "<kind>:<ref>" — "repo:hanzoai/cloud",
   * "issue:1010". References, never copies: the app that owns a project is the
   * one that can resolve it.
   */
  bindings?: string[]
}

/**
 * The key the workspace selects a channel by, and puts in the address:
 * `team:<space>/<id>`. Both halves, because a channel id is unique within a
 * space and not across the org. Prefixed rather than hashed, because a key a
 * person can read in a URL is one they can report in a bug.
 */
export const teamKey = (channel: Pick<Channel, 'space' | 'id'>): string =>
  `team:${channel.space}/${channel.id}`

/** The address a key names, or null for a key that is not a channel's. */
export function fromKey(key: string | null): { space: string; id: string } | null {
  const found = key?.match(/^team:([^/]+)\/(.+)$/)
  return found ? { space: found[1], id: found[2] } : null
}

/** The page a key opens on: Home, carrying it as the `?channel=` that
 *  the host's Home reads on arrival. */
export const channelHref = (key: string): string => `${where().home}?${new URLSearchParams({ channel: key })}`

/**
 * ONE LIST FOR EVERY VIEW. The rail, the Channels card and the open channel all
 * read the org's channels, and they read this: one fetch, one answer, one place
 * a channel opened from any of them lands in all of them at once. A per-view
 * copy is how a channel you just opened is absent from the rail beside it.
 *
 * It lives outside React for the reason `open.ts` does — the views are on both
 * sides of the router — and it resets on a real page load.
 */
interface Held {
  channels: Channel[] | null
  wrong: unknown
}

/** The prerender's answer, and the first one. A stable reference, because
 *  React compares snapshots by identity. */
const UNKNOWN: Held = { channels: null, wrong: null }

let held: Held = UNKNOWN
/** Bumped by `reload`; a read is made once per value. */
let epoch = 0
let asked = -1
const listeners = new Set<() => void>()

function publish(next: Held): void {
  held = next
  for (const one of listeners) one()
}

function subscribe(one: () => void): () => void {
  listeners.add(one)
  return () => {
    listeners.delete(one)
  }
}

/** Asks the platform again. The list held stays on screen until it answers. */
export function reloadChannels(): void {
  epoch += 1
  publish({ channels: held.channels, wrong: null })
}

/**
 * The org's real channels, from Team, and the way to add one.
 *
 * `/v1/team/channels` is the org's own list and answers only a validated
 * principal. An archived channel is not drawn: it is one the org closed, and a
 * sidebar that lists them makes leaving one meaningless.
 *
 * NULL IS UNKNOWN AND IT IS NOT EMPTY. Three states, and the caller owes a
 * sentence for each: `null` while nothing is known, `[]` for an org that
 * genuinely has no channels, and `wrong` for a service that answered no. A list is
 * never fabricated to cover any of them.
 *
 * `open` posts a channel and HOLDS the one the platform answered with: a 201
 * is `{channel}`, the stored channel, so every view carries it from that moment
 * and the reader can step into it without a second read. The server adds nobody
 * to a channel, so the caller names its own members.
 */
export function useChannels(): {
  channels: Channel[] | null
  wrong: unknown
  reload: () => void
  open: (channel: { name: string; space?: string; members: string[] }) => Promise<Channel>
} {
  const { client } = useAi()
  const { user } = useIam()
  const now = useSyncExternalStore(subscribe, () => held, () => UNKNOWN)

  useEffect(() => {
    if (!client || !user || asked === epoch) return
    asked = epoch
    const mine = epoch
    client.http
      .json<{ channels?: Channel[] }>({ path: '/v1/team/channels' })
      .then((page) => {
        if (mine === epoch) publish({ channels: (page.channels ?? []).filter((c) => !c.archived), wrong: null })
      })
      .catch((e: unknown) => {
        if (mine === epoch) publish({ channels: null, wrong: e })
      })
  }, [client, user, now])

  const open = useCallback(
    async (channel: { name: string; space?: string; members: string[] }) => {
      if (!client) throw Object.assign(new Error('Sign in to open a channel'), { status: 401 })
      const { channel: made } = await client.http.json<{ channel: Channel }>({
        method: 'POST',
        path: '/v1/team/channels',
        body: channel,
      })
      publish({ channels: [...(held.channels ?? []), made], wrong: null })
      return made
    },
    [client],
  )

  return { channels: now.channels, wrong: now.wrong, reload: reloadChannels, open }
}

/** The channel with that id, or undefined for none open. */
export function channelOf(channels: Channel[] | null, id: string | null): Channel | undefined {
  return id && channels ? channels.find((c) => c.id === id) : undefined
}

/**
 * One thing somebody said in a channel.
 *
 * `author` is the team ACCOUNT that wrote it, not a name: what to call somebody
 * is the roster's answer (`roster.ts`), and copying it onto every message is
 * how the two come to disagree. `text` is plain — the platform stores the
 * client's markup and reduces it on the way out, so nothing here parses HTML.
 */
export interface Message {
  id: string
  /** The channel's id. */
  channel: string
  author: string
  text: string
  /** Unix MILLIseconds, which is what the platform stamps. */
  createdOn: number
}

/**
 * One row per id, in the platform's order — `createdOn`, then `id` — so a row
 * held from a send and the same row read back by the next poll sit in one place.
 */
const order = (rows: Message[]): Message[] =>
  [...new Map(rows.map((one) => [one.id, one])).values()].sort(
    (a, b) => a.createdOn - b.createdOn || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )

/** How often an open channel asks what was said. */
const PACE = 2000

/**
 * A channel's conversation, and the way to add to it.
 *
 * READ AND WRITE IN ONE HOOK, because they are one question — a pane that can
 * show a channel and not answer in it is a directory — and because the poller
 * and the sender then cannot disagree about what the channel holds.
 *
 * THE CHANNEL IS POLLED, every two seconds while it is open and the tab is
 * showing. The team plane has no push a browser can read but its transactor
 * socket, which is a binary protocol rather than a line; a read costs a few
 * hundred milliseconds and nothing on the server past the space's own
 * messages, so half a request a second per open channel is the honest price of
 * seeing an answer land. Each read carries its own AbortController, and the
 * cleanup aborts the one in flight and stops the clock — on unmount, and when
 * the channel or its space changes.
 *
 * `send` posts and answers the row the platform stored: a 201 is the message,
 * with its id and stamp, so the hook holds it at once and the next poll finds
 * the same id and keeps one. Nothing the platform did not accept is ever held.
 *
 * `space` is half a channel's address (two spaces of one org may each hold a
 * channel with one id), so both calls carry it and a channel with neither reads
 * empty rather than guessing.
 */
export function useMessages(channel: string | null, space: string | undefined) {
  const { client } = useAi()
  const { user } = useIam()
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [failed, setFailed] = useState<unknown>(null)
  const [read, setRead] = useState(0)

  const again = useCallback(() => setRead((n) => n + 1), [])

  useEffect(() => {
    if (!channel) {
      setMessages(null)
      return
    }
    if (!client || !user || !space) return
    const path = `/v1/team/channels/${encodeURIComponent(channel)}/messages`
    let stop: AbortController | null = null
    const look = () => {
      stop?.abort()
      stop = new AbortController()
      const { signal } = stop
      client.http
        .json<{ messages?: Message[] }>({ path, query: { space }, signal })
        .then((page) => {
          if (signal.aborted) return
          setFailed(null)
          // An empty channel reads empty: `[]` is the answer, not the absence of one.
          setMessages(order(page.messages ?? []))
        })
        .catch((e: unknown) => {
          if (!signal.aborted) setFailed(e)
        })
    }
    look()
    const clock = setInterval(() => {
      if (!document.hidden) look()
    }, PACE)
    return () => {
      clearInterval(clock)
      stop?.abort()
    }
  }, [client, user, channel, space, read])

  /** Says it and answers the stored row, or throws with the platform's status. */
  const send = useCallback(
    async (text: string): Promise<Message> => {
      if (!client || !channel || !space) {
        throw Object.assign(new Error('This channel has no address to send to'), { status: 503 })
      }
      const row = await client.http.json<Message>({
        method: 'POST',
        path: `/v1/team/channels/${encodeURIComponent(channel)}/messages`,
        body: { space, text },
      })
      setMessages((held) => order([...(held ?? []), row]))
      again()
      return row
    },
    [client, channel, space, again],
  )

  return { messages, failed, send, reload: again }
}
