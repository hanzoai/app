'use client'

import { useCallback, useMemo } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { YStack } from '@hanzo/gui'
import { Button, Text } from '@hanzo/ui'
import type { Host } from '@hanzo/dev/builder'
import { useHost } from '../host'
import { enter, LOGIN } from '../lib/destination'
import { go as navGo } from '../lib/host'
import { bearer, named, org as currentOrg } from '../lib/session'
import { usePref } from '../pref'
import {
  createEmptyProgressStore,
  learnPrefKey,
  normalizeProgressStore,
  writeLocalProgress,
} from './api'
import { getCourse } from './catalog'
import { CourseWorkspace } from './CourseWorkspace'
import { LearnLaunchpad } from './LearnLaunchpad'
import {
  learnPath,
  parseLearnRoute,
  type AdventureGoalId,
  type CapstoneSubmission,
  type CourseProgress,
  type CourseSpec,
  type LearnProgressStore,
  type StartupBuilderConfig,
} from './types'

const PAY_BASE = 'https://hanzo.ai/pay'

/** Build the Hanzo Pay checkout URL for a paid Hanzo University course. */
export function courseCheckoutUrl(course: Pick<CourseSpec, 'slug' | 'isFree'>, orgId?: string | null): string {
  const params = new URLSearchParams({
    product: course.slug,
    returnUrl: learnPath(course.slug),
  })
  if (orgId) params.set('org', orgId)
  return `${PAY_BASE}?${params.toString()}`
}

