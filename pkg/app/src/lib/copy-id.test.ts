import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/ui', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from '@hanzo/ui'
import { copyId } from './copy-id'

const say = (s: string) => s

afterEach(() => vi.unstubAllGlobals())

describe('copyId', () => {
  test('puts the id itself on the clipboard, not a link', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await copyId('conv_123', say)
    expect(writeText).toHaveBeenCalledWith('conv_123')
    expect(toast.success).toHaveBeenCalledWith('Id copied')
  })
  test('says so when the browser refuses', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('no') } } })
    await copyId('conv_123', say)
    expect(toast.error).toHaveBeenCalledWith('The browser would not copy the id.')
  })
})
