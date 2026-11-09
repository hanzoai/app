import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { half, type Read } from './half'

const here = dirname(fileURLToPath(import.meta.url))

// IAM's answer to a member who is not an org admin, as @hanzo/ai raises it:
// GET /v1/iam/scim/v2/Users?owner=<org> → 403 (hanzoai/iam internal/scim/users.go).
const refused = Object.assign(new Error('listing users requires org-admin'), { status: 403 })
const done: Read = { loading: false, error: null }
const reading: Read = { loading: true, error: null }

describe("the sidebar roster's halves", () => {
  // hanzo-inc/app issue 199: hanzo.bot/bots draws the agents half only, and it said
  // "This account cannot open this org's roster." over agents that had loaded,
  // because the people read IAM refuses a member had failed beside it.
  test("the agents half does not report the people read's refusal", () => {
    expect(half('agents', { agents: done, people: { loading: false, error: refused } })).toEqual(done)
  })

  test('the people half still reports it', () => {
    expect(half('people', { agents: done, people: { loading: false, error: refused } }).error).toBe(refused)
  })

  test('the agents half reports its own failure', () => {
    const down = Object.assign(new Error('The service is not running right now.'), { status: 503 })
    expect(half('agents', { agents: { loading: false, error: down }, people: done }).error).toBe(down)
  })

  test('a half waits on its own read only', () => {
    expect(half('agents', { agents: done, people: reading }).loading).toBe(false)
    expect(half('people', { agents: reading, people: done }).loading).toBe(false)
    expect(half('agents', { agents: reading, people: done }).loading).toBe(true)
  })

  test("Shell's roster section takes its wait and its failure from the half it draws", () => {
    const shell = readFileSync(join(here, 'Shell.tsx'), 'utf8')
    expect(shell).toMatch(/=\s*half\(show,/)
    expect(shell).not.toMatch(/agentsWrong\s*\?\?\s*peopleWrong|peopleWrong\s*\?\?\s*agentsWrong/)
    expect(shell).not.toMatch(/agentsLoading\s*\|\|\s*peopleLoading|peopleLoading\s*\|\|\s*agentsLoading/)
  })
})
