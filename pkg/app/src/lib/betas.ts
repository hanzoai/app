/**
 * The apps and models in beta: every Hanzo app or model that exists or is
 * announced and that the Hanzo app does not offer everyone yet, once, for every
 * list that names them —
 * the app's Betas list (Betas.tsx) and hanzo.ai/beta's.
 *
 * Each is a principal switch on the cloud, `beta.<id>` (hanzo-inc/cloud
 * apps/flags betas.go carries the same ids), decided per caller: a SuperAdmin
 * grants one to a person from their CRM record. `opens` is the one predicate a
 * caller asks of that answer.
 *
 * `href` is where the app opens once granted: its own host, or its page in the
 * page on the developer platform. An app with none is not built yet as an app; asking for it says you
 * want it.
 *
 * Only what no one has today: nothing hanzo.ai or platform.hanzo.ai already
 * offers every user is listed here, so no switch hides anything a person has.
 *
 * A `line` is authored English, written through phrase() and drawn through `t`;
 * a `name` is the app's name and is never translated.
 */

import { phrase } from '@hanzo/i18n'
import { CHANGED } from './optin'
import { home, named, orgs, superAdmin } from './session'

export const GROUPS = ['Business', 'Data', 'Agents', 'Build & run', 'Security', 'Creative', 'Models'] as const

export type Group = (typeof GROUPS)[number]

/**
 * How an app draws inside the Hanzo app, at /apps/<id>: its own live host in a
 * frame (`href`, with `?embed=1`), so a deploy of the standalone app reaches
 * hanzo.ai with no release here. A row may later name a module the app exports
 * instead (`mount`); nothing reads it yet.
 */
export type Embed = 'frame' | { mount: string }

export interface Beta {
  /** Stable, lowercase, one word: the switch is `beta.<id>`. */
  id: string
  name: string
  /** What it is, in one line: authored English, drawn through `t`. */
  line: string
  group: Group
  /** Where it opens once granted; absent while it is not built as an app. */
  href?: string
  /** Drawn inside the app as well, once granted (lib/hosted). */
  embed?: Embed
}

/** The developer platform, where a module in beta opens at its own address for anyone who has it. */
const PLATFORM = 'https://platform.hanzo.ai'

