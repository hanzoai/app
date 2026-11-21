// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest'

const who = vi.hoisted(() => ({ sub: 'ada' as string | undefined, org: 'acme' as string | null }))
vi.mock('./session', () => ({ subject: () => who.sub, org: () => who.org }))

import { forget, fromBuild, rememberable, SPENDS, trust, trusted, trusts } from './spend'

beforeEach(() => {
  localStorage.clear()
  who.sub = 'ada'
  who.org = 'acme'
})

describe("Don't ask again", () => {
  test('a yes to one paid action never starts another: every other kind still asks', () => {
    for (const kind of SPENDS.filter(rememberable)) {
      localStorage.clear()
      trust(kind)
      expect(SPENDS.filter((other) => trusted(other)), kind).toEqual([kind])
    }
  })

  test('pay-as-you-go and what runs unwatched always ask; what the person starts, sees and stops may be remembered', () => {
    const own = SPENDS.filter((kind) => !kind.startsWith('build.'))
    expect(own.filter((kind) => !rememberable(kind)).sort()).toEqual(['automation-run', 'credits', 'design-gpu', 'design-video', 'flow-run', 'schedule'])
    expect(own.filter(rememberable).sort()).toEqual(['bot-desktop', 'bot-task', 'design-image', 'flow-mutate', 'tabs-browser', 'tabs-desktop', 'tabs-dev'])
    for (const kind of ['schedule', 'automation-run'] as const) {
      trust(kind)
      expect(trusted(kind), kind).toBe(false)
    }
    expect(localStorage.length).toBe(0)
  })

  test("a yes to one class of Tabs machine starts no other, and the old yes for every class is removed, never honoured", () => {
    trust('tabs-dev')
    expect(trusted('tabs-dev')).toBe(true)
    expect(trusted('tabs-desktop')).toBe(false)
    expect(trusted('tabs-browser')).toBe(false)
    localStorage.setItem('hanzo.spend.trusted.ada.acme.tabs-machine', '1')
    trusts()
    expect(localStorage.getItem('hanzo.spend.trusted.ada.acme.tabs-machine')).toBeNull()
    expect(trusted('tabs-dev'), 'the one kept for terminals stays').toBe(true)
  })

  test("@hanzo/build's spends are kept apart from the app's, each under its own again alone", () => {
    const app = SPENDS.filter((k) => !k.startsWith('build.'))
    const build = SPENDS.filter((k) => k.startsWith('build.'))
    expect(build).toHaveLength(12)
    expect(app.some((k) => build.includes(k)), 'no shared names').toBe(false)
    expect(fromBuild('run.computer')).toBe('build.run.computer')
    expect(fromBuild(null), 'a 24/7 bot: no key, always asked').toBeNull()
    expect(fromBuild('credits'), "never one of the app's own kinds").toBeNull()
    expect(fromBuild('run.anything')).toBeNull()
    trust(fromBuild('run.credits')!)
    expect(trusted(fromBuild('run.credits')!)).toBe(true)
    expect(trusted(fromBuild('run.computer')!), 'a yes that started no computer never starts one').toBe(false)
    expect(trusted(fromBuild('task-run.credits')!)).toBe(false)
    // A bot always asks, whatever its again: nothing is kept, and a yes an older build kept goes.
    for (const again of ['bot.credits', 'bot.computer']) {
      const bot = fromBuild(again)!
      expect(rememberable(bot), again).toBe(false)
      trust(bot)
      expect(trusted(bot), again).toBe(false)
    }
    localStorage.setItem('hanzo.spend.trusted.ada.acme.build.bot.credits', '1')
    trusts()
    expect(localStorage.getItem('hanzo.spend.trusted.ada.acme.build.bot.credits')).toBeNull()
    // The key has dots of its own: it is still read back, and never taken for a stale one.
    expect(trusts()).toBe(true)
    expect(trusted(fromBuild('run.credits')!)).toBe(true)
  })

  test('credits are never remembered: a yes is not kept, and one an older build kept is removed, never honoured', () => {
    trust('credits')
    expect(localStorage.length).toBe(0)
    localStorage.setItem('hanzo.spend.trusted.ada.acme.credits', '1')
    localStorage.setItem('hanzo.spend.trusted.ada.beta.credits', '1')
    expect(trusts(), 'a stale credits yes is nothing to take back').toBe(false)
    expect(localStorage.length).toBe(0)
    localStorage.setItem('hanzo.spend.trusted.ada.acme.credits', '1')
    expect(trusted('credits')).toBe(false)
    expect(localStorage.getItem('hanzo.spend.trusted.ada.acme.credits')).toBeNull()
  })

  test("is the person's own, in one organization: the next person, or another organization, is asked again", () => {
    trust('tabs-dev')
    who.org = 'beta'
    expect(trusted('tabs-dev')).toBe(false)
    who.org = 'acme'
    who.sub = 'grace'
    expect(trusted('tabs-dev')).toBe(false)
  })

  test('nobody signed in is always asked, and keeps nothing', () => {
    who.sub = undefined
    trust('tabs-dev')
    expect(trusted('tabs-dev')).toBe(false)
    expect(trusts()).toBe(false)
    expect(localStorage.length).toBe(0)
  })

  test("Ask me again takes back the person's every yes, in every organization, and leaves another person's alone", () => {
    trust('tabs-dev')
    who.org = 'beta'
    trust('tabs-desktop')
    who.sub = 'grace'
    trust('bot-task')
    who.sub = 'ada'
    expect(trusts()).toBe(true)
    forget()
    expect(trusts()).toBe(false)
    expect(trusted('tabs-desktop')).toBe(false)
    who.org = 'acme'
    expect(trusted('tabs-dev')).toBe(false)
    who.sub = 'grace'
    who.org = 'beta'
    expect(trusted('bot-task')).toBe(true)
  })

  test("one person's key never matches another's, whatever their subjects", () => {
    who.sub = 'a.b'
    trust('tabs-dev')
    who.sub = 'a'
    who.org = 'b.acme'
    expect(trusted('tabs-dev')).toBe(false)
    expect(trusts()).toBe(false)
  })
})
