// @vitest-environment happy-dom
// Design's and Flow's one spend confirm (Confirm.tsx `useMaking`, handed to @hanzo/studio as `host.spend`),
// drawn with the real kit: each kind is its own yes, a press that is already asking starts nothing twice, and
// what queues unattended work (Flow's Run) is asked every time.
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, tap, type Mounted } from '../vitest.real'
import { useMaking } from './Confirm'
import { trusted } from './lib/spend'

vi.mock('./lib/session', async (real) => ({ ...(await real<typeof import('./lib/session')>()), subject: () => 'ada', org: () => 'acme' }))

let at: Mounted
beforeEach(() => localStorage.clear())
afterEach(() => at?.done())

const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`) as HTMLElement | null
const answers: Promise<boolean>[] = []

function Maker({ kind, asked }: { kind: string; asked?: { title?: string; what?: string } }) {
  const making = useMaking()
  return createElement('div', null, createElement('button', { 'data-slot': 'go', onClick: () => answers.push(making.spend(kind, asked)) }, 'Go'), making.dialog)
}

beforeEach(() => {
  answers.length = 0
})

describe('useMaking, with the real kit', () => {
  test('says how many pictures, starts nothing until yes, and a second press while it asks is one question', async () => {
    at = await mount()
    await at.draw(createElement(Maker, { kind: 'design-image', asked: { title: 'Make 4 pictures?', what: 'This makes 4 pictures.' } }))
    await tap(slot('go')!)
    await tap(slot('go')!)
    expect(document.querySelectorAll('[data-slot="confirm"]')).toHaveLength(1)
    expect(slot('confirm')?.textContent).toContain('Make 4 pictures?')
    expect(slot('confirm')?.textContent).toContain('This makes 4 pictures. It counts against your plan or your credits.')
    // The first press is answered no by the second: one question, one spend.
    await expect(answers[0]).resolves.toBe(false)
    await tap(slot('confirm-yes')!)
    await expect(answers[1]).resolves.toBe(true)
  })

  test('Cancel answers no', async () => {
    at = await mount()
    await at.draw(createElement(Maker, { kind: 'flow-mutate' }))
    await tap(slot('go')!)
    await tap(slot('confirm-cancel')!)
    await expect(answers[0]).resolves.toBe(false)
  })

  test("a picture's Don't ask again is that kind's alone", async () => {
    at = await mount()
    await at.draw(createElement(Maker, { kind: 'design-image' }))
    await tap(slot('go')!)
    await tap(slot('confirm-remember')!)
    await tap(slot('confirm-yes')!)
    expect(trusted('design-image')).toBe(true)
    expect(trusted('flow-mutate')).toBe(false)
    await tap(slot('go')!)
    expect(slot('confirm')).toBeNull()
    await expect(answers[1]).resolves.toBe(true)
  })

  test("Flow's Run, a clip and a GPU render never offer Don't ask again", async () => {
    for (const kind of ['flow-run', 'design-video', 'design-gpu']) {
      at = await mount()
      await at.draw(createElement(Maker, { kind }))
      await tap(slot('go')!)
      expect(slot('confirm'), kind).not.toBeNull()
      expect(slot('confirm-remember'), kind).toBeNull()
      await at.done()
    }
    at = await mount()
  })

  test('a kind the app does not know is never started', async () => {
    at = await mount()
    await at.draw(createElement(Maker, { kind: 'anything' }))
    await tap(slot('go')!)
    expect(slot('confirm')).toBeNull()
    await expect(answers[0]).resolves.toBe(false)
  })
})
