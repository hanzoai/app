'use client'

import { useI18n } from '@hanzo/i18n/react'
import { YStack } from '@hanzo/gui'
import { Text } from '@hanzo/ui'
import type { FlowStepResult } from './types'

export function FlowStepIo({ step }: { step: FlowStepResult }) {
  const { t } = useI18n()
  return (
    <YStack data-slot="step-io-details" gap="$1.5" pt="$1">
      <YStack gap="$0.5" data-slot="step-input-block">
        <Text fontSize="$1" fontWeight="600" color="$quiet">
          {t('Input')}
        </Text>
        <Text
          fontSize="$1"
          fontFamily="$mono"
          color="$soft"
          p="$1.5"
          rounded="$2"
          bg="$background"
          borderWidth={1}
          borderColor="$edge"
          $platform-web={{ whiteSpace: 'pre-wrap' }}
        >
          {step.input ? step.input : t('(none)')}
        </Text>
      </YStack>
      <YStack gap="$0.5" data-slot="step-output-block">
        <Text fontSize="$1" fontWeight="600" color={step.error ? 'var(--state-error)' : '$quiet'}>
          {step.error ? t('Error') : t('Output')}
        </Text>
        <Text
          fontSize="$1"
          fontFamily="$mono"
          color={step.error ? 'var(--state-error)' : '$soft'}
          p="$1.5"
          rounded="$2"
          bg="$background"
          borderWidth={1}
          borderColor={step.error ? 'var(--state-error)' : '$edge'}
          $platform-web={{ whiteSpace: 'pre-wrap' }}
        >
          {step.error || step.output || t('(no output)')}
        </Text>
      </YStack>
    </YStack>
  )
}
