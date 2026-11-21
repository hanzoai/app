import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

vi.mock('@hanzo/tabs', () => ({ frameUrl: async () => '' }))
vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/ui', () => ({ Button: 'button', Text: 'span', XStack: 'div', YStack: 'div' }))
vi.mock('@hanzo/dev-core', () => ({}))
vi.mock('./lib/api', () => ({ api: () => 'https://api.test' }))
vi.mock('./lib/session', () => ({ bearer: () => 't' }))
vi.mock('./lib/host', () => ({ app: (p: string) => `/dev/${p}`, TERMINALS: '/tabs' }))

import { DevInterior, DevList, Scope } from './DevPane'

const host = { go: () => {}, path: '/dev' } as never
const draw = (runtime: unknown, el = createElement(DevInterior, { host, path: '/dev' })) =>
  renderToStaticMarkup(createElement(Scope.Provider, { value: runtime as never }, el))

describe('Dev interior', () => {
  test('no runtime is Dev\'s own start state, never a second surface', () => {
    expect(draw(null)).not.toContain('builder')
  })
  test('a runtime being found draws nothing', () => {
    expect(draw(undefined)).toBe('')
  })
  test('the thread list draws only with a runtime', () => {
    expect(draw(null, createElement(DevList, { host, path: '/dev' }))).toBe('')
  })
})
