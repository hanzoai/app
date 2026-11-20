import { describe, expect, test, vi } from 'vitest'
import { written } from './lastpage'

// @hanzo/build's index does not load under node (the other tests mock it too):
// its fence reader and `renders`, as reply.tsx writes them.
vi.mock('@hanzo/build', () => {
  const MIME: Record<string, string> = { html: 'text/html', htm: 'text/html', svg: 'image/svg+xml', css: 'text/css' }
  const suffix = (s: string) => (s.lastIndexOf('.') > 0 ? s.slice(s.lastIndexOf('.') + 1).toLowerCase() : '')
  return {
    artifacts: (text: string) => {
      const out: { name: string; body: string; mime: string }[] = []
      let n = 0
      for (const [, info = '', body = ''] of text.matchAll(/```([^\n`]*)\n([\s\S]*?)```/g)) {
        n += 1
        const words = info.trim().split(/\s+/).filter(Boolean)
        const name = words.find((w) => w.includes('.') && suffix(w)) ?? (words[0] ? `${words[0]} block` : `Block ${n}`)
        out.push({ name, body, mime: MIME[suffix(name) || words[0]?.toLowerCase() || ''] ?? 'text/plain' })
      }
      return out
    },
    renders: (a: { mime: string }) => a.mime === 'text/html' || a.mime === 'image/svg+xml',
  }
})

const PAGE = '<!doctype html><title>Plants</title><h1>Plants</h1>'

describe('the page the Preview opens (issue 443)', () => {
  test('is the last page an answer wrote, its file name kept', () => {
    const turns = [
      { role: 'user', content: 'a page' },
      { role: 'assistant', content: 'Here:\n```html index.html\n<h1>First</h1>\n```' },
      { role: 'user', content: 'another' },
      { role: 'assistant', content: `Done.\n\`\`\`html plants.html\n${PAGE}\n\`\`\`\nand the styles\n\`\`\`css\nh1{}\n\`\`\`` },
    ]
    const page = written(turns)
    expect(page?.name).toBe('plants.html')
    expect(page?.mime).toBe('text/html')
    expect(page?.body).toContain('<h1>Plants</h1>')
  })

  test('reaches back past answers that wrote none', () => {
    const turns = [
      { role: 'assistant', content: '```svg\n<svg/>\n```' },
      { role: 'user', content: 'what did you build?' },
      { role: 'assistant', content: 'A logo, in the Preview.' },
    ]
    expect(written(turns)?.mime).toBe('image/svg+xml')
  })

  test('is safe on a turn still streaming: an unclosed fence is not a page (issue 443)', () => {
    // The composer Preview stays up while a follow-up streams, so `written`
    // must never return a half-written block — only a closed fence counts.
    const turns = [
      { role: 'assistant', content: 'Here:\n```html index.html\n<h1>First</h1>\n```' },
      { role: 'user', content: 'what did you build?' },
      { role: 'assistant', content: 'A showcase, with tabs:\n```html demo.html\n<h1>Half' },
    ]
    expect(written(turns)?.name).toBe('index.html')
  })

  test('is safe on a turn still streaming: a closed fence in it already counts (issue 443)', () => {
    const turns = [
      { role: 'assistant', content: 'Here:\n```html index.html\n<h1>First</h1>\n```' },
      { role: 'user', content: 'what did you build?' },
      { role: 'assistant', content: 'A showcase:\n```html demo.html\n<h1>Done</h1>\n```\nand more coming' },
    ]
    expect(written(turns)?.name).toBe('demo.html')
  })

  test('is nothing for code that is not a page, for a question, or for a system turn', () => {
    expect(written([{ role: 'assistant', content: '```ts\nconst a = 1\n```' }])).toBeNull()
    expect(written([{ role: 'user', content: `\`\`\`html\n${PAGE}\n\`\`\`` }])).toBeNull()
    expect(written([{ role: 'system', content: `\`\`\`html\n${PAGE}\n\`\`\`` }])).toBeNull()
    expect(written([])).toBeNull()
  })
})
