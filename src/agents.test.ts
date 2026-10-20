import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPersonaMd, team } from '@hanzo/personas'
import { beforeAll, describe, expect, test } from 'vitest'
import { CORE, draft, handle, line, ordered, title, type Figure } from './agents'
import { TEAM } from './team'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** The agents API's name rule (cloud apps/agents `nameRE`). */
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const names = (list: readonly { name: string }[]) => list.map((one) => one.name)

describe('the default cast', () => {
  test('is every member @hanzo/personas publishes as the team, Dev first', () => {
    expect(TEAM.map((one) => one.id).sort()).toEqual(team().map((one) => one.id).sort())
    expect(names(CORE)).toEqual(['Dev', 'Des', 'Vi', 'Feynman', 'Einstein', 'Nora', 'Maya', 'Leo'])
  })

  test('stands in for an org with no list, or none yet', () => {
    expect(names(ordered([]))).toEqual(names(CORE))
    expect(names(ordered(undefined))).toEqual(names(CORE))
    expect(names(ordered(null))).toEqual(names(CORE))
  })
})

describe('the shelf’s order', () => {
  test('an org’s own row takes a member’s place, whatever its case, and the rest follow as listed', () => {
    const org = [
      { id: 'agent_zed', name: 'zed' },
      { id: 'agent_des', name: 'des', avatar: 'data:image/png;base64,AA' },
      { id: 'agent_ops', name: 'ops' },
      { id: 'agent_dev', name: 'DEV' },
    ]
    const out = ordered(org)
    expect(names(out)).toEqual(['DEV', 'des', 'Vi', 'Feynman', 'Einstein', 'Nora', 'Maya', 'Leo', 'zed', 'ops'])
    expect(out[1]).toBe(org[1])
    expect(out[2]).toEqual({ id: 'house-vi', name: 'Vi', avatar: '/agents/vi.png' })
  })
})

describe('a figure as a draft', () => {
  let figures: Figure[]
  beforeAll(() => {
    // The roster the sheet fetches is what the build writes.
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'team.mjs')], { cwd: ROOT, stdio: 'ignore' })
    figures = JSON.parse(readFileSync(join(ROOT, 'assets', 'personas', 'index.json'), 'utf8'))
  })
  const by = (slug: string) => figures.find((f) => f.slug === slug)!

  test('a written PERSONA.md gives its name and its prompt word for word, without the front matter', () => {
    const f = by('feynman')
    const md = getPersonaMd('feynman')!
    const d = draft(f, md)
    expect(d.name).toBe('Feynman')
    expect(d.does.startsWith('# Feynman\n\nYou are Feynman')).toBe(true)
    expect(md.trimEnd().endsWith(d.does)).toBe(true)
    expect(d.does).not.toMatch(/trait_facets|^---$/m)
    expect(d.look).toBe('Richard P. Feynman, a playful physicist who explains the universe from first principles, distrusts authority, and believes understanding means being able to teach it simply.')
    expect(title(f)).toBe('Richard P. Feynman')
  })

  test('a figure with none written is told who it is, and is listed by what it was', () => {
    const f = by('einstein')
    expect(f.called).toBeUndefined()
    expect(line(f)).toBe('Scientist')
    expect(draft(f, null)).toEqual({
      name: 'Albert-Einstein',
      does: 'You are Albert Einstein. Answer as Albert Einstein would, in your own voice and from what you wrote and did. When a question is past what you could have known, say so.',
      look: 'Albert Einstein, scientist',
    })
    expect(line({ slug: 'x', name: 'X', category: 'tech_leader' })).toBe('Tech leader')
  })

  test('an archetype is called by its PERSONA.md, not its profile', () => {
    expect(title(by('zeekay'))).toBe('Zeekay')
  })

  test('every figure drafts to a name the agents API takes and a prompt under its cap', () => {
    expect(figures.length).toBeGreaterThan(1000)
    for (const f of figures) {
      const d = draft(f, f.called ? readFileSync(join(ROOT, 'assets', 'personas', `${f.slug}.md`), 'utf8') : null)
      expect(d.name, f.slug).toMatch(NAME)
      expect(d.does.length, f.slug).toBeGreaterThan(0)
      expect(d.does.length, f.slug).toBeLessThanOrEqual(32 * 1024)
      expect(d.look, f.slug).toContain(title(f))
    }
  })

  test('a name keeps what the API takes and dashes the rest', () => {
    expect(handle('Spärck Jones')).toBe('Sparck-Jones')
    expect(handle("Al-Shafi'i")).toBe('Al-Shafi-i')
    expect(handle('Sun Yat-sen')).toBe('Sun-Yat-sen')
    expect(handle('  ¡Hola! ')).toBe('Hola')
  })
})
