'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { ArrowUpRight, Gauge, RotateCcw, Sparkles } from 'lucide-react'
import {
  Anchor,
  Box,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  ProgressRing,
  Text,
  XStack,
  YStack,
  toast,
} from '@hanzo/ui'
import { ComposerStatusProvider } from '@hanzo/ui/chat'
import type { Limits, LimitWindow } from '@hanzo/ui/product/limits'
import type { UseLimits } from '@hanzo/ui/product/useLimits'
import { label } from '@hanzo/dev/plan'
import { showSettings } from './open'
import { hasSession, org, subject } from './lib/session'
import { cents } from './lib/org'
import { payPage } from './lib/pay'
import {
  resets,
  resetUsageLimits,
  useLimits,
  type ExtendedClassLimit,
  type ExtendedLimits,
  type UseExtendedLimits,
} from './lib/limits'
import { useTier } from './lib/tier'
import { rememberSettingsReturn, useDevMode } from './lib/dev-mode'
import { contextOf, readTokens, subscribeTokens, tokenKey, type Turn } from './lib/tokens'

export interface ContextUsage {
  model: string
  window?: number
  messages: readonly Turn[]
  draft?: string
  tools?: unknown
}

export interface UsageSummary {
  /** Bounded 5-hour/session percent used (0-100), or null when not reported. */
  sessionPercent: number | null
  sessionResetsAt: string | null
  sessionCapped: boolean
  /** Bounded weekly Hanzo allowance percent used (0-100), or null when not reported. */
  weeklyPercent: number | null
  weeklyResetsAt: string | null
  weeklyCapped: boolean
  /** Peak bounded Hanzo usage percent across session and weekly windows, or null. */
  peakPercent: number | null
  /** Live percent displayed in the composer gauge (falls back to context window percent). */
  livePercent: number | null
  /** True only when bounded plan-paid Hanzo usage is actually exhausted. */
  isCapped: boolean
  /** True when bounded plan-paid Hanzo usage is >= 85% and not yet capped. */
  isNear: boolean
  /** True when the user's Hanzo plan class (`ours`) is unbounded (unlimited/enterprise). */
  oursUnbounded: boolean
  /** True when prepaid balance is strictly positive. */
  hasPositiveCredits: boolean
  /** True when the 1×/week free usage reset is available and there is usage to reset. */
  canFreeReset: boolean
  /** Earliest relevant reset timestamp for the active bounded limit. */
  resetIso: string | null
}

/**
 * Single source of truth for Hanzo usage status shared by `UsageControl` and `RailUsageButton`.
 *
 * Only bounded, plan-paid Hanzo classes count toward Hanzo plan exhaustion:
 * - Unbounded plans (`classes.ours.unbounded === true` or `plan === 'unlimited'`) are NEVER capped.
 * - Credit-paid classes (`paying === 'credits'`, e.g. third-party `premium` models paid from a
 *   positive prepaid credit balance) NEVER cause a false "You're out of Hanzo usage" alert.
 */
