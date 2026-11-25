'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Input, Text, Textarea } from '@hanzo/ui'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Cpu,
  Loader2,
  LogIn,
  Play,
  ShieldCheck,
} from 'lucide-react'
import {
  invokeKaiDecision,
  submitKaiCapabilityTrain,
  validateKaiDecisionPayload,
  validateKaiTrainPayload,
} from './api'
import { KAI_301_LAB_STEPS, KAI_CALIBRATION_CHECKLIST } from './catalog'
import type { KaiPlaygroundResult } from './types'

const DEFAULT_DECISION_JSON = JSON.stringify(
  {
    capability: 'acme-lead-triage',
    input: {
      company: 'Northstar Bio',
      seats: 120,
      use_case: 'HIPAA zero-trust clinical inference',
      inbound_channel: 'enterprise-form',
    },
    choices: ['enterprise_fast_track', 'solutions_engineering', 'self_serve_nurture', 'disqualify'],
    dry_run: true,
  },
  null,
  2,
)

const DEFAULT_TRAIN_JSON = JSON.stringify(
  {
    capability: 'acme-lead-triage',
    base_model: 'kai-core-v2',
    dataset_uri: 'hanzo://datasets/acme-lead-triage/v1',
    preregistered_threshold: {
      min_accuracy: 0.88,
      max_ece: 0.04,
      max_p95_ms: 180,
    },
    epochs: 3,
  },
  null,
  2,
)

