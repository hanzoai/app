// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

type Part = {
  children?: ReactNode
  render?: ReactNode
  href?: string
  target?: string
  'data-slot'?: string
  'data-flow-node'?: string
  'data-model-id'?: string
  'aria-label'?: string
  'aria-expanded'?: boolean
  onClick?: () => void
  onPress?: () => void
}

const draw = ({
  children,
  render,
  'data-slot': slot,
  'data-flow-node': nodeId,
  'data-model-id': modelId,
  'aria-label': label,
  'aria-expanded': expanded,
  onClick,
}: Part) => {
  if (render && typeof render === 'object' && 'props' in (render as { props?: Record<string, unknown> })) {
    const el = render as { type: string; props: Record<string, unknown> }
    return createElement(
      el.type,
      { ...el.props, 'data-slot': slot, 'aria-label': label, 'aria-expanded': expanded, onClick },
      children,
    )
  }
  return createElement(
    'div',
    { 'data-slot': slot, 'data-flow-node': nodeId, 'data-model-id': modelId, 'aria-label': label, 'aria-expanded': expanded, onClick },
    children,
  )
}

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/gui', () => ({ Anchor: draw, Text: draw, View: draw, XStack: draw, YStack: draw }))
vi.mock('@hanzo/ui', () => ({
  Box: draw,
  Button: ({ children, 'data-slot': slot, onPress, disabled }: Part & { disabled?: boolean }) =>
    createElement('button', { type: 'button', 'data-slot': slot, onClick: onPress, disabled }, children),
  Input: ({ value, 'data-slot': slot, placeholder }: { value?: string; 'data-slot'?: string; placeholder?: string }) =>
    createElement('input', { 'data-slot': slot, defaultValue: value, placeholder }),
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (v: string) => void
    children?: ReactNode
  }) =>
    createElement(
      'div',
      {
        'data-slot': 'select',
        'data-value': value,
        onChange: (e: { target?: { value?: string } }) => onValueChange?.(e.target?.value ?? ''),
      },
      children,
    ),
  SelectTrigger: ({ children, 'aria-label': label, 'data-slot': slot }: Part) =>
    createElement('button', { type: 'button', 'aria-label': label, 'data-slot': slot }, children),
  SelectValue: ({ placeholder }: { placeholder?: string }) =>
    createElement('span', null, placeholder ?? ''),
  SelectContent: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
  SelectItem: ({ value, children }: { value: string; children?: ReactNode }) =>
    createElement('div', { 'data-value': value }, children),
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
const { FlowInspector } = await import('./FlowInspector')
const { FlowPlayground } = await import('./FlowPlayground')
const { FlowMcpDrawer } = await import('./FlowMcpDrawer')
const { writeLocalFlows, writeLocalRuns, writePlaygroundSessions } = await import('./api')
const { FLOW_TEMPLATES, instantiateTemplate } = await import('./templates')
const { flowNav } = await import('./nav')

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  document.body.innerHTML = ''
})