export function summarizeUsage(
  limits: ExtendedLimits | Limits | null | undefined,
  effectiveAvailable: number | null | undefined,
  contextPercent: number | null = null,
): UsageSummary {
  const ext = limits as ExtendedLimits | null | undefined
  const ours = ext?.classes?.ours as ExtendedClassLimit | undefined
  const oursUnbounded = Boolean(ours?.unbounded || ext?.plan === 'unlimited')
  const hasPositiveCredits = typeof effectiveAvailable === 'number' && Number.isFinite(effectiveAvailable) && effectiveAvailable > 0

  const entries = ext?.classes
    ? (Object.entries(ext.classes) as [string, ExtendedClassLimit | undefined][]).filter(
        (entry): entry is [string, ExtendedClassLimit] => Boolean(entry[1]),
      )
    : []

  // Only bounded, plan-paid Hanzo classes contribute to Hanzo allowance exhaustion.
  // Exclude unbounded classes, credit-paid classes, and the free fallback lane.
  const boundedPlanClasses = entries
    .filter(([id, c]) => {
      if (id === 'free') return false
      if (c.unbounded) return false
      if (c.paying === 'credits') return false
      if (id === 'ours' && oursUnbounded) return false
      return true
    })
    .map(([, c]) => c)

  const boundedWindows: LimitWindow[] = boundedPlanClasses.flatMap((c) => (c.window ? [c.window] : []))
  const highestWindow = boundedWindows.length
    ? boundedWindows.reduce((best, w) => (w.percent > best.percent ? w : best), boundedWindows[0]!)
    : null

  const sessionSource = ext?.session ?? highestWindow
  const sessionPercent =
    sessionSource && !oursUnbounded
      ? Math.max(0, Math.min(100, Math.round(sessionSource.percent)))
      : oursUnbounded
        ? 0
        : null
  const sessionResetsAt = sessionSource?.resets_at ?? null
  const sessionCapped =
    !oursUnbounded &&
    Boolean(sessionSource && (sessionSource.state === 'limited' || (sessionPercent !== null && sessionPercent >= 100)))

  const highestBoundedWeekly = boundedPlanClasses.length
    ? Math.max(0, ...boundedPlanClasses.map((c) => c.percent ?? 0))
    : null

  const weeklyPercent = oursUnbounded
    ? 0
    : ours
      ? ours.paying === 'credits' && hasPositiveCredits
        ? 0
        : Math.max(0, Math.min(100, Math.round(ours.window?.percent ?? ours.percent ?? 0)))
      : highestBoundedWeekly !== null
        ? Math.max(0, Math.min(100, Math.round(highestBoundedWeekly)))
        : null

  const weeklyResetsAt = ours?.window?.resets_at ?? ours?.resets_at ?? boundedPlanClasses[0]?.resets_at ?? null
  const weeklyCapped =
    !oursUnbounded &&
    Boolean(
      (ours && ours.paying !== 'credits' && (ours.state === 'limited' || ours.window?.state === 'limited')) ||
        (boundedPlanClasses.length > 0 && weeklyPercent !== null && weeklyPercent >= 100),
    )

  const peakPercent =
    oursUnbounded
      ? 0
      : sessionPercent !== null || weeklyPercent !== null
        ? Math.max(sessionPercent ?? 0, weeklyPercent ?? 0)
        : null

  const allCreditsWithBalance =
    hasPositiveCredits &&
    entries.length > 0 &&
    entries.every(([id, c]) => id === 'free' || c.unbounded || c.paying === 'credits')

  const anyBoundedLimited =
    !oursUnbounded &&
    (boundedPlanClasses.some((c) => c.state === 'limited' || c.window?.state === 'limited') ||
      sessionSource?.state === 'limited')

  const topLimitedCounts =
    !oursUnbounded &&
    !allCreditsWithBalance &&
    ext?.state === 'limited' &&
    (boundedPlanClasses.length > 0 ||
      Boolean(ext.limited?.classes?.includes('ours')) ||
      (!ext.limited?.classes?.length && !hasPositiveCredits))

  const isCapped =
    !oursUnbounded &&
    !allCreditsWithBalance &&
    (anyBoundedLimited || topLimitedCounts || (boundedPlanClasses.length > 0 && (peakPercent ?? 0) >= 100))

  const isNear = !oursUnbounded && !isCapped && peakPercent !== null && peakPercent >= 85
  const livePercent = oursUnbounded ? contextPercent : peakPercent !== null ? peakPercent : contextPercent
  const canFreeReset = Boolean(ext?.reset?.available) && ((peakPercent ?? 0) > 0 || isCapped)
  const resetIso = sessionResetsAt ?? weeklyResetsAt

  return {
    sessionPercent,
    sessionResetsAt,
    sessionCapped,
    weeklyPercent,
    weeklyResetsAt,
    weeklyCapped,
    peakPercent,
    livePercent,
    isCapped,
    isNear,
    oursUnbounded,
    hasPositiveCredits,
    canFreeReset,
    resetIso,
  }
}

