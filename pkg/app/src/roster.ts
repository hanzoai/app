'use client'

// Who is in a space, by account — the ONE place an author becomes a name.
//
// A message carries the team account that wrote it and nothing else: for a
// person that is their IAM user id (the OIDC `sub`, which team's account id
// equals), for an agent the account team derives from its id. The space roster
// answers both in one list (members.ts), so the transcript, the roster column
// and the mention chips cannot disagree about what to call anybody.

import { useEffect, useState } from 'react'
import { useIam } from '@hanzo/iam/react'
import { useAi } from './lib/ai'
import { MEMBERS, membersOf, type Member, type TeamMember } from './members'

export type { Member } from './members'

/**
 * The members of the space a channel stands in, or null while unknown.
 *
 * Needs a session and the space: the roster is read per space and answers only
 * a member of it. A service account carries no id and can author nothing, so it
 * is not a member here.
 */
export function useRoster(space: string | undefined): { members: Member[] | null; wrong: unknown } {
  const { client } = useAi()
  const { isAuthenticated } = useIam()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [wrong, setWrong] = useState<unknown>(null)

  useEffect(() => {
    if (!client || !isAuthenticated || !space) return
    let live = true
    const stop = new AbortController()
    client.http
      .json<{ members?: TeamMember[] }>({ path: MEMBERS, query: { space }, signal: stop.signal })
      .then((body) => {
        if (live) setMembers(membersOf(body))
      })
      .catch((e: unknown) => {
        if (live) setWrong(e)
      })
    return () => {
      live = false
      stop.abort()
    }
  }, [client, isAuthenticated, space])

  return { members, wrong }
}

/** The member an author id names, or undefined for one the roster lacks. */
export const memberOf = (members: Member[] | null, id: string): Member | undefined =>
  members?.find((one) => one.id === id)

/**
 * The reader's own account, from the userinfo the session holds. OIDC names it
 * `sub`, and team's account id is that same uuid — so it is the id a channel's
 * members list and a message's author carry for this reader.
 */
export function useMe(): string | null {
  const { user } = useIam()
  const sub = (user as { sub?: unknown } | null)?.sub
  return typeof sub === 'string' && sub ? sub : null
}
