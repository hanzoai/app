'use client'

// The account rows both the view and the picker draw: every login a device
// detected and every key in KMS, each `on <device name>` with its plan, usage
// windows, credits and state; the ones this surface cannot use are greyed and
// say why on the row.

import { useI18n } from '@hanzo/i18n/react'
import { Badge, Button, Progress, Text, XStack, YStack } from '@hanzo/ui'
import { ago, availability, choose, level, listed, money, named, percent, resets, snapshotOf } from './logic'
import type { Account, Choice, Source, Surface, Usage } from './types'

const EDGE = 'var(--border-strong)'

export interface Picked {
  /** The account chosen; null for the Hanzo cell. */
  account: Account | null
  /** `/v1/dev`'s execution for it; null for a login on this very device, which the host runs itself. */
  choice: Choice | null
}

export function Accounts({
  accounts,
  sources,
  usage,
  surface,
  deviceId,
  now,
  selected,
  onPick,
}: {
  accounts: Account[]
  sources: Source[]
  usage: Usage
  surface: Surface
  deviceId?: string
  now: Date
  selected?: Choice | null
  onPick?: (pick: Picked) => void
}) {
  const { t } = useI18n()
  return (
    <YStack gap="$2" data-slot="accounts">
      {onPick ? (
        <XStack
          gap="$2.5"
          items="center"
          justify="space-between"
          flexWrap="wrap"
          borderWidth={1}
          borderColor={EDGE}
          rounded="$3"
          p="$3.5"
          data-slot="account"
          data-id="cell"
          data-usable="true"
          data-selected={!selected || selected.via === 'cell' ? 'true' : 'false'}
        >
          <YStack flex={1} minW={160}>
            <Text fontSize="$3" fontWeight="600" color="$ink">{t('Hanzo cell')}</Text>
            <Text fontSize="$2" color="$aside">{t('Zen models, no account needed')}</Text>
          </YStack>
          <Button size="sm" variant="outline" onPress={() => onPick({ account: null, choice: { via: 'cell' } })}>{t('Use')}</Button>
        </XStack>
      ) : null}
      {listed(accounts, sources, surface, deviceId).map((a) => (
        <Row key={a.id} account={a} sources={sources} usage={usage} surface={surface} deviceId={deviceId} now={now} selected={selected} onPick={onPick} />
      ))}
    </YStack>
  )
}

function Row({
  account: a,
  sources,
  usage,
  surface,
  deviceId,
  now,
  selected,
  onPick,
}: {
  account: Account
  sources: Source[]
  usage: Usage
  surface: Surface
  deviceId?: string
  now: Date
  selected?: Choice | null
  onPick?: (pick: Picked) => void
}) {
  const { t, locale } = useI18n()
  const source = sources.find((s) => s.id === a.sourceId)
  const can = availability(a, source, surface, deviceId, t)
  const snap = snapshotOf(usage, a)
  const choice = choose(a, source, surface, deviceId)
  const here = Boolean(deviceId && source?.id === deviceId && can.usable)
  const on = a.kind === 'key' ? t('API key in Hanzo KMS') : t('on {device}', { device: a.sourceId ? named(sources, a.sourceId) : t('this device') })
  const chosen =
    selected && choice && selected.via === choice.via && (selected.via === 'key' ? selected.account === a.id : selected.via === 'desktop' && selected.source === (choice as { source: string }).source && selected.instance === (choice as { instance: string }).instance)
  const c = snap?.credits
  return (
    <YStack
      gap="$1.5"
      borderWidth={1}
      borderColor={EDGE}
      rounded="$3"
      p="$3.5"
      opacity={can.usable ? 1 : 0.6}
      data-slot="account"
      data-id={a.id}
      data-usable={can.usable ? 'true' : 'false'}
      data-selected={chosen ? 'true' : 'false'}
    >
      <XStack gap="$2.5" items="center" justify="space-between" flexWrap="wrap">
        <YStack flex={1} minW={160}>
          <Text fontSize="$3" fontWeight="600" color="$ink">
            {a.provider}
            {a.plan ? ` · ${a.plan}` : ''}
            {a.kind === 'key' && a.label ? ` · ${a.label}` : ''}
          </Text>
          <Text fontSize="$2" color="$aside" data-slot="account-on">
            {on}
            {a.state ? ` · ${a.state.replace(/_/g, ' ')}` : ''}
            {a.kind === 'key' && a.fingerprint ? ` · …${a.fingerprint.slice(-4)}` : ''}
            {source && source.state !== 'online' && source.state !== 'revoked' && source.last_seen ? ` · ${t('last seen {when} ago', { when: ago(source.last_seen, now, t) })}` : ''}
          </Text>
        </YStack>
        {onPick && can.usable ? (
          <Button size="sm" variant={chosen ? 'primary' : 'outline'} aria-pressed={Boolean(chosen)} onPress={() => onPick({ account: a, choice })}>
            {here ? t('Use here') : can.reason ?? t('Use')}
          </Button>
        ) : null}
        {!onPick && a.kind === 'login' ? <Badge variant="secondary" size="sm">{a.shared ? t('Shared with my other devices') : t('On this device only')}</Badge> : null}
        {!onPick && a.kind === 'key' ? <Badge variant="secondary" size="sm">{t('API key')}</Badge> : null}
      </XStack>

      {!can.usable ? (
        <Text fontSize="$2" color="$soft" data-slot="reason">{can.reason}</Text>
      ) : null}

      {snap?.windows.map((w) => {
        const used = percent(w.usedPercent)
        const lv = level(used)
        const when = resets(w.resetsAt, now, t)
        return (
          <YStack key={`${w.kind}/${w.label}`} gap="$1" data-slot="window">
            <XStack justify="space-between" gap="$2">
              <Text fontSize="$2" color="$ink">{w.label}</Text>
              <Text fontSize="$2" color="$soft" fontVariant={['tabular-nums']}>
                {t('{percent}% used', { percent: used })}
                {when ? ` · ${t('resets {when}', { when })}` : ''}
              </Text>
            </XStack>
            <Progress
              value={used}
              size="sm"
              indicatorColor={lv === 'high' ? 'var(--state-error)' : lv === 'warn' ? 'var(--chrome-dot-yellow)' : 'var(--foreground)'}
              aria-label={t('{label}: {percent}% used', { label: w.label, percent: used })}
            />
          </YStack>
        )
      })}
      {snap?.error ? <Text fontSize="$2" color="var(--state-error)">{t('The last refresh failed: {code}', { code: snap.error })}</Text> : null}
      {c ? (
        <Text fontSize="$2" color="$soft" fontVariant={['tabular-nums']} data-slot="credits">
          {[
            c.balance !== undefined ? t('Balance {amount}', { amount: money(c.balance, c.currency, locale) }) : '',
            c.spent !== undefined ? t('Spent {amount}', { amount: money(c.spent, c.currency, locale) }) : '',
            c.limit !== undefined ? t('Limit {amount}', { amount: money(c.limit, c.currency, locale) }) : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}
    </YStack>
  )
}
