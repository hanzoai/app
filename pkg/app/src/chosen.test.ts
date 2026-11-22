import { afterEach, describe, expect, test, vi } from 'vitest'

// Kai's answer and the skills' words, as @hanzo/build gives them: each test says what Kai picks.
const kai = vi.hoisted(() => ({ found: [] as { name: string; skill: boolean; probability?: number }[], asked: [] as string[], taught: [] as string[][], fail: false }))
vi.mock('@hanzo/build', () => ({
  detect: async (_t: unknown, prompt: string) => {
    kai.asked.push(prompt)
    if (kai.fail) throw new Error('kai is away')
    return kai.found.map((f) => ({ source: f.skill ? 'skill' : 'mcp', description: '', probability: 0.9, ...f }))
  },
  skillsSaid: async (_t: unknown, names: string[], max: number) => {
    kai.taught.push(names)
    return names.map((n) => `Use the skill "${n}" where it applies:\n\n${'x'.repeat(max + 10).slice(0, max)}`).join('\n\n')
  },
}))

const { CHOSEN_MAX, EXPLICIT_CHOSEN, EXPLICIT_SURE, NONE, carried, choosable, choose, parseSkillCommand, personas, skillContext, within } = await import('./chosen')
const target = { api: 'https://api.hanzo.ai', token: () => 'tok' } as never

afterEach(() => {
  kai.found = []
  kai.asked = []
  kai.taught = []
  kai.fail = false
})

describe('Hanzo chooses the skills, agents and personas a message needs (hanzo-inc/app issue 314)', () => {
  test('carries what Kai picks for that message, at most two skills, each cut short', async () => {
    kai.found = [
      { name: 'frontend-design', skill: true },
      { name: 'github_create_issue', skill: false },
      { name: 'webapp-testing', skill: true },
      { name: 'api-design', skill: true },
    ]
    const got = await choose(target, 'Make my landing page look better on phones')
    expect(got.names).toEqual(['frontend-design', 'webapp-testing'])
    expect(got.text).toContain('Use the skill "frontend-design" where it applies')
    expect(got.text.length).toBeLessThan(2 * (CHOSEN_MAX + 200))
  })

  test('never chooses again what is preloaded, and names again rather than re-carries what the conversation had', async () => {
    kai.found = [
      { name: 'code-review', skill: true },
      { name: 'security-review', skill: true },
      { name: 'simplify', skill: true },
    ]
    const got = await choose(target, 'Review this pull request for problems', ['code-review'], ['security-review'])
    expect(got.names).toEqual(['security-review', 'simplify'])
    expect(kai.taught).toEqual([['simplify']])
    expect(got.text).toContain('Use the "security-review" skill where it applies, as earlier in this conversation.')
  })

  test('asks nothing for a short message, and sends a message as it is when Kai is away', async () => {
    expect(await choose(target, 'thanks!')).toEqual(NONE)
    expect(kai.asked).toEqual([])
    kai.fail = true
    expect(await choose(target, 'Plan a launch for my new bakery')).toEqual(NONE)
  })

  test('chooses only what Kai is sure of and a person could have picked from +', async () => {
    kai.found = [
      { name: 'react-doctor', skill: true, probability: 0.95 },
      { name: 'audit_audit', skill: true, probability: 0.93 },
      { name: 'agent-browser', skill: true, probability: 0.62 },
      { name: 'security-review', skill: true, probability: 0.86 },
      { name: 'simplify', skill: true, probability: 0.81 },
    ]
    const shelf = ['security-review', 'simplify', 'code-review', 'audit_audit']
    const got = await choose(target, 'Find the security problems in my login code and simplify it', [], [], undefined, shelf)
    expect(got.names).toEqual(['security-review', 'simplify'])
    // Until the shelf is read, any skill Kai is sure of may join, never an API descriptor.
    expect((await choose(target, 'Find the security problems in my login code and simplify it')).names).toEqual(['react-doctor', 'security-review'])
    expect(choosable('audit_audit')).toBe(false)
    expect(choosable('frontend-design', ['simplify'])).toBe(false)
    expect(choosable('simplify', ['simplify'])).toBe(true)
  })

  test('reads which skills earlier turns carried', () => {
    expect(
      carried([
        { role: 'user', content: 'hi\n\n<workspace-files>\nUse the skill "frontend-design" where it applies:\n\n…\n</workspace-files>' },
        { role: 'assistant', content: 'Use the skill "nope" where it applies' },
        { role: 'user', content: 'Use the "simplify" skill where it applies.' },
      ]),
    ).toEqual(['frontend-design', 'simplify'])
  })

  test('names the personas Hanzo may bring in, leaving out the ones already in the conversation', () => {
    const line = personas([])
    expect(line).toMatch(/^Personas you may bring in without being asked: /)
    expect(line).toContain('Dev (Development)')
    expect(line).toContain('Otherwise answer as yourself.')
    expect(personas(['Dev'])).not.toContain('Dev (Development)')
  })

  test('gives up waiting on Kai at its limit', async () => {
    vi.useFakeTimers()
    const late = within(new Promise<string>(() => {}), 1200, 'gone without')
    vi.advanceTimersByTime(1200)
    expect(await late).toBe('gone without')
    vi.useRealTimers()
    expect(await within(Promise.resolve('in time'), 1200, 'gone without')).toBe('in time')
  })

  test('parses explicit /skill commands (with or without query) and applies broader Kai recall on demand', async () => {
    expect(parseSkillCommand('/skill audit auth')).toEqual({ query: 'audit auth' })
    expect(parseSkillCommand('/skills   figma design system')).toEqual({ query: 'figma design system' })
    expect(parseSkillCommand('/skill')).toEqual({ query: '' })
    expect(parseSkillCommand('/skills')).toEqual({ query: '' })
    expect(parseSkillCommand('/skill-other')).toBeNull()
    expect(parseSkillCommand('normal message')).toBeNull()

    expect(
      skillContext([
        { role: 'user', content: 'Help me audit our OAuth flow\n<workspace-files>ignored</workspace-files>' },
        { role: 'assistant', content: 'Sure, let us inspect token validation.' },
        { role: 'user', content: '/skill' },
      ]),
    ).toBe('Help me audit our OAuth flow\nSure, let us inspect token validation.')
    expect(skillContext([], 'terraform deploy')).toBe('terraform deploy')
    expect(skillContext([])).toBe('general coding, productivity, and assistant skills')

    kai.found = [
      { name: 'security-threat-model', skill: true, probability: 0.72 },
      { name: 'security-best-practices', skill: true, probability: 0.65 },
      { name: 'code-review', skill: true, probability: 0.58 },
      { name: 'low-confidence', skill: true, probability: 0.42 },
    ]
    const got = await choose(target, 'auth', [], [], undefined, [], {
      minProbability: EXPLICIT_SURE,
      maxSkills: EXPLICIT_CHOSEN,
      explicit: true,
    })
    expect(got.names).toEqual(['security-threat-model', 'security-best-practices', 'code-review'])
    expect(kai.asked).toEqual(['auth'])
  })
})
