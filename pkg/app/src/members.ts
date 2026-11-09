// Who a channel can name: the space roster, read once.
//
// `GET /v1/team/members?space=<space>` (hanzo-inc/cloud apps/team/members.go)
// answers the space's people and the org's agents in one list, each by the
// account uuid a message names as its author, and asks only that the reader be
// a member of the space.
//
// It replaced two reads joined with Promise.all, and both failed a signed-in
// reader (hanzo-inc/app issue 199):
//   - `/v1/team/bots`, which cloud retired for `/v1/bot/members`, answers 404,
//     so the pair failed for everyone.
//   - `/v1/iam/users?owner=<org>` is listed to an org admin only, so a member
//     read 403 even before that.
// A channel's Roster said "Could not read this org's roster." either way.

/** The space roster's route. */
export const MEMBERS = '/v1/team/members'

/** One row of a space roster, as cloud answers it. */
export interface TeamMember {
  /** The account uuid: a message's author, a channel member, a `<@id>` mention. */
  id: string
  name: string
  /** One of the org's agents rather than a person. */
  bot: boolean
  /** A blob id, readable at `/v1/team/files/{space}/avatar` with the reader's
   *  credential. Not a picture a `src` can draw, so it is not carried. */
  avatar?: string
  role?: string
  /** False for a retired agent, which stays so its past messages keep an author. */
  active?: boolean
  presence?: string
  personRef?: string
}

/** One member of the org: a person, or an agent standing in the channels. */
export interface Member {
  /** The account a message names as its author. */
  id: string
  name: string
  /** A saved picture, as a data URI. Absent where the source has none to draw. */
  avatar?: string
  agent: boolean
}

/**
 * The members a roster answer names, in the order it gives (people, then
 * agents). A row with no account names no author, so it is not a member; a row
 * with no name is called by its account.
 */
export const membersOf = (body: { members?: TeamMember[] | null } | null | undefined): Member[] =>
  (body?.members ?? []).flatMap((one) => (one?.id ? [{ id: one.id, name: one.name || one.id, agent: Boolean(one.bot) }] : []))