export const BETAS: readonly Beta[] = [
  { id: 'crm', name: 'CRM', line: phrase('Companies, contacts and deals, per org'), group: 'Business', href: 'https://crm.hanzo.ai/', embed: 'frame' },
  { id: 'erp', name: 'ERP', line: phrase('Items, sales, purchasing, accounting and HR'), group: 'Business', href: `${PLATFORM}/erp` },
  { id: 'commerce', name: 'Commerce', line: phrase('Catalog, cart, checkout and orders'), group: 'Business', href: 'https://commerce-admin.hanzo.ai/admin/', embed: 'frame' },
  { id: 'books', name: 'Books', line: phrase('Chart of accounts, ledger and bank reconciliation'), group: 'Business' },
  { id: 'finance', name: 'Finance', line: phrase('One ledger for your money operations'), group: 'Business', href: 'https://finance.hanzo.ai' },
  { id: 'treasury', name: 'Treasury & Ledger', line: phrase('Reserves, payouts and a double-entry journal'), group: 'Business' },
  { id: 'dataroom', name: 'Data Room', line: phrase('Share documents and see who opened them'), group: 'Business', href: 'https://dataroom.hanzo.ai' },
  { id: 'sign', name: 'Sign', line: phrase('Send a PDF, get it signed, keep the record'), group: 'Business', href: 'https://esign.hanzo.ai' },
  { id: 'company', name: 'Company', line: phrase('Formation, documents and filings'), group: 'Business', href: `${PLATFORM}/company` },
  { id: 'cms', name: 'CMS', line: phrase('Pages, posts, media and navigation'), group: 'Business', href: 'https://cms.hanzo.ai/admin', embed: 'frame' },
  { id: 'helpdesk', name: 'Help Center', line: phrase('Tickets, teams and SLAs'), group: 'Business', href: 'https://hanzo.help' },
  { id: 'marketing', name: 'Marketing', line: phrase('Campaigns, audiences and email sequences'), group: 'Business', href: 'https://marketing.hanzo.ai' },
  { id: 'ads', name: 'Ads', line: phrase('Paid campaigns, launched and paused in one place'), group: 'Business', href: 'https://ads.hanzo.ai' },
  { id: 'social', name: 'Social', line: phrase('Schedule posts across your social accounts'), group: 'Business', href: 'https://social.hanzo.ai' },
  { id: 'tel', name: 'Telecom', line: phrase('Phone numbers, calls and messages'), group: 'Business', href: `${PLATFORM}/tel` },
  { id: 'risk', name: 'Risk', line: phrase('AML monitoring and fraud on one engine'), group: 'Business', href: 'https://aml.hanzo.ai' },
  { id: 'idv', name: 'Identity Verification', line: phrase('KYC, KYB and AML vendors behind one interface'), group: 'Business' },

  { id: 'base', name: 'Base', line: phrase('Data, users, files and live updates per org'), group: 'Data', href: 'https://base.hanzo.ai' },
  { id: 'analytics', name: 'Analytics', line: phrase('Privacy-first product analytics'), group: 'Data', href: 'https://analytics.hanzo.ai', embed: 'frame' },
  { id: 'insights', name: 'Insights', line: phrase('Funnels, session replay, flags and experiments'), group: 'Data', href: 'https://insights.hanzo.ai', embed: 'frame' },
  { id: 'search', name: 'Search', line: phrase('Keyword and meaning in one query'), group: 'Data', href: `${PLATFORM}/search` },
  { id: 'world', name: 'World', line: phrase('A live map of every model and AI workload'), group: 'Data', href: 'https://world.hanzo.ai' },
  { id: 'crawl', name: 'Crawl', line: phrase('Turn a website into clean Markdown'), group: 'Data', href: `${PLATFORM}/crawl` },
  { id: 'notebook', name: 'Notebook', line: phrase('Shared live Python, R and SQL notebooks connected to Hanzo Science agents'), group: 'Data', href: '/science?view=notebook' },
  { id: 'workspace', name: 'Google Workspace', line: phrase('Drive, Docs, Sheets, Gmail and Calendar for the assistant, read and write'), group: 'Data' },

  { id: 'science', name: 'Science', line: phrase('AI research workbench for multi-agent literature review, auditable figures and live notebooks'), group: 'Agents', href: '/science?workbench=1' },
  { id: 'flow', name: 'Flow', line: phrase('Visual node-graph canvas for agents, RAG pipelines and workflows'), group: 'Agents', href: '/flow' },
  { id: 'operative', name: 'Operative', line: phrase('A desktop in a container, driven by a model'), group: 'Agents' },
  { id: 'tasks', name: 'Tasks', line: phrase('Durable execution for long-running work'), group: 'Agents', href: `${PLATFORM}/tasks` },

  { id: 'functions', name: 'Functions', line: phrase('Serverless functions, no servers to run'), group: 'Build & run', href: `${PLATFORM}/functions` },
  { id: 'visor', name: 'Visor', line: phrase('Provision and watch VMs and bare metal'), group: 'Build & run', href: 'https://visor.hanzo.ai' },
  { id: 'edge', name: 'Edge', line: phrase('Compute close to your users'), group: 'Build & run', href: `${PLATFORM}/edge` },
  { id: 'registry', name: 'Registry', line: phrase('A container registry signed in with Hanzo'), group: 'Build & run', href: `${PLATFORM}/registry` },
  { id: 'ci', name: 'CI', line: phrase('From source to a signed image'), group: 'Build & run', href: 'https://ci.hanzo.ai' },

  { id: 'kms', name: 'KMS', line: phrase('Secrets held per org, never in code'), group: 'Security', href: 'https://kms.hanzo.ai' },
  { id: 'guard', name: 'Guard', line: phrase('Stops prompt injection and leaks in model calls'), group: 'Security' },
  { id: 'sentinel', name: 'Sentinel', line: phrase('Errors and slow requests, caught early'), group: 'Security', href: 'https://sentry.hanzo.ai' },
  { id: 'authz', name: 'Authz', line: phrase('Fine-grained authorization, Zanzibar style'), group: 'Security', href: `${PLATFORM}/authz` },
  { id: 'hsm', name: 'HSM', line: phrase('Hardware-backed keys across cloud KMSs'), group: 'Security', href: `${PLATFORM}/hsm` },

  { id: 'studio', name: 'Studio', line: phrase('AI cinema director, camera motion rig and multi-shot timeline'), group: 'Creative', href: '/studio' },
  { id: 'koma', name: 'Koma', line: phrase('Cinematic video with character continuity and shot-level control'), group: 'Creative' },
  { id: 'iro', name: 'Iro', line: phrase('High-fidelity images, creative direction and consistent visual assets'), group: 'Creative' },
  { id: 'mori', name: 'Mori', line: phrase('3D assets, materials, environments and spatially consistent scenes'), group: 'Creative' },
  { id: 'oto', name: 'Oto', line: phrase('Sound effects and Foley for film and games'), group: 'Creative' },
  { id: 'koe', name: 'Koe', line: phrase('Directable speech, character performances and dubbing'), group: 'Creative' },
  { id: 'uta', name: 'Uta', line: phrase('Soundtracks, original songs and cue-driven scoring'), group: 'Creative' },

  { id: 'zen7', name: 'Zen 7', line: phrase('The next Zen, in research preview: no public weights yet'), group: 'Models' },
]

