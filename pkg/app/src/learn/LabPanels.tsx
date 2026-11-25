'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Input, Text, toast } from '@hanzo/ui'
import {
  Atom,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  LogIn,
  Play,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react'
import {
  computeStartupReadinessPct,
  fetchCourseScienceExperiments,
  ILLUSTRATIVE_SCIENCE_ROWS,
  launchLabSandbox,
  releaseLabSandbox,
} from './api'
import { STARTUP_BUILDER_STAGES, STARTUP_VERTICAL_PRESETS } from './catalog'
import type {
  CourseSpec,
  SandboxSessionState,
  ScienceComparisonRow,
  StartupBuilderConfig,
} from './types'

// ── Science Experiment Comparison Panel (`SCI 101–401`) ──────────────────────

export function ScienceLabPanel({
  course,
  signedIn,
  completedSteps,
  onToggleStep,
  onNavigate,
}: {
  course: CourseSpec
  signedIn: boolean
  completedSteps: readonly string[]
  onToggleStep: (stepId: string) => void
  onNavigate: (to: string) => void
}) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<'live' | 'preview'>('preview')
  const [rows, setRows] = useState<ScienceComparisonRow[]>([...ILLUSTRATIVE_SCIENCE_ROWS])
  const [liveCount, setLiveCount] = useState(0)

  const reload = async () => {
    setLoading(true)
    try {
      const res = await fetchCourseScienceExperiments()
      setSource(res.source)
      setRows(res.rows)
      setLiveCount(res.liveCount)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (signedIn) void reload()
  }, [signedIn])

  return (
    <YStack data-slot="science-lab-panel" gap="$4">
      <YStack p="$4" rounded="$4" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$3">
        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
          <XStack items="center" gap="$2">
            <Atom size={16} aria-hidden />
            <Text fontSize="$4" fontWeight="600" color="$ink">
              {course.code}: {t('Baseline vs Candidate Experiment Comparison')}
            </Text>
          </XStack>
          <XStack gap="$2" flexWrap="wrap">
            <Button size="sm" variant="outline" data-slot="science-lab-refresh" disabled={loading} onPress={() => void reload()}>
              <RefreshCw size={13} aria-hidden />
              {loading ? t('Syncing…') : t('Sync /v1/research')}
            </Button>
            <Button size="sm" variant="primary" data-slot="science-jump-studies" onPress={() => onNavigate('/science/studies')}>
              <Atom size={13} aria-hidden />
              {t('Open /science Studies')}
            </Button>
            <Button size="sm" variant="outline" data-slot="science-jump-autonomy" onPress={() => onNavigate('/science/autonomy')}>
              {t('Launch Autonomy Run')}
            </Button>
          </XStack>
        </XStack>

        <XStack
          data-slot="science-data-badge"
          px="$3"
          py="$1.5"
          rounded="$2"
          borderWidth={1}
          borderColor="$edge"
          bg="$background"
          items="center"
          justify="space-between"
          flexWrap="wrap"
          gap="$2"
        >
          <Text fontSize="$1" fontFamily="$mono" color="$ink">
            {source === 'live'
              ? `LIVE TELEMETRY · GET /v1/research/experiments (${liveCount} org records)`
              : 'ILLUSTRATIVE BENCHMARK PREVIEW · Sign in or record an experiment in /science to load live org telemetry'}
          </Text>
          <Text fontSize="$1" fontFamily="$mono" color="$soft">
            Pre-registered threshold gate
          </Text>
        </XStack>

        <YStack gap="$2">
          {rows.map((row) => {
            const delta = row.candidate - row.baseline
            const sign = delta >= 0 ? '+' : ''
            return (
              <XStack
                key={row.id}
                data-slot={`science-row-${row.id}`}
                p="$3"
                rounded="$3"
                borderWidth={1}
                borderColor="$edge"
                bg="$background"
                items="center"
                justify="space-between"
                flexWrap="wrap"
                gap="$2"
              >
                <YStack flex={1} minW={180} gap="$0.5">
                  <Text fontSize="$2" fontWeight="600" color="$ink">
                    {row.metric}
                  </Text>
                  <Text fontSize="$1" fontFamily="$mono" color="$soft">
                    Baseline: {row.baseline}{row.unit} → Candidate: {row.candidate}{row.unit} (Δ {sign}
                    {delta.toFixed(3)}{row.unit}) · n={row.nSamples}
                  </Text>
                </YStack>
                <XStack px="$2.5" py="$1" rounded="$2" borderWidth={1} borderColor="$edge" bg="$raised">
                  <Text fontSize="$1" fontFamily="$mono" fontWeight="600" color="$ink">
                    {row.passed ? 'THRESHOLD PASSED' : 'BELOW THRESHOLD'}
                  </Text>
                </XStack>
              </XStack>
            )
          })}
        </YStack>
      </YStack>

      <StandardLabPanel course={course} completedSteps={completedSteps} onToggleStep={onToggleStep} />
    </YStack>
  )
}

