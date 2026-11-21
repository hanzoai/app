// @vitest-environment happy-dom
// Deleting a bot group asks through the one Confirm, drawn with the real kit.
import { createElement } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { mount, press, tap, type Mounted } from '../../vitest.real'

vi.mock('./api', async (real) => ({
  ...(await real<typeof import('./api')>()),
  slackStatus: async () => ({ connected: false }),
  slackChannels: async () => [],
  answering: async () => null,
}))
vi.mock('../lib/ai', () => ({ useAi: () => ({ client: null }) }))

import { GroupPanel } from './Groups'

let at: Mounted
afterEach(() => at?.done())

const find = (text: string) => [...document.querySelectorAll('button, [role="button"]')].find((b) => b.textContent === text) as HTMLElement

describe('Delete group', () => {
  test('asks first, keeps the group on Escape or Cancel, and deletes it on yes', async () => {
    const onDelete = vi.fn(async () => {})
    const group = { id: 'g1', name: 'Sales', members: [], layer: 1 } as never
    at = await mount()
    await at.draw(createElement(GroupPanel, { group, groups: [group], bots: [], onClose: () => {}, onEdit: () => {}, onDelete, onPickBot: () => {} }))
    await tap(find('Delete group Sales'))
    expect(document.querySelector('[data-slot="confirm"]')?.textContent).toContain('Delete group Sales?')
    await press('Escape')
    expect(document.querySelector('[data-slot="confirm"]')).toBeNull()
    await tap(find('Delete group Sales'))
    await tap(document.querySelector('[data-slot="confirm-cancel"]')!)
    expect(onDelete).not.toHaveBeenCalled()
    await tap(find('Delete group Sales'))
    await tap(document.querySelector('[data-slot="confirm-yes"]')!)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
