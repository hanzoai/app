'use client'

import React, { useRef, useState } from 'react'
import { Box, Popover, PopoverContent, PopoverTrigger, Text, XStack, YStack } from '@hanzo/ui'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useI18n } from '@hanzo/i18n/react'

export type EffortLevel = 'auto' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export const DEFAULT_EFFORT: EffortLevel = 'high'

export interface EffortStep {
  id: EffortLevel
  label: string
  note: string
}

export const EFFORT_STEPS: readonly EffortStep[] = [
  { id: 'auto', label: 'Auto', note: 'Adaptive reasoning based on task complexity' },
  { id: 'low', label: 'Low', note: 'A quick pass with minimal thinking' },
  { id: 'medium', label: 'Medium', note: 'Thinks before answering' },
  { id: 'high', label: 'High', note: 'Deep reasoning for complex problems' },
  { id: 'xhigh', label: 'XHigh', note: 'Extended multi-step reasoning for hard tasks' },
  { id: 'max', label: 'Max', note: 'Maximum compute and exhaustive verification' },
]

export interface ThinkingEffortProps {
  effort?: EffortLevel
  onChange: (effort: EffortLevel) => void
  disabled?: boolean
}

/**
 * Native iOS widget-style Thinking effort selector matching standard Safari mobile symmetry:
 * - Subtle pill button: "Thinking effort ⌄"
 * - Segmented slider popover with discrete stop dots and smooth active fill
 * - Default level: "high" across all plans
 */
export function ThinkingEffort({ effort = DEFAULT_EFFORT, onChange, disabled = false }: ThinkingEffortProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement | null>(null)

  const foundIndex = EFFORT_STEPS.findIndex((s) => s.id === effort)
  const activeIndex = foundIndex >= 0 ? foundIndex : EFFORT_STEPS.findIndex((s) => s.id === DEFAULT_EFFORT)
  const current = EFFORT_STEPS[activeIndex] ?? EFFORT_STEPS[3]

  const updateFromPosition = (clientX: number) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const relativeX = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const ratio = rect.width > 0 ? relativeX / rect.width : 0
    const stepIndex = Math.round(ratio * (EFFORT_STEPS.length - 1))
    const selected = EFFORT_STEPS[stepIndex]
    if (selected && selected.id !== effort) {
      onChange(selected.id)
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    setDragging(true)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    updateFromPosition(e.clientX)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || disabled) return
    updateFromPosition(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragging) {
      setDragging(false)
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    }
  }

  const percentage = (activeIndex / (EFFORT_STEPS.length - 1)) * 100

  return (
    <Popover open={open} onOpenChange={setOpen} allowFlip>
      <PopoverTrigger disabled={disabled}>
        <XStack
          data-slot="thinking-effort-pill"
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={t('Thinking effort: {label}', { label: current.label })}
          aria-haspopup="dialog"
          aria-expanded={open}
          items="center"
          gap="$1"
          px="$2.5"
          height={32}
          rounded={9999}
          cursor={disabled ? 'default' : 'pointer'}
          bg="var(--edge, var(--white-10))"
          borderWidth={1}
          borderColor="var(--pane-edge, var(--white-10))"
          hoverStyle={disabled ? undefined : { bg: '$hover' }}
          focusVisibleStyle={{ outlineColor: '$outlineColor', outlineWidth: 2, outlineStyle: 'solid' }}
          opacity={disabled ? 0.45 : 1}
          onKeyDown={(e: any) => {
            if (disabled) return
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
            }
          }}
        >
          <Text fontSize="$2" fontWeight="500" color="$ink">
            {t('Thinking effort')}
          </Text>
          <ChevronDown size={12} color="var(--soft, var(--muted-foreground))" aria-hidden />
        </XStack>
      </PopoverTrigger>

      <PopoverContent
        solid
        align="end"
        p="$3"
        width={240}
        rounded="$4"
        bg="var(--pane-fill, var(--surface-card))"
        borderWidth={1}
        borderColor="var(--pane-edge, var(--white-15))"
        boxShadow="var(--shadow-sheet-1)"
        backdropFilter="var(--pane-blur, blur(24px) saturate(190%))"
      >
        <YStack gap="$3" data-slot="thinking-effort-card" role="dialog" aria-label={t('Thinking effort')}>
          {/* Header */}
          <XStack
            items="center"
            justify="center"
            gap="$1"
            cursor="pointer"
            onClick={() => {
              if (disabled) return
              const next = EFFORT_STEPS[(activeIndex + 1) % EFFORT_STEPS.length]
              if (next) onChange(next.id)
            }}
          >
            <Text fontSize="$3" fontWeight="600" color="$ink">
              {current.label}
            </Text>
            <ChevronRight size={14} color="var(--soft, var(--muted-foreground))" aria-hidden />
          </XStack>

          {/* Interactive Slider Track */}
          <Box
            ref={trackRef}
            data-slot="thinking-slider-track"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={EFFORT_STEPS.length - 1}
            aria-valuenow={activeIndex}
            aria-valuetext={current.label}
            position="relative"
            width="100%"
            height={28}
            rounded={9999}
            bg="var(--edge, var(--white-14))"
            cursor="pointer"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => setDragging(false)}
            // inline-style: touch-action for discrete slider gestures
            style={{ touchAction: 'none' }}
          >
            {/* Active Blue/Accent Fill */}
            <Box
              position="absolute"
              insetInlineStart={0}
              t={0}
              b={0}
              rounded={9999}
              bg="var(--accent, var(--primary))"
              // inline-style: dynamic percentage width of active effort slider fill
              style={{
                width: `calc(${percentage}% + 14px)`,
                maxWidth: '100%',
                transition: dragging ? 'none' : 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />

            {/* Step Dots */}
            {EFFORT_STEPS.map((step, idx) => {
              const dotPercent = (idx / (EFFORT_STEPS.length - 1)) * 100
              const isPassed = idx <= activeIndex
              return (
                <Box
                  key={step.id}
                  position="absolute"
                  t="50%"
                  // inline-style: discrete dot step stop position on track
                  style={{
                    left: `calc(14px + (100% - 28px) * ${dotPercent / 100})`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  width={4}
                  height={4}
                  rounded={9999}
                  bg={isPassed ? 'var(--pure-white)' : 'var(--white-40)'}
                  pointerEvents="none"
                />
              )
            })}

            {/* Round White Thumb Knob */}
            <Box
              data-slot="thinking-slider-thumb"
              position="absolute"
              t={2}
              width={24}
              height={24}
              rounded={9999}
              bg="var(--pure-white)"
              boxShadow="0 2px 6px var(--surface-overlay)"
              pointerEvents="none"
              // inline-style: discrete thumb position computed from active step
              style={{
                left: `calc(2px + (100% - 28px) * ${percentage / 100})`,
                transition: dragging ? 'none' : 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            />
          </Box>

          {/* Descriptive Note */}
          <Text fontSize="$1" color="$soft" text="center" px="$1">
            {t(current.note)}
          </Text>
        </YStack>
      </PopoverContent>
    </Popover>
  )
}
