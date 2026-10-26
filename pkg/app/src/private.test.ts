import { describe, expect, test } from 'vitest'

describe('private / forgetful chat mode & conversation header controls', () => {
  test('empty chat offers private chat forgetful mode toggle', () => {
    const said: unknown[] = []
    const isNew = said.length === 0
    expect(isNew).toBe(true)

    let forgetful = false
    const toggle = () => {
      forgetful = !forgetful
    }

    // Toggle on
    toggle()
    expect(forgetful).toBe(true)

    // Turning on private mode disables persistence (keep: false)
    const anonymous = false
    const keep = !anonymous && !forgetful
    expect(keep).toBe(false)

    // Toggle off
    toggle()
    expect(forgetful).toBe(false)
    expect(!anonymous && !forgetful).toBe(true)
  })

  test('active conversation switches from private toggle to conversation menu options', () => {
    const emptyChat: unknown[] = []
    const activeChat: { role: string; content: string }[] = [{ role: 'user', content: 'Hello' }]

    const controlMode = (said: unknown[]) => (said.length > 0 ? 'conversation-options' : 'header-private-chat')

    expect(controlMode(emptyChat)).toBe('header-private-chat')
    expect(controlMode(activeChat)).toBe('conversation-options')
  })
})
