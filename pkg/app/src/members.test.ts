import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { MEMBERS, membersOf } from './members'

const here = dirname(fileURLToPath(import.meta.url))
const source = (file: string) => readFileSync(join(here, file), 'utf8')

// A space's roster as cloud answers GET /v1/team/members?space=<space>
// (hanzo-inc/cloud apps/team/members.go): people first, then the org's agents.
const answer = {
  members: [
    { id: '9f2a', name: 'Ada Lovelace', avatar: 'blob-1', bot: false, role: 'owner', active: true, presence: 'online', personRef: 'person-9f2a' },
    { id: '4c1e', name: 'Concierge', bot: true, role: 'member', active: true, presence: 'offline', personRef: 'person-4c1e' },
    { id: '77b0', name: 'Retired', bot: true, role: 'member', active: false, presence: 'offline', personRef: 'person-77b0' },
  ],
}

describe("a channel's roster", () => {
  test('is the space roster: the route every member of the space may read', () => {
    expect(MEMBERS).toBe('/v1/team/members')
  })

  test('names each person and agent by the account a message carries as its author', () => {
    expect(membersOf(answer)).toEqual([
      { id: '9f2a', name: 'Ada Lovelace', agent: false },
      { id: '4c1e', name: 'Concierge', agent: true },
      // A retired agent stays, so its past messages keep an author.
      { id: '77b0', name: 'Retired', agent: true },
    ])
  })

  test("never hands Face the roster's avatar, which is a blob id and not a picture", () => {
    expect(membersOf(answer).every((one) => one.avatar === undefined)).toBe(true)
  })

  test('drops a row with no account, and falls back to the account for a row with no name', () => {
    expect(membersOf({ members: [{ id: '', name: 'Nobody', bot: false }, { id: '5d3c', name: '', bot: false }] })).toEqual([
      { id: '5d3c', name: '5d3c', agent: false },
    ])
  })

  test('reads an empty or missing answer as nobody', () => {
    expect(membersOf({ members: [] })).toEqual([])
    expect(membersOf({})).toEqual([])
    expect(membersOf(null)).toEqual([])
  })

  // hanzo-inc/app issue 199. The roster joined two reads, and both fail a signed-in
  // reader: /v1/team/bots answers 404 since cloud moved bots to /v1/bot/members, and
  // IAM lists /v1/iam/users?owner=<org> to an org admin only. Promise.all failed the
  // pair, so a channel's Roster said "Could not read this org's roster." for everyone.
  test('useRoster reads the space roster, and Talk hands it the channel space', () => {
    const roster = source('roster.ts')
    expect(roster).not.toMatch(/\/v1\/team\/bots/)
    expect(roster).not.toMatch(/\/v1\/iam\/users/)
    expect(roster).toMatch(/path:\s*MEMBERS/)
    expect(source('Talk.tsx')).toMatch(/useRoster\(channel\.space\)/)
  })
})
