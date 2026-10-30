'use client'

// The ask to upgrade, for a reader on the Free plan.
//
// A Free reader who reaches for something Free does not include is shown the
// first personal plan that charges (`usePlan('personal')`), priced by the
// catalog for a month or for a year, with checkout at hanzo.ai/pay. `useFree`
// says who is on Free; `Upgrade` draws the ask it is handed and nothing when it
// is handed none. A refusal's ask is read by `planRequired` in `failure.ts`.

import { useEffect, useState } from 'react'
import { phrase } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { Gauge, Sparkles, Users, Workflow, X, type LucideIcon } from 'lucide-react'
import { Anchor, Box, Dialog, DialogContent, DialogTitle, Text, ToggleGroup, ToggleGroupItem, XStack, YStack } from '@hanzo/ui'
import { track } from './lib/tags'
import { org } from './lib/session'
import { useTier } from './lib/tier'
import { charge, quote, saving, term, usePlan, type Interval } from './lib/plans'
import { payUrl } from './lib/pay'
import { site } from './where'

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

// What the first paid personal plan adds to Free, in the words of the plan
// catalog (@hanzo/plans subscription.json, the `dev` plan's features), drawn through `t`.
const ROWS: readonly (readonly [LucideIcon, string])[] = [
  [Gauge, phrase('Usage included on every model')],
  [Sparkles, phrase('Every model, including Enso Ultra and Kai')],
  [Users, phrase('Hanzo Team: chat, meetings, calendar and contacts')],
  [Workflow, phrase('Automations, with daily runs included')],
]

/** The page checkout returns to: this one, query and all. */
function here(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const { origin, pathname, search } = window.location
  return `${origin}${pathname}${search}`
}

export function Upgrade({ ask, onClose }: { ask: Ask | null; onClose: () => void }) {
  const { t } = useI18n()
  const { plan } = usePlan('personal')
  const [cycle, setCycle] = useState<Interval>('month')
  const shown = ask !== null && plan !== null
  // The plan is shown to a reader who reached for it: GA4's view_item.
  useEffect(() => {
    if (shown && plan)
      track('product_viewed', {
        currency: 'USD',
        value: charge(plan, 'month'),
        items: [{ item_id: plan.id, item_name: plan.name }],
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])
  if (!plan) return null

  const save = saving(plan)
  const interval: Interval = save === null ? 'month' : cycle
  const label = t('Choose your plan — Pro, Max & Team')
  const href = term(ask?.href ?? payUrl('/cart', { org: org(), returnUrl: here() }), interval)
  const buy = () => {
    const items = [{ item_id: plan.id, item_name: plan.name }]
    // The funnel reads the English, whatever language the reader chose.
    track('plan_clicked', { plan: plan.id, interval, cta: `Upgrade to ${plan.name} for ${quote(plan, interval)}`, items })
    track('checkout_started', { currency: 'USD', value: charge(plan, interval), items, interval })
  }

  return (
    <Dialog open={ask !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        showCloseButton={false}
        width="calc(100vw - 32px)"
        maxW={440}
        bg="var(--popover)"
        rounded="$9"
        p="$5"
        gap="$5"
        $sm={{ p: '$6' }}
      >
        <Box
          render="button"
          aria-label={t('Close')}
          onClick={onClose}
          position="absolute"
          t="$4"
          insetInlineEnd="$4"
          p="$1.5"
          rounded="$2"
          bg="transparent"
          borderWidth={0}
          cursor="pointer"
          hoverStyle={{ bg: '$hover' }}
        >
          <X size={18} aria-hidden color="var(--soft, var(--muted-foreground))" />
        </Box>
        <DialogTitle
          fontFamily="$serif"
          fontSize="$8"
          lineHeight="$9"
          fontWeight="400"
          color="$ink"
          paddingInlineEnd="$6"
        >
          {ask?.model ? t('Use {model} with Hanzo {plan}', { model: ask.model, plan: plan.name }) : t('Upgrade to Hanzo {plan}', { plan: plan.name })}
        </DialogTitle>

        <YStack render="ul" gap="$3.5" m={0} p={0}>
          {ROWS.map(([Icon, line]) => (
            <XStack key={line} render="li" items="center" gap="$3">
              <Icon size={18} aria-hidden color="var(--soft, var(--muted-foreground))" />
              <Text fontSize="$4" color="$ink">
                {t(line)}
              </Text>
            </XStack>
          ))}
        </YStack>

        {save === null ? null : (
          <ToggleGroup
            type="single"
            value={cycle}
            onValueChange={(v) => {
              if (v === 'month' || v === 'year') setCycle(v)
            }}
            disableDeactivation
            aria-label={t('Billing term')}
            // The group forwards gui props to its frame; @hanzo/ui's ToggleGroup type does not name them.
            {...({ width: '100%', p: 4, rounded: 9999, bg: 'var(--surface-2)' } as object)}
          >
            {(
              [
                ['month', t('Monthly')],
                ['year', t('Yearly · Save {percent}%', { percent: save })],
              ] as const
            ).map(([value, name]) => (
              <ToggleGroupItem key={value} value={value} variant="outline" flex={1} rounded="$10" borderColor="transparent">
                {name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        <YStack gap="$3">
          <Anchor
            href={href}
            onPress={buy}
            data-ga
            bg="var(--primary)"
            color="var(--primary-foreground)"
            rounded="$4"
            py="$3"
            px="$4"
            fontSize="$4"
            fontWeight="500"
            text="center"
            textDecorationLine="none"
            hoverStyle={{ bg: 'var(--primary-hover)' }}
          >
            {label}
          </Anchor>
          <XStack justify="center" gap="$5">
            <Anchor href={site("/pricing")} fontSize="$3" color="$soft" hoverStyle={{ color: '$ink' }}>
              {t('See all plans')}
            </Anchor>
            <Box render="button" onClick={onClose} bg="transparent" borderWidth={0} p={0} cursor="pointer">
              <Text fontSize="$3" color="$soft" hoverStyle={{ color: '$ink' }}>
                {t('Not now')}
              </Text>
            </Box>
          </XStack>
        </YStack>
      </DialogContent>
    </Dialog>
  )
}
