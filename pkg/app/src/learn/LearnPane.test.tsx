// @vitest-environment happy-dom
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const state = vi.hoisted(() => ({
  token: null as string | null,
  org: 'hanzo' as string | null,
  path: '/learn',
}))

type Part = {
  children?: ReactNode
  render?: ReactNode
  'data-slot'?: string
  'data-course-slug'?: string
  'aria-label'?: string
  value?: string
  placeholder?: string
  onClick?: () => void
  onPress?: () => void
}

const draw = ({ children, 'data-slot': slot, 'data-course-slug': slug, 'aria-label': label }: Part) =>
  createElement('div', { 'data-slot': slot, 'data-course-slug': slug, 'aria-label': label }, children)

vi.mock('@hanzo/i18n/react', () => ({ useI18n: () => ({ t: (s: string) => s }) }))
vi.mock('@hanzo/gui', () => ({ Text: draw, View: draw, XStack: draw, YStack: draw }))
vi.mock('@hanzo/ui', () => ({
  Button: ({ children, 'data-slot': slot }: Part) => createElement('button', { 'data-slot': slot }, children),
  Input: ({ value, 'data-slot': slot, placeholder }: Part) =>
    createElement('input', { 'data-slot': slot, defaultValue: value, placeholder }),
  Textarea: ({ value, 'data-slot': slot, placeholder }: Part) =>
    createElement('textarea', { 'data-slot': slot, defaultValue: value, placeholder }),
  Text: draw,
  toast: { success: () => {}, error: () => {} },
}))
vi.mock('../host', () => ({
  useHost: () => ({
    path: state.path,
    router: { push: () => {}, replace: () => {}, back: () => {}, forward: () => {} },
  }),
}))
vi.mock('../lib/session', () => ({
  bearer: () => state.token,
  org: () => state.org,
  named: () => (state.token ? { name: 'Ada Lovelace', display: 'Ada', email: 'ada@hanzo.ai' } : null),
  scope: () => (state.token ? { Authorization: `Bearer ${state.token}` } : {}),
}))
vi.mock('../pref', () => ({
  usePref: <T,>(_key: string, initial: T) => [initial, () => {}, true] as const,
}))

const { LearnPane } = await import('./LearnPane')
const { learnNav } = await import('./nav')

beforeEach(() => {
  state.token = null
  state.org = 'hanzo'
  state.path = '/learn'
  localStorage.clear()
})

