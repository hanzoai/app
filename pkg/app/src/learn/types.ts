/**
 * Canonical schema, route parsing, progress store, and domain types for
 * Hanzo University (`/learn` and `/learn/:slug`).
 */

export type SchoolId =
  | 'foundation'
  | 'intelligence'
  | 'science'
  | 'cybersecurity'
  | 'business'

export type CertificationTrackId =
  | 'cert-decision-ai'
  | 'cert-model-eng'
  | 'cert-autonomous-science'
  | 'cert-defensive-cyber'
  | 'cert-business-autopilot'
  | 'cert-ai-founder'

export type AdventureGoalId =
  | 'decision-service'
  | 'custom-model'
  | 'autonomous-science'
  | 'defensive-security'
  | 'business-autopilot'
  | 'ai-company'

export type CourseDifficulty = 'Foundation' | 'Intermediate' | 'Advanced' | 'Capstone'

export type CourseLabKind = 'kai-301' | 'science' | 'entrepreneurship' | 'standard'

export type CourseTabId =
  | 'overview'
  | 'lectures'
  | 'reading'
  | 'experiments'
  | 'terminal'
  | 'results'
  | 'capstone'

export const COURSE_TABS: readonly CourseTabId[] = [
  'overview',
  'lectures',
  'reading',
  'experiments',
  'terminal',
  'results',
  'capstone',
]

export const COURSE_TAB_LABELS: Record<CourseTabId, string> = {
  overview: 'Overview',
  lectures: 'Lectures',
  reading: 'Reading',
  experiments: 'Experiments',
  terminal: 'Lab Terminal',
  results: 'Results',
  capstone: 'Capstone',
}

export type FacultyBotId = 'edu' | 'sci' | 'dev' | 'cyber' | 'data' | 'doc' | 'qa' | 'lang'

export type LearnSectionView = 'launchpad' | 'adventure' | 'startup' | 'catalog'

export interface LearnRouteState {
  slug: string | null
  tab: CourseTabId
  section: LearnSectionView
  schoolFilter: SchoolId | 'all'
}

export interface CourseLecture {
  id: string
  number: number
  title: string
  duration: string
  summary: string
  topics: readonly string[]
  concepts: readonly string[]
}

export interface CourseReadingGuide {
  title: string
  url: string
  summary: string
  tag: string
}

export interface CourseLabStep {
  id: string
  stepNumber: number
  title: string
  objective: string
  endpoint?: string
  snippetLanguage: 'bash' | 'json' | 'typescript' | 'python'
  snippet: string
  verificationHint: string
}

export interface CourseSpec {
  slug: string
  code: string
  title: string
  school: SchoolId
  schoolName: string
  difficulty: CourseDifficulty
  duration: string
  pricingTier: string
  isFree: boolean
  summary: string
  architectureFit: string
  prerequisites: readonly string[]
  objectives: readonly string[]
  capstoneDeliverable: string
  defaultFaculty: FacultyBotId
  certificationTracks: readonly CertificationTrackId[]
  docsGuides: readonly CourseReadingGuide[]
  lectures: readonly CourseLecture[]
  labKind: CourseLabKind
  labSteps: readonly CourseLabStep[]
  sandboxCommands: readonly { label: string; command: string }[]
}

export interface SchoolMeta {
  id: SchoolId
  name: string
  shortName: string
  tagline: string
  deanBot: FacultyBotId
}

export interface CertificationTrack {
  id: CertificationTrackId
  name: string
  badgeCode: string
  summary: string
  requiredSlugs: readonly string[]
  capstoneSlug: string
  estimatedHours: number
}

export interface AdventureGoal {
  id: AdventureGoalId
  title: string
  subtitle: string
  stackTag: string
  starterSlug: string
  coreSlugs: readonly string[]
  certificationId: CertificationTrackId
  firstLabSlug: string
  docsLinks: readonly { title: string; url: string }[]
}

export interface StartupBuilderStage {
  id: string
  stageNumber: number
  title: string
  summary: string
  actionLabel: string
  actionHref: string
  actionExternal?: boolean
  secondaryLabel?: string
  secondaryHref?: string
  secondaryExternal?: boolean
  deliverable: string
}

