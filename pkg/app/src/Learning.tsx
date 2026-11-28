'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  Beaker,
  BookOpen,
  ChartBar,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  FlaskConical,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { useI18n } from '@hanzo/i18n/react'
import { useIam } from '@hanzo/iam/react'
import { Box, Button, Dialog, DialogContent, DialogTitle, Input, Skeleton, Text, XStack, YStack } from '@hanzo/ui'
import { say } from './failure'
import { org } from './lib/session'
import {
  learningCompare,
  learningCreate,
  learningExperimentVersions,
  learningRead,
  type LearningComparison,
  type LearningExperimentVersion,
  type LearningPart,
  type LearningProposal,
  type LearningRows,
} from './lib/learning'
export * from './lib/learning'

type Answers = { [K in LearningPart]?: { rows?: LearningRows[K]; error?: unknown } }
type TabId = 'research' | 'experiments' | 'benchmarks'

const TABS: readonly TabId[] = ['research', 'experiments', 'benchmarks']
const INITIAL_VISIBLE = 5

const INK = 'var(--foreground)' as const
const SOFT = 'var(--muted-foreground)' as const
const STRONG = 'var(--border-strong)' as const
const ERR = 'var(--state-error)' as const
const OK = 'var(--state-success)' as const
const FOCUS_RING = { outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)', outlineOffset: 2 } as const

function CardsSkeleton({ label, count = 3 }: { label: string; count?: number }) {
  return (
    <YStack role="status" aria-busy={true} aria-label={label} gap="$2.5" width="100%">
      {Array.from({ length: count }, (_, i) => (
        <YStack key={i} gap="$2" p="$3.5" rounded="$4" borderWidth={1} borderColor="$edge" bg="$panel">
          <XStack items="center" justify="space-between" gap="$3">
            <Skeleton layout="block" width={i % 2 === 0 ? '42%' : '54%'} height={14} rounded="$2" />
            <Skeleton layout="block" width={96} height={20} rounded={999} shrink={0} />
          </XStack>
          <Skeleton layout="block" width={i % 2 === 0 ? '84%' : '72%'} height={11} rounded="$2" />
        </YStack>
      ))}
    </YStack>
  )
}

function ErrorCallout({ message }: { message: string }) {
  return (
    <XStack
      role="alert"
      items="center"
      gap="$2"
      px="$3"
      py="$2.5"
      rounded="$3"
      borderWidth={1}
      borderColor={ERR}
      bg="$panel"
    >
      <CircleAlert size={15} color={ERR} aria-hidden />
      <Text fontSize="$2" color={ERR} flex={1} minW={0}>
        {message}
      </Text>
    </XStack>
  )
}

function EmptyCard({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
  return (
    <YStack py="$6" px="$4" items="center" gap="$2.5" rounded="$4" borderWidth={1} borderColor="$edge" bg="$panel">
      <YStack items="center" gap="$1" maxW={440}>
        <Text fontSize="$3" fontWeight="500" color="$ink" text="center">
          {title}
        </Text>
        <Text fontSize="$2" color="$soft" text="center">
          {detail}
        </Text>
      </YStack>
      {children ? (
        <XStack gap="$2" flexWrap="wrap" justify="center">
          {children}
        </XStack>
      ) : null}
    </YStack>
  )
}

function StatusPill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <XStack
      items="center"
      gap="$1.5"
      px="$2"
      py={2}
      rounded={999}
      borderWidth={1}
      borderColor={active ? STRONG : '$edge'}
      bg="$background"
      shrink={0}
    >
      <YStack width={6} height={6} rounded={999} bg={active ? OK : '$soft'} shrink={0} aria-hidden />
      <Text fontSize="$1" fontWeight="500" color={active ? '$ink' : '$soft'}>
        {label}
      </Text>
    </XStack>
  )
}

