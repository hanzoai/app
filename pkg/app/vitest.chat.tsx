// Chat, mounted whole for a real-kit test (`*.gui.test.tsx`): the app's own IAM provider and
// @hanzo/ai client (lib/ai `useAi`, the one App builds, `observed` and `researched` on its wire),
// the real gui kit, and `fetch` answered by a stand-in platform that speaks the platform's own
// shapes. Nothing in Chat is mocked: a test types, presses and reads what the person would.
//
// THE SHAPES are read from the client that parses them, never guessed:
// - a turn streams `/v1/chat/completions` as server-sent events, each `data:` a
//   ChatCompletionChunk (@hanzo/ai types.d.ts), its words in `choices[0].delta.content`, its
//   thinking in `delta.reasoning_content`, then `data: [DONE]` (@hanzo/ai `streamText`);
// - a refusal is the gateway's JSON envelope with its status (`{error: {message, type, code}}`,
//   the meter's billing envelope, as bots.test.ts holds it);
// Any other route answers 404, as a route the platform does not serve does.
import { act, createElement, type ReactNode } from 'react'
import { vi } from 'vitest'
import { IamProvider } from '@hanzo/iam/react'
import { AiProvider } from '@hanzo/ai/react'
import { mount, tap, type Mounted } from './vitest.real'
import { useAi } from './src/lib/ai'
import { Chat } from './src/Chat'

/** One request the page made, as the platform saw it. */
export interface Call {
  method: string
  path: string
  query: URLSearchParams
  body: unknown
}

/** A turn the page asked for, held open until the test speaks for the model. */
export interface Turn {
  /** What the page asked: `{model, messages, stream, …}`. */
  asked: { model?: string; messages?: { role: string; content: unknown }[]; tools?: unknown[]; [k: string]: unknown }
  /** Words of the answer, as one chunk. */
  say(text: string): Promise<void>
  /** The model's reasoning, as one chunk. */
  think(text: string): Promise<void>
  /** `data: [DONE]` and the stream's end. */
  end(): Promise<void>
  /** Whether the page let go of the stream (Stop, or the stall). */
  readonly cancelled: boolean
}

type Reply = { status: number; body: unknown } | ((call: Call) => { status: number; body: unknown } | undefined)

export interface Platform {
  calls: Call[]
  /** Answer `METHOD /path` (or `/path` for any method) with this JSON, or by this function. */
  on(route: string, reply: Reply): void
  /** The next completion answers with this refusal instead of a stream. */
  refuse(status: number, body: unknown): void
  /** Resolves with the next completion the page opens. */
  turn(): Promise<Turn>
}

