// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  executeFlow,
  extractQuerySlug,
  persistFlow,
  readLocalFlows,
  readPlaygroundSessions,
  syncLoadFlows,
  writePlaygroundSessions,
} from './api'
import { FLOW_TEMPLATE_CATEGORIES, FLOW_TEMPLATES, instantiateTemplate } from './templates'
import {
  describeCron,
  EMBEDDING_MODELS,
  FLOW_COMPONENT_CATALOG,
  FLOW_MODELS,
  FLOW_NODE_CATEGORIES,
  flowPath,
  isModelExecutionNode,
  isStickyNoteNode,
  makeNodeFromComponent,
  parseFlowRoute,
  topologicalSort,
} from './types'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Flow Studio schema, catalog, templates, and strict invariants', () => {
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
    const embedIds = EMBEDDING_MODELS.map((m) => m.id)
    expect(embedIds).toEqual(['zen-embedding-3', 'zen-embedding'])

    const allowedModels = new Set([...ids, ...embedIds])
    for (const tpl of FLOW_TEMPLATES) {
      for (const node of tpl.nodes) {
        if (node.config.model) {
          expect(allowedModels.has(node.config.model)).toBe(true)
          expect(node.config.model).not.toContain('hybrid')
        }
      }
    }
  })

  test('ships all 9 component categories and 42+ searchable components', () => {
    expect(FLOW_NODE_CATEGORIES).toEqual([
      'Input & Output',
      'Data Sources',
      'Models & Agents',
      'LLM Operations',
      'Files & Knowledge',
      'Processing',
      'Flow Control',
      'Utilities',
      'Hanzo',
    ])
    expect(FLOW_COMPONENT_CATALOG.length).toBeGreaterThanOrEqual(42)
    for (const category of FLOW_NODE_CATEGORIES) {
      expect(FLOW_COMPONENT_CATALOG.some((c) => c.category === category)).toBe(true)
    }
    const created = makeNodeFromComponent('api_request', 0)
    expect(created.subtype).toBe('api_request')
    expect(created.config.method).toBe('GET')
  })

  test('ships 26 runnable starter templates across all 5 categories with zero Langflow, OpenAI key, enso-hybrid, or /api/ strings', () => {
    expect(FLOW_TEMPLATES.length).toBeGreaterThanOrEqual(26)
    expect(FLOW_TEMPLATE_CATEGORIES).toEqual([
      'Agents',
      'RAG & Knowledge',
      'Marketing & Social',
      'Ops & Finance',
      'Scheduled & CRM',
    ])
    const serialized = JSON.stringify(FLOW_TEMPLATES).toLowerCase()
    expect(serialized).not.toContain('enso-hybrid')
    expect(serialized).not.toContain('langflow')
    expect(serialized).not.toContain('openai api key')
    expect(serialized).not.toContain('api.hanzo.ai/api/')
    expect(FLOW_TEMPLATES[0]?.id).toBe('pokedex-agent')
    expect(FLOW_TEMPLATES.some((t) => t.id === 'basic-prompting')).toBe(true)
    expect(FLOW_TEMPLATES.some((t) => t.id === 'vector-store-rag')).toBe(true)
    expect(FLOW_TEMPLATES.some((t) => t.id === 'crm-speed-to-lead-setter')).toBe(true)
    expect(FLOW_TEMPLATES.some((t) => t.id === 'scheduled-intelligence-brief')).toBe(true)
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

  test('extracts clean PokéAPI query slugs from natural-language prompts', () => {
    expect(extractQuerySlug('Tell me about Pikachu — types, base stats, and abilities.')).toBe('pikachu')
    expect(extractQuerySlug('Look up Charizard please')).toBe('charizard')
    expect(extractQuerySlug('gengar')).toBe('gengar')
  })

  test('topologically orders runnable workflow nodes cleanly', () => {
    const basic = instantiateTemplate(FLOW_TEMPLATES.find((t) => t.id === 'basic-prompting')!)
    const runnable = basic.nodes.filter((n) => !isStickyNoteNode(n))
    const reversed = [...runnable].reverse()
    const ordered = topologicalSort(reversed, basic.edges)
    expect(ordered.map((n) => n.id)).toEqual(['n1', 'n2', 'n3', 'n4'])
    expect(isModelExecutionNode(runnable[2]!)).toBe(true)
  })
})

