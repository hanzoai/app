// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { executeFlow, persistFlow, readLocalFlows, syncLoadFlows } from './api'
import { FLOW_TEMPLATES, instantiateTemplate } from './templates'
import { describeCron, FLOW_MODELS, flowPath, parseFlowRoute, topologicalSort } from './types'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Flow schema, routing, cron, and model catalog', () => {
  test('only exposes canonical live Enso and Zen models (never enso-hybrid)', () => {
    const ids = FLOW_MODELS.map((m) => m.id)
    expect(ids).toEqual([
      'enso',
      'enso-auto',
      'enso-pro',
      'enso-max',
      'enso-flash',
      'enso-ultra',
      'zen6',
      'zen6-coder',
      'zen6-flash',
      'zen6-max',
    ])
    expect(ids).not.toContain('enso-hybrid')
    for (const tpl of FLOW_TEMPLATES) {
      for (const node of tpl.nodes) {
        if (node.kind === 'agent' && node.config.model) {
          expect(ids).toContain(node.config.model)
          expect(node.config.model).not.toContain('hybrid')
        }
      }
    }
  })

  test('parses /flow subroutes cleanly', () => {
    expect(parseFlowRoute('/flow')).toEqual({ view: 'canvas', flowId: null, createNew: false })
    expect(parseFlowRoute('/flow/new')).toEqual({ view: 'canvas', flowId: null, createNew: true })
    expect(parseFlowRoute('/flow/scheduled')).toEqual({ view: 'scheduled', flowId: null, createNew: false })
    expect(parseFlowRoute('/flow/runs')).toEqual({ view: 'runs', flowId: null, createNew: false })
    expect(parseFlowRoute('/flow/templates')).toEqual({ view: 'templates', flowId: null, createNew: false })
    expect(parseFlowRoute('/flow/flow_abc123')).toEqual({ view: 'canvas', flowId: 'flow_abc123', createNew: false })
    expect(flowPath('')).toBe('/flow')
    expect(flowPath('scheduled')).toBe('/flow/scheduled')
    expect(flowPath('runs')).toBe('/flow/runs')
  })

  test('validates and describes cron expressions', () => {
    expect(describeCron('*/15 * * * *')).toEqual({ valid: true, human: 'Every 15 minutes' })
    expect(describeCron('0 8 * * 1-5')).toEqual({ valid: true, human: 'Weekdays at 08:00' })
    expect(describeCron('0 9 * * *')).toEqual({ valid: true, human: 'Daily at 09:00' })
    expect(describeCron('not a cron').valid).toBe(false)
  })

  test('topologically orders workflow graphs from trigger to action', () => {
    const flow = instantiateTemplate(FLOW_TEMPLATES[0]!)
    const reversed = [...flow.nodes].reverse()
    const ordered = topologicalSort(reversed, flow.edges)
    expect(ordered.map((n) => n.id)).toEqual(['n1', 'n2', 'n3', 'n4'])
  })
})

describe('Flow persistence and live Enso execution', () => {
  test('executes Enso AI Agent nodes against /v1/chat/completions and passes output downstream', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain('/v1/chat/completions')
      const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string; messages?: Array<{ content: string }> }
      expect(body.model).toBe('enso')
      expect(body.messages?.[1]?.content).toContain('onboarding blockers')
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '1. Automate IAM org setup\n2. Streamline onboarding flow' } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const flow = instantiateTemplate(FLOW_TEMPLATES[0]!)
    const seen: number[] = []
    const run = await executeFlow(flow, {
      onStepUpdate: (steps) => seen.push(steps.filter((s) => s.status === 'success').length),
    })

    expect(run.status).toBe('completed')
    expect(run.steps).toHaveLength(4)
    expect(run.steps.every((s) => s.status === 'success')).toBe(true)
    expect(run.steps[1]?.output).toContain('Automate IAM org setup')
    expect(run.steps[3]?.output).toContain('[Test preview]')
    expect(seen.at(-1)).toBe(4)
  })

  test('stops downstream steps when condition does not match', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'NORMAL priority routine ping' } }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    const webhookFlow = instantiateTemplate(FLOW_TEMPLATES[2]!)
    const run = await executeFlow(webhookFlow)
    expect(run.status).toBe('completed')
    expect(run.steps[2]?.status).toBe('success')
    expect(run.steps[3]?.status).toBe('skipped')
  })

  test('falls back cleanly to org-scoped localStorage when /v1/workflow is unavailable', async () => {
    const flows = readLocalFlows('acme')
    expect(flows.length).toBeGreaterThanOrEqual(2)
    const saved = await persistFlow(flows[0]!, flows, 'acme')
    expect(saved).toBe('local')
    const loaded = await syncLoadFlows('acme')
    expect(loaded.source).toBe('local')
    expect(loaded.flows.map((f) => f.id)).toEqual(flows.map((f) => f.id))
  })
})
