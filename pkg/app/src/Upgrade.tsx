'use client'

// The upgrade dialog for readers on the Free plan, or reaching for paid features.
//
// Matches the modern ChatGPT-style modal:
// - Centered "Upgrade your plan" title with top-right close button.
// - Audience switcher: [ Personal | Business ].
// - Personal view: defaults to 2 plans (Free + Pro) with "Show all plans" expandable
//   to full options (Free, Go, Pro, Dev, Max, Ultra).
// - Business view: Free + Highlighted Business card with Annual/Monthly switch,
//   in-card seat types (Standard & Premium), and enterprise notice at the bottom.

import { useEffect, useState } from 'react'
import { phrase } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import {
  BarChart2,
  Check,
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
import { term, type Interval } from './lib/plans'
import { payUrl } from './lib/pay'
import { site } from './where'

/**
 * The dialog is chrome, so it draws on design's monochrome ladder in both
 * themes: a hue is for artwork, and the plan on offer is told by its fill and
 * its edge. Lucide's `color` is an SVG attribute gui never reads, so an icon
 * takes the CSS value of the rung its label is on.
 */
const INK = 'var(--foreground)'
const SOFT = 'var(--soft, var(--muted-foreground))'

/** What the reader reached for: a model by its name, and the checkout a refusal named. */
export interface Ask {
  model?: string
  href?: string
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
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}`
}

type Audience = 'personal' | 'business'
type MultiplierTier = '3x' | '5x' | '15x'

interface MultiplierConfig {
  id: string
  name: string
  multiple: string
  price: number
  icon: LucideIcon
  subtitle: string
  bots: number
}

const MULTIPLIERS: Record<MultiplierTier, MultiplierConfig> = {
  '3x': {
    id: 'pro-3x',
    name: 'Pro',
    multiple: '3×',
    price: 15,
    icon: Rocket,
    subtitle: '3× more usage and higher limits for everyday builders.',
    bots: 1,
  },
  '5x': {
    id: 'dev-5x',
    name: 'Dev',
    multiple: '5×',
    price: 45,
    icon: Cpu,
    subtitle: '5× higher limits for autonomous coding agents.',
    bots: 2,
  },
  '15x': {
    id: 'max-15x',
    name: 'Max',
    multiple: '15×',
    price: 95,
    icon: Crown,
    subtitle: '15× limits for heavy continuous coding sessions.',
    bots: 5,
  },
}

export function Upgrade({ ask, onClose }: { ask: Ask | null; onClose: () => void }) {
  const { t } = useI18n()
  const [audience, setAudience] = useState<Audience>('personal')
  const [multiplier, setMultiplier] = useState<MultiplierTier>('3x')
  const [showAllPersonal, setShowAllPersonal] = useState(false)
  const [businessCycle, setBusinessCycle] = useState<Interval>('year')
  const [hashOpen, setHashOpen] = useState(false)

  // Listen for #pricing in hash or custom event 'hanzo:upgrade'
  useEffect(() => {
    const handleHash = () => {
      if (typeof window !== 'undefined' && window.location.hash === '#pricing') {
        setHashOpen(true)
      }
    }
    const handleUpgradeEvent = () => setHashOpen(true)

    handleHash()
    window.addEventListener('hashchange', handleHash)
    window.addEventListener('hanzo:upgrade', handleUpgradeEvent)
    return () => {
      window.removeEventListener('hashchange', handleHash)
      window.removeEventListener('hanzo:upgrade', handleUpgradeEvent)
    }
  }, [])

  const open = ask !== null || hashOpen

  useEffect(() => {
    if (open) {
      track('upgrade_dialog_opened', { audience })
    }
  }, [open, audience])

  const close = () => {
    if (typeof window !== 'undefined' && window.location.hash === '#pricing') {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    setHashOpen(false)
    onClose()
  }

  const activeMultiplier = MULTIPLIERS[multiplier]

  const goHref = term(payUrl('/cart', { plan: 'go', org: org(), returnUrl: here() }), 'month')
  const proHref = term(payUrl('/cart', { plan: 'pro-3x', org: org(), returnUrl: here() }), 'month')
  const devHref = term(payUrl('/cart', { plan: 'dev-5x', org: org(), returnUrl: here() }), 'month')
  const maxHref = term(payUrl('/cart', { plan: 'max-15x', org: org(), returnUrl: here() }), 'month')
  const multiplierHref = term(payUrl('/cart', { plan: activeMultiplier.id, org: org(), returnUrl: here() }), 'month')
  const ultraHref = term(payUrl('/cart', { plan: 'ultra', org: org(), returnUrl: here() }), 'month')
  const businessHref = term(payUrl('/cart', { plan: 'team', quantity: '5', org: org(), returnUrl: here() }), businessCycle)

  const handleBuy = (planId: string, planName: string, price: number, interval: Interval = 'month') => {
    const items = [{ item_id: planId, item_name: planName }]
    track('plan_clicked', { plan: planId, interval, cta: `Upgrade to ${planName}`, items })
    track('checkout_started', { currency: 'USD', value: price, items, interval })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? undefined : close())}>
      <DialogContent
        showCloseButton={false}
        width="calc(100vw - 32px)"
        maxW={audience === 'business' || !showAllPersonal ? 880 : 1140}
        maxH="90vh"
        overflowY="auto"
        bg="var(--popover)"
        rounded="$8"
        p="$5"
        gap="$4"
        borderWidth={1}
        borderColor="var(--border)"
        boxShadow="var(--shadow-floating)"
        $sm={{ p: '$7', gap: '$5' }}
      >
        {/* Top-right close button */}
        <Box
          render="button"
          aria-label={t('Close')}
          onClick={close}
          position="absolute"
          t="$4"
          insetInlineEnd="$4"
          width={32}
          height={32}
          rounded="$10"
          bg="transparent"
          borderWidth={0}
          cursor="pointer"
          items="center"
          justify="center"
          hoverStyle={{ bg: '$hover' }}
          z={10}
        >
          <X size={18} aria-hidden color={SOFT} />
        </Box>

        {/* Modal Title */}
        <YStack items="center" gap="$2" pt="$1">
          <DialogTitle
            fontSize={26}
            lineHeight={32}
            fontWeight="600"
            color="$ink"
            text="center"
          >
            {t('Upgrade your plan')}
          </DialogTitle>

          {/* Centered audience segmented toggle pill: [ Personal | Business ] */}
          <XStack
            items="center"
            bg="var(--secondary)"
            p={3}
            rounded="$10"
            gap={2}
            mt="$2"
            borderWidth={1}
            borderColor="var(--border)"
          >
            <Box
              render="button"
              onClick={() => setAudience('personal')}
              bg={audience === 'personal' ? 'var(--card)' : 'transparent'}
              px="$3.5"
              py="$1.5"
              rounded="$10"
              borderWidth={0}
              cursor="pointer"
              hoverStyle={audience === 'personal' ? {} : { bg: '$hover' }}
            >
              <Text
                fontSize={13}
                fontWeight={audience === 'personal' ? '600' : '400'}
                color={audience === 'personal' ? '$ink' : '$soft'}
              >
                {t('Personal')}
              </Text>
            </Box>
            <Box
              render="button"
              onClick={() => setAudience('business')}
              bg={audience === 'business' ? 'var(--card)' : 'transparent'}
              px="$3.5"
              py="$1.5"
              rounded="$10"
              borderWidth={0}
              cursor="pointer"
              hoverStyle={audience === 'business' ? {} : { bg: '$hover' }}
            >
              <Text
                fontSize={13}
                fontWeight={audience === 'business' ? '600' : '400'}
                color={audience === 'business' ? '$ink' : '$soft'}
              >
                {t('Business')}
              </Text>
            </Box>
          </XStack>
        </YStack>

        {/* Audience Content */}
        {audience === 'personal' ? (
          !showAllPersonal ? (
            /* DEFAULT 2-PLAN VIEW: FREE + PRO (Clean, uncluttered, matching ChatGPT modal) */
            <YStack gap="$4" width="100%">
              <View
                display="grid"
                gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))"
                gap={24}
                width="100%"
                items="stretch"
              >
                {/* 1. Free Card */}
                <YStack
                  bg="var(--surface-card-quiet)"
                  borderWidth={1}
                  borderColor="var(--border)"
                  rounded="$6"
                  p="$6"
                  gap="$5"
                  justify="space-between"
                >
                  <YStack gap="$3.5">
                    <XStack items="center" gap="$1.5">
                      <Sprout size={16} color={SOFT} aria-hidden />
                      <Text fontSize={14} fontWeight="500" color="$soft">
                        {t('Free')}
                      </Text>
                    </XStack>

                    <YStack gap="$1">
                      <Text fontSize={24} fontWeight="700" color="$ink">
                        {t('Try Hanzo')}
                      </Text>
                      <Text fontSize={14} color="$soft">
                        {t('See what AI can do.')}
                      </Text>
                    </YStack>

                    <Button
                      disabled
                      variant="outline"
                      rounded="$10"
                      width="100%"
                      py="$2.5"
                      my="$2"
                      borderColor="var(--border-control)"
                      bg="transparent"
                      cursor="default"
                    >
                      <Text fontSize={14} fontWeight="500" color="$soft">
                        {t('Your current plan')}
                      </Text>
                    </Button>

                    <XStack items="baseline" gap="$1">
                      <Text fontSize={28} fontWeight="700" color="$ink">
                        $0
                      </Text>
                      <Text fontSize={14} color="$soft">
                        {t('/ month')}
                      </Text>
                    </XStack>

                    <YStack gap="$3" pt="$2">
                      {[
                        t('Unlimited everyday text chats'),
                        t('Access to all foundation models'),
                        t('Standard inference speed'),
                        t('Context memory and chat history'),
                        t('Community support'),
                      ].map((feat) => (
                        <XStack key={feat} items="center" gap="$2.5">
                          <Check size={16} color={SOFT} aria-hidden />
                          <Text fontSize={13} color="$ink">
                            {feat}
                          </Text>
                        </XStack>
                      ))}
                    </YStack>
                  </YStack>
                </YStack>

                {/* 2. Pro Card (Highlighted with Multiplier Switcher) */}
                <YStack
                  bg="var(--surface-card-emphasis)"
                  borderWidth={1.5}
                  borderColor="var(--border-selected)"
                  rounded="$6"
                  p="$6"
                  gap="$4"
                  justify="space-between"
                  boxShadow="var(--shadow-lg)"
                >
                  <YStack gap="$3">
                    <XStack items="center" justify="space-between">
                      <XStack items="center" gap="$1.5">
                        <activeMultiplier.icon size={16} color={INK} aria-hidden />
                        <Text fontSize={16} fontWeight="700" color="$ink">
                          {activeMultiplier.name}
                        </Text>
                      </XStack>

                      {/* Multiplier pill switcher */}
                      <XStack
                        items="center"
                        bg="var(--secondary)"
                        p={2}
                        rounded="$10"
                        gap={1}
                        borderWidth={1}
                        borderColor="var(--border)"
                      >
                        {(['3x', '5x', '15x'] as const).map((m) => (
                          <Box
                            key={m}
                            render="button"
                            onClick={() => setMultiplier(m)}
                            bg={multiplier === m ? 'var(--card)' : 'transparent'}
                            px="$2"
                            py="$0.5"
                            rounded="$10"
                            borderWidth={0}
                            cursor="pointer"
                          >
                            <Text
                              fontSize={11}
                              fontWeight={multiplier === m ? '700' : '500'}
                              color={multiplier === m ? '$ink' : '$soft'}
                            >
                              {m}
                            </Text>
                          </Box>
                        ))}
                      </XStack>
                    </XStack>

                    <YStack gap="$1">
                      <Text fontSize={24} fontWeight="700" color="$ink">
                        {t('{name} {tier}', { name: activeMultiplier.name, tier: activeMultiplier.multiple })}
                      </Text>
                      <Text fontSize={14} color="$soft">
                        {t(activeMultiplier.subtitle)}
                      </Text>
                    </YStack>

                    {/* Primary CTA button: ✦ Get Pro */}
                    <Anchor
                      href={multiplierHref}
                      onPress={() => handleBuy(activeMultiplier.id, activeMultiplier.name, activeMultiplier.price)}
                      bg="var(--primary)"
                      hoverStyle={{ bg: 'var(--primary-hover)' }}
                      rounded="$10"
                      width="100%"
                      py="$3"
                      my="$1"
                      color="var(--primary-foreground)"
                      fontWeight="600"
                      fontSize={14}
                      text="center"
                      textDecorationLine="none"
                      items="center"
                      justify="center"
                      gap="$2"
                    >
                      <Sparkles size={16} color="var(--primary-foreground)" aria-hidden />
                      {t('Get {name}', { name: activeMultiplier.name })}
                    </Anchor>

                    <XStack items="baseline" gap="$1" pt="$1">
                      <Text fontSize={28} fontWeight="700" color="$ink">
                        ${activeMultiplier.price}
                      </Text>
                      <Text fontSize={14} color="$soft">
                        {t('/ month')}
                      </Text>
                    </XStack>

                    <YStack gap="$2.5" pt="$1">
                      {[
                        t('Everything in Free, plus:'),
                        t('{multiple} more usage than Go', { multiple: activeMultiplier.multiple }),
                        t('Access to Enso Ultra, Kai, and frontier models'),
                        t('Build apps with Hanzo Dev & CLI'),
                        t('Connect any MCP server'),
                        t('Background agents & automations'),
                        t('Hanzo Bot: {bots} custom {bots, plural, one {bot} other {bots}}', { bots: activeMultiplier.bots }),
                        t('Dedicated priority support'),
                      ].map((feat, idx) => (
                        <XStack key={feat} items="center" gap="$2.5">
                          <Check size={16} color={INK} aria-hidden />
                          <Text fontSize={13} color="$ink" fontWeight={idx === 0 ? '600' : '400'}>
                            {feat}
                          </Text>
                        </XStack>
                      ))}
                    </YStack>
                  </YStack>
                </YStack>
              </View>

              {/* Show all plans button */}
              <XStack justify="center" pt="$1">
                <Box
                  render="button"
                  onClick={() => setShowAllPersonal(true)}
                  bg="var(--glass)"
                  hoverStyle={{ bg: 'var(--glass-strong)' }}
                  px="$4"
                  py="$2"
                  rounded="$10"
                  borderWidth={1}
                  borderColor="var(--border)"
                  cursor="pointer"
                >
                  <Text fontSize={13} fontWeight="500" color="$ink">
                    {t('Show all plans (Free, Go, Pro, Dev, Max, Ultra) ↓')}
                  </Text>
                </Box>
              </XStack>
            </YStack>
          ) : (
            /* EXPANDED VIEW: ALL PERSONAL OPTIONS (Free, Go, Pro 3x, Dev 5x, Max 15x, Ultra 25x) */
            <YStack gap="$4" width="100%">
              <View
                display="grid"
                gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
                gap={14}
                width="100%"
                items="stretch"
              >
                {/* 1. Free */}
                <YStack
                  bg="var(--surface-card-quiet)"
                  borderWidth={1}
                  borderColor="var(--border)"
                  rounded="$6"
                  p="$4"
                  justify="space-between"
                  gap="$3"
                >
                  <YStack gap="$2">
                    <XStack items="center" gap="$1.5">
                      <Sprout size={15} color={SOFT} aria-hidden />
                      <Text fontSize={12} fontWeight="600" color="$soft">{t('Free')}</Text>
                    </XStack>
                    <Text fontSize={18} fontWeight="700" color="$ink">{t('Try Hanzo')}</Text>
                    <Text fontSize={12} color="$soft" minH={32}>{t('See what AI can do.')}</Text>
                    <Button disabled variant="outline" rounded="$10" py="$1.5" borderColor="var(--border-control)" bg="transparent" cursor="default">
                      <Text fontSize={12} fontWeight="500" color="$soft">{t('Current plan')}</Text>
                    </Button>
                    <XStack items="baseline" gap="$1">
                      <Text fontSize={22} fontWeight="700" color="$ink">$0</Text>
                      <Text fontSize={12} color="$soft">{t('/ mo')}</Text>
                    </XStack>
                    <YStack gap="$1.5" pt="$1">
                      {[t('Everyday chats'), t('Foundation models'), t('Standard speed'), t('Community support')].map((f) => (
                        <XStack key={f} items="center" gap="$1.5">
                          <Check size={13} color={SOFT} aria-hidden />
                          <Text fontSize={11} color="$ink">{f}</Text>
                        </XStack>
                      ))}
                    </YStack>
                  </YStack>
                </YStack>

                {/* 2. Go ($8/mo) */}
                <YStack
                  bg="var(--surface-card-quiet)"
                  borderWidth={1}
                  borderColor="var(--border)"
                  rounded="$6"
                  p="$4"
                  justify="space-between"
                  gap="$3"
                >
                  <YStack gap="$2">
                    <XStack items="center" gap="$1.5">
                      <Zap size={15} color={INK} aria-hidden />
                      <Text fontSize={12} fontWeight="600" color="$soft">{t('Go')}</Text>
                    </XStack>
                    <Text fontSize={18} fontWeight="700" color="$ink">{t('Everyday AI')}</Text>
                    <Text fontSize={12} color="$soft" minH={32}>{t('More models & agents.')}</Text>
                    <Anchor href={goHref} onPress={() => handleBuy('go', 'Go', 8)} bg="var(--primary)" rounded="$10" py="$1.5" px="$3" color="var(--primary-foreground)" fontWeight="600" fontSize={12} text="center" textDecorationLine="none">
                      {t('Get Go')}
                    </Anchor>
                    <XStack items="baseline" gap="$1">
                      <Text fontSize={22} fontWeight="700" color="$ink">$8</Text>
                      <Text fontSize={12} color="$soft">{t('/ mo')}</Text>
                    </XStack>
                    <YStack gap="$1.5" pt="$1">
                      {[t('All frontier models'), t('Hanzo Dev & CLI'), t('Connect MCP servers'), t('Background agents')].map((f) => (
                        <XStack key={f} items="center" gap="$1.5">
                          <Check size={13} color={INK} aria-hidden />
                          <Text fontSize={11} color="$ink">{f}</Text>
                        </XStack>
                      ))}
                    </YStack>
                  </YStack>
                </YStack>

                {/* 3. Pro 3x ($15/mo) */}
                <YStack
                  bg="var(--surface-card)"
                  borderWidth={1.5}
                  borderColor="var(--border-selected)"
                  rounded="$6"
                  p="$4"
                  justify="space-between"
                  gap="$3"
                >
                  <YStack gap="$2">
                    <XStack items="center" gap="$1.5">
                      <Rocket size={15} color={INK} aria-hidden />
                      <Text fontSize={12} fontWeight="700" color="$ink">{t('Pro 3×')}</Text>
                    </XStack>
                    <Text fontSize={18} fontWeight="700" color="$ink">{t('Pro')}</Text>
                    <Text fontSize={12} color="$soft" minH={32}>{t('3× limits for builders.')}</Text>
                    <Anchor href={proHref} onPress={() => handleBuy('pro-3x', 'Pro', 15)} bg="var(--primary)" rounded="$10" py="$1.5" px="$3" color="var(--primary-foreground)" fontWeight="600" fontSize={12} text="center" textDecorationLine="none">
                      {t('Get Pro')}
                    </Anchor>
                    <XStack items="baseline" gap="$1">
                      <Text fontSize={22} fontWeight="700" color="$ink">$15</Text>
                      <Text fontSize={12} color="$soft">{t('/ mo')}</Text>
                    </XStack>
                    <YStack gap="$1.5" pt="$1">
                      {[t('3× more usage than Go'), t('3× higher 5h limits'), t('1 custom Hanzo Bot'), t('Priority support')].map((f) => (
                        <XStack key={f} items="center" gap="$1.5">
                          <Check size={13} color={INK} aria-hidden />
                          <Text fontSize={11} color="$ink">{f}</Text>
                        </XStack>
                      ))}
                    </YStack>
                  </YStack>
                </YStack>

                {/* 4. Dev 5x ($45/mo) */}
                <YStack
                  bg="var(--surface-card-quiet)"
                  borderWidth={1}
                  borderColor="var(--border)"
                  rounded="$6"
                  p="$4"
                  justify="space-between"
                  gap="$3"
                >
                  <YStack gap="$2">
                    <XStack items="center" gap="$1.5">
                      <Cpu size={15} color={INK} aria-hidden />
                      <Text fontSize={12} fontWeight="700" color="$ink">{t('Dev 5×')}</Text>
                    </XStack>
                    <Text fontSize={18} fontWeight="700" color="$ink">{t('Dev')}</Text>
                    <Text fontSize={12} color="$soft" minH={32}>{t('5× limits for agents.')}</Text>
                    <Anchor href={devHref} onPress={() => handleBuy('dev-5x', 'Dev', 45)} bg="var(--primary)" rounded="$10" py="$1.5" px="$3" color="var(--primary-foreground)" fontWeight="600" fontSize={12} text="center" textDecorationLine="none">
                      {t('Get Dev')}
                    </Anchor>
                    <XStack items="baseline" gap="$1">
                      <Text fontSize={22} fontWeight="700" color="$ink">$45</Text>
                      <Text fontSize={12} color="$soft">{t('/ mo')}</Text>
                    </XStack>
                    <YStack gap="$1.5" pt="$1">
                      {[t('5× more usage than Go'), t('5× higher 5h limits'), t('2 custom Hanzo Bots'), t('Train custom models')].map((f) => (
                        <XStack key={f} items="center" gap="$1.5">
                          <Check size={13} color={INK} aria-hidden />
                          <Text fontSize={11} color="$ink">{f}</Text>
                        </XStack>
                      ))}
                    </YStack>
                  </YStack>
                </YStack>

                {/* 5. Max 15x ($95/mo) */}
                <YStack
                  bg="var(--surface-card-quiet)"
                  borderWidth={1}
                  borderColor="var(--border)"
                  rounded="$6"
                  p="$4"
                  justify="space-between"
                  gap="$3"
                >
                  <YStack gap="$2">
                    <XStack items="center" gap="$1.5">
                      <Crown size={15} color={INK} aria-hidden />
                      <Text fontSize={12} fontWeight="700" color="$ink">{t('Max 15×')}</Text>
                    </XStack>
                    <Text fontSize={18} fontWeight="700" color="$ink">{t('Max')}</Text>
                    <Text fontSize={12} color="$soft" minH={32}>{t('15× continuous limits.')}</Text>
                    <Anchor href={maxHref} onPress={() => handleBuy('max-15x', 'Max', 95)} bg="var(--primary)" rounded="$10" py="$1.5" px="$3" color="var(--primary-foreground)" fontWeight="600" fontSize={12} text="center" textDecorationLine="none">
                      {t('Get Max')}
                    </Anchor>
                    <XStack items="baseline" gap="$1">
                      <Text fontSize={22} fontWeight="700" color="$ink">$95</Text>
                      <Text fontSize={12} color="$soft">{t('/ mo')}</Text>
                    </XStack>
                    <YStack gap="$1.5" pt="$1">
                      {[t('15× more usage than Go'), t('15× higher 5h limits'), t('5 custom Hanzo Bots'), t('Dedicated support')].map((f) => (
                        <XStack key={f} items="center" gap="$1.5">
                          <Check size={13} color={INK} aria-hidden />
                          <Text fontSize={11} color="$ink">{f}</Text>
                        </XStack>
                      ))}
                    </YStack>
                  </YStack>
                </YStack>

                {/* 6. Ultra ($195/mo) */}
                <YStack
                  bg="var(--surface-card-quiet)"
                  borderWidth={1}
                  borderColor="var(--border)"
                  rounded="$6"
                  p="$4"
                  justify="space-between"
                  gap="$3"
                >
                  <YStack gap="$2">
                    <XStack items="center" gap="$1.5">
                      <Gem size={15} color={INK} aria-hidden />
                      <Text fontSize={12} fontWeight="700" color="$ink">{t('Ultra 25×')}</Text>
                    </XStack>
                    <Text fontSize={18} fontWeight="700" color="$ink">{t('Frontier Scale')}</Text>
                    <Text fontSize={12} color="$soft" minH={32}>{t('25× limits for the biggest workloads.')}</Text>
                    <Anchor href={ultraHref} onPress={() => handleBuy('ultra', 'Ultra', 195)} bg="var(--secondary)" rounded="$10" py="$1.5" px="$3" color="$ink" fontWeight="600" fontSize={12} text="center" textDecorationLine="none">
                      {t('Get Ultra')}
                    </Anchor>
                    <XStack items="baseline" gap="$1">
                      <Text fontSize={22} fontWeight="700" color="$ink">$195</Text>
                      <Text fontSize={12} color="$soft">{t('/ mo')}</Text>
                    </XStack>
                    <YStack gap="$1.5" pt="$1">
                      {[t('25× more usage than Go'), t('25× higher 5h limits'), t('10 custom Hanzo Bots'), t('Engineering Slack')].map((f) => (
                        <XStack key={f} items="center" gap="$1.5">
                          <Check size={13} color={INK} aria-hidden />
                          <Text fontSize={11} color="$ink">{f}</Text>
                        </XStack>
                      ))}
                    </YStack>
                  </YStack>
                </YStack>
              </View>

              {/* Show fewer plans button */}
              <XStack justify="center" pt="$1">
                <Box
                  render="button"
                  onClick={() => setShowAllPersonal(false)}
                  bg="transparent"
                  hoverStyle={{ bg: '$hover' }}
                  px="$4"
                  py="$2"
                  rounded="$10"
                  borderWidth={1}
                  borderColor="var(--border)"
                  cursor="pointer"
                >
                  <Text fontSize={13} fontWeight="500" color="$soft">
                    {t('Show fewer plans ↑')}
                  </Text>
                </Box>
              </XStack>
            </YStack>
          )
        ) : (
          /* BUSINESS TAB: EXACT CHATGPT PRICING MODAL LAYOUT (Free + Highlighted Business) */
          <YStack gap="$4" width="100%">
            <View
              display="grid"
              gridTemplateColumns="repeat(auto-fit, minmax(320px, 1fr))"
              gap={24}
              width="100%"
              items="stretch"
            >
              {/* Free Card in Business view */}
              <YStack
                bg="var(--surface-card-quiet)"
                borderWidth={1}
                borderColor="var(--border)"
                rounded="$6"
                p="$6"
                gap="$5"
                justify="space-between"
              >
                <YStack gap="$3.5">
                  <Text fontSize={14} fontWeight="500" color="$soft">
                    {t('Free')}
                  </Text>

                  <YStack gap="$1">
                    <Text fontSize={24} fontWeight="700" color="$ink">
                      {t('Try Hanzo')}
                    </Text>
                    <Text fontSize={14} color="$soft">
                      {t('See what AI can do.')}
                    </Text>
                  </YStack>

                  <Button
                    disabled
                    variant="outline"
                    rounded="$10"
                    width="100%"
                    py="$2.5"
                    my="$2"
                    borderColor="var(--border-control)"
                    bg="transparent"
                    cursor="default"
                  >
                    <Text fontSize={14} fontWeight="500" color="$soft">
                      {t('Your current plan')}
                    </Text>
                  </Button>

                  <XStack items="baseline" gap="$1">
                    <Text fontSize={28} fontWeight="700" color="$ink">
                      $0
                    </Text>
                    <Text fontSize={14} color="$soft">
                      {t('/ month')}
                    </Text>
                  </XStack>

                  <YStack gap="$3" pt="$3">
                    {[
                      t('Unlimited everyday text chats'),
                      t('Limited access to image creation'),
                      t('Limited memory and storage'),
                      t('Limited voice chats'),
                      t('Community and open model access'),
                    ].map((feat) => (
                      <XStack key={feat} items="center" gap="$2.5">
                        <Check size={16} color={SOFT} aria-hidden />
                        <Text fontSize={13} color="$ink">
                          {feat}
                        </Text>
                      </XStack>
                    ))}
                  </YStack>
                </YStack>
              </YStack>

              {/* Business Card (Prominent blue border matching reference screenshot) */}
              <YStack
                bg="var(--surface-card-emphasis)"
                borderWidth={1.5}
                borderColor="var(--border-selected)"
                rounded="$6"
                p="$6"
                gap="$4"
                justify="space-between"
                boxShadow="var(--shadow-lg)"
              >
                <YStack gap="$3">
                  {/* Header with Business and [ Annual | Monthly ] toggle */}
                  <XStack items="center" justify="space-between">
                    <Text fontSize={16} fontWeight="700" color="$ink">
                      {t('Business')}
                    </Text>

                    <XStack
                      items="center"
                      bg="var(--secondary)"
                      p={2}
                      rounded="$10"
                      gap={1}
                      borderWidth={1}
                      borderColor="var(--border)"
                    >
                      <Box
                        render="button"
                        onClick={() => setBusinessCycle('year')}
                        bg={businessCycle === 'year' ? 'var(--card)' : 'transparent'}
                        px="$2.5"
                        py="$1"
                        rounded="$10"
                        borderWidth={0}
                        cursor="pointer"
                      >
                        <Text
                          fontSize={11}
                          fontWeight={businessCycle === 'year' ? '600' : '400'}
                          color={businessCycle === 'year' ? '$ink' : '$soft'}
                        >
                          {t('Annual')}
                        </Text>
                      </Box>
                      <Box
                        render="button"
                        onClick={() => setBusinessCycle('month')}
                        bg={businessCycle === 'month' ? 'var(--card)' : 'transparent'}
                        px="$2.5"
                        py="$1"
                        rounded="$10"
                        borderWidth={0}
                        cursor="pointer"
                      >
                        <Text
                          fontSize={11}
                          fontWeight={businessCycle === 'month' ? '600' : '400'}
                          color={businessCycle === 'month' ? '$ink' : '$soft'}
                        >
                          {t('Monthly')}
                        </Text>
                      </Box>
                    </XStack>
                  </XStack>

                  <YStack gap="$1">
                    <Text fontSize={24} fontWeight="700" color="$ink">
                      {t('For growing teams')}
                    </Text>
                    <Text fontSize={14} color="$soft">
                      {t('A secure workspace with company context')}
                    </Text>
                  </YStack>

                  {/* Primary CTA button: ✦ Get started */}
                  <Anchor
                    href={businessHref}
                    onPress={() => handleBuy('team', 'Business', businessCycle === 'year' ? 200 : 20, businessCycle)}
                    bg="var(--primary)"
                    hoverStyle={{ bg: 'var(--primary-hover)' }}
                    rounded="$10"
                    width="100%"
                    py="$3"
                    my="$1"
                    color="var(--primary-foreground)"
                    fontWeight="600"
                    fontSize={14}
                    text="center"
                    textDecorationLine="none"
                    items="center"
                    justify="center"
                    gap="$2"
                  >
                    <Sparkles size={16} color="var(--primary-foreground)" aria-hidden />
                    {t('Get started')}
                  </Anchor>

                  {/* In-card seat types comparison row */}
                  <YStack
                    bg="var(--secondary)"
                    borderWidth={1}
                    borderColor="var(--border)"
                    rounded="$4"
                    p="$3"
                    gap="$2"
                  >
                    <YStack gap="$0.5">
                      <XStack justify="space-between" items="center">
                        <Text fontSize={13} fontWeight="600" color="$ink">
                          {t('Standard seat')}
                        </Text>
                        <Text fontSize={13} fontWeight="600" color="$ink">
                          {businessCycle === 'year' ? '$16.67 / month' : '$20 / month'}
                        </Text>
                      </XStack>
                      <Text fontSize={11} color="$soft">
                        {t('Best for everyday work')}
                      </Text>
                    </YStack>

                    <Box height={1} bg="var(--edge)" />

                    <YStack gap="$0.5">
                      <XStack justify="space-between" items="center">
                        <Text fontSize={13} fontWeight="600" color="$ink">
                          {t('Premium seat')}
                        </Text>
                        <Text fontSize={13} fontWeight="600" color="$ink">
                          {businessCycle === 'year' ? '$83.33 / month' : '$100 / month'}
                        </Text>
                      </XStack>
                      <Text fontSize={11} color="$soft">
                        {t('More usage, no 5-hour limit')}
                      </Text>
                    </YStack>
                  </YStack>

                  {/* Business features list with prominent blue icons */}
                  <YStack gap="$2.5" pt="$1">
                    {[
                      [Workflow, t('Shared tasks — so your team can do more by delegating busy work')],
                      [Users, t('Hanzo Space to collaborate with your team and AI')],
                      [ShieldCheck, t('Secure workspace with SAML, SSO, and MFA')],
                      [Link2, t('Connections for Google Workspace, Slack, GitHub, Microsoft 365, and more')],
                      [BarChart2, t('Usage analytics and spend controls')],
                      [Layers, t('Centralized billing and administration')],
                      [Lock, t('No model training on your business data by default')],
                      [Sliders, t('Mix and match seat types')],
                    ].map(([Icon, label], idx) => (
                      <XStack key={idx} items="flex-start" gap="$2.5">
                        <Box pt={2}>
                          <Icon size={16} color={INK} aria-hidden />
                        </Box>
                        <Text fontSize={13} color="$ink" lineHeight={18}>
                          {label}
                        </Text>
                      </XStack>
                    ))}
                  </YStack>
                </YStack>
              </YStack>
            </View>

            {/* Business Enterprise notice at the bottom of Business tab */}
            <XStack justify="center" items="center" gap="$1.5" pt="$2">
              <Text fontSize={13} color="$soft">
                {t('Need more capabilities for your business?')}
              </Text>
              <Anchor
                href={site('/contact-sales')}
                fontSize={13}
                fontWeight="600"
                color="$ink"
                hoverStyle={{ textDecorationLine: 'none' }}
              >
                {t('See Hanzo Enterprise')}
              </Anchor>
            </XStack>
          </YStack>
        )}

        {/* Footer links */}
        <XStack justify="center" items="center" gap="$5" pt="$2">
          <Anchor
            href={site('/pricing')}
            fontSize={13}
            color="$soft"
            hoverStyle={{ color: '$ink' }}
          >
            {t('See all plans & pricing table')}
          </Anchor>
          <Box
            render="button"
            onClick={close}
            bg="transparent"
            borderWidth={0}
            p={0}
            cursor="pointer"
          >
            <Text fontSize={13} color="$soft" hoverStyle={{ color: '$ink' }}>
              {t('Not now')}
            </Text>
          </Box>
        </XStack>
      </DialogContent>
    </Dialog>
  )
}
