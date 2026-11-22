// @vitest-environment happy-dom
// Chat itself, drawn whole with the real kit against a stand-in platform (vitest.chat.tsx):
// a person types, the model streams in the platform's own shapes, and the test reads the screen.
import { act, createElement } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { press as key, tap, type Mounted } from '../vitest.real'
import { ask, button, drawChat, platform, press, settle, shown, signIn, type Platform } from '../vitest.chat'

let at: Mounted | undefined
let api: Platform

// The first draw of Chat pays the kit's cold start (styles, lazy chunks), slow on CI. It is paid here, with
// its own time, so each test's 5 s measures what a person does and not the first mount.
beforeAll(async () => {
  signIn()
  api = platform()
  await (await drawChat()).done()
}, 60_000)

// shortcut: @hanzogui/toast leaves its removal timer running after unmount; drop this wait when the kit clears it
// Its 200 ms removal timer (ToastComposable TIME_BEFORE_UNMOUNT) sets state; fired after the file ends it throws
// "window is not defined" and fails the whole run. Unmounting does not clear it, so the last test's is waited out.
afterAll(() => new Promise((done) => setTimeout(done, 400)))

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  signIn()
  api = platform()
})
afterEach(async () => {
  await at?.done()
  at = undefined
  vi.useRealTimers()
  // The toaster removes a dismissed toast 200 ms later; let it, before the file's window is torn down.
  await new Promise((r) => setTimeout(r, 250))
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('an answer that does not come', () => {
  test('after Stop, the turn says "You stopped this answer."', async () => {
    at = await drawChat()
    await ask('What is the tallest mountain?')
    const turn = await api.turn()
    expect(turn.asked.messages?.at(-1)).toMatchObject({ role: 'user', content: 'What is the tallest mountain?' })
    await press('Stop')
    await settle()
    expect(turn.cancelled).toBe(true)
    expect(shown()).toContain('You stopped this answer.')
  })

  test('a stream that says nothing is stopped at the stall and says so, with Try again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] })
    at = await drawChat()
    await ask('Write me a long essay')
    const turn = await api.turn()
    await settle()
    await act(async () => void vi.advanceTimersByTime(300_000))
    await settle()
    expect(turn.cancelled).toBe(true)
    expect(shown()).toMatch(/sent nothing for 5 minutes, so the turn was stopped\./)
    expect(shown()).toContain('Try again')
  })

  test('an error says the model is unavailable and offers Try again', async () => {
    api.refuse(500, { error: { message: 'upstream failed', type: 'server_error', code: 'providers_exhausted' } })
    at = await drawChat()
    await ask('Hello there, how are you?')
    await settle(60)
    expect(shown()).toMatch(/is unavailable right now\./)
    expect(shown()).toContain('Try again')
  })
})

describe('out of credit', () => {
  test('a 402 for an empty balance offers Buy usage credits through the confirm, and no Try again', async () => {
    // The meter's billing envelope, as the gateway sends it (bots.test.ts).
    api.refuse(402, { error: { message: 'Insufficient balance. Please add credits at console.hanzo.ai', type: 'billing_error', code: 'insufficient_balance' } })
    api.on('PUT /v1/ai/limits', { status: 200, body: {} })
    const opened = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    try {
      at = await drawChat()
      await ask('Summarise this week for me')
      await settle(60)
      const turn = document.querySelector('[role="alert"]')?.textContent ?? ''
      expect(turn).toContain('Your balance is empty.')
      expect(turn).not.toContain('console.hanzo.ai')
      expect(button('Try again')).toBeUndefined()
      // The strip over the composer promises no button it does not draw.
      expect(document.querySelector('[data-slot="wallet-recovery-strip"]')?.textContent).not.toContain('Buy usage credits')
      await press('Buy usage credits')
      // Credits are money: nothing is spent before the person says yes, and the confirm says what yes does.
      const confirm = document.querySelector('[data-slot="confirm"]')?.textContent ?? ''
      expect(confirm).toContain('opens the payment page')
      expect(confirm).not.toContain('asks your last question again')
      expect(api.calls.some((c) => c.method === 'PUT' && c.path === '/v1/ai/limits')).toBe(false)
      await tap(document.querySelector('[data-slot="confirm-yes"]')!)
      await settle(60)
      expect(api.calls.find((c) => c.method === 'PUT' && c.path === '/v1/ai/limits')?.body).toEqual({ creditsAfterAllowance: true })
      expect(opened.mock.calls.map(([u]) => new URL(String(u)).pathname)).toEqual(['/pay/amount/card'])
    } finally {
      opened.mockRestore()
    }
  })

  const broke = () =>
    api.refuse(402, { error: { message: 'Insufficient balance. Please add credits at console.hanzo.ai', type: 'billing_error', code: 'insufficient_balance' } })
  const ASK_ADMIN = 'Only an owner or admin of your organization can buy usage credits. Ask one of them to add credit.'

  test('a member is told to ask an owner or admin, and offered no press that cannot work', async () => {
    signIn('acme', 'member')
    broke()
    at = await drawChat()
    await ask('Summarise this week for me')
    await settle(60)
    expect(document.querySelector('[data-slot="ask-admin"]')?.textContent).toBe(ASK_ADMIN)
    expect(button('Buy usage credits')).toBeUndefined()
    expect(button('Try again')).toBeUndefined()
  })

  test('a 403 from turning credits on says the same sentence, never the bare refusal', async () => {
    broke()
    api.on('PUT /v1/ai/limits', { status: 403, body: { error: { message: 'forbidden' } } })
    at = await drawChat()
    await ask('Summarise this week for me')
    await settle(60)
    await press('Buy usage credits')
    await tap(document.querySelector('[data-slot="confirm-yes"]')!)
    await settle(60)
    expect(document.body.textContent).toContain(ASK_ADMIN)
  })

  test('there is one way to buy: each of the three offers asks once, turns credits on once, and nothing else does', async () => {
    broke()
    api.on('PUT /v1/ai/limits', { status: 200, body: {} })
    vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    at = await drawChat()
    await ask('Summarise this week for me')
    await settle(60)
    const turnedOn = () => api.calls.filter((c) => c.method === 'PUT' && c.path === '/v1/ai/limits')
    const yes = async () => {
      await tap(document.querySelector('[data-slot="confirm-yes"]')!)
      await settle(60)
    }
    // The refused turn's own offer.
    await press('Buy usage credits')
    expect(turnedOn()).toHaveLength(0)
    await yes()
    expect(turnedOn()).toHaveLength(1)
    // The Need more usage dialog's offer.
    await act(async () => void window.dispatchEvent(new CustomEvent('hanzo:need-more-usage')))
    await settle()
    await tap([...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === 'Buy usage credits')!)
    expect(document.querySelector('[data-slot="confirm"]')).not.toBeNull()
    expect(turnedOn()).toHaveLength(1)
    await yes()
    expect(turnedOn()).toHaveLength(2)
    // The plan-limit banner's own offer, once the server names credits as a way on.
    api.refuse(402, {
      error: { type: 'billing_error', code: 'model_cap', class: 'premium', message: 'Premium models are paused.', actions: [{ kind: 'credits', label: 'Continue with credits' }] },
    })
    await ask('And next week?')
    await settle(60)
    await press('Continue with credits')
    expect(document.querySelector('[data-slot="confirm"]')).not.toBeNull()
    expect(turnedOn()).toHaveLength(2)
    await yes()
    expect(turnedOn()).toHaveLength(3)
    expect(turnedOn().every((c) => JSON.stringify(c.body) === '{"creditsAfterAllowance":true}')).toBe(true)
  })
})

describe('a slow answer', () => {
  test('says it is taking longer than usual early, long before the stall, and its one Stop stops it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] })
    at = await drawChat()
    await ask('Plan a trip to Kyoto')
    const turn = await api.turn()
    await settle()
    expect(shown()).not.toContain('taking longer than usual')
    await act(async () => void vi.advanceTimersByTime(20_000))
    await settle()
    const slow = document.querySelector('[data-slot="slow"]')
    expect(slow?.textContent).toContain('This is taking longer than usual.')
    expect(turn.cancelled).toBe(false)
    await tap([...slow!.querySelectorAll('button')].find((b) => b.textContent === 'Stop')!)
    await settle()
    expect(turn.cancelled).toBe(true)
    expect(shown()).toContain('You stopped this answer.')
  })

  test('a model that is thinking is not slow: its thought is what shows', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] })
    at = await drawChat()
    await ask('Prove there are infinitely many primes')
    const turn = await api.turn()
    await turn.think('Suppose finitely many primes p1..pn; consider their product plus one.')
    await act(async () => void vi.advanceTimersByTime(20_000))
    await settle()
    expect(document.querySelector('[data-slot="thought"]')?.textContent).toContain('consider their product plus one')
    expect(document.querySelector('[data-slot="slow"]')).toBeNull()
  })
})

