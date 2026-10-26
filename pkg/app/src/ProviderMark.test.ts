import { cloneElement, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

// gui is not under test and does not load outside a bundler: a View draws the
// element it is given to render, with its children.
vi.mock('./ui', () => ({
  Text: ({ children }: { children?: ReactNode }) => createElement('span', null, children),
  View: ({ render, children }: { render?: ReactElement | string; children?: ReactNode }) =>
    isValidElement(render) ? cloneElement(render, undefined, children) : createElement(typeof render === 'string' ? render : 'div', null, children),
}))

const { ProviderMark } = await import('./ProviderMark')

const drawn = (props: { org: string; model?: string; ink?: boolean }) => renderToStaticMarkup(createElement(ProviderMark, props))

// Zoo's three primaries, read from the mark in its own colours: one per petal.
const PETALS = [...drawn({ org: 'zoo' }).matchAll(/ stroke="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1])

describe('the Zoo mark', () => {
  test('in its own colours, the three petals keep Zoo\'s three hues', () => {
    expect(PETALS).toHaveLength(3)
    expect(new Set(PETALS).size).toBe(3)
  })

  test('under ink, every petal takes the page\'s ink', () => {
    // By lab, and by a Zen model under Hanzo's namespace, as hanzo.ai's /models draws it.
    for (const html of [drawn({ org: 'zoo', ink: true }), drawn({ org: 'hanzo', model: 'zen5-pro', ink: true })]) {
      expect(html).toContain('clip-path="url(#zoo-cut)"')
      for (const hue of PETALS) expect(html).not.toContain(hue)
      expect(html).not.toMatch(/stroke="#/)
      expect(html).toContain('stroke="currentColor"')
      expect(html.match(/<circle cx="[\d.]+" cy="[\d.]+" r="9.509" stroke-width="2.4">/g)).toHaveLength(3)
    }
  })

  test('the disc fills its box: the frame\'s outer edge is the box\'s edge, and its lines carry weight', () => {
    const [, r, width] = drawn({ org: 'zoo' }).match(/<circle cx="12" cy="12" r="([\d.]+)" stroke-width="([\d.]+)">/) ?? []
    expect(Number(r) + Number(width) / 2).toBeCloseTo(12, 5)
    expect(Number(width)).toBeGreaterThanOrEqual(2)
  })
})