/** The switch of one app in beta. */
export const key = (id: string): string => `beta.${id}`

/**
 * THE predicate: whether a reader may open the app `id`. `flags` is what
 * GET /v1/flag/platform answered for them; `sudo` is a SuperAdmin (who sees every
 * app) or a page served off a developer's own machine. Nothing else opens one.
 */
export const opens = (id: string, flags: Record<string, boolean>, sudo: boolean, local = false): boolean => {
  const override = getAdminBetaFlag(id)
  if (override !== null) return override
  const all = getAdminBetaAll()
  if (all === 'on') return true
  if (all === 'off') return false
  if (flags?.[key(id)] === true) return true
  if (local) return true
  if ((id === 'science' || id === 'notebook') && hanzoAdmin()) return true
  if (id === 'studio' || id === 'flow') return false
  return Boolean(sudo || hanzoAdmin())
}

const ADMIN_BETA_ALL_KEY = 'hz_beta_admin_all'
const ADMIN_BETA_FLAG_PREFIX = 'hz_beta_admin_flag_'
const HANZO_ADMIN_ORGS = new Set(['admin', 'hanzo', 'hanzoai', 'hanzo-inc', 'hanzo-apps', 'platform'])

export function hanzoAdmin(): boolean {
  if (typeof window === 'undefined') return false
  if (superAdmin()) return true
  const h = home()
  if (h && HANZO_ADMIN_ORGS.has(h.toLowerCase())) return true
  for (const o of orgs()) {
    if (HANZO_ADMIN_ORGS.has(o.toLowerCase())) return true
  }
  const email = (named()?.email ?? '').trim().toLowerCase()
  if (email.endsWith('@hanzo.ai') || email.endsWith('@hanzo.team') || email.endsWith('@hanzo.inc')) return true
  return false
}

export function getAdminBetaAll(): 'on' | 'off' | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(ADMIN_BETA_ALL_KEY)
    return v === 'on' || v === 'off' ? v : null
  } catch {
    return null
  }
}

export function setAdminBetaAll(val: 'on' | 'off' | null): void {
  if (typeof window === 'undefined') return
  try {
    if (val === null) window.localStorage.removeItem(ADMIN_BETA_ALL_KEY)
    else window.localStorage.setItem(ADMIN_BETA_ALL_KEY, val)
    for (const b of BETAS) {
      window.localStorage.removeItem(`${ADMIN_BETA_FLAG_PREFIX}${b.id}`)
    }
    window.dispatchEvent(new CustomEvent(CHANGED))
  } catch {}
}

export function getAdminBetaFlag(id: string): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(`${ADMIN_BETA_FLAG_PREFIX}${id}`)
    return v === '1' ? true : v === '0' ? false : null
  } catch {
    return null
  }
}

export function setAdminBetaFlag(id: string, enabled: boolean | null): void {
  if (typeof window === 'undefined') return
  try {
    if (enabled === null) window.localStorage.removeItem(`${ADMIN_BETA_FLAG_PREFIX}${id}`)
    else window.localStorage.setItem(`${ADMIN_BETA_FLAG_PREFIX}${id}`, enabled ? '1' : '0')
    window.dispatchEvent(new CustomEvent(CHANGED))
  } catch {}
}