// ── ENT 401 6-Stage AI-Assisted Entrepreneurship Studio ──────────────────────

const ARCHITECTURE_OPTIONS: readonly {
  id: StartupBuilderConfig['architecture']
  label: string
  detail: string
}[] = [
  { id: 'kai-decisions', label: 'Kai Decision Service', detail: 'Calibrated /v1/decisions + custom trained capability' },
  { id: 'zen-model', label: 'Fine-Tuned Zen Model', detail: 'Sovereign Zen open weights + verifier post-training' },
  { id: 'enso-orchestrator', label: 'Enso Agent & Flow Stack', detail: 'Multi-agent routing + Knowledge RAG + Flow ops' },
  { id: 'hybrid-full-stack', label: 'Full-Stack AI Company', detail: 'Kai gates + Zen/Enso inference + Flow + Hanzo Pay' },
]

export function StartupLabPanel({
  config,
  onUpdateConfig,
  onToggleStage,
  onNavigate,
  compact = false,
}: {
  config: StartupBuilderConfig
  onUpdateConfig: (patch: Partial<StartupBuilderConfig>) => void
  onToggleStage: (stageId: string) => void
  onNavigate: (to: string) => void
  compact?: boolean
}) {
  const { t } = useI18n()
  const readinessPct = computeStartupReadinessPct(config.completedStages)

  const openHref = (href: string, external?: boolean) => {
    if (external || /^https?:\/\//.test(href)) {
      if (typeof window !== 'undefined') window.open(href, '_blank', 'noopener,noreferrer')
      return
    }
    onNavigate(href)
  }

  return (
    <YStack data-slot="ent-401-startup-builder" gap="$4">
      <YStack p="$4" rounded="$4" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$3">
        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
          <XStack items="center" gap="$2">
            <Rocket size={16} aria-hidden />
            <YStack>
              <Text fontSize="$4" fontWeight="600" color="$ink">
                {t('AI-Assisted Entrepreneurship Studio (ENT 401)')}
              </Text>
              <Text fontSize="$2" color="$soft">
                {t('6-stage interactive white-label AI SaaS launchpad wired directly into Hanzo IAM, Flow, Science, Billing, and Console.')}
              </Text>
            </YStack>
          </XStack>
          <XStack px="$2.5" py="$1" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background">
            <Text fontSize="$1" fontFamily="$mono" fontWeight="600" color="$ink" data-slot="startup-readiness-pct">
              {readinessPct}% Launch Ready ({config.completedStages.length}/{STARTUP_BUILDER_STAGES.length})
            </Text>
          </XStack>
        </XStack>

        {/* Interactive Company & Architecture Configuration */}
        <XStack gap="$3" flexWrap="wrap">
          <YStack flex={1} minW={220} gap="$1">
            <Text fontSize="$1" fontWeight="600" color="$soft">
              {t('Startup / White-Label Brand Name')}
            </Text>
            <Input
              data-slot="startup-company-name"
              placeholder="e.g., Meridian Legal AI"
              value={config.companyName}
              onChangeText={(companyName: string) => onUpdateConfig({ companyName })}
            />
          </YStack>
          <YStack flex={1} minW={220} gap="$1">
            <Text fontSize="$1" fontWeight="600" color="$soft">
              {t('Custom App Domain')}
            </Text>
            <Input
              data-slot="startup-custom-domain"
              placeholder="e.g., app.meridian.ai"
              value={config.customDomain}
              onChangeText={(customDomain: string) => onUpdateConfig({ customDomain })}
            />
          </YStack>
        </XStack>

        {/* Vertical Picker */}
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="600" color="$soft">
            {t('Target Vertical Wedge')}
          </Text>
          <XStack gap="$1.5" flexWrap="wrap">
            {STARTUP_VERTICAL_PRESETS.map((v) => {
              const active = config.vertical === v.id
              return (
                <XStack
                  key={v.id}
                  render={<button type="button" />}
                  data-slot={`startup-vertical-${v.id}`}
                  aria-pressed={active}
                  onClick={() => onUpdateConfig({ vertical: v.id })}
                  px="$2.5"
                  py="$1.5"
                  rounded="$2"
                  borderWidth={1}
                  borderColor={active ? 'var(--border-strong)' : '$edge'}
                  bg={active ? '$raised' : '$background'}
                  hoverStyle={{ bg: '$hover' }}
                  cursor="pointer"
                >
                  <Text fontSize="$2" fontWeight={active ? '600' : '400'} color={active ? '$ink' : '$soft'}>
                    {v.label}
                  </Text>
                </XStack>
              )
            })}
          </XStack>
        </YStack>

        {/* Intelligence Architecture Picker */}
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="600" color="$soft">
            {t('Intelligence Architecture')}
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {ARCHITECTURE_OPTIONS.map((opt) => {
              const active = config.architecture === opt.id
              return (
                <YStack
                  key={opt.id}
                  render={<button type="button" />}
                  data-slot={`startup-arch-${opt.id}`}
                  aria-pressed={active}
                  onClick={() => onUpdateConfig({ architecture: opt.id })}
                  flex={1}
                  minW={compact ? 180 : 210}
                  p="$2.5"
                  rounded="$3"
                  borderWidth={1}
                  borderColor={active ? 'var(--border-strong)' : '$edge'}
                  bg={active ? '$raised' : '$background'}
                  hoverStyle={{ bg: '$hover' }}
                  gap="$0.5"
                  cursor="pointer"
                >
                  <Text fontSize="$2" fontWeight="600" color="$ink" text="start">
                    {opt.label}
                  </Text>
                  <Text fontSize="$1" color="$soft" text="start">
                    {opt.detail}
                  </Text>
                </YStack>
              )
            })}
          </XStack>
        </YStack>
      </YStack>

      {/* 6 Launch Stages with Live Deep-Links */}
      <YStack gap="$2">
        {STARTUP_BUILDER_STAGES.map((stage) => {
          const done = config.completedStages.includes(stage.id)
          return (
            <YStack
              key={stage.id}
              data-slot={`startup-stage-${stage.stageNumber}`}
              p="$3.5"
              rounded="$3"
              borderWidth={1}
              borderColor={done ? 'var(--border-strong)' : '$edge'}
              bg={done ? '$raised' : 'var(--card)'}
              gap="$2"
            >
              <XStack items="flex-start" justify="space-between" gap="$2.5" flexWrap="wrap">
                <XStack items="flex-start" gap="$2.5" flex={1} minW={240}>
                  <XStack
                    render={<button type="button" />}
                    data-slot={`startup-stage-check-${stage.stageNumber}`}
                    aria-label={`Mark stage ${stage.stageNumber} complete`}
                    aria-pressed={done}
                    onClick={() => onToggleStage(stage.id)}
                    width={24}
                    height={24}
                    rounded="$2"
                    borderWidth={1}
                    borderColor={done ? 'var(--state-online)' : '$edge'}
                    bg="$background"
                    items="center"
                    justify="center"
                    cursor="pointer"
                    shrink={0}
                  >
                    {done ? (
                      <Check size={14} color="var(--state-online)" aria-hidden />
                    ) : (
                      <Text fontSize="$1" fontFamily="$mono" color="$soft">
                        {stage.stageNumber}
                      </Text>
                    )}
                  </XStack>
                  <YStack flex={1} minW={0} gap="$1">
                    <Text fontSize="$3" fontWeight="600" color="$ink">
                      {stage.stageNumber}. {stage.title}
                    </Text>
                    <Text fontSize="$2" color="$soft">
                      {stage.summary}
                    </Text>
                    <Text fontSize="$1" fontFamily="$mono" color="$quiet">
                      Deliverable: {stage.deliverable}
                    </Text>
                  </YStack>
                </XStack>

                <XStack gap="$1.5" flexWrap="wrap" shrink={0}>
                  <Button
                    size="sm"
                    variant="outline"
                    data-slot={`startup-stage-action-${stage.stageNumber}`}
                    onPress={() => openHref(stage.actionHref, stage.actionExternal)}
                  >
                    {stage.actionLabel}
                    {stage.actionExternal ? <ExternalLink size={12} aria-hidden /> : null}
                  </Button>
                  {stage.secondaryLabel && stage.secondaryHref ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      data-slot={`startup-stage-secondary-${stage.stageNumber}`}
                      onPress={() => openHref(stage.secondaryHref!, stage.secondaryExternal)}
                    >
                      {stage.secondaryLabel}
                      {stage.secondaryExternal ? <ExternalLink size={12} aria-hidden /> : null}
                    </Button>
                  ) : null}
                </XStack>
              </XStack>
            </YStack>
          )
        })}
      </YStack>
    </YStack>
  )
}

