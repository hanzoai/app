import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { asked, KEY, watch } from './watch'

const id = `sess_${'0123456789abcdef'.repeat(2)}`
const here = dirname(fileURLToPath(import.meta.url))
const source = (file: string) => readFileSync(join(here, file), 'utf8')

describe('one run on the Work board, as an address', () => {
  test('watch() is the Work board with the run named in the query', () => {
    expect(KEY).toBe('session')
    expect(watch(id)).toBe(`/work?session=${id}`)
  })

  test('asked() reads back the run watch() wrote', () => {
    expect(asked(new URL(watch(id), 'https://hanzo.ai').search)).toBe(id)
    expect(asked(`?tab=working&session=${id}`)).toBe(id)
  })

  test('an address that names no run, or something other than an id, opens nothing', () => {
    for (const search of ['', '?session=', '?session=%20', '?session=..%2Fpay', '?session=a%20b', `?session=${'x'.repeat(129)}`, '?thread=sess_1'])
      expect(asked(search)).toBeNull()
    expect(watch('../pay')).toBe('/work')
  })

  // hanzo-inc/app issue 202: "{n} failed" sent the reader to /work alone, a board
  // of up to a hundred runs with old failures among them, and opened none.
  test("Home's failed row opens the newest failure, and Work opens the run it is asked for", () => {
    expect(source('Home.tsx')).toContain('href: watch(failing[0].id)')
    const work = source('Work.tsx')
    expect(work).toContain('asked(url.search)')
    expect(work).toContain('url.searchParams.delete(KEY)')
  })
})
