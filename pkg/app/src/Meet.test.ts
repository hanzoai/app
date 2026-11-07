import { describe, expect, test, vi } from 'vitest'

// The screen's components are not under test, only who it seats.
vi.mock('@hanzo/gui', () => ({}))
vi.mock('@hanzo/ui', () => ({}))
vi.mock('@hanzo/voice', () => ({}))
vi.mock('@hanzo/iam/react', () => ({}))
vi.mock('./speech', () => ({}))

const { AVAILABLE_MEETING_AGENTS } = await import('./Meet')
const { member } = await import('./team')

describe('the agents a meeting can seat', () => {
  test('each team member among them is on the team, by its name and part', () => {
    const seated = AVAILABLE_MEETING_AGENTS.filter((one) => member(one.id))
    expect(seated.map((one) => one.id)).toEqual(['opera', 'des', 'vi', 'su', 'law'])
    for (const one of seated) expect(one).toMatchObject({ name: member(one.id)!.name, role: member(one.id)!.role })
  })
})
