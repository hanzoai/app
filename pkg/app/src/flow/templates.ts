import { createFlowId, type FlowDefinition, type FlowEdge, type FlowNode, type FlowSchedule } from './types'

export interface FlowTemplate {
  id: string
  name: string
  category: 'Agents' | 'Scheduled' | 'Webhooks' | 'CRM'
  description: string
  schedule?: FlowSchedule
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export const FLOW_TEMPLATES: readonly FlowTemplate[] = [
  {
    id: 'ai-agent',
    name: 'AI Agent Pipeline',
    category: 'Agents',
    description: 'Accepts a trigger payload, runs an Enso AI agent to synthesize a structured action plan, checks confidence, and dispatches a webhook.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'manual',
        title: 'Input brief',
        description: 'Manual run or API trigger payload',
        position: { x: 40, y: 96 },
        config: {
          sampleInput: 'Summarize top 3 customer onboarding blockers from this week and draft a quick-win action plan.',
        },
      },
      {
        id: 'n2',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Strategist',
        description: 'Synthesizes brief with Enso auto-routing',
        position: { x: 336, y: 96 },
        config: {
          model: 'enso',
          systemPrompt: 'You are an operations strategist at Hanzo. Reply with 3 concise bullet points and one immediate owner action.',
          prompt: 'Brief:\n{{input}}',
          temperature: 0.3,
        },
      },
      {
        id: 'n3',
        kind: 'condition',
        subtype: 'if_condition',
        title: 'Output non-empty',
        description: 'Verifies agent produced actionable text',
        position: { x: 632, y: 96 },
        config: {
          expression: 'non-empty',
        },
      },
      {
        id: 'n4',
        kind: 'action',
        subtype: 'webhook_send',
        title: 'Post to team webhook',
        description: 'Sends summary payload downstream',
        position: { x: 928, y: 96 },
        config: {
          method: 'POST',
          url: 'https://api.hanzo.ai/v1/workflow/hooks/ops',
          message: '{{input}}',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4', label: 'pass' },
    ],
  },
  {
    id: 'scheduled-brief',
    name: 'Scheduled Research Brief',
    category: 'Scheduled',
    description: 'Wakes up weekday mornings, compiles a concise market & engineering brief via Enso Research Agent, and emails the digest.',
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
        position: { x: 40, y: 96 },
        config: {
          cron: '0 8 * * 1-5',
          timezone: 'UTC',
          sampleInput: 'Daily AI infrastructure and open-model release digest',
        },
      },
      {
        id: 'n2',
        kind: 'agent',
        subtype: 'research_agent',
        title: 'Enso Research Brief',
        description: 'Drafts executive morning summary',
        position: { x: 352, y: 96 },
        config: {
          model: 'enso-pro',
          systemPrompt: 'Write a crisp morning intelligence brief with sections: Key Signals, Risks, Recommended Action.',
          prompt: 'Topic: {{input}}\nProduce today’s brief.',
          temperature: 0.25,
        },
      },
      {
        id: 'n3',
        kind: 'action',
        subtype: 'email',
        title: 'Send email digest',
        description: 'Delivers brief to workspace inbox',
        position: { x: 664, y: 96 },
        config: {
          to: 'team@hanzo.ai',
          subject: 'Morning Research Brief',
          message: '{{input}}',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ],
  },
  {
    id: 'webhook-automation',
    name: 'Webhook Automation',
    category: 'Webhooks',
    description: 'Receives inbound webhook events, classifies urgency with Enso, routes high-priority incidents to SMS and standard events to HTTP.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'webhook',
        title: 'Inbound webhook',
        description: 'POST /v1/workflow/hooks/inbound',
        position: { x: 40, y: 120 },
        config: {
          sampleInput: '{"source":"alertmanager","severity":"urgent","service":"gateway","message":"p99 latency above 1200ms"}',
        },
      },
      {
        id: 'n2',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Triage Agent',
        description: 'Classifies event severity and recommends remediation',
        position: { x: 336, y: 120 },
        config: {
          model: 'enso',
          systemPrompt: 'Classify the webhook event as URGENT or NORMAL and provide a one-sentence remediation note.',
          prompt: 'Event payload:\n{{input}}',
          temperature: 0.1,
        },
      },
      {
        id: 'n3',
        kind: 'condition',
        subtype: 'if_condition',
        title: 'Is urgent?',
        description: 'Checks whether triage marked URGENT',
        position: { x: 632, y: 120 },
        config: {
          expression: 'contains:urgent',
        },
      },
      {
        id: 'n4',
        kind: 'action',
        subtype: 'sms',
        title: 'Send SMS alert',
        description: 'Pages on-call via Hanzo Telecom',
        position: { x: 928, y: 120 },
        config: {
          to: '+15550109900',
          message: '[Flow Alert] {{input}}',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4', label: 'urgent' },
    ],
  },
  {
    id: 'crm-followup',
    name: 'CRM Follow-Up',
    category: 'CRM',
    description: 'Triggered when a new lead or deal updates, drafts a tailored follow-up with Enso, logs a CRM note, and queues outreach.',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'event',
        title: 'CRM lead created',
        description: 'Fires on new contact or deal stage change',
        position: { x: 40, y: 96 },
        config: {
          sampleInput: '{"contact":"Elena Vance","company":"Northstar Robotics","stage":"qualified","need":"Dedicated GPU cluster + Flow automation"}',
        },
      },
      {
        id: 'n2',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso Outreach Writer',
        description: 'Drafts personalized, concise follow-up email',
        position: { x: 336, y: 96 },
        config: {
          model: 'zen6',
          systemPrompt: 'Draft a warm, direct 4-sentence B2B follow-up email referencing the prospect’s exact need and proposing a 15-minute call.',
          prompt: 'Prospect record:\n{{input}}',
          temperature: 0.4,
        },
      },
      {
        id: 'n3',
        kind: 'action',
        subtype: 'crm_update',
        title: 'Log CRM activity',
        description: 'Saves follow-up draft to contact timeline',
        position: { x: 632, y: 96 },
        config: {
          crmEntity: 'contact',
          crmAction: 'upsert_note',
          message: '{{input}}',
        },
      },
      {
        id: 'n4',
        kind: 'action',
        subtype: 'email',
        title: 'Send follow-up email',
        description: 'Delivers approved outreach message',
        position: { x: 928, y: 96 },
        config: {
          to: 'elena@northstar.example',
          subject: 'Next steps with Hanzo',
          message: '{{input}}',
        },
      },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
      { id: 'e3', source: 'n3', target: 'n4' },
    ],
  },
]

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
    description: 'Visual workflow powered by Enso.',
    status: 'draft',
    nodes: [
      {
        id: 'n1',
        kind: 'trigger',
        subtype: 'manual',
        title: 'Manual trigger',
        description: 'Start this flow on demand or via API',
        position: { x: 48, y: 112 },
        config: { sampleInput: 'Hello from Hanzo Flow' },
      },
      {
        id: 'n2',
        kind: 'agent',
        subtype: 'enso_agent',
        title: 'Enso AI agent',
        description: 'Process the trigger input',
        position: { x: 352, y: 112 },
        config: {
          model: 'enso',
          systemPrompt: 'You are a concise Hanzo automation agent.',
          prompt: '{{input}}',
          temperature: 0.3,
        },
      },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    createdAt: now,
    updatedAt: now,
  }
}

export function seedInitialFlows(): FlowDefinition[] {
  return [
    instantiateTemplate(FLOW_TEMPLATES[0]!),
    instantiateTemplate(FLOW_TEMPLATES[1]!),
  ]
}