/** Opens the composer's `+` and chooses the row whose slot is `slot`. */
async function plus(slot: string) {
  await tap(document.querySelector('[data-slot="plus"]')!)
  const row = document.querySelector(`[data-slot="${slot}"]`)
  if (!row) throw new Error(`no ${slot} in the + menu`)
  await tap(row)
}

/** Types into a field as a person does. */
async function type(el: Element, text: string) {
  await act(async () => {
    const box = el.matches('input, textarea') ? (el as HTMLInputElement) : (el.querySelector('input, textarea') as HTMLInputElement)
    box.focus()
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(box), 'value')!.set!.call(box, text)
    box.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 300))
  })
}

describe('Add from library', () => {
  test('attaches the chosen item to this chat, without leaving it', async () => {
    api.on('GET /v1/library', {
      status: 200,
      body: { data: [{ id: 'lib-1', kind: 'document', source: 'chat', name: 'notes.txt', mime: 'text/plain', bytes: 5, url: 'https://files.test/notes.txt' }], next: '' },
    })
    api.on('GET /notes.txt', { status: 200, body: 'hello' })
    at = await drawChat()
    const before = window.location.href
    await plus('plus-library')
    const row = [...document.querySelectorAll('[data-slot="from-library-item"]')].find((r) => r.textContent?.includes('notes.txt'))
    expect(row).toBeTruthy()
    await tap(row!)
    await settle(60)
    expect(document.querySelector('[data-slot="from-library"]')).toBeNull()
    expect(document.querySelector('[data-slot="composer-attached"]')?.textContent).toContain('notes.txt')
    expect(api.calls.some((c) => c.path === '/notes.txt')).toBe(true)
    expect(window.location.href).toBe(before)
  })

  test('searches the whole Library and reads past the first page', async () => {
    const row = (id: string, name: string) => ({ id, kind: 'document', source: 'chat', name, mime: 'text/plain', bytes: 1, url: `https://files.test/${id}` })
    api.on('GET /v1/library', (c) =>
      c.query.get('q') === 'budget'
        ? { status: 200, body: { data: [row('b', 'budget-2027.xlsx')], next: '' } }
        : c.query.get('cursor') === 'p2'
          ? { status: 200, body: { data: [row('old', 'old-notes.txt')], next: '' } }
          : { status: 200, body: { data: [row('new', 'new-notes.txt')], next: 'p2' } },
    )
    at = await drawChat()
    await plus('plus-library')
    const names = () => [...document.querySelectorAll('[data-slot="from-library-item"]')].map((r) => r.textContent)
    expect(names()).toEqual(['new-notes.txt'])
    await press('Show more')
    expect(names()).toEqual(['new-notes.txt', 'old-notes.txt'])
    await type(document.querySelector('[data-slot="from-library-search"]')!, 'budget')
    await settle(60)
    expect(names()).toEqual(['budget-2027.xlsx'])
  })
})

