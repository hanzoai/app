import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/dev-core', () => ({ DevProvider: () => null, useDevOpen: () => async () => 'draft/d1' }))
vi.mock('./devRuntime', () => ({ resolveRuntime: async () => null }))
vi.mock('./lib/host', () => ({ app: (p: string) => `/dev/${p}` }))

import { DevOpen, threadAt } from './DevOpen'

describe('DevOpen', () => {
  test('a thread ref is an address under /dev/thread', () => {
    expect(threadAt('draft/d1')).toBe('/dev/thread/draft/d1')
    expect(threadAt('env/t9')).toBe('/dev/thread/env/t9')
  })
  test('draws nothing itself: the runtime is found, then the core does the work', () => {
    expect(renderToStaticMarkup(createElement(DevOpen, { repo: 'git.hanzo.ai/a/b', branch: '', onDone() {}, onNone() {}, onFail() {} }))).toBe('')
  })
})