const enc = new TextEncoder()
const frame = (data: unknown) => enc.encode(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`)
const chunk = (model: string, delta: Record<string, string>) => ({
  id: 'chatcmpl-1',
  object: 'chat.completion.chunk',
  created: Math.floor(Date.now() / 1000),
  model,
  choices: [{ index: 0, delta, finish_reason: null }],
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Lets the page take what arrived: microtasks, React's commit, the kit's frame. */
export const settle = (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))))

/** The stand-in platform, installed as `fetch`. */
export function platform(): Platform {
  const calls: Call[] = []
  const routes = new Map<string, Reply>()
  const refusals: { status: number; body: unknown }[] = []
  const waiting: ((t: Turn) => void)[] = []
  const opened: Turn[] = []

  const open = (asked: Turn['asked'], signal?: AbortSignal | null): Response => {
    let out!: ReadableStreamDefaultController<Uint8Array>
    let cancelled = false
    const model = String(asked.model ?? '')
    const body = new ReadableStream<Uint8Array>({
      start: (c) => void (out = c),
      cancel: () => void (cancelled = true),
    })
    // A fetch the page aborts ends its stream, as the network does.
    signal?.addEventListener('abort', () => {
      if (cancelled) return
      cancelled = true
      try {
        out.error(new DOMException('aborted', 'AbortError'))
      } catch {
        /* already closed */
      }
    })
    const push = (bytes: Uint8Array) =>
      act(async () => {
        if (!cancelled) out.enqueue(bytes)
        await new Promise((r) => setTimeout(r, 30))
      })
    const turn: Turn = {
      asked,
      say: (text) => push(frame(chunk(model, { content: text }))),
      think: (text) => push(frame(chunk(model, { reasoning_content: text }))),
      end: () =>
        act(async () => {
          if (!cancelled) {
            out.enqueue(frame('[DONE]'))
            out.close()
          }
          await new Promise((r) => setTimeout(r, 30))
        }),
      get cancelled() {
        return cancelled
      },
    }
    const next = waiting.shift()
    if (next) next(turn)
    else opened.push(turn)
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }

  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(href, 'http://localhost/')
    const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
    let body: unknown = init?.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        /* kept as sent */
      }
    }
    const call: Call = { method, path: url.pathname, query: url.searchParams, body }
    calls.push(call)
    if (method === 'POST' && url.pathname === '/v1/chat/completions' && (body as { stream?: boolean })?.stream) {
      const refusal = refusals.shift()
      if (refusal) return json(refusal.status, refusal.body)
      return open(body as Turn['asked'], init?.signal)
    }
    const reply = routes.get(`${method} ${url.pathname}`) ?? routes.get(url.pathname)
    const got = typeof reply === 'function' ? reply(call) : reply
    return got ? json(got.status, got.body) : json(404, { error: { message: 'not found', code: 'not_found' } })
  })
  vi.stubGlobal('fetch', fetcher)

  return {
    calls,
    on: (route, reply) => void routes.set(route, reply),
    refuse: (status, body) => void refusals.push({ status, body }),
    turn: () => {
      const ready = opened.shift()
      return ready ? Promise.resolve(ready) : new Promise((r) => waiting.push(r))
    },
  }
}

/** A signed-in person's session, kept where lib/session reads it: one org, their role in it, a live token. */
export function signIn(org = 'acme', role: 'owner' | 'admin' | 'member' = 'owner'): void {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  const exp = Math.floor(Date.now() / 1000) + 3600
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'u1', owner: org, name: 'z', displayName: 'Zed', orgs: [{ org, role }], aud: 'hanzo-app', exp })}.x`
  localStorage.setItem('hanzo_iam_access_token', token)
  localStorage.setItem('hanzo_iam_expires_at', String(exp * 1000))
}

/** What App wraps every app in, for Chat: the @hanzo/ai client built from the session. */
function Frame({ children }: { children: ReactNode }) {
  const { client } = useAi()
  return createElement(AiProvider as never, { client: client ?? undefined } as never, children)
}

/** Chat, mounted under the session; `wrap` puts a provider around it (a window's `Windowed`). */
export async function drawChat(wrap: (node: ReactNode) => ReactNode = (n) => n, props: Record<string, unknown> = {}): Promise<Mounted> {
  const at = await mount()
  await at.draw(
    createElement(
      IamProvider as never,
      { config: { serverUrl: 'https://hanzo.id', clientId: 'hanzo-app' }, autoInit: false } as never,
      wrap(createElement(Frame, null, createElement(Chat as never, props))),
    ),
  )
  await settle()
  return at
}

/** The composer's field. */
export const field = (): HTMLTextAreaElement =>
  (document.querySelector('[data-slot="composer-field"] textarea') ??
    document.querySelector('textarea[aria-label="Ask anything"]') ??
    document.querySelector('textarea')) as HTMLTextAreaElement

/** Types `text` into the composer as a person does, and sends it with Enter. */
export async function ask(text: string): Promise<void> {
  const box = field()
  if (!box) throw new Error('no composer field')
  await act(async () => {
    box.focus()
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(box), 'value')!.set!
    set.call(box, text)
    box.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 30))
  })
  await act(async () => {
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await new Promise((r) => setTimeout(r, 60))
  })
}

/** The button whose words or accessible name are `name`. */
export const button = (name: string | RegExp): HTMLElement | undefined =>
  [...document.querySelectorAll<HTMLElement>('button, [role="button"]')].find((b) => {
    const said = [b.textContent?.trim() ?? '', b.getAttribute('aria-label') ?? '']
    return said.some((s) => (typeof name === 'string' ? s === name : name.test(s)))
  })

/** Presses the button named `name`; throws when there is none, so a missing control fails the test by name. */
export async function press(name: string | RegExp): Promise<void> {
  const b = button(name)
  if (!b) throw new Error(`no button ${String(name)}; buttons: ${[...document.querySelectorAll('button')].map((x) => x.getAttribute('aria-label') || x.textContent?.trim()).join(' | ')}`)
  await tap(b)
}

/** The conversation's words, as drawn. */
export const shown = (): string => document.querySelector('[data-slot="conversation"]')?.textContent ?? ''