/** The user's actual evidence and findings. Closed dialogs make no API requests. */
export function Learning({
  open,
  onClose,
  onOpenScience,
}: {
  open: boolean
  onClose: () => void
  onOpenScience?: () => void
}) {
  const { t } = useI18n()
  const { accessToken } = useIam()
  const tabId = useId()
  const tenant = org()
  const identity = `${tenant}:${accessToken ?? ''}`
  const [held, setHeld] = useState<{ identity: string; answers: Answers }>({ identity: '', answers: {} })
  const [revision, setRevision] = useState(0)
  const [tab, setTab] = useState<TabId>('research')
  const [form, setForm] = useState(false)
  const [advancedCriteria, setAdvancedCriteria] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [showAllStudies, setShowAllStudies] = useState(false)
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [showAllExperiments, setShowAllExperiments] = useState(false)
  const [showAllBenchmarks, setShowAllBenchmarks] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<unknown>(null)
  const draftId = useRef('')
  const [measuring, setMeasuring] = useState(false)
  const [inspectingId, setInspectingId] = useState('')
  const [measured, setMeasured] = useState<{
    identity: string
    versions?: { id: string; rows: LearningExperimentVersion[] }
    comparison?: LearningComparison
    error?: unknown
  }>({ identity: '' })
  const [pair, setPair] = useState({ benchmark: '', a: '', b: '' })
  const results = measured.identity === identity ? measured : null
  const [proposal, setProposal] = useState<LearningProposal>({
    title: '',
    question: '',
    baseline: '',
    target: '',
    metric: 'accuracy',
    category: 'all',
    direction: 'higher',
    minQuestions: 20,
    minGain: 1,
  })
  const answers = held.identity === identity ? held.answers : {}

  useEffect(() => {
    if (!open || !accessToken) return
    const controller = new AbortController()
    setHeld({ identity, answers: {} })
    for (const part of ['studies', 'reviews', 'experiments', 'benchmarks'] as const) {
      void learningRead(part, controller.signal).then(
        (rows) => {
          if (!controller.signal.aborted) setHeld((old) => ({ identity, answers: { ...old.answers, [part]: { rows } } }))
        },
        (error: unknown) => {
          if (!controller.signal.aborted) setHeld((old) => ({ identity, answers: { ...old.answers, [part]: { error } } }))
        },
      )
    }
    return () => controller.abort()
  }, [open, accessToken, identity, revision])

  const create = async () => {
    if (busy) return
    setBusy(true)
    setProblem(null)
    try {
      if (!draftId.current) draftId.current = `improvement-${crypto.randomUUID()}`
      await learningCreate(proposal, draftId.current)
      draftId.current = ''
      setForm(false)
      setAdvancedCriteria(false)
      setRevision((n) => n + 1)
    } catch (error) {
      setProblem(error)
    } finally {
      setBusy(false)
    }
  }

  const inspectVersions = async (id: string) => {
    setMeasuring(true)
    setInspectingId(id)
    setMeasured({ identity })
    try {
      const rows = await learningExperimentVersions(id)
      setMeasured({ identity, versions: { id, rows } })
    } catch (error) {
      setMeasured({ identity, error })
    } finally {
      setMeasuring(false)
      setInspectingId('')
    }
  }

  const compare = async () => {
    setMeasuring(true)
    setMeasured({ identity })
    try {
      setMeasured({ identity, comparison: await learningCompare(pair.benchmark, pair.a, pair.b) })
    } catch (error) {
      setMeasured({ identity, error })
    } finally {
      setMeasuring(false)
    }
  }

  const state = (part: LearningPart, loadingLabel: string) =>
    answers[part]?.error ? (
      <ErrorCallout message={say(answers[part]?.error, t('your learning activity'), 'read', t)} />
    ) : !answers[part]?.rows ? (
      <CardsSkeleton label={loadingLabel} count={part === 'reviews' ? 2 : 3} />
    ) : null

  const field = (key: 'title' | 'question' | 'baseline' | 'target' | 'metric' | 'category', label: string, placeholder?: string, row = false) => (
    <YStack
      gap="$1.5"
      {...(row ? { flex: 1, minW: 0, '$max-sm': { flexBasis: 'auto', grow: 0, minW: 0, width: '100%' } } : null)}
    >
      <Text fontSize="$2" fontWeight="500" color="$ink">
        {label}
      </Text>
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={proposal[key]}
        borderColor={STRONG}
        bg="$background"
        onChangeText={(value: string) => setProposal((old) => ({ ...old, [key]: value }))}
      />
    </YStack>
  )

  const studiesRows = answers.studies?.rows
  const reviewsRows = answers.reviews?.rows
  const experimentsRows = answers.experiments?.rows
  const benchmarksRows = answers.benchmarks?.rows

  const canCreate =
    !busy &&
    Boolean(proposal.baseline.trim()) &&
    Boolean(proposal.target.trim()) &&
    Boolean(proposal.title.trim()) &&
    Boolean(proposal.question.trim()) &&
    Boolean(proposal.metric.trim()) &&
    Number.isInteger(proposal.minQuestions) &&
    proposal.minQuestions >= 1 &&
    Number.isFinite(proposal.minGain) &&
    proposal.minGain >= 0

  const tabMeta: Record<TabId, { label: string; icon: ReactNode; count?: number }> = {
    research: { label: t('Research'), icon: <BookOpen size={14} color={tab === 'research' ? INK : SOFT} aria-hidden />, count: studiesRows?.length },
    experiments: { label: t('Experiments'), icon: <Beaker size={14} color={tab === 'experiments' ? INK : SOFT} aria-hidden />, count: experimentsRows?.length },
    benchmarks: { label: t('Benchmarks'), icon: <ChartBar size={14} color={tab === 'benchmarks' ? INK : SOFT} aria-hidden />, count: benchmarksRows?.length },
  }

  const visibleStudies = showAllStudies ? studiesRows : studiesRows?.slice(0, INITIAL_VISIBLE)
  const visibleReviews = showAllReviews ? reviewsRows : reviewsRows?.slice(0, INITIAL_VISIBLE)
  const visibleExperiments = showAllExperiments ? experimentsRows : experimentsRows?.slice(0, INITIAL_VISIBLE)
  const visibleBenchmarks = showAllBenchmarks ? benchmarksRows : benchmarksRows?.slice(0, INITIAL_VISIBLE)
  const showCompareForm = compareOpen || Boolean(results?.comparison) || Boolean(pair.benchmark.trim()) || benchmarksRows?.length === 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        width="100%"
        maxW={860}
        maxH="88vh"
        $max-sm={{ maxH: '94dvh' }}
        p={0}
        gap={0}
        showCloseButton={false}
        overflow="hidden"
        bg="$background"
        borderWidth={1}
        borderColor={STRONG}
        tabIndex={-1}
        focusVisibleStyle={{ outlineWidth: 0 }}
      >
        <XStack
          items="center"
          justify="space-between"
          gap="$3"
          px="$5"
          py="$4"
          $max-sm={{ px: '$4', py: '$3.5' }}
          borderBottomWidth={1}
          borderColor="$edge"
        >
          <XStack items="center" gap="$3" flex={1} minW={0}>
            <XStack width={34} height={34} rounded="$3" bg="$panel" borderWidth={1} borderColor="$edge" items="center" justify="center" shrink={0} aria-hidden>
              <FlaskConical size={16} color={INK} aria-hidden />
            </XStack>
            <YStack flex={1} minW={0} gap="$0.5">
              <DialogTitle>
                <Text fontSize="$5" fontWeight="600" color="$ink" numberOfLines={1}>
                  {t('Learning')}
                </Text>
              </DialogTitle>
              <Text fontSize="$2" color="$soft" numberOfLines={2}>
                {t('Research, test ideas, and review improvements backed by your workspace’s evidence.')}
              </Text>
            </YStack>
          </XStack>
          <XStack items="center" gap="$1" shrink={0}>
            {accessToken ? (
              <Box
                render={<button type="button" />}
                aria-label={t('Refresh')}
                onClick={() => setRevision((n) => n + 1)}
                width={32}
                height={32}
                $touchable={{ minW: 44, minH: 44 }}
                $max-sm={{ minW: 44, minH: 44 }}
                rounded="$2"
                display="inline-flex"
                items="center"
                justify="center"
                cursor="pointer"
                hoverStyle={{ bg: '$hover' }}
                focusVisibleStyle={FOCUS_RING}
              >
                <RefreshCw size={15} color={SOFT} aria-hidden />
              </Box>
            ) : null}
            <Box
              render={<button type="button" />}
              aria-label={t('Close')}
              onClick={onClose}
              width={32}
              height={32}
              $touchable={{ minW: 44, minH: 44 }}
              $max-sm={{ minW: 44, minH: 44 }}
              rounded="$2"
              display="inline-flex"
              items="center"
              justify="center"
              cursor="pointer"
              hoverStyle={{ bg: '$hover' }}
              focusVisibleStyle={FOCUS_RING}
            >
              <X size={16} color={SOFT} aria-hidden />
            </Box>
          </XStack>
        </XStack>

        <YStack flex={1} minH={0} overflow="scroll" px="$5" py="$4" $max-sm={{ px: '$4', py: '$3.5' }} gap="$4">
          {!accessToken ? (
            <YStack role="status">
              <EmptyCard title={t('Sign in required')} detail={t('Sign in to see your learning activity.')} />
            </YStack>
          ) : (
            <>
              <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap" $max-sm={{ flexDirection: 'column', items: 'stretch' }}>
                <XStack
                  role="tablist"
                  aria-label={t('Learning')}
                  p={3}
                  gap={2}
                  rounded="$3"
                  borderWidth={1}
                  borderColor={STRONG}
                  bg="$panel"
                  flexWrap="wrap"
                >
                  {TABS.map((id, idx) => {
                    const active = tab === id
                    const meta = tabMeta[id]
                    return (
                      <Box
                        key={id}
                        id={`${tabId}-${id}`}
                        render={<button type="button" />}
                        role="tab"
                        aria-selected={active}
                        aria-controls={`${tabId}-panel`}
                        tabIndex={active ? 0 : -1}
                        onClick={() => setTab(id)}
                        onKeyDown={((e: { key?: string; preventDefault?: () => void }) => {
                          let nextIdx: number | null = null
                          if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TABS.length
                          else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + TABS.length) % TABS.length
                          else if (e.key === 'Home') nextIdx = 0
                          else if (e.key === 'End') nextIdx = TABS.length - 1
                          if (nextIdx === null) return
                          e.preventDefault?.()
                          const nextTab = TABS[nextIdx]
                          if (!nextTab) return
                          setTab(nextTab)
                          queueMicrotask(() => document.getElementById(`${tabId}-${nextTab}`)?.focus())
                        }) as never}
                        display="inline-flex"
                        items="center"
                        justify="center"
                        gap="$1.5"
                        px="$3"
                        py="$1.5"
                        minH={32}
                        $touchable={{ minH: 44 }}
                        $max-sm={{ minH: 44, flex: 1 }}
                        rounded="$2"
                        cursor="pointer"
                        bg={active ? '$raised' : 'transparent'}
                        hoverStyle={{ bg: active ? '$raised' : '$hover' }}
                        focusVisibleStyle={FOCUS_RING}
                      >
                        {meta.icon}
                        <Text fontSize="$2" fontWeight={active ? '600' : '400'} color={active ? '$ink' : '$soft'}>
                          {meta.label}
                        </Text>
                        {typeof meta.count === 'number' && meta.count > 0 ? (
                          <Text fontSize="$1" color="$soft" fontVariant={['tabular-nums']}>
                            {meta.count}
                          </Text>
                        ) : null}
                      </Box>
                    )
                  })}
                </XStack>

                {tab === 'research' && !form ? (
                  <Button size="sm" variant="outline" borderColor={STRONG} $max-sm={{ width: '100%' }} onPress={() => setForm(true)}>
                    <Plus size={14} /> {t('New improvement study')}
                  </Button>
                ) : tab === 'benchmarks' && !showCompareForm ? (
                  <Button size="sm" variant="outline" borderColor={STRONG} $max-sm={{ width: '100%' }} onPress={() => setCompareOpen(true)}>
                    <SlidersHorizontal size={14} /> {t('Compare models')}
                  </Button>
                ) : null}
              </XStack>

              <YStack role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} gap="$4">
                {tab === 'research' ? (
                  <YStack gap="$4">
                    <Text fontSize="$2" color="$soft">
                      {t('A study with a baseline and acceptance criteria reviews new results as they arrive. Findings remain drafts until reviewed.')}
                    </Text>

                    {form ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault()
                          void create()
                        }}
                      >
                        <YStack gap="$3" p="$4" rounded="$4" borderWidth={1} borderColor={STRONG} bg="$panel">
                          <XStack items="center" justify="space-between" gap="$2">
                            <Text fontSize="$3" fontWeight="600" color="$ink">
                              {t('New improvement study')}
                            </Text>
                            <Box
                              render={<button type="button" />}
                              aria-label={t('Cancel')}
                              onClick={() => {
                                setForm(false)
                                setProblem(null)
                              }}
                              width={32}
                              height={32}
                              $touchable={{ minW: 44, minH: 44 }}
                              $max-sm={{ minW: 44, minH: 44 }}
                              rounded="$2"
                              display="inline-flex"
                              items="center"
                              justify="center"
                              cursor="pointer"
                              hoverStyle={{ bg: '$hover' }}
                              focusVisibleStyle={FOCUS_RING}
                            >
                              <X size={15} color={SOFT} aria-hidden />
                            </Box>
                          </XStack>

                          <XStack gap="$3" $max-sm={{ flexDirection: 'column', items: 'stretch' }}>
                            {field('title', t('Title'), t('Recovery correctness'), true)}
                            {field('target', t('App, harness, skill or connector'), 'hanzoai/dev', true)}
                          </XStack>
                          {field('question', t('Research question'), t('Does the new recovery path improve accuracy?'))}
                          {field('baseline', t('Baseline run ID'), 'run_...')}

                          <YStack rounded="$3" borderWidth={1} borderColor="$edge" bg="$background" overflow="hidden">
                            <Box
                              render={<button type="button" />}
                              aria-expanded={advancedCriteria}
                              onClick={() => setAdvancedCriteria((v) => !v)}
                              width="100%"
                              px="$3"
                              py="$2.5"
                              minH={44}
                              display="flex"
                              items="center"
                              justify="space-between"
                              gap="$2"
                              cursor="pointer"
                              hoverStyle={{ bg: '$hover' }}
                              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)', outlineOffset: -2 }}
                              $platform-web={{ textAlign: 'start' }}
                            >
                              <YStack flex={1} minW={0} gap="$0.5">
                                <Text fontSize="$2" fontWeight="500" color="$ink">
                                  {t('Evaluation criteria')}
                                </Text>
                                <Text fontSize="$1" color="$soft" numberOfLines={1}>
                                  {t('{metric} · {direction} · min {min} · gain {gain}', {
                                    metric: proposal.metric || 'accuracy',
                                    direction: proposal.direction === 'higher' ? t('Higher is better') : t('Lower is better'),
                                    min: proposal.minQuestions,
                                    gain: proposal.minGain,
                                  })}
                                </Text>
                              </YStack>
                              {advancedCriteria ? <ChevronUp size={15} color={SOFT} aria-hidden /> : <ChevronDown size={15} color={SOFT} aria-hidden />}
                            </Box>
                            {advancedCriteria ? (
                              <YStack p="$3" gap="$3" borderTopWidth={1} borderColor="$edge">
                                <XStack gap="$3" $max-sm={{ flexDirection: 'column', items: 'stretch' }}>
                                  {field('category', t('Metric category'), 'all', true)}
                                  {field('metric', t('Primary metric'), 'accuracy', true)}
                                </XStack>
                                <XStack gap="$3" items="flex-end" $max-sm={{ flexDirection: 'column', items: 'stretch' }}>
                                  <YStack gap="$1.5" flex={1} minW={0} $max-sm={{ flexBasis: 'auto', grow: 0, minW: 0, width: '100%' }}>
                                    <Text fontSize="$2" fontWeight="500" color="$ink">
                                      {t('Minimum completed evaluation size')}
                                    </Text>
                                    <Input
                                      aria-label={t('Minimum completed evaluation size')}
                                      type="number"
                                      borderColor={STRONG}
                                      bg="$panel"
                                      value={String(proposal.minQuestions)}
                                      onChangeText={(v: string) => setProposal((p) => ({ ...p, minQuestions: Number(v) }))}
                                    />
                                  </YStack>
                                  <YStack gap="$1.5" flex={1} minW={0} $max-sm={{ flexBasis: 'auto', grow: 0, minW: 0, width: '100%' }}>
                                    <Text fontSize="$2" fontWeight="500" color="$ink">
                                      {t('Minimum gain in metric units')}
                                    </Text>
                                    <Input
                                      aria-label={t('Minimum gain in metric units')}
                                      type="number"
                                      borderColor={STRONG}
                                      bg="$panel"
                                      value={String(proposal.minGain)}
                                      onChangeText={(v: string) => setProposal((p) => ({ ...p, minGain: Number(v) }))}
                                    />
                                  </YStack>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    borderColor={STRONG}
                                    shrink={0}
                                    onPress={() => setProposal((p) => ({ ...p, direction: p.direction === 'higher' ? 'lower' : 'higher' }))}
                                  >
                                    {proposal.direction === 'higher' ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
                                    {proposal.direction === 'higher' ? t('Higher is better') : t('Lower is better')}
                                  </Button>
                                </XStack>
                              </YStack>
                            ) : null}
                          </YStack>

                          <XStack items="center" gap="$2">
                            <ShieldCheck size={14} color={SOFT} aria-hidden />
                            <Text fontSize="$1" color="$soft" flex={1} minW={0}>
                              {t('This enables evaluation of recorded results. It does not start a model call or change a live app.')}
                            </Text>
                          </XStack>

                          {problem ? <ErrorCallout message={say(problem, t('this study'), 'save', t)} /> : null}

                          <XStack gap="$2" justify="flex-end" flexWrap="wrap">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onPress={() => {
                                setForm(false)
                                setProblem(null)
                              }}
                            >
                              {t('Cancel')}
                            </Button>
                            <Button type="submit" size="sm" variant="primary" tone="accent" disabled={!canCreate}>
                              {busy ? t('Saving…') : t('Enable study')}
                            </Button>
                          </XStack>
                        </YStack>
                      </form>
                    ) : null}

                    <YStack gap="$2.5">
                      <XStack items="center" justify="space-between" gap="$2">
                        <Text fontSize="$3" fontWeight="600" color="$ink">
                          {t('Studies')}
                        </Text>
                        {studiesRows?.length ? (
                          <Text fontSize="$1" color="$soft" fontVariant={['tabular-nums']}>
                            {t('{n} total', { n: studiesRows.length })}
                          </Text>
                        ) : null}
                      </XStack>
                      {state('studies', t('Loading studies'))}
                      {visibleStudies?.map((study) => (
                        <YStack key={`${study.project}:${study.id}`} gap="$1.5" p="$3.5" rounded="$4" borderWidth={1} borderColor="$edge" bg="$panel">
                          <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
                            <Text fontSize="$3" fontWeight="500" color="$ink" flex={1} minW={0}>
                              {study.title || study.id}
                            </Text>
                            <StatusPill label={study.improvement ? t('Automatic review enabled') : t('Evidence only')} active={Boolean(study.improvement)} />
                          </XStack>
                          {study.question ? (
                            <Text fontSize="$2" color="$soft">
                              {study.question}
                            </Text>
                          ) : null}
                          {study.improvement ? (
                            <Text fontSize="$1" color="$soft" fontFamily="$mono">
                              {study.improvement.target} · {study.improvement.baseline}
                            </Text>
                          ) : null}
                        </YStack>
                      ))}
                      {studiesRows && studiesRows.length > INITIAL_VISIBLE ? (
                        <XStack>
                          <Button size="sm" variant="outline" borderColor={STRONG} onPress={() => setShowAllStudies((v) => !v)}>
                            {showAllStudies ? t('Show fewer') : t('Show all {n} studies', { n: studiesRows.length })}
                          </Button>
                        </XStack>
                      ) : null}
                      {studiesRows?.length === 0 ? (
                        <EmptyCard title={t('No studies yet')} detail={t('No studies yet. Create one to review recorded results continuously.')}>
                          {!form ? (
                            <Button size="sm" variant="outline" borderColor={STRONG} onPress={() => setForm(true)}>
                              <Plus size={14} /> {t('New improvement study')}
                            </Button>
                          ) : null}
                        </EmptyCard>
                      ) : null}
                    </YStack>

                    <YStack gap="$2.5">
                      <XStack items="center" justify="space-between" gap="$2">
                        <Text fontSize="$3" fontWeight="600" color="$ink">
                          {t('Improvement findings')}
                        </Text>
                        {reviewsRows?.length ? (
                          <Text fontSize="$1" color="$soft" fontVariant={['tabular-nums']}>
                            {t('{n} total', { n: reviewsRows.length })}
                          </Text>
                        ) : null}
                      </XStack>
                      {answers.studies?.error && answers.reviews?.error ? null : state('reviews', t('Loading improvement findings'))}
                      {visibleReviews?.map((row) => (
                        <YStack key={row.id} gap="$1.5" p="$3.5" rounded="$4" borderWidth={1} borderColor="$edge" bg="$panel">
                          <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
                            <Text fontSize="$3" fontWeight="500" color="$ink" fontFamily="$mono" flex={1} minW={0}>
                              {row.action.review?.target || row.id}
                            </Text>
                            <StatusPill label={[row.action.review?.status, row.status].filter(Boolean).join(' · ')} />
                          </XStack>
                          {row.action.description ? (
                            <Text fontSize="$2" color="$soft">
                              {row.action.description}
                            </Text>
                          ) : null}
                          {row.action.review?.blocks?.length ? (
                            <YStack gap="$1" pt="$1" borderTopWidth={1} borderColor="$edge">
                              {row.action.review.blocks.map((block, i) => (
                                <Text key={i} fontSize="$1" color="$soft">
                                  {block}
                                </Text>
                              ))}
                            </YStack>
                          ) : null}
                        </YStack>
                      ))}
                      {reviewsRows && reviewsRows.length > INITIAL_VISIBLE ? (
                        <XStack>
                          <Button size="sm" variant="outline" borderColor={STRONG} onPress={() => setShowAllReviews((v) => !v)}>
                            {showAllReviews ? t('Show fewer') : t('Show all {n} findings', { n: reviewsRows.length })}
                          </Button>
                        </XStack>
                      ) : null}
                      {reviewsRows?.length === 0 ? (
                        <EmptyCard
                          title={t('No findings yet')}
                          detail={t('Findings appear when a study has baseline and candidate results. No result is being claimed yet.')}
                        />
                      ) : null}
                    </YStack>
                  </YStack>
                ) : tab === 'experiments' ? (
                  <YStack gap="$3.5">
                    <XStack items="center" justify="space-between" gap="$3" flexWrap="wrap">
                      <Text fontSize="$2" color="$soft" flex={1} minW={200}>
                        {t('Recorded experiments from the research ledger (/v1/research/experiments), with versioned lineage and provenance.')}
                      </Text>
                      {onOpenScience ? (
                        <Button size="sm" variant="outline" borderColor={STRONG} shrink={0} onPress={onOpenScience}>
                          {t('Open Hanzo Science')}
                        </Button>
                      ) : null}
                    </XStack>

                    {results?.error ? <ErrorCallout message={say(results.error, t('this experiment'), 'read', t)} /> : null}

                    {results?.versions ? (
                      <YStack gap="$3" p="$4" rounded="$4" borderWidth={1} borderColor={STRONG} bg="$panel">
                        <XStack items="center" justify="space-between" gap="$2">
                          <XStack items="center" gap="$2" flexWrap="wrap" flex={1} minW={0}>
                            <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
                              {t('Retained versions: {id}', { id: results.versions.id })}
                            </Text>
                            <StatusPill label={t('{n} retained', { n: results.versions.rows.length })} active={results.versions.rows.length > 0} />
                          </XStack>
                          <Box
                            render={<button type="button" />}
                            aria-label={t('Dismiss version history')}
                            onClick={() => setMeasured({ identity })}
                            width={32}
                            height={32}
                            $touchable={{ minW: 44, minH: 44 }}
                            $max-sm={{ minW: 44, minH: 44 }}
                            rounded="$2"
                            display="inline-flex"
                            items="center"
                            justify="center"
                            cursor="pointer"
                            hoverStyle={{ bg: '$hover' }}
                            focusVisibleStyle={FOCUS_RING}
                          >
                            <X size={15} color={SOFT} aria-hidden />
                          </Box>
                        </XStack>
                        {results.versions.rows.length === 0 ? (
                          <Text fontSize="$2" color="$soft">
                            {t('No retained version entries were returned for this experiment.')}
                          </Text>
                        ) : (
                          <YStack gap="$2">
                            {results.versions.rows.map((ver, idx) => (
                              <YStack key={`${ver.id}-${ver.seq ?? idx}`} gap="$1" p="$3" rounded="$3" borderWidth={1} borderColor="$edge" bg="$background">
                                <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
                                  <Text fontSize="$2" fontWeight="500" color="$ink">
                                    {ver.revision}{ver.seq != null ? ` · #${ver.seq}` : ''}
                                  </Text>
                                  <XStack items="center" gap="$2">
                                    {ver.canonical ? <StatusPill label={t('Canonical')} active /> : null}
                                    <StatusPill label={ver.status} />
                                  </XStack>
                                </XStack>
                                <XStack items="center" gap="$2.5" flexWrap="wrap">
                                  {ver.metric && typeof ver.value === 'number' ? (
                                    <Text fontSize="$1" color="$ink" fontVariant={['tabular-nums']}>
                                      {`${ver.metric}: ${Number.isInteger(ver.value) ? ver.value : ver.value.toFixed(4)}`}
                                    </Text>
                                  ) : null}
                                  {ver.git_sha ? (
                                    <Text fontSize="$1" color="$soft">
                                      {ver.git_sha.slice(0, 8)}
                                    </Text>
                                  ) : null}
                                </XStack>
                              </YStack>
                            ))}
                          </YStack>
                        )}
                      </YStack>
                    ) : null}

                    {state('experiments', t('Loading experiments'))}
                    {visibleExperiments?.map((row) => {
                      const verdict = typeof row.meta?.verdict === 'string' && row.meta.verdict.trim() ? row.meta.verdict.trim() : ''
                      const badge = verdict || row.status || 'complete'
                      const qualified = /^(proven|qualified|pass|passed|win)$/i.test(badge)
                      return (
                        <XStack
                          key={row.id}
                          items="center"
                          justify="space-between"
                          gap="$3"
                          p="$3.5"
                          rounded="$4"
                          borderWidth={1}
                          borderColor="$edge"
                          bg="$panel"
                          $max-sm={{ flexDirection: 'column', items: 'stretch' }}
                        >
                          <YStack flex={1} minW={0} gap="$1" $max-sm={{ flexBasis: 'auto', grow: 0, minW: 0, width: '100%' }}>
                            <Text fontSize="$3" fontWeight="500" color="$ink" numberOfLines={1}>
                              {row.subject || row.id}
                            </Text>
                            {row.subject && row.subject !== row.id ? (
                              <Text fontSize="$1" color="$soft" numberOfLines={1}>
                                {row.id}
                              </Text>
                            ) : null}
                            <XStack items="center" gap="$2" flexWrap="wrap">
                              <StatusPill label={badge} active={qualified} />
                              {row.kind ? (
                                <Text fontSize="$1" color="$soft">
                                  {row.kind}
                                </Text>
                              ) : null}
                              {row.metric && typeof row.value === 'number' ? (
                                <Text fontSize="$1" color="$ink" fontVariant={['tabular-nums']}>
                                  {`${row.metric}: ${Number.isInteger(row.value) ? row.value : row.value.toFixed(4)}`}
                                </Text>
                              ) : null}
                              {row.project ? (
                                <Text fontSize="$1" color="$soft">
                                  {row.project}
                                </Text>
                              ) : null}
                              {row.git_sha ? (
                                <Text fontSize="$1" color="$soft">
                                  {row.git_sha.slice(0, 8)}
                                </Text>
                              ) : null}
                            </XStack>
                          </YStack>
                          <Button size="sm" variant="outline" borderColor={STRONG} shrink={0} disabled={measuring} onPress={() => void inspectVersions(row.id)}>
                            {measuring && inspectingId === row.id ? t('Loading…') : t('Version history')}
                          </Button>
                        </XStack>
                      )
                    })}
                    {experimentsRows && experimentsRows.length > INITIAL_VISIBLE ? (
                      <XStack>
                        <Button size="sm" variant="outline" borderColor={STRONG} onPress={() => setShowAllExperiments((v) => !v)}>
                          {showAllExperiments ? t('Show fewer') : t('Show all {n} experiments', { n: experimentsRows.length })}
                        </Button>
                      </XStack>
                    ) : null}
                    {experimentsRows?.length === 0 ? (
                      <EmptyCard title={t('No research experiments yet')} detail={t('Experiments recorded to /v1/research/experiments appear here once runs are logged for your workspace.')} />
                    ) : null}
                  </YStack>
                ) : (
                  <YStack gap="$4">
                    <Text fontSize="$2" color="$soft">
                      {t('Benchmarks compare actual measurements. Requesting a benchmark result does not execute an evaluation harness.')}
                    </Text>

                    {showCompareForm ? (
                      <YStack gap="$3" p="$4" rounded="$4" borderWidth={1} borderColor={STRONG} bg="$panel">
                        <XStack items="center" justify="space-between" gap="$2">
                          <Text fontSize="$3" fontWeight="600" color="$ink">
                            {t('Compare two models')}
                          </Text>
                          {benchmarksRows && benchmarksRows.length > 0 ? (
                            <Box
                              render={<button type="button" />}
                              aria-label={t('Hide comparison')}
                              onClick={() => {
                                setCompareOpen(false)
                                setPair({ benchmark: '', a: '', b: '' })
                                setMeasured({ identity })
                              }}
                              width={32}
                              height={32}
                              $touchable={{ minW: 44, minH: 44 }}
                              $max-sm={{ minW: 44, minH: 44 }}
                              rounded="$2"
                              display="inline-flex"
                              items="center"
                              justify="center"
                              cursor="pointer"
                              hoverStyle={{ bg: '$hover' }}
                              focusVisibleStyle={FOCUS_RING}
                            >
                              <X size={15} color={SOFT} aria-hidden />
                            </Box>
                          ) : null}
                        </XStack>

                        <XStack gap="$2.5" $max-sm={{ flexDirection: 'column', items: 'stretch' }}>
                          <YStack gap="$1.5" flex={1} minW={0} $max-sm={{ flexBasis: 'auto', grow: 0, minW: 0, width: '100%' }}>
                            <Text fontSize="$2" fontWeight="500" color="$ink">
                              {t('Benchmark ID')}
                            </Text>
                            <Input
                              aria-label={t('Benchmark ID')}
                              placeholder="gpqa_diamond"
                              borderColor={STRONG}
                              bg="$background"
                              value={pair.benchmark}
                              onChangeText={(benchmark: string) => setPair((p) => ({ ...p, benchmark }))}
                            />
                          </YStack>
                          <YStack gap="$1.5" flex={1} minW={0} $max-sm={{ flexBasis: 'auto', grow: 0, minW: 0, width: '100%' }}>
                            <Text fontSize="$2" fontWeight="500" color="$ink">
                              {t('First model ID')}
                            </Text>
                            <Input
                              aria-label={t('First model ID')}
                              placeholder={t('First model ID')}
                              borderColor={STRONG}
                              bg="$background"
                              value={pair.a}
                              onChangeText={(a: string) => setPair((p) => ({ ...p, a }))}
                            />
                          </YStack>
                          <YStack gap="$1.5" flex={1} minW={0} $max-sm={{ flexBasis: 'auto', grow: 0, minW: 0, width: '100%' }}>
                            <Text fontSize="$2" fontWeight="500" color="$ink">
                              {t('Second model ID')}
                            </Text>
                            <Input
                              aria-label={t('Second model ID')}
                              placeholder={t('Second model ID')}
                              borderColor={STRONG}
                              bg="$background"
                              value={pair.b}
                              onChangeText={(b: string) => setPair((p) => ({ ...p, b }))}
                            />
                          </YStack>
                        </XStack>

                        <XStack justify="flex-end">
                          <Button
                            size="sm"
                            variant="primary"
                            tone="accent"
                            $max-sm={{ width: '100%' }}
                            disabled={measuring || !pair.benchmark.trim() || !pair.a.trim() || !pair.b.trim()}
                            onPress={() => void compare()}
                          >
                            {measuring ? t('Comparing…') : t('Compare measurements')}
                          </Button>
                        </XStack>

                        {results?.error ? <ErrorCallout message={say(results.error, t('these benchmark results'), 'read', t)} /> : null}

                        {results?.comparison ? (
                          <YStack gap="$2" p="$3" rounded="$3" borderWidth={1} borderColor="$edge" bg="$background">
                            {results.comparison.n_common === 0 ? (
                              <Text fontSize="$2" color="$soft">
                                {t('No shared measured items. Record both evaluations before comparing.')}
                              </Text>
                            ) : (
                              <>
                                <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
                                  <Text fontSize="$2" fontWeight="500" color="$ink" fontVariant={['tabular-nums']}>
                                    {t('{count} shared measured items', { count: results.comparison.n_common })}
                                  </Text>
                                  {Number.isFinite(results.comparison.mcnemar_p) ? (
                                    <Text fontSize="$1" color="$soft" fontFamily="$mono" fontVariant={['tabular-nums']}>
                                      {`p = ${results.comparison.mcnemar_p.toFixed(4)}`}
                                    </Text>
                                  ) : null}
                                </XStack>
                                <XStack gap="$3" $max-sm={{ flexDirection: 'column', items: 'stretch' }}>
                                  <YStack flex={1} minW={0} p="$2.5" rounded="$3" borderWidth={1} borderColor="$edge" bg="$panel" gap="$0.5" $max-sm={{ flexBasis: 'auto', grow: 0, minW: 0, width: '100%' }}>
                                    <Text fontSize="$1" color="$soft" fontFamily="$mono" numberOfLines={1}>
                                      {results.comparison.a}
                                    </Text>
                                    <Text fontSize="$4" fontWeight="600" color="$ink" fontVariant={['tabular-nums']}>
                                      {String(results.comparison.a_correct)}
                                    </Text>
                                  </YStack>
                                  <YStack flex={1} minW={0} p="$2.5" rounded="$3" borderWidth={1} borderColor="$edge" bg="$panel" gap="$0.5" $max-sm={{ flexBasis: 'auto', grow: 0, minW: 0, width: '100%' }}>
                                    <Text fontSize="$1" color="$soft" fontFamily="$mono" numberOfLines={1}>
                                      {results.comparison.b}
                                    </Text>
                                    <Text fontSize="$4" fontWeight="600" color="$ink" fontVariant={['tabular-nums']}>
                                      {String(results.comparison.b_correct)}
                                    </Text>
                                  </YStack>
                                </XStack>
                              </>
                            )}
                          </YStack>
                        ) : null}
                      </YStack>
                    ) : null}

                    <YStack gap="$2.5">
                      <XStack items="center" justify="space-between" gap="$2">
                        <Text fontSize="$3" fontWeight="600" color="$ink">
                          {t('Benchmark catalog')}
                        </Text>
                        {benchmarksRows?.length ? (
                          <Text fontSize="$1" color="$soft" fontVariant={['tabular-nums']}>
                            {t('{n} total', { n: benchmarksRows.length })}
                          </Text>
                        ) : null}
                      </XStack>
                      {state('benchmarks', t('Loading benchmarks'))}
                      {visibleBenchmarks?.map((row) => {
                        const selected = pair.benchmark === row.id
                        return (
                          <XStack
                            key={row.id}
                            items="center"
                            justify="space-between"
                            gap="$3"
                            p="$3.5"
                            rounded="$4"
                            borderWidth={1}
                            borderColor={selected ? STRONG : '$edge'}
                            bg="$panel"
                            $max-sm={{ flexDirection: 'column', items: 'stretch' }}
                          >
                            <YStack flex={1} minW={0} gap="$0.5" $max-sm={{ flexBasis: 'auto', grow: 0, minW: 0, width: '100%' }}>
                              <Text fontSize="$3" fontWeight="500" color="$ink">
                                {row.name || row.id}
                              </Text>
                              <XStack items="center" gap="$1.5">
                                {row.direction === 'lower' ? <TrendingDown size={13} color={SOFT} aria-hidden /> : <TrendingUp size={13} color={SOFT} aria-hidden />}
                                <Text fontSize="$1" color="$soft">
                                  {row.direction === 'lower' ? t('Lower is better') : t('Higher is better')}
                                </Text>
                              </XStack>
                            </YStack>
                            <Button
                              size="sm"
                              variant="outline"
                              borderColor={STRONG}
                              shrink={0}
                              onPress={() => {
                                setPair((p) => ({ ...p, benchmark: row.id }))
                                setCompareOpen(true)
                              }}
                            >
                              {selected ? t('Selected') : t('Use this benchmark')}
                            </Button>
                          </XStack>
                        )
                      })}
                      {benchmarksRows && benchmarksRows.length > INITIAL_VISIBLE ? (
                        <XStack>
                          <Button size="sm" variant="outline" borderColor={STRONG} onPress={() => setShowAllBenchmarks((v) => !v)}>
                            {showAllBenchmarks ? t('Show fewer') : t('Show all {n} benchmarks', { n: benchmarksRows.length })}
                          </Button>
                        </XStack>
                      ) : null}
                      {benchmarksRows?.length === 0 ? (
                        <EmptyCard title={t('No benchmarks listed')} detail={t('Enter any recorded benchmark ID above to compare two models.')} />
                      ) : null}
                    </YStack>
                  </YStack>
                )}
              </YStack>
            </>
          )}
        </YStack>
      </DialogContent>
    </Dialog>
  )
}