function toggleItem(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export function LearnPane({
  host,
  path,
  onNavigate,
  onCheckout,
}: {
  host?: Host
  path?: string
  onNavigate?: (to: string) => void
  onCheckout?: (url: string) => void
} = {}) {
  const { t } = useI18n()
  const hostCtx = useHost()
  const activeOrg = host?.org ?? currentOrg()
  const signedIn = Boolean(host?.person || bearer())
  const holderName = host?.person?.name || named()?.name || 'Hanzo Learner'

  const currentPathname =
    path ?? hostCtx?.path ?? (typeof window !== 'undefined' ? window.location.pathname : '/learn')
  const currentSearch =
    typeof window !== 'undefined' && !currentPathname.includes('?') ? window.location.search : ''

  const route = useMemo(
    () => parseLearnRoute(currentPathname, currentSearch),
    [currentPathname, currentSearch],
  )

  const prefKey = useMemo(() => learnPrefKey(activeOrg), [activeOrg])
  const [rawStore, setRawStore] = usePref<LearnProgressStore>(prefKey, createEmptyProgressStore())
  const store = useMemo(() => normalizeProgressStore(rawStore), [rawStore])

  const commitStore = useCallback(
    (updater: (prev: LearnProgressStore) => LearnProgressStore) => {
      const next = updater(store)
      writeLocalProgress(next, activeOrg)
      setRawStore(next)
    },
    [store, activeOrg, setRawStore],
  )

  const navigate = useCallback(
    (to: string) => {
      if (onNavigate) onNavigate(to)
      else navGo(to)
    },
    [onNavigate],
  )

  const handleSignIn = useCallback(() => {
    if (host?.signIn) {
      host.signIn()
      return
    }
    if (typeof window !== 'undefined') {
      enter(LOGIN)
    }
  }, [host])

  const updateCourse = useCallback(
    (slug: string, updater: (prev: CourseProgress) => CourseProgress) => {
      const now = new Date().toISOString()
      commitStore((prev) => {
        const current: CourseProgress = prev.courses[slug] ?? {
          enrolledAt: now,
          completedLectures: [],
          completedLabSteps: [],
          kaiChecklist: [],
          updatedAt: now,
        }
        return {
          ...prev,
          courses: {
            ...prev.courses,
            [slug]: { ...updater(current), updatedAt: now },
          },
        }
      })
    },
    [commitStore],
  )

  const handleSelectGoal = useCallback(
    (goalId: AdventureGoalId) => {
      commitStore((prev) => ({ ...prev, selectedGoal: goalId }))
    },
    [commitStore],
  )

  const handleUpdateStartupConfig = useCallback(
    (patch: Partial<StartupBuilderConfig>) => {
      commitStore((prev) => ({
        ...prev,
        startup: { ...prev.startup, ...patch },
      }))
    },
    [commitStore],
  )

  const handleToggleStartupStage = useCallback(
    (stageId: string) => {
      commitStore((prev) => ({
        ...prev,
        startup: {
          ...prev.startup,
          completedStages: toggleItem(prev.startup.completedStages, stageId),
        },
      }))
    },
    [commitStore],
  )

  if (route.slug) {
    const course = getCourse(route.slug)
    if (!course) {
      return (
        <YStack
          data-slot="learn-course-not-found"
          flex={1}
          minH={0}
          items="center"
          justify="center"
          p="$6"
          gap="$3"
          bg="$background"
        >
          <Text fontSize="$5" fontWeight="600" color="$ink">
            {t('Course not found')}
          </Text>
          <Text fontSize="$2" color="$soft" text="center" maxW={420}>
            {t('No Hanzo University course matches')} "{route.slug}". {t('Browse all 25 courses on the Learn launchpad.')}
          </Text>
          <Button size="sm" variant="primary" onPress={() => navigate(learnPath())}>
            {t('Back to Hanzo University')}
          </Button>
        </YStack>
      )
    }

    return (
      <YStack data-slot="learn-pane" flex={1} minW={0} minH={0} height="100%" bg="$background">
        <CourseWorkspace
          course={course}
          activeTab={route.tab}
          progress={store.courses[course.slug]}
          startupConfig={store.startup}
          signedIn={signedIn}
          holderName={holderName}
          orgId={activeOrg}
          onNavigate={navigate}
          onSignIn={handleSignIn}
          onEnroll={() => {
            if (course.isFree) {
              updateCourse(course.slug, (prev) => ({
                ...prev,
                enrolledAt: prev.enrolledAt ?? new Date().toISOString(),
              }))
              return
            }
            const url = courseCheckoutUrl(course, activeOrg)
            if (onCheckout) onCheckout(url)
            else if (typeof window !== 'undefined') window.location.assign(url)
          }}
          onToggleLecture={(lectureId) =>
            updateCourse(course.slug, (prev) => ({
              ...prev,
              completedLectures: toggleItem(prev.completedLectures, lectureId),
            }))
          }
          onToggleLabStep={(stepId) =>
            updateCourse(course.slug, (prev) => ({
              ...prev,
              completedLabSteps: toggleItem(prev.completedLabSteps, stepId),
            }))
          }
          onToggleKaiChecklist={(checkId) =>
            updateCourse(course.slug, (prev) => ({
              ...prev,
              kaiChecklist: toggleItem(prev.kaiChecklist, checkId),
            }))
          }
          onSaveCapstone={(submission: CapstoneSubmission) =>
            updateCourse(course.slug, (prev) => ({
              ...prev,
              capstone: submission,
            }))
          }
          onUpdateStartupConfig={handleUpdateStartupConfig}
          onToggleStartupStage={handleToggleStartupStage}
        />
      </YStack>
    )
  }

  return (
    <YStack data-slot="learn-pane" flex={1} minW={0} minH={0} height="100%" bg="$background">
      <LearnLaunchpad
        section={route.section}
        initialSchoolFilter={route.schoolFilter}
        progressStore={store}
        signedIn={signedIn}
        orgName={activeOrg}
        onNavigate={navigate}
        onSignIn={handleSignIn}
        onSelectGoal={handleSelectGoal}
        onUpdateStartupConfig={handleUpdateStartupConfig}
        onToggleStartupStage={handleToggleStartupStage}
      />
    </YStack>
  )
}

export default LearnPane
