// @vitest-environment happy-dom
// The one confirm, drawn with the real kit: focus, Enter, Escape and what a screen reader hears.
import { createElement, useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, press, tap, type Mounted } from '../vitest.real'
import { Confirm, useBuildSpend, useSpend } from './Confirm'
import { NeedMoreUsageModal } from './NeedMoreUsage'
import type { Spend as BuildSpend } from '@hanzo/dev/builder'
import { trusted } from './lib/spend'

vi.mock('./lib/session', async (real) => ({ ...(await real<typeof import('./lib/session')>()), subject: () => 'ada', org: () => 'acme' }))

let at: Mounted
beforeEach(() => localStorage.clear())
afterEach(() => at?.done())

function Asker({ onYes }: { onYes: () => void }) {
  const [open, setOpen] = useState(false)
  return createElement(
    'div',
    null,
    createElement('button', { 'data-slot': 'trigger', onClick: () => setOpen(true) }, 'Delete'),
    createElement(Confirm, { open, title: 'Delete chat?', body: 'It is deleted for good.', yes: 'Delete', danger: true, onYes, onOpenChange: setOpen }),
  )
}

const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`) as HTMLElement | null

describe('the real Confirm', () => {
  test('focus starts on Cancel, its sentence describes it, Enter on Cancel and Escape cancel, and focus goes back to the trigger', async () => {
    const yes = vi.fn()
    at = await mount()
    await at.draw(createElement(Asker, { onYes: yes }))
    const trigger = slot('trigger')!
    trigger.focus()
    await tap(trigger)
    const dialog = slot('confirm')!
    expect(dialog).not.toBeNull()
    expect(document.activeElement?.getAttribute('data-slot')).toBe('confirm-cancel')
    const described = dialog.getAttribute('aria-describedby')
    expect(described && document.getElementById(described)?.textContent).toBe('It is deleted for good.')

    await press('Enter')
    expect(slot('confirm')).toBeNull()
    expect(yes).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)

    await tap(trigger)
    expect(slot('confirm')).not.toBeNull()
    await press('Escape')
    expect(slot('confirm')).toBeNull()
    expect(yes).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(trigger)

    await tap(trigger)
    await tap(slot('confirm-yes')!)
    expect(yes).toHaveBeenCalledTimes(1)
  })
})

function Spender({ run }: { run: () => void }) {
  const spend = useSpend('tabs-dev', 'Start a cloud machine?', 'This starts a cloud machine for you.', 'Start machine')
  return createElement('div', null, createElement('button', { 'data-slot': 'go', onClick: () => spend.ask(run) }, 'Go'), spend.dialog)
}

describe('useSpend, with the real kit', () => {
  test('nothing starts until yes; Cancel starts nothing; the sentence says it counts against the plan or credits', async () => {
    const run = vi.fn()
    at = await mount()
    await at.draw(createElement(Spender, { run }))
    await tap(slot('go')!)
    expect(run).not.toHaveBeenCalled()
    expect(slot('confirm')?.textContent).toContain('It counts against your plan or your credits.')
    await tap(slot('confirm-cancel')!)
    expect(run).not.toHaveBeenCalled()
    await tap(slot('go')!)
    await tap(slot('confirm-yes')!)
    expect(run).toHaveBeenCalledTimes(1)
  })

  test("Don't ask again is kept for that kind alone, and the next press starts at once", async () => {
    const run = vi.fn()
    at = await mount()
    await at.draw(createElement(Spender, { run }))
    await tap(slot('go')!)
    await tap(slot('confirm-remember')!)
    await tap(slot('confirm-yes')!)
    expect(trusted('tabs-dev')).toBe(true)
    expect(trusted('tabs-desktop'), 'another class of machine still asks').toBe(false)
    expect(trusted('bot-desktop')).toBe(false)
    await tap(slot('go')!)
    expect(slot('confirm')).toBeNull()
    expect(run).toHaveBeenCalledTimes(2)
  })
})

function Credits() {
  const spend = useSpend('credits', 'Turn on usage credits?', 'This turns on usage credits.', 'Turn on credits')
  return createElement('div', null, createElement('button', { 'data-slot': 'go', onClick: () => spend.ask(() => {}) }, 'Go'), spend.dialog)
}

describe('credits', () => {
  test("never offer Don't ask again: pay-as-you-go is asked for every time", async () => {
    at = await mount()
    await at.draw(createElement(Credits))
    await tap(slot('go')!)
    expect(slot('confirm')).not.toBeNull()
    expect(slot('confirm-remember')).toBeNull()
  })

  test("a Don't ask again an older build kept for credits still asks, and is taken away", async () => {
    localStorage.setItem('hanzo.spend.trusted.ada.acme.credits', '1')
    at = await mount()
    await at.draw(createElement(Credits))
    await tap(slot('go')!)
    expect(slot('confirm')).not.toBeNull()
    expect(localStorage.getItem('hanzo.spend.trusted.ada.acme.credits')).toBeNull()
  })
})

// What @hanzo/build hands its host's confirm, in the package's own words.
// A bot's `again` is null by the package's type; the cast lets the test hand it one anyway, as a careless host could.
const run = (again: string | null, kind: BuildSpend['kind'] = 'task-run'): BuildSpend => ({
  kind,
  title: 'Run Monday summary now?',
  what: 'This runs the task once, right away.',
  yes: 'Run now',
  uses: 'credits',
  again,
} as BuildSpend)

function Builder({ spends, answers }: { spends: BuildSpend[]; answers: boolean[] }) {
  const { confirm, dialog } = useBuildSpend()
  const next = useRef(0)
  return createElement(
    'div',
    null,
    createElement('button', { 'data-slot': 'go', onClick: () => void confirm(spends[next.current++ % spends.length]!).then((a) => answers.push(a)) }, 'Go'),
    dialog,
  )
}

describe("@hanzo/build's spends, asked through the one useSpend", () => {
  test("ask once, in the package's own words; Cancel spends nothing; yes is a yes", async () => {
    const answers: boolean[] = []
    at = await mount()
    await at.draw(createElement(Builder, { spends: [run('task-run.credits')], answers }))
    await tap(slot('go')!)
    expect(document.querySelectorAll('[data-slot="confirm"]').length).toBe(1)
    expect(slot('confirm')!.textContent).toContain('Run Monday summary now?')
    expect(slot('confirm')!.textContent).toContain('This runs the task once, right away.')
    expect(slot('confirm-yes')!.textContent).toBe('Run now')
    await tap(slot('confirm-cancel')!)
    expect(answers).toEqual([false])
    await tap(slot('go')!)
    await tap(slot('confirm-yes')!)
    expect(answers).toEqual([false, true])
  })

  test("a remembered yes covers its own again alone", async () => {
    const answers: boolean[] = []
    at = await mount()
    await at.draw(createElement(Builder, { spends: [run('task-run.credits'), run('task-run.credits'), run('run.computer', 'run')], answers }))
    await tap(slot('go')!)
    await tap(slot('confirm-remember')!)
    await tap(slot('confirm-yes')!)
    expect(localStorage.getItem('hanzo.spend.trusted.ada.acme.build.task-run.credits')).toBe('1')
    await tap(slot('go')!)
    expect(slot('confirm'), 'the same again goes without a question').toBeNull()
    expect(answers).toEqual([true, true])
    await tap(slot('go')!)
    expect(slot('confirm'), 'another again still asks').not.toBeNull()
  })

  test("a bot never offers Don't ask again, with no again or with one", async () => {
    for (const again of [null, 'bot.credits']) {
      const answers: boolean[] = []
      at = await mount()
      await at.draw(createElement(Builder, { spends: [run(again, 'bot')], answers }))
      await tap(slot('go')!)
      expect(slot('confirm'), String(again)).not.toBeNull()
      expect(slot('confirm-remember'), String(again)).toBeNull()
      await tap(slot('confirm-cancel')!)
      await at.done()
    }
  })
})

function Over() {
  const credits = useSpend('credits', 'Turn on usage credits?', 'This turns on usage credits.', 'Turn on credits')
  const [open, setOpen] = useState(false)
  return createElement(
    'div',
    null,
    createElement('button', { 'data-slot': 'out-of-usage', onClick: () => setOpen(true) }, 'Out of usage'),
    // As Chat draws them: the question first in the tree, the window after it.
    credits.dialog,
    createElement(NeedMoreUsageModal, { open, onClose: () => setOpen(false), onBuyCredits: () => credits.ask(() => {}), onSetupTeam: () => {} }),
  )
}

describe('a spend question over an open window', () => {
  test('"Turn on usage credits?" asked from "Need more usage?" is painted above it and takes the press', async () => {
    at = await mount()
    await at.draw(createElement(Over))
    await tap(slot('out-of-usage')!)
    await tap(slot('buy-usage-credits')!)
    const question = slot('confirm')!
    const window = slot('need-more-usage-modal')!
    // gui paints dialogs of one z-index in their portals' document order: the question's comes after.
    const layer = (el: HTMLElement) => {
      let top: HTMLElement = el
      for (let e: HTMLElement | null = el; e && e !== document.body; e = e.parentElement) top = e
      return top
    }
    const z = (el: HTMLElement) => {
      let best = 0
      for (let e: HTMLElement | null = el; e; e = e.parentElement) best = Math.max(best, Number(e.style?.zIndex) || 0)
      return best
    }
    expect(layer(question)).not.toBe(layer(window))
    expect(layer(window).compareDocumentPosition(layer(question)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(z(question)).toBeGreaterThanOrEqual(z(window))
    await tap(slot('confirm-cancel')!)
    expect(slot('confirm')).toBeNull()
    expect(slot('need-more-usage-modal'), 'the window it was asked over stays').not.toBeNull()
  })
})