export interface StartupBuilderConfig {
  companyName: string
  vertical: string
  architecture: 'kai-decisions' | 'zen-model' | 'enso-orchestrator' | 'hybrid-full-stack'
  customDomain: string
  completedStages: string[]
}

export interface FacultyBot {
  id: FacultyBotId
  handle: string
  name: string
  role: string
  specialty: string
  avatar: string
  quickPrompts: readonly string[]
  systemStyle: string
}

export interface CapstoneSubmission {
  datasetManifest: string
  evalMetrics: string
  artifactRef: string
  regressionReport: string
  preregisteredMet: boolean
  regressionFree: boolean
  submittedAt?: string
}

export interface CourseProgress {
  enrolledAt?: string
  completedLectures: string[]
  completedLabSteps: string[]
  kaiChecklist: string[]
  capstone?: CapstoneSubmission
  updatedAt: string
}

export interface LearnProgressStore {
  version: 1
  selectedGoal: AdventureGoalId
  courses: Record<string, CourseProgress>
  startup: StartupBuilderConfig
}

export interface KaiPlaygroundResult {
  endpoint: string
  ok: boolean
  status: number
  latencyMs: number
  body: unknown
  error?: string
  ranAt: string
}

export interface SandboxSessionState {
  id: string
  label: string
  zap: string
  sandbox?: string
  courseSlug: string
  createdAt: string
}

export interface ScienceComparisonRow {
  id: string
  metric: string
  baseline: number
  candidate: number
  thresholdDelta: number
  unit: string
  higherIsBetter: boolean
  nSamples: number
  passed: boolean
  source: 'live' | 'preview'
}

export interface FacultyMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  botId: FacultyBotId
  createdAt: string
  error?: string
}

export function learnPath(
  slug?: string | null,
  params?: Record<string, string | null | undefined>,
): string {
  const clean = (slug ?? '').trim().replace(/^\/+|\/+$/g, '')
  const base = clean ? `/learn/${encodeURIComponent(clean)}` : '/learn'
  if (!params) return base
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v)
  }
  const q = qs.toString()
  return q ? `${base}?${q}` : base
}

const VALID_TABS = new Set<string>(COURSE_TABS)
const VALID_SECTIONS = new Set<string>(['launchpad', 'adventure', 'startup', 'catalog'])
const VALID_SCHOOLS = new Set<string>(['foundation', 'intelligence', 'science', 'cybersecurity', 'business'])

export function parseLearnRoute(pathname: string, search = ''): LearnRouteState {
  const [rawPath = '/learn', embeddedQuery = ''] = pathname.split('?')
  const cleanPath = rawPath.replace(/\/+$/, '') || '/learn'
  const rawQuery = search || (embeddedQuery ? `?${embeddedQuery}` : '')
  const qs = new URLSearchParams(rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery)

  const tabParam = (qs.get('tab') ?? '').trim().toLowerCase()
  const viewParam = (qs.get('view') ?? '').trim().toLowerCase()
  const schoolParam = (qs.get('school') ?? '').trim().toLowerCase()

  let slug: string | null = null
  let tabFromPath = ''
  if (cleanPath.startsWith('/learn/')) {
    const rest = cleanPath.slice('/learn/'.length).split('/').filter(Boolean)
    if (rest[0]) {
      try {
        slug = decodeURIComponent(rest[0]).toLowerCase()
      } catch {
        slug = rest[0].toLowerCase()
      }
    }
    if (rest[1]) tabFromPath = rest[1].toLowerCase()
  }

  const candidateTab = tabParam || tabFromPath
  const tab: CourseTabId = VALID_TABS.has(candidateTab) ? (candidateTab as CourseTabId) : 'overview'
  const section: LearnSectionView = VALID_SECTIONS.has(viewParam)
    ? (viewParam as LearnSectionView)
    : 'launchpad'
  const schoolFilter: SchoolId | 'all' = VALID_SCHOOLS.has(schoolParam)
    ? (schoolParam as SchoolId)
    : 'all'

  return { slug, tab, section, schoolFilter }
}
