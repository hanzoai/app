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
vi.mock('@hanzo/gui', () => ({ Anchor: draw, Text: draw, View: draw, XStack: draw, YStack: draw }))
vi.mock('@hanzo/ui', () => ({
  Box: draw,
  Button: ({ children, 'data-slot': slot }: Part) => createElement('button', { 'data-slot': slot }, children),
  Input: ({ value, 'data-slot': slot, placeholder }: { value?: string; 'data-slot'?: string; placeholder?: string }) =>
    createElement('input', { 'data-slot': slot, defaultValue: value, placeholder }),
  Textarea: ({ value, 'data-slot': slot }: { value?: string; 'data-slot'?: string }) =>
    createElement('textarea', { 'data-slot': slot, defaultValue: value }),
  Switch: ({ checked }: { checked?: boolean }) => createElement('input', { type: 'checkbox', defaultChecked: checked }),
  Text: draw,
}))
vi.mock('@hanzo/ui/chat', () => ({
  Code: ({ children }: { children?: ReactNode }) => createElement('pre', null, children),
  Composer: ({
    children,
    placeholder,
    value,
  }: {
    children?: ReactNode
    placeholder?: string
    value?: string
  }) =>
    createElement(
      'div',
      { 'data-slot': 'ui-chat-composer' },
      createElement('textarea', { placeholder, defaultValue: value }),
      children,
    ),
}))
vi.mock('../host', () => ({
  useHost: () => ({
    path: '/flow',
    router: { push: () => {}, replace: () => {}, back: () => {}, forward: () => {} },
  }),
}))

const { FlowPane } = await import('./FlowPane')
const { FlowPlayground } = await import('./FlowPlayground')
const { FlowMcpDrawer } = await import('./FlowMcpDrawer')
const { FLOW_TEMPLATES, instantiateTemplate } = await import('./templates')
const { flowNav } = await import('./nav')
const { FLOW_STUDIO_URL } = await import('./types')