// ── Standard Hands-On Lab Panel (All Other Courses) ──────────────────────────

export function StandardLabPanel({
  course,
  completedSteps,
  onToggleStep,
}: {
  course: CourseSpec
  completedSteps: readonly string[]
  onToggleStep: (stepId: string) => void
}) {
  const { t } = useI18n()

  const copySnippet = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast?.success?.(t('Snippet copied'))
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <YStack data-slot="standard-lab-panel" gap="$2.5">
      <XStack items="center" justify="space-between" gap="$2">
        <Text fontSize="$3" fontWeight="600" color="$ink">
          {t('Hands-On Lab Steps')}
        </Text>
        <Text fontSize="$1" fontFamily="$mono" color="$soft">
          {course.labSteps.filter((s) => completedSteps.includes(s.id)).length}/{course.labSteps.length} {t('complete')}
        </Text>
      </XStack>

      {course.labSteps.map((step) => {
        const done = completedSteps.includes(step.id)
        return (
          <YStack
            key={step.id}
            data-slot={`lab-step-${step.stepNumber}`}
            p="$3.5"
            rounded="$3"
            borderWidth={1}
            borderColor={done ? 'var(--border-strong)' : '$edge'}
            bg="var(--card)"
            gap="$2"
          >
            <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
              <XStack items="center" gap="$2" flex={1} minW={0}>
                <XStack
                  width={22}
                  height={22}
                  rounded="$2"
                  borderWidth={1}
                  borderColor={done ? 'var(--state-online)' : '$edge'}
                  items="center"
                  justify="center"
                  shrink={0}
                >
                  {done ? (
                    <Check size={13} color="var(--state-online)" aria-hidden />
                  ) : (
                    <Text fontSize="$1" fontFamily="$mono" color="$soft">
                      {step.stepNumber}
                    </Text>
                  )}
                </XStack>
                <YStack flex={1} minW={0}>
                  <Text fontSize="$3" fontWeight="600" color="$ink">
                    {step.title}
                  </Text>
                  {step.endpoint ? (
                    <Text fontSize="$1" fontFamily="$mono" color="$soft">
                      {step.endpoint}
                    </Text>
                  ) : null}
                </YStack>
              </XStack>
              <XStack gap="$1.5">
                <Button size="sm" variant="ghost" onPress={() => void copySnippet(step.snippet)}>
                  <Copy size={12} aria-hidden />
                  {t('Copy')}
                </Button>
                <Button
                  size="sm"
                  variant={done ? 'outline' : 'primary'}
                  data-slot={`lab-step-toggle-${step.stepNumber}`}
                  onPress={() => onToggleStep(step.id)}
                >
                  {done ? t('Completed') : t('Mark complete')}
                </Button>
              </XStack>
            </XStack>

            <Text fontSize="$2" color="$soft">
              {step.objective}
            </Text>

            <YStack p="$3" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background">
              <Text fontSize="$1" fontFamily="$mono" color="$ink">
                {step.snippet}
              </Text>
            </YStack>

            <XStack items="center" gap="$1.5">
              <ShieldCheck size={13} aria-hidden />
              <Text fontSize="$1" color="$soft">
                {t('Verification')}: {step.verificationHint}
              </Text>
            </XStack>
          </YStack>
        )
      })}
    </YStack>
  )
}