describe('FlowPane, FlowPlayground, FlowKnowledgePanel, FlowMcpDrawer, and flowNav', () => {
  test('renders full Builder with Hanzo Cloud status pill, MCP Server button, Component Palette, OLED Dot Grid, Minimap, Sticky Note, Inspector, and Playground trigger without external Open Flow Studio link', () => {
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
    expect(html).not.toContain('data-slot="flow-studio-link"')
    expect(html).not.toContain('Open Flow Studio')
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
    expect(templates).toContain('data-slot="flow-template-meta-pokedex-agent"')
    expect(templates).toContain('Chat / Playground')
    expect(templates).toContain('Pokédex Agent')
    expect(templates).toContain('Basic Prompting')
    expect(templates).toContain('Vector Store RAG')
    expect(templates).toContain('Financial Report Parser')
    expect(templates).toContain('CRM Speed-to-Lead Setter')
    expect(templates).not.toContain('enso-hybrid')
    expect(templates).not.toContain('Langflow')
  })

  test('renders deliverable output, failed-step retry, and human approval actions in /flow/runs', async () => {
    const { readLocalFlows, writeLocalRuns } = await import('./api')
    localStorage.clear()
    const flows = readLocalFlows('personal')
    const flow = flows[0]!
    writeLocalRuns(
      [
        {
          id: 'run_wait',
          flowId: flow.id,
          flowName: flow.name,
          trigger: 'manual',
          status: 'waiting_approval',
          startedAt: '2026-11-25T05:00:00Z',
          pendingApprovalNodeId: 'n2',
          summary: 'Waiting for approval at Human Approval',
          steps: [
            { nodeId: 'n1', nodeTitle: 'Input', kind: 'trigger', status: 'success', output: 'Send memo' },
            { nodeId: 'n2', nodeTitle: 'Human Approval', kind: 'control', status: 'waiting_approval', output: 'Approve?' },
          ],
        },
        {
          id: 'run_fail',
          flowId: flow.id,
          flowName: flow.name,
          trigger: 'manual',
          status: 'failed',
          startedAt: '2026-11-25T04:00:00Z',
          summary: 'Failed at Enso Agent',
          finalOutput: 'Partial draft deliverable',
          steps: [
            { nodeId: 'n1', nodeTitle: 'Input', kind: 'trigger', status: 'success', output: 'Hello' },
            { nodeId: 'n3', nodeTitle: 'Enso Agent', kind: 'agent', status: 'error', error: 'Gateway 503' },
          ],
        },
      ],
      'personal',
    )
    const html = renderToStaticMarkup(createElement(FlowPane, { path: '/flow/runs' }))
    expect(html).toContain('data-slot="run-approve-run_wait"')
    expect(html).toContain('data-slot="run-reject-run_wait"')
    expect(html).toContain('data-slot="run-retry-run_fail"')
    expect(html).toContain('data-slot="run-inspect-run_fail"')
    expect(html).toContain('data-slot="run-deliverable-run_fail"')
    expect(html).toContain('Partial draft deliverable')
    expect(html).toContain('data-slot="run-copy-run_fail"')
    expect(html).toContain('data-slot="run-download-run_fail"')
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

  test('renders timezone selector and live Next run preview in both Flow-level Schedule inspector and cron_schedule node inspector', () => {
    const flow = instantiateTemplate(FLOW_TEMPLATES.find((t) => t.id === 'scheduled-intelligence-brief')!)
    const flowLevelHtml = renderToStaticMarkup(
      createElement(FlowInspector, {
        collapsed: false,
        onToggleCollapse: () => {},
        flow,
        selectedNode: null,
        onUpdateFlow: () => {},
        onUpdateNode: () => {},
        onDeleteNode: () => {},
        onConnectNodes: () => {},
        onDeleteEdge: () => {},
      }),
    )
    expect(flowLevelHtml).toContain('data-slot="flow-schedule-timezone"')
    expect(flowLevelHtml).toContain('data-slot="flow-schedule-next-run"')
    expect(flowLevelHtml).toContain('America/New_York')
    expect(flowLevelHtml).toContain('Next run:')
    expect(flowLevelHtml).not.toContain('Next run: invalid schedule')

    const cronNode = flow.nodes.find((n) => n.subtype === 'cron_schedule' || n.kind === 'schedule')!
    const nodeHtml = renderToStaticMarkup(
      createElement(FlowInspector, {
        collapsed: false,
        onToggleCollapse: () => {},
        flow,
        selectedNode: cronNode,
        onUpdateFlow: () => {},
        onUpdateNode: () => {},
        onDeleteNode: () => {},
        onConnectNodes: () => {},
        onDeleteEdge: () => {},
      }),
    )
    expect(nodeHtml).toContain('data-slot="inspector-cron-timezone"')
    expect(nodeHtml).toContain('data-slot="inspector-cron-next-run"')
    expect(nodeHtml).toContain('Asia/Tokyo')
    expect(nodeHtml).toContain('Next run:')
    expect(nodeHtml).not.toContain('Next run: invalid schedule')

    const invalidHtml = renderToStaticMarkup(
      createElement(FlowInspector, {
        collapsed: false,
        onToggleCollapse: () => {},
        flow: { ...flow, schedule: { enabled: true, cron: '60 * * * *', timezone: 'UTC' } },
        selectedNode: null,
        onUpdateFlow: () => {},
        onUpdateNode: () => {},
        onDeleteNode: () => {},
        onConnectNodes: () => {},
        onDeleteEdge: () => {},
      }),
    )
    expect(invalidHtml).toContain('Next run: invalid schedule')
  })

  test('renders expandable Input and Output per step in Runs view, live Test run tray, and FlowPlayground', async () => {
    const flow = instantiateTemplate(FLOW_TEMPLATES.find((t) => t.id === 'basic-prompting')!)
    writeLocalFlows([flow])
    writeLocalRuns([
      {
        id: 'run_test_io',
        flowId: flow.id,
        flowName: flow.name,
        trigger: 'manual',
        status: 'completed',
        startedAt: '2026-03-06T12:00:00Z',
        durationMs: 42,
        summary: 'Completed 2/2 steps',
        steps: [
          {
            nodeId: 'n1',
            nodeTitle: 'Chat Input',
            kind: 'trigger',
            subtype: 'chat_input',
            status: 'success',
            input: 'Explain Hanzo Flow',
            output: 'Explain Hanzo Flow',
            durationMs: 2,
          },
          {
            nodeId: 'n3',
            nodeTitle: 'Enso Model',
            kind: 'agent',
            subtype: 'language_model',
            status: 'success',
            input: 'Prompt: Explain Hanzo Flow',
            output: 'Hanzo Flow orchestrates Enso pipelines.',
            durationMs: 40,
          },
        ],
      },
    ])

    // 1) Runs view expandable step Input & Output
    const runsHost = document.createElement('div')
    document.body.appendChild(runsHost)
    const runsRoot = createRoot(runsHost)
    await act(async () => {
      runsRoot.render(createElement(FlowPane, { path: '/flow/runs' }))
    })
    const runsToggle = runsHost.querySelector('[data-slot="runs-step-toggle-run_test_io-n3"]') as HTMLButtonElement
    expect(runsToggle).toBeTruthy()
    expect(runsHost.textContent).not.toContain('Prompt: Explain Hanzo Flow')
    await act(async () => {
      runsToggle.click()
    })
    expect(runsHost.querySelector('[data-slot="step-input-block"]')?.textContent).toContain('Prompt: Explain Hanzo Flow')
    expect(runsHost.querySelector('[data-slot="step-output-block"]')?.textContent).toContain('Hanzo Flow orchestrates Enso pipelines.')
    await act(async () => {
      runsRoot.unmount()
    })

    // 2) Live Test run tray expandable step Input & Output
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'Live Enso reply' } }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    const liveHost = document.createElement('div')
    document.body.appendChild(liveHost)
    const liveRoot = createRoot(liveHost)
    await act(async () => {
      liveRoot.render(createElement(FlowPane, { path: '/flow' }))
    })
    const testRunBtn = liveHost.querySelector('[data-slot="flow-test-run"]') as HTMLButtonElement
    await act(async () => {
      testRunBtn.click()
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(liveHost.querySelector('[data-slot="flow-run-drawer"]')).toBeTruthy()
    const liveStepToggle = liveHost.querySelector('[data-slot="run-step-toggle-n3"]') as HTMLButtonElement
    expect(liveStepToggle).toBeTruthy()
    await act(async () => {
      liveStepToggle.click()
    })
    const liveDrawerText = liveHost.querySelector('[data-slot="flow-run-drawer"]')?.textContent ?? ''
    expect(liveDrawerText).toContain('Input')
    expect(liveDrawerText).toContain('Output')
    expect(liveDrawerText).toContain('Live Enso reply')
    await act(async () => {
      liveRoot.unmount()
    })

    // 3) FlowPlayground step pill expandable Input & Output
    writePlaygroundSessions(
      flow.id,
      [
        {
          id: 'sess_io',
          name: 'IO Check',
          createdAt: '2026-03-06T12:00:00Z',
          updatedAt: '2026-03-06T12:00:00Z',
          messages: [
            {
              id: 'msg_u1',
              role: 'user',
              content: 'Hello Enso',
              createdAt: '2026-03-06T12:00:00Z',
            },
            {
              id: 'msg_a1',
              role: 'assistant',
              content: 'Hello back!',
              createdAt: '2026-03-06T12:00:01Z',
              steps: [
                {
                  nodeId: 'n3',
                  nodeTitle: 'Enso Model',
                  kind: 'agent',
                  status: 'success',
                  input: 'Resolved playground prompt: Hello Enso',
                  output: 'Hello back!',
                  durationMs: 18,
                },
              ],
            },
          ],
        },
      ],
      'hanzo',
    )
    const pgHost = document.createElement('div')
    document.body.appendChild(pgHost)
    const pgRoot = createRoot(pgHost)
    await act(async () => {
      pgRoot.render(
        createElement(FlowPlayground, {
          flow,
          orgId: 'hanzo',
          onClose: () => {},
          onLiveStepsChange: () => {},
          onRunRecorded: () => {},
        }),
      )
    })
    const stepPill = pgHost.querySelector('[data-slot="playground-step-pill-n3"]') as HTMLButtonElement
    expect(stepPill).toBeTruthy()
    await act(async () => {
      stepPill.click()
    })
    const detail = pgHost.querySelector('[data-slot="playground-step-detail"]')
    expect(detail?.querySelector('[data-slot="step-input-block"]')?.textContent).toContain(
      'Resolved playground prompt: Hello Enso',
    )
    expect(detail?.querySelector('[data-slot="step-output-block"]')?.textContent).toContain('Hello back!')
    await act(async () => {
      pgRoot.unmount()
    })
  })
})
