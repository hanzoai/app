import { describe, expect, test, vi, beforeEach } from 'vitest'
import type { Act, Hint } from '@hanzo/build'
import { handleHint } from './hint'

const goMock = vi.fn()
vi.mock('./lib/host', () => ({
  go: (addr: string) => goMock(addr),
}))

vi.mock('@hanzo/build', () => ({
  app: (path: string) => `/dev/${path}`.replace(/\/+$/, ''),
  devPath: (p: { kind: string; id: string }) => `-/${p.kind}/${p.id}`,
  hand: vi.fn(),
  want: vi.fn(),
  book: vi.fn(() => Promise.reject(new Error('fail'))),
}))

describe('handleHint', () => {
  const reopen = vi.fn()
  const submit = vi.fn()

  beforeEach(() => {
    reopen.mockClear()
    submit.mockClear()
    goMock.mockClear()
  })

  test('open action with /chat/<id> calls reopen and go', () => {
    const act: Act = { kind: 'open', to: '/chat/thread-123' }
    const row: Hint = {
      id: 'row-1',
      icon: 'chat',
      title: 'Open research thread',
      summary: 'Research discussion',
      act,
    }

    handleHint(act, row, { reopen, submit })

    expect(reopen).toHaveBeenCalledWith('thread-123')
    expect(goMock).toHaveBeenCalledWith('/chat/thread-123')
    expect(submit).not.toHaveBeenCalled()
  })

  test('send action submits the prompt', () => {
    const act: Act = { kind: 'send', prompt: 'Tell me about quantum computing' }
    const row: Hint = {
      id: 'row-2',
      icon: 'chat',
      title: 'Ask quantum query',
      summary: 'Quantum query',
      act,
    }

    handleHint(act, row, { reopen, submit })

    expect(submit).toHaveBeenCalledWith('Tell me about quantum computing')
    expect(reopen).not.toHaveBeenCalled()
  })

  test('task action in chat submits prompt as query', () => {
    const act: Act = { kind: 'task', prompt: 'Run AI coding agent brief' }
    const row: Hint = {
      id: 'row-3',
      icon: 'task',
      title: 'Run AI coding agent brief',
      summary: 'Code briefing task',
      act,
    }

    handleHint(act, row, { reopen, submit })

    expect(submit).toHaveBeenCalledWith('Run AI coding agent brief')
    expect(reopen).not.toHaveBeenCalled()
  })

  test('open action without chat target falls back to submitting title', () => {
    const act: Act = { kind: 'open', to: '/chat' }
    const row: Hint = {
      id: 'row-4',
      icon: 'chat',
      title: 'Continue AI discussion',
      summary: '',
      act,
    }

    handleHint(act, row, { reopen, submit })

    expect(submit).toHaveBeenCalledWith('Continue AI discussion')
  })

  test('external open action opens window', () => {
    const originalWindow = globalThis.window
    const openMock = vi.fn()
    globalThis.window = { open: openMock } as any
    const act: Act = { kind: 'open', to: 'https://github.com/hanzoai/chat' }
    const row: Hint = {
      id: 'row-5',
      icon: 'github',
      title: 'Review GitHub issue',
      summary: '',
      act,
    }

    handleHint(act, row, { reopen, submit })

    expect(openMock).toHaveBeenCalledWith('https://github.com/hanzoai/chat', '_blank', 'noopener,noreferrer')
    globalThis.window = originalWindow
  })
})
