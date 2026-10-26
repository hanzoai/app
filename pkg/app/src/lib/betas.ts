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

export const GROUPS = ['Business', 'Data', 'Agents', 'Build & run', 'Security', 'Creative', 'Models'] as const

export type Group = (typeof GROUPS)[number]

export interface Beta {
  /** Stable, lowercase, one word: the switch is `beta.<id>`. */
  id: string
  name: string
  /** What it is, in one line: authored English, drawn through `t`. */
  line: string
  group: Group
  /** Where it opens once granted; absent while it is not built as an app. */
  href?: string
}

/** The developer platform, where a module in beta opens at its own address for anyone who has it. */
const PLATFORM = 'https://platform.hanzo.ai'

export const BETAS: readonly Beta[] = [
  { id: 'crm', name: 'CRM', line: phrase('Companies, contacts and deals, per org'), group: 'Business', href: `${PLATFORM}/crm` },
  { id: 'erp', name: 'ERP', line: phrase('Items, sales, purchasing, accounting and HR'), group: 'Business', href: `${PLATFORM}/erp` },
  { id: 'commerce', name: 'Commerce', line: phrase('Catalog, cart, checkout and orders'), group: 'Business', href: 'https://commerce-admin.hanzo.ai/admin' },
  { id: 'books', name: 'Books', line: phrase('Chart of accounts, ledger and bank reconciliation'), group: 'Business' },
  { id: 'finance', name: 'Finance', line: phrase('One ledger for your money operations'), group: 'Business', href: 'https://finance.hanzo.ai' },
  { id: 'treasury', name: 'Treasury & Ledger', line: phrase('Reserves, payouts and a double-entry journal'), group: 'Business' },
  { id: 'dataroom', name: 'Data Room', line: phrase('Share documents and see who opened them'), group: 'Business', href: 'https://dataroom.hanzo.ai' },
  { id: 'sign', name: 'Sign', line: phrase('Send a PDF, get it signed, keep the record'), group: 'Business', href: 'https://esign.hanzo.ai' },
  { id: 'company', name: 'Company', line: phrase('Formation, documents and filings'), group: 'Business', href: `${PLATFORM}/company` },
  { id: 'cms', name: 'CMS', line: phrase('Pages, posts, media and navigation'), group: 'Business', href: 'https://cms.hanzo.ai/admin' },
  { id: 'helpdesk', name: 'Help Center', line: phrase('Tickets, teams and SLAs'), group: 'Business', href: 'https://hanzo.help' },
  { id: 'marketing', name: 'Marketing', line: phrase('Campaigns, audiences and email sequences'), group: 'Business', href: 'https://marketing.hanzo.ai' },
  { id: 'ads', name: 'Ads', line: phrase('Paid campaigns, launched and paused in one place'), group: 'Business', href: 'https://ads.hanzo.ai' },
  { id: 'social', name: 'Social', line: phrase('Schedule posts across your social accounts'), group: 'Business', href: 'https://social.hanzo.ai' },
  { id: 'tel', name: 'Telecom', line: phrase('Phone numbers, calls and messages'), group: 'Business', href: `${PLATFORM}/tel` },
  { id: 'risk', name: 'Risk', line: phrase('AML monitoring and fraud on one engine'), group: 'Business', href: 'https://aml.hanzo.ai' },
  { id: 'idv', name: 'Identity Verification', line: phrase('KYC, KYB and AML vendors behind one interface'), group: 'Business' },

  { id: 'base', name: 'Base', line: phrase('Data, users, files and live updates per org'), group: 'Data', href: 'https://base.hanzo.ai' },
  { id: 'analytics', name: 'Analytics', line: phrase('Privacy-first product analytics'), group: 'Data', href: 'https://analytics.hanzo.ai' },
  { id: 'insights', name: 'Insights', line: phrase('Funnels, session replay, flags and experiments'), group: 'Data', href: 'https://insights.hanzo.ai' },
  { id: 'search', name: 'Search', line: phrase('Keyword and meaning in one query'), group: 'Data', href: `${PLATFORM}/search` },
  { id: 'world', name: 'World', line: phrase('A live map of every model and AI workload'), group: 'Data', href: 'https://world.hanzo.ai' },
  { id: 'crawl', name: 'Crawl', line: phrase('Turn a website into clean Markdown'), group: 'Data', href: `${PLATFORM}/crawl` },

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
export const opens = (id: string, flags: Record<string, boolean>, sudo: boolean): boolean => sudo || flags[key(id)] === true