describe('Flow execution, SSE streaming, live API Request tools, branching, and persistence', () => {
  test('executes Pokédex Agent live: fetches PokéAPI, injects tool JSON into Enso Agent, and streams SSE tokens', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('pokeapi.co/api/v2/pokemon/pikachu')) {
        return new Response(
          JSON.stringify({
            id: 25,
            name: 'pikachu',
            height: 4,
            weight: 60,
            types: [{ type: { name: 'electric' } }],
            abilities: [{ ability: { name: 'static' }, is_hidden: false }],
            stats: [{ stat: { name: 'speed' }, base_stat: 90 }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      expect(url).toContain('/v1/chat/completions')
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        model?: string
        stream?: boolean
        messages?: Array<{ content: string }>
      }
      expect(body.model).toBe('enso-pro')
      expect(body.stream).toBe(true)
      expect(body.messages?.at(-1)?.content).toContain('"name": "pikachu"')
      expect(body.messages?.at(-1)?.content).toContain('"speed": 90')

      const encoder = new TextEncoder()
      const sse = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Pikachu (#25) "}}]}\n\n'))
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"is an Electric-type Pokémon."}}]}\n\n'))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
      return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const pokedex = instantiateTemplate(FLOW_TEMPLATES[0]!)
    const chunks: string[] = []
    const run = await executeFlow(pokedex, {
      trigger: 'playground',
      sampleInput: 'Tell me about Pikachu',
      modelOverride: 'enso-pro',
      onToken: (delta) => chunks.push(delta),
    })

    expect(run.status).toBe('completed')
    // Sticky note README is skipped cleanly from executable steps
    expect(run.steps).toHaveLength(4)
    expect(run.steps.every((s) => s.status === 'success')).toBe(true)
    expect(chunks).toEqual(['Pikachu (#25) ', 'is an Electric-type Pokémon.'])
    expect(run.finalOutput).toBe('Pikachu (#25) is an Electric-type Pokémon.')
  })

  test('routes True and False condition branches cleanly on CRM Speed-to-Lead Setter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'NURTURE: early exploration stage' } }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    const crmFlow = instantiateTemplate(FLOW_TEMPLATES.find((t) => t.id === 'crm-speed-to-lead-setter')!)
    const run = await executeFlow(crmFlow)
    expect(run.status).toBe('completed')
    const byId = new Map(run.steps.map((s) => [s.nodeId, s]))
    expect(byId.get('n3')?.status).toBe('success')
    // True branch skipped; False branch (Nurture channel) executed
    expect(byId.get('n4')?.status).toBe('skipped')
    expect(byId.get('n6')?.status).toBe('success')
  })

  test('surfaces clear actionable error when Enso gateway rejects with HTTP 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('unauthorized', { status: 401 })),
    )

    const basic = instantiateTemplate(FLOW_TEMPLATES.find((t) => t.id === 'basic-prompting')!)
    const run = await executeFlow(basic, { sampleInput: 'hello' })
    expect(run.status).toBe('failed')
    const failedStep = run.steps.find((s) => s.status === 'error')
    expect(failedStep?.error).toContain('Sign in to run Enso models (HTTP 401)')
  })

  test('persists flows and Playground sessions per org in localStorage', async () => {
    const flows = readLocalFlows('acme')
    expect(flows.length).toBeGreaterThanOrEqual(3)
    expect(flows[0]?.name).toBe('Pokédex Agent')
    const saved = await persistFlow(flows[0]!, flows, 'acme')
    expect(saved).toBe('local')
    const loaded = await syncLoadFlows('acme')
    expect(loaded.source).toBe('local')
    expect(loaded.flows.map((f) => f.id)).toEqual(flows.map((f) => f.id))

    const sessions = readPlaygroundSessions(flows[0]!.id, 'acme')
    expect(sessions[0]?.name).toBe('Default Session')
    writePlaygroundSessions(flows[0]!.id, [{ ...sessions[0]!, name: 'Pikachu Research' }], 'acme')
    expect(readPlaygroundSessions(flows[0]!.id, 'acme')[0]?.name).toBe('Pikachu Research')
  })
})
