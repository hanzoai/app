'use client'

import { useCallback, useEffect, useState } from 'react'
import { Atom, Award, CheckCircle2, Cpu, FlaskConical, GitBranch, Play, RefreshCw, ShieldAlert } from 'lucide-react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Input, Spinner, Text } from '@hanzo/ui'
import { machines } from './devRuntime'
import {
  executeOnLocalHanzod,
  fetchXP,
  fileClaim,
  listCandidateFrontier,
  listCandidates,
  listClaims,
  listHypotheses,
  listResearchRuns,
  probeLocalHanzod,
  proposeCandidate,
  qualifyCandidate,
  recordResearchRun,
  registerHypothesis,
  replicateClaim,
  retractClaim,
  type EvolutionCandidate,
  type HanzodResearchHealth,
  type HypothesisRecord,
  type ResearchClaim,
  type ResearchRun,
  type XPResponse,
} from './lib/research'

type Tab = 'hypotheses' | 'runs' | 'claims' | 'frontier' | 'xp'

const SURFACES: EvolutionCandidate['mutation_surface'][] = [
  'engine.strategy',
  'harness.policy',
  'router.cascade',
  'model.adapter',
  'research.protocol',
]

export default function Research() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('hypotheses')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [localDaemon, setLocalDaemon] = useState<HanzodResearchHealth | null>(null)
  const [linkedNames, setLinkedNames] = useState<string[]>([])
  const [hypotheses, setHypotheses] = useState<HypothesisRecord[]>([])
  const [runs, setRuns] = useState<ResearchRun[]>([])
  const [claims, setClaims] = useState<ResearchClaim[]>([])
  const [frontier, setFrontier] = useState<EvolutionCandidate[]>([])
  const [candidates, setCandidates] = useState<EvolutionCandidate[]>([])
  const [xp, setXp] = useState<XPResponse | null>(null)

  const [statement, setStatement] = useState('')
  const [nullHyp, setNullHyp] = useState('')
  const [gateRef, setGateRef] = useState('swe-bench-verified')
  const [maxSeconds, setMaxSeconds] = useState('600')
  const [maxCost, setMaxCost] = useState('25')

  const [execTarget, setExecTarget] = useState<'local-hanzod' | 'cloud-record'>('local-hanzod')
  const [runId, setRunId] = useState('')
  const [runBenchmark, setRunBenchmark] = useState('swe-bench-verified')
  const [runSystem, setRunSystem] = useState('gen-local')
  const [runHypId, setRunHypId] = useState('')
  const [runCommand, setRunCommand] = useState(
    'echo \'HANZO_MEASURES: [{"category":"all","metric":"pass@1","value":0.82}]\'',
  )
  const [runMetric, setRunMetric] = useState('pass@1')
  const [runMetricValue, setRunMetricValue] = useState('0.82')

  const [claimHypId, setClaimHypId] = useState('')
  const [claimRunId, setClaimRunId] = useState('')
  const [claimMetric, setClaimMetric] = useState('pass@1')
  const [claimEffect, setClaimEffect] = useState('0.04')
  const [repRunByClaim, setRepRunByClaim] = useState<Record<string, string>>({})

  const [candSurface, setCandSurface] = useState<EvolutionCandidate['mutation_surface']>('engine.strategy')
  const [candParent, setCandParent] = useState('root')
  const [candDigest, setCandDigest] = useState('sha256:')
  const [candDiff, setCandDiff] = useState('sha256:')
  const [candSuccess, setCandSuccess] = useState('0.85')
  const [candCost, setCandCost] = useState('0.45')
  const [candP50, setCandP50] = useState('950')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const ctl = new AbortController()
    try {
      const [daemon, linked, hyps, rs, cls, fr, cds, xpRes] = await Promise.all([
        probeLocalHanzod(undefined, ctl.signal),
        machines(ctl.signal).catch(() => []),
        listHypotheses().catch(() => []),
        listResearchRuns().catch(() => []),
        listClaims().catch(() => []),
        listCandidateFrontier().catch(() => []),
        listCandidates().catch(() => []),
        fetchXP().catch(() => null),
      ])
      setLocalDaemon(daemon)
      if (!daemon) setExecTarget('cloud-record')
      setLinkedNames(linked.map((m) => m.label))
      setHypotheses(hyps)
      setRuns(rs)
      setClaims(cls)
      setFrontier(fr)
      setCandidates(cds)
      setXp(xpRes)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const submitHypothesis = async () => {
    if (!statement.trim() || !nullHyp.trim() || !gateRef.trim()) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const created = await registerHypothesis({
        statement: statement.trim(),
        null_hypothesis: nullHyp.trim(),
        gate_ref: gateRef.trim(),
        budget: {
          max_compute_seconds: Number(maxSeconds) || 600,
          max_cost_usd: Number(maxCost) || 25,
        },
      })
      setStatement('')
      setNullHyp('')
      setRunHypId(created.hypothesis_id)
      setClaimHypId(created.hypothesis_id)
      setNotice(`Registered hypothesis ${created.hypothesis_id.slice(0, 18)}… (seq ${created.seq})`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const submitRun = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (execTarget === 'local-hanzod' && localDaemon) {
        const res = await executeOnLocalHanzod({
          id: runId.trim() || undefined,
          hypothesis_id: runHypId.trim() || undefined,
          benchmark: runBenchmark.trim(),
          system: runSystem.trim(),
          command: runCommand.trim(),
          max_compute_seconds: Number(maxSeconds) || 600,
          questions: 1,
        })
        setClaimRunId(res.id)
        setNotice(
          `Executed ${res.id} on local hanzod (${res.sandbox}): ${res.status}, ${res.artifacts.length} SHA-256 artifact(s)${res.cloud_synced ? ', synced to Cloud' : ''}`,
        )
      } else {
        const id = runId.trim() || `run-${Date.now()}`
        const nowIso = new Date().toISOString()
        await recordResearchRun({
          id,
          benchmark: runBenchmark.trim(),
          split: 'test',
          system: runSystem.trim(),
          questions: 1,
          answered: 1,
          when: nowIso,
          ended: nowIso,
          notes: runHypId.trim() ? `hypothesis_id=${runHypId.trim()}` : '',
          measures: [{ category: 'all', metric: runMetric.trim(), value: Number(runMetricValue) || 0 }],
        })
        setClaimRunId(id)
        setNotice(`Recorded completed Cloud run ${id}`)
      }
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const submitClaim = async () => {
    if (!claimRunId.trim() || !claimMetric.trim()) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const cl = await fileClaim({
        hypothesis_id: claimHypId.trim() || undefined,
        run_id: claimRunId.trim(),
        mode: claimHypId.trim() ? 'confirmatory' : 'exploratory',
        metric: claimMetric.trim(),
        effect_size: Number(claimEffect) || 0,
      })
      setNotice(`Filed ${cl.mode} claim ${cl.claim_id.slice(0, 18)}… (${cl.status})`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const submitCandidate = async () => {
    if (!candDigest.trim() || !candDiff.trim()) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const c = await proposeCandidate({
        parent_ids: [candParent.trim() || 'root'],
        mutation_surface: candSurface,
        artifact_digest: candDigest.trim(),
        diff_ref: candDiff.trim(),
        gate_ref: gateRef.trim() || 'swe-bench-verified@1.0.0',
        product_fitness: {
          verified_success: Number(candSuccess) || 0,
          cost_per_success_usd: Number(candCost) || 0,
          latency_p50_ms: Number(candP50) || 0,
          latency_p95_ms: (Number(candP50) || 0) * 1.8,
          robustness: Number(candSuccess) || 0,
          safety: 1.0,
        },
      })
      setNotice(`Proposed candidate ${c.candidate_id.slice(0, 18)}… on ${c.mutation_surface}`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const tabItem = (id: Tab, label: string, count?: number) => (
    <XStack
      key={id}
      render="button"
      data-slot={`research-tab-${id}`}
      onClick={() => setTab(id)}
      px="$3"
      py="$1.5"
      rounded="$3"
      bg={tab === id ? '$raised' : 'transparent'}
      cursor="pointer"
      items="center"
      gap="$1.5"
      hoverStyle={{ bg: tab === id ? '$raised' : '$hover' }}
    >
      <Text fontSize="$2" fontWeight={tab === id ? '600' : '400'} color={tab === id ? '$ink' : '$quiet'}>
        {label}
      </Text>
      {typeof count === 'number' ? (
        <Text fontSize="$1" color="$quiet">
          {count}
        </Text>
      ) : null}
    </XStack>
  )

  return (
    <YStack data-slot="research-workbench" flex={1} minH={0} overflowY="auto" p="$4" $md={{ p: '$6' }} gap="$4">
      <XStack items="center" justify="space-between" flexWrap="wrap" gap="$3">
        <XStack items="center" gap="$2.5">
          <Atom size={20} aria-hidden />
          <YStack>
            <Text fontSize="$5" fontWeight="600" color="$ink">
              {t('Hanzo Dō · Research & Evolution')}
            </Text>
            <Text fontSize="$2" color="$quiet">
              {t('HIP-1400..1404 · Pre-registered hypotheses, sandboxed execution, Pareto evolution, and soulbound XP')}
            </Text>
          </YStack>
        </XStack>
        <XStack items="center" gap="$2">
          <XStack px="$2.5" py="$1" rounded="$3" bg="$hover" items="center" gap="$1.5">
            <Cpu size={13} aria-hidden />
            <Text fontSize="$1" color="$ink">
              {localDaemon
                ? `hanzod local (${localDaemon.hanzo_vm_available ? 'hanzo-vm' : localDaemon.sandbox})`
                : linkedNames.length > 0
                  ? `Linked: ${linkedNames[0]}`
                  : 'Cloud API'}
            </Text>
          </XStack>
          <Button size="sm" variant="ghost" onPress={() => void refresh()} disabled={loading || busy}>
            <RefreshCw size={14} aria-hidden />
          </Button>
        </XStack>
      </XStack>

      <XStack items="center" gap="$1" flexWrap="wrap" borderBottomWidth={1} borderColor="$edge" pb="$2">
        {tabItem('hypotheses', t('Hypotheses'), hypotheses.length)}
        {tabItem('runs', t('Experiments & Runs'), runs.length)}
        {tabItem('claims', t('Claims & Replication'), claims.length)}
        {tabItem('frontier', t('Evolution Frontier'), frontier.length)}
        {tabItem('xp', t('Verified XP'), xp?.balances.length ?? 0)}
      </XStack>

      {error ? (
        <XStack p="$3" rounded="$3" bg="$hover" items="center" gap="$2">
          <ShieldAlert size={15} aria-hidden />
          <Text fontSize="$2" color="$ink">
            {error}
          </Text>
        </XStack>
      ) : null}

      {notice ? (
        <XStack p="$3" rounded="$3" bg="$raised" items="center" gap="$2">
          <CheckCircle2 size={15} aria-hidden />
          <Text fontSize="$2" color="$ink">
            {notice}
          </Text>
        </XStack>
      ) : null}

      {loading ? (
        <YStack py="$6" items="center" justify="center">
          <Spinner size={24} />
        </YStack>
      ) : null}

      {!loading && tab === 'hypotheses' ? (
        <YStack gap="$4">
          <YStack p="$4" rounded="$4" borderWidth={1} borderColor="$edge" gap="$3">
            <XStack items="center" gap="$2">
              <FlaskConical size={16} aria-hidden />
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Pre-register Falsifiable Hypothesis (HIP-1403 §1)')}
              </Text>
            </XStack>
            <Input
              placeholder="Falsifiable prediction (e.g. Tree-search verifier lifts SWE-bench pass@1 by >= 4%)"
              value={statement}
              onChangeText={setStatement}
            />
            <Input
              placeholder="Null hypothesis (e.g. Pass@1 lift < 4% or cost > $25)"
              value={nullHyp}
              onChangeText={setNullHyp}
            />
            <XStack gap="$2" flexWrap="wrap" items="center">
              <YStack flex={1} minW={180}>
                <Input placeholder="Benchmark / gate_ref" value={gateRef} onChangeText={setGateRef} />
              </YStack>
              <YStack width={140}>
                <Input placeholder="Max seconds" value={maxSeconds} onChangeText={setMaxSeconds} />
              </YStack>
              <YStack width={140}>
                <Input placeholder="Max USD" value={maxCost} onChangeText={setMaxCost} />
              </YStack>
              <Button size="sm" onPress={() => void submitHypothesis()} disabled={busy}>
                {t('Register Hypothesis')}
              </Button>
            </XStack>
          </YStack>

          <YStack gap="$2">
            {hypotheses.map((h) => (
              <YStack key={h.hypothesis_id} p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" gap="$1.5">
                <XStack items="center" justify="space-between" gap="$2">
                  <Text fontSize="$2" fontWeight="600" color="$ink">
                    {h.statement}
                  </Text>
                  <Text fontSize="$1" color="$quiet">
                    seq #{h.seq} · {h.gate_ref}
                  </Text>
                </XStack>
                <Text fontSize="$2" color="$quiet">
                  H₀: {h.null_hypothesis}
                </Text>
                <Text fontSize="$1" color="$quiet">
                  {h.hypothesis_id} · {h.proposer} · max {h.budget.max_compute_seconds}s / ${h.budget.max_cost_usd}
                </Text>
              </YStack>
            ))}
          </YStack>
        </YStack>
      ) : null}

      {!loading && tab === 'runs' ? (
        <YStack gap="$4">
          <YStack p="$4" rounded="$4" borderWidth={1} borderColor="$edge" gap="$3">
            <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
              <XStack items="center" gap="$2">
                <Play size={16} aria-hidden />
                <Text fontSize="$3" fontWeight="600" color="$ink">
                  {t('Authorize & Execute Experiment')}
                </Text>
              </XStack>
              <XStack gap="$1.5">
                {localDaemon ? (
                  <Button
                    size="sm"
                    variant={execTarget === 'local-hanzod' ? 'primary' : 'ghost'}
                    onPress={() => setExecTarget('local-hanzod')}
                  >
                    {`Local hanzod (${localDaemon.hanzo_vm_available ? 'hanzo-vm' : 'workspace'})`}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant={execTarget === 'cloud-record' ? 'primary' : 'ghost'}
                  onPress={() => setExecTarget('cloud-record')}
                >
                  {t('Cloud Evidence Record')}
                </Button>
              </XStack>
            </XStack>
            <XStack gap="$2" flexWrap="wrap">
              <YStack flex={1} minW={160}>
                <Input placeholder="Run ID (optional)" value={runId} onChangeText={setRunId} />
              </YStack>
              <YStack flex={1} minW={160}>
                <Input placeholder="Benchmark (e.g. swe-bench-verified)" value={runBenchmark} onChangeText={setRunBenchmark} />
              </YStack>
              <YStack flex={1} minW={160}>
                <Input placeholder="System under test" value={runSystem} onChangeText={setRunSystem} />
              </YStack>
            </XStack>
            <Input placeholder="Pre-registered hypothesis_id (sha256:...)" value={runHypId} onChangeText={setRunHypId} />
            {execTarget === 'local-hanzod' && localDaemon ? (
              <Input placeholder="Sandbox command" value={runCommand} onChangeText={setRunCommand} />
            ) : (
              <XStack gap="$2">
                <YStack flex={1}>
                  <Input placeholder="Metric name" value={runMetric} onChangeText={setRunMetric} />
                </YStack>
                <YStack width={160}>
                  <Input placeholder="Measured value" value={runMetricValue} onChangeText={setRunMetricValue} />
                </YStack>
              </XStack>
            )}
            <XStack justify="flex-end">
              <Button size="sm" onPress={() => void submitRun()} disabled={busy}>
                {execTarget === 'local-hanzod' && localDaemon ? t('Execute on Local hanzod') : t('Record Run')}
              </Button>
            </XStack>
          </YStack>

          <YStack gap="$2">
            {runs.map((r) => (
              <YStack key={r.id} p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" gap="$1">
                <XStack items="center" justify="space-between">
                  <Text fontSize="$2" fontWeight="600" color="$ink">
                    {r.id} · {r.benchmark} ({r.system || 'unspecified'})
                  </Text>
                  <Text fontSize="$1" color="$quiet">
                    completion: {r.completion ?? 'unknown'}
                  </Text>
                </XStack>
                <Text fontSize="$1" color="$quiet">
                  {(r.measures ?? []).map((m) => `${m.metric}=${m.value}`).join(' · ') || 'no measures'}
                  {r.facts_digest ? ` · artifact ${r.facts_digest.slice(0, 22)}…` : ''}
                </Text>
              </YStack>
            ))}
          </YStack>
        </YStack>
      ) : null}

      {!loading && tab === 'claims' ? (
        <YStack gap="$4">
          <YStack p="$4" rounded="$4" borderWidth={1} borderColor="$edge" gap="$3">
            <Text fontSize="$3" fontWeight="600" color="$ink">
              {t('File Research Claim & Independent Replication (HIP-1403 §3)')}
            </Text>
            <XStack gap="$2" flexWrap="wrap" items="center">
              <YStack flex={1} minW={200}>
                <Input placeholder="Hypothesis ID (sha256:... for confirmatory)" value={claimHypId} onChangeText={setClaimHypId} />
              </YStack>
              <YStack flex={1} minW={160}>
                <Input placeholder="Completed Primary Run ID" value={claimRunId} onChangeText={setClaimRunId} />
              </YStack>
              <YStack width={130}>
                <Input placeholder="Metric" value={claimMetric} onChangeText={setClaimMetric} />
              </YStack>
              <YStack width={130}>
                <Input placeholder="Effect delta" value={claimEffect} onChangeText={setClaimEffect} />
              </YStack>
              <Button size="sm" onPress={() => void submitClaim()} disabled={busy}>
                {t('File Claim')}
              </Button>
            </XStack>
          </YStack>

          <YStack gap="$2">
            {claims.map((cl) => (
              <YStack key={cl.claim_id} p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" gap="$2">
                <XStack items="center" justify="space-between">
                  <Text fontSize="$2" fontWeight="600" color="$ink">
                    {cl.metric} = {cl.value} (Δ {cl.effect_size}) · {cl.mode}
                  </Text>
                  <Text fontSize="$1" fontWeight="600" color="$ink">
                    {cl.status.toUpperCase()}
                  </Text>
                </XStack>
                <Text fontSize="$1" color="$quiet">
                  {cl.claim_id} · run {cl.run_id} · proposer {cl.proposer} · replications {cl.replications.length}
                </Text>
                {cl.status === 'unreplicated' && cl.mode === 'confirmatory' ? (
                  <XStack gap="$2" items="center">
                    <YStack flex={1}>
                      <Input
                        placeholder="Independent replication run_id"
                        value={repRunByClaim[cl.claim_id] ?? ''}
                        onChangeText={(val) => setRepRunByClaim((prev) => ({ ...prev, [cl.claim_id]: val }))}
                      />
                    </YStack>
                    <Button
                      size="sm"
                      disabled={busy || !(repRunByClaim[cl.claim_id] ?? '').trim()}
                      onPress={() => {
                        setBusy(true)
                        void replicateClaim(cl.claim_id, repRunByClaim[cl.claim_id].trim())
                          .then(() => refresh())
                          .catch((e) => setError(e instanceof Error ? e.message : String(e)))
                          .finally(() => setBusy(false))
                      }}
                    >
                      {t('Verify Replication')}
                    </Button>
                  </XStack>
                ) : null}
                {cl.status !== 'retracted' ? (
                  <XStack justify="flex-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onPress={() => {
                        setBusy(true)
                        void retractClaim(cl.claim_id, `sha256:retract-${Date.now()}`, 'Counter-evidence filed from Research workbench')
                          .then(() => refresh())
                          .catch((e) => setError(e instanceof Error ? e.message : String(e)))
                          .finally(() => setBusy(false))
                      }}
                    >
                      {t('Retract with Counter-Evidence')}
                    </Button>
                  </XStack>
                ) : null}
              </YStack>
            ))}
          </YStack>
        </YStack>
      ) : null}

      {!loading && tab === 'frontier' ? (
        <YStack gap="$4">
          <YStack p="$4" rounded="$4" borderWidth={1} borderColor="$edge" gap="$3">
            <XStack items="center" gap="$2">
              <GitBranch size={16} aria-hidden />
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Propose EvolutionCandidate (HIP-1401 §§1–4)')}
              </Text>
            </XStack>
            <XStack gap="$2" flexWrap="wrap">
              {SURFACES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={candSurface === s ? 'primary' : 'ghost'}
                  onPress={() => setCandSurface(s)}
                >
                  {s}
                </Button>
              ))}
            </XStack>
            <XStack gap="$2" flexWrap="wrap">
              <YStack flex={1} minW={160}>
                <Input placeholder="Parent ID (root or sha256:...)" value={candParent} onChangeText={setCandParent} />
              </YStack>
              <YStack flex={1} minW={200}>
                <Input placeholder="Artifact digest (sha256:...)" value={candDigest} onChangeText={setCandDigest} />
              </YStack>
              <YStack flex={1} minW={200}>
                <Input placeholder="Diff ref (sha256:...)" value={candDiff} onChangeText={setCandDiff} />
              </YStack>
            </XStack>
            <XStack gap="$2" flexWrap="wrap" items="center">
              <YStack width={140}>
                <Input placeholder="Success [0..1]" value={candSuccess} onChangeText={setCandSuccess} />
              </YStack>
              <YStack width={140}>
                <Input placeholder="USD / success" value={candCost} onChangeText={setCandCost} />
              </YStack>
              <YStack width={140}>
                <Input placeholder="p50 latency ms" value={candP50} onChangeText={setCandP50} />
              </YStack>
              <Button size="sm" onPress={() => void submitCandidate()} disabled={busy}>
                {t('Propose Candidate')}
              </Button>
            </XStack>
          </YStack>

          <Text fontSize="$3" fontWeight="600" color="$ink">
            {t('Non-Dominated Pareto Frontier')} ({frontier.length} / {candidates.length})
          </Text>
          <YStack gap="$2">
            {frontier.map((c) => (
              <YStack key={c.candidate_id} p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" gap="$1.5">
                <XStack items="center" justify="space-between">
                  <Text fontSize="$2" fontWeight="600" color="$ink">
                    {c.mutation_surface} · {c.status.toUpperCase()}
                  </Text>
                  {c.product_fitness ? (
                    <Text fontSize="$2" color="$ink">
                      {(c.product_fitness.verified_success * 100).toFixed(1)}% · ${c.product_fitness.cost_per_success_usd.toFixed(2)} · {c.product_fitness.latency_p50_ms}ms
                    </Text>
                  ) : null}
                </XStack>
                <Text fontSize="$1" color="$quiet">
                  {c.candidate_id} · parent {c.parent_ids.join(', ')} · proposer {c.proposer}
                </Text>
                {c.status === 'proposed' && c.product_fitness ? (
                  <XStack justify="flex-end">
                    <Button
                      size="sm"
                      disabled={busy}
                      onPress={() => {
                        setBusy(true)
                        void qualifyCandidate(c.candidate_id, {
                          evidence_refs: [c.artifact_digest],
                          product_fitness: c.product_fitness!,
                          promote: true,
                        })
                          .then(() => refresh())
                          .catch((e) => setError(e instanceof Error ? e.message : String(e)))
                          .finally(() => setBusy(false))
                      }}
                    >
                      {t('Qualify & Promote')}
                    </Button>
                  </XStack>
                ) : null}
              </YStack>
            ))}
          </YStack>
        </YStack>
      ) : null}

      {!loading && tab === 'xp' ? (
        <YStack gap="$4">
          <XStack items="center" gap="$2">
            <Award size={18} aria-hidden />
            <Text fontSize="$3" fontWeight="600" color="$ink">
              {t('Soulbound Hanzo XP Projection (HIP-1402 · Rule v1.0.0 · Non-Transferable)')}
            </Text>
          </XStack>
          <YStack gap="$2">
            {(xp?.balances ?? []).length === 0 ? (
              <Text fontSize="$2" color="$quiet">
                {t('No verified XP earned yet. Unreplicated claims and unqualified candidates earn 0 XP by design.')}
              </Text>
            ) : (
              (xp?.balances ?? []).map((b) => (
                <YStack key={b.principal} p="$3.5" rounded="$3" borderWidth={1} borderColor="$edge" gap="$1">
                  <XStack items="center" justify="space-between">
                    <Text fontSize="$2" fontWeight="600" color="$ink">
                      {b.principal}
                    </Text>
                    <Text fontSize="$3" fontWeight="600" color="$ink">
                      {b.total_xp} XP
                    </Text>
                  </XStack>
                  <Text fontSize="$1" color="$quiet">
                    {Object.entries(b.domains)
                      .map(([dom, val]) => `${dom}: ${val}`)
                      .join(' · ')}
                  </Text>
                </YStack>
              ))
            )}
          </YStack>

          {(xp?.projections ?? []).length > 0 ? (
            <YStack gap="$1.5" pt="$2">
              <Text fontSize="$2" fontWeight="600" color="$ink">
                {t('Evidence-Derived Audit Log')}
              </Text>
              {(xp?.projections ?? []).map((p) => (
                <XStack key={p.projection_id} justify="space-between" py="$1.5" borderBottomWidth={1} borderColor="$edge">
                  <Text fontSize="$1" color="$quiet">
                    {p.principal} · {p.domain} · {p.reason}
                    {p.retracted_by ? ` (retracted by ${p.retracted_by.slice(0, 18)}…)` : ''}
                  </Text>
                  <Text fontSize="$1" fontWeight="600" color="$ink">
                    {p.delta > 0 ? `+${p.delta}` : p.delta} XP
                  </Text>
                </XStack>
              ))}
            </YStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  )
}
