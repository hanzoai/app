'use client'

import { MARK_PATHS } from '@hanzo/logo/logos'
import {
  Bot,
  Braces,
  CalendarClock,
  Clock,
  Code2,
  Cpu,
  Database,
  FileText,
  Filter,
  FolderOpen,
  GitBranch,
  Globe,
  KeyRound,
  Layers,
  Mail,
  MessageSquare,
  Network,
  Radio,
  Repeat,
  Scissors,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Users,
  Variable,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { FlowNode, FlowNodeCategory, FlowNodeSubtype } from './types'

/** Canonical Hanzo block-H mark from `@hanzo/logo/logos`. */
export function HanzoMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 67 67"
      fill="currentColor"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: MARK_PATHS }}
    />
  )
}

export function iconForCategory(category: FlowNodeCategory): LucideIcon {
  switch (category) {
    case 'Input & Output':
      return MessageSquare
    case 'Data Sources':
      return Globe
    case 'Models & Agents':
      return Bot
    case 'LLM Operations':
      return Sparkles
    case 'Files & Knowledge':
      return FolderOpen
    case 'Processing':
      return Code2
    case 'Flow Control':
      return GitBranch
    case 'Utilities':
      return StickyNote
    case 'Hanzo':
      return Zap
  }
}

export function iconForSubtype(subtype: FlowNodeSubtype | Pick<FlowNode, 'subtype'>): LucideIcon {
  const s = typeof subtype === 'string' ? subtype : subtype.subtype
  switch (s) {
    case 'chat_input':
    case 'chat_output':
      return MessageSquare
    case 'text_input':
    case 'text_output':
    case 'text_parser':
      return FileText
    case 'webhook':
    case 'webhook_send':
      return Webhook
    case 'cron_schedule':
    case 'schedule':
      return CalendarClock
    case 'api_request':
    case 'http_request':
    case 'url_fetch':
      return Globe
    case 'web_search':
      return Search
    case 'sql_query':
    case 'hanzo_base':
    case 'vector_store':
      return Database
    case 'enso_agent':
    case 'research_agent':
      return Bot
    case 'language_model':
    case 'llm_prompt':
      return Cpu
    case 'structured_output':
    case 'json_transform':
      return Braces
    case 'multi_agent_supervisor':
      return Users
    case 'sub_flow':
      return Workflow
    case 'prompt_template':
      return Sparkles
    case 'embeddings':
    case 'embedding':
    case 'knowledge_ingestion':
    case 'knowledge_ingest':
    case 'knowledge_retrieval':
    case 'knowledge_search':
    case 'retriever':
      return Layers
    case 'reranker':
      return Filter
    case 'conversation_memory':
      return Network
    case 'guardrail':
    case 'human_approval':
      return ShieldCheck
    case 'file_loader':
      return FolderOpen
    case 'text_splitter':
      return Scissors
    case 'sandbox_code':
      return Code2
    case 'merge_combine':
      return Radio
    case 'if_condition':
    case 'switch_router':
    case 'router':
      return GitBranch
    case 'loop_batch':
      return Repeat
    case 'delay_wait':
      return Clock
    case 'sticky_note':
      return StickyNote
    case 'http_response':
    case 'hanzo_post':
    case 'sms':
      return Send
    case 'variable_store':
      return Variable
    case 'hanzo_enso_router':
      return Zap
    case 'hanzo_kms_secret':
      return KeyRound
    case 'hanzo_mail':
    case 'email':
      return Mail
    case 'crm_update':
      return Users
    default:
      return Zap
  }
}