describe('Web search', () => {
  // The catalog as the gateway lists it: Enso Auto, a house model, which the live web serves.
  const catalog = () => api.on('GET /v1/models', { status: 200, body: { object: 'list', data: [{ id: 'enso-auto', object: 'model', owned_by: 'hanzo', name: 'Enso Auto' }] } })

  test('searches the web for this conversation, and is not Deep research', async () => {
    catalog()
    api.on('POST /v1/websearch', { status: 200, body: { results: [{ title: 'Dublin Marathon 2026 results', url: 'https://news.test/marathon', content: 'Kipchoge Jr won in 2:06:41.' }] } })
    at = await drawChat()
    await settle(60)
    await plus('plus-web-search')
    // Said where the conversation carries its other switches, with its way off; Deep research stays off.
    expect(document.querySelector('[data-slot="plus-menu"]')).toBeNull()
    expect(document.body.textContent).toContain('Web search')
    await tap(document.querySelector('[data-slot="plus"]')!)
    expect(document.querySelector('[data-slot="plus-research"]')?.getAttribute('aria-checked')).toBe('false')
    await key('Escape')
    await ask('Who won the Dublin marathon this year?')
    const turn = await api.turn()
    expect(api.calls.some((c) => c.method === 'POST' && c.path === '/v1/websearch')).toBe(true)
    // The lookup ran in the client, before the model was asked: what it found is in what the
    // model reads, and the model is asked without tools.
    expect(turn.asked.tools).toBeUndefined()
    expect(turn.asked.tool_choice).toBeUndefined()
    expect(String(turn.asked.messages?.[0]?.content)).toContain('Kipchoge Jr won in 2:06:41.')
    await turn.say('It was won in record time.')
    await turn.end()
  })

  test('on, it searches every turn, even one the web would skip by its shape', async () => {
    catalog()
    api.on('POST /v1/websearch', { status: 200, body: { results: [{ title: 'Node 26 release notes', url: 'https://news.test/node', content: 'Node 26 ships Temporal.' }] } })
    at = await drawChat()
    await settle(60)
    await plus('plus-web-search')
    await ask('const when = Temporal.Now.instant()')
    const turn = await api.turn()
    expect(api.calls.some((c) => c.method === 'POST' && c.path === '/v1/websearch')).toBe(true)
    expect(String(turn.asked.messages?.[0]?.content)).toContain('Node 26 ships Temporal.')
    await turn.end()
  })

  test('without it, the same question is not searched', async () => {
    catalog()
    at = await drawChat()
    await settle(60)
    await ask('Who won the Dublin marathon this year?')
    const turn = await api.turn()
    expect(api.calls.some((c) => c.path === '/v1/websearch')).toBe(false)
    await turn.end()
  })
})

