'use client'

import type { ReactNode } from 'react'
import { Box, Text, YStack } from '@hanzo/ui'

export type StateCardKind = 'empty' | 'error' | 'access'

const FOCUS_RING = { outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' } as const

/**
 * Shared empty, error, and access state card with optional primary recovery CTA.
 */
export function StateCard({
  kind = 'empty',
  title,
  detail,
  actionLabel,
  onAction,
  action,
  headingLevel,
  dataSlot = 'state-card',
}: {
  kind?: StateCardKind
  title: string
  detail?: string
  actionLabel?: string
  onAction?: () => void
  action?: ReactNode
  headingLevel?: 'h1'
  dataSlot?: string
}) {
  const isError = kind === 'error'
  return (
    <YStack
      data-slot={dataSlot}
      data-state-kind={kind}
      role={isError ? 'alert' : 'status'}
      flex={1}
      items="center"
      justify="center"
      p="$6"
      gap="$3"
    >
      <Text
        render={headingLevel === 'h1' ? 'h1' : undefined}
        fontSize={headingLevel === 'h1' ? '$5' : '$4'}
        fontWeight="600"
        color="$ink"
        text="center"
      >
        {title}
      </Text>
      {detail ? (
        <Text fontSize="$2" color={isError ? 'var(--destructive)' : '$soft'} text="center" maxW={440}>
          {detail}
        </Text>
      ) : null}
      {action ? (
        action
      ) : actionLabel && onAction ? (
        <Box
          render={<button type="button" />}
          data-slot={`${dataSlot}-action`}
          onClick={onAction}
          px="$3.5"
          py="$2"
          $max-sm={{ minH: 44, display: 'flex', items: 'center', justify: 'center' }}
          rounded="$3"
          bg={isError ? 'var(--accent)' : 'transparent'}
          borderWidth={1}
          borderColor="var(--border-strong)"
          hoverStyle={{ bg: isError ? 'var(--accent-hover)' : '$hover' }}
          focusVisibleStyle={FOCUS_RING}
          cursor="pointer"
        >
          <Text
            fontSize="$2"
            fontWeight="500"
            color={isError ? 'var(--accent-foreground)' : '$ink'}
          >
            {actionLabel}
          </Text>
        </Box>
      ) : null}
    </YStack>
  )
}