// ── Lab Terminal Tab (Isolated Sandbox via `POST /v1/dev/sessions`) ──────────

export function LabTerminalTab({
  course,
  signedIn,
  session,
  onSessionChange,
  onNavigate,
  onSignIn,
}: {
  course: CourseSpec
  signedIn: boolean
  session: SandboxSessionState | null
  onSessionChange: (next: SandboxSessionState | null) => void
  onNavigate: (to: string) => void
  onSignIn: () => void
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLaunch = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await launchLabSandbox(course.slug)
      if (res.session) {
        onSessionChange(res.session)
      } else {
        setError(res.error ?? 'Could not lease isolated sandbox.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleRelease = async () => {
    if (!session || busy) return
    setBusy(true)
    try {
      await releaseLabSandbox(session.id)
      onSessionChange(null)
    } finally {
      setBusy(false)
    }
  }

  const copyCmd = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd)
      toast?.success?.(t('Command copied'))
    } catch {
      // ignore
    }
  }

  return (
    <YStack data-slot="learn-lab-terminal" gap="$4">
      <YStack p="$4" rounded="$4" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$3">
        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2.5">
          <XStack items="center" gap="$2.5">
            <Terminal size={18} aria-hidden />
            <YStack>
              <Text fontSize="$4" fontWeight="600" color="$ink">
                {t('Isolated Lab Sandbox')} ({course.code})
              </Text>
              <Text fontSize="$2" color="$soft">
                {t('Lease a dedicated MicroVM/Visor sandbox via POST /v1/dev/sessions (runtime: "sandbox") or open this course directly in Hanzo Dev / Tabs.')}
              </Text>
            </YStack>
          </XStack>

          <XStack gap="$2" flexWrap="wrap">
            {!signedIn ? (
              <Button size="sm" variant="primary" data-slot="sandbox-signin-btn" onPress={onSignIn}>
                <LogIn size={13} aria-hidden />
                {t('Sign in to Launch Sandbox')}
              </Button>
            ) : !session ? (
              <Button size="sm" variant="primary" data-slot="sandbox-launch-btn" disabled={busy} onPress={() => void handleLaunch()}>
                {busy ? <Loader2 size={13} aria-hidden /> : <Play size={13} aria-hidden />}
                {busy ? t('Leasing MicroVM…') : t('Launch Isolated Sandbox')}
              </Button>
            ) : (
              <Button size="sm" variant="outline" data-slot="sandbox-release-btn" disabled={busy} onPress={() => void handleRelease()}>
                <Trash2 size={13} aria-hidden />
                {t('Release Sandbox')}
              </Button>
            )}
            <Button size="sm" variant="outline" data-slot="sandbox-open-dev" onPress={() => onNavigate(`/dev?prompt=${encodeURIComponent(`Start ${course.code} (${course.title}) lab workspace.`)}`)}>
              {t('Open in Hanzo Dev')}
            </Button>
            <Button size="sm" variant="ghost" data-slot="sandbox-open-tabs" onPress={() => onNavigate('/tabs')}>
              {t('Open Tabs Terminal')}
            </Button>
          </XStack>
        </XStack>

        {error ? (
          <YStack p="$3" rounded="$3" borderWidth={1} borderColor="var(--state-error)" bg="$background">
            <Text fontSize="$2" color="var(--state-error)">
              {error}
            </Text>
          </YStack>
        ) : null}

        {session ? (
          <YStack
            data-slot="sandbox-active-lease"
            p="$3.5"
            rounded="$3"
            borderWidth={1}
            borderColor="var(--border-strong)"
            bg="$background"
            gap="$1.5"
          >
            <XStack items="center" gap="$2">
              <YStack width={8} height={8} rounded={999} bg="var(--state-online)" />
              <Text fontSize="$2" fontWeight="600" color="$ink">
                {session.label} · {t('Active Sandbox Lease')}
              </Text>
            </XStack>
            <Text fontSize="$1" fontFamily="$mono" color="$soft">
              Session ID: {session.id}
              {session.sandbox ? ` · Sandbox: ${session.sandbox}` : ''}
              {session.zap ? ` · ZAP: ${session.zap}` : ''}
            </Text>
          </YStack>
        ) : (
          <YStack p="$3" rounded="$3" borderWidth={1} borderColor="$edge" bg="$background" gap="$1">
            <Text fontSize="$2" color="$soft">
              {t('No active cloud sandbox lease yet. Click "Launch Isolated Sandbox" to provision an ephemeral Visor cell scoped to your Hanzo IAM org.')}
            </Text>
          </YStack>
        )}
      </YStack>

      {/* Course Sandbox Commands */}
      <YStack p="$4" rounded="$4" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$2.5">
        <Text fontSize="$3" fontWeight="600" color="$ink">
          {t('Lab Shell Quick Commands')}
        </Text>
        <YStack gap="$2">
          {course.sandboxCommands.map((item, idx) => (
            <YStack key={idx} p="$3" rounded="$3" borderWidth={1} borderColor="$edge" bg="$background" gap="$1.5">
              <XStack items="center" justify="space-between" gap="$2">
                <Text fontSize="$2" fontWeight="600" color="$ink">
                  {item.label}
                </Text>
                <Button size="sm" variant="ghost" onPress={() => void copyCmd(item.command)}>
                  <Copy size={12} aria-hidden />
                  {t('Copy')}
                </Button>
              </XStack>
              <Text fontSize="$1" fontFamily="$mono" color="$soft">
                $ {item.command}
              </Text>
            </YStack>
          ))}
        </YStack>
      </YStack>
    </YStack>
  )
}