describe('LearnPane rendering across signed-out preview, Course Workspace 7 tabs, and AI Faculty', () => {
  test('renders /learn signed-out preview with Choose Your Adventure, ENT 401 Startup Builder, and all 25 courses without crashing', () => {
    const html = renderToStaticMarkup(createElement(LearnPane, { path: '/learn' }))
    expect(html).toContain('data-slot="learn-pane"')
    expect(html).toContain('data-slot="learn-launchpad"')
    expect(html).toContain('data-slot="learn-signedout-banner"')
    expect(html).toContain('data-slot="learn-adventure-wizard"')
    expect(html).toContain('data-slot="adventure-goal-decision-service"')
    expect(html).toContain('data-slot="adventure-goal-ai-company"')
    expect(html).toContain('data-slot="ent-401-startup-builder"')
    expect(html).toContain('data-slot="learn-catalog"')
    expect(html).toContain('data-slot="course-card-continuous-improvement"')
    expect(html).toContain('data-slot="course-card-kai-training-decision-models"')
    expect(html).toContain('data-slot="course-card-build-your-ai-company"')
    expect(html).toContain('AUTO 101')
    expect(html).toContain('KAI 301')
    expect(html).toContain('ENT 401')
    expect(html).not.toContain('/api/')
  })

  test('renders signed-in /learn with IAM org strip instead of guest banner', () => {
    state.token = 'iam_tok_live'
    const html = renderToStaticMarkup(createElement(LearnPane, { path: '/learn' }))
    expect(html).toContain('data-slot="learn-org-strip"')
    expect(html).not.toContain('data-slot="learn-signedout-banner"')
  })

  test('renders KAI 301 7-tab Course Workspace with 9-step Lab 01, live API playground, calibration checklist, and 8-bot AI Faculty sidebar', () => {
    const html = renderToStaticMarkup(
      createElement(LearnPane, { path: '/learn/kai-training-decision-models?tab=experiments' }),
    )
    expect(html).toContain('data-slot="learn-course-workspace"')
    expect(html).toContain('data-course-slug="kai-training-decision-models"')
    for (const tab of ['overview', 'lectures', 'reading', 'experiments', 'terminal', 'results', 'capstone']) {
      expect(html).toContain(`data-slot="course-tab-${tab}"`)
    }
    expect(html).toContain('data-slot="kai-301-lab"')
    expect(html).toContain('Lab 01: Teach Kai your business')
    expect(html).toContain('data-slot="kai-step-9"')
    expect(html).toContain('data-slot="kai-live-playground"')
    expect(html).toContain('POST /v1/decisions')
    expect(html).toContain('data-slot="kai-calibration-checklist"')
    expect(html).toContain('data-slot="learn-faculty-sidebar"')
    for (const bot of ['edu', 'sci', 'dev', 'cyber', 'data', 'doc', 'qa', 'lang']) {
      expect(html).toContain(`data-slot="faculty-bot-${bot}"`)
    }
  })

  test('renders SCI 101 Science experiment comparison, ENT 401 startup builder, Lab Terminal, and Capstone W3C VC preview', () => {
    const sciHtml = renderToStaticMarkup(
      createElement(LearnPane, { path: '/learn/science-discovery?tab=experiments' }),
    )
    expect(sciHtml).toContain('data-slot="science-lab-panel"')
    expect(sciHtml).toContain('ILLUSTRATIVE BENCHMARK PREVIEW')
    expect(sciHtml).toContain('data-slot="science-jump-studies"')

    const entHtml = renderToStaticMarkup(
      createElement(LearnPane, { path: '/learn/build-your-ai-company?tab=experiments' }),
    )
    expect(entHtml).toContain('data-slot="ent-401-startup-builder"')
    expect(entHtml).toContain('data-slot="startup-stage-6"')

    const termHtml = renderToStaticMarkup(
      createElement(LearnPane, { path: '/learn/continuous-improvement?tab=terminal' }),
    )
    expect(termHtml).toContain('data-slot="learn-lab-terminal"')
    expect(termHtml).toContain('POST /v1/dev/sessions')

    const capHtml = renderToStaticMarkup(
      createElement(LearnPane, { path: '/learn/continuous-improvement?tab=capstone' }),
    )
    expect(capHtml).toContain('data-slot="course-panel-capstone"')
    expect(capHtml).toContain('data-slot="w3c-vc-preview"')
    expect(capHtml).toContain('Practical certification preview')
  })

  test('renders clean fallback for unknown course slug and contextual learnNav sidebar links', () => {
    const missing = renderToStaticMarkup(createElement(LearnPane, { path: '/learn/does-not-exist' }))
    expect(missing).toContain('data-slot="learn-course-not-found"')

    const moved: string[] = []
    const groups = learnNav(
      { slug: 'kai-training-decision-models', tab: 'experiments', section: 'launchpad', schoolFilter: 'all' },
      (to) => moved.push(to),
    )
    expect(groups).toHaveLength(2)
    expect(groups[0]!.links.map((l) => l.id)).toEqual(['new', 'launchpad', 'adventure', 'startup', 'catalog'])
    expect(groups[1]!.links.find((l) => l.id === 'course-kai-301')?.active).toBe(true)
    groups[0]!.links.find((l) => l.id === 'startup')?.onPress?.()
    expect(moved).toEqual(['/learn?view=startup'])
  })
})
