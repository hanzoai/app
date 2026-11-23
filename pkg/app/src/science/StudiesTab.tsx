'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Input, Spinner, Switch, Text } from '@hanzo/ui'
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  GitCommit,
  GitCompare,
  Layers,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import {
  compareRuns,
  fetchAndVerifyArtifact,
  filterExperiments,
  getEvidenceById,
  listArtifacts,
  listEvidenceByUri,
  listExperimentVersions,
} from './api'
import {
  classifyVerdict,
  provenanceLinks,
  verdictLabel,
  type ArtifactRecord,
  type BenchmarkRecord,
  type ComparisonResult,
  type EvidenceRecord,
  type ExperimentRecord,
  type ExperimentVersionRecord,
  type RunRecord,
  type StudyRecord,
  type VerdictClass,
  type VerifiedArtifactBlob,
} from './types'

type SubSection = 'experiments' | 'runs' | 'studies' | 'benchmarks'

const VERDICT_FILTERS: readonly ('all' | VerdictClass)[] = [
  'all',
  'proven',
  'promising_inconclusive',
  'inconclusive',
  'refuted',
]

const BACKEND_FILTERS = ['all', 'CUDA', 'ROCM', 'METAL', 'VULKAN', 'CPU'] as const

export function StudiesTab({
  studies,
  benchmarks,
  runs,
  allExperiments,
  initialSelectedExperiment,
  onClearInitialExperiment,
}: {
  studies: readonly StudyRecord[]
  benchmarks: readonly BenchmarkRecord[]
  runs: readonly RunRecord[]
  allExperiments: readonly ExperimentRecord[]
  initialSelectedExperiment?: ExperimentRecord | null
  onClearInitialExperiment?: () => void
}) {
  const { t } = useI18n()
  const [section, setSection] = useState<SubSection>('experiments')

  // Experiment filters
  const [studyFilter, setStudyFilter] = useState<string>('all')
  const [kindFilter, setKindFilter] = useState<string>('all')
  const [verdictFilter, setVerdictFilter] = useState<'all' | VerdictClass>('all')
  const [backendFilter, setBackendFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showHistorical, setShowHistorical] = useState(false)

  // Interactive Run Comparison state (`GET /v1/research/compare?a=<id>&b=<id>`)
  const [runA, setRunA] = useState('')
  const [runB, setRunB] = useState('')
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)

  // Reproducibility & Evidence Drawer state
  const [drawerExp, setDrawerExp] = useState<ExperimentRecord | null>(null)
  const [drawerRun, setDrawerRun] = useState<RunRecord | null>(null)
  const [expVersions, setExpVersions] = useState<ExperimentVersionRecord[]>([])
  const [evidenceUri, setEvidenceUri] = useState('')
  const [evidenceVersions, setEvidenceVersions] = useState<EvidenceRecord[]>([])
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([])
  const [verifiedBlob, setVerifiedBlob] = useState<VerifiedArtifactBlob | null>(null)
  const [drawerBusy, setDrawerBusy] = useState(false)
  const [drawerError, setDrawerError] = useState<string | null>(null)

  useEffect(() => {
    if (initialSelectedExperiment) {
      openExperimentDrawer(initialSelectedExperiment)
      onClearInitialExperiment?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedExperiment])

  useEffect(() => {
    if (!runA && runs.length >= 1) setRunA(runs[0]!.id)
    if (!runB && runs.length >= 2) setRunB(runs[1]!.id)
  }, [runs, runA, runB])

  const studyOptions = useMemo(() => {
    const s = new Set<string>(['all'])
    for (const st of studies) if (st.id) s.add(st.id)
    for (const exp of allExperiments) {
      const st = String(exp.meta?.study || exp.task || '').trim()
      if (st) s.add(st)
    }
    return [...s]
  }, [studies, allExperiments])

  const kindOptions = useMemo(() => {
    const k = new Set<string>(['all'])
    for (const exp of allExperiments) if (exp.kind) k.add(exp.kind)
    return [...k]
  }, [allExperiments])

  const filteredExperiments = useMemo(
    () =>
      filterExperiments(allExperiments, {
        study: studyFilter,
        kind: kindFilter,
        verdict: verdictFilter,
        backend: backendFilter,
        search: searchQuery,
        includeHistoricalRetracted: showHistorical,
      }),
    [allExperiments, studyFilter, kindFilter, verdictFilter, backendFilter, searchQuery, showHistorical],
  )

  const handleCompare = async () => {
    if (!runA.trim() || !runB.trim()) return
    setComparing(true)
    setCompareError(null)
    try {
      const res = await compareRuns(runA.trim(), runB.trim())
      setComparison(res)
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : String(e))
      setComparison(null)
    } finally {
      setComparing(false)
    }
  }

  const loadEvidenceUri = async (uri: string) => {
    if (!uri.trim()) return
    setDrawerBusy(true)
    setDrawerError(null)
    try {
      const list = await listEvidenceByUri(uri.trim())
      setEvidenceVersions(list)
      if (list.length > 0 && list[0]!.id) {
        const detail = await getEvidenceById(list[0]!.id).catch(() => list[0]!)
        setSelectedEvidence(detail)
      } else {
        setSelectedEvidence(null)
      }
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : String(e))
    } finally {
      setDrawerBusy(false)
    }
  }

  const openExperimentDrawer = (exp: ExperimentRecord) => {
    setDrawerExp(exp)
    setDrawerRun(null)
    setVerifiedBlob(null)
    setDrawerError(null)
    const defaultUri = `research://experiments/${exp.id}`
    setEvidenceUri(defaultUri)
    setDrawerBusy(true)
    void Promise.all([
      listExperimentVersions(exp.id).catch(() => []),
      listArtifacts(exp.id).catch(() => []),
      listEvidenceByUri(defaultUri).catch(() => []),
    ])
      .then(async ([vers, arts, evs]) => {
        setExpVersions(vers)
        setArtifacts(arts)
        setEvidenceVersions(evs)
        if (evs.length > 0 && evs[0]!.id) {
          const full = await getEvidenceById(evs[0]!.id).catch(() => evs[0]!)
          setSelectedEvidence(full)
        } else {
          setSelectedEvidence(null)
        }
      })
      .finally(() => setDrawerBusy(false))
  }

  const openRunDrawer = (run: RunRecord) => {
    setDrawerRun(run)
    setDrawerExp(null)
    setExpVersions([])
    setVerifiedBlob(null)
    setDrawerError(null)
    const defaultUri = `research://runs/${run.id}`
    setEvidenceUri(defaultUri)
    setDrawerBusy(true)
    void Promise.all([
      listArtifacts(run.id).catch(() => []),
      listEvidenceByUri(defaultUri).catch(() => []),
    ])
      .then(async ([arts, evs]) => {
        setArtifacts(arts)
        setEvidenceVersions(evs)
        if (evs.length > 0 && evs[0]!.id) {
          const full = await getEvidenceById(evs[0]!.id).catch(() => evs[0]!)
          setSelectedEvidence(full)
        } else {
          setSelectedEvidence(null)
        }
      })
      .finally(() => setDrawerBusy(false))
  }

  const inspectEvidenceId = async (id: string) => {
    if (!id.trim()) return
    setDrawerBusy(true)
    setDrawerError(null)
    try {
      const full = await getEvidenceById(id.trim())
      setSelectedEvidence(full)
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : String(e))
    } finally {
      setDrawerBusy(false)
    }
  }

  const handleVerifyArtifact = async (sha: string) => {
    if (!sha.trim()) return
    setDrawerBusy(true)
    setDrawerError(null)
    try {
      const verified = await fetchAndVerifyArtifact(sha)
      setVerifiedBlob(verified)
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : String(e))
    } finally {
      setDrawerBusy(false)
    }
  }

  const downloadVerifiedBlob = (blob: VerifiedArtifactBlob) => {
    if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return
    const copy = new Uint8Array(blob.bytes.byteLength)
    copy.set(blob.bytes)
    const rawBlob = new Blob([copy.buffer], { type: blob.contentType })
    const href = URL.createObjectURL(rawBlob)
    const a = document.createElement('a')
    a.href = href
    a.download = `artifact-${blob.expectedSha256.slice(0, 16)}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(href)
  }

  const pillButton = (active: boolean, label: string, onClick: () => void, slot?: string) => (
    <XStack
      key={label}
      render="button"
      data-slot={slot}
      onClick={onClick}
      px="$2.5"
      py="$1"
      rounded="$3"
      borderWidth={1}
      borderColor={active ? 'var(--border-strong)' : '$edge'}
      bg={active ? '$raised' : 'transparent'}
      cursor="pointer"
      hoverStyle={{ bg: active ? '$raised' : '$hover' }}
    >
      <Text fontSize="$1" fontWeight={active ? '600' : '400'} color={active ? '$ink' : '$quiet'}>
        {label}
      </Text>
    </XStack>
  )

  const drawerOpen = drawerExp !== null || drawerRun !== null
  const activeCommit = drawerExp?.git_sha || drawerRun?.commit || ''
  const activeRepo = String(drawerExp?.meta?.repo || drawerExp?.subject?.split('/')[0] || drawerRun?.system || '')
  const { ciUrl, cdUrl } = provenanceLinks({
    repo: activeRepo,
    commit: activeCommit,
    ciRunId: drawerExp?.meta?.ci_run_id ? String(drawerExp.meta.ci_run_id) : undefined,
    cdDeployId: drawerExp?.meta?.cd_deploy_id ? String(drawerExp.meta.cd_deploy_id) : undefined,
  })

  const expArtifactHashes = useMemo(() => {
    const map = new Map<string, string>()
    if (drawerExp?.meta?.artifact_hashes && typeof drawerExp.meta.artifact_hashes === 'object') {
      for (const [label, sha] of Object.entries(drawerExp.meta.artifact_hashes)) {
        if (typeof sha === 'string' && sha) map.set(sha.replace(/^sha256:/, ''), label)
      }
    }
    if (drawerRun?.facts_digest) {
      map.set(drawerRun.facts_digest.replace(/^sha256:/, ''), 'facts_digest')
    }
    for (const a of artifacts) {
      if (a.sha256 && !map.has(a.sha256)) {
        map.set(a.sha256, a.kind || 'artifact')
      }
    }
    return [...map.entries()].map(([sha256, label]) => ({ sha256, label }))
  }, [drawerExp, drawerRun, artifacts])

  return (
    <YStack data-slot="science-studies" gap="$4">
      {/* Sub-navigation across Studies, Benchmarks, Runs, Experiments */}
      <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
        <XStack gap="$1.5" flexWrap="wrap">
          {pillButton(
            section === 'experiments',
            `${t('Experiments')} (${filteredExperiments.length}/${allExperiments.length})`,
            () => setSection('experiments'),
            'studies-sub-experiments',
          )}
          {pillButton(
            section === 'runs',
            `${t('Runs')} (${runs.length})`,
            () => setSection('runs'),
            'studies-sub-runs',
          )}
          {pillButton(
            section === 'studies',
            `${t('Studies')} (${studies.length})`,
            () => setSection('studies'),
            'studies-sub-studies',
          )}
          {pillButton(
            section === 'benchmarks',
            `${t('Benchmarks')} (${benchmarks.length})`,
            () => setSection('benchmarks'),
            'studies-sub-benchmarks',
          )}
        </XStack>
      </XStack>

      {/* Interactive Run Comparison Bar (`GET /v1/research/compare?a=<id>&b=<id>`) */}
      <YStack
        data-slot="studies-compare-panel"
        p="$4"
        rounded="$4"
        borderWidth={1}
        borderColor="$edge"
        gap="$3"
      >
        <XStack items="center" gap="$2">
          <GitCompare size={16} aria-hidden />
          <Text fontSize="$3" fontWeight="600" color="$ink">
            {t('Interactive Run Comparison')}
          </Text>
          <Text fontSize="$1" color="$quiet" fontFamily="$mono">
            GET /v1/research/compare?a=…&amp;b=…
          </Text>
        </XStack>

        <XStack gap="$2" flexWrap="wrap" items="center">
          <YStack flex={1} minW={180}>
            <Input
              data-slot="compare-input-a"
              placeholder={t('Baseline run ID (a)')}
              value={runA}
              onChangeText={setRunA}
            />
          </YStack>
          <YStack flex={1} minW={180}>
            <Input
              data-slot="compare-input-b"
              placeholder={t('Candidate run ID (b)')}
              value={runB}
              onChangeText={setRunB}
            />
          </YStack>
          <Button
            size="sm"
            data-slot="compare-submit"
            disabled={comparing || !runA.trim() || !runB.trim()}
            onPress={() => void handleCompare()}
          >
            {comparing ? t('Comparing…') : t('Compare Runs')}
          </Button>
          {comparison ? (
            <Button size="sm" variant="ghost" onPress={() => setComparison(null)}>
              {t('Clear')}
            </Button>
          ) : null}
        </XStack>

        {compareError ? (
          <XStack p="$2.5" rounded="$3" bg="$hover" items="center" gap="$2">
            <ShieldAlert size={14} aria-hidden />
            <Text fontSize="$2" color="$ink">
              {compareError}
            </Text>
          </XStack>
        ) : null}

        {comparison ? (
          <YStack data-slot="compare-results" gap="$3" pt="$1">
            <XStack items="center" gap="$2" flexWrap="wrap">
              <XStack px="$2" py={2} rounded="$2" bg={comparison.comparable ? '$raised' : '$hover'}>
                <Text fontSize="$1" fontWeight="600" color="$ink">
                  {comparison.comparable ? t('Comparable') : t('Blocked / Non-identical protocol')}
                </Text>
              </XStack>
              {comparison.blocks.map((blk) => (
                <XStack key={blk} px="$2" py={2} rounded="$2" bg="$hover">
                  <Text fontSize="$1" color="$quiet">
                    {blk}
                  </Text>
                </XStack>
              ))}
            </XStack>

            {comparison.deltas.length > 0 ? (
              <YStack gap="$1.5">
                <Text fontSize="$2" fontWeight="600" color="$ink">
                  {t('Metric Deltas & 95% Confidence-Interval Overlap')}
                </Text>
                {comparison.deltas.map((d) => (
                  <XStack
                    key={`${d.category}:${d.metric}`}
                    p="$2.5"
                    rounded="$3"
                    borderWidth={1}
                    borderColor="$edge"
                    items="center"
                    justify="space-between"
                    flexWrap="wrap"
                    gap="$2"
                  >
                    <Text fontSize="$2" fontWeight="500" color="$ink" fontFamily="$mono">
                      {d.category ? `${d.category}/` : ''}{d.metric}
                    </Text>
                    <XStack items="center" gap="$3" flexWrap="wrap">
                      <Text fontSize="$2" color="$quiet" fontFamily="$mono">
                        A={d.a} → B={d.b} (Δ {d.change >= 0 ? `+${d.change}` : d.change})
                      </Text>
                      <XStack px="$2" py={2} rounded="$2" bg={d.overlap === false ? '$raised' : '$hover'}>
                        <Text fontSize="$1" fontWeight="600" color={d.overlap === false ? '$ink' : '$quiet'}>
                          {d.overlap === false
                            ? t('Non-overlapping CI')
                            : d.overlap === true
                              ? t('CI Overlaps')
                              : t('CI Unspecified')}
                        </Text>
                      </XStack>
                    </XStack>
                  </XStack>
                ))}
              </YStack>
            ) : null}

            {comparison.config.length > 0 ? (
              <YStack gap="$1.5">
                <Text fontSize="$2" fontWeight="600" color="$ink">
                  {t('Configuration Diffs')}
                </Text>
                {comparison.config.map((diff) => (
                  <XStack
                    key={diff.field}
                    p="$2"
                    rounded="$2"
                    bg="$hover"
                    items="center"
                    justify="space-between"
                    flexWrap="wrap"
                    gap="$2"
                  >
                    <Text fontSize="$1" fontWeight="600" color="$ink" fontFamily="$mono">
                      {diff.field}
                    </Text>
                    <Text fontSize="$1" color="$soft" fontFamily="$mono">
                      {diff.a || '∅'} → {diff.b || '∅'}
                    </Text>
                  </XStack>
                ))}
              </YStack>
            ) : null}
          </YStack>
        ) : null}
      </YStack>

      <XStack gap="$4" items="flex-start" flexWrap="wrap">
        {/* Main Browser Column */}
        <YStack flex={2} minW={320} gap="$3">
          {section === 'experiments' ? (
            <YStack gap="$3">
              {/* Rich Filter Controls */}
              <YStack p="$3.5" rounded="$4" borderWidth={1} borderColor="$edge" gap="$2.5">
                <XStack items="center" gap="$2">
                  <Search size={14} aria-hidden />
                  <YStack flex={1}>
                    <Input
                      data-slot="experiments-search"
                      placeholder={t('Filter experiments by ID, hypothesis, subject, GPU, commit, or shape…')}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                  </YStack>
                  <XStack items="center" gap="$2" pl="$2">
                    <Switch
                      data-slot="experiments-historical-toggle"
                      checked={showHistorical}
                      onCheckedChange={setShowHistorical}
                    />
                    <Text fontSize="$1" color="$quiet">
                      {t('Historical / Retracted')}
                    </Text>
                  </XStack>
                </XStack>

                <XStack items="center" gap="$1.5" flexWrap="wrap">
                  <Text fontSize="$1" color="$quiet" pr="$1">
                    {t('Verdict:')}
                  </Text>
                  {VERDICT_FILTERS.map((vf) =>
                    pillButton(
                      verdictFilter === vf,
                      vf === 'all'
                        ? t('All verdicts')
                        : vf === 'proven'
                          ? t('Proven')
                          : vf === 'promising_inconclusive'
                            ? t('Promising (Unqualified)')
                            : vf === 'refuted'
                              ? t('Refuted')
                              : t('Inconclusive'),
                      () => setVerdictFilter(vf),
                      `filter-verdict-${vf}`,
                    ),
                  )}
                </XStack>

                <XStack items="center" gap="$1.5" flexWrap="wrap">
                  <Text fontSize="$1" color="$quiet" pr="$1">
                    {t('Backend:')}
                  </Text>
                  {BACKEND_FILTERS.map((bf) =>
                    pillButton(backendFilter === bf, bf === 'all' ? t('All backends') : bf, () => setBackendFilter(bf)),
                  )}
                </XStack>

                {studyOptions.length > 1 ? (
                  <XStack items="center" gap="$1.5" flexWrap="wrap">
                    <Text fontSize="$1" color="$quiet" pr="$1">
                      {t('Study:')}
                    </Text>
                    {studyOptions.slice(0, 8).map((st) =>
                      pillButton(studyFilter === st, st === 'all' ? t('All studies') : st, () => setStudyFilter(st)),
                    )}
                  </XStack>
                ) : null}

                {kindOptions.length > 1 ? (
                  <XStack items="center" gap="$1.5" flexWrap="wrap">
                    <Text fontSize="$1" color="$quiet" pr="$1">
                      {t('Kind:')}
                    </Text>
                    {kindOptions.map((kd) =>
                      pillButton(kindFilter === kd, kd === 'all' ? t('All kinds') : kd, () => setKindFilter(kd)),
                    )}
                  </XStack>
                ) : null}
              </YStack>

              {/* Filtered Experiment Rows */}
              {filteredExperiments.length === 0 ? (
                <YStack p="$5" rounded="$4" borderWidth={1} borderColor="$edge" items="center">
                  <Text fontSize="$2" color="$quiet">
                    {t('No experiments match the active filters.')}
                  </Text>
                </YStack>
              ) : (
                <YStack gap="$2">
                  {filteredExperiments.map((exp) => {
                    const verdict = classifyVerdict(exp)
                    const selected = drawerExp?.id === exp.id
                    return (
                      <YStack
                        key={`${exp.id}-${exp.seq ?? 0}`}
                        render="button"
                        data-slot={`experiment-item-${exp.id}`}
                        data-verdict={verdict}
                        onClick={() => openExperimentDrawer(exp)}
                        p="$3.5"
                        rounded="$3"
                        borderWidth={1}
                        borderColor={selected ? 'var(--border-strong)' : '$edge'}
                        bg={selected ? '$raised' : 'transparent'}
                        gap="$1.5"
                        items="flex-start"
                        cursor="pointer"
                        hoverStyle={{ bg: selected ? '$raised' : '$hover' }}
                      >
                        <XStack width="100%" items="center" justify="space-between" gap="$2" flexWrap="wrap">
                          <XStack items="center" gap="$2">
                            <Text fontSize="$2" fontWeight="600" color="$ink">
                              {exp.id}
                            </Text>
                            <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                              {exp.kind}
                            </Text>
                            {exp.revision === 'retracted' || exp.meta?.historical ? (
                              <XStack px="$1.5" py={1} rounded="$2" bg="$hover">
                                <Text fontSize="$1" color="$quiet">
                                  {exp.revision === 'retracted' ? t('Retracted') : t('Historical')}
                                </Text>
                              </XStack>
                            ) : null}
                          </XStack>
                          <XStack px="$2" py={2} rounded="$2" bg={verdict === 'proven' ? '$raised' : '$hover'}>
                            <Text fontSize="$1" fontWeight="600" color={verdict === 'proven' ? '$ink' : '$soft'}>
                              {verdictLabel(verdict)}
                            </Text>
                          </XStack>
                        </XStack>

                        <Text fontSize="$2" color="$soft" numberOfLines={2}>
                          {String(
                            verdict === 'refuted'
                              ? exp.meta?.failure_diagnosis || exp.meta?.because || exp.meta?.conclusion || exp.subject
                              : exp.meta?.conclusion || exp.meta?.hypothesis || `${exp.subject} · ${exp.task}`,
                          )}
                        </Text>

                        <XStack width="100%" items="center" justify="space-between" flexWrap="wrap" gap="$2">
                          <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                            {exp.subject} · {exp.metric}={exp.value} (n={exp.n}) · ${exp.cost_usd.toFixed(2)}
                          </Text>
                          <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                            {exp.git_sha ? exp.git_sha.slice(0, 10) : 'no-git-sha'}
                          </Text>
                        </XStack>
                      </YStack>
                    )
                  })}
                </YStack>
              )}
            </YStack>
          ) : null}

          {section === 'runs' ? (
            <YStack gap="$2">
              {runs.length === 0 ? (
                <YStack p="$5" rounded="$4" borderWidth={1} borderColor="$edge" items="center">
                  <Text fontSize="$2" color="$quiet">
                    {t('No benchmark runs recorded yet.')}
                  </Text>
                </YStack>
              ) : (
                runs.map((run) => (
                  <YStack
                    key={run.id}
                    data-slot={`run-item-${run.id}`}
                    p="$3.5"
                    rounded="$3"
                    borderWidth={1}
                    borderColor={drawerRun?.id === run.id ? 'var(--border-strong)' : '$edge'}
                    gap="$2"
                  >
                    <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
                      <XStack items="center" gap="$2">
                        <Text fontSize="$2" fontWeight="600" color="$ink">
                          {run.id}
                        </Text>
                        <XStack px="$2" py={2} rounded="$2" bg="$hover">
                          <Text fontSize="$1" color="$soft" fontFamily="$mono">
                            {run.completion || 'unknown'}
                          </Text>
                        </XStack>
                        {run.source_plane === 'hanzod' ? (
                          <XStack px="$2" py={2} rounded="$2" bg="$raised">
                            <Text fontSize="$1" color="$ink" fontFamily="$mono">
                              hanzod ({run.sandbox || 'local'})
                            </Text>
                          </XStack>
                        ) : null}
                      </XStack>
                      <XStack gap="$1.5">
                        <Button size="sm" variant="ghost" onPress={() => setRunA(run.id)}>
                          {runA === run.id ? t('Baseline (A) ✓') : t('Set Baseline (A)')}
                        </Button>
                        <Button size="sm" variant="ghost" onPress={() => setRunB(run.id)}>
                          {runB === run.id ? t('Candidate (B) ✓') : t('Set Candidate (B)')}
                        </Button>
                        <Button size="sm" variant="outline" onPress={() => openRunDrawer(run)}>
                          {t('Evidence')}
                        </Button>
                      </XStack>
                    </XStack>

                    <Text fontSize="$2" color="$soft">
                      {run.benchmark} ({run.split || 'default'}) · {run.system || 'unspecified'}
                      {run.commit ? ` · commit ${run.commit.slice(0, 10)}` : ''}
                    </Text>

                    <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                      {(run.measures ?? [])
                        .map((m) =>
                          m.lo != null && m.hi != null
                            ? `${m.metric}=${m.value} [${m.lo.toFixed(3)}, ${m.hi.toFixed(3)}]`
                            : `${m.metric}=${m.value}`,
                        )
                        .join(' · ') || t('No scalar measures attached')}
                    </Text>
                  </YStack>
                ))
              )}
            </YStack>
          ) : null}

          {section === 'studies' ? (
            <YStack gap="$2">
              {studies.length === 0 ? (
                <YStack p="$5" rounded="$4" borderWidth={1} borderColor="$edge" items="center">
                  <Text fontSize="$2" color="$quiet">
                    {t('No studies recorded yet.')}
                  </Text>
                </YStack>
              ) : (
                studies.map((st) => (
                  <YStack key={st.id} p="$4" rounded="$3" borderWidth={1} borderColor="$edge" gap="$2">
                    <XStack items="center" justify="space-between" gap="$2">
                      <Text fontSize="$3" fontWeight="600" color="$ink">
                        {st.title || st.id}
                      </Text>
                      <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                        {st.runs.length} runs
                      </Text>
                    </XStack>
                    {st.question ? (
                      <Text fontSize="$2" color="$soft">
                        {t('Question:')} {st.question}
                      </Text>
                    ) : null}
                    {st.finding ? (
                      <Text fontSize="$2" color="$ink">
                        {t('Finding:')} {st.finding}
                      </Text>
                    ) : null}
                    {st.limits ? (
                      <Text fontSize="$1" color="$quiet">
                        {t('Limits:')} {st.limits}
                      </Text>
                    ) : null}
                    <XStack justify="flex-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          setStudyFilter(st.id)
                          setSection('experiments')
                        }}
                      >
                        {t('Filter Experiments by Study')}
                      </Button>
                    </XStack>
                  </YStack>
                ))
              )}
            </YStack>
          ) : null}

          {section === 'benchmarks' ? (
            <YStack gap="$2">
              {benchmarks.length === 0 ? (
                <YStack p="$5" rounded="$4" borderWidth={1} borderColor="$edge" items="center">
                  <Text fontSize="$2" color="$quiet">
                    {t('No benchmarks registered in this org yet.')}
                  </Text>
                </YStack>
              ) : (
                benchmarks.map((bm) => (
                  <YStack key={bm.id} p="$4" rounded="$3" borderWidth={1} borderColor="$edge" gap="$1.5">
                    <XStack items="center" justify="space-between">
                      <Text fontSize="$3" fontWeight="600" color="$ink">
                        {bm.title || bm.id}
                      </Text>
                      <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                        {bm.metric || bm.metrics.join(', ')}
                      </Text>
                    </XStack>
                    <Text fontSize="$2" color="$soft">
                      {bm.dataset || bm.origin || bm.id}
                      {bm.version ? ` · v${bm.version}` : ''}
                      {bm.license ? ` · ${bm.license}` : ''}
                    </Text>
                    {bm.splits.length > 0 ? (
                      <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                        {bm.splits.map((s) => `${s.name} (${s.items})`).join(' · ')}
                      </Text>
                    ) : null}
                  </YStack>
                ))
              )}
            </YStack>
          ) : null}
        </YStack>

        {/* Reproducibility & Evidence Drawer */}
        {drawerOpen ? (
          <YStack
            data-slot="reproducibility-drawer"
            flex={1}
            minW={340}
            p="$4"
            rounded="$4"
            borderWidth={1}
            borderColor="var(--border-strong)"
            bg="$raised"
            gap="$3.5"
          >
            <XStack items="center" justify="space-between" gap="$2">
              <XStack items="center" gap="$2">
                <FileCheck2 size={16} aria-hidden />
                <Text fontSize="$3" fontWeight="600" color="$ink">
                  {t('Reproducibility & Evidence')}
                </Text>
              </XStack>
              <Button
                size="sm"
                variant="ghost"
                data-slot="close-evidence-drawer"
                onPress={() => {
                  setDrawerExp(null)
                  setDrawerRun(null)
                  setVerifiedBlob(null)
                }}
              >
                <X size={14} aria-hidden />
              </Button>
            </XStack>

            <YStack gap="$1">
              <Text fontSize="$2" fontWeight="600" color="$ink" fontFamily="$mono">
                {drawerExp?.id ?? drawerRun?.id}
              </Text>
              {drawerExp ? (
                <Text fontSize="$1" color="$soft">
                  {verdictLabel(classifyVerdict(drawerExp))} · {drawerExp.kind} · seq #{drawerExp.seq ?? 1}
                </Text>
              ) : null}
            </YStack>

            {/* Git Commit, Hardware & Manifest Provenance */}
            <YStack p="$3" rounded="$3" borderWidth={1} borderColor="$edge" gap="$1.5">
              <XStack items="center" gap="$1.5">
                <GitCommit size={13} aria-hidden />
                <Text fontSize="$1" fontWeight="600" color="$ink">
                  {t('Git, Hardware & Manifest Provenance')}
                </Text>
              </XStack>
              <Text fontSize="$1" color="$soft" fontFamily="$mono">
                commit: {activeCommit || 'unspecified'}
                {drawerExp?.git_branch ? ` (${drawerExp.git_branch}${drawerExp.git_dirty ? ', dirty' : ''})` : ''}
              </Text>
              {drawerExp?.meta?.gpu || drawerExp?.meta?.backend ? (
                <Text fontSize="$1" color="$soft" fontFamily="$mono">
                  hw: {String(drawerExp.meta.gpu || 'CPU')} · backend={String(drawerExp.meta.backend || 'CPU')}
                  {drawerExp.meta.precision ? ` · ${String(drawerExp.meta.precision)}` : ''}
                </Text>
              ) : null}
              {drawerExp?.meta?.manifest_sha256 || drawerRun?.dataset_digest ? (
                <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                  dataset_sha256: {String(drawerExp?.meta?.manifest_sha256 || drawerRun?.dataset_digest)}
                </Text>
              ) : null}
              {drawerExp?.meta?.model_digest || drawerRun?.store_digest ? (
                <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                  model_sha256: {String(drawerExp?.meta?.model_digest || drawerRun?.store_digest)}
                </Text>
              ) : null}
              <XStack gap="$3" pt="$1" flexWrap="wrap">
                <XStack render={<a href={ciUrl} target="_blank" rel="noopener noreferrer" />} items="center" gap="$1">
                  <Text fontSize="$1" color="$ink">
                    ci.hanzo.ai
                  </Text>
                  <ExternalLink size={11} aria-hidden />
                </XStack>
                <XStack render={<a href={cdUrl} target="_blank" rel="noopener noreferrer" />} items="center" gap="$1">
                  <Text fontSize="$1" color="$ink">
                    cd.hanzo.ai
                  </Text>
                  <ExternalLink size={11} aria-hidden />
                </XStack>
              </XStack>
            </YStack>

            {/* Retained Experiment Version Trail */}
            {expVersions.length > 0 ? (
              <YStack gap="$1.5">
                <XStack items="center" gap="$1.5">
                  <Layers size={13} aria-hidden />
                  <Text fontSize="$1" fontWeight="600" color="$ink">
                    {t('Append-Only Audit Versions')} ({expVersions.length})
                  </Text>
                </XStack>
                {expVersions.map((ver) => (
                  <XStack key={ver.seq} justify="space-between" p="$2" rounded="$2" bg="$hover">
                    <Text fontSize="$1" color="$soft" fontFamily="$mono">
                      seq #{ver.seq} · {ver.status} ({ver.revision})
                    </Text>
                    <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                      val={ver.value} · {ver.content_hash.slice(0, 10)}
                    </Text>
                  </XStack>
                ))}
              </YStack>
            ) : null}

            {/* Versioned Evidence Explorer (`GET /v1/research/evidence?uri=...` + `/:id`) */}
            <YStack gap="$2">
              <Text fontSize="$1" fontWeight="600" color="$ink">
                {t('Versioned Evidence Records')}
              </Text>
              <XStack gap="$1.5">
                <YStack flex={1}>
                  <Input
                    data-slot="evidence-uri-input"
                    placeholder="research://..."
                    value={evidenceUri}
                    onChangeText={setEvidenceUri}
                  />
                </YStack>
                <Button size="sm" variant="outline" onPress={() => void loadEvidenceUri(evidenceUri)} disabled={drawerBusy}>
                  {t('Lookup')}
                </Button>
              </XStack>

              {evidenceVersions.length > 0 ? (
                <YStack gap="$1.5">
                  {evidenceVersions.map((ev) => (
                    <XStack
                      key={ev.id || `${ev.uri}@${ev.version}`}
                      render="button"
                      onClick={() => (ev.id ? void inspectEvidenceId(ev.id) : setSelectedEvidence(ev))}
                      p="$2"
                      rounded="$2"
                      borderWidth={1}
                      borderColor={selectedEvidence?.id === ev.id ? 'var(--border-strong)' : '$edge'}
                      bg="transparent"
                      justify="space-between"
                      items="center"
                      cursor="pointer"
                      hoverStyle={{ bg: '$hover' }}
                    >
                      <Text fontSize="$1" color="$ink" fontFamily="$mono">
                        v{ev.version} · {ev.kind}
                      </Text>
                      <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                        {ev.hash.slice(0, 12)}…
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              ) : (
                <Text fontSize="$1" color="$quiet">
                  {t('No evidence versions filed at this URI yet.')}
                </Text>
              )}

              {selectedEvidence?.content !== undefined ? (
                <YStack p="$2.5" rounded="$3" borderWidth={1} borderColor="$edge" maxH={180} overflowY="auto">
                  <Text fontSize="$1" color="$soft" fontFamily="$mono">
                    {JSON.stringify(selectedEvidence.content, null, 2)}
                  </Text>
                </YStack>
              ) : null}
            </YStack>

            {/* Content-Addressed Raw Artifacts + Client-Side SHA-256 Verification */}
            <YStack gap="$2">
              <Text fontSize="$1" fontWeight="600" color="$ink">
                {t('Content-Addressed Artifacts (SHA-256 Verified)')}
              </Text>
              {expArtifactHashes.length === 0 ? (
                <Text fontSize="$1" color="$quiet">
                  {t('No content-addressed artifact hashes attached to this record.')}
                </Text>
              ) : (
                expArtifactHashes.map((art) => (
                  <XStack
                    key={art.sha256}
                    p="$2.5"
                    rounded="$3"
                    borderWidth={1}
                    borderColor="$edge"
                    items="center"
                    justify="space-between"
                    gap="$2"
                  >
                    <YStack flex={1} minW={0}>
                      <Text fontSize="$1" fontWeight="600" color="$ink" numberOfLines={1}>
                        {art.label}
                      </Text>
                      <Text fontSize="$1" color="$quiet" fontFamily="$mono" numberOfLines={1}>
                        sha256:{art.sha256.slice(0, 20)}…
                      </Text>
                    </YStack>
                    <Button
                      size="sm"
                      variant="outline"
                      data-slot={`verify-artifact-${art.sha256.slice(0, 12)}`}
                      disabled={drawerBusy}
                      onPress={() => void handleVerifyArtifact(art.sha256)}
                    >
                      {t('Verify & Preview')}
                    </Button>
                  </XStack>
                ))
              )}

              {drawerBusy ? (
                <XStack py="$2" items="center" justify="center">
                  <Spinner size={18} />
                </XStack>
              ) : null}

              {drawerError ? (
                <Text fontSize="$1" color="$ink">
                  {drawerError}
                </Text>
              ) : null}

              {verifiedBlob ? (
                <YStack data-slot="artifact-verification-card" p="$3" rounded="$3" borderWidth={1} borderColor="$edge" gap="$2">
                  <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
                    <XStack items="center" gap="$1.5">
                      {verifiedBlob.verified ? <CheckCircle2 size={14} aria-hidden /> : <ShieldAlert size={14} aria-hidden />}
                      <Text fontSize="$1" fontWeight="600" color="$ink" data-slot="sha256-badge">
                        {verifiedBlob.verified
                          ? t('SHA-256 Verified (byte-for-byte match)')
                          : t('SHA-256 Mismatch')}
                      </Text>
                    </XStack>
                    <Button size="sm" variant="ghost" onPress={() => downloadVerifiedBlob(verifiedBlob)}>
                      <Download size={13} aria-hidden />
                      {t('Download')} ({verifiedBlob.byteLength} B)
                    </Button>
                  </XStack>
                  <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                    computed: {verifiedBlob.computedSha256.slice(0, 28)}…
                  </Text>
                  {verifiedBlob.previewText ? (
                    <YStack p="$2" rounded="$2" bg="$hover" maxH={180} overflowY="auto">
                      <Text fontSize="$1" color="$soft" fontFamily="$mono">
                        {verifiedBlob.previewText}
                      </Text>
                    </YStack>
                  ) : null}
                </YStack>
              ) : null}
            </YStack>
          </YStack>
        ) : null}
      </XStack>
    </YStack>
  )
}