const HOVER_CLOSE_MS = 150
const STRONG = 'var(--border-strong)' as const
const FOCUS_RING = { outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' } as const

/** Crisp monochrome bar color; warning/error appear only at >=85% or 100% capped. */
function barColor(percent: number, capped = false): `var(--${string})` {
  if (capped || percent >= 100) return 'var(--state-error)'
  if (percent >= 85) return 'var(--chrome-dot-yellow)'
  return 'var(--foreground)'
}

/** Compact live usage symbol + hover breakdown shared by Chat, Dev, and Studio. */
export function UsageControl({ context, read }: { context?: ContextUsage; read?: UseLimits | UseExtendedLimits }) {
  const { t, format } = useI18n()
  const [devMode] = useDevMode()
  const [open, setOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverOpenedAt = useRef(0)

  const signedIn = hasSession()
  const currentOrg = org()
  const fallback = useLimits(!read && signedIn, currentOrg)
  const usage = read ?? fallback
  const { limits } = usage
  const { tier } = useTier(signedIn && Boolean(currentOrg), currentOrg)

  const key = signedIn && context ? tokenKey(currentOrg, context.model, context.messages, subject() ?? '') : ''
  const counted = useSyncExternalStore(subscribeTokens, () => (key ? readTokens(key) : null), () => null)

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [open])

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const handleMouseEnter = () => {
    clearCloseTimer()
    if (!open) {
      hoverOpenedAt.current = Date.now()
      setOpen(true)
      usage.reload()
    }
  }

  const handleMouseLeave = () => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => {
      setOpen(false)
    }, HOVER_CLOSE_MS)
  }

  if (!signedIn) return null

  const estimate = context ? contextOf(context.messages, context.draft, context.tools) : null
  const capacity = context?.window && context.window > 0 ? context.window : null
  const contextPercent = estimate && capacity ? Math.round((estimate.total / capacity) * 100) : null

  const summary = summarizeUsage(limits, tier?.balance?.effectiveAvailable, contextPercent)
  const { livePercent, isCapped, isNear, canFreeReset } = summary
  const showPercent = livePercent !== null && livePercent > 0

  const toneColor = isCapped
    ? 'var(--state-error)'
    : isNear
      ? '$ink'
      : '$aside'

  const ringColor = isCapped
    ? 'var(--state-error)'
    : isNear
      ? 'var(--chrome-dot-yellow)'
      : showPercent
        ? 'var(--foreground)'
        : 'var(--text-secondary)'

  const planInfo = limits?.plan
    ? label(limits.plan)
    : tier?.plan
      ? label(tier.plan)
      : null
  const planBadge = planInfo
    ? `${planInfo.name}${planInfo.tag ? ` ${planInfo.tag}` : ''}`
    : tier?.tier?.displayName || t('Free')

  const formatReset = (iso: string | null | undefined): string | null => {
    if (!iso) return null
    const at = Date.parse(iso)
    if (Number.isFinite(at) && at > now) {
      const diffMins = Math.floor((at - now) / 60_000)
      if (diffMins < 1) return t('Resets in <1m')
      if (diffMins < 60) return t('Resets in {m}m', { m: diffMins })
      if (diffMins < 24 * 60) {
        const hours = Math.floor(diffMins / 60)
        const mins = diffMins % 60
        return mins > 0
          ? t('Resets in {h}h {m}m', { h: hours, m: mins })
          : t('Resets in {h}h', { h: hours })
      }
      const days = Math.floor(diffMins / (24 * 60))
      return t('Resets in {d}d', { d: days })
    }
    const r = resets(iso, now, format)
    if (!r) return null
    if (r.date) {
      return r.time
        ? t('Resets {date} at {time}', { date: r.date, time: r.time })
        : t('Resets {date}', { date: r.date })
    }
    return r.time ? t('Resets at {time}', { time: r.time }) : t('Resets at midnight')
  }

  const sessionPercent = summary.sessionPercent ?? contextPercent ?? 0
  const sessionCapped = summary.sessionCapped
  const windowResetText = formatReset(summary.sessionResetsAt)
  const weeklyPercent = summary.weeklyPercent
  const weeklyCapped = summary.weeklyCapped
  const weeklyResetText = formatReset(summary.weeklyResetsAt)

  const showSafetyNet = isCapped || isNear

  const hasCredits = typeof tier?.balance?.effectiveAvailable === 'number'
  const creditsLabel = hasCredits
    ? cents(tier!.balance.effectiveAvailable, tier!.balance.currency || 'usd')
    : null

  const integer = (n: number) => format.number(n, { maximumFractionDigits: 0 })

  const toggle = (next: boolean) => {
    clearCloseTimer()
    setOpen(next)
    if (next) usage.reload()
  }

  const openSettingsTab = (section: 'billing' | 'usage') => {
    setOpen(false)
    rememberSettingsReturn()
    showSettings(section)
  }

  const handleFreeReset = async () => {
    if (resetting) return
    setResetting(true)
    try {
      await resetUsageLimits()
      usage.reload()
      toast.success(t('Usage reset for this week'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not reset usage'))
    } finally {
      setResetting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={toggle} placement="top-end" allowFlip stayInFrame>
      <PopoverTrigger asChild disablePressTrigger>
        <XStack
          render={<button type="button" />}
          onClick={() => {
            if (open && Date.now() - hoverOpenedAt.current < 500) {
              clearCloseTimer()
              return
            }
            toggle(!open)
          }}
          items="center"
          justify="center"
          gap="$1.5"
          height={28}
          px="$2"
          rounded="$3"
          borderWidth={1}
          borderColor={open ? STRONG : 'transparent'}
          bg={open ? '$hover' : 'transparent'}
          hoverStyle={{ bg: '$hover', borderColor: STRONG }}
          focusVisibleStyle={FOCUS_RING}
          transition="quickest"
          cursor="pointer"
          $max-sm={{ height: 44, minH: 44 }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-label={
            showPercent
              ? t('Usage: {percent}% used ({plan})', { percent: livePercent, plan: planBadge })
              : t('Plan usage ({plan})', { plan: planBadge })
          }
          data-slot="composer-usage"
        >
          {showPercent ? (
            <ProgressRing
              size="sm"
              value={livePercent}
              barColor={ringColor}
              aria-label={t('{percent}% used', { percent: livePercent })}
            />
          ) : (
            <Gauge size={15} color={ringColor} aria-hidden />
          )}
          {showPercent ? (
            <Text
              fontSize="$1"
              lineHeight={14}
              fontWeight="500"
              color={toneColor}
              fontVariant={['tabular-nums']}
              numberOfLines={1}
            >
              {livePercent}%
            </Text>
          ) : null}
        </XStack>
      </PopoverTrigger>
      <PopoverContent
        solid
        bg="var(--popover)"
        borderWidth={1}
        borderColor={STRONG}
        boxShadow="var(--shadow-floating)"
        rounded="$4"
        p="$3"
        width={260}
        maxW="calc(100vw - 24px)"
        z="var(--z-popover)"
        onMouseEnter={clearCloseTimer}
        onMouseLeave={handleMouseLeave}
        onKeyDown={(e: { key?: string; preventDefault?: () => void }) => {
          if (e.key === 'Escape') {
            e.preventDefault?.()
            setOpen(false)
          }
        }}
        aria-label={t('Usage breakdown')}
        data-slot="composer-usage-panel"
      >
        <YStack gap="$2.5" minW={0}>
          {/* Compact header: Plan badge + Prepaid balance on one line */}
          <XStack justify="space-between" items="center" gap="$2">
            <XStack items="center" gap="$1.5" minW={0}>
              <Text fontFamily="$body" fontSize="$2" fontWeight="600" color="$ink">
                {t('Usage')}
              </Text>
              <XStack
                px="$1.5"
                py={1}
                rounded="$10"
                bg="$panel"
                borderWidth={1}
                borderColor={STRONG}
                items="center"
                justify="center"
                shrink={0}
              >
                <Text fontFamily="$body" fontSize="$1" fontWeight="500" color="$ink" numberOfLines={1}>
                  {planBadge}
                </Text>
              </XStack>
            </XStack>
            {creditsLabel ? (
              <Anchor
                href={payPage('/amount/card', typeof window !== 'undefined' ? window.location.href : undefined)}
                data-slot="composer-buy-credits"
                fontFamily="$body"
                fontSize="$1"
                fontWeight="500"
                color="$ink"
                fontVariant={['tabular-nums']}
                hoverStyle={{ opacity: 0.75, textDecorationLine: 'none' }}
                focusVisibleStyle={FOCUS_RING}
                textDecorationLine="none"
              >
                {creditsLabel}
              </Anchor>
            ) : null}
          </XStack>

          {/* Session bar */}
          <YStack gap="$1" data-slot="composer-current-window">
            <XStack justify="space-between" items="baseline" gap="$2">
              <Text fontFamily="$body" fontSize="$1" color="$aside">
                {t('5-hour limit')}
              </Text>
              <Text fontFamily="$body" fontSize="$1" color="$ink" fontVariant={['tabular-nums']}>
                {Math.round(sessionPercent)}%
                {windowResetText ? ` · ${windowResetText.replace(/^Resets in\s+/i, '')}` : ''}
              </Text>
            </XStack>
            <Progress
              value={Math.min(100, sessionPercent)}
              height={3}
              indicatorColor={barColor(sessionPercent, sessionCapped)}
              aria-label={t('Session allowance usage')}
            />
          </YStack>

          {/* Weekly summary bar */}
          {weeklyPercent !== null ? (
            <YStack gap="$1" data-slot="composer-plan-usage">
              <XStack justify="space-between" items="baseline" gap="$2">
                <Text fontFamily="$body" fontSize="$1" color="$aside">
                  {t('Weekly limit')}
                </Text>
                <Text
                  fontFamily="$body"
                  fontSize="$1"
                  color={weeklyCapped ? 'var(--state-error)' : '$ink'}
                  fontVariant={['tabular-nums']}
                >
                  {summary.oursUnbounded
                    ? t('Unlimited')
                    : `${weeklyPercent}%${weeklyResetText ? ` · ${weeklyResetText.replace(/^Resets in\s+/i, '')}` : ''}`}
                </Text>
              </XStack>
              <Progress
                value={Math.min(100, weeklyPercent)}
                height={3}
                indicatorColor={barColor(weeklyPercent, weeklyCapped)}
                aria-label={t('Weekly allowance: {percent}% used', { percent: weeklyPercent })}
              />
            </YStack>
          ) : null}

          {/* 1×/week free usage reset button */}
          {canFreeReset ? (
            <XStack
              render={<button type="button" disabled={resetting} />}
              data-slot="composer-usage-free-reset"
              onClick={() => void handleFreeReset()}
              width="100%"
              minH={30}
              px="$2.5"
              py="$1"
              rounded="$3"
              bg="$panel"
              borderWidth={1}
              borderColor={STRONG}
              items="center"
              justify="center"
              gap="$1.5"
              cursor={resetting ? 'default' : 'pointer'}
              opacity={resetting ? 0.6 : 1}
              hoverStyle={resetting ? undefined : { bg: '$hover' }}
              focusVisibleStyle={FOCUS_RING}
              $max-sm={{ minH: 40 }}
            >
              <RotateCcw size={12} color="var(--foreground)" aria-hidden />
              <Text fontFamily="$body" fontSize="$1" fontWeight="500" color="$ink" numberOfLines={1}>
                {resetting ? t('Resetting…') : t('Reset usage (1×/wk free)')}
              </Text>
            </XStack>
          ) : null}

          {/* Credit-low safety net — shown ONLY at >=85% or 100% bounded Hanzo usage */}
          {showSafetyNet ? (
            <XStack
              data-slot="composer-credit-safety-net"
              role="status"
              bg="$panel"
              borderWidth={1}
              borderColor={STRONG}
              rounded="$3"
              px="$2"
              py="$1.5"
              items="center"
              justify="space-between"
              gap="$2"
            >
              <Text fontFamily="$body" fontSize="$1" color="$ink" numberOfLines={1} grow={1} shrink={1}>
                {t('Running low on allowance')}
              </Text>
              <Box
                render={<button type="button" />}
                data-slot="composer-safety-add-credits"
                onClick={() => {
                  setOpen(false)
                  window.location.assign(payPage('/amount/card', window.location.href))
                }}
                px="$2"
                py={2}
                rounded="$2"
                bg="$raised"
                borderWidth={1}
                borderColor={STRONG}
                cursor="pointer"
                hoverStyle={{ bg: '$hover' }}
                focusVisibleStyle={FOCUS_RING}
              >
                <Text fontFamily="$body" fontSize="$1" fontWeight="600" color="$ink">
                  {t('Top up')}
                </Text>
              </Box>
            </XStack>
          ) : null}

          {devMode && counted ? (
            <XStack justify="space-between" items="center">
              <Text fontFamily="$body" fontSize="$1" color="$hint">
                {t('Last turn')}
              </Text>
              <Text fontFamily="$mono" fontSize="$1" color="$aside" fontVariant={['tabular-nums']}>
                {integer(counted.total)} tok
              </Text>
            </XStack>
          ) : null}

          {/* Compact single-row footer */}
          <XStack justify="space-between" items="center" pt="$2" borderTopWidth={1} borderColor="$edge" gap="$2">
            <XStack
              render={<button type="button" />}
              data-slot="composer-upgrade"
              onClick={() => {
                setOpen(false)
                window.location.assign(payPage('/cart', window.location.href))
              }}
              items="center"
              justify="center"
              gap="$1.5"
              px="$2.5"
              py="$1"
              minH={28}
              $max-sm={{ minH: 40 }}
              rounded="$2"
              bg="var(--primary)"
              borderWidth={0}
              cursor="pointer"
              hoverStyle={{ opacity: 0.9 }}
              focusVisibleStyle={FOCUS_RING}
            >
              <Sparkles size={12} color="var(--primary-foreground)" aria-hidden />
              <Text fontFamily="$body" fontSize="$1" fontWeight="600" color="var(--primary-foreground)" numberOfLines={1}>
                {t('Upgrade')}
              </Text>
            </XStack>
            <XStack items="center" gap="$1">
              <XStack
                render={<button type="button" />}
                data-slot="composer-see-usage"
                onClick={() => openSettingsTab('usage')}
                items="center"
                justify="center"
                gap={4}
                px="$2"
                py="$1"
                minH={28}
                $max-sm={{ minH: 40 }}
                rounded="$2"
                bg="transparent"
                borderWidth={0}
                cursor="pointer"
                hoverStyle={{ bg: '$hover' }}
                focusVisibleStyle={FOCUS_RING}
              >
                <Text fontFamily="$body" fontSize="$1" fontWeight="500" color="$aside" numberOfLines={1}>
                  {t('Details')}
                </Text>
                <ArrowUpRight size={12} color="var(--text-secondary)" aria-hidden />
              </XStack>
            </XStack>
          </XStack>
        </YStack>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Compact circular `(!)` usage indicator anchored in the bottom-left rail directly
 * above the user avatar. Clicking or hovering opens a concise limits card showing
 * 5-hour limit, weekly limit, credits, 1×/week free reset (when available), Add credits CTA,
 * and Manage usage.
 */
export function RailUsageButton() {
  const { t, format } = useI18n()
  const [open, setOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverOpenedAt = useRef(0)

  const signedIn = hasSession()
  const currentOrg = org()
  const usage = useLimits(signedIn, currentOrg)
  const { limits } = usage
  const { tier } = useTier(signedIn && Boolean(currentOrg), currentOrg)

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [open])

  if (!signedIn) return null

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const handleMouseEnter = () => {
    clearCloseTimer()
    if (!open) {
      hoverOpenedAt.current = Date.now()
      setOpen(true)
      usage.reload()
    }
  }

  const handleMouseLeave = () => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_MS)
  }

  const summary = summarizeUsage(limits, tier?.balance?.effectiveAvailable, null)
  const sessionUsed = summary.sessionPercent ?? 0
  const weeklyUsed = summary.weeklyPercent ?? 0
  const sessionLeft = Math.max(0, 100 - sessionUsed)
  const weeklyLeft = Math.max(0, 100 - weeklyUsed)

  const { isCapped, isNear, canFreeReset } = summary
  const hasBalanceZero =
    !summary.oursUnbounded &&
    typeof tier?.balance?.effectiveAvailable === 'number' &&
    tier.balance.effectiveAvailable <= 0 &&
    !tier.plan &&
    !limits?.plan

  // Only surface the `(!)` warning indicator in the rail when bounded Hanzo usage is near (>=85%) or exceeded.
  if (!isCapped && !isNear && !hasBalanceZero) return null

  const resetParts = summary.resetIso ? resets(summary.resetIso, now, format) : null
  const resetSentence = resetParts
    ? resetParts.date && resetParts.time
      ? t('Your rate limit resets {date} at {time}.', { date: resetParts.date, time: resetParts.time })
      : resetParts.time
        ? t('Your rate limit resets on {time}.', { time: resetParts.time })
        : t('Your rate limit resets {date}.', { date: resetParts.date ?? '' })
    : null

  const planInfo = limits?.plan
    ? label(limits.plan)
    : tier?.plan
      ? label(tier.plan)
      : null
  const planBadge = planInfo
    ? `${planInfo.name}${planInfo.tag ? ` ${planInfo.tag}` : ''}`
    : tier?.tier?.displayName || t('Free')

  const hasCredits = typeof tier?.balance?.effectiveAvailable === 'number'
  const creditsLabel = hasCredits
    ? cents(tier!.balance.effectiveAvailable, tier!.balance.currency || 'usd')
    : t('0 credits')

  const headline = isCapped
    ? t('You’re out of Hanzo usage')
    : isNear
      ? t('Running low on Hanzo usage')
      : t('Hanzo usage · {plan}', { plan: planBadge })

  const subtitle = isCapped
    ? [resetSentence, t('Add credits or upgrade to keep working now.')].filter(Boolean).join(' ')
    : resetSentence || t('Limits are shared across Chat, Dev, and Design.')

  const ringBorder = isCapped
    ? 'var(--state-error)'
    : isNear
      ? 'var(--chrome-dot-yellow)'
      : STRONG
  const glyphColor = isCapped
    ? 'var(--state-error)'
    : isNear
      ? 'var(--chrome-dot-yellow)'
      : 'var(--foreground)'

  const toggle = (next: boolean) => {
    clearCloseTimer()
    setOpen(next)
    if (next) usage.reload()
  }

  const handleFreeReset = async () => {
    if (resetting) return
    setResetting(true)
    try {
      await resetUsageLimits()
      usage.reload()
      toast.success(t('Usage reset for this week'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not reset usage'))
    } finally {
      setResetting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={toggle} placement="right-end" offset={10} allowFlip stayInFrame>
      <PopoverTrigger asChild disablePressTrigger>
        <XStack
          render={<button type="button" />}
          data-slot="rail-usage"
          data-state={isCapped ? 'capped' : isNear ? 'near' : 'ok'}
          aria-label={headline}
          onClick={() => {
            if (open && Date.now() - hoverOpenedAt.current < 400) {
              clearCloseTimer()
              return
            }
            toggle(!open)
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          width={28}
          height={28}
          rounded={9999}
          items="center"
          justify="center"
          shrink={0}
          cursor="pointer"
          bg={open ? '$raised' : '$panel'}
          borderWidth={1.5}
          borderColor={ringBorder}
          opacity={isCapped || isNear || open ? 1 : 0.78}
          hoverStyle={{ bg: '$hover', opacity: 1 }}
          pressStyle={{ bg: '$raised' }}
          focusVisibleStyle={FOCUS_RING}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 4.2v4.3"
              stroke={glyphColor}
              strokeWidth="1.75"
              strokeLinecap="round"
            />
            <circle cx="8" cy="11.4" r="1" fill={glyphColor} />
          </svg>
        </XStack>
      </PopoverTrigger>
      <PopoverContent
        solid
        bg="var(--popover)"
        borderWidth={1}
        borderColor={STRONG}
        boxShadow="var(--shadow-floating)"
        rounded={14}
        p={16}
        width={264}
        maxW="calc(100vw - 24px)"
        z="var(--z-popover)"
        onMouseEnter={clearCloseTimer}
        onMouseLeave={handleMouseLeave}
        onKeyDown={(e: { key?: string; preventDefault?: () => void }) => {
          if (e.key === 'Escape') {
            e.preventDefault?.()
            setOpen(false)
          }
        }}
        aria-label={t('Usage summary')}
        data-slot="rail-usage-popover"
      >
        <YStack gap={12} minW={0}>
          <YStack gap={4}>
            <Text fontFamily="$body" fontSize={13.5} fontWeight="600" color="$ink" lineHeight={18}>
              {headline}
            </Text>
            <Text fontFamily="$body" fontSize={12} color="$aside" lineHeight={17}>
              {subtitle}
            </Text>
          </YStack>

          {canFreeReset ? (
            <XStack
              render={<button type="button" disabled={resetting} />}
              data-slot="rail-usage-free-reset"
              onClick={() => void handleFreeReset()}
              width="100%"
              height={34}
              rounded={9999}
              items="center"
              justify="center"
              gap={6}
              bg="$panel"
              borderWidth={1}
              borderColor={STRONG}
              cursor={resetting ? 'default' : 'pointer'}
              opacity={resetting ? 0.6 : 1}
              hoverStyle={resetting ? undefined : { bg: '$hover' }}
              focusVisibleStyle={FOCUS_RING}
            >
              <RotateCcw size={13} color="var(--foreground)" aria-hidden />
              <Text fontFamily="$body" fontSize={12.5} fontWeight="600" color="$ink">
                {resetting ? t('Resetting…') : t('Reset usage (1×/wk free)')}
              </Text>
            </XStack>
          ) : null}

          <XStack
            render={<a href={payPage('/amount/card', typeof window !== 'undefined' ? window.location.href : undefined)} />}
            data-slot="rail-usage-add-credits"
            onClick={(e: { preventDefault?: () => void }) => {
              e.preventDefault?.()
              setOpen(false)
              window.location.assign(payPage('/amount/card', window.location.href))
            }}
            width="100%"
            height={34}
            rounded={9999}
            items="center"
            justify="center"
            bg="var(--primary)"
            borderWidth={0}
            cursor="pointer"
            hoverStyle={{ opacity: 0.9 }}
            pressStyle={{ opacity: 0.82 }}
            focusVisibleStyle={FOCUS_RING}
            $platform-web={{ textDecoration: 'none' }}
          >
            <Text fontFamily="$body" fontSize={12.5} fontWeight="600" color="var(--primary-foreground)">
              {t('Add credits')}
            </Text>
          </XStack>

          <YStack gap={8} pt={2}>
            <XStack justify="space-between" items="center" gap={8}>
              <Text fontFamily="$body" fontSize={12.5} color="$ink">
                {t('5-hour limit')}
              </Text>
              <Text
                fontFamily="$body"
                fontSize={12.5}
                color={sessionLeft === 0 ? 'var(--state-error)' : '$aside'}
                fontVariant={['tabular-nums']}
              >
                {t('{percent}% left', { percent: sessionLeft })}
              </Text>
            </XStack>
            <XStack justify="space-between" items="center" gap={8}>
              <Text fontFamily="$body" fontSize={12.5} color="$ink">
                {t('Weekly limit')}
              </Text>
              <Text
                fontFamily="$body"
                fontSize={12.5}
                color={weeklyLeft === 0 ? 'var(--state-error)' : '$aside'}
                fontVariant={['tabular-nums']}
              >
                {t('{percent}% left', { percent: weeklyLeft })}
              </Text>
            </XStack>
            <XStack justify="space-between" items="center" gap={8}>
              <Text fontFamily="$body" fontSize={12.5} color="$ink">
                {t('Credits')}
              </Text>
              <Anchor
                href={payPage('/amount/card', typeof window !== 'undefined' ? window.location.href : undefined)}
                data-slot="rail-usage-credits-link"
                onClick={(e: { preventDefault?: () => void }) => {
                  e.preventDefault?.()
                  setOpen(false)
                  window.location.assign(payPage('/amount/card', window.location.href))
                }}
                fontFamily="$body"
                fontSize={12.5}
                color="$ink"
                fontVariant={['tabular-nums']}
                textDecorationLine="underline"
                hoverStyle={{ opacity: 0.78 }}
              >
                {creditsLabel}
              </Anchor>
            </XStack>
          </YStack>

          <XStack
            width="100%"
            pt={10}
            borderTopWidth={1}
            borderColor="$edge"
            items="center"
            justify="space-between"
            gap={8}
          >
            <XStack
              render={<button type="button" />}
              data-slot="rail-usage-manage"
              onClick={() => {
                setOpen(false)
                rememberSettingsReturn()
                showSettings('usage')
              }}
              items="center"
              justify="flex-start"
              bg="transparent"
              borderWidth={0}
              cursor="pointer"
              hoverStyle={{ opacity: 0.8 }}
              focusVisibleStyle={FOCUS_RING}
            >
              <Text fontFamily="$body" fontSize={12.5} fontWeight="500" color="$ink">
                {t('Manage usage')}
              </Text>
            </XStack>
            <Anchor
              href={payPage('/amount/card', typeof window !== 'undefined' ? window.location.href : undefined)}
              data-slot="rail-usage-topup-link"
              onClick={(e: { preventDefault?: () => void }) => {
                e.preventDefault?.()
                setOpen(false)
                window.location.assign(payPage('/amount/card', window.location.href))
              }}
              fontFamily="$body"
              fontSize={12}
              fontWeight="500"
              color="$aside"
              hoverStyle={{ color: '$ink' }}
              textDecorationLine="none"
            >
              {t('Top up →')}
            </Anchor>
          </XStack>
        </YStack>
      </PopoverContent>
    </Popover>
  )
}

/** Every shared composer in the app gets the same account usage entry. */
export function UsageProvider({ children }: { children: React.ReactNode }) {
  return <ComposerStatusProvider value={<UsageControl key={org()} />}>{children}</ComposerStatusProvider>
}
