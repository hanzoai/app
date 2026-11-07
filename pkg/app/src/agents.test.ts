import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPersonaMd, team } from '@hanzo/personas'
import { beforeAll, describe, expect, test } from 'vitest'
import { CAST, RUNS, draft, handle, line, ordered, title, type Figure } from './agents'
import { TEAM, after } from './team'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** The agents API's name rule (cloud apps/agents `nameRE`). */
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const names = (list: readonly { name: string }[]) => list.map((one) => one.name)

describe('the default cast', () => {
  test('is every member @hanzo/personas publishes as the team, in seat order', () => {
    expect(TEAM.map((one) => one.id).sort()).toEqual(team().map((one) => one.id).sort())
    expect(TEAM.map((one) => one.seat)).toEqual(TEAM.map((_, i) => i + 1))
    expect(names(TEAM)).toEqual([
      'Vi', 'Fin', 'Dev', 'Mark', 'Opera', 'Des', 'Sal', 'Su', 'Cyber', 'Sci', 'Huma', 'Mana',
      'Data', 'Lang', 'Ed', 'Art', 'Rev', 'Law', 'Mo', 'Biz', 'Mu', 'Doc', 'Gov', 'Cust',
      'Com', 'IT', 'QA', 'Auto', 'Proc', 'Supply', 'Corp', 'Comp', 'Risk', 'Audit',
    ])
  })

  test('stands in for nobody: an org with no agents has none to show', () => {
    expect(ordered([])).toEqual([])
    expect(ordered(undefined)).toEqual([])
    expect(ordered(null)).toEqual([])
  })

  test('is the team and nothing else: one agent per seat, as its file writes it, wearing its memoji', () => {
    expect(names(CAST)).toEqual(TEAM.map((one) => one.id))
    for (const [i, c] of CAST.entries()) {
      const one = TEAM[i]!
      expect(c).toEqual({
        name: one.id,
        title: one.name,
        category: one.lead ? 'Team' : 'Bot',
        description: `${one.name} — ${one.role}`,
        model: one.model,
        instructions: one.instructions,
        avatar: `/agents/${one.id}.png`,
        after: after(one),
        tools: one.tools,
        ...(one.lead ? {} : { executionMode: 'long-running', ...RUNS[one.id] }),
      })
      expect(c.name).toMatch(NAME)
      expect(c.title).toMatch(/^[A-Za-z]+$/)
      expect(c.instructions.length).toBeGreaterThan(100)
    }
    expect(CAST[0]).toMatchObject({ name: 'vi', title: 'Vi', description: 'Vi — CEO/Vision', model: 'enso' })
  })

  test('names, for every seat, the three figures it is drawn from, as their PERSONA.md names them', () => {
    for (const c of CAST) expect(c.after, c.name).toHaveLength(3)
    expect(CAST.find((c) => c.name === 'mark')!.after).toEqual(['Ogilvy', 'Bernbach', 'Burnett'])
    expect(CAST.find((c) => c.name === 'vid')).toMatchObject({ title: 'Mo', description: 'Mo — Motion Pictures', after: ['Kubrick', 'Kurosawa', 'Hitchcock'] })
    expect(CAST.find((c) => c.name === 'edu')).toMatchObject({ title: 'Ed', description: 'Ed — Education' })
  })

  test('offers the twelve leads under Team and every other seat as a Bot that runs 24/7 on its schedule and triggers', () => {
    expect(CAST.filter((c) => c.category === 'Team').map((c) => c.name)).toEqual(TEAM.slice(0, 12).map((one) => one.id))
    expect(Object.keys(RUNS)).toEqual(TEAM.filter((one) => !one.lead).map((one) => one.id))
    for (const c of CAST.filter((c) => c.category === 'Bot')) {
      expect(c.executionMode).toBe('long-running')
      expect(c.schedule).toMatch(/^\S+ \S+ \S+ \S+ \S+$/)
      expect(c.triggers!.length).toBeGreaterThan(0)
    }
  })

  test('every face is the member’s memoji, copied from the package at build', () => {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'team.mjs')], { cwd: ROOT, stdio: 'ignore' })
    const memoji = join(dirname(createRequire(import.meta.url).resolve('@hanzo/personas/package.json')), 'assets', 'memoji')
    for (const c of CAST) {
      const at = join(ROOT, 'assets', c.avatar!.slice(1))
      expect(existsSync(at)).toBe(true)
      expect(readFileSync(at).equals(readFileSync(join(memoji, `${c.name}.png`)))).toBe(true)
    }
  }, 30_000)
})

describe('the shelf’s order', () => {
  test('the team’s rows lead in seat order, whatever their case, and the rest follow as listed', () => {
    const org = [
      { id: 'agent_zed', name: 'zed' },
      { id: 'agent_des', name: 'des', avatar: 'data:image/png;base64,AA' },
      { id: 'agent_ops', name: 'ops' },
      { id: 'agent_dev', name: 'DEV' },
    ]
    const out = ordered(org)
    expect(names(out)).toEqual(['DEV', 'des', 'zed', 'ops'])
    expect(out[1]).toBe(org[1])
  })
})

describe('a figure as a draft', () => {
  let figures: Figure[]
  beforeAll(() => {
    // The roster the sheet fetches is what the build writes.
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'team.mjs')], { cwd: ROOT, stdio: 'ignore' })
    figures = JSON.parse(readFileSync(join(ROOT, 'assets', 'personas', 'index.json'), 'utf8'))
  }, 30_000)
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
