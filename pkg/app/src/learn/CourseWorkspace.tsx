'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Input, Text, Textarea } from '@hanzo/ui'
import {
  ArrowLeft,
  Award,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FlaskConical,
  LogIn,
  ShieldCheck,
} from 'lucide-react'
import { buildVerifiableCredentialPreview, verifyCapstoneSubmission } from './api'
import {
  CERTIFICATION_TRACKS,
  computeCourseCompletionPct,
  COURSE_BY_SLUG,
  UNIVERSITY_BASE,
} from './catalog'
import { FacultySidebar } from './FacultySidebar'
import { KaiLabPlayground } from './KaiLabPlayground'
import { LabTerminalTab, ScienceLabPanel, StandardLabPanel, StartupLabPanel } from './LabPanels'
import {
  COURSE_TABS,
  COURSE_TAB_LABELS,
  learnPath,
  type CapstoneSubmission,
  type CourseProgress,
  type CourseSpec,
  type CourseTabId,
  type KaiPlaygroundResult,
  type SandboxSessionState,
  type StartupBuilderConfig,
} from './types'

const EMPTY_CAPSTONE: CapstoneSubmission = {
  datasetManifest: '',
  evalMetrics: '',
  artifactRef: '',
  regressionReport: '',
  preregisteredMet: false,
  regressionFree: false,
}

