// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { classifySourceOrigin, extractCitations } from './RightPane'
import type { ChatMessage } from '@hanzo/ai/react'

describe('RightPane research source classification & citations', () => {
  it('distinguishes web search/crawl/fetch tools from connected workspace/MCP tools', () => {
    expect(classifySourceOrigin('web_search')).toBe('web')
    expect(classifySourceOrigin('websearch')).toBe('web')
    expect(classifySourceOrigin('search')).toBe('web')
    expect(classifySourceOrigin('crawl')).toBe('web')
    expect(classifySourceOrigin('fetch')).toBe('web')
    expect(classifySourceOrigin('open_url')).toBe('web')

    expect(classifySourceOrigin('github_list_prs')).toBe('connected')
    expect(classifySourceOrigin('linear_search_issues')).toBe('connected')
    expect(classifySourceOrigin('read_file')).toBe('connected')
    expect(classifySourceOrigin('slack_query')).toBe('connected')
  })

  it('extracts unique http/https citations from assistant turns only', () => {
    const messages: ChatMessage[] = [
      {
        id: 'u1',
        role: 'user',
        content: 'Check [User Link](https://ignored.example.com/user)',
      },
      {
        id: 'a1',
        role: 'assistant',
        content:
          'According to [Hanzo Docs](https://docs.hanzo.ai/guide) and [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110), also duplicate [Again](https://docs.hanzo.ai/guide) and unsafe [Bad](javascript:alert(1)).',
      },
    ]

    const citations = extractCitations(messages)
    expect(citations).toHaveLength(2)
    expect(citations[0]).toMatchObject({
      title: 'Hanzo Docs',
      url: 'https://docs.hanzo.ai/guide',
      host: 'docs.hanzo.ai',
    })
    expect(citations[1]).toMatchObject({
      title: 'RFC 9110',
      url: 'https://www.rfc-editor.org/rfc/rfc9110',
      host: 'rfc-editor.org',
    })
  })
})