describe('the opening suggestions', () => {
  // What @hanzo/build reads only to make them from the person's activity: their own files
  // (`/v1/library?scope=mine`; the thread list reads the conversations for itself).
  const readsActivity = () => api.calls.some((c) => c.path === '/v1/library' && c.query.get('scope') === 'mine')

  /** Whether Chat asked Hanzo's model to write suggestions (@hanzo/build suggest.ts `request`). */
  const asksModel = () => api.calls.some((c) => c.method === 'POST' && c.path === '/v1/chat/completions' && Boolean((c.body as { response_format?: unknown })?.response_format))
  const patches = () => api.calls.filter((c) => c.method === 'PATCH' && c.path === '/v1/pref').map((c) => c.body)

  test('say exactly what is sent; Turn off and Turn on go through the account preference', async () => {
    // Each test is its own person: @hanzo/build keeps one person's rows per page.
    signIn('suggest-on')
    // On, said explicitly: @hanzo/build's default for an unset preference is its own to choose.
    api.on('GET /v1/pref', { status: 200, body: { prefs: { suggestions: 'on', callName: 'Zed', work: 'Runs a solar installer' } } })
    api.on('PATCH /v1/pref', { status: 200, body: { prefs: {} } })
    // The model's answer, as a completion (not a stream): no rows of its own, so Hanzo's starters fill.
    api.on('POST /v1/chat/completions', { status: 200, body: { id: 'c1', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: '{"suggestions":[]}' }, finish_reason: 'stop' }] } })
    at = await drawChat()
    await settle(150)
    expect(readsActivity()).toBe(true)
    expect(asksModel()).toBe(true)
    const said = document.querySelector('[data-slot="suggested"]')?.textContent ?? ''
    // What @hanzo/build's suggest.ts `inputs` and `seed` put in the model's request.
    for (const sent of ['chat titles', 'Board issue and pull request titles', 'first line', 'Dev run titles, repositories and branches', 'automations', 'Library file names', 'your name, work, role', 'custom instructions'])
      expect(said).toContain(sent)
    await press('Turn off suggestions')
    await settle(60)
    expect(patches()).toContainEqual({ suggestions: 'off', suggest: null })
    expect(document.querySelector('[data-slot="suggested"]')).toBeNull()
    expect(document.querySelector('[data-slot="suggestions-said"]')?.textContent).toContain('can suggest what to do next')
    await press('Turn on suggestions')
    await settle(60)
    expect(patches()).toContainEqual({ suggestions: 'on' })
  })

  test('an account that turned them off: Chat reads none of its activity and asks no model', async () => {
    signIn('suggest-off')
    api.on('GET /v1/pref', { status: 200, body: { prefs: { suggestions: 'off', callName: 'Zed' } } })
    at = await drawChat()
    await settle(150)
    expect(readsActivity()).toBe(false)
    expect(asksModel()).toBe(false)
    expect(document.querySelector('[data-slot="suggestions"]')).toBeNull()
    expect(document.querySelector('[data-slot="suggested"]')).toBeNull()
    expect(document.querySelector('[data-slot="suggestions-said"]')?.textContent).toContain('can suggest what to do next')
  })

  // A kept row that makes a scheduled task, as /v1/pref holds it (@hanzo/build suggest.ts `kept`), fresh, so
  // no model is asked again.
  const scheduled = (who: string) => {
    signIn(who)
    api.on('GET /v1/pref', {
      status: 200,
      body: {
        prefs: {
          suggestions: 'on',
          suggest: {
            at: new Date().toISOString(),
            sig: 'kept',
            rows: [{ id: 's1', icon: 'agent', title: 'Summarise my week every Friday', summary: '', act: { kind: 'schedule', name: 'Weekly summary', prompt: 'Summarise my week', schedule: { kind: 'weekly', day: 'fri', at: '09:00' } } }],
            dismissed: [],
          },
        },
      },
    })
  }
  const made = () => api.calls.filter((c) => c.method === 'POST' && c.path === '/v1/auto/automations')
  const sent = () => api.calls.filter((c) => c.method === 'POST' && c.path === '/v1/chat/completions')

  test('a scheduled-task suggestion asks through the app confirm first; no makes nothing and sends nothing', async () => {
    scheduled('sched-no')
    at = await drawChat()
    await settle(150)
    await press(/Summarise my week every Friday/)
    expect(document.querySelector('[data-slot="confirm"]')).not.toBeNull()
    await tap(document.querySelector('[data-slot="confirm-cancel"]')!)
    await settle(60)
    expect(made()).toHaveLength(0)
    expect(sent()).toHaveLength(0)
  })

  test('yes makes the task; a refusal is said, never sent as a chat message', async () => {
    scheduled('sched-yes')
    api.on('POST /v1/auto/automations', { status: 500, body: { error: { message: 'Automations are down for maintenance.' } } })
    at = await drawChat()
    await settle(150)
    await press(/Summarise my week every Friday/)
    await tap(document.querySelector('[data-slot="confirm-yes"]')!)
    await settle(60)
    expect(made()).toHaveLength(1)
    expect(sent()).toHaveLength(0)
    expect(document.body.textContent).toContain('Automations are down for maintenance.')
  })

  test('never for a guest', async () => {
    localStorage.clear()
    at = await drawChat()
    await settle(120)
    expect(readsActivity()).toBe(false)
    expect(api.calls.some((c) => c.path === '/v1/pref')).toBe(false)
    expect(document.querySelector('[data-slot="suggested"]')).toBeNull()
  })
})

