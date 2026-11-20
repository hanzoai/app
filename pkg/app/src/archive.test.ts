import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Thread } from '@hanzo/ai'

const { toast } = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), { success: vi.fn() })
  return { toast }
})
vi.mock('@hanzo/ui', () => ({ toast }))

const { archiveWithUndo } = await import('./archive')
const say = (s: string) => s
const chat = (extra: Partial<Thread> = {}) => ({ id: 'c1', title: 'Plan', ...extra }) as Thread

beforeEach(() => {
  toast.mockReset()
  toast.success.mockReset()
})

describe('archiving a conversation', () => {
  test('says so with an Undo that archives the same conversation again, which puts it back', async () => {
    const archive = vi.fn(async () => true)
    await archiveWithUndo({ archive }, say, chat())
    expect(archive).toHaveBeenCalledTimes(1)
    const [message, options] = toast.mock.calls[0]!
    expect(message).toBe('Archived chat')
    expect(options.action.label).toBe('Undo')
    options.action.onClick()
    expect(archive).toHaveBeenCalledTimes(2)
    expect(archive).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'c1', archived: true }))
  })

  test('unarchiving offers no Undo', async () => {
    await archiveWithUndo({ archive: async () => true }, say, chat({ archived: true }))
    expect(toast).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Unarchived chat')
  })

  test('a store that refuses says nothing', async () => {
    await archiveWithUndo({ archive: async () => false }, say, chat())
    expect(toast).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })
})