export function KaiLabPlayground({
  signedIn,
  completedSteps,
  calibrationChecks,
  onToggleStep,
  onToggleCalibration,
  onResultRecorded,
  onSignIn,
}: {
  signedIn: boolean
  completedSteps: readonly string[]
  calibrationChecks: readonly string[]
  onToggleStep: (stepId: string) => void
  onToggleCalibration: (checkId: string) => void
  onResultRecorded: (result: KaiPlaygroundResult) => void
  onSignIn: () => void
}) {
  const { t } = useI18n()
  const [activeStepIdx, setActiveStepIdx] = useState(0)
  const [endpointMode, setEndpointMode] = useState<'decisions' | 'train'>('decisions')
  const [capabilityName, setCapabilityName] = useState('acme-lead-triage')
  const [decisionPayload, setDecisionPayload] = useState(DEFAULT_DECISION_JSON)
  const [trainPayload, setTrainPayload] = useState(DEFAULT_TRAIN_JSON)
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<KaiPlaygroundResult | null>(null)

  const currentPayload = endpointMode === 'decisions' ? decisionPayload : trainPayload
  const validation = useMemo(
    () =>
      endpointMode === 'decisions'
        ? validateKaiDecisionPayload(decisionPayload)
        : validateKaiTrainPayload(trainPayload),
    [endpointMode, decisionPayload, trainPayload],
  )

  const activeStep = KAI_301_LAB_STEPS[activeStepIdx] ?? KAI_301_LAB_STEPS[0]!
  const stepsDoneCount = KAI_301_LAB_STEPS.filter((s) => completedSteps.includes(s.id)).length
  const calDoneCount = KAI_CALIBRATION_CHECKLIST.filter((c) => calibrationChecks.includes(c.id)).length

  const handleRunLive = async () => {
    if (!validation.valid || !validation.parsed || running) return
    setRunning(true)
    try {
      const res =
        endpointMode === 'decisions'
          ? await invokeKaiDecision(validation.parsed)
          : await submitKaiCapabilityTrain(capabilityName, validation.parsed)
      setLastResult(res)
      onResultRecorded(res)
    } finally {
      setRunning(false)
    }
  }

  return (
    <YStack data-slot="kai-301-lab" gap="$4">
      {/* Lab 01 Header */}
      <YStack p="$4" rounded="$4" borderWidth={1} borderColor="$edge" bg="var(--card)" gap="$2">
        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
          <XStack items="center" gap="$2">
            <Cpu size={16} aria-hidden />
            <Text fontSize="$4" fontWeight="600" color="$ink">
              Lab 01: Teach Kai your business
            </Text>
          </XStack>
          <XStack gap="$2" items="center" flexWrap="wrap">
            <XStack px="$2.5" py="$1" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background">
              <Text fontSize="$1" fontFamily="$mono" color="$ink">
                {stepsDoneCount}/{KAI_301_LAB_STEPS.length} steps complete
              </Text>
            </XStack>
            <XStack px="$2.5" py="$1" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background">
              <Text fontSize="$1" fontFamily="$mono" color="$ink">
                {calDoneCount}/{KAI_CALIBRATION_CHECKLIST.length} calibration checks
              </Text>
            </XStack>
          </XStack>
        </XStack>
        <Text fontSize="$2" color="$soft">
          {t('Follow all 9 steps end-to-end: define your business decision contract, validate schemas, submit a training job to POST /v1/capabilities/{name}/train, verify ECE calibration, and test live inference on POST /v1/decisions with Hanzo IAM.')}
        </Text>
      </YStack>

      {/* 9-Step Interactive Tracker */}
      <YStack data-slot="kai-9-step-tracker" gap="$2">
        <Text fontSize="$3" fontWeight="600" color="$ink">
          {t('9-Step Lab Progression')}
        </Text>
        <YStack gap="$1.5">
          {KAI_301_LAB_STEPS.map((step, idx) => {
            const done = completedSteps.includes(step.id)
            const selected = idx === activeStepIdx
            return (
              <YStack
                key={step.id}
                data-slot={`kai-step-${step.stepNumber}`}
                rounded="$3"
                borderWidth={1}
                borderColor={selected ? 'var(--border-strong)' : '$edge'}
                bg={selected ? '$raised' : 'var(--card)'}
                p="$3"
                gap="$2"
              >
                <XStack items="center" justify="space-between" gap="$2">
                  <XStack
                    render={<button type="button" />}
                    onClick={() => setActiveStepIdx(idx)}
                    flex={1}
                    minW={0}
                    items="center"
                    gap="$2.5"
                    cursor="pointer"
                    bg="transparent"
                    borderWidth={0}
                  >
                    <XStack
                      width={22}
                      height={22}
                      rounded="$2"
                      borderWidth={1}
                      borderColor={done ? 'var(--state-online)' : '$edge'}
                      bg={done ? '$background' : 'transparent'}
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
                      <Text fontSize="$2" fontWeight="600" color="$ink" text="start">
                        {step.title}
                      </Text>
                      {step.endpoint ? (
                        <Text fontSize="$1" fontFamily="$mono" color="$soft" text="start">
                          {step.endpoint}
                        </Text>
                      ) : null}
                    </YStack>
                  </XStack>
                  <Button
                    size="sm"
                    variant={done ? 'outline' : 'ghost'}
                    data-slot={`kai-step-toggle-${step.stepNumber}`}
                    onPress={() => onToggleStep(step.id)}
                  >
                    {done ? t('Completed') : t('Mark done')}
                  </Button>
                </XStack>

                {selected ? (
                  <YStack gap="$2" pt="$1" borderTopWidth={1} borderColor="$edge">
                    <Text fontSize="$2" color="$soft">
                      {step.objective}
                    </Text>
                    <YStack p="$2.5" rounded="$2" borderWidth={1} borderColor="$edge" bg="$background">
                      <Text fontSize="$1" fontFamily="$mono" color="$ink">
                        {step.snippet}
                      </Text>
                    </YStack>
                    <XStack items="center" gap="$1.5">
                      <ShieldCheck size={13} aria-hidden />
                      <Text fontSize="$1" color="$soft">
                        {t('Verify')}: {step.verificationHint}
                      </Text>
                    </XStack>
                  </YStack>
                ) : null}
              </YStack>
            )
          })}
        </YStack>
      </YStack>

      {/* Live API Playground (`POST /v1/decisions` & `POST /v1/capabilities/{name}/train`) */}
      <YStack
        data-slot="kai-live-playground"
        p="$4"
        rounded="$4"
        borderWidth={1}
        borderColor="$edge"
        bg="var(--card)"
        gap="$3"
      >
        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
          <YStack gap="$0.5">
            <Text fontSize="$3" fontWeight="600" color="$ink">
              {t('Live Kai API Playground')}
            </Text>
            <Text fontSize="$1" fontFamily="$mono" color="$soft">
              {endpointMode === 'decisions'
                ? 'POST https://api.hanzo.ai/v1/decisions'
                : `POST https://api.hanzo.ai/v1/capabilities/${capabilityName || '{name}'}/train`}
            </Text>
          </YStack>

          <XStack gap="$1.5">
            <Button
              size="sm"
              variant={endpointMode === 'decisions' ? 'primary' : 'outline'}
              data-slot="kai-mode-decisions"
              onPress={() => setEndpointMode('decisions')}
            >
              POST /v1/decisions
            </Button>
            <Button
              size="sm"
              variant={endpointMode === 'train' ? 'primary' : 'outline'}
              data-slot="kai-mode-train"
              onPress={() => setEndpointMode('train')}
            >
              POST /v1/capabilities/{'{name}'}/train
            </Button>
          </XStack>
        </XStack>

        {endpointMode === 'train' ? (
          <XStack items="center" gap="$2" flexWrap="wrap">
            <Text fontSize="$2" fontWeight="500" color="$ink">
              {t('Capability name')}
            </Text>
            <Input
              flex={1}
              minW={200}
              data-slot="kai-capability-name"
              value={capabilityName}
              onChangeText={setCapabilityName}
              placeholder="acme-lead-triage"
            />
          </XStack>
        ) : null}

        <Textarea
          data-slot="kai-payload-editor"
          aria-label="Kai JSON request payload"
          minH={170}
          fontFamily="$mono"
          fontSize="$2"
          value={currentPayload}
          onChangeText={(next: string) =>
            endpointMode === 'decisions' ? setDecisionPayload(next) : setTrainPayload(next)
          }
        />

        {/* Dry-Run & Schema Validation Panel */}
        <YStack
          data-slot="kai-schema-validator"
          p="$3"
          rounded="$3"
          borderWidth={1}
          borderColor={validation.valid ? '$edge' : 'var(--state-error)'}
          bg="$background"
          gap="$1.5"
        >
          <XStack items="center" gap="$2">
            {validation.valid ? (
              <CheckCircle2 size={14} color="var(--state-online)" aria-hidden />
            ) : (
              <AlertTriangle size={14} color="var(--state-error)" aria-hidden />
            )}
            <Text fontSize="$2" fontWeight="600" color={validation.valid ? '$ink' : 'var(--state-error)'}>
              {validation.valid
                ? t('Schema & contract valid (ready for dry-run or live IAM execution)')
                : t('Schema validation errors')}
            </Text>
          </XStack>
          {validation.errors.map((err, i) => (
            <Text key={i} fontSize="$1" fontFamily="$mono" color="var(--state-error)">
              • {err}
            </Text>
          ))}
          {validation.warnings.map((warn, i) => (
            <Text key={i} fontSize="$1" color="$soft">
              • {warn}
            </Text>
          ))}
        </YStack>

        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
          <Text fontSize="$1" color="$soft">
            {signedIn
              ? t('Authenticated automatically with your Hanzo IAM Bearer token (zero static keys).')
              : t('Dry-run schema validator works signed out; sign in with Hanzo IAM to execute live cloud calls.')}
          </Text>
          <XStack gap="$2">
            {!signedIn ? (
              <Button size="sm" variant="primary" data-slot="kai-playground-signin" onPress={onSignIn}>
                <LogIn size={13} aria-hidden />
                {t('Sign in to Run Live')}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                data-slot="kai-playground-run"
                disabled={!validation.valid || running}
                onPress={() => void handleRunLive()}
              >
                {running ? <Loader2 size={13} aria-hidden /> : <Play size={13} aria-hidden />}
                {running ? t('Executing…') : t('Send Live /v1/ Request')}
              </Button>
            )}
          </XStack>
        </XStack>

        {lastResult ? (
          <YStack
            data-slot="kai-playground-response"
            p="$3"
            rounded="$3"
            borderWidth={1}
            borderColor={lastResult.ok ? '$edge' : 'var(--state-error)'}
            bg="$background"
            gap="$1.5"
          >
            <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
              <Text fontSize="$1" fontFamily="$mono" fontWeight="600" color="$ink">
                {lastResult.endpoint} · HTTP {lastResult.status} · {lastResult.latencyMs}ms
              </Text>
              <Text fontSize="$1" fontFamily="$mono" color="$soft">
                {lastResult.ok ? 'OK' : 'ERROR'}
              </Text>
            </XStack>
            {lastResult.error ? (
              <Text fontSize="$2" color="var(--state-error)">
                {lastResult.error}
              </Text>
            ) : null}
            {lastResult.body ? (
              <Text fontSize="$1" fontFamily="$mono" color="$soft">
                {JSON.stringify(lastResult.body, null, 2)}
              </Text>
            ) : null}
          </YStack>
        ) : null}
      </YStack>

      {/* Calibration & Regression Evaluation Checklist */}
      <YStack
        data-slot="kai-calibration-checklist"
        p="$4"
        rounded="$4"
        borderWidth={1}
        borderColor="$edge"
        bg="var(--card)"
        gap="$2.5"
      >
        <Text fontSize="$3" fontWeight="600" color="$ink">
          {t('Calibration & Regression Evaluation Gate')}
        </Text>
        <Text fontSize="$2" color="$soft">
          {t('Verify every gate before promoting a trained capability to production (active step:')} {activeStep.stepNumber}. {activeStep.title}).
        </Text>
        <YStack gap="$1.5">
          {KAI_CALIBRATION_CHECKLIST.map((item) => {
            const checked = calibrationChecks.includes(item.id)
            return (
              <XStack
                key={item.id}
                render={<button type="button" />}
                data-slot={`kai-cal-${item.id}`}
                aria-pressed={checked}
                onClick={() => onToggleCalibration(item.id)}
                p="$2.5"
                rounded="$3"
                borderWidth={1}
                borderColor={checked ? 'var(--border-strong)' : '$edge'}
                bg={checked ? '$raised' : '$background'}
                hoverStyle={{ bg: '$hover' }}
                items="flex-start"
                gap="$2.5"
                cursor="pointer"
              >
                <XStack
                  width={18}
                  height={18}
                  mt={2}
                  rounded="$1"
                  borderWidth={1}
                  borderColor={checked ? 'var(--state-online)' : '$edge'}
                  items="center"
                  justify="center"
                  shrink={0}
                >
                  {checked ? <Check size={12} color="var(--state-online)" aria-hidden /> : null}
                </XStack>
                <YStack flex={1} minW={0} gap="$0.5">
                  <Text fontSize="$2" fontWeight="600" color="$ink" text="start">
                    {item.label}
                  </Text>
                  <Text fontSize="$1" color="$soft" text="start">
                    {item.detail}
                  </Text>
                </YStack>
              </XStack>
            )
          })}
        </YStack>
      </YStack>
    </YStack>
  )
}
