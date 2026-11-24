// @vitest-environment happy-dom
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'

type Part = {
  children?: ReactNode
  render?: ReactNode
  href?: string
  target?: string
  'data-slot'?: string
  'data-flow-node'?: string
  'data-model-id'?: string
  'aria-label'?: string
  onClick?: () => void
  onPress?: () => void
}

const draw = ({ children, render, 'data-slot': slot, 'data-flow-node': nodeId, 'data-model-id': modelId, 'aria-label': label }: Part) => {
  if (render && typeof render === 'object' && 'props' in (render as { props?: Record<string, unknown> })) {
    const el = render as { type: string; props: Record<string, unknown> }
    return createElement(el.type, { ...el.props, 'data-slot': slot, 'aria-label': label }, children)
  }
  return createElement('div', { 'data-slot': slot, 'data-flow-node': nodeId, 'data-model-id': modelId, 'aria-label': label }, children)
}

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/gui', () => ({ Text: draw, XStack: draw, YStack: draw }))
vi.mock('@hanzo/ui', () => ({
  Button: ({ children, 'data-slot': slot }: Part) => createElement('button', { 'data-slot': slot }, children),
  Input: ({ value, 'data-slot': slot }: { value?: string; 'data-slot'?: string }) => createElement('input', { 'data-slot': slot, defaultValue: value }),
  Textarea: ({ value, 'data-slot': slot }: { value?: string; 'data-slot'?: string }) => createElement('textarea', { 'data-slot': slot, defaultValue: value }),
  Switch: ({ checked }: { checked?: boolean }) => createElement('input', { type: 'checkbox', defaultChecked: checked }),
  Text: draw,
}))
vi.mock('../host', () => ({ useHost: () => ({ path: '/flow', router: { push: () => {}, replace: () => {}, back: () => {}, forward: () => {} } }) }))

const { FlowPane } = await import('./FlowPane')
const { flowNav } = await import('./nav')
const { FLOW_STUDIO_URL } = await import('./types')

describe('FlowPane and flowNav', () => {
  test('renders Builder canvas with flows list, nodes, Test run button, and external Flow Studio link', () => {
    localStorage.clear()
    const html = renderToStaticMarkup(createElement(FlowPane, { path: '/flow' }))
    expect(html).toContain('data-slot="flow-pane"')
    expect(html).toContain('data-slot="flow-list"')
    expect(html).toContain('data-slot="flow-canvas"')
    expect(html).toContain('data-slot="flow-inspector"')
    expect(html).toContain('data-slot="flow-test-run"')
    expect(html).toContain(`href="${FLOW_STUDIO_URL}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('AI Agent Pipeline')
    expect(html).not.toContain('enso-hybrid')
  })

  test('renders Scheduled, Runs, and Templates views cleanly', () => {
    const scheduled = renderToStaticMarkup(createElement(FlowPane, { path: '/flow/scheduled' }))
    expect(scheduled).toContain('data-slot="flow-scheduled-view"')
    expect(scheduled).toContain('Scheduled Research Brief')
    expect(scheduled).toContain('0 8 * * 1-5')

    const runs = renderToStaticMarkup(createElement(FlowPane, { path: '/flow/runs' }))
    expect(runs).toContain('data-slot="flow-runs-view"')

    const templates = renderToStaticMarkup(createElement(FlowPane, { path: '/flow/templates' }))
    expect(templates).toContain('data-slot="flow-templates-view"')
    expect(templates).toContain('AI Agent Pipeline')
    expect(templates).toContain('Scheduled Research Brief')
    expect(templates).toContain('Webhook Automation')
    expect(templates).toContain('CRM Follow-Up')
  })

  test('flowNav returns contextual sidebar links for all Flow views', () => {
    const moved: string[] = []
    const groups = flowNav('scheduled', (to) => moved.push(to))
    expect(groups).toHaveLength(1)
    const ids = groups[0]!.links.map((l) => l.id)
    expect(ids).toEqual(['new', 'flows', 'scheduled', 'runs', 'templates'])
    expect(groups[0]!.links.find((l) => l.id === 'scheduled')?.active).toBe(true)
    groups[0]!.links.find((l) => l.id === 'templates')?.onPress?.()
    expect(moved).toEqual(['/flow/templates'])
  })
})
