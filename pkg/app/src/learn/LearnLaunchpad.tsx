'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Input, Text } from '@hanzo/ui'
import {
  ArrowRight,
  Award,
  BookOpen,
  Compass,
  ExternalLink,
  GraduationCap,
  LogIn,
  Rocket,
  Search,
  Sparkles,
} from 'lucide-react'
import {
  ADVENTURE_GOALS,
  CERTIFICATION_TRACKS,
  computeCourseCompletionPct,
  COURSES,
  recommendAdventureTrack,
  SCHOOLS,
  UNIVERSITY_BASE,
} from './catalog'
import { StartupLabPanel } from './LabPanels'
import {
  learnPath,
  type AdventureGoalId,
  type CertificationTrackId,
  type LearnProgressStore,
  type LearnSectionView,
  type SchoolId,
  type StartupBuilderConfig,
} from './types'

export function LearnLaunchpad({
  section,
  initialSchoolFilter,
  progressStore,
  signedIn,
  orgName,
  onNavigate,
  onSignIn,
  onSelectGoal,
  onUpdateStartupConfig,
  onToggleStartupStage,
}: {
  section: LearnSectionView
  initialSchoolFilter: SchoolId | 'all'
  progressStore: LearnProgressStore
  signedIn: boolean
  orgName: string | null
  onNavigate: (to: string) => void
  onSignIn: () => void
  onSelectGoal: (goalId: AdventureGoalId) => void
  onUpdateStartupConfig: (patch: Partial<StartupBuilderConfig>) => void
  onToggleStartupStage: (stageId: string) => void
}) {
  const { t } = useI18n()
  const [schoolFilter, setSchoolFilter] = useState<SchoolId | 'all'>(initialSchoolFilter)
  const [certFilter, setCertFilter] = useState<CertificationTrackId | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const recommendation = useMemo(
    () => recommendAdventureTrack(progressStore.selectedGoal),
    [progressStore.selectedGoal],
  )

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return COURSES.filter((course) => {
      if (schoolFilter !== 'all' && course.school !== schoolFilter) return false
      if (certFilter !== 'all' && !course.certificationTracks.includes(certFilter)) return false
      if (!q) return true
      const hay = `${course.code} ${course.slug} ${course.title} ${course.schoolName} ${course.summary} ${course.pricingTier}`.toLowerCase()
      return hay.includes(q)
    })
  }, [schoolFilter, certFilter, searchQuery])

  const startedCoursesCount = useMemo(
    () => Object.keys(progressStore.courses).length,
    [progressStore.courses],
  )

  const showAdventure = section === 'launchpad' || section === 'adventure'
  const showStartup = section === 'launchpad' || section === 'startup'
  const showCatalog = section === 'launchpad' || section === 'catalog'

  return (
    <YStack
      data-slot="learn-launchpad"
      flex={1}
      minH={0}
      overflowY="auto"
      overflowX="hidden"
      p="$4"
      $md={{ p: '$6' }}
      gap="$5"
    >
      {/* Top Hero Header */}
      <YStack gap="$3">
        <XStack items="flex-start" justify="space-between" flexWrap="wrap" gap="$3">
          <XStack items="center" gap="$3" flex={1} minW={240}>
            <XStack
              width={42}
              height={42}
              rounded="$3"
              bg="$raised"
              borderWidth={1}
              borderColor="$edge"
              items="center"
              justify="center"
              shrink={0}
            >
              <GraduationCap size={21} aria-hidden />
            </XStack>
            <YStack gap="$0.5" flex={1} minW={0}>
              <Text fontSize="$6" fontWeight="600" color="$ink" data-slot="learn-title">
                Hanzo University
              </Text>
              <Text fontSize="$2" color="$soft">
                {t('Self-service learning, live /v1/ interactive labs, AI faculty tutors, and white-label AI startup launchpad.')}
              </Text>
            </YStack>
          </XStack>

          <XStack items="center" gap="$2" flexWrap="wrap">
            <Button
              size="sm"
              variant="outline"
              borderColor="var(--border-strong)"
              data-slot="learn-free-starter-cta"
              onPress={() => onNavigate(learnPath('continuous-improvement'))}
            >
              <Sparkles size={13} aria-hidden />
              {t('Start AUTO 101 Free')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onPress={() => {
                if (typeof window !== 'undefined') window.open(UNIVERSITY_BASE, '_blank', 'noopener,noreferrer')
              }}
            >
              hanzo.university
              <ExternalLink size={12} aria-hidden />
            </Button>
          </XStack>
        </XStack>

        {/* Status / Signed-out Preview Banner */}
        {!signedIn ? (
          <XStack
            data-slot="learn-signedout-banner"
            p="$3.5"
            rounded="$3"
            borderWidth={1}
            borderColor="$edge"
            bg="$raised"
            items="center"
            justify="space-between"
            flexWrap="wrap"
            gap="$2.5"
          >
            <YStack flex={1} minW={220} gap="$0.5">
              <Text fontSize="$2" fontWeight="600" color="$ink">
                {t('Self-Serve Guest Preview Active')}
              </Text>
              <Text fontSize="$2" color="$soft">
                {t('Browse all 25 courses, run Choose Your Adventure, and preview AUTO 101 free. Sign in with Hanzo IAM to launch isolated sandboxes, run live /v1/ API labs, chat with AI Faculty, and sync progress across devices.')}
              </Text>
            </YStack>
            <Button size="sm" variant="primary" data-slot="learn-banner-signin" onPress={onSignIn}>
              <LogIn size={13} aria-hidden />
              {t('Sign in to Start Labs')}
            </Button>
          </XStack>
        ) : (
          <XStack
            data-slot="learn-org-strip"
            px="$3.5"
            py="$2"
            rounded="$3"
            borderWidth={1}
            borderColor="$edge"
            bg="var(--card)"
            items="center"
            justify="space-between"
            flexWrap="wrap"
            gap="$2"
          >
            <Text fontSize="$1" fontFamily="$mono" color="$ink">
              Hanzo IAM Active · Org: {orgName || 'personal'} · 25 Courses · 4 Schools · 6 Certification Tracks
            </Text>
            <Text fontSize="$1" fontFamily="$mono" color="$soft">
              {startedCoursesCount} {t('in progress')} · {t('Cloud progress synced via /v1/pref')}
            </Text>
          </XStack>
        )}

        {/* Section Switcher Pills */}
        <XStack gap="$1.5" flexWrap="wrap">
          {(
            [
              { id: 'launchpad', label: 'All Launchpad' },
              { id: 'adventure', label: 'Choose Your Adventure' },
              { id: 'startup', label: 'Startup Builder (ENT 401)' },
              { id: 'catalog', label: '25-Course Catalog' },
            ] as const
          ).map((item) => {
            const active = section === item.id
            return (
              <XStack
                key={item.id}
                render={<button type="button" />}
                data-slot={`learn-section-${item.id}`}
                onClick={() => onNavigate(item.id === 'launchpad' ? learnPath() : learnPath(null, { view: item.id }))}
                px="$3"
                py="$1.5"
                rounded="$3"
                borderWidth={1}
                borderColor={active ? 'var(--border-strong)' : '$edge'}
                bg={active ? '$raised' : 'transparent'}
                hoverStyle={{ bg: active ? '$raised' : '$hover' }}
                cursor="pointer"
              >
                <Text fontSize="$2" fontWeight={active ? '600' : '400'} color={active ? '$ink' : '$soft'}>
                  {t(item.label)}
                </Text>
              </XStack>
            )
          })}
        </XStack>
      </YStack>

      {/* 1. CHOOSE-YOUR-ADVENTURE INTERACTIVE GOAL WIZARD */}
      {showAdventure ? (
        <YStack
          data-slot="learn-adventure-wizard"
          p="$4"
          rounded="$4"
          borderWidth={1}
          borderColor="$edge"
          bg="var(--card)"
          gap="$4"
        >
          <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
            <XStack items="center" gap="$2">
              <Compass size={18} aria-hidden />
              <YStack>
                <Text fontSize="$4" fontWeight="600" color="$ink">
                  {t('Choose Your Adventure')}
                </Text>
                <Text fontSize="$2" color="$soft">
                  {t('Pick what you want to build — we generate your tailored track, free starter, certification path, docs guides, and first live lab.')}
                </Text>
              </YStack>
            </XStack>
          </XStack>

          {/* 6 Goal Cards */}
          <XStack gap="$2.5" flexWrap="wrap">
            {ADVENTURE_GOALS.map((goal) => {
              const active = progressStore.selectedGoal === goal.id
              return (
                <YStack
                  key={goal.id}
                  render={<button type="button" />}
                  data-slot={`adventure-goal-${goal.id}`}
                  aria-pressed={active}
                  onClick={() => onSelectGoal(goal.id)}
                  flex={1}
                  minW={220}
                  p="$3"
                  rounded="$3"
                  borderWidth={1}
                  borderColor={active ? 'var(--border-strong)' : '$edge'}
                  bg={active ? '$raised' : '$background'}
                  hoverStyle={{ bg: '$hover' }}
                  gap="$1"
                  cursor="pointer"
                >
                  <XStack items="center" justify="space-between" gap="$2" width="100%">
                    <Text fontSize="$2" fontWeight="600" color="$ink" text="start">
                      {goal.title}
                    </Text>
                    <Text fontSize="$1" fontFamily="$mono" color="$soft">
                      {goal.stackTag}
                    </Text>
                  </XStack>
                  <Text fontSize="$1" color="$soft" text="start">
                    {goal.subtitle}
                  </Text>
                </YStack>
              )
            })}
          </XStack>

          {/* Dynamically Generated Tailored Track */}
          <YStack
            data-slot="adventure-recommendation"
            p="$4"
            rounded="$3"
            borderWidth={1}
            borderColor="var(--border-strong)"
            bg="$background"
            gap="$3"
          >
            <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
              <YStack gap="$0.5">
                <Text fontSize="$1" fontFamily="$mono" color="$soft">
                  RECOMMENDED TRACK · {recommendation.certification.badgeCode}
                </Text>
                <Text fontSize="$4" fontWeight="600" color="$ink">
                  {recommendation.certification.name} ({recommendation.certification.estimatedHours}h)
                </Text>
                <Text fontSize="$2" color="$soft">
                  {recommendation.certification.summary}
                </Text>
              </YStack>

              <Button
                size="sm"
                variant="primary"
                data-slot="adventure-start-first-lab"
                onPress={() => onNavigate(recommendation.firstLabHref)}
              >
                {t('Start First Lab')}: {recommendation.firstLabCourse.code}
                <ArrowRight size={13} aria-hidden />
              </Button>
            </XStack>

            {/* Starter + Core Sequence */}
            <XStack gap="$2" flexWrap="wrap">
              <YStack
                render={<button type="button" />}
                onClick={() => onNavigate(learnPath(recommendation.starter.slug))}
                p="$2.5"
                rounded="$3"
                borderWidth={1}
                borderColor="$edge"
                bg="var(--card)"
                hoverStyle={{ bg: '$hover' }}
                minW={180}
                flex={1}
                gap="$0.5"
                cursor="pointer"
              >
                <Text fontSize="$1" fontFamily="$mono" color="$soft">
                  FREE STARTER · {recommendation.starter.code}
                </Text>
                <Text fontSize="$2" fontWeight="600" color="$ink" text="start">
                  {recommendation.starter.title}
                </Text>
              </YStack>
              {recommendation.coreCourses.map((course, idx) => (
                <YStack
                  key={course.slug}
                  render={<button type="button" />}
                  onClick={() => onNavigate(learnPath(course.slug))}
                  p="$2.5"
                  rounded="$3"
                  borderWidth={1}
                  borderColor="$edge"
                  bg="var(--card)"
                  hoverStyle={{ bg: '$hover' }}
                  minW={180}
                  flex={1}
                  gap="$0.5"
                  cursor="pointer"
                >
                  <Text fontSize="$1" fontFamily="$mono" color="$soft">
                    STEP {idx + 2} · {course.code} ({course.pricingTier})
                  </Text>
                  <Text fontSize="$2" fontWeight="600" color="$ink" text="start">
                    {course.title}
                  </Text>
                </YStack>
              ))}
            </XStack>

            {/* Live Docs Guides */}
            <XStack items="center" gap="$2" flexWrap="wrap">
              <Text fontSize="$1" fontFamily="$mono" color="$soft">
                CANONICAL DOCS:
              </Text>
              {recommendation.docsLinks.map((doc, idx) => (
                <Button
                  key={idx}
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    if (typeof window !== 'undefined') window.open(doc.url, '_blank', 'noopener,noreferrer')
                  }}
                >
                  {doc.title}
                  <ExternalLink size={11} aria-hidden />
                </Button>
              ))}
            </XStack>
          </YStack>
        </YStack>
      ) : null}

      {/* 2. AI-ASSISTED ENTREPRENEURSHIP STUDIO (ENT 401 LAUNCHPAD) */}
      {showStartup ? (
        <StartupLabPanel
          config={progressStore.startup}
          onUpdateConfig={onUpdateStartupConfig}
          onToggleStage={onToggleStartupStage}
          onNavigate={onNavigate}
          compact
        />
      ) : null}

      {/* 3. FILTERABLE 4 SCHOOLS + 6 CERTIFICATION TRACKS + 25-COURSE DIRECTORY */}
      {showCatalog ? (
        <YStack data-slot="learn-catalog" gap="$4">
          <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2.5">
            <XStack items="center" gap="$2">
              <BookOpen size={18} aria-hidden />
              <YStack>
                <Text fontSize="$4" fontWeight="600" color="$ink">
                  {t('Curriculum Directory')} ({filteredCourses.length}/{COURSES.length} {t('courses')})
                </Text>
                <Text fontSize="$2" color="$soft">
                  {t('4 Schools + Free AUTO 101 Foundation · 6 Practical Certification Tracks')}
                </Text>
              </YStack>
            </XStack>
            <XStack items="center" gap="$2" minW={240}>
              <Search size={14} aria-hidden />
              <Input
                flex={1}
                data-slot="learn-catalog-search"
                aria-label="Filter courses"
                placeholder="Search code, slug, or topic (e.g. KAI 301, ENT 401)…"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </XStack>
          </XStack>

          {/* School Filter Pills */}
          <XStack data-slot="learn-school-filters" gap="$1.5" flexWrap="wrap">
            <XStack
              render={<button type="button" />}
              data-slot="school-filter-all"
              onClick={() => setSchoolFilter('all')}
              px="$2.5"
              py="$1"
              rounded="$2"
              borderWidth={1}
              borderColor={schoolFilter === 'all' ? 'var(--border-strong)' : '$edge'}
              bg={schoolFilter === 'all' ? '$raised' : 'transparent'}
              hoverStyle={{ bg: '$hover' }}
              cursor="pointer"
            >
              <Text fontSize="$2" fontWeight={schoolFilter === 'all' ? '600' : '400'} color={schoolFilter === 'all' ? '$ink' : '$soft'}>
                All Schools ({COURSES.length})
              </Text>
            </XStack>
            {SCHOOLS.map((school) => {
              const active = schoolFilter === school.id
              const count = COURSES.filter((c) => c.school === school.id).length
              return (
                <XStack
                  key={school.id}
                  render={<button type="button" />}
                  data-slot={`school-filter-${school.id}`}
                  onClick={() => setSchoolFilter(school.id)}
                  px="$2.5"
                  py="$1"
                  rounded="$2"
                  borderWidth={1}
                  borderColor={active ? 'var(--border-strong)' : '$edge'}
                  bg={active ? '$raised' : 'transparent'}
                  hoverStyle={{ bg: '$hover' }}
                  cursor="pointer"
                >
                  <Text fontSize="$2" fontWeight={active ? '600' : '400'} color={active ? '$ink' : '$soft'}>
                    {school.shortName} ({count})
                  </Text>
                </XStack>
              )
            })}
          </XStack>

          {/* 6 Certification Track Filter Strip */}
          <YStack gap="$1.5">
            <XStack items="center" gap="$1.5">
              <Award size={14} aria-hidden />
              <Text fontSize="$1" fontFamily="$mono" color="$soft">
                CERTIFICATION TRACKS (6)
              </Text>
            </XStack>
            <XStack data-slot="learn-cert-filters" gap="$1.5" flexWrap="wrap">
              <XStack
                render={<button type="button" />}
                data-slot="cert-filter-all"
                onClick={() => setCertFilter('all')}
                px="$2.5"
                py="$1"
                rounded="$2"
                borderWidth={1}
                borderColor={certFilter === 'all' ? 'var(--border-strong)' : '$edge'}
                bg={certFilter === 'all' ? '$raised' : '$background'}
                cursor="pointer"
              >
                <Text fontSize="$1" fontFamily="$mono" color={certFilter === 'all' ? '$ink' : '$soft'}>
                  All Tracks
                </Text>
              </XStack>
              {CERTIFICATION_TRACKS.map((track) => {
                const active = certFilter === track.id
                return (
                  <XStack
                    key={track.id}
                    render={<button type="button" />}
                    data-slot={`cert-filter-${track.id}`}
                    onClick={() => setCertFilter(active ? 'all' : track.id)}
                    px="$2.5"
                    py="$1"
                    rounded="$2"
                    borderWidth={1}
                    borderColor={active ? 'var(--border-strong)' : '$edge'}
                    bg={active ? '$raised' : '$background'}
                    hoverStyle={{ bg: '$hover' }}
                    cursor="pointer"
                  >
                    <Text fontSize="$1" fontFamily="$mono" color={active ? '$ink' : '$soft'}>
                      {track.badgeCode} · {track.name}
                    </Text>
                  </XStack>
                )
              })}
            </XStack>
          </YStack>

          {/* Course Cards Grid */}
          <XStack data-slot="learn-course-grid" gap="$3" flexWrap="wrap">
            {filteredCourses.map((course) => {
              const pct = computeCourseCompletionPct(course, progressStore.courses[course.slug])
              return (
                <YStack
                  key={course.slug}
                  render={<button type="button" />}
                  data-slot={`course-card-${course.slug}`}
                  onClick={() => onNavigate(learnPath(course.slug))}
                  flex={1}
                  minW={270}
                  maxW={420}
                  p="$4"
                  rounded="$4"
                  borderWidth={1}
                  borderColor="$edge"
                  bg="var(--card)"
                  hoverStyle={{ bg: '$hover', borderColor: 'var(--border-strong)' }}
                  gap="$2"
                  cursor="pointer"
                >
                  <XStack items="center" justify="space-between" width="100%" gap="$2">
                    <XStack items="center" gap="$1.5">
                      <XStack px="$2" py="$0.5" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background">
                        <Text fontSize="$1" fontFamily="$mono" fontWeight="600" color="$ink">
                          {course.code}
                        </Text>
                      </XStack>
                      <Text fontSize="$1" fontFamily="$mono" color="$soft">
                        {course.difficulty}
                      </Text>
                    </XStack>
                    <XStack px="$2" py="$0.5" rounded="$2" borderWidth={1} borderColor="$edge" bg="$raised">
                      <Text fontSize="$1" fontFamily="$mono" fontWeight="600" color="$ink">
                        {course.pricingTier}
                      </Text>
                    </XStack>
                  </XStack>

                  <Text fontSize="$3" fontWeight="600" color="$ink" text="start">
                    {course.title}
                  </Text>

                  <Text fontSize="$2" color="$soft" text="start" numberOfLines={2}>
                    {course.summary}
                  </Text>

                  <XStack items="center" justify="space-between" width="100%" pt="$1">
                    <Text fontSize="$1" fontFamily="$mono" color="$quiet">
                      {course.duration} · {course.labSteps.length} lab steps
                    </Text>
                    <Text fontSize="$1" fontFamily="$mono" color="$ink">
                      {pct}%
                    </Text>
                  </XStack>

                  {/* Monochrome Progress Bar */}
                  <XStack width="100%" height={4} rounded={999} bg="$background" overflow="hidden">
                    <YStack width={`${pct}%` as never} height="100%" bg="$ink" />
                  </XStack>
                </YStack>
              )
            })}
          </XStack>

          {filteredCourses.length === 0 ? (
            <YStack p="$5" rounded="$4" borderWidth={1} borderColor="$edge" bg="var(--card)" items="center" gap="$2">
              <Text fontSize="$3" fontWeight="500" color="$ink">
                {t('No courses match the active filters.')}
              </Text>
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  setSchoolFilter('all')
                  setCertFilter('all')
                  setSearchQuery('')
                }}
              >
                {t('Reset Filters')}
              </Button>
            </YStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  )
}