// An answer in parts, in the shapes the platform streams (@hanzo/ai `streamText`): its thinking
// in `delta.reasoning_content`, its words in `delta.content`, a picture as markdown in the words.
// Tool steps never reach Chat: it offers the gateway no tools (lib/web.ts strips the web's).
describe('an answer made of parts', () => {
  test('draws the thinking while it streams, then the words', async () => {
    at = await drawChat()
    await ask('Is 1001 prime?')
    const turn = await api.turn()
    await turn.think('1001 = 7 × 11 × 13, so it has factors.')
    expect(document.querySelector('[data-slot="thought"]')?.textContent).toContain('7 × 11 × 13')
    await turn.say('No. 1001 is 7 × 11 × 13.')
    await turn.end()
    expect(document.querySelector('[data-slot="thought"]')).toBeNull()
    expect(shown()).toContain('No. 1001 is 7 × 11 × 13.')
  })

  test('a picture in the words is drawn as its name, never as raw markdown or its bytes', async () => {
    at = await drawChat()
    await ask('Chart my sales')
    const turn = await api.turn()
    await turn.say('Here is the chart:\n\n![Sales by month](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==)\n\nSales rose in May.')
    await turn.end()
    const text = shown()
    expect(text).toContain('Here is the chart:')
    expect(text).toContain('Sales by month')
    expect(text).toContain('Sales rose in May.')
    expect(text).not.toContain('![')
    expect(text).not.toContain('data:image')
  })
})

