// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  buildFlowMcpConfig,
  clearSessionVectors,
  cosineSimilarity,
  createEmbeddings,
  executeFlow,
  extractQuerySlug,
  getKnowledgeGraph,
  importKnowledgeDocument,
  listKnowledgeFiles,
  persistFlow,
  readLocalFlows,
  readPlaygroundSessions,
  syncLoadFlows,
  writePlaygroundSessions,
} from './api'
import { describeTemplateMeta, FLOW_TEMPLATE_CATEGORIES, FLOW_TEMPLATES, instantiateTemplate } from './templates'
import {
  describeCron,
  EMBEDDING_MODELS,
  FLOW_COMPONENT_CATALOG,
  FLOW_MODELS,
  FLOW_NODE_CATEGORIES,
  flowMcpSlug,
  flowPath,
  isModelExecutionNode,
  isStickyNoteNode,
  makeNodeFromComponent,
  normalizeEmbeddingModel,
  parseFlowRoute,
  topologicalSort,
  type FlowDefinition,
} from './types'

beforeEach(() => {
  localStorage.clear()
  clearSessionVectors()
})

afterEach(() => {
  vi.unstubAllGlobals()
  clearSessionVectors()
})

describe('Flow Studio schema, catalog, templates, and strict invariants', () => {
  test('only exposes canonical live Enso and Zen models (never enso-hybrid or OpenAI embedding models)', () => {
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
    expect(normalizeEmbeddingModel(undefined)).toBe('zen-embedding-3')
    expect(normalizeEmbeddingModel('text-embedding-3-small')).toBe('zen-embedding-3')
    expect(normalizeEmbeddingModel('zen-embedding')).toBe('zen-embedding')

    const allowedModels = new Set<string>([...ids, ...embedIds])
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

  test('parses /flow subroutes including /flow/knowledge cleanly', () => {
    expect(parseFlowRoute('/flow')).toEqual({ view: 'canvas', flowId: null, createNew: false })
    expect(parseFlowRoute('/flow/new')).toEqual({ view: 'canvas', flowId: null, createNew: true })
    expect(parseFlowRoute('/flow/knowledge')).toEqual({ view: 'knowledge', flowId: null, createNew: false })
    expect(parseFlowRoute('/flow/kb')).toEqual({ view: 'knowledge', flowId: null, createNew: false })
    expect(parseFlowRoute('/flow/scheduled')).toEqual({ view: 'scheduled', flowId: null, createNew: false })
    expect(parseFlowRoute('/flow/runs')).toEqual({ view: 'runs', flowId: null, createNew: false })
    expect(parseFlowRoute('/flow/templates')).toEqual({ view: 'templates', flowId: null, createNew: false })
    expect(parseFlowRoute('/flow/flow_abc123')).toEqual({ view: 'canvas', flowId: 'flow_abc123', createNew: false })
    expect(flowPath('')).toBe('/flow')
    expect(flowPath('knowledge')).toBe('/flow/knowledge')
    expect(flowPath('scheduled')).toBe('/flow/scheduled')
    expect(flowPath('runs')).toBe('/flow/runs')
  })

  test('builds canonical Streamable HTTP MCP config with hanzo-<slug> naming and Hanzo IAM Bearer auth', () => {
    const pokedex = instantiateTemplate(FLOW_TEMPLATES[0]!)
    expect(flowMcpSlug('Pokédex Agent')).toBe('pokedex-agent')
    const cfg = buildFlowMcpConfig(pokedex, 'hanzo')
    expect(cfg.serverName).toBe('hanzo-pokedex-agent')
    expect(cfg.transport).toBe('http')
    expect(cfg.endpointUrl).toContain(`/v1/flow/workflows/${encodeURIComponent(pokedex.id)}/mcp`)
    expect(cfg.studioMcpUrl).toBe('https://flow.hanzo.ai/v1/mcp/pokedex-agent')
    expect(cfg.clientJson).toContain('"hanzo-pokedex-agent"')
    expect(cfg.clientJson).toContain('"type": "http"')
    expect(cfg.clientJson).toContain('Bearer <hanzo-iam-token>')
    expect(cfg.clientJson).not.toContain('lf-')
    expect(cfg.clientJson).not.toContain('HANZO_API_KEY')
    expect(cfg.clientJson).not.toContain('/api/')
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

describe('Hanzo Cloud live Embeddings, Knowledge Base, and Vector RAG execution', () => {
  test('calls POST /v1/embeddings live with zen-embedding-3 and computes exact cosine similarity', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain('/v1/embeddings')
      const body = JSON.parse(String(init?.body ?? '{}')) as { model: string; input: string }
      expect(body.model).toBe('zen-embedding-3')
      expect(body.input).toBe('Hanzo IAM tokens')
      return new Response(
        JSON.stringify({
          model: 'zen-embedding-3',
          data: [{ index: 0, embedding: [0.6, 0.8, 0] }],
          usage: { prompt_tokens: 4, total_tokens: 4 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await createEmbeddings('Hanzo IAM tokens', 'text-embedding-3-small')
    expect(res.model).toBe('zen-embedding-3')
    expect(res.dimensions).toBe(3)
    expect(res.totalTokens).toBe(4)
    expect(res.vectors[0]).toEqual([0.6, 0.8, 0])
    expect(cosineSimilarity([0.6, 0.8, 0], [0.6, 0.8, 0])).toBeCloseTo(1.0, 5)
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0, 5)
  })

  test('executes Vector Store RAG live: /v1/embeddings -> /v1/knowledge/search + files/retrieve -> /v1/chat/completions', async () => {
    const calls: string[] = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url)
      if (url.includes('/v1/embeddings')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { model: string }
        expect(body.model).toBe('zen-embedding-3')
        return new Response(
          JSON.stringify({
            model: 'zen-embedding-3',
            data: [{ index: 0, embedding: [0.12, 0.88, -0.31, 0.45] }],
            usage: { prompt_tokens: 9, total_tokens: 9 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (url.includes('/v1/knowledge/search')) {
        return new Response(
          JSON.stringify({
            hits: [
              {
                doctype: 'kb.page',
                name: 'iam-tokens',
                title: 'Hanzo IAM Org-Scoped Bearer Tokens',
                score: 0.912,
                project: 'hanzo-docs',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (url.includes('/v1/knowledge/files/retrieve')) {
        return new Response(
          JSON.stringify({
            picked: 'model',
            passages: [
              {
                cite: 'iam-spec.md › Token Issuance › ¶1',
                text: 'Hanzo IAM issues org-scoped OIDC JWT bearer tokens validated at the gateway.',
                score: 0.945,
                via: 'search',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (url.includes('/v1/chat/completions')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { messages: Array<{ content: string }> }
        const userContent = body.messages.at(-1)?.content ?? ''
        expect(userContent).toContain('iam-spec.md')
        expect(userContent).toContain('Hanzo IAM Org-Scoped Bearer Tokens')
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Hanzo IAM issues org-scoped OIDC JWT bearer tokens.' } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const ragFlow = instantiateTemplate(FLOW_TEMPLATES.find((t) => t.id === 'vector-store-rag')!)
    const run = await executeFlow(ragFlow, {
      sampleInput: 'How does Hanzo IAM issue org-scoped bearer tokens?',
    })

    expect(run.status).toBe('completed')
    expect(run.steps.every((s) => s.status === 'success')).toBe(true)
    expect(run.steps[1]?.output).toContain('zen-embedding-3')
    expect(run.steps[1]?.output).toContain('4d')
    expect(run.steps[2]?.output).toContain('Retrieved 2 grounded match(es)')
    expect(run.finalOutput).toBe('Hanzo IAM issues org-scoped OIDC JWT bearer tokens.')
    expect(calls.some((c) => c.includes('/v1/embeddings'))).toBe(true)
    expect(calls.some((c) => c.includes('/v1/knowledge/search'))).toBe(true)
    expect(calls.some((c) => c.includes('/v1/knowledge/files/retrieve'))).toBe(true)
  })

  test('executes Knowledge Ingestion live (URL crawl -> split -> zen-embedding-3 -> /v1/knowledge/import with auto kb module install)', async () => {
    let importAttempts = 0
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/v1/crawl')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              url: 'https://hanzo.ai/docs/flow',
              title: 'Hanzo Flow Docs',
              markdown: 'Hanzo Flow executes native Enso models and zen-embedding-3 vectors via Hanzo IAM.',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (url.includes('/v1/embeddings')) {
        return new Response(
          JSON.stringify({
            model: 'zen-embedding-3',
            data: [{ index: 0, embedding: [0.5, 0.5, 0.5, 0.5] }],
            usage: { prompt_tokens: 14, total_tokens: 14 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (url.includes('/v1/knowledge/import')) {
        importAttempts += 1
        expect(url).toContain('format=roam')
        expect(url).toContain('project=product-docs')
        if (importAttempts === 1) {
          return new Response('install the kb module first (POST /v1/framework/modules/kb/install)', { status: 400 })
        }
        const parsed = JSON.parse(String(init?.body ?? '[]')) as Array<{ title: string; children: Array<{ string: string }> }>
        expect(parsed[0]?.children.length).toBeGreaterThan(0)
        return new Response(
          JSON.stringify({ format: 'roam', imported: 1, pages: ['hanzo-flow-docs'] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (url.includes('/v1/framework/modules/kb/install')) {
        return new Response(JSON.stringify({ installed: ['kb.page'] }), { status: 200 })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const ingestFlow = instantiateTemplate(FLOW_TEMPLATES.find((t) => t.id === 'knowledge-ingestion')!)
    const run = await executeFlow(ingestFlow)
    expect(run.status).toBe('completed')
    expect(importAttempts).toBe(2)
    expect(run.finalOutput).toContain('Indexed 1 page(s) into Hanzo Knowledge (product-docs)')
    expect(run.finalOutput).toContain('hanzo-flow-docs')
  })

  test('supports alias subtypes (embedding, knowledge_ingest, knowledge_search, retriever) and lists files/graph live', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/v1/knowledge/files') && !url.includes('retrieve')) {
        return new Response(
          JSON.stringify({
            files: [{ id: 'f_1', name: 'architecture.md', bucket: 'hanzo', key: 'docs/architecture.md', status: 'ready', passages: 12, embedded: 12 }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (url.includes('/v1/knowledge/graph')) {
        return new Response(
          JSON.stringify({
            nodes: [{ id: 'kb.page:flow', name: 'flow', title: 'Flow Studio', type: 'kb.page' }],
            edges: [],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (url.includes('/v1/embeddings')) {
        return new Response(
          JSON.stringify({
            model: 'zen-embedding-3',
            data: [{ index: 0, embedding: [1, 0, 0] }],
            usage: { prompt_tokens: 3, total_tokens: 3 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }
      if (url.includes('/v1/knowledge/import')) {
        return new Response(JSON.stringify({ format: 'roam', imported: 1, pages: ['doc-1'] }), { status: 200 })
      }
      if (url.includes('/v1/knowledge/search')) {
        return new Response(JSON.stringify({ hits: [{ doctype: 'kb.page', name: 'doc-1', title: 'Doc 1', score: 0.88 }] }), { status: 200 })
      }
      if (url.includes('/v1/knowledge/files/retrieve')) {
        return new Response(JSON.stringify({ passages: [] }), { status: 200 })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const files = await listKnowledgeFiles()
    expect(files).toHaveLength(1)
    expect(files[0]?.name).toBe('architecture.md')

    const graph = await getKnowledgeGraph()
    expect(graph.nodes).toHaveLength(1)

    const directImport = await importKnowledgeDocument({ title: 'Test Note', content: 'Hello Hanzo Knowledge' })
    expect(directImport.imported).toBe(1)

    const aliasFlow: FlowDefinition = {
      id: 'flow_alias_test',
      name: 'Alias RAG Flow',
      description: 'Tests shorthand node subtypes',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: 'n1', kind: 'trigger', subtype: 'text_input', title: 'Input', position: { x: 0, y: 0 }, config: { sampleInput: 'Hanzo Cloud' } },
        { id: 'n2', kind: 'llm', subtype: 'embedding', title: 'Embed', position: { x: 200, y: 0 }, config: { model: 'zen-embedding-3' } },
        { id: 'n3', kind: 'knowledge', subtype: 'knowledge_ingest', title: 'Ingest', position: { x: 400, y: 0 }, config: { collection: 'kb' } },
        { id: 'n4', kind: 'knowledge', subtype: 'retriever', title: 'Retrieve', position: { x: 600, y: 0 }, config: { collection: 'kb', topK: 3 } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4' },
      ],
    }

    const run = await executeFlow(aliasFlow)
    expect(run.status).toBe('completed')
    expect(run.steps.every((s) => s.status === 'success')).toBe(true)
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

  test('persists flows and Playground sessions per org in localStorage and syncs via live /v1/flow/workflows when authenticated', async () => {
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

    // When a Hanzo IAM bearer is present, syncLoadFlows and persistFlow hit /v1/flow/workflows (never /v1/workflow).
    localStorage.setItem('hanzo_iam_access_token', 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sig')
    const calls: Array<{ method: string; url: string }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET'
        calls.push({ method, url })
        if (method === 'GET' && url.includes('/v1/flow/workflows')) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  id: '11111111-1111-4111-8111-111111111111',
                  name: 'Remote Enso Flow',
                  description: 'Synced from flow.hanzo.ai',
                  updated_at: '2026-11-25T00:00:00Z',
                  data: {
                    hanzoStudio: true,
                    localId: 'remote-studio-1',
                    status: 'active',
                    nodes: [makeNodeFromComponent('chat_input', 0)],
                    edges: [],
                  },
                },
              ],
              total: 1,
              page: 1,
              size: 100,
              pages: 1,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        if (method === 'POST' && url.endsWith('/v1/flow/workflows')) {
          return new Response(
            JSON.stringify({ id: '22222222-2222-4222-8222-222222222222', name: flows[0]!.name }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        if (method === 'PATCH' && url.includes('/v1/flow/workflows/22222222-2222-4222-8222-222222222222')) {
          return new Response(
            JSON.stringify({ id: '22222222-2222-4222-8222-222222222222', name: flows[0]!.name }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        return new Response('not found', { status: 404 })
      }),
    )

    const synced = await syncLoadFlows('acme')
    expect(synced.source).toBe('remote')
    expect(synced.flows.some((f) => f.id === 'remote-studio-1' && f.remoteId === '11111111-1111-4111-8111-111111111111')).toBe(true)

    const firstPersist = await persistFlow(flows[0]!, flows, 'acme')
    expect(firstPersist).toBe('synced')
    const afterFirst = readLocalFlows('acme')
    const savedFlow = afterFirst.find((f) => f.id === flows[0]!.id)!
    expect(savedFlow.remoteId).toBe('22222222-2222-4222-8222-222222222222')

    const secondPersist = await persistFlow(savedFlow, afterFirst, 'acme')
    expect(secondPersist).toBe('synced')
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/v1/flow/workflows'))).toBe(true)
    expect(calls.some((c) => c.method === 'PATCH' && c.url.includes('/v1/flow/workflows/22222222-2222-4222-8222-222222222222'))).toBe(true)
    expect(calls.every((c) => !c.url.includes('/v1/workflow'))).toBe(true)
  })

  test('persistFlow notifies caller of newly assigned remoteId to prevent duplicate POSTs', async () => {
    localStorage.setItem('hanzo_iam_access_token', 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sig')
    const assigned: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ id: '33333333-3333-4333-8333-333333333333', name: 'New Flow' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )
    const flows = readLocalFlows('acme')
    const res = await persistFlow(flows[0]!, flows, 'acme', (rid) => assigned.push(rid))
    expect(res).toBe('synced')
    expect(assigned).toEqual(['33333333-3333-4333-8333-333333333333'])
  })

  test('persistFlow serializes concurrent first-time saves and preserves mid-flight local edits', async () => {
    localStorage.setItem('hanzo_iam_access_token', 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sig')
    const methods: string[] = []
    let resolvePost!: (res: Response) => void
    const postDeferred = new Promise<Response>((r) => {
      resolvePost = r
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET'
        methods.push(method)
        if (method === 'POST') return postDeferred
        return new Response(
          JSON.stringify({ id: '44444444-4444-4444-8444-444444444444', name: 'Renamed Flow' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }),
    )

    const flows = readLocalFlows('acme')
    const first = persistFlow(flows[0]!, flows, 'acme')
    // Simulate a concurrent edit + save while POST is still in flight.
    const edited = flows.map((f, idx) => (idx === 0 ? { ...f, name: 'Renamed Flow' } : f))
    const second = persistFlow(edited[0]!, edited, 'acme')
    resolvePost(
      new Response(
        JSON.stringify({ id: '44444444-4444-4444-8444-444444444444', name: flows[0]!.name }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    expect(await first).toBe('synced')
    expect(await second).toBe('synced')
    expect(methods).toEqual(['POST', 'PATCH'])
    const stored = readLocalFlows('acme').find((f) => f.id === flows[0]!.id)!
    expect(stored.name).toBe('Renamed Flow')
    expect(stored.remoteId).toBe('44444444-4444-4444-8444-444444444444')
  })

  test('paused flows skip scheduled and webhook triggers, allow manual tests, and allow reviewer resumes', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'Manual ok' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const flow = { ...instantiateTemplate(FLOW_TEMPLATES.find((t) => t.id === 'basic-prompting')!), status: 'paused' as const }

    const schedRun = await executeFlow(flow, { trigger: 'schedule' })
    expect(schedRun.status).toBe('completed')
    expect(schedRun.summary).toContain('paused')
    expect(schedRun.steps.every((s) => s.status === 'skipped')).toBe(true)

    const hookRun = await executeFlow(flow, { trigger: 'webhook' })
    expect(hookRun.summary).toContain('paused')
    expect(fetchMock).not.toHaveBeenCalled()

    const manualRun = await executeFlow(flow, { trigger: 'manual', sampleInput: 'Manual check' })
    expect(manualRun.status).toBe('completed')
    expect(manualRun.finalOutput).toBe('Manual ok')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('resumeFrom restores condition branches, variables, and raw payloads across upstream steps', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/v1/crawl')) {
          return new Response(
            JSON.stringify({
              success: true,
              data: { url: 'https://hanzo.ai/docs', title: 'Docs', markdown: 'REAL_MARKDOWN_BODY' },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        calls += 1
        if (calls === 1) return new Response('temporary 503', { status: 503 })
        const body = JSON.parse(String(init?.body ?? '{}')) as { messages: Array<{ content: string }> }
        const prompt = body.messages.at(-1)?.content ?? ''
        expect(prompt).toContain('REAL_MARKDOWN_BODY')
        expect(prompt).not.toContain('Fetched https://')
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'Synthesized from real markdown' } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }),
    )

    const crawlFlow: FlowDefinition = {
      id: 'flow_resume_payload',
      name: 'Resume Payload Flow',
      description: 'Tests raw payload preservation on resumeFrom',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: 'n1', kind: 'data', subtype: 'url_fetch', title: 'Fetch', position: { x: 0, y: 0 }, config: { url: 'https://hanzo.ai/docs' } },
        { id: 'n2', kind: 'utility', subtype: 'variable_store', title: 'Store', position: { x: 200, y: 0 }, config: { variableKey: 'doc', variableValue: '{{input}}' } },
        { id: 'n3', kind: 'condition', subtype: 'if_condition', title: 'Check', position: { x: 400, y: 0 }, config: { expression: 'contains:REAL_MARKDOWN_BODY' } },
        { id: 'n4', kind: 'agent', subtype: 'language_model', title: 'Agent', position: { x: 600, y: 0 }, config: { model: 'enso', prompt: 'Doc: {{doc}}' } },
        { id: 'n5', kind: 'action', subtype: 'text_output', title: 'False branch', position: { x: 600, y: 200 }, config: { message: 'SKIPPED' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true', label: 'True' },
        { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 'false', label: 'False' },
      ],
    }

    const first = await executeFlow(crawlFlow)
    expect(first.status).toBe('failed')
    expect(first.steps.find((s) => s.nodeId === 'n4')?.status).toBe('error')

    const resumed = await executeFlow(crawlFlow, {
      resumeFrom: { previousSteps: first.steps, startFromNodeId: 'n4' },
    })
    expect(resumed.status).toBe('completed')
    expect(resumed.finalOutput).toBe('Synthesized from real markdown')
    expect(resumed.steps.find((s) => s.nodeId === 'n5')?.status).toBe('skipped')

    const missing = await executeFlow(crawlFlow, {
      resumeFrom: { previousSteps: first.steps, startFromNodeId: 'deleted_node' },
    })
    expect(missing.status).toBe('failed')
    expect(missing.summary).toContain('Cannot resume')
  })

  test('human_approval routes rejection down a wired false branch when present and omits finalOutput when halted', async () => {
    const branchedApproval: FlowDefinition = {
      id: 'flow_approval_branch',
      name: 'Branched Approval',
      description: 'Routes rejections to false branch',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: 'n1', kind: 'trigger', subtype: 'text_input', title: 'Input', position: { x: 0, y: 0 }, config: { sampleInput: 'Deploy v2' } },
        { id: 'n2', kind: 'control', subtype: 'human_approval', title: 'Approval', position: { x: 200, y: 0 }, config: { prompt: 'Approve deploy?' } },
        { id: 'n3', kind: 'action', subtype: 'text_output', title: 'Approved Output', position: { x: 400, y: 0 }, config: { message: 'Approved: {{input}}' } },
        { id: 'n4', kind: 'action', subtype: 'text_output', title: 'Rejected Output', position: { x: 400, y: 200 }, config: { message: 'Escalated rejection: {{input}}' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'true', label: 'True' },
        { id: 'e3', source: 'n2', target: 'n4', sourceHandle: 'false', label: 'False' },
      ],
    }

    const paused = await executeFlow(branchedApproval, { trigger: 'schedule' })
    expect(paused.status).toBe('waiting_approval')

    // Even if flow is paused during review, reviewer decision still resumes cleanly.
    const rejectedBranch = await executeFlow(
      { ...branchedApproval, status: 'paused' },
      {
        trigger: 'schedule',
        resumeFrom: { previousSteps: paused.steps, startFromNodeId: 'n2' },
        approvalDecisions: { n2: 'rejected' },
      },
    )
    expect(rejectedBranch.status).toBe('completed')
    expect(rejectedBranch.steps.find((s) => s.nodeId === 'n2')?.status).toBe('rejected')
    expect(rejectedBranch.steps.find((s) => s.nodeId === 'n3')?.status).toBe('skipped')
    expect(rejectedBranch.steps.find((s) => s.nodeId === 'n4')?.status).toBe('success')
    expect(rejectedBranch.finalOutput).toBe('Escalated rejection: Deploy v2')
  })

  test('paused flows skip scheduled triggers without executing external calls', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const flow = { ...instantiateTemplate(FLOW_TEMPLATES.find((t) => t.id === 'basic-prompting')!), status: 'paused' as const }
    const run = await executeFlow(flow, { trigger: 'schedule' })
    expect(run.status).toBe('completed')
    expect(run.summary).toContain('paused')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('resumeFrom retries from a failed step while reusing earlier succeeded outputs', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1
        if (calls === 1) return new Response('upstream failure', { status: 503 })
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'Recovered final answer' } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }),
    )
    const flow = instantiateTemplate(FLOW_TEMPLATES.find((t) => t.id === 'basic-prompting')!)
    const first = await executeFlow(flow, { sampleInput: 'Test resume' })
    expect(first.status).toBe('failed')
    const failedStep = first.steps.find((s) => s.status === 'error')!
    expect(failedStep.nodeId).toBe('n3')

    const resumed = await executeFlow(flow, {
      sampleInput: 'Test resume',
      resumeFrom: { previousSteps: first.steps, startFromNodeId: failedStep.nodeId },
    })
    expect(resumed.status).toBe('completed')
    expect(resumed.finalOutput).toBe('Recovered final answer')
    expect(resumed.steps.every((s) => s.status === 'success')).toBe(true)
  })

  test('human_approval node pauses execution and resumes cleanly on approve or halts on reject', async () => {
    const approvalFlow: FlowDefinition = {
      id: 'flow_approval_test',
      name: 'Approval Flow',
      description: 'Tests human approval gate',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: 'n1', kind: 'trigger', subtype: 'text_input', title: 'Input', position: { x: 0, y: 0 }, config: { sampleInput: 'Send Q4 memo' } },
        { id: 'n2', kind: 'control', subtype: 'human_approval', title: 'Human Approval', position: { x: 200, y: 0 }, config: { prompt: 'Approve sending Q4 memo?' } },
        { id: 'n3', kind: 'action', subtype: 'text_output', title: 'Output', position: { x: 400, y: 0 }, config: { message: 'Sent: {{input}}' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'true', label: 'Approved' },
      ],
    }

    const paused = await executeFlow(approvalFlow)
    expect(paused.status).toBe('waiting_approval')
    expect(paused.pendingApprovalNodeId).toBe('n2')
    expect(paused.steps.find((s) => s.nodeId === 'n2')?.status).toBe('waiting_approval')
    expect(paused.steps.find((s) => s.nodeId === 'n3')?.status).toBe('pending')

    const approved = await executeFlow(approvalFlow, {
      resumeFrom: { previousSteps: paused.steps, startFromNodeId: 'n2' },
      approvalDecisions: { n2: 'approved' },
    })
    expect(approved.status).toBe('completed')
    expect(approved.finalOutput).toBe('Sent: Send Q4 memo')

    const rejected = await executeFlow(approvalFlow, {
      resumeFrom: { previousSteps: paused.steps, startFromNodeId: 'n2' },
      approvalDecisions: { n2: 'rejected' },
    })
    expect(rejected.status).toBe('rejected')
    expect(rejected.steps.find((s) => s.nodeId === 'n3')?.status).toBe('skipped')
  })

  test('describeTemplateMeta derives real trigger, output, and connections from every starter template', () => {
    for (const tpl of FLOW_TEMPLATES) {
      const meta = describeTemplateMeta(tpl)
      expect(meta.trigger.length).toBeGreaterThan(0)
      expect(meta.output.length).toBeGreaterThan(0)
      expect(meta.stepCount).toBeGreaterThan(0)
    }
    const pokedex = FLOW_TEMPLATES.find((t) => t.id === 'pokedex-agent')!
    const pokedexMeta = describeTemplateMeta(pokedex)
    expect(pokedexMeta.trigger).toBe('Chat / Playground')
    expect(pokedexMeta.output).toBe('Chat reply')
    expect(pokedexMeta.connections).toContain('Hanzo Enso')
    expect(pokedexMeta.connections).toContain('HTTP API')
  })
})