describe('FlowPane, FlowPlayground, FlowKnowledgePanel, FlowMcpDrawer, and flowNav', () => {
  test('renders full Builder with Hanzo Cloud status pill, MCP Server button, Component Palette, OLED Dot Grid, Minimap, Sticky Note, Inspector, and Playground trigger', () => {
    localStorage.clear()
    const html = renderToStaticMarkup(createElement(FlowPane, { path: '/flow' }))
    expect(html).toContain('data-slot="flow-pane"')
    expect(html).toContain('data-slot="flow-cloud-status"')
    expect(html).toContain('Hanzo Enso (api.hanzo.ai/v1) · LLMs + zen-embedding-3 Active via Hanzo IAM')
    expect(html).toContain('data-slot="flow-tab-knowledge"')
    expect(html).toContain('data-slot="flow-mcp-open"')
    expect(html).toContain('data-slot="flow-palette-sidebar"')
    expect(html).toContain('data-slot="flow-canvas"')
    expect(html).toContain('data-slot="flow-dot-grid"')
    expect(html).toContain('data-slot="flow-minimap"')
    expect(html).toContain('data-slot="flow-canvas-toolbar"')
    expect(html).toContain('data-slot="flow-sticky-note"')
    expect(html).toContain('data-slot="flow-inspector"')
    expect(html).toContain('data-slot="flow-test-run"')
    expect(html).toContain('data-slot="flow-playground-open"')
    expect(html).toContain(`href="${FLOW_STUDIO_URL}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('Pokédex Agent')
    expect(html).not.toContain('enso-hybrid')
    expect(html).not.toContain('HANZO_API_KEY')
    expect(html).not.toContain('lf-')
    expect(html).not.toContain('No models enabled')
  })

  test('renders native Hanzo Cloud Knowledge tab with zen-embedding-3, live semantic search, import form, and zero No models enabled', () => {
    const html = renderToStaticMarkup(createElement(FlowPane, { path: '/flow/knowledge' }))
    expect(html).toContain('data-slot="flow-knowledge-view"')
    expect(html).toContain('data-slot="knowledge-provider-pill"')
    expect(html).toContain('Hanzo Enso — zen-embedding-3')
    expect(html).toContain('POST /v1/embeddings')
    expect(html).toContain('POST /v1/knowledge/search')
    expect(html).toContain('POST /v1/knowledge/import')
    expect(html).toContain('GET /v1/knowledge/files')
    expect(html).toContain('GET /v1/knowledge/graph')
    expect(html).toContain('data-slot="knowledge-embed-model-zen-embedding-3"')
    expect(html).toContain('data-slot="knowledge-embed-model-zen-embedding"')
    expect(html).not.toContain('No models enabled')
    expect(html).not.toContain('text-embedding-3-small')
    expect(html).not.toContain('HANZO_API_KEY')
    expect(html).not.toContain('lf-')
  })

  test('renders FlowMcpDrawer with canonical hanzo-<flow_slug> Streamable HTTP config and Hanzo IAM Bearer auth', () => {
    const flow = instantiateTemplate(FLOW_TEMPLATES[0]!)
    const html = renderToStaticMarkup(
      createElement(FlowMcpDrawer, {
        flow,
        orgId: 'hanzo',
        onClose: () => {},
      }),
    )
    expect(html).toContain('data-slot="flow-mcp-drawer"')
    expect(html).toContain('hanzo-pokedex-agent')
    expect(html).toContain('/v1/flow/workflows/')
    expect(html).toContain('https://flow.hanzo.ai/v1/mcp/pokedex-agent')
    expect(html).toContain('Streamable HTTP')
    expect(html).toContain('Hanzo IAM Bearer')
    expect(html).not.toContain('lf-')
    expect(html).not.toContain('HANZO_API_KEY')
    expect(html).not.toContain('/api/')
  })

  test('renders FlowPlayground with Sessions rail, standard @hanzo/ui/chat Composer, and canonical Enso model selector pill', () => {
    const flow = instantiateTemplate(FLOW_TEMPLATES[0]!)
    const html = renderToStaticMarkup(
      createElement(FlowPlayground, {
        flow,
        orgId: 'hanzo',
        onClose: () => {},
        onLiveStepsChange: () => {},
        onRunRecorded: () => {},
      }),
    )
    expect(html).toContain('data-slot="flow-playground"')
    expect(html).toContain('data-slot="playground-sessions"')
    expect(html).toContain('data-slot="playground-new-session"')
    expect(html).toContain('Default Session')
    expect(html).toContain('data-slot="flow-playground-composer"')
    expect(html).toContain('data-slot="ui-chat-composer"')
    expect(html).toContain('data-slot="playground-model-pill"')
    expect(html).toContain('Enso')
    expect(html).not.toContain('enso-hybrid')
    expect(html).not.toContain('HANZO_API_KEY')
  })

  test('renders Scheduled, Runs, and 26-template categorized Templates gallery cleanly', () => {
    const scheduled = renderToStaticMarkup(createElement(FlowPane, { path: '/flow/scheduled' }))
    expect(scheduled).toContain('data-slot="flow-scheduled-view"')
    expect(scheduled).toContain('Scheduled Intelligence Brief')
    expect(scheduled).toContain('0 8 * * 1-5')

    const runs = renderToStaticMarkup(createElement(FlowPane, { path: '/flow/runs' }))
    expect(runs).toContain('data-slot="flow-runs-view"')

    const templates = renderToStaticMarkup(createElement(FlowPane, { path: '/flow/templates' }))
    expect(templates).toContain('data-slot="flow-templates-view"')
    expect(templates).toContain('data-slot="flow-template-categories"')
    expect(templates).toContain('Pokédex Agent')
    expect(templates).toContain('Basic Prompting')
    expect(templates).toContain('Vector Store RAG')
    expect(templates).toContain('Financial Report Parser')
    expect(templates).toContain('CRM Speed-to-Lead Setter')
    expect(templates).not.toContain('enso-hybrid')
    expect(templates).not.toContain('Langflow')
  })

  test('flowNav returns contextual sidebar links for all Flow views including Knowledge', () => {
    const moved: string[] = []
    const groups = flowNav('knowledge', (to) => moved.push(to))
    expect(groups).toHaveLength(1)
    const ids = groups[0]!.links.map((l) => l.id)
    expect(ids).toEqual(['new', 'flows', 'knowledge', 'scheduled', 'runs', 'templates'])
    expect(groups[0]!.links.find((l) => l.id === 'knowledge')?.active).toBe(true)
    groups[0]!.links.find((l) => l.id === 'templates')?.onPress?.()
    expect(moved).toEqual(['/flow/templates'])
  })
})