export function CourseWorkspace({
  course,
  activeTab,
  progress,
  startupConfig,
  signedIn,
  holderName,
  orgId,
  onNavigate,
  onSignIn,
  onEnroll,
  onToggleLecture,
  onToggleLabStep,
  onToggleKaiChecklist,
  onSaveCapstone,
  onUpdateStartupConfig,
  onToggleStartupStage,
}: {
  course: CourseSpec
  activeTab: CourseTabId
  progress: CourseProgress | undefined
  startupConfig: StartupBuilderConfig
  signedIn: boolean
  holderName: string
  orgId: string | null
  onNavigate: (to: string) => void
  onSignIn: () => void
  onEnroll: () => void
  onToggleLecture: (lectureId: string) => void
  onToggleLabStep: (stepId: string) => void
  onToggleKaiChecklist: (checkId: string) => void
  onSaveCapstone: (submission: CapstoneSubmission) => void
  onUpdateStartupConfig: (patch: Partial<StartupBuilderConfig>) => void
  onToggleStartupStage: (stageId: string) => void
}) {
  const { t } = useI18n()
  const [facultyOpen, setFacultyOpen] = useState(true)
  const [expandedLectureId, setExpandedLectureId] = useState<string | null>(course.lectures[0]?.id ?? null)
  const [sandboxSession, setSandboxSession] = useState<SandboxSessionState | null>(null)
  const [kaiResults, setKaiResults] = useState<KaiPlaygroundResult[]>([])
  const [capstoneDraft, setCapstoneDraft] = useState<CapstoneSubmission>(
    () => progress?.capstone ?? EMPTY_CAPSTONE,
  )

  const completedLectures = progress?.completedLectures ?? []
  const completedLabSteps = progress?.completedLabSteps ?? []
  const kaiChecklist = progress?.kaiChecklist ?? []
  const enrolled = Boolean(progress?.enrolledAt)
  const completionPct = computeCourseCompletionPct(course, progress)

  const verification = useMemo(
    () => verifyCapstoneSubmission(course, capstoneDraft),
    [course, capstoneDraft],
  )

  const credentialPreview = useMemo(
    () => buildVerifiableCredentialPreview(course, capstoneDraft, holderName, orgId),
    [course, capstoneDraft, holderName, orgId],
  )

  const matchingCerts = useMemo(
    () => CERTIFICATION_TRACKS.filter((tr) => course.certificationTracks.includes(tr.id)),
    [course.certificationTracks],
  )

  const activeStepTitle = useMemo(() => {
    const firstPending = course.labSteps.find((s) => !completedLabSteps.includes(s.id))
    return firstPending ? `${firstPending.stepNumber}. ${firstPending.title}` : undefined
  }, [course.labSteps, completedLabSteps])

  const selectTab = (tab: CourseTabId) => {
    onNavigate(learnPath(course.slug, { tab }))
  }

  return (
    <YStack data-slot="learn-course-workspace" data-course-slug={course.slug} flex={1} minH={0} height="100%">
      {/* Course Header */}
      <YStack px="$4" py="$3" gap="$2.5" borderBottomWidth={1} borderColor="$edge" bg="var(--card)" shrink={0}>
        <XStack items="center" justify="space-between" gap="$2.5" flexWrap="wrap">
          <XStack items="center" gap="$2" flexWrap="wrap" flex={1} minW={220}>
            <Button size="sm" variant="ghost" data-slot="course-back" onPress={() => onNavigate(learnPath())}>
              <ArrowLeft size={14} aria-hidden />
              {t('All Courses')}
            </Button>
            <XStack px="$2" py="$0.5" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background">
              <Text fontSize="$1" fontFamily="$mono" fontWeight="600" color="$ink">
                {course.code}
              </Text>
            </XStack>
            <XStack px="$2" py="$0.5" rounded="$2" borderWidth={1} borderColor="$edge" bg="$raised">
              <Text fontSize="$1" fontFamily="$mono" color="$soft">
                {course.pricingTier} · {course.difficulty} · {course.duration}
              </Text>
            </XStack>
          </XStack>

          <XStack items="center" gap="$2" flexWrap="wrap">
            <XStack px="$2.5" py="$1" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background">
              <Text fontSize="$1" fontFamily="$mono" color="$ink" data-slot="course-progress-pct">
                {completionPct}% {t('complete')}
              </Text>
            </XStack>
            <Button
              size="sm"
              variant={facultyOpen ? 'outline' : 'primary'}
              data-slot="toggle-faculty-sidebar"
              onPress={() => setFacultyOpen((v) => !v)}
            >
              <Bot size={14} aria-hidden />
              {facultyOpen ? t('Hide AI Faculty') : t('Open AI Faculty')}
            </Button>
          </XStack>
        </XStack>

        <YStack gap="$0.5">
          <Text fontSize="$5" fontWeight="600" color="$ink" data-slot="course-title">
            {course.title}
          </Text>
          <Text fontSize="$2" color="$soft">
            {course.schoolName} — {course.summary}
          </Text>
        </YStack>

        {/* 7-Tab Navigation Bar */}
        <XStack
          data-slot="course-tabs"
          role="tablist"
          aria-label={`${course.code} course workspace tabs`}
          items="center"
          gap="$1"
          overflowX="auto"
          pt="$1"
        >
          {COURSE_TABS.map((tabId) => {
            const active = activeTab === tabId
            return (
              <XStack
                key={tabId}
                render={<button type="button" />}
                role="tab"
                aria-selected={active}
                data-slot={`course-tab-${tabId}`}
                onClick={() => selectTab(tabId)}
                px="$3"
                py="$1.5"
                rounded="$2"
                bg={active ? '$raised' : 'transparent'}
                hoverStyle={{ bg: active ? '$raised' : '$hover' }}
                borderWidth={1}
                borderColor={active ? 'var(--border-strong)' : 'transparent'}
                cursor="pointer"
                shrink={0}
              >
                <Text fontSize="$2" fontWeight={active ? '600' : '400'} color={active ? '$ink' : '$soft'}>
                  {t(COURSE_TAB_LABELS[tabId])}
                </Text>
              </XStack>
            )
          })}
        </XStack>
      </YStack>

      {/* Main Split: 7-Tab Content + Switchable AI Faculty Sidebar */}
      <XStack flex={1} minH={0} minW={0} $max-lg={{ flexDirection: 'column' }}>
        <YStack flex={1} minW={0} minH={0} overflowY="auto" p="$4" $md={{ p: '$5' }} gap="$4">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' ? (
            <YStack data-slot="course-panel-overview" gap="$4">
              <YStack p="$4" rounded="$4" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$3">
                <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
                  <Text fontSize="$4" fontWeight="600" color="$ink">
                    {t('Course Overview & Self-Serve Start')}
                  </Text>
                  <XStack gap="$2" flexWrap="wrap">
                    {!enrolled ? (
                      <Button size="sm" variant="primary" data-slot="course-enroll-btn" onPress={onEnroll}>
                        {course.isFree ? t('Start Free Course') : t('Enroll Self-Serve')}
                      </Button>
                    ) : (
                      <Button size="sm" variant="primary" data-slot="course-continue-lab" onPress={() => selectTab('experiments')}>
                        <FlaskConical size={13} aria-hidden />
                        {t('Continue Lab')}
                      </Button>
                    )}
                    {!signedIn ? (
                      <Button size="sm" variant="outline" data-slot="course-overview-signin" onPress={onSignIn}>
                        <LogIn size={13} aria-hidden />
                        {t('Sign in to Sync Progress')}
                      </Button>
                    ) : null}
                  </XStack>
                </XStack>

                <YStack gap="$1">
                  <Text fontSize="$2" fontWeight="600" color="$ink">
                    {t('Architecture Fit')}
                  </Text>
                  <Text fontSize="$2" color="$soft">
                    {course.architectureFit}
                  </Text>
                </YStack>

                <YStack gap="$1.5">
                  <Text fontSize="$2" fontWeight="600" color="$ink">
                    {t('Measurable Learning Objectives')}
                  </Text>
                  {course.objectives.map((obj, idx) => (
                    <XStack key={idx} items="flex-start" gap="$2">
                      <CheckCircle2 size={14} aria-hidden />
                      <Text fontSize="$2" color="$soft" flex={1}>
                        {obj}
                      </Text>
                    </XStack>
                  ))}
                </YStack>

                <YStack gap="$1">
                  <Text fontSize="$2" fontWeight="600" color="$ink">
                    {t('Capstone Deliverable')}
                  </Text>
                  <Text fontSize="$2" color="$soft">
                    {course.capstoneDeliverable}
                  </Text>
                </YStack>
              </YStack>

              {/* Prerequisites & Certification Tracks */}
              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} minW={240} p="$4" rounded="$4" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$2">
                  <Text fontSize="$3" fontWeight="600" color="$ink">
                    {t('Prerequisites')}
                  </Text>
                  {course.prerequisites.length === 0 ? (
                    <Text fontSize="$2" color="$soft">
                      {t('None — open entry foundation course. Start immediately for free.')}
                    </Text>
                  ) : (
                    <YStack gap="$1.5">
                      {course.prerequisites.map((preSlug) => {
                        const pre = COURSE_BY_SLUG[preSlug]
                        if (!pre) return null
                        return (
                          <XStack
                            key={preSlug}
                            render={<button type="button" />}
                            onClick={() => onNavigate(learnPath(pre.slug))}
                            p="$2.5"
                            rounded="$3"
                            borderWidth={1}
                            borderColor="$edge"
                            bg="$background"
                            hoverStyle={{ bg: '$hover' }}
                            justify="space-between"
                            items="center"
                            cursor="pointer"
                          >
                            <Text fontSize="$2" fontWeight="500" color="$ink">
                              {pre.code} · {pre.title}
                            </Text>
                            <Text fontSize="$1" fontFamily="$mono" color="$soft">
                              {pre.pricingTier}
                            </Text>
                          </XStack>
                        )
                      })}
                    </YStack>
                  )}
                </YStack>

                <YStack flex={1} minW={240} p="$4" rounded="$4" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$2">
                  <Text fontSize="$3" fontWeight="600" color="$ink">
                    {t('Certification Tracks')}
                  </Text>
                  {matchingCerts.map((cert) => (
                    <YStack key={cert.id} p="$2.5" rounded="$3" borderWidth={1} borderColor="$edge" bg="$background" gap="$0.5">
                      <Text fontSize="$2" fontWeight="600" color="$ink">
                        {cert.badgeCode} · {cert.name}
                      </Text>
                      <Text fontSize="$1" color="$soft">
                        {cert.summary}
                      </Text>
                    </YStack>
                  ))}
                </YStack>
              </XStack>
            </YStack>
          ) : null}

          {/* TAB 2: LECTURES */}
          {activeTab === 'lectures' ? (
            <YStack data-slot="course-panel-lectures" gap="$3">
              <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
                <Text fontSize="$4" fontWeight="600" color="$ink">
                  {t('Structured Modules & Syllabus')}
                </Text>
                <Text fontSize="$1" fontFamily="$mono" color="$soft">
                  {completedLectures.length}/{course.lectures.length} {t('modules complete')}
                </Text>
              </XStack>

              {course.lectures.map((lec) => {
                const done = completedLectures.includes(lec.id)
                const expanded = expandedLectureId === lec.id
                return (
                  <YStack
                    key={lec.id}
                    data-slot={`lecture-module-${lec.number}`}
                    p="$3.5"
                    rounded="$3"
                    borderWidth={1}
                    borderColor={done ? 'var(--border-strong)' : '$edge'}
                    bg="var(--card)"
                    gap="$2"
                  >
                    <XStack items="center" justify="space-between" gap="$2">
                      <XStack
                        render={<button type="button" />}
                        onClick={() => setExpandedLectureId(expanded ? null : lec.id)}
                        flex={1}
                        minW={0}
                        items="center"
                        gap="$2.5"
                        bg="transparent"
                        borderWidth={0}
                        cursor="pointer"
                      >
                        {expanded ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
                        <YStack flex={1} minW={0}>
                          <Text fontSize="$3" fontWeight="600" color="$ink" text="start">
                            Module {lec.number}: {lec.title}
                          </Text>
                          <Text fontSize="$1" fontFamily="$mono" color="$soft" text="start">
                            {lec.duration} · {lec.concepts.join(' · ')}
                          </Text>
                        </YStack>
                      </XStack>
                      <Button
                        size="sm"
                        variant={done ? 'outline' : 'ghost'}
                        data-slot={`lecture-check-${lec.number}`}
                        onPress={() => onToggleLecture(lec.id)}
                      >
                        {done ? <Check size={13} aria-hidden /> : null}
                        {done ? t('Completed') : t('Mark complete')}
                      </Button>
                    </XStack>

                    {expanded ? (
                      <YStack gap="$2" pt="$2" borderTopWidth={1} borderColor="$edge">
                        <Text fontSize="$2" color="$soft">
                          {lec.summary}
                        </Text>
                        <YStack gap="$1">
                          {lec.topics.map((topic, ti) => (
                            <Text key={ti} fontSize="$2" color="$ink">
                              • {topic}
                            </Text>
                          ))}
                        </YStack>
                        <XStack gap="$1.5" flexWrap="wrap">
                          {lec.concepts.map((concept, ci) => (
                            <XStack key={ci} px="$2" py="$0.5" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background">
                              <Text fontSize="$1" fontFamily="$mono" color="$soft">
                                {concept}
                              </Text>
                            </XStack>
                          ))}
                        </XStack>
                      </YStack>
                    ) : null}
                  </YStack>
                )
              })}
            </YStack>
          ) : null}

          {/* TAB 3: READING */}
          {activeTab === 'reading' ? (
            <YStack data-slot="course-panel-reading" gap="$3">
              <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
                <YStack>
                  <Text fontSize="$4" fontWeight="600" color="$ink">
                    {t('Canonical Reading & Documentation')}
                  </Text>
                  <Text fontSize="$2" color="$soft">
                    {t('Single source of truth from docs.hanzo.ai and hanzo.university.')}
                  </Text>
                </YStack>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    if (typeof window !== 'undefined') {
                      window.open(`${UNIVERSITY_BASE}/courses/${course.slug}`, '_blank', 'noopener,noreferrer')
                    }
                  }}
                >
                  {t('Open on hanzo.university')}
                  <ExternalLink size={12} aria-hidden />
                </Button>
              </XStack>

              {course.docsGuides.map((guide, idx) => (
                <YStack
                  key={idx}
                  data-slot={`reading-guide-${idx}`}
                  p="$4"
                  rounded="$4"
                  borderWidth={1}
                  borderColor="$edge"
                  bg="var(--card)"
                  gap="$2"
                >
                  <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
                    <XStack items="center" gap="$2">
                      <BookOpen size={15} aria-hidden />
                      <Text fontSize="$3" fontWeight="600" color="$ink">
                        {guide.title}
                      </Text>
                      <XStack px="$2" py="$0.5" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background">
                        <Text fontSize="$1" fontFamily="$mono" color="$soft">
                          {guide.tag}
                        </Text>
                      </XStack>
                    </XStack>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        if (typeof window !== 'undefined') {
                          window.open(guide.url, '_blank', 'noopener,noreferrer')
                        }
                      }}
                    >
                      {t('Read on docs.hanzo.ai')}
                      <ExternalLink size={12} aria-hidden />
                    </Button>
                  </XStack>
                  <Text fontSize="$2" color="$soft">
                    {guide.summary}
                  </Text>
                  <Text fontSize="$1" fontFamily="$mono" color="$quiet">
                    {guide.url}
                  </Text>
                </YStack>
              ))}
            </YStack>
          ) : null}

          {/* TAB 4: EXPERIMENTS / INTERACTIVE LABS */}
          {activeTab === 'experiments' ? (
            <YStack data-slot="course-panel-experiments" gap="$4">
              {course.labKind === 'kai-301' ? (
                <KaiLabPlayground
                  signedIn={signedIn}
                  completedSteps={completedLabSteps}
                  calibrationChecks={kaiChecklist}
                  onToggleStep={onToggleLabStep}
                  onToggleCalibration={onToggleKaiChecklist}
                  onResultRecorded={(res) => setKaiResults((prev) => [res, ...prev].slice(0, 10))}
                  onSignIn={onSignIn}
                />
              ) : course.labKind === 'science' ? (
                <ScienceLabPanel
                  course={course}
                  signedIn={signedIn}
                  completedSteps={completedLabSteps}
                  onToggleStep={onToggleLabStep}
                  onNavigate={onNavigate}
                />
              ) : course.labKind === 'entrepreneurship' ? (
                <StartupLabPanel
                  config={startupConfig}
                  onUpdateConfig={onUpdateStartupConfig}
                  onToggleStage={onToggleStartupStage}
                  onNavigate={onNavigate}
                />
              ) : (
                <StandardLabPanel
                  course={course}
                  completedSteps={completedLabSteps}
                  onToggleStep={onToggleLabStep}
                />
              )}
            </YStack>
          ) : null}

          {/* TAB 5: LAB TERMINAL */}
          {activeTab === 'terminal' ? (
            <LabTerminalTab
              course={course}
              signedIn={signedIn}
              session={sandboxSession}
              onSessionChange={setSandboxSession}
              onNavigate={onNavigate}
              onSignIn={onSignIn}
            />
          ) : null}

          {/* TAB 6: RESULTS */}
          {activeTab === 'results' ? (
            <YStack data-slot="course-panel-results" gap="$4">
              <YStack p="$4" rounded="$4" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$3">
                <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
                  <Text fontSize="$4" fontWeight="600" color="$ink">
                    {t('Measured Lab Progress & Verification Telemetry')}
                  </Text>
                  <Button size="sm" variant="primary" onPress={() => selectTab('capstone')}>
                    <Award size={13} aria-hidden />
                    {t('Proceed to Capstone')}
                  </Button>
                </XStack>

                <XStack gap="$3" flexWrap="wrap">
                  <YStack flex={1} minW={150} p="$3" rounded="$3" borderWidth={1} borderColor="$edge" bg="$background" gap="$0.5">
                    <Text fontSize="$1" fontFamily="$mono" color="$soft">
                      Modules
                    </Text>
                    <Text fontSize="$6" fontWeight="600" fontFamily="$mono" color="$ink">
                      {completedLectures.length}/{course.lectures.length}
                    </Text>
                  </YStack>
                  <YStack flex={1} minW={150} p="$3" rounded="$3" borderWidth={1} borderColor="$edge" bg="$background" gap="$0.5">
                    <Text fontSize="$1" fontFamily="$mono" color="$soft">
                      Lab steps
                    </Text>
                    <Text fontSize="$6" fontWeight="600" fontFamily="$mono" color="$ink">
                      {completedLabSteps.length}/{course.labSteps.length}
                    </Text>
                  </YStack>
                  <YStack flex={1} minW={150} p="$3" rounded="$3" borderWidth={1} borderColor="$edge" bg="$background" gap="$0.5">
                    <Text fontSize="$1" fontFamily="$mono" color="$soft">
                      Live /v1/ runs
                    </Text>
                    <Text fontSize="$6" fontWeight="600" fontFamily="$mono" color="$ink">
                      {kaiResults.length}
                    </Text>
                  </YStack>
                  <YStack flex={1} minW={150} p="$3" rounded="$3" borderWidth={1} borderColor="$edge" bg="$background" gap="$0.5">
                    <Text fontSize="$1" fontFamily="$mono" color="$soft">
                      Capstone gate
                    </Text>
                    <Text fontSize="$6" fontWeight="600" fontFamily="$mono" color="$ink">
                      {verification.scorePct}%
                    </Text>
                  </YStack>
                </XStack>

                {kaiResults.length > 0 ? (
                  <YStack gap="$1.5">
                    <Text fontSize="$2" fontWeight="600" color="$ink">
                      {t('Recent Live API Playground Receipts')}
                    </Text>
                    {kaiResults.map((r, i) => (
                      <XStack
                        key={i}
                        p="$2.5"
                        rounded="$2"
                        borderWidth={1}
                        borderColor="$edge"
                        bg="$background"
                        justify="space-between"
                        items="center"
                        flexWrap="wrap"
                        gap="$2"
                      >
                        <Text fontSize="$1" fontFamily="$mono" color="$ink">
                          {r.endpoint} · HTTP {r.status} · {r.latencyMs}ms
                        </Text>
                        <Text fontSize="$1" fontFamily="$mono" color="$soft">
                          {r.ok ? 'VERIFIED' : r.error ?? 'ERROR'}
                        </Text>
                      </XStack>
                    ))}
                  </YStack>
                ) : (
                  <Text fontSize="$2" color="$soft">
                    {t('Execute live /v1/ calls in the Experiments tab or open /science to populate run receipts here. No synthetic telemetry is fabricated.')}
                  </Text>
                )}
              </YStack>
            </YStack>
          ) : null}

          {/* TAB 7: CAPSTONE ASSESSMENT & W3C VERIFIABLE CREDENTIAL PREVIEW */}
          {activeTab === 'capstone' ? (
            <YStack data-slot="course-panel-capstone" gap="$4">
              <YStack p="$4" rounded="$4" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$3">
                <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
                  <XStack items="center" gap="$2">
                    <Award size={18} aria-hidden />
                    <YStack>
                      <Text fontSize="$4" fontWeight="600" color="$ink">
                        {t('Capstone Assessment & Practical Verification')}
                      </Text>
                      <Text fontSize="$2" color="$soft">
                        {t('Required deliverable')}: {course.capstoneDeliverable}
                      </Text>
                    </YStack>
                  </XStack>
                  <XStack px="$2.5" py="$1" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background">
                    <Text fontSize="$1" fontFamily="$mono" fontWeight="600" color="$ink" data-slot="capstone-readiness">
                      {verification.passed ? 'READY FOR PRACTICAL REVIEW' : `${verification.scorePct}% COMPLETE`}
                    </Text>
                  </XStack>
                </XStack>

                <YStack gap="$2.5">
                  <YStack gap="$1">
                    <Text fontSize="$2" fontWeight="500" color="$ink">
                      {t('1. Dataset Manifest / SHA-256 Digest')}
                    </Text>
                    <Input
                      data-slot="capstone-dataset"
                      placeholder="e.g., hanzo://datasets/acme-triage/v1 · sha256:9f3a..."
                      value={capstoneDraft.datasetManifest}
                      onChangeText={(datasetManifest: string) =>
                        setCapstoneDraft((p) => ({ ...p, datasetManifest }))
                      }
                    />
                  </YStack>

                  <YStack gap="$1">
                    <Text fontSize="$2" fontWeight="500" color="$ink">
                      {t('2. Baseline vs Candidate Eval Metrics')}
                    </Text>
                    <Textarea
                      data-slot="capstone-metrics"
                      minH={72}
                      placeholder="e.g., Baseline acc 0.78 -> Candidate acc 0.91 (+0.13); ECE 0.088 -> 0.029; p95 164ms"
                      value={capstoneDraft.evalMetrics}
                      onChangeText={(evalMetrics: string) =>
                        setCapstoneDraft((p) => ({ ...p, evalMetrics }))
                      }
                    />
                  </YStack>

                  <YStack gap="$1">
                    <Text fontSize="$2" fontWeight="500" color="$ink">
                      {t('3. Artifact ID, Checkpoint, PR, or Live Production URL')}
                    </Text>
                    <Input
                      data-slot="capstone-artifact"
                      placeholder="e.g., ckpt_kai_v1_48a2 or https://github.com/org/repo/pull/42"
                      value={capstoneDraft.artifactRef}
                      onChangeText={(artifactRef: string) =>
                        setCapstoneDraft((p) => ({ ...p, artifactRef }))
                      }
                    />
                  </YStack>

                  <YStack gap="$1">
                    <Text fontSize="$2" fontWeight="500" color="$ink">
                      {t('4. Regression Verification Report')}
                    </Text>
                    <Textarea
                      data-slot="capstone-regression"
                      minH={72}
                      placeholder="e.g., Holdout n=400 verified; minority safety slice recall 0.94 -> 0.97; zero regressions."
                      value={capstoneDraft.regressionReport}
                      onChangeText={(regressionReport: string) =>
                        setCapstoneDraft((p) => ({ ...p, regressionReport }))
                      }
                    />
                  </YStack>

                  <XStack gap="$2" flexWrap="wrap">
                    <Button
                      size="sm"
                      variant={capstoneDraft.preregisteredMet ? 'primary' : 'outline'}
                      data-slot="capstone-toggle-prereg"
                      onPress={() =>
                        setCapstoneDraft((p) => ({ ...p, preregisteredMet: !p.preregisteredMet }))
                      }
                    >
                      {capstoneDraft.preregisteredMet ? <Check size={13} aria-hidden /> : null}
                      {t('Pre-registered threshold verified')}
                    </Button>
                    <Button
                      size="sm"
                      variant={capstoneDraft.regressionFree ? 'primary' : 'outline'}
                      data-slot="capstone-toggle-regression"
                      onPress={() =>
                        setCapstoneDraft((p) => ({ ...p, regressionFree: !p.regressionFree }))
                      }
                    >
                      {capstoneDraft.regressionFree ? <Check size={13} aria-hidden /> : null}
                      {t('Zero silent regressions confirmed')}
                    </Button>
                  </XStack>
                </YStack>

                {/* Practical Verification Checklist */}
                <YStack gap="$1.5" pt="$2" borderTopWidth={1} borderColor="$edge">
                  <Text fontSize="$2" fontWeight="600" color="$ink">
                    {t('Practical Verification Checks')}
                  </Text>
                  {verification.checks.map((chk) => (
                    <XStack key={chk.id} items="center" gap="$2">
                      <ShieldCheck
                        size={14}
                        color={chk.ok ? 'var(--state-online)' : 'var(--muted-foreground)'}
                        aria-hidden
                      />
                      <Text fontSize="$2" color={chk.ok ? '$ink' : '$soft'}>
                        {chk.label}
                      </Text>
                    </XStack>
                  ))}
                </YStack>

                <XStack justify="flex-end" gap="$2">
                  <Button
                    size="sm"
                    variant="primary"
                    data-slot="capstone-submit-btn"
                    onPress={() =>
                      onSaveCapstone({
                        ...capstoneDraft,
                        submittedAt: new Date().toISOString(),
                      })
                    }
                  >
                    {t('Save Capstone Evidence')}
                  </Button>
                </XStack>
              </YStack>

              {/* W3C Verifiable Credential v2.0 Preview */}
              <YStack
                data-slot="w3c-vc-preview"
                p="$4"
                rounded="$4"
                borderWidth={1}
                borderColor="$edge"
                bg="var(--card)"
                gap="$2"
              >
                <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
                  <Text fontSize="$3" fontWeight="600" color="$ink">
                    {t('W3C Verifiable Credential v2.0 Preview')}
                  </Text>
                  <XStack px="$2" py="$0.5" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background">
                    <Text fontSize="$1" fontFamily="$mono" color="$soft">
                      Practical certification preview
                    </Text>
                  </XStack>
                </XStack>
                <Text fontSize="$2" color="$soft">
                  {t('Preview of the W3C Verifiable Credential issued upon verified practical capstone completion (not a signed credential until verification passes).')}
                </Text>
                <YStack p="$3" rounded="$3" borderWidth={1} borderColor="$edge" bg="$background">
                  <Text fontSize="$1" fontFamily="$mono" color="$ink">
                    {JSON.stringify(credentialPreview, null, 2)}
                  </Text>
                </YStack>
              </YStack>
            </YStack>
          ) : null}
        </YStack>

        {/* Collapsible AI Faculty Tutor Rail */}
        {facultyOpen ? (
          <FacultySidebar
            course={course}
            activeTab={activeTab}
            activeStepTitle={activeStepTitle}
            signedIn={signedIn}
            onSignIn={onSignIn}
            onClose={() => setFacultyOpen(false)}
          />
        ) : null}
      </XStack>
    </YStack>
  )
}