describe('Open in Dev', () => {
  test('is offered nowhere in Chat: not under an answer, not on its code', async () => {
    at = await drawChat()
    await ask('Write a function that adds two numbers')
    const turn = await api.turn()
    await turn.say('Here it is:\n\n```ts\nexport const add = (a: number, b: number) => a + b\n```\n')
    await turn.end()
    expect(document.querySelector('[data-slot="code"]')).not.toBeNull()
    expect(document.querySelector('[data-slot="assistant-turn-actions"]')).not.toBeNull()
    expect(button('Open in Dev')).toBeUndefined()
    expect(document.body.textContent).not.toContain('Open in Dev')
  })
})

describe('Create Board card, in a window of its own', () => {
  const board = () => {
    api.on('GET /v1/task/projects', { status: 200, body: { projects: [{ key: 'hanzo', name: 'Hanzo' }] } })
    api.on('POST /v1/task/projects/hanzo/issues', { status: 200, body: { id: 'card-1', identifier: 'HANZO#1', projectKey: 'hanzo', number: 1, title: 'Ship it' } })
  }
  /** Chat in a window (App's `bar`), with the kit's toaster, and an answer to file. */
  async function filed() {
    const { Windowed } = await import('./windowed')
    const { Toaster } = await import('@hanzo/ui')
    at = await drawChat((node) => createElement(Windowed.Provider, { value: true }, node, createElement(Toaster)))
    await ask('What is left before launch?')
    const turn = await api.turn()
    await turn.say('Ship it: the release notes and the store listing.')
    await turn.end()
    await press('Create Board card')
    await settle(120)
    expect(document.body.textContent).toContain('Added to Board')
  }

  test('with the site at this window’s own address, Open Board is not offered: it would land on nothing', async () => {
    board()
    await filed()
    expect(button('Open Board')).toBeUndefined()
  })

  test('with the site elsewhere, Open Board loads it in this window: a window of its own opens no new one', async () => {
    board()
    const { configure } = await import('./where')
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {})
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    configure({ site: 'https://hanzo.ai' })
    try {
      await filed()
      await press('Open Board')
      expect(assign.mock.calls.map(([u]) => u)).toEqual(['https://hanzo.ai/board'])
      expect(open).not.toHaveBeenCalled()
    } finally {
      configure({ site: '' })
    }
  })
})
