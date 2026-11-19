import { describe, expect, test, vi } from 'vitest'

// The screen's components are not under test, only who it seats.
vi.mock('@hanzo/gui', () => ({}))
vi.mock('@hanzo/ui', () => ({}))
vi.mock('@hanzo/voice', () => ({}))
vi.mock('@hanzo/iam/react', () => ({}))
vi.mock('./speech', () => ({}))

const { AVAILABLE_MEETING_AGENTS, invited } = await import('./Meet')
const { member } = await import('./team')

describe('the agents a meeting can seat', () => {
  test('each team member among them is on the team, by its name and part', () => {
    const seated = AVAILABLE_MEETING_AGENTS.filter((one) => member(one.id))
    expect(seated.map((one) => one.id)).toEqual(['opera', 'des', 'vi', 'su', 'law'])
    for (const one of seated) expect(one).toMatchObject({ name: member(one.id)!.name, role: member(one.id)!.role })
  })
})

describe('who is the co-pilot', () => {
  test('the first agent asked is the co-pilot, and a later one is not', () => {
    const one = invited([], null, 'des')
    expect(one).toEqual({ invited: ['des'], copilot: 'des' })
    expect(invited(one.invited, one.copilot, 'vi')).toEqual({ invited: ['des', 'vi'], copilot: 'des' })
  })
  test('when the co-pilot is sent away the next in line takes over, and the last leaving leaves none', () => {
    expect(invited(['des', 'vi'], 'des', 'des')).toEqual({ invited: ['vi'], copilot: 'vi' })
    expect(invited(['vi'], 'vi', 'vi')).toEqual({ invited: [], copilot: null })
  })
  test('sending away one who is not the co-pilot keeps the co-pilot', () => {
    expect(invited(['des', 'vi'], 'des', 'vi')).toEqual({ invited: ['des'], copilot: 'des' })
  })
})
