// SKILLS FOR A PERSON'S ROLE (hanzo-inc/app issue 323).
//
// A new customer says what they do (Director, Marketing, Education, …, or
// Something else, or skips), and Hanzo recommends a set of skills for that
// role. They untick any they don't want and add the rest in one click.
//
// THIS FILE IS THE ONE MAP. Each role's skills are names in the brand's
// catalogue (`GET /.well-known/agent-skills/index.json`, cloud
// apps/skills/catalog/hanzo), the skills Customize's Browse offers. Adding one
// switches on its tool `skill_<name>` for the org (`install` in connect.ts),
// the same write Customize and the `+` menu make. A name the catalogue stops
// carrying is left off the list where the tool plane is read (`listed`), so a
// stale entry here never offers a skill that cannot be added. To change a
// recommendation, edit the lists below; `SKILLS` gives each name the short
// label it is drawn with.
//
// The answer is the person's own, kept on their account (`ROLE_KEY` through
// usePref, `GET/PATCH /v1/pref`), so the card stops asking on every machine.

import { phrase } from '@hanzo/i18n'

/** Where the person's answer is kept: a role's id, `SKIP`, or '' while unanswered. */
export const ROLE_KEY = 'hanzo.onboarding.role'

/** The answer of a person who said no thanks. */
export const SKIP = 'skip'

/** How long an account counts as new, so the card asks it once and never an account that has been here for months. */
export const NEW_FOR = 14 * 24 * 60 * 60 * 1000

export interface Role {
  id: string
  /** Its name, marked for translation (`phrase`): drawn through `t`. */
  label: string
  /** One line under the name: what someone in this role does. */
  line: string
  /** The catalogue skills recommended for it, in the order they are listed. */
  skills: readonly string[]
}

/** Each recommended skill's label, in words a person reads: the catalogue's own names are API names (`marketing_campaigns`). */
export const SKILLS: Readonly<Record<string, string>> = {
  // Running a team or a company
  task_projects: phrase('Work boards'),
  task_issues: phrase('Issues across projects'),
  team_docs: phrase('Team documents'),
  guide_analytics: phrase('Growth funnel and advice'),
  guide_guide: phrase('Launch journey'),
  guide_suggest: phrase('Next steps for your business'),
  books_metrics: phrase('Revenue metrics'),
  books_pnl: phrase('Profit and loss'),
  company_company: phrase('Company formation'),
  captable_summary: phrase('Cap table'),
  legal_documents: phrase('Legal documents'),
  esign_documents: phrase('Documents to sign'),
  // Marketing
  marketing_campaigns: phrase('Marketing campaigns'),
  marketing_audiences: phrase('Audiences'),
  marketing_calendar: phrase('Marketing calendar'),
  marketing_lists: phrase('Contact lists'),
  campaign_metrics: phrase('Campaign results'),
  content_board: phrase('Content queue'),
  social_posts: phrase('Social posts'),
  post_analytics: phrase('Post engagement'),
  email_stats: phrase('Email results'),
  email_email: phrase('Sent email'),
  // Teaching, research and knowledge
  knowledge_files: phrase('Your files and notes'),
  knowledge_graph: phrase('Knowledge map'),
  research_projects: phrase('Research projects'),
  research_papers: phrase('Papers'),
  research_experiments: phrase('Experiments'),
  dataset_dataset: phrase('Datasets'),
  form_forms: phrase('Forms and quizzes'),
  meet_session: phrase('Video rooms'),
  websearch_search: phrase('Web search'),
  library_library: phrase('Library'),
  // Design and video
  studio_brands: phrase('Brand kits'),
  studio_documents: phrase('Documents and decks'),
  studio_templates: phrase('Design templates'),
  studio_flows: phrase('Creative flows'),
  studio_runs: phrase('Renders'),
  videos_videos: phrase('Video jobs'),
  // Building software
  project_project: phrase('Projects and sites'),
  project_deployments: phrase('Deploys'),
  git_repos: phrase('Repositories'),
  git_runs: phrase('Build runs'),
  code_search: phrase('Code search'),
  sandbox_sandbox: phrase('Sandboxes'),
  metrics_logs: phrase('Logs'),
  // Selling and support
  tel_calls: phrase('Calls'),
  tel_messages: phrase('Text messages'),
  commerce_product: phrase('Products'),
  help_articles: phrase('Help center articles'),
}

