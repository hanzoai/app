import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearTokens, contextOf, readTokens, tokenKey, tokensOf } from './tokens'
vi.mock('@hanzo/ui/product/useLimits', () => ({ observe: vi.fn() }))
import { observed } from './served'
afterEach(clearTokens)
const messages = [{ role: 'system', content: 'Be helpful.' }, { role: 'user', content: 'Hello' }]
const key = tokenKey('acme', 'zen6', messages)
const init = { headers: { 'X-Org-Id': 'acme' }, body: JSON.stringify({ model: 'zen6', messages }) }

describe('reported token usage', () => {
  it('keeps real zero counts, cache and reasoning; rejects missing, negative and nonfinite counts', () => {
    expect(tokensOf({ prompt_tokens: 0, completion_tokens: 0 })).toEqual({ input: 0, output: 0, total: 0 })
    expect(tokensOf({ input_tokens: 10, output_tokens: 3, prompt_tokens_details: { cached_tokens: 4 }, completion_tokens_details: { reasoning_tokens: 2 } })).toEqual({ input: 10, output: 3, total: 13, cached: 4, reasoning: 2 })
    for (const raw of [null, {}, { prompt_tokens: -1, completion_tokens: 2 }, { prompt_tokens: Infinity, completion_tokens: 1 }]) expect(tokensOf(raw)).toBeNull()
  })
  it('captures final SSE usage even after the served header/model and across split UTF-8 chunks', async () => {
    const raw = 'data: {"model":"zen6","choices":[{"delta":{"content":"你好"}}]}\n\ndata: {"usage":{"prompt_tokens":122,"completion_tokens":21,"total_tokens":143}}\n\ndata: [DONE]\n\n'
    const bytes = new TextEncoder().encode(raw)
    const wire = new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 5) c.enqueue(bytes.slice(i, i + 5)); c.close() } })
    const fetcher = observed(vi.fn().mockResolvedValue(new Response(wire, { headers: { 'content-type': 'text/event-stream', 'x-hanzo-served': 'zen6' } })))
    const response = await fetcher('https://api.example/v1/chat/completions', init)
    expect(await response.text()).toBe(raw)
    expect(readTokens(key)).toEqual({ input: 122, output: 21, total: 143 })
  })
  it('captures JSON usage without consuming the caller’s response', async () => {
    const body = { model: 'zen6', usage: { prompt_tokens: 9, completion_tokens: 4 } }
    const response = await observed(vi.fn().mockResolvedValue(Response.json(body)))('https://api.example/v1/chat/completions', init)
    expect(await response.json()).toEqual(body)
    await vi.waitFor(() => expect(readTokens(key)?.total).toBe(13))
  })
  it('does not reuse usage for another organization, subject, model or conversation', () => {
    expect(tokenKey('other', 'zen6', messages)).not.toBe(key)
    expect(tokenKey('acme', 'zen6', messages, 'other-user')).not.toBe(key)
    expect(tokenKey('acme', 'other-model', messages)).not.toBe(key)
    expect(tokenKey('acme', 'zen6', [{ role: 'user', content: 'Different' }])).not.toBe(key)
    expect(tokenKey('acme', 'zen6', [...messages, { role: 'assistant', content: 'Hi' }])).toBe(key)
  })
  it('does not label base64 image bytes as text tokens and includes the draft', () => {
    const result = contextOf([{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }, { type: 'text', text: 'text' }] }], '12345678')
    expect(result.images).toBe(true)
    expect(result.total).toBe(3)
  })
})
