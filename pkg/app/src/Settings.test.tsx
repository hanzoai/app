import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/ui', () => ({ Text: ({ children }: { children: ReactNode }) => createElement('p', null, children) }))
vi.mock('@hanzo/ui/chat', () => ({
  SidebarItem: ({ children, active }: { children: ReactNode; active?: boolean }) => createElement('li', { 'data-active': String(Boolean(active)) }, children),
  SidebarSection: ({ label, children }: { label: string; children: ReactNode }) => createElement('section', { 'aria-label': label }, children),
}))

import { FIRST, pageOf, rows, SettingsList } from './Settings'
import { configure, where } from './where'

const before = { ...where() }
afterEach(() => configure({ section: undefined }))
afterEach(() => configure(before))

const Mine = () => createElement('p', null, 'models on this computer')
const list = (filter = '') => renderToStaticMarkup(createElement(SettingsList, { active: FIRST, filter, onPick: () => {}, onBack: () => {} }))

describe("the host's Settings section", () => {
  test('without one, Settings is the app’s own', () => {
    expect(rows().some((r) => r.id === 'this-computer')).toBe(false)
    expect(pageOf('this-computer')).toBeUndefined()
    expect(list()).not.toContain('This computer')
  })

  test('with one, its row is listed last under Preferences and the pane draws its page', () => {
    configure({ section: { id: 'this-computer', label: 'This computer', Page: Mine } })
    const html = list()
    const preferences = html.slice(html.indexOf('aria-label="Preferences"'), html.indexOf('aria-label="Customize"'))
    expect(preferences.indexOf('Personal agent')).toBeLessThan(preferences.indexOf('This computer'))
    expect(rows().find((r) => r.id === 'this-computer')?.label).toBe('This computer')
    expect(pageOf('this-computer')).toBe(Mine)
    expect(pageOf('general')).toBeUndefined()
  })

  test('the rail’s filter finds it', () => {
    configure({ section: { id: 'this-computer', label: 'This computer', Page: Mine } })
    expect(list('computer')).toContain('This computer')
    expect(list('computer')).not.toContain('General')
  })
})
