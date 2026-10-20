import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

// The drawing libraries and the platform are not under test. The org's agents
// are whatever `org` holds, the open conversation seats `room` and a pick asks
// `seated` (open.ts toggles); a press of Manage records where it went.
const { org, room, seated, went } = vi.hoisted(() => ({
  org: { agents: [] as { id: string; name: string; avatar?: string }[], error: null as Error | null },
  room: [] as string[],
  seated: [] as string[],
  went: [] as string[],
}))

vi.mock('@hanzo/ui', async () => {
  const { createElement } = await import('react')
  const part = ({ children }: { children?: unknown }) => createElement('div', null, children as never)
  return { Box: part, Button: part, Input: () => null, Text: part, Textarea: () => null, View: part, XStack: part, YStack: part }
})
vi.mock('./cast', () => ({ Face: () => null }))
vi.mock('./lib/ai', () => ({ useAi: () => ({ client: null }) }))
vi.mock('./host', () => ({ useRooms: () => ({ path: '/chat' }) }))
vi.mock('./lib/host', () => ({ app: (at: string) => `/dev/${at.slice(2)}`, go: (to: string) => went.push(to) }))
vi.mock('./open', () => ({ useOpen: () => ({ agents: room, openAgent: (name: string) => seated.push(name) }) }))
vi.mock('@hanzo/ai/react', () => ({
  useAgents: () => ({ agents: org.agents, loading: false, error: org.error, reload: () => {}, create: async () => ({}) }),
  useModels: () => ({ models: [] }),
}))

import { Hire, useAgentShelf } from './crew'
import type { Shelf } from './agents'

/** The shelf as the composer reads it now. */
function shelf(): Shelf {
  let out: Shelf | null = null
  const Read = () => {
    out = useAgentShelf()
    return null
  }
  renderToStaticMarkup(createElement(Read))
  return out!
}

const on = (s: Shelf) => s.rows.filter((r) => r.on).map((r) => r.label)

afterEach(() => {
  room.length = 0
  seated.length = 0
  org.agents = []
  org.error = null
  went.length = 0
})

describe('the Agents shelf', () => {
  test('lists the default cast by name and part, with the ways to make, manage and find more', () => {
    const s = shelf()
    expect(s.rows.map((r) => r.label)).toEqual(['Dev', 'Des', 'Vi', 'Feynman', 'Einstein', 'Nora', 'Maya', 'Leo'])
    expect(s.rows[0].note).toBe('Engineer')
    expect([s.create?.label, s.manage?.label, s.browse?.label]).toEqual(['Create agent', 'Manage agents', 'Browse personas'])
    s.manage!.onPress()
    expect(went).toEqual(['/dev/customize/agents'])
  })

  test('puts the org’s agents after the cast, under their own names', () => {
    org.agents = [{ id: 'agent_ops', name: 'ops' }, { id: 'agent_dev', name: 'dev' }]
    const s = shelf()
    expect(s.rows.map((r) => r.id)).toEqual(['dev', 'Des', 'Vi', 'Feynman', 'Einstein', 'Nora', 'Maya', 'Leo', 'ops'])
    expect(s.rows[0].label).toBe('Dev')
    expect(s.rows.at(-1)?.label).toBe('ops')
  })

  test('marks who the open conversation holds, whatever the case, and a pick toggles the agent by the name a reader sees', () => {
    org.agents = [{ id: 'agent_dev', name: 'dev' }, { id: 'agent_ops', name: 'ops' }]
    room.push('Dev', 'OPS')
    const s = shelf()
    expect(on(s)).toEqual(['Dev', 'ops'])
    s.pick('dev')
    s.pick('Vi')
    s.pick('ops')
    expect(seated).toEqual(['Dev', 'Vi', 'ops'])
  })

  test('says why the org’s list did not load and keeps the cast', () => {
    org.error = new Error('agents: 503')
    const s = shelf()
    expect(s.error).toContain('503')
    expect(s.rows).toHaveLength(8)
  })
})

describe('the New agent sheet', () => {
  const draw = (start: boolean) => renderToStaticMarkup(createElement(Hire, { onClose: () => {}, onMade: () => {}, start }))

  test('opens blank with a way to start from a persona, or on the persona list', () => {
    expect(draw(false)).toContain('New agent')
    expect(draw(false)).toContain('Start from a persona')
    expect(draw(false)).toContain('Draw')
    expect(draw(true)).toContain('Start from a persona')
    expect(draw(true)).toContain('Reading the personas…')
    expect(draw(true)).not.toContain('Spending limit')
  })
})