/** The roles offered, in the order they are drawn. */
export const ROLES: readonly Role[] = [
  {
    id: 'director',
    label: phrase('Director'),
    line: phrase('Lead a team, a department or a company'),
    skills: ['task_projects', 'task_issues', 'team_docs', 'guide_analytics', 'books_metrics', 'books_pnl'],
  },
  {
    id: 'marketing',
    label: phrase('Marketing'),
    line: phrase('Campaigns, content, social and email'),
    skills: ['marketing_campaigns', 'marketing_audiences', 'marketing_calendar', 'campaign_metrics', 'content_board', 'social_posts', 'post_analytics', 'email_stats'],
  },
  {
    id: 'education',
    label: phrase('Education'),
    line: phrase('Teach, train or study'),
    skills: ['knowledge_files', 'knowledge_graph', 'research_papers', 'studio_documents', 'form_forms', 'meet_session', 'websearch_search'],
  },
  {
    id: 'creative',
    label: phrase('Creative'),
    line: phrase('Design, video and brand'),
    skills: ['studio_brands', 'studio_documents', 'studio_templates', 'studio_flows', 'studio_runs', 'videos_videos', 'library_library'],
  },
  {
    id: 'founder',
    label: phrase('Founder'),
    line: phrase('Start, fund and run a company'),
    skills: ['company_company', 'guide_guide', 'guide_suggest', 'captable_summary', 'books_pnl', 'legal_documents', 'esign_documents'],
  },
  {
    id: 'developer',
    label: phrase('Developer'),
    line: phrase('Build and ship software'),
    skills: ['project_project', 'project_deployments', 'git_repos', 'git_runs', 'code_search', 'sandbox_sandbox', 'metrics_logs'],
  },
  {
    id: 'sales',
    label: phrase('Sales and support'),
    line: phrase('Customers, orders, calls and email'),
    skills: ['marketing_lists', 'email_email', 'tel_calls', 'tel_messages', 'commerce_product', 'help_articles'],
  },
  {
    id: 'research',
    label: phrase('Research and data'),
    line: phrase('Studies, datasets and sources'),
    skills: ['research_projects', 'research_papers', 'research_experiments', 'dataset_dataset', 'knowledge_files', 'websearch_search'],
  },
]

/** "Something else": a starting set that suits most work, for a role not listed. */
export const ELSE: Role = {
  id: 'else',
  label: phrase('Something else'),
  line: phrase('A starting set for any kind of work'),
  skills: ['websearch_search', 'library_library', 'knowledge_files', 'task_projects', 'team_docs'],
}

/** A role by its id, `ELSE` included; null for `SKIP`, '' or an id no longer offered. */
export function role(id: unknown): Role | null {
  if (typeof id !== 'string' || !id) return null
  if (id === ELSE.id) return ELSE
  return ROLES.find((r) => r.id === id) ?? null
}

/** Whether the person has answered (a role, Something else, or Skip). */
export const answered = (value: unknown): boolean => value === SKIP || role(value) !== null

/** The tool a skill is switched on by. */
export const tool = (name: string): string => `skill_${name}`

/** The skill a tool name switches, or '' when it is not a skill's. */
export const nameOf = (tool: string): string => (tool.startsWith('skill_') ? tool.slice('skill_'.length) : '')

/**
 * `r`'s skills the org can add: all of them until the tool plane has answered
 * (`plane` null), then only the ones it lists. A skill the catalogue no longer
 * carries is left out rather than offered and refused.
 */
export function listed(r: Role, plane: ReadonlySet<string> | null): string[] {
  return plane ? r.skills.filter((n) => plane.has(n)) : [...r.skills]
}

/**
 * What one click adds: the skills shown (`shown`), less the ones the person
 * unticked (`off`) and the ones already on for the org (`on`). Empty when
 * nothing is left to add.
 */
export function picked(shown: readonly string[], off: ReadonlySet<string>, on: ReadonlySet<string> = new Set()): string[] {
  return shown.filter((n) => !off.has(n) && !on.has(n))
}

/** Whether an account made at `joined` (IAM's createdTime) is new enough to be asked, at `now`. Unknown is not new; a time a skewed clock puts ahead is. */
export function fresh(joined: string | undefined, now: number = Date.now()): boolean {
  const at = joined ? Date.parse(joined) : Number.NaN
  return Number.isFinite(at) && now - at <= NEW_FOR
}

/** Every skill name the map recommends, once: what a check against the catalogue reads. */
export const recommended = (): string[] => [...new Set([...ROLES, ELSE].flatMap((r) => r.skills))]
