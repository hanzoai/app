'use client'

// Global 1-click upgrade modal for Hanzo Personal (Free, Pro, Max + optional Go/Dev/Ultra)
// and Business workspaces. Preserves current org() and returnUrl across every route.

import { useEffect, useId, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import {
  BarChart2,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Crown,
  Gem,
  Layers,
  Link2,
  Lock,
  Rocket,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sprout,
  Users,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Anchor, Box, Button, Dialog, DialogContent, DialogTitle, Text, View, XStack, YStack } from '@hanzo/ui'
import { track } from './lib/tags'
import { org } from './lib/session'
import { useTier } from './lib/tier'
import { term, usePlan, type Interval } from './lib/plans'
import { owners } from './lib/owners'
import { money, payUrl, topUpAmountUrl } from './lib/pay'
import { site } from './where'

const INK = 'var(--foreground)'
const SOFT = 'var(--text-secondary, var(--muted-foreground))'
const STRONG = 'var(--border-strong)' as const
const FOCUS_RING = { outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' } as const

/** What the reader reached for: a model by its name, and the checkout a refusal named. */
export interface Ask {
  model?: string
  href?: string
}

export interface UpgradeEventDetail {
  tier?: string
}

const UPGRADE_EVENT = 'hanzo:upgrade'

/** Opens the global in-app Upgrade modal from anywhere in the signed-in shell. */
export function requestUpgrade(detail?: UpgradeEventDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(UPGRADE_EVENT, { detail }))
}

/** The free rung's name in the billing catalog. */
const FREE = 'free'

/** Whether a signed-in reader's organization is on the Free plan. A tier not yet read, or refused, is not Free. */
export function useFree(signedIn: boolean): boolean {
  const { tier } = useTier(signedIn, org())
  return signedIn && tier?.tier?.name === FREE
}

/** The page checkout returns to: this one, query and all. */
function here(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return window.location.href
}

/**
 * Deduplicate window-level `hanzo:upgrade` and `#pricing` triggers when both the
 * global shell (`App.tsx` / `Shell.tsx`) and a child pane (`Chat.tsx`) mount `<Upgrade />`.
 */
const upgradeOwners = owners()

type Audience = 'personal' | 'business'
type Intent = 'chat' | 'build' | 'team'

interface ExtraPlan {
  id: string
  name: string
  badge: string
  capacity: string
  price: number
  icon: LucideIcon
  subtitle: string
  features: string[]
}

export function Upgrade({ ask = null, onClose }: { ask?: Ask | null; onClose?: () => void } = {}) {
  const { t } = useI18n()
  const instanceId = useId()
  const [audience, setAudience] = useState<Audience>('personal')
  const [intent, setIntent] = useState<Intent>('chat')
  const [showMorePlans, setShowMorePlans] = useState(false)
  const [businessCycle, setBusinessCycle] = useState<Interval>('year')
  const [eventOpen, setEventOpen] = useState(false)

  useEffect(() => upgradeOwners.claim(instanceId), [instanceId])

  useEffect(() => {
    const isPrimaryOwner = () => upgradeOwners.owns(instanceId)

    const handleHash = () => {
      if (typeof window !== 'undefined' && window.location.hash === '#pricing' && isPrimaryOwner()) {
        setEventOpen(true)
      }
    }

    const handleUpgradeEvent = (ev: Event) => {
      if (!isPrimaryOwner()) return
      const tier = (ev as CustomEvent<UpgradeEventDetail | undefined>).detail?.tier?.toLowerCase()
      if (tier === 'business' || tier === 'team') {
        setAudience('business')
        setIntent('team')
      } else if (tier === 'dev' || tier === 'dev-5x') {
        setAudience('personal')
        setIntent('build')
        setShowMorePlans(true)
      } else if (tier === 'go' || tier === 'ultra') {
        setAudience('personal')
        setIntent('chat')
        setShowMorePlans(true)
      } else if (tier) {
        setAudience('personal')
        setIntent('chat')
      }
      setEventOpen(true)
    }

    handleHash()
    window.addEventListener('hashchange', handleHash)
    window.addEventListener(UPGRADE_EVENT, handleUpgradeEvent)
    return () => {
      window.removeEventListener('hashchange', handleHash)
      window.removeEventListener(UPGRADE_EVENT, handleUpgradeEvent)
    }
  }, [instanceId])

  const open = ask !== null || eventOpen
  const activeOrg = org()
  const { tier } = useTier(open, activeOrg)

  // Business seats are priced by the catalog, not by this file: the row is
  // the first charging plan in the `team` category (lib/plans `usePlan`), the
  // same row /pricing and the workspace gate read. A year is the row's
  // `priceAnnual` — what each month costs when a year is bought — and the cart
  // holds the 5-seat minimum, so its value is five seats' worth.
  const { plan: teamPlan } = usePlan('team')
  const teamSeat = businessCycle === 'year' ? (teamPlan?.priceAnnual ?? teamPlan?.priceMonthly ?? null) : (teamPlan?.priceMonthly ?? null)
  const teamValue =
    teamPlan == null || teamSeat == null
      ? 0
      : businessCycle === 'year'
        ? 5 * (teamPlan.annualTotal ?? teamSeat * 12)
        : 5 * teamSeat

  useEffect(() => {
    if (open) {
      track('upgrade_dialog_opened', { audience })
    }
  }, [open, audience])

  if (!open) return null

  const rawPlan = (tier?.tier?.name || '').toLowerCase()
  const currentPlanId = rawPlan.includes('ultra')
    ? 'ultra'
    : rawPlan.includes('max')
      ? 'max-15x'
      : rawPlan.includes('dev')
        ? 'dev-5x'
        : rawPlan.includes('pro')
          ? 'pro-3x'
          : rawPlan.includes('go')
            ? 'go'
            : rawPlan.includes('team') || rawPlan.includes('business')
              ? 'team'
              : 'free'

  const close = () => {
    if (typeof window !== 'undefined' && window.location.hash === '#pricing') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    setEventOpen(false)
    onClose?.()
  }

  const selectIntent = (next: Intent) => {
    setIntent(next)
    if (next === 'team') {
      setAudience('business')
      return
    }
    setAudience('personal')
    setShowMorePlans(next === 'build')
  }

  const returnUrl = here()

  const proHref = ask?.href || term(payUrl('/cart', { plan: 'pro-3x', org: activeOrg, returnUrl }), 'month')
  const maxHref = term(payUrl('/cart', { plan: 'max-15x', org: activeOrg, returnUrl }), 'month')
  const goHref = term(payUrl('/cart', { plan: 'go', org: activeOrg, returnUrl }), 'month')
  const devHref = term(payUrl('/cart', { plan: 'dev-5x', org: activeOrg, returnUrl }), 'month')
  const ultraHref = term(payUrl('/cart', { plan: 'ultra', org: activeOrg, returnUrl }), 'month')
  const businessHref = term(payUrl('/cart', { plan: 'team', quantity: '5', org: activeOrg, returnUrl }), businessCycle)
  const topUpHref = payUrl('/amount/card', { org: activeOrg, returnUrl })
  const topUpChips = ['10', '25', '50'] as const

  // The CTA sends its own moments, and the link says so (`data-ga`): the
  // site's click-out handler (app/providers.tsx `INTENT`) fires
  // `checkout_started` for any bare link to pay, so without the mark one press
  // counted `begin_checkout` twice — once here, once there.
  const handleBuy = (planId: string, planName: string, price: number, interval: Interval = 'month') => {
    const items = [{ item_id: planId, item_name: planName }]
    track('plan_clicked', { plan: planId, interval, cta: `Upgrade to ${planName}`, items })
    // No price, no checkout: the Business value is the catalog row's, and if
    // the row has not resolved there is nothing priced to check out with — a
    // $0 `begin_checkout` would be a lie in the funnel.
    if (price > 0) track('checkout_started', { currency: 'USD', value: price, items, interval })
  }

  // Strictly one white primary CTA per visible plan group — promote Max if the user is already on Pro.
  const devPrimary = audience === 'personal' && intent === 'build' && showMorePlans && currentPlanId !== 'dev-5x'
  const proPrimary = !devPrimary && currentPlanId !== 'pro-3x' && currentPlanId !== 'max-15x' && currentPlanId !== 'ultra'
  const maxPrimary = !devPrimary && !proPrimary && currentPlanId !== 'max-15x' && currentPlanId !== 'ultra'

  const intentHint =
    intent === 'build'
      ? t('Dev — 5x coding & agent runs · 2 custom Bots')
      : intent === 'team'
        ? t('Business — Shared team billing, roles & seats')
        : t('Pro — ~300 frontier chats/day · best everyday choice')

  const extraPlans: (ExtraPlan & { href: string })[] = [
    {
      id: 'go',
      name: t('Go'),
      badge: '1x',
      capacity: t('~100 frontier chats/day'),
      price: 8,
      icon: Zap,
      subtitle: t('Frontier models and builder access on a light monthly budget.'),
      features: [t('All frontier models'), t('Build apps and sites'), t('Scheduled automations')],
      href: goHref,
    },
    {
      id: 'dev-5x',
      name: t('Dev'),
      badge: '5x',
      capacity: t('5x coding & agent runs · 2 custom Bots'),
      price: 45,
      icon: Cpu,
      subtitle: t('Sustained coding, repositories, and multi-step agent runs.'),
      features: [t('5x session and weekly limits'), t('2 custom Hanzo Bots'), t('Custom tools and extensions')],
      href: devHref,
    },
    {
      id: 'ultra',
      name: t('Ultra'),
      badge: '25x',
      capacity: t('~2,500+ runs/day for continuous work'),
      price: 195,
      icon: Gem,
      subtitle: t('25x capacity for continuous production workloads.'),
      features: [t('25x session and weekly limits'), t('10 custom Hanzo Bots'), t('Direct engineering support')],
      href: ultraHref,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? undefined : close())}>
      <DialogContent
        data-slot="upgrade-modal"
        showCloseButton={false}
        width={audience === 'business' ? 860 : 980}
        maxW="calc(100vw - 24px)"
        maxH="90dvh"
        overflowY="auto"
        bg="$background"
        rounded="$6"
        p="$4"
        gap="$4"
        borderWidth={1}
        borderColor={STRONG}
        boxShadow="var(--shadow-floating)"
        $sm={{ p: '$6', gap: '$5' }}
        $max-sm={{ rounded: '$5' }}
      >
        {/* Close button */}
        <Box
          render={<button type="button" />}
          aria-label={t('Close')}
          onClick={close}
          display="flex"
          position="absolute"
          t="$3.5"
          insetInlineEnd="$3.5"
          width={36}
          height={36}
          $touchable={{ width: 44, height: 44 }}
          $max-sm={{ width: 44, height: 44, t: '$2.5', insetInlineEnd: '$2.5' }}
          rounded="$10"
          bg="transparent"
          borderWidth={1}
          borderColor="transparent"
          cursor="pointer"
          items="center"
          justify="center"
          hoverStyle={{ bg: '$hover', borderColor: STRONG }}
          focusVisibleStyle={FOCUS_RING}
          z="var(--z-raised)"
        >
          <X size={18} aria-hidden color={SOFT} />
        </Box>

        {/* Title & Personal / Business toggle */}
        <YStack items="center" gap="$1.5" pt="$1" px="$6" $max-sm={{ px: '$2', pt: '$4' }}>
          <DialogTitle fontFamily="$heading" fontSize="$7" fontWeight="600" letterSpacing={'-0.025em' as never} color="$ink" text="center">
            {t('Choose your plan')}
          </DialogTitle>
          <Text fontFamily="$body" fontSize="$2" color="$soft" text="center">
            {ask?.model
              ? t('Unlock {model} and higher usage limits.', { model: ask.model })
              : t('Monthly plans with clear usage limits. Cancel or switch anytime.')}
          </Text>

          <XStack
            items="center"
            bg="$panel"
            p="$1"
            rounded="$10"
            gap="$1"
            mt="$2"
            borderWidth={1}
            borderColor={STRONG}
          >
            <Box
              render={<button type="button" />}
              onClick={() => {
                setAudience('personal')
                if (intent === 'team') setIntent('chat')
              }}
              display="flex"
              bg={audience === 'personal' ? '$raised' : 'transparent'}
              borderWidth={1}
              borderColor={audience === 'personal' ? STRONG : 'transparent'}
              minH={34}
              $touchable={{ minH: 44 }}
              $max-sm={{ minH: 44 }}
              px="$3.5"
              py="$1.5"
              rounded="$10"
              cursor="pointer"
              items="center"
              justify="center"
              hoverStyle={audience === 'personal' ? {} : { bg: '$hover' }}
              focusVisibleStyle={FOCUS_RING}
            >
              <Text
                fontFamily="$body"
                fontSize="$2"
                fontWeight={audience === 'personal' ? '600' : '400'}
                color={audience === 'personal' ? '$ink' : '$soft'}
              >
                {t('Personal')}
              </Text>
            </Box>
            <Box
              render={<button type="button" />}
              onClick={() => {
                setAudience('business')
                setIntent('team')
              }}
              display="flex"
              bg={audience === 'business' ? '$raised' : 'transparent'}
              borderWidth={1}
              borderColor={audience === 'business' ? STRONG : 'transparent'}
              minH={34}
              $touchable={{ minH: 44 }}
              $max-sm={{ minH: 44 }}
              px="$3.5"
              py="$1.5"
              rounded="$10"
              cursor="pointer"
              items="center"
              justify="center"
              hoverStyle={audience === 'business' ? {} : { bg: '$hover' }}
              focusVisibleStyle={FOCUS_RING}
            >
              <Text
                fontFamily="$body"
                fontSize="$2"
                fontWeight={audience === 'business' ? '600' : '400'}
                color={audience === 'business' ? '$ink' : '$soft'}
              >
                {t('Business')}
              </Text>
            </Box>
          </XStack>

          {/* Calm 3-pill intent recommender */}
          <YStack items="center" gap="$1.5" pt="$1.5" width="100%">
            <XStack
              data-slot="upgrade-intent-picker"
              role="radiogroup"
              aria-label={t('Help me pick a plan')}
              items="center"
              justify="center"
              gap="$1.5"
              flexWrap="wrap"
            >
              {(
                [
                  { id: 'chat', label: t('Chatting') },
                  { id: 'build', label: t('Building') },
                  { id: 'team', label: t('Team') },
                ] as const
              ).map((opt) => {
                const active = intent === opt.id
                return (
                  <Box
                    key={opt.id}
                    render={<button type="button" />}
                    data-slot={`upgrade-intent-${opt.id}`}
                    role="radio"
                    aria-checked={active}
                    onClick={() => selectIntent(opt.id)}
                    display="inline-flex"
                    items="center"
                    justify="center"
                    minH={32}
                    $touchable={{ minH: 44 }}
                    $max-sm={{ minH: 44 }}
                    px="$3"
                    py="$1"
                    rounded="$10"
                    bg={active ? '$raised' : 'transparent'}
                    borderWidth={1}
                    borderColor={active ? STRONG : '$edge'}
                    cursor="pointer"
                    hoverStyle={{ bg: '$hover', borderColor: STRONG }}
                    focusVisibleStyle={FOCUS_RING}
                  >
                    <Text
                      fontFamily="$body"
                      fontSize="$1"
                      fontWeight={active ? '600' : '500'}
                      color={active ? '$ink' : '$soft'}
                    >
                      {opt.label}
                    </Text>
                  </Box>
                )
              })}
            </XStack>
            <Text data-slot="upgrade-intent-hint" fontFamily="$body" fontSize="$1" color="$soft" text="center">
              {intentHint}
            </Text>
          </YStack>
        </YStack>

        {audience === 'personal' ? (
          <YStack gap="$4" width="100%">
            {/* Clean 3-plan comparison: Free, Pro, Max */}
            <View
              display="grid"
              gridTemplateColumns="repeat(auto-fit, minmax(min(100%, 260px), 1fr))"
              gap={16}
              width="100%"
              items="stretch"
            >
              {/* 1. Free */}
              <YStack
                data-slot="plan-free"
                bg="var(--surface-card)"
                borderWidth={1}
                borderColor="$edge"
                rounded="$5"
                p="$5"
                gap="$4"
                justify="space-between"
              >
                <YStack gap="$3.5">
                  <XStack items="center" justify="space-between" gap="$2">
                    <XStack items="center" gap="$2">
                      <Sprout size={16} color={SOFT} aria-hidden />
                      <Text fontFamily="$heading" fontSize="$5" fontWeight="600" color="$ink">
                        {t('Free')}
                      </Text>
                    </XStack>
                  </XStack>

                  <XStack items="baseline" gap="$1.5">
                    <Text
                      fontFamily="$heading"
                      fontSize="$8"
                      fontWeight="700"
                      letterSpacing={'-0.025em' as never}
                      color="$ink"
                      fontVariant={['tabular-nums']}
                    >
                      $0
                    </Text>
                    <Text fontFamily="$body" fontSize="$2" color="$soft">
                      {t('/ month')}
                    </Text>
                  </XStack>

                  <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$ink">
                    {t('Explore chat, design, and build for everyday tasks.')}
                  </Text>

                  <Button
                    disabled
                    variant="outline"
                    rounded="$10"
                    width="100%"
                    minH={40}
                    $touchable={{ minH: 44 }}
                    $max-sm={{ minH: 44 }}
                    py="$2"
                    borderColor="$edge"
                    bg="transparent"
                    cursor="default"
                  >
                    <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$soft">
                      {currentPlanId === 'free' ? t('Current plan') : t('Included')}
                    </Text>
                  </Button>

                  <YStack gap="$2.5" pt="$1">
                    {[
                      t('Everyday chats and writing'),
                      t('Standard AI models'),
                      t('Saved chat history and memory'),
                      t('Starter design and build sessions'),
                    ].map((feat) => (
                      <XStack key={feat} items="flex-start" gap="$2">
                        <XStack pt={2} shrink={0}>
                          <Check size={14} color={SOFT} aria-hidden />
                        </XStack>
                        <Text fontFamily="$body" fontSize="$2" color="$soft" flex={1} minW={0}>
                          {feat}
                        </Text>
                      </XStack>
                    ))}
                  </YStack>
                </YStack>
              </YStack>

              {/* 2. Pro */}
              <YStack
                data-slot="plan-pro"
                bg={proPrimary ? 'var(--surface-card-emphasis)' : 'var(--surface-card)'}
                borderWidth={proPrimary ? 2 : 1}
                borderColor={proPrimary ? '$ink' : '$edge'}
                rounded="$5"
                p="$5"
                gap="$4"
                justify="space-between"
                boxShadow={proPrimary ? 'var(--shadow-lg)' : 'var(--shadow-none)'}
              >
                <YStack gap="$3.5">
                  <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
                    <XStack items="center" gap="$2">
                      <Rocket size={16} color={INK} aria-hidden />
                      <Text fontFamily="$heading" fontSize="$5" fontWeight="600" color="$ink">
                        {t('Pro')}
                      </Text>
                    </XStack>
                    <XStack items="center" gap="$1.5">
                      <XStack px="$2" py="$0.5" rounded="$10" bg="$panel" borderWidth={1} borderColor="$edge">
                        <Text fontFamily="$body" fontSize="$1" fontWeight="600" color="$soft">
                          3x
                        </Text>
                      </XStack>
                      {currentPlanId === 'pro-3x' ? (
                        <XStack px="$2.5" py="$0.5" rounded="$10" bg="$panel" borderWidth={1} borderColor="$edge">
                          <Text fontFamily="$body" fontSize="$1" fontWeight="600" color="$ink">
                            {t('Current')}
                          </Text>
                        </XStack>
                      ) : proPrimary ? (
                        <XStack px="$2.5" py="$0.5" rounded="$10" bg="$ink">
                          <Text fontFamily="$body" fontSize="$1" fontWeight="600" color="$background">
                            {t('Recommended')}
                          </Text>
                        </XStack>
                      ) : null}
                    </XStack>
                  </XStack>

                  <XStack items="baseline" gap="$1.5">
                    <Text
                      fontFamily="$heading"
                      fontSize="$8"
                      fontWeight="700"
                      letterSpacing={'-0.025em' as never}
                      color="$ink"
                      fontVariant={['tabular-nums']}
                    >
                      $15
                    </Text>
                    <Text fontFamily="$body" fontSize="$2" color="$soft">
                      {t('/ month')}
                    </Text>
                  </XStack>

                  <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$ink">
                    {t('~300 frontier chats/day · best everyday choice.')}
                  </Text>

                  {currentPlanId === 'pro-3x' ? (
                    <Button
                      disabled
                      variant="outline"
                      rounded="$10"
                      width="100%"
                      minH={40}
                      $touchable={{ minH: 44 }}
                      $max-sm={{ minH: 44 }}
                      py="$2"
                      borderColor="$edge"
                      bg="transparent"
                      cursor="default"
                    >
                      <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$soft">
                        {t('Current plan')}
                      </Text>
                    </Button>
                  ) : (
                    <Anchor
                      data-slot="upgrade-pro-cta"
                      data-ga
                      href={proHref}
                      onPress={() => handleBuy('pro-3x', 'Pro', 15)}
                      display="flex"
                      bg={proPrimary ? 'var(--primary)' : '$panel'}
                      hoverStyle={{ bg: proPrimary ? 'var(--primary-hover)' : '$hover' }}
                      focusVisibleStyle={FOCUS_RING}
                      borderWidth={proPrimary ? 0 : 1}
                      borderColor={proPrimary ? 'transparent' : STRONG}
                      rounded="$10"
                      width="100%"
                      minH={40}
                      $touchable={{ minH: 44 }}
                      $max-sm={{ minH: 44 }}
                      py="$2"
                      px="$4"
                      color={proPrimary ? 'var(--primary-foreground)' : '$ink'}
                      fontFamily="$body"
                      fontWeight="600"
                      fontSize="$2"
                      text="center"
                      textDecorationLine="none"
                      items="center"
                      justify="center"
                      gap="$1.5"
                    >
                      {proPrimary ? <Sparkles size={15} color="var(--primary-foreground)" aria-hidden /> : null}
                      {t('Upgrade to Pro')}
                    </Anchor>
                  )}

                  <YStack gap="$2.5" pt="$1">
                    {[
                      t('Everything in Free'),
                      t('3x session and weekly limits (~300 chats/day)'),
                      t('Enso Ultra and frontier reasoning models'),
                      t('Build apps, sites, and automations'),
                      t('1 custom Hanzo Bot and priority support'),
                    ].map((feat, idx) => (
                      <XStack key={feat} items="flex-start" gap="$2">
                        <XStack pt={2} shrink={0}>
                          <Check size={14} color={idx === 0 ? INK : SOFT} aria-hidden />
                        </XStack>
                        <Text
                          fontFamily="$body"
                          fontSize="$2"
                          color={idx === 0 ? '$ink' : '$soft'}
                          fontWeight={idx === 0 ? '500' : '400'}
                          flex={1}
                          minW={0}
                        >
                          {feat}
                        </Text>
                      </XStack>
                    ))}
                  </YStack>
                </YStack>
              </YStack>

              {/* 3. Max */}
              <YStack
                data-slot="plan-max"
                bg={maxPrimary ? 'var(--surface-card-emphasis)' : 'var(--surface-card)'}
                borderWidth={maxPrimary ? 2 : 1}
                borderColor={maxPrimary ? '$ink' : '$edge'}
                rounded="$5"
                p="$5"
                gap="$4"
                justify="space-between"
                boxShadow={maxPrimary ? 'var(--shadow-lg)' : 'var(--shadow-none)'}
              >
                <YStack gap="$3.5">
                  <XStack items="center" justify="space-between" gap="$2">
                    <XStack items="center" gap="$2">
                      <Crown size={16} color={maxPrimary ? INK : SOFT} aria-hidden />
                      <Text fontFamily="$heading" fontSize="$5" fontWeight="600" color="$ink">
                        {t('Max')}
                      </Text>
                    </XStack>
                    <XStack items="center" gap="$1.5">
                      <XStack px="$2" py="$0.5" rounded="$10" bg="$panel" borderWidth={1} borderColor="$edge">
                        <Text fontFamily="$body" fontSize="$1" fontWeight="600" color="$soft">
                          15x
                        </Text>
                      </XStack>
                      {maxPrimary ? (
                        <XStack px="$2.5" py="$0.5" rounded="$10" bg="$ink">
                          <Text fontFamily="$body" fontSize="$1" fontWeight="600" color="$background">
                            {t('Recommended')}
                          </Text>
                        </XStack>
                      ) : null}
                    </XStack>
                  </XStack>

                  <XStack items="baseline" gap="$1.5">
                    <Text
                      fontFamily="$heading"
                      fontSize="$8"
                      fontWeight="700"
                      letterSpacing={'-0.025em' as never}
                      color="$ink"
                      fontVariant={['tabular-nums']}
                    >
                      $95
                    </Text>
                    <Text fontFamily="$body" fontSize="$2" color="$soft">
                      {t('/ month')}
                    </Text>
                  </XStack>

                  <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$ink">
                    {t('~1,500 chats/day for sustained building and parallel agents.')}
                  </Text>

                  {currentPlanId === 'max-15x' ? (
                    <Button
                      disabled
                      variant="outline"
                      rounded="$10"
                      width="100%"
                      minH={40}
                      $touchable={{ minH: 44 }}
                      $max-sm={{ minH: 44 }}
                      py="$2"
                      borderColor="$edge"
                      bg="transparent"
                      cursor="default"
                    >
                      <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$soft">
                        {t('Current plan')}
                      </Text>
                    </Button>
                  ) : (
                    <Anchor
                      data-slot="upgrade-max-cta"
                      data-ga
                      href={maxHref}
                      onPress={() => handleBuy('max-15x', 'Max', 95)}
                      display="flex"
                      bg={maxPrimary ? 'var(--primary)' : '$panel'}
                      hoverStyle={{ bg: maxPrimary ? 'var(--primary-hover)' : '$hover' }}
                      focusVisibleStyle={FOCUS_RING}
                      borderWidth={maxPrimary ? 0 : 1}
                      borderColor={maxPrimary ? 'transparent' : STRONG}
                      rounded="$10"
                      width="100%"
                      minH={40}
                      $touchable={{ minH: 44 }}
                      $max-sm={{ minH: 44 }}
                      py="$2"
                      px="$4"
                      color={maxPrimary ? 'var(--primary-foreground)' : '$ink'}
                      fontFamily="$body"
                      fontWeight="600"
                      fontSize="$2"
                      text="center"
                      textDecorationLine="none"
                      items="center"
                      justify="center"
                      gap="$1.5"
                    >
                      {maxPrimary ? <Sparkles size={15} color="var(--primary-foreground)" aria-hidden /> : null}
                      {t('Upgrade to Max')}
                    </Anchor>
                  )}

                  <YStack gap="$2.5" pt="$1">
                    {[
                      t('Everything in Pro'),
                      t('15x usage limits (~1,500 chats/day)'),
                      t('Parallel cloud workspaces and runs'),
                      t('5 custom Hanzo Bots'),
                      t('Dedicated priority support'),
                    ].map((feat, idx) => (
                      <XStack key={feat} items="flex-start" gap="$2">
                        <XStack pt={2} shrink={0}>
                          <Check size={14} color={idx === 0 ? INK : SOFT} aria-hidden />
                        </XStack>
                        <Text
                          fontFamily="$body"
                          fontSize="$2"
                          color={idx === 0 ? '$ink' : '$soft'}
                          fontWeight={idx === 0 ? '500' : '400'}
                          flex={1}
                          minW={0}
                        >
                          {feat}
                        </Text>
                      </XStack>
                    ))}
                  </YStack>
                </YStack>
              </YStack>
            </View>

            {/* Optional progressive disclosure for intermediate tiers (Go, Dev, Ultra) */}
            <YStack gap="$3" items="center">
              <Box
                render={<button type="button" />}
                data-slot="upgrade-more-plans"
                onClick={() => setShowMorePlans((v) => !v)}
                display="flex"
                bg="transparent"
                hoverStyle={{ bg: '$hover' }}
                focusVisibleStyle={FOCUS_RING}
                minH={36}
                $touchable={{ minH: 44 }}
                $max-sm={{ minH: 44 }}
                px="$3.5"
                py="$1.5"
                rounded="$10"
                borderWidth={1}
                borderColor={STRONG}
                cursor="pointer"
                items="center"
                justify="center"
              >
                <XStack items="center" gap="$1.5">
                  <Text fontFamily="$body" fontSize="$1" fontWeight="500" color="$soft">
                    {showMorePlans ? t('Hide extra plans') : t('See more plans (Go $8, Dev $45, Ultra $195)')}
                  </Text>
                  {showMorePlans ? (
                    <ChevronUp size={13} color={SOFT} aria-hidden />
                  ) : (
                    <ChevronDown size={13} color={SOFT} aria-hidden />
                  )}
                </XStack>
              </Box>

              {showMorePlans ? (
                <View
                  display="grid"
                  gridTemplateColumns="repeat(auto-fit, minmax(min(100%, 240px), 1fr))"
                  gap={16}
                  width="100%"
                  items="stretch"
                >
                  {extraPlans.map((p) => {
                    const Icon = p.icon
                    const highlighted = devPrimary && p.id === 'dev-5x'
                    return (
                      <YStack
                        key={p.id}
                        data-slot={`plan-${p.id}`}
                        bg={highlighted ? 'var(--surface-card-emphasis)' : 'var(--surface-card)'}
                        borderWidth={highlighted ? 2 : 1}
                        borderColor={highlighted ? '$ink' : '$edge'}
                        rounded="$5"
                        p="$5"
                        gap="$3.5"
                        justify="space-between"
                        boxShadow={highlighted ? 'var(--shadow-lg)' : 'var(--shadow-none)'}
                      >
                        <YStack gap="$2.5">
                          <XStack items="center" justify="space-between" gap="$1.5" flexWrap="wrap">
                            <XStack items="center" gap="$1.5">
                              <Icon size={15} color={highlighted ? INK : SOFT} aria-hidden />
                              <Text fontFamily="$heading" fontSize="$5" fontWeight="600" color="$ink">
                                {p.name}
                              </Text>
                            </XStack>
                            <XStack items="center" gap="$1">
                              <XStack px="$2" py="$0.5" rounded="$10" bg="$panel" borderWidth={1} borderColor="$edge">
                                <Text fontFamily="$body" fontSize="$1" fontWeight="600" color="$soft">
                                  {p.badge}
                                </Text>
                              </XStack>
                              {highlighted ? (
                                <XStack px="$2.5" py="$0.5" rounded="$10" bg="$ink">
                                  <Text fontFamily="$body" fontSize="$1" fontWeight="600" color="$background">
                                    {t('Best fit')}
                                  </Text>
                                </XStack>
                              ) : null}
                            </XStack>
                          </XStack>
                          <XStack items="baseline" gap="$1.5">
                            <Text
                              fontFamily="$heading"
                              fontSize="$8"
                              fontWeight="700"
                              letterSpacing={'-0.025em' as never}
                              color="$ink"
                              fontVariant={['tabular-nums']}
                            >
                              ${p.price}
                            </Text>
                            <Text fontFamily="$body" fontSize="$2" color="$soft">
                              {t('/ month')}
                            </Text>
                          </XStack>
                          <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$ink">
                            {p.capacity}
                          </Text>
                          <Text fontFamily="$body" fontSize="$2" color="$soft">
                            {p.subtitle}
                          </Text>
                          <YStack gap="$2" pt="$1">
                            {p.features.map((f) => (
                              <XStack key={f} items="flex-start" gap="$2">
                                <XStack pt={2} shrink={0}>
                                  <Check size={14} color={SOFT} aria-hidden />
                                </XStack>
                                <Text fontFamily="$body" fontSize="$2" color="$soft" flex={1} minW={0}>
                                  {f}
                                </Text>
                              </XStack>
                            ))}
                          </YStack>
                        </YStack>
                        {currentPlanId === p.id ? (
                          <Button
                            disabled
                            variant="outline"
                            rounded="$10"
                            width="100%"
                            minH={40}
                            $touchable={{ minH: 44 }}
                            $max-sm={{ minH: 44 }}
                            py="$2"
                            borderColor="$edge"
                            bg="transparent"
                            cursor="default"
                          >
                            <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$soft">
                              {t('Current plan')}
                            </Text>
                          </Button>
                        ) : (
                          <Anchor
                            data-slot={`upgrade-${p.id}-cta`}
                            data-ga
                            href={p.href}
                            onPress={() => handleBuy(p.id, p.name, p.price)}
                            display="flex"
                            items="center"
                            justify="center"
                            gap="$1.5"
                            bg={highlighted ? 'var(--primary)' : '$panel'}
                            hoverStyle={{ bg: highlighted ? 'var(--primary-hover)' : '$hover' }}
                            focusVisibleStyle={FOCUS_RING}
                            borderWidth={highlighted ? 0 : 1}
                            borderColor={highlighted ? 'transparent' : STRONG}
                            rounded="$10"
                            minH={40}
                            $touchable={{ minH: 44 }}
                            $max-sm={{ minH: 44 }}
                            py="$2"
                            px="$3"
                            color={highlighted ? 'var(--primary-foreground)' : '$ink'}
                            fontFamily="$body"
                            fontWeight="600"
                            fontSize="$2"
                            text="center"
                            textDecorationLine="none"
                          >
                            {highlighted ? <Sparkles size={13} color="var(--primary-foreground)" aria-hidden /> : null}
                            {t('Upgrade to {name}', { name: p.name })}
                          </Anchor>
                        )}
                      </YStack>
                    )
                  })}
                </View>
              ) : null}
            </YStack>
          </YStack>
        ) : (
          /* Business view */
          <YStack gap="$4" width="100%">
            <View
              display="grid"
              gridTemplateColumns="repeat(auto-fit, minmax(min(100%, 280px), 1fr))"
              gap={20}
              width="100%"
              items="stretch"
            >
              <YStack
                bg="var(--surface-card)"
                borderWidth={1}
                borderColor="$edge"
                rounded="$5"
                p="$5"
                gap="$4"
                justify="space-between"
              >
                <YStack gap="$3.5">
                  <Text fontFamily="$heading" fontSize="$5" fontWeight="600" color="$ink">
                    {t('Free')}
                  </Text>
                  <XStack items="baseline" gap="$1.5">
                    <Text
                      fontFamily="$heading"
                      fontSize="$8"
                      fontWeight="700"
                      letterSpacing={'-0.025em' as never}
                      color="$ink"
                      fontVariant={['tabular-nums']}
                    >
                      $0
                    </Text>
                    <Text fontFamily="$body" fontSize="$2" color="$soft">
                      {t('/ month')}
                    </Text>
                  </XStack>
                  <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$ink">
                    {t('Personal workspace for trying Hanzo.')}
                  </Text>
                  <Button
                    disabled
                    variant="outline"
                    rounded="$10"
                    width="100%"
                    minH={40}
                    $touchable={{ minH: 44 }}
                    $max-sm={{ minH: 44 }}
                    py="$2"
                    borderColor="$edge"
                    bg="transparent"
                    cursor="default"
                  >
                    <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$soft">
                      {currentPlanId === 'free' ? t('Current plan') : t('Included')}
                    </Text>
                  </Button>
                  <YStack gap="$2.5" pt="$1">
                    {[
                      t('Everyday chats and writing'),
                      t('Standard AI models'),
                      t('Single personal workspace'),
                    ].map((feat) => (
                      <XStack key={feat} items="flex-start" gap="$2">
                        <XStack pt={2} shrink={0}>
                          <Check size={14} color={SOFT} aria-hidden />
                        </XStack>
                        <Text fontFamily="$body" fontSize="$2" color="$soft" flex={1} minW={0}>
                          {feat}
                        </Text>
                      </XStack>
                    ))}
                  </YStack>
                </YStack>
              </YStack>

              <YStack
                bg="var(--surface-card-emphasis)"
                borderWidth={2}
                borderColor="$ink"
                rounded="$5"
                p="$5"
                gap="$4"
                justify="space-between"
                boxShadow="var(--shadow-lg)"
              >
                <YStack gap="$3.5">
                  <XStack items="center" justify="space-between" gap="$2" flexWrap="wrap">
                    <XStack items="center" gap="$2">
                      <Text fontFamily="$heading" fontSize="$5" fontWeight="600" color="$ink">
                        {t('Business')}
                      </Text>
                      <XStack px="$2.5" py="$0.5" rounded="$10" bg="$ink">
                        <Text fontFamily="$body" fontSize="$1" fontWeight="600" color="$background">
                          {t('Recommended')}
                        </Text>
                      </XStack>
                    </XStack>
                    <XStack
                      items="center"
                      bg="$panel"
                      p="$0.5"
                      rounded="$10"
                      gap="$0.5"
                      borderWidth={1}
                      borderColor={STRONG}
                    >
                      <Box
                        render={<button type="button" />}
                        aria-pressed={businessCycle === 'year'}
                        onClick={() => setBusinessCycle('year')}
                        display="flex"
                        bg={businessCycle === 'year' ? '$raised' : 'transparent'}
                        borderWidth={1}
                        borderColor={businessCycle === 'year' ? STRONG : 'transparent'}
                        minH={30}
                        $touchable={{ minH: 44 }}
                        $max-sm={{ minH: 44 }}
                        px="$2.5"
                        py="$1"
                        rounded="$10"
                        cursor="pointer"
                        items="center"
                        justify="center"
                        focusVisibleStyle={FOCUS_RING}
                      >
                        <Text
                          fontFamily="$body"
                          fontSize="$1"
                          fontWeight={businessCycle === 'year' ? '600' : '400'}
                          color={businessCycle === 'year' ? '$ink' : '$soft'}
                        >
                          {t('Annual')}
                        </Text>
                      </Box>
                      <Box
                        render={<button type="button" />}
                        aria-pressed={businessCycle === 'month'}
                        onClick={() => setBusinessCycle('month')}
                        display="flex"
                        bg={businessCycle === 'month' ? '$raised' : 'transparent'}
                        borderWidth={1}
                        borderColor={businessCycle === 'month' ? STRONG : 'transparent'}
                        minH={30}
                        $touchable={{ minH: 44 }}
                        $max-sm={{ minH: 44 }}
                        px="$2.5"
                        py="$1"
                        rounded="$10"
                        cursor="pointer"
                        items="center"
                        justify="center"
                        focusVisibleStyle={FOCUS_RING}
                      >
                        <Text
                          fontFamily="$body"
                          fontSize="$1"
                          fontWeight={businessCycle === 'month' ? '600' : '400'}
                          color={businessCycle === 'month' ? '$ink' : '$soft'}
                        >
                          {t('Monthly')}
                        </Text>
                      </Box>
                    </XStack>
                  </XStack>

                  <YStack gap="$1">
                    <XStack items="baseline" gap="$1.5">
                      <Text
                        fontFamily="$heading"
                        fontSize="$8"
                        fontWeight="700"
                        letterSpacing={'-0.025em' as never}
                        color="$ink"
                        fontVariant={['tabular-nums']}
                      >
                        {teamSeat == null ? '—' : money(teamSeat)}
                      </Text>
                      <Text fontFamily="$body" fontSize="$2" color="$soft">
                        {t('/ seat / month')}
                      </Text>
                    </XStack>
                    <Text fontFamily="$body" fontSize="$1" color="$hint">
                      {businessCycle === 'year'
                        ? t('Billed annually, 5 seats minimum.')
                        : t('Billed monthly, 5 seats minimum.')}
                    </Text>
                  </YStack>

                  <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$ink">
                    {t('Shared workspace, centralized billing, and private company data.')}
                  </Text>

                  {currentPlanId === 'team' ? (
                    <Button
                      disabled
                      variant="outline"
                      rounded="$10"
                      width="100%"
                      minH={40}
                      $touchable={{ minH: 44 }}
                      $max-sm={{ minH: 44 }}
                      py="$2"
                      borderColor="$edge"
                      bg="transparent"
                      cursor="default"
                    >
                      <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$soft">
                        {t('Current plan')}
                      </Text>
                    </Button>
                  ) : (
                    <Anchor
                      data-slot="upgrade-business-cta"
                      data-ga
                      href={businessHref}
                      onPress={() => handleBuy('team', 'Business', teamValue, businessCycle)}
                      display="flex"
                      bg="var(--primary)"
                      hoverStyle={{ bg: 'var(--primary-hover)' }}
                      focusVisibleStyle={FOCUS_RING}
                      rounded="$10"
                      width="100%"
                      minH={40}
                      $touchable={{ minH: 44 }}
                      $max-sm={{ minH: 44 }}
                      py="$2"
                      px="$4"
                      color="var(--primary-foreground)"
                      fontFamily="$body"
                      fontWeight="600"
                      fontSize="$2"
                      text="center"
                      textDecorationLine="none"
                      items="center"
                      justify="center"
                      gap="$1.5"
                    >
                      <Sparkles size={15} color="var(--primary-foreground)" aria-hidden />
                      {t('Upgrade to Business')}
                    </Anchor>
                  )}

                  <YStack gap="$2.5" pt="$1">
                    {[
                      [Users, t('Shared workspace for your team and AI')],
                      [Lock, t('Zero model training on your company data')],
                      [Link2, t('Google Workspace, Slack, and GitHub connections')],
                      [BarChart2, t('Team usage analytics and spend limits')],
                      [Layers, t('Centralized billing and member roles')],
                      [ShieldCheck, t('SSO and multi-factor security')],
                      [Workflow, t('Shared automations and background tasks')],
                      [Sliders, t('Mix standard ($20) and power ($100) seats')],
                    ].map(([Icon, label], idx) => (
                      <XStack key={idx} items="flex-start" gap="$2">
                        <XStack pt={2} shrink={0}>
                          <Icon size={14} color={SOFT} aria-hidden />
                        </XStack>
                        <Text fontFamily="$body" fontSize="$2" color="$soft" flex={1} minW={0}>
                          {label}
                        </Text>
                      </XStack>
                    ))}
                  </YStack>
                </YStack>
              </YStack>
            </View>

            <XStack justify="center" items="center" gap="$1.5" pt="$1" flexWrap="wrap">
              <Text fontFamily="$body" fontSize="$2" color="$aside">
                {t('Need custom security or dedicated infrastructure?')}
              </Text>
              <Anchor
                href={site('/contact-sales')}
                display="inline-flex"
                items="center"
                minH={32}
                $max-sm={{ minH: 44 }}
                px="$1.5"
                rounded="$2"
                fontFamily="$body"
                fontSize="$2"
                fontWeight="600"
                color="$ink"
                hoverStyle={{ textDecorationLine: 'none' }}
                focusVisibleStyle={FOCUS_RING}
              >
                {t('Contact sales')}
              </Anchor>
            </XStack>
          </YStack>
        )}

        {/* Compact 1-line pre-checkout reassurance & quick prepaid top-up strip */}
        <XStack
          data-slot="upgrade-reassurance"
          items="center"
          justify="space-between"
          gap="$3"
          rowGap="$2.5"
          flexWrap="wrap"
          px="$4"
          py="$3"
          rounded="$4"
          bg="var(--surface-card)"
          borderWidth={1}
          borderColor="$edge"
        >
          <XStack items="center" gap="$2" shrink={1} minW={0}>
            <ShieldCheck size={14} color={SOFT} aria-hidden />
            <Text fontFamily="$body" fontSize="$1" color="$soft">
              {t('Cancel anytime in 2 clicks · Unused credits never expire')}
            </Text>
          </XStack>
          <XStack items="center" gap="$1.5" flexWrap="wrap" shrink={0}>
            <Text fontFamily="$body" fontSize="$1" color="$hint">
              {t('Quick top-up:')}
            </Text>
            {topUpChips.map((amount) => (
              <Anchor
                key={amount}
                data-slot={`upgrade-topup-${amount}`}
                href={topUpAmountUrl(Number(amount), returnUrl)}
                onPress={() => track('topup_chip_clicked', { amount: Number(amount) })}
                display="inline-flex"
                items="center"
                justify="center"
                minH={30}
                $touchable={{ minH: 44 }}
                $max-sm={{ minH: 44 }}
                px="$2.5"
                py="$1"
                rounded="$10"
                bg="$panel"
                borderWidth={1}
                borderColor={STRONG}
                fontFamily="$body"
                fontSize="$1"
                fontWeight="600"
                color="$ink"
                fontVariant={['tabular-nums']}
                textDecorationLine="none"
                hoverStyle={{ bg: '$hover', textDecorationLine: 'none' }}
                focusVisibleStyle={FOCUS_RING}
              >
                +${amount}
              </Anchor>
            ))}
          </XStack>
        </XStack>

        {/* Footer links */}
        <XStack justify="center" items="center" gap="$4" rowGap="$1.5" pt="$0.5" flexWrap="wrap">
          <Anchor
            data-slot="upgrade-add-credits"
            href={topUpHref}
            display="inline-flex"
            items="center"
            minH={32}
            $touchable={{ minH: 44 }}
            $max-sm={{ minH: 44 }}
            px="$2"
            rounded="$2"
            fontFamily="$body"
            fontSize="$2"
            fontWeight="500"
            color="$ink"
            hoverStyle={{ bg: '$hover', textDecorationLine: 'none' }}
            focusVisibleStyle={FOCUS_RING}
          >
            {t('Add prepaid credits')}
          </Anchor>
          <Anchor
            href={site('/pricing')}
            display="inline-flex"
            items="center"
            minH={32}
            $touchable={{ minH: 44 }}
            $max-sm={{ minH: 44 }}
            px="$2"
            rounded="$2"
            fontFamily="$body"
            fontSize="$2"
            color="$soft"
            hoverStyle={{ color: '$ink' }}
            focusVisibleStyle={FOCUS_RING}
          >
            {t('Compare full plan details')}
          </Anchor>
          <Box
            render={<button type="button" />}
            onClick={close}
            display="inline-flex"
            bg="transparent"
            borderWidth={0}
            minH={32}
            $touchable={{ minH: 44 }}
            $max-sm={{ minH: 44 }}
            px="$2"
            rounded="$2"
            cursor="pointer"
            items="center"
            justify="center"
            hoverStyle={{ bg: '$hover' }}
            focusVisibleStyle={FOCUS_RING}
          >
            <Text fontFamily="$body" fontSize="$2" color="$soft" hoverStyle={{ color: '$ink' }}>
              {t('Not now')}
            </Text>
          </Box>
        </XStack>
      </DialogContent>
    </Dialog>
  )
}
