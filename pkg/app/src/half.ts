// Which read a half of the sidebar's roster answers for.
//
// The sidebar draws the roster as two halves, the org's people and its agents,
// from two reads that fail apart: the agents from `/v1/agents`, the people from
// IAM's SCIM directory. IAM lists an org's people to an org admin only (403
// "listing users requires org-admin"), so for an ordinary member the people read
// fails every time while the agents read answers.
//
// hanzo.bot/bots draws the agents half alone. It used to report whichever read
// had failed, so every member who is not an org admin read "This account cannot
// open this org's roster." over agents that had loaded (hanzo-inc/app issue 199).
// A half reports its own read and no other: its own wait, its own failure.

export type Half = 'agents' | 'people'

/** One read's state, as `useAgents` and `usePeople` answer it. */
export interface Read {
  loading: boolean
  error: Error | null
}

/** The read the half `show` draws: the only one whose wait and failure it reports. */
export const half = (show: Half, reads: Record<Half, Read>): Read => reads[show]
