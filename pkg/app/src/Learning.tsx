'use client'

import { useI18n } from '@hanzo/i18n/react'
import { useIam } from '@hanzo/iam/react'
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, DialogContent, DialogTitle, Input, Text, XStack, YStack } from '@hanzo/ui'
import { say } from './failure'
import { org } from './lib/session'
import { learningAnalyze, learningCompare, learningCreate, learningRead, type LearningAnalysis, type LearningComparison, type LearningPart, type LearningProposal, type LearningRows } from './learning'

type Answers = { [K in LearningPart]?: { rows?: LearningRows[K]; error?: unknown } }

/** The user's actual evidence and findings. Closed dialogs make no API requests. */
export function Learning({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const { accessToken } = useIam()
  const tenant = org()
  const identity = `${tenant}:${accessToken ?? ''}`
  const [held, setHeld] = useState<{ identity: string; answers: Answers }>({ identity: '', answers: {} })
  const [revision, setRevision] = useState(0)
  const [tab, setTab] = useState<'research' | 'experiments' | 'benchmarks'>('research')
  const [form, setForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<unknown>(null)
  const draftId = useRef('')
  const [measuring, setMeasuring] = useState(false)
  const [measured, setMeasured] = useState<{ identity: string; analysis?: LearningAnalysis; comparison?: LearningComparison; error?: unknown }>({ identity: '' })
  const [pair, setPair] = useState({ benchmark: '', a: '', b: '' })
  const results = measured.identity === identity ? measured : null
  const [proposal, setProposal] = useState<LearningProposal>({ title: '', question: '', baseline: '', target: '', metric: 'accuracy', category: 'all', direction: 'higher', minQuestions: 20, minGain: 1 })
  const answers = held.identity === identity ? held.answers : {}
  useEffect(() => {
    if (!open || !accessToken) return
    const controller = new AbortController()
    setHeld({ identity, answers: {} })
    for (const part of ['studies', 'reviews', 'experiments', 'benchmarks'] as const) {
      void learningRead(part, controller.signal).then(
        (rows) => { if (!controller.signal.aborted) setHeld((old) => ({ identity, answers: { ...old.answers, [part]: { rows } } })) },
        (error: unknown) => { if (!controller.signal.aborted) setHeld((old) => ({ identity, answers: { ...old.answers, [part]: { error } } })) },
      )
    }
    return () => controller.abort()
  }, [open, accessToken, identity, revision])

  const create = async () => {
    if (busy) return
    setBusy(true); setProblem(null)
    try {
      if (!draftId.current) draftId.current = `improvement-${crypto.randomUUID()}`
      await learningCreate(proposal, draftId.current)
      draftId.current = ''
      setForm(false); setRevision((n) => n + 1)
    } catch (error) { setProblem(error) } finally { setBusy(false) }
  }
  const analyze = async (id: string) => {
    setMeasuring(true); setMeasured({ identity })
    try { setMeasured({ identity, analysis: await learningAnalyze(id) }) }
    catch (error) { setMeasured({ identity, error }) } finally { setMeasuring(false) }
  }
  const compare = async () => {
    setMeasuring(true); setMeasured({ identity })
    try { setMeasured({ identity, comparison: await learningCompare(pair.benchmark, pair.a, pair.b) }) }
    catch (error) { setMeasured({ identity, error }) } finally { setMeasuring(false) }
  }
  const state = (part: LearningPart) => answers[part]?.error
    ? <Text role="alert" color="$soft">{say(answers[part]?.error, t('your learning activity'), 'read', t)}</Text>
    : !answers[part]?.rows ? <Text color="$soft">{t('Loading…')}</Text> : null
  const field = (key: 'title' | 'question' | 'baseline' | 'target' | 'metric' | 'category', label: string) => (
    <YStack gap="$1"><Text fontSize="$2">{label}</Text><Input aria-label={label} value={proposal[key]} onChangeText={(value: string) => setProposal((old) => ({ ...old, [key]: value }))} /></YStack>
  )

  return <Dialog open={open} onOpenChange={(next: boolean) => { if (!next) onClose() }}>
    <DialogContent width="100%" maxW={900} p="$5">
      <YStack gap="$4" maxH="80vh" overflow="scroll">
        <XStack items="center" justify="space-between" gap="$2">
          <DialogTitle><Text fontSize="$5">{t('Learning')}</Text></DialogTitle>
          <Button size="sm" onPress={onClose}>{t('Close')}</Button>
        </XStack>
        <Text color="$soft">{t('Research, test ideas, and review improvements backed by your workspace’s evidence.')}</Text>
        {!accessToken ? <Text role="status">{t('Sign in to see your learning activity.')}</Text> : <>
          <XStack gap="$2" flexWrap="wrap" role="tablist" aria-label={t('Learning')}>
            <Button role="tab" aria-selected={tab === 'research'} onPress={() => setTab('research')}>{t('Research')}</Button>
            <Button role="tab" aria-selected={tab === 'experiments'} onPress={() => setTab('experiments')}>{t('Experiments')}</Button>
            <Button role="tab" aria-selected={tab === 'benchmarks'} onPress={() => setTab('benchmarks')}>{t('Benchmarks')}</Button>
            <Button size="sm" onPress={() => setRevision((n) => n + 1)}>{t('Refresh')}</Button>
          </XStack>
          {tab === 'research' ? <YStack gap="$3">
            <Text color="$soft">{t('A study with a baseline and acceptance criteria reviews new results as they arrive. Findings remain drafts until reviewed.')}</Text>
            <Button size="sm" onPress={() => setForm(!form)}>{form ? t('Cancel') : t('New improvement study')}</Button>
            {form ? <form onSubmit={(event) => { event.preventDefault(); void create() }}><YStack gap="$2">
              {field('title', t('Title'))}{field('question', t('Research question'))}{field('baseline', t('Baseline run ID'))}{field('target', t('App, harness, skill or connector'))}
              {field('category', t('Metric category'))}{field('metric', t('Primary metric'))}
              <XStack gap="$2"><Button type="button" size="sm" onPress={() => setProposal((p) => ({ ...p, direction: p.direction === 'higher' ? 'lower' : 'higher' }))}>{proposal.direction === 'higher' ? t('Higher is better') : t('Lower is better')}</Button></XStack>
              <Text fontSize="$2">{t('Minimum completed evaluation size')}</Text>
              <Input aria-label={t('Minimum completed evaluation size')} type="number" value={String(proposal.minQuestions)} onChangeText={(v: string) => setProposal((p) => ({ ...p, minQuestions: Number(v) }))} />
              <Text fontSize="$2">{t('Minimum gain in metric units')}</Text>
              <Input aria-label={t('Minimum gain in metric units')} type="number" value={String(proposal.minGain)} onChangeText={(v: string) => setProposal((p) => ({ ...p, minGain: Number(v) }))} />
              <Text color="$soft">{t('This enables evaluation of recorded results. It does not start a model call or change a live app.')}</Text>
              {problem ? <Text role="alert">{say(problem, t('this study'), 'save', t)}</Text> : null}
              <Button type="submit" disabled={busy || !proposal.baseline.trim() || !proposal.target.trim() || !proposal.title.trim() || !proposal.question.trim() || !proposal.metric.trim() || !Number.isInteger(proposal.minQuestions) || proposal.minQuestions < 1 || !Number.isFinite(proposal.minGain) || proposal.minGain < 0}>{busy ? t('Saving…') : t('Enable study')}</Button>
            </YStack></form> : null}
            {state('studies')}
            {answers.studies?.rows?.map((study) => <YStack key={`${study.project}:${study.id}`} gap="$1" p="$3" bg="$panel" rounded="$3">
              <Text>{study.title || study.id}</Text><Text color="$soft">{study.question}</Text>
              <Text fontSize="$2">{study.improvement ? t('Automatic review enabled') : t('Evidence only')}</Text>
            </YStack>)}
            {answers.studies?.rows?.length === 0 ? <Text color="$soft">{t('No studies yet. Create one to review recorded results continuously.')}</Text> : null}
            <Text fontSize="$4">{t('Improvement findings')}</Text>{state('reviews')}
            {answers.reviews?.rows?.map((row) => <YStack key={row.id} gap="$1" p="$3" bg="$panel" rounded="$3">
              <Text>{row.action.review?.target}</Text><Text>{row.action.review?.status} · {row.status}</Text>
              <Text color="$soft">{row.action.description}</Text>
              {row.action.review?.blocks?.map((block, i) => <Text key={i} fontSize="$2" color="$soft">{block}</Text>)}
            </YStack>)}
            {answers.reviews?.rows?.length === 0 ? <Text color="$soft">{t('Findings appear when a study has baseline and candidate results. No result is being claimed yet.')}</Text> : null}
          </YStack> : tab === 'experiments' ? <YStack gap="$3">
            <Text color="$soft">{t('Controlled experiments assign variants and measure their outcomes. Choosing a winner changes a live rollout and requires an authorized review.')}</Text>
            {state('experiments')}
            {answers.experiments?.rows?.map((row) => <YStack key={row.id} gap="$1" p="$3" bg="$panel" rounded="$3"><Text>{row.name || row.id}</Text><Text color="$soft">{row.status}{row.winner ? ` · ${row.winner}` : ''}</Text><Button size="sm" disabled={measuring} onPress={() => void analyze(row.id)}>{t('Analyze outcomes')}</Button></YStack>)}
            {results?.error ? <Text role="alert">{say(results.error, t('this experiment'), 'read', t)}</Text> : null}
            {results?.analysis?.results?.map((row) => <YStack key={row.variant} gap="$1"><Text>{row.variant}</Text><Text color="$soft">{t('{converted} of {exposed} converted', { converted: row.converted, exposed: row.exposed })}</Text></YStack>)}
            {answers.experiments?.rows?.length === 0 ? <Text color="$soft">{t('No controlled experiments yet.')}</Text> : null}
          </YStack> : <YStack gap="$3">
            <Text color="$soft">{t('Benchmarks compare actual measurements. Requesting a benchmark result does not execute an evaluation harness.')}</Text>
            {state('benchmarks')}
            <Input aria-label={t('Benchmark ID')} placeholder={t('Benchmark ID')} value={pair.benchmark} onChangeText={(benchmark: string) => setPair((p) => ({ ...p, benchmark }))} />
            <Input aria-label={t('First model ID')} placeholder={t('First model ID')} value={pair.a} onChangeText={(a: string) => setPair((p) => ({ ...p, a }))} />
            <Input aria-label={t('Second model ID')} placeholder={t('Second model ID')} value={pair.b} onChangeText={(b: string) => setPair((p) => ({ ...p, b }))} />
            <Button disabled={measuring || !pair.benchmark.trim() || !pair.a.trim() || !pair.b.trim()} onPress={() => void compare()}>{t('Compare measurements')}</Button>
            {results?.error ? <Text role="alert">{say(results.error, t('these benchmark results'), 'read', t)}</Text> : null}
            {results?.comparison ? <YStack gap="$1">
              {results.comparison.n_common === 0 ? <Text>{t('No shared measured items. Record both evaluations before comparing.')}</Text> : <>
                <Text>{t('{count} shared measured items', { count: results.comparison.n_common })}</Text>
                <Text>{results.comparison.a}: {results.comparison.a_correct} · {results.comparison.b}: {results.comparison.b_correct}</Text>
              </>}
            </YStack> : null}
            {answers.benchmarks?.rows?.map((row) => <YStack key={row.id} gap="$1" p="$3" bg="$panel" rounded="$3"><Text>{row.name || row.id}</Text><Text color="$soft">{row.direction === 'lower' ? t('Lower is better') : t('Higher is better')}</Text><Button size="sm" onPress={() => setPair((p) => ({ ...p, benchmark: row.id }))}>{t('Use this benchmark')}</Button></YStack>)}
          </YStack>}
        </>}
      </YStack>
    </DialogContent>
  </Dialog>
}
