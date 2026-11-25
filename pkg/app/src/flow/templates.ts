import {
  createFlowId,
  describeCron,
  isEmbeddingNode,
  isKnowledgeIngestionNode,
  isKnowledgeRetrievalNode,
  isModelExecutionNode,
  isStickyNoteNode,
  type FlowDefinition,
  type FlowEdge,
  type FlowNode,
  type FlowSchedule,
} from './types'

export type FlowTemplateCategory =
  | 'Agents'
  | 'RAG & Knowledge'
  | 'Marketing & Social'
  | 'Ops & Finance'
  | 'Scheduled & CRM'

export const FLOW_TEMPLATE_CATEGORIES: readonly FlowTemplateCategory[] = [
  'Agents',
  'RAG & Knowledge',
  'Marketing & Social',
  'Ops & Finance',
  'Scheduled & CRM',
]

export interface FlowTemplate {
  id: string
  name: string
  category: FlowTemplateCategory
  description: string
  starterPrompts?: readonly string[]
  schedule?: FlowSchedule
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export const FLOW_TEMPLATES: readonly FlowTemplate[] = [
  // 1. Pokédex Agent
  {
    id: 'pokedex-agent',
    name: 'Pokédex Agent',
    category: 'Agents',
    description:
      'Research any Pokémon live with a specialized Enso Agent wired directly to the public PokéAPI — ready in Playground with zero external keys.',
    starterPrompts: [
      'Tell me about Pikachu — types, base stats, and abilities.',
      'Look up Charizard and summarize its battle strengths.',
      'What are Gengar’s base stats and signature abilities?',
    ],
    nodes: [
      {
        id: 'n_readme',
        kind: 'note',
        subtype: 'sticky_note',
        title: 'Readme',
        description: 'Quick-start instructions for Pokédex Agent',
        position: { x: 48, y: 32 },
        config: {
          noteBody:
            'Pokédex Agent\n\nOpen Playground and ask about any Pokémon (Pikachu, Charizard, Mewtwo, Eevee).\n\n1. API Request queries PokéAPI live.\n2. Enso Agent formats stats, types, and strategy.\n3. Powered natively by Hanzo Enso — no external API keys required.',
        },
      },
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Chat Input',
        description: 'User question from Playground',
        position: { x: 48, y: 272 },
        config: {
          sampleInput: 'Tell me about Pikachu — types, base stats, and abilities.',
        },
      },
      {
        id: 'n2',
        kind: 'data',
        subtype: 'api_request',
        title: 'PokéAPI Request',
        description: 'Fetches live Pokémon JSON from PokéAPI',
        position: { x: 352, y: 128 },
        config: {
          method: 'GET',
          url: 'https://pokeapi.co/api/v2/pokemon/{{query}}',
          toolMode: true,
        },
      },
      {
        id: 'n3',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Pokédex Agent',
        description: 'Synthesizes live PokéAPI stats into a field guide entry',
        position: { x: 672, y: 224 },
        config: {
          model: 'enso',
          systemPrompt:
            'You are a Pokédex research assistant powered by Hanzo Enso. Use the live PokéAPI tool payload provided in context to report accurate Pokédex ID, types, height/weight, abilities, base stats table, and 2 concise battle tips.',
          prompt: 'Trainer question:\n{{input}}',
          temperature: 0.25,
        },
      },
      {
        id: 'n4',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        description: 'Streams Pokédex card into Playground',
        position: { x: 992, y: 224 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', sourceHandle: 'output', targetHandle: 'input' },
      { id: 'e2', source: 'n1', target: 'n3', sourceHandle: 'output', targetHandle: 'input' },
      { id: 'e3', source: 'n2', target: 'n3', sourceHandle: 'tools', targetHandle: 'tools', label: 'Tools' },
      { id: 'e4', source: 'n3', target: 'n4', sourceHandle: 'output', targetHandle: 'input' },
    ],
  },

  // 2. Basic Prompting
  {
    id: 'basic-prompting',
    name: 'Basic Prompting',
    category: 'Agents',
    description:
      'Minimal interactive prompt workflow connecting Chat Input, Prompt Template, Hanzo Enso Language Model, and Chat Output.',
    starterPrompts: [
      'Explain quantum error correction in 3 plain bullets.',
      'Draft a crisp launch announcement for Hanzo Flow.',
    ],
    nodes: [
      {
        id: 'n_readme',
        kind: 'note',
        subtype: 'sticky_note',
        title: 'Readme',
        position: { x: 48, y: 32 },
        config: {
          noteBody:
            'Basic Prompting\n\nEdit the Prompt Template or swap Enso models in the right Inspector, then open Playground to chat immediately.',
        },
      },
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Chat Input',
        position: { x: 48, y: 240 },
        config: { sampleInput: 'Explain why edge inference matters for real-time agents in 3 bullets.' },
      },
      {
        id: 'n2',
        kind: 'llm',
        subtype: 'prompt_template',
        title: 'Prompt Template',
        position: { x: 352, y: 240 },
        config: {
          prompt: 'Answer clearly with concise markdown bullets and concrete examples:\n\n{{input}}',
        },
      },
      {
        id: 'n3',
        kind: 'agent',
        subtype: 'language_model',
        title: 'Enso Model',
        position: { x: 656, y: 240 },
        config: {
          model: 'enso',
          systemPrompt: 'You are a clear, first-principles Hanzo assistant.',
          prompt: '{{input}}',
          temperature: 0.3,
        },
      },
      {
        id: 'n4',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 960, y: 240 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },

  // 3. Basic Prompt Chaining
  {
    id: 'basic-prompt-chaining',
    name: 'Basic Prompt Chaining',
    category: 'Agents',
    description:
      'Chain two Enso stages sequentially: Stage 1 drafts an outline with Enso Flash, Stage 2 expands and polishes it with Enso Pro.',
    starterPrompts: ['Write an architectural RFC for a zero-downtime migration.'],
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Chat Input',
        position: { x: 48, y: 144 },
        config: { sampleInput: 'Design a 30-60-90 day developer onboarding plan for an AI startup.' },
      },
      {
        id: 'n2',
        kind: 'llm',
        subtype: 'prompt_template',
        title: 'Outline Prompt',
        position: { x: 336, y: 144 },
        config: { prompt: 'Create a tight numbered outline for:\n{{input}}' },
      },
      {
        id: 'n3',
        kind: 'agent',
        subtype: 'language_model',
        title: 'Stage 1 · Enso Flash',
        position: { x: 624, y: 144 },
        config: {
          model: 'enso-flash',
          systemPrompt: 'Generate a concise, logically ordered outline.',
          prompt: '{{input}}',
          temperature: 0.3,
        },
      },
      {
        id: 'n4',
        kind: 'agent',
        subtype: 'language_model',
        title: 'Stage 2 · Enso Pro',
        position: { x: 912, y: 144 },
        config: {
          model: 'enso-pro',
          systemPrompt: 'Expand the outline into an executive-ready playbook with clear milestones.',
          prompt: 'Expand this outline:\n\n{{input}}',
          temperature: 0.35,
        },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 1200, y: 144 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },

  // 4. Simple Agent
  {
    id: 'simple-agent',
    name: 'Simple Agent',
    category: 'Agents',
    description:
      'General-purpose Enso Agent equipped with Web Search and Sandbox Code Exec tools for everyday reasoning and calculations.',
    starterPrompts: [
      'Compare latency tradeoffs between WebSockets and SSE for token streaming.',
      'Calculate annual savings if GPU utilization increases from 38% to 72% on $40k/mo spend.',
    ],
    nodes: [
      {
        id: 'n_readme',
        kind: 'note',
        subtype: 'sticky_note',
        title: 'Readme',
        position: { x: 48, y: 32 },
        config: {
          noteBody:
            'Simple Agent\n\nAttach any Data Source or Processing node to the Tools port on Enso Agent to expand its capabilities.',
        },
      },
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Chat Input',
        position: { x: 48, y: 240 },
        config: { sampleInput: 'Summarize top 3 onboarding bottlenecks and suggest a 1-week sprint.' },
      },
      {
        id: 'n2',
        kind: 'data',
        subtype: 'web_search',
        title: 'Web Search Tool',
        position: { x: 352, y: 96 },
        config: { query: '{{input}}', topK: 4, toolMode: true },
      },
      {
        id: 'n3',
        kind: 'processing',
        subtype: 'sandbox_code',
        title: 'Sandbox Code Tool',
        position: { x: 352, y: 336 },
        config: { code: 'return input.trim()', toolMode: true },
      },
      {
        id: 'n4',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Agent',
        position: { x: 672, y: 224 },
        config: {
          model: 'enso',
          systemPrompt: 'You are a pragmatic Hanzo problem-solving agent. Be direct, structured, and accurate.',
          prompt: '{{input}}',
          temperature: 0.3,
        },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 976, y: 224 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n4', sourceHandle: 'output', targetHandle: 'input' },
      { id: 'e2', source: 'n2', target: 'n4', sourceHandle: 'tools', targetHandle: 'tools', label: 'Tools' },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'tools', targetHandle: 'tools', label: 'Tools' },
      { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 'output', targetHandle: 'input' },
    ],
  },

  // 5. Memory Chatbot
  {
    id: 'memory-chatbot',
    name: 'Memory Chatbot',
    category: 'Agents',
    description:
      'Stateful multi-turn chatbot that preserves Playground conversation history via Conversation Memory before calling Enso.',
    starterPrompts: [
      'Remember that my workspace uses Go, TypeScript, and PostgreSQL.',
      'What stack did I just tell you we use?',
    ],
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Chat Input',
        position: { x: 48, y: 144 },
        config: { sampleInput: 'Hi! Remember I am building a real-time analytics app in TypeScript.' },
      },
      {
        id: 'n2',
        kind: 'llm',
        subtype: 'conversation_memory',
        title: 'Conversation Memory',
        position: { x: 352, y: 144 },
        config: { memoryWindow: 12 },
      },
      {
        id: 'n3',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Conversationalist',
        position: { x: 656, y: 144 },
        config: {
          model: 'enso',
          systemPrompt: 'You are a helpful conversational assistant with full memory of the current Playground session.',
          prompt: '{{input}}',
          temperature: 0.4,
        },
      },
      {
        id: 'n4',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 960, y: 144 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },

  // 6. Document Q&A
  {
    id: 'document-qa',
    name: 'Document Q&A',
    category: 'RAG & Knowledge',
    description:
      'Loads documents, chunks them cleanly, injects relevant passages into a Prompt Template, and answers user questions grounded in source text.',
    starterPrompts: ['What were the Q4 revenue and gross margin figures?'],
    nodes: [
      {
        id: 'n1',
        kind: 'knowledge',
        subtype: 'file_loader',
        title: 'File Loader',
        position: { x: 48, y: 80 },
        config: {
          filePath: 'company-brief.md',
          sampleInput:
            'Q4 Revenue reached $14.2M (+34% YoY). Gross Margin held at 78.4%. Enterprise retention rose to 124% NRR.',
        },
      },
      {
        id: 'n2',
        kind: 'knowledge',
        subtype: 'text_splitter',
        title: 'Text Splitter',
        position: { x: 352, y: 80 },
        config: { chunkSize: 600, chunkOverlap: 80 },
      },
      {
        id: 'n3',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Chat Input',
        position: { x: 48, y: 272 },
        config: { sampleInput: 'What is our gross margin and NRR from the brief?' },
      },
      {
        id: 'n4',
        kind: 'llm',
        subtype: 'prompt_template',
        title: 'Grounded Q&A Prompt',
        position: { x: 656, y: 176 },
        config: {
          prompt: 'Answer strictly from the provided document passages. Cite exact figures:\n\n{{input}}',
        },
      },
      {
        id: 'n5',
        kind: 'agent',
        subtype: 'language_model',
        title: 'Enso Pro Reader',
        position: { x: 960, y: 176 },
        config: {
          model: 'enso-pro',
          systemPrompt: 'Only state facts present in the source passages. Note if a detail is missing.',
          prompt: '{{input}}',
          temperature: 0.1,
        },
      },
      {
        id: 'n6',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 1264, y: 176 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n4' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
      { id: 'e5', source: 'n5', target: 'n6' },
    ],
  },

  // 7. Vector Store RAG
  {
    id: 'vector-store-rag',
    name: 'Vector Store RAG',
    category: 'RAG & Knowledge',
    description:
      'End-to-end Retrieval-Augmented Generation pipeline using Zen Embeddings (`zen-embedding-3`), Vector Store search, and Enso synthesis.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Chat Input',
        position: { x: 48, y: 144 },
        config: { sampleInput: 'How does Hanzo IAM issue org-scoped bearer tokens?' },
      },
      {
        id: 'n2',
        kind: 'llm',
        subtype: 'embeddings',
        title: 'Zen Embeddings',
        position: { x: 352, y: 144 },
        config: { model: 'zen-embedding-3' },
      },
      {
        id: 'n3',
        kind: 'knowledge',
        subtype: 'vector_store',
        title: 'Vector Store',
        position: { x: 656, y: 144 },
        config: { collection: 'hanzo-docs', topK: 6 },
      },
      {
        id: 'n4',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso RAG Agent',
        position: { x: 960, y: 144 },
        config: {
          model: 'enso',
          systemPrompt: 'Synthesize a clear technical answer grounded in the retrieved vector context.',
          prompt: '{{input}}',
          temperature: 0.2,
        },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 1264, y: 144 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },

  // 8. Hybrid Search RAG
  {
    id: 'hybrid-search-rag',
    name: 'Hybrid Search RAG',
    category: 'RAG & Knowledge',
    description:
      'Combines dense Vector Store recall with lexical Knowledge Retrieval, re-ranks passages, and generates a high-precision answer with Enso Pro.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Chat Input',
        position: { x: 48, y: 176 },
        config: { sampleInput: 'Compare KMS secret rotation policies across staging and production.' },
      },
      {
        id: 'n2',
        kind: 'knowledge',
        subtype: 'vector_store',
        title: 'Dense Vector Search',
        position: { x: 352, y: 80 },
        config: { collection: 'security-kb', topK: 8 },
      },
      {
        id: 'n3',
        kind: 'knowledge',
        subtype: 'knowledge_retrieval',
        title: 'Lexical KB Search',
        position: { x: 352, y: 272 },
        config: { collection: 'security-kb', topK: 8 },
      },
      {
        id: 'n4',
        kind: 'llm',
        subtype: 'reranker',
        title: 'Cross-Encoder Reranker',
        position: { x: 656, y: 176 },
        config: { topK: 5 },
      },
      {
        id: 'n5',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Pro Synthesizer',
        position: { x: 960, y: 176 },
        config: {
          model: 'enso-pro',
          systemPrompt: 'Produce a precise, well-cited answer from the top reranked passages.',
          prompt: '{{input}}',
          temperature: 0.15,
        },
      },
      {
        id: 'n6',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 1264, y: 176 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n1', target: 'n3' },
      { id: 'e3', source: 'n2', target: 'n4' },
      { id: 'e4', source: 'n3', target: 'n4' },
      { id: 'e5', source: 'n4', target: 'n5' },
      { id: 'e6', source: 'n5', target: 'n6' },
    ],
  },

  // 9. Knowledge Ingestion
  {
    id: 'knowledge-ingestion',
    name: 'Knowledge Ingestion',
    category: 'RAG & Knowledge',
    description:
      'Ingests web URLs into a Hanzo Knowledge Base by fetching content, splitting into overlapping chunks, embedding with Zen, and indexing.',
    nodes: [
      {
        id: 'n1',
        kind: 'data',
        subtype: 'url_fetch',
        title: 'URL Fetch',
        position: { x: 48, y: 144 },
        config: { url: 'https://hanzo.ai/docs/flow' },
      },
      {
        id: 'n2',
        kind: 'knowledge',
        subtype: 'text_splitter',
        title: 'Text Splitter',
        position: { x: 352, y: 144 },
        config: { chunkSize: 1000, chunkOverlap: 150 },
      },
      {
        id: 'n3',
        kind: 'llm',
        subtype: 'embeddings',
        title: 'Zen Embeddings',
        position: { x: 656, y: 144 },
        config: { model: 'zen-embedding-3' },
      },
      {
        id: 'n4',
        kind: 'knowledge',
        subtype: 'knowledge_ingestion',
        title: 'Knowledge Ingestion',
        position: { x: 960, y: 144 },
        config: { collection: 'product-docs' },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'text_output',
        title: 'Ingestion Receipt',
        position: { x: 1264, y: 144 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },

  // 10. Knowledge Retrieval
  {
    id: 'knowledge-retrieval',
    name: 'Knowledge Retrieval',
    category: 'RAG & Knowledge',
    description:
      'Queries an existing Hanzo Knowledge Base, reranks top passages, and answers cleanly via Enso.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'text_input',
        title: 'Query Input',
        position: { x: 48, y: 144 },
        config: { sampleInput: 'What are the default rate limits on /v1/chat/completions?' },
      },
      {
        id: 'n2',
        kind: 'knowledge',
        subtype: 'knowledge_retrieval',
        title: 'Knowledge Retrieval',
        position: { x: 352, y: 144 },
        config: { collection: 'product-docs', topK: 5 },
      },
      {
        id: 'n3',
        kind: 'llm',
        subtype: 'reranker',
        title: 'Reranker',
        position: { x: 656, y: 144 },
        config: { topK: 3 },
      },
      {
        id: 'n4',
        kind: 'agent',
        subtype: 'language_model',
        title: 'Enso Answer',
        position: { x: 960, y: 144 },
        config: {
          model: 'enso',
          systemPrompt: 'Answer accurately using the retrieved knowledge snippets.',
          prompt: '{{input}}',
          temperature: 0.2,
        },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 1264, y: 144 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },

  // 11. Research Agent
  {
    id: 'research-agent',
    name: 'Research Agent',
    category: 'Agents',
    description:
      'Generates a focused research plan, gathers web & URL evidence via connected tools, and synthesizes an executive report with Enso Pro.',
    starterPrompts: ['Research open-weight coding models released this year and compare benchmarks.'],
    nodes: [
      {
        id: 'n_readme',
        kind: 'note',
        subtype: 'sticky_note',
        title: 'Readme',
        position: { x: 48, y: 32 },
        config: {
          noteBody:
            'Research Agent\n\nEnter any topic in Playground to generate a structured multi-source research brief with Key Findings, Tradeoffs, and Next Steps.',
        },
      },
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Research Topic',
        position: { x: 48, y: 240 },
        config: { sampleInput: 'Compare speculative decoding and KV-cache quantization for LLM serving.' },
      },
      {
        id: 'n2',
        kind: 'data',
        subtype: 'web_search',
        title: 'Web Search',
        position: { x: 352, y: 96 },
        config: { query: '{{input}}', topK: 6, toolMode: true },
      },
      {
        id: 'n3',
        kind: 'data',
        subtype: 'url_fetch',
        title: 'URL Reader',
        position: { x: 352, y: 336 },
        config: { url: 'https://hanzo.ai/research', toolMode: true },
      },
      {
        id: 'n4',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Pro Researcher',
        position: { x: 672, y: 224 },
        config: {
          model: 'enso-pro',
          systemPrompt:
            'Produce a rigorous research brief with sections: Executive Summary, Key Evidence, Tradeoffs, and Recommendations.',
          prompt: 'Research request:\n{{input}}',
          temperature: 0.25,
        },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 992, y: 224 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n4', sourceHandle: 'output', targetHandle: 'input' },
      { id: 'e2', source: 'n2', target: 'n4', sourceHandle: 'tools', targetHandle: 'tools', label: 'Tools' },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'tools', targetHandle: 'tools', label: 'Tools' },
      { id: 'e4', source: 'n4', target: 'n5', sourceHandle: 'output', targetHandle: 'input' },
    ],
  },

  // 12. Sequential Tasks Agents
  {
    id: 'sequential-tasks-agents',
    name: 'Sequential Tasks Agents',
    category: 'Agents',
    description:
      'Executes a three-agent relay: Researcher gathers facts, Strategist builds the plan, and Zen 6 Editor sharpens the final deliverable.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Mission Brief',
        position: { x: 48, y: 144 },
        config: { sampleInput: 'Launch plan for an enterprise sovereign AI developer platform.' },
      },
      {
        id: 'n2',
        kind: 'agent',
        subtype: 'enso_agent',
        title: '1 · Researcher',
        position: { x: 352, y: 144 },
        config: {
          model: 'enso',
          systemPrompt: 'Identify buyer personas, objections, and core technical differentiators.',
          prompt: '{{input}}',
          temperature: 0.3,
        },
      },
      {
        id: 'n3',
        kind: 'agent',
        subtype: 'enso_agent',
        title: '2 · Strategist',
        position: { x: 656, y: 144 },
        config: {
          model: 'enso-pro',
          systemPrompt: 'Turn the research notes into a concrete 4-week go-to-market execution plan.',
          prompt: 'Research findings:\n{{input}}',
          temperature: 0.3,
        },
      },
      {
        id: 'n4',
        kind: 'agent',
        subtype: 'enso_agent',
        title: '3 · Zen 6 Editor',
        position: { x: 960, y: 144 },
        config: {
          model: 'zen6',
          systemPrompt: 'Tighten prose to crisp executive clarity with clear owners and measurable KPIs.',
          prompt: 'Draft plan:\n{{input}}',
          temperature: 0.25,
        },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 1264, y: 144 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },

  // 13. Search Agent
  {
    id: 'search-agent',
    name: 'Search Agent',
    category: 'Agents',
    description:
      'Fast web-grounded Q&A agent pairing Web Search and URL Fetch tools with low-latency Enso Flash.',
    starterPrompts: ['What are the latest advances in post-quantum cryptography standards?'],
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Search Query',
        position: { x: 48, y: 160 },
        config: { sampleInput: 'Summarize NIST ML-DSA and ML-KEM standardization status.' },
      },
      {
        id: 'n2',
        kind: 'data',
        subtype: 'web_search',
        title: 'Web Search',
        position: { x: 352, y: 80 },
        config: { query: '{{input}}', topK: 5, toolMode: true },
      },
      {
        id: 'n3',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Flash Search',
        position: { x: 672, y: 160 },
        config: {
          model: 'enso-flash',
          systemPrompt: 'Answer directly with cited takeaways and zero filler.',
          prompt: '{{input}}',
          temperature: 0.2,
        },
      },
      {
        id: 'n4',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 976, y: 160 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n3' },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'tools', targetHandle: 'tools', label: 'Tools' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },

  // 14. Blog Writer
  {
    id: 'blog-writer',
    name: 'Blog Writer',
    category: 'Marketing & Social',
    description:
      'Turns topic instructions and reference articles into publication-ready long-form technical or product blog posts via Enso Pro.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'text_input',
        title: 'Topic & Voice',
        position: { x: 48, y: 96 },
        config: {
          sampleInput: 'Write a clear engineering blog post on building observable AI workflows with Hanzo Flow.',
        },
      },
      {
        id: 'n2',
        kind: 'data',
        subtype: 'url_fetch',
        title: 'Reference Article',
        position: { x: 48, y: 272 },
        config: { url: 'https://hanzo.ai/blog' },
      },
      {
        id: 'n3',
        kind: 'llm',
        subtype: 'prompt_template',
        title: 'Editorial Prompt',
        position: { x: 368, y: 176 },
        config: {
          prompt:
            'Draft a crisp, engaging blog post with an H1 headline, hook, 3 technical sections, and takeaway CTA:\n\n{{input}}',
        },
      },
      {
        id: 'n4',
        kind: 'agent',
        subtype: 'language_model',
        title: 'Enso Pro Writer',
        position: { x: 688, y: 176 },
        config: {
          model: 'enso-pro',
          systemPrompt: 'Write with Feynman clarity and zero marketing fluff.',
          prompt: '{{input}}',
          temperature: 0.5,
        },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Blog Draft Output',
        position: { x: 1008, y: 176 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n3' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },

  // 15. Social Media Agent
  {
    id: 'social-media-agent',
    name: 'Social Media Agent',
    category: 'Marketing & Social',
    description:
      'Researches trending signals, crafts platform-native posts with Enso, and queues publishing through Hanzo Post.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Campaign Topic',
        position: { x: 48, y: 160 },
        config: { sampleInput: 'Announce Hanzo Flow Studio v2 with 26 runnable templates and live Playground.' },
      },
      {
        id: 'n2',
        kind: 'data',
        subtype: 'web_search',
        title: 'Trend Research',
        position: { x: 352, y: 80 },
        config: { query: '{{input}}', topK: 4, toolMode: true },
      },
      {
        id: 'n3',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Social Strategist',
        position: { x: 672, y: 160 },
        config: {
          model: 'enso',
          systemPrompt: 'Create 3 distinct social posts tailored for X, LinkedIn, and Discord with concise hooks.',
          prompt: '{{input}}',
          temperature: 0.55,
        },
      },
      {
        id: 'n4',
        kind: 'hanzo',
        subtype: 'hanzo_post',
        title: 'Hanzo Post',
        position: { x: 976, y: 160 },
        config: { channel: '#social-queue', message: '{{input}}' },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 1280, y: 160 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n3' },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'tools', targetHandle: 'tools', label: 'Tools' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },

  // 16. Instagram Copywriter
  {
    id: 'instagram-copywriter',
    name: 'Instagram Copywriter',
    category: 'Marketing & Social',
    description:
      'Produces high-converting Instagram carousel copy, hooks, hashtags, and matching visual art direction prompts.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Product Brief',
        position: { x: 48, y: 96 },
        config: { sampleInput: 'Minimal matte-black AI hardware ring that approves tasks with a gesture.' },
      },
      {
        id: 'n2',
        kind: 'trigger',
        subtype: 'text_input',
        title: 'Brand Guidelines',
        position: { x: 48, y: 272 },
        config: { sampleInput: 'Tone: minimalist, architectural, high-contrast monochrome aesthetic.' },
      },
      {
        id: 'n3',
        kind: 'llm',
        subtype: 'prompt_template',
        title: 'Caption & Visual Prompt',
        position: { x: 368, y: 176 },
        config: {
          prompt: 'Generate an Instagram caption, 5 slide headlines, and 1 studio photo art-direction prompt:\n\n{{input}}',
        },
      },
      {
        id: 'n4',
        kind: 'agent',
        subtype: 'language_model',
        title: 'Enso Copywriter',
        position: { x: 688, y: 176 },
        config: {
          model: 'enso',
          systemPrompt: 'Write punchy, restrained copy worthy of an industrial design launch.',
          prompt: '{{input}}',
          temperature: 0.6,
        },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 1008, y: 176 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n3' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },

  // 17. Twitter Thread Generator
  {
    id: 'twitter-thread-generator',
    name: 'Twitter Thread Generator',
    category: 'Marketing & Social',
    description:
      'Transforms rough notes or product launches into crisp, numbered X/Twitter threads under 280 characters per post.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Thread Topic',
        position: { x: 48, y: 144 },
        config: { sampleInput: 'Why deterministic visual graphs + streaming LLMs beat brittle prompt scripts.' },
      },
      {
        id: 'n2',
        kind: 'llm',
        subtype: 'prompt_template',
        title: 'Thread Format Prompt',
        position: { x: 352, y: 144 },
        config: {
          prompt:
            'Turn the topic below into a 6-post thread. Number each post 1/6..6/6, keep every post <= 260 characters:\n\n{{input}}',
        },
      },
      {
        id: 'n3',
        kind: 'agent',
        subtype: 'language_model',
        title: 'Zen 6 Thread Writer',
        position: { x: 656, y: 144 },
        config: {
          model: 'zen6',
          systemPrompt: 'Write high-signal technical threads. No cliches, no emoji spam.',
          prompt: '{{input}}',
          temperature: 0.5,
        },
      },
      {
        id: 'n4',
        kind: 'processing',
        subtype: 'text_parser',
        title: 'Format Parser',
        position: { x: 960, y: 144 },
        config: { pattern: '{{input}}' },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 1264, y: 144 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },

  // 18. Market Research
  {
    id: 'market-research',
    name: 'Market Research',
    category: 'Ops & Finance',
    description:
      'Researches competitors, extracts positioning, pricing tiers, and moats, and outputs a clean structured JSON + executive comparison.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Target Company / Sector',
        position: { x: 48, y: 160 },
        config: { sampleInput: 'Analyze competitive landscape for AI workflow orchestration platforms.' },
      },
      {
        id: 'n2',
        kind: 'data',
        subtype: 'web_search',
        title: 'Market Search',
        position: { x: 352, y: 80 },
        config: { query: '{{input}}', topK: 6, toolMode: true },
      },
      {
        id: 'n3',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Market Analyst',
        position: { x: 672, y: 160 },
        config: {
          model: 'enso-pro',
          systemPrompt: 'Analyze market positioning, pricing model, differentiation, and key risks concisely.',
          prompt: '{{input}}',
          temperature: 0.25,
        },
      },
      {
        id: 'n4',
        kind: 'agent',
        subtype: 'structured_output',
        title: 'Structured Matrix',
        position: { x: 976, y: 160 },
        config: {
          model: 'enso-flash',
          schema: '{"segment":"string","leaders":["string"],"pricing_signals":["string"],"opportunities":["string"]}',
          prompt: 'Convert into structured JSON:\n{{input}}',
          temperature: 0.1,
        },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 1280, y: 160 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n3' },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'tools', targetHandle: 'tools', label: 'Tools' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },

  // 19. Financial Report Parser
  {
    id: 'financial-report-parser',
    name: 'Financial Report Parser',
    category: 'Ops & Finance',
    description:
      'Extracts Revenue, Gross Profit, EBITDA, Net Income, and YoY growth from earnings statements into validated JSON.',
    nodes: [
      {
        id: 'n1',
        kind: 'knowledge',
        subtype: 'file_loader',
        title: 'Earnings Statement',
        position: { x: 48, y: 144 },
        config: {
          filePath: 'fy26-q4-earnings.txt',
          sampleInput:
            'FY26 Q4 Results: Total Revenue $84.5M (+28% YoY), Gross Profit $63.4M (75% margin), Adjusted EBITDA $19.2M, Net Income $12.8M, Cash $142M.',
        },
      },
      {
        id: 'n2',
        kind: 'agent',
        subtype: 'structured_output',
        title: 'Financial Extractor',
        position: { x: 368, y: 144 },
        config: {
          model: 'enso-pro',
          systemPrompt: 'Extract exact financial metrics as valid JSON. Preserve units.',
          schema: '{"period":"string","revenue":"string","gross_profit":"string","ebitda":"string","net_income":"string"}',
          prompt: 'Parse financial report:\n\n{{input}}',
          temperature: 0.05,
        },
      },
      {
        id: 'n3',
        kind: 'processing',
        subtype: 'json_transform',
        title: 'JSON Normalizer',
        position: { x: 688, y: 144 },
        config: { transform: 'pretty' },
      },
      {
        id: 'n4',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 1008, y: 144 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },

  // 20. Invoice Summarizer
  {
    id: 'invoice-summarizer',
    name: 'Invoice Summarizer',
    category: 'Ops & Finance',
    description:
      'Parses vendor invoices into line items, due dates, and totals, flags anomalies, and logs structured entries to Hanzo Base.',
    nodes: [
      {
        id: 'n1',
        kind: 'knowledge',
        subtype: 'file_loader',
        title: 'Invoice Document',
        position: { x: 48, y: 144 },
        config: {
          filePath: 'invoice-2026-1142.pdf',
          sampleInput:
            'Invoice #1142 · Vendor: Orbital Compute LLC · Due: 2026-12-15 · Items: 4x H200 Nodes ($18,400), NVMe Storage ($1,200) · Total: $19,600.',
        },
      },
      {
        id: 'n2',
        kind: 'agent',
        subtype: 'structured_output',
        title: 'Enso Invoice Parser',
        position: { x: 352, y: 144 },
        config: {
          model: 'enso-flash',
          schema: '{"invoice_number":"string","vendor":"string","due_date":"string","total":"string","line_items":["string"]}',
          prompt: 'Extract invoice details and flag any unusual items:\n\n{{input}}',
          temperature: 0.1,
        },
      },
      {
        id: 'n3',
        kind: 'data',
        subtype: 'hanzo_base',
        title: 'Save to Hanzo Base',
        position: { x: 656, y: 144 },
        config: { collection: 'ap_invoices', query: '{{input}}' },
      },
      {
        id: 'n4',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 960, y: 144 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },

  // 21. Meeting Summary
  {
    id: 'meeting-summary',
    name: 'Meeting Summary',
    category: 'Ops & Finance',
    description:
      'Converts raw meeting notes or transcripts into Decisions, Action Items with Owners/Dates, and an email recap via Hanzo Mail.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'text_input',
        title: 'Meeting Transcript',
        position: { x: 48, y: 144 },
        config: {
          sampleInput:
            'Alice: Let us ship Flow Studio v2 on Tuesday. Bob: I will verify web and desktop builds by 4pm. Maya: Docs and template demos are ready.',
        },
      },
      {
        id: 'n2',
        kind: 'llm',
        subtype: 'prompt_template',
        title: 'Minutes Template',
        position: { x: 352, y: 144 },
        config: {
          prompt:
            'Summarize into 3 sections: Decisions, Action Items (Owner + Deadline), and Open Risks:\n\n{{input}}',
        },
      },
      {
        id: 'n3',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Note Taker',
        position: { x: 656, y: 144 },
        config: {
          model: 'enso',
          systemPrompt: 'Produce concise, owner-attributed meeting minutes.',
          prompt: '{{input}}',
          temperature: 0.2,
        },
      },
      {
        id: 'n4',
        kind: 'hanzo',
        subtype: 'hanzo_mail',
        title: 'Send Recap Email',
        position: { x: 960, y: 144 },
        config: { to: 'team@hanzo.ai', subject: 'Meeting summary & action items', message: '{{input}}' },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 1264, y: 144 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },

  // 22. SEO Keyword Generator
  {
    id: 'seo-keyword-generator',
    name: 'SEO Keyword Generator',
    category: 'Marketing & Social',
    description:
      'Generates high-intent SEO keyword clusters, search intent classifications, and landing page title ideas from a product brief.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'text_input',
        title: 'Product & Audience',
        position: { x: 48, y: 144 },
        config: {
          sampleInput: 'Product: Visual AI workflow builder for engineering teams. Pain point: brittle scripts.',
        },
      },
      {
        id: 'n2',
        kind: 'llm',
        subtype: 'prompt_template',
        title: 'SEO Cluster Prompt',
        position: { x: 352, y: 144 },
        config: {
          prompt:
            'Generate 15 high-intent SEO keywords grouped by Informational, Commercial, and Transactional intent, plus 3 H1 title tags:\n\n{{input}}',
        },
      },
      {
        id: 'n3',
        kind: 'agent',
        subtype: 'language_model',
        title: 'Enso Flash SEO',
        position: { x: 656, y: 144 },
        config: {
          model: 'enso-flash',
          systemPrompt: 'Output clean markdown tables with keyword, intent, and content angle.',
          prompt: '{{input}}',
          temperature: 0.35,
        },
      },
      {
        id: 'n4',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        position: { x: 960, y: 144 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },

  // 23. Travel Planning Agents
  {
    id: 'travel-planning-agents',
    name: 'Travel Planning Agents',
    category: 'Agents',
    description:
      'Multi-agent supervisor combining destination search and live API lookups to craft day-by-day travel itineraries and budget estimates.',
    starterPrompts: ['Plan a 4-day Tokyo architecture, coffee, and food itinerary for two.'],
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Trip Request',
        position: { x: 48, y: 176 },
        config: { sampleInput: 'Plan a 3-day Kyoto itinerary focused on temples, design shops, and great ramen.' },
      },
      {
        id: 'n2',
        kind: 'data',
        subtype: 'web_search',
        title: 'Destination Search',
        position: { x: 352, y: 80 },
        config: { query: '{{input}}', topK: 5, toolMode: true },
      },
      {
        id: 'n3',
        kind: 'processing',
        subtype: 'sandbox_code',
        title: 'Budget Calculator',
        position: { x: 352, y: 288 },
        config: { code: 'return input.trim()', toolMode: true },
      },
      {
        id: 'n4',
        kind: 'agent',
        subtype: 'multi_agent_supervisor',
        title: 'Travel Supervisor',
        position: { x: 672, y: 176 },
        config: {
          model: 'enso-pro',
          systemPrompt:
            'Act as a coordinated travel planner (Logistics + Dining + Budget). Produce a crisp day-by-day schedule with neighborhood groupings.',
          prompt: '{{input}}',
          temperature: 0.4,
        },
      },
      {
        id: 'n5',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Itinerary Output',
        position: { x: 992, y: 176 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n4' },
      { id: 'e2', source: 'n2', target: 'n4', sourceHandle: 'tools', targetHandle: 'tools', label: 'Tools' },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'tools', targetHandle: 'tools', label: 'Tools' },
      { id: 'e4', source: 'n4', target: 'n5' },
    ],
  },

  // 24. Portfolio Website Code Generator
  {
    id: 'portfolio-website-code-generator',
    name: 'Portfolio Website Code Generator',
    category: 'Agents',
    description:
      'Parses a resume or bio into structured JSON and uses Zen 6 Coder to generate a clean, responsive single-file portfolio site.',
    nodes: [
      {
        id: 'n1',
        kind: 'knowledge',
        subtype: 'file_loader',
        title: 'Resume / Bio Input',
        position: { x: 48, y: 144 },
        config: {
          filePath: 'resume.md',
          sampleInput:
            'Ada Chen — Principal Systems Engineer. Built distributed inference routers in Rust/Go. Open source contributor. Contact: ada@example.dev.',
        },
      },
      {
        id: 'n2',
        kind: 'agent',
        subtype: 'structured_output',
        title: 'Profile JSON Extractor',
        position: { x: 352, y: 144 },
        config: {
          model: 'enso-flash',
          schema: '{"name":"string","role":"string","highlights":["string"],"contact":"string"}',
          prompt: 'Extract structured profile JSON:\n{{input}}',
          temperature: 0.1,
        },
      },
      {
        id: 'n3',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Zen 6 Coder',
        position: { x: 656, y: 144 },
        config: {
          model: 'zen6-coder',
          systemPrompt:
            'Generate clean, accessible, dark-mode minimalist HTML + CSS portfolio code from the structured JSON profile.',
          prompt: 'Build portfolio page for:\n{{input}}',
          temperature: 0.25,
        },
      },
      {
        id: 'n4',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Generated Code',
        position: { x: 960, y: 144 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },

  // 25. Scheduled Intelligence Brief
  {
    id: 'scheduled-intelligence-brief',
    name: 'Scheduled Intelligence Brief',
    category: 'Scheduled & CRM',
    description:
      'Runs weekday mornings at 08:00 UTC via Cron Schedule, compiles key signals with Enso Pro, and delivers the brief over Hanzo Mail.',
    schedule: {
      enabled: true,
      cron: '0 8 * * 1-5',
      timezone: 'UTC',
    },
    nodes: [
      {
        id: 'n1',
        kind: 'schedule',
        subtype: 'cron_schedule',
        title: 'Weekdays 08:00 UTC',
        description: 'Recurring cron trigger',
        position: { x: 48, y: 144 },
        config: {
          cron: '0 8 * * 1-5',
          timezone: 'UTC',
          sampleInput: 'Daily AI infrastructure, GPU cluster, and open-weight model brief',
        },
      },
      {
        id: 'n2',
        kind: 'data',
        subtype: 'web_search',
        title: 'Signal Scanner',
        position: { x: 352, y: 64 },
        config: { query: '{{input}}', topK: 6, toolMode: true },
      },
      {
        id: 'n3',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Pro Brief Writer',
        description: 'Drafts executive morning intelligence brief',
        position: { x: 672, y: 144 },
        config: {
          model: 'enso-pro',
          systemPrompt:
            'Write a crisp morning intelligence brief with sections: Key Signals, Risks, and Recommended Actions.',
          prompt: 'Topic: {{input}}\nProduce today’s executive brief.',
          temperature: 0.25,
        },
      },
      {
        id: 'n4',
        kind: 'hanzo',
        subtype: 'hanzo_mail',
        title: 'Send Hanzo Mail Digest',
        description: 'Delivers brief to workspace inbox',
        position: { x: 992, y: 144 },
        config: {
          to: 'team@hanzo.ai',
          subject: 'Morning Intelligence Brief',
          message: '{{input}}',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n3' },
      { id: 'e2', source: 'n2', target: 'n3', sourceHandle: 'tools', targetHandle: 'tools', label: 'Tools' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },

  // 26. CRM Speed-to-Lead Setter
  {
    id: 'crm-speed-to-lead-setter',
    name: 'CRM Speed-to-Lead Setter',
    category: 'Scheduled & CRM',
    description:
      'Receives inbound lead webhooks, qualifies intent with Zen 6, branches high-intent leads to instant CRM note + outreach, and parks nurture leads.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'webhook',
        title: 'Inbound Lead Webhook',
        description: 'POST /v1/workflow/hooks/leads',
        position: { x: 48, y: 160 },
        config: {
          sampleInput:
            '{"contact":"Elena Vance","company":"Northstar Robotics","stage":"qualified","need":"Dedicated GPU cluster + Flow automation"}',
        },
      },
      {
        id: 'n2',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Zen 6 Lead Qualifier',
        description: 'Qualifies lead and drafts personalized 4-sentence response',
        position: { x: 352, y: 160 },
        config: {
          model: 'zen6',
          systemPrompt:
            'Start with QUALIFIED or NURTURE, then write a direct 4-sentence personalized reply proposing a 15-minute call.',
          prompt: 'Inbound lead payload:\n{{input}}',
          temperature: 0.35,
        },
      },
      {
        id: 'n3',
        kind: 'condition',
        subtype: 'if_condition',
        title: 'Qualified Lead?',
        description: 'Routes QUALIFIED leads to immediate outreach',
        position: { x: 656, y: 160 },
        config: { expression: 'contains:qualified' },
      },
      {
        id: 'n4',
        kind: 'hanzo',
        subtype: 'crm_update',
        title: 'Log CRM Activity',
        position: { x: 960, y: 80 },
        config: { crmEntity: 'lead', crmAction: 'upsert_note', message: '{{input}}' },
      },
      {
        id: 'n5',
        kind: 'hanzo',
        subtype: 'hanzo_mail',
        title: 'Instant Setter Outreach',
        position: { x: 1264, y: 80 },
        config: { to: 'elena@northstar.example', subject: 'Next steps with Hanzo', message: '{{input}}' },
      },
      {
        id: 'n6',
        kind: 'hanzo',
        subtype: 'hanzo_post',
        title: 'Notify Nurture Channel',
        position: { x: 960, y: 272 },
        config: { channel: '#lead-nurture', message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true', targetHandle: 'input', label: 'True' },
      { id: 'e4', source: 'n4', target: 'n5' },
      { id: 'e5', source: 'n3', target: 'n6', sourceHandle: 'false', targetHandle: 'input', label: 'False' },
    ],
  },
]

export interface FlowTemplateMeta {
  trigger: string
  inputs: string
  connections: string[]
  output: string
  stepCount: number
}

/**
 * Derives structured trigger, input, connection, and output metadata directly
 * from a template's actual nodes so gallery cards show real requirements.
 */
export function describeTemplateMeta(template: FlowTemplate): FlowTemplateMeta {
  const runnable = template.nodes.filter((n) => !isStickyNoteNode(n))
  const schedNode = runnable.find((n) => n.kind === 'schedule' || n.subtype === 'cron_schedule')
  const triggerNode = runnable.find((n) => n.kind === 'trigger')

  let trigger = 'Manual'
  if (template.schedule?.cron || schedNode?.config.cron) {
    const info = describeCron(template.schedule?.cron || schedNode?.config.cron || '0 8 * * 1-5')
    trigger = info.valid ? `Scheduled · ${info.human}` : 'Scheduled'
  } else if (triggerNode?.subtype === 'webhook' || triggerNode?.subtype === 'event') {
    trigger = 'Webhook'
  } else if (triggerNode?.subtype === 'chat_input') {
    trigger = 'Chat / Playground'
  } else if (triggerNode?.subtype === 'text_input') {
    trigger = 'Text input'
  } else if (runnable.some((n) => n.subtype === 'url_fetch')) {
    trigger = 'URL'
  } else if (runnable.some((n) => n.subtype === 'file_loader')) {
    trigger = 'Document'
  }

  const inputSource =
    triggerNode?.config.sampleInput?.trim() ||
    schedNode?.config.sampleInput?.trim() ||
    runnable.find((n) => n.config.filePath)?.config.filePath ||
    runnable.find((n) => n.subtype === 'url_fetch')?.config.url ||
    'Prompt or payload'
  const inputs = inputSource.length > 56 ? `${inputSource.slice(0, 55)}…` : inputSource

  const connSet = new Set<string>()
  for (const n of runnable) {
    if (isModelExecutionNode(n)) connSet.add('Hanzo Enso')
    if (isEmbeddingNode(n)) connSet.add('Zen Embeddings')
    if (isKnowledgeIngestionNode(n) || isKnowledgeRetrievalNode(n)) connSet.add('Hanzo Knowledge')
    if (n.subtype === 'api_request' || n.subtype === 'http_request') connSet.add('HTTP API')
    if (n.subtype === 'web_search') connSet.add('Web Search')
    if (n.subtype === 'url_fetch') connSet.add('URL Crawl')
    if (n.subtype === 'hanzo_mail' || n.subtype === 'email') connSet.add('Hanzo Mail')
    if (n.subtype === 'crm_update') connSet.add('Hanzo CRM')
    if (n.subtype === 'hanzo_post') connSet.add('Hanzo Post')
    if (n.subtype === 'hanzo_base') connSet.add('Hanzo Base')
    if (n.subtype === 'hanzo_kms_secret') connSet.add('Hanzo KMS')
    if (n.subtype === 'human_approval') connSet.add('Human Approval')
  }

  const lastAction = [...runnable].reverse().find((n) => n.kind === 'action') ?? runnable[runnable.length - 1]
  let output = lastAction?.title || 'Result'
  if (lastAction?.subtype === 'chat_output') output = 'Chat reply'
  else if (lastAction?.subtype === 'text_output') output = 'Text deliverable'
  else if (lastAction?.subtype === 'http_response') output = 'HTTP response'
  else if (lastAction?.subtype === 'hanzo_mail' || lastAction?.subtype === 'email') output = 'Email digest'
  else if (lastAction?.subtype === 'crm_update') output = 'CRM update'
  else if (lastAction?.subtype === 'hanzo_post') output = 'Channel post'

  return {
    trigger,
    inputs,
    connections: [...connSet],
    output,
    stepCount: runnable.length,
  }
}

export function instantiateTemplate(template: FlowTemplate, customName?: string): FlowDefinition {
  const now = new Date().toISOString()
  return {
    id: createFlowId(),
    name: customName ?? template.name,
    description: template.description,
    status: 'active',
    templateId: template.id,
    nodes: template.nodes.map((n) => ({
      ...n,
      position: { ...n.position },
      config: { ...n.config },
    })),
    edges: template.edges.map((e) => ({ ...e })),
    schedule: template.schedule ? { ...template.schedule } : undefined,
    createdAt: now,
    updatedAt: now,
  }
}

export function createBlankFlow(name = 'Untitled flow'): FlowDefinition {
  const now = new Date().toISOString()
  return {
    id: createFlowId(),
    name,
    description: 'Visual workflow powered by Hanzo Enso.',
    status: 'draft',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'chat_input',
        title: 'Chat Input',
        description: 'Receives messages from Playground or API triggers',
        position: { x: 64, y: 128 },
        config: { sampleInput: 'Hello from Hanzo Flow' },
      },
      {
        id: 'n2',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Agent',
        description: 'Processes input with Hanzo Enso',
        position: { x: 384, y: 128 },
        config: {
          model: 'enso',
          systemPrompt: 'You are a concise Hanzo automation agent.',
          prompt: '{{input}}',
          temperature: 0.3,
        },
      },
      {
        id: 'n3',
        kind: 'action',
        subtype: 'chat_output',
        title: 'Chat Output',
        description: 'Streams output back into Playground',
        position: { x: 704, y: 128 },
        config: { message: '{{input}}' },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ],
    createdAt: now,
    updatedAt: now,
  }
}

export function seedInitialFlows(): FlowDefinition[] {
  const pokedex = FLOW_TEMPLATES.find((t) => t.id === 'pokedex-agent') ?? FLOW_TEMPLATES[0]!
  const basic = FLOW_TEMPLATES.find((t) => t.id === 'basic-prompting') ?? FLOW_TEMPLATES[1]!
  const scheduled =
    FLOW_TEMPLATES.find((t) => t.id === 'scheduled-intelligence-brief') ?? FLOW_TEMPLATES[FLOW_TEMPLATES.length - 2]!
  return [instantiateTemplate(pokedex), instantiateTemplate(basic), instantiateTemplate(scheduled)]
}
