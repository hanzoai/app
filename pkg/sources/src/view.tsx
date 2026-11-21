'use client'

// The sources view (HIP-1350, "One view"): every desktop and browser a person
// linked to Hanzo, every account each detected, and what they used. One
// component for every surface; the host passes a client and says where it runs.
// It holds no credential and reports nothing: metadata only, never prompts or code.

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  Text,
  XStack,
  YStack,
} from '@hanzo/ui'
import { Accounts, type Picked } from './accounts'
import type { Client } from './client'
import { useRead, type Loaded } from './data'
import { ago, compact, dollars, heaviest, ordered, tokens, total } from './logic'
import { RANGES, type Choice, type Range, type Row, type Source, type Surface } from './types'

const EDGE = 'var(--border-strong)'

/** Where a signed-out person goes. IAM owns sign-in; the host's origin decides nothing here. */
export const SIGN_IN = 'https://hanzo.ai/login'

export interface SourcesViewProps {
  client: Client
  /** Where this view runs: decides which accounts are usable here. */
  surface: Surface
  /** The source id of the device this surface runs on, when it is a linked one. */
  deviceId?: string
  /** An org admin: adds the People tab, per-user totals only. */
  admin?: boolean
  /** Makes account rows choosable: the picker contract. */
  onPick?: (pick: Picked) => void
  /** The account in use, marked on its row. */
  selected?: Choice | null
  signIn?: string
}

export function SourcesView({ client, surface, deviceId, admin, onPick, selected, signIn = SIGN_IN }: SourcesViewProps) {
  const { t } = useI18n()
  const [range, setRange] = useState<Range>(7)
  const [bump, setBump] = useState(0)
  const [tab, setTab] = useState<'mine' | 'people'>('mine')
  const read = useRead(client, range, bump)

  if (!client.signedIn()) return <SignedOut href={signIn} />

  return (
    <YStack gap="$5" data-slot="sources">
      <YStack gap="$1.5">
        <Text fontSize="$3" color="$soft">{t('Every desktop and browser you linked to Hanzo, and what each used.')}</Text>
        <Text fontSize="$2" color="$aside" data-slot="sources-copy">
          {t('Only metadata is reported: token counts, cost and plan limits. Never your prompts, replies or code. A subscription login stays on the device that holds it.')}
        </Text>
      </YStack>

      <XStack gap="$3" items="center" justify="space-between" flexWrap="wrap">
        {admin ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v === 'people' ? 'people' : 'mine')}>
            <TabsList>
              <TabsTrigger value="mine">{t('Your sources')}</TabsTrigger>
              <TabsTrigger value="people">{t('People')}</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : (
          <span />
        )}
        <RangePicker range={range} onChange={setRange} />
      </XStack>

      {tab === 'people' && admin ? (
        <People client={client} range={range} />
      ) : read.is === 'loading' ? (
        <Loading />
      ) : read.is === 'error' ? (
        <Failed status={read.status} onRetry={() => setBump((n) => n + 1)} signIn={signIn} />
      ) : (
        <Ready read={read} client={client} surface={surface} deviceId={deviceId} range={range} onPick={onPick} selected={selected} onRevoked={() => setBump((n) => n + 1)} />
      )}
    </YStack>
  )
}

export function SignedOut({ href }: { href: string }) {
  const { t } = useI18n()
  return (
    <YStack gap="$2" data-slot="sources-signed-out">
      <Text fontSize="$3" color="$soft">{t('Sign in to see your linked sources.')}</Text>
      <XStack>
        <Button size="sm" variant="primary" render={<a href={href} />}>{t('Sign in')}</Button>
      </XStack>
    </YStack>
  )
}

export function Loading() {
  const { t } = useI18n()
  return (
    <XStack gap="$2" items="center" role="status">
      <Spinner size={16} />
      <Text fontSize="$3" color="$soft">{t('Reading your sources…')}</Text>
    </XStack>
  )
}

function RangePicker({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  const { t } = useI18n()
  return (
    <Tabs value={String(range)} onValueChange={(v) => onChange(Number(v) === 30 ? 30 : 7)} data-slot="sources-range" aria-label={t('Range')}>
      <TabsList>
        {RANGES.map((d) => (
          <TabsTrigger key={d} value={String(d)}>{t('{n} days', { n: d })}</TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

export function Failed({ status, onRetry, signIn = SIGN_IN }: { status: number; onRetry: () => void; signIn?: string }) {
  const { t } = useI18n()
  const denied = status === 401 || status === 403
  return (
    <YStack gap="$2" role="alert" data-slot="sources-error">
      <Text fontSize="$3" color="var(--state-error)">
        {denied
          ? t('Sign in again to see your linked sources.')
          : status === 0
            ? t('Could not reach Hanzo. Check your connection.')
            : t('Hanzo could not read your linked sources ({status}).', { status })}
      </Text>
      <XStack gap="$2">
        {denied ? <Button size="sm" variant="primary" render={<a href={signIn} />}>{t('Sign in')}</Button> : null}
        <Button size="sm" variant="outline" onPress={onRetry}>{t('Try again')}</Button>
      </XStack>
    </YStack>
  )
}

function Ready({
  read,
  client,
  surface,
  deviceId,
  range,
  onPick,
  selected,
  onRevoked,
}: {
  read: Loaded
  client: Client
  surface: Surface
  deviceId?: string
  range: Range
  onPick?: (pick: Picked) => void
  selected?: Choice | null
  onRevoked: () => void
}) {
  const { t } = useI18n()
  if (read.sources.length === 0 && read.accounts.length === 0) {
    return (
      <YStack gap="$1.5" borderWidth={1} borderColor={EDGE} rounded="$3" p="$4" data-slot="sources-empty">
        <Text fontSize="$4" fontWeight="600" color="$ink">{t('Nothing is linked yet')}</Text>
        <Text fontSize="$3" color="$soft">
          {t('Link the Hanzo Dev desktop app or the Hanzo browser extension to your account and it appears here, with its usage.')}
        </Text>
      </YStack>
    )
  }
  const by = (id: string) => read.source.rows.find((r) => r.key === id)
  return (
    <YStack gap="$6">
      <Section title={t('Linked sources')} slot="sources-list">
        {ordered(read.sources).map((s) => (
          <SourceRow key={s.id} client={client} source={s} used={by(s.id)} now={read.at} onRevoked={onRevoked} />
        ))}
      </Section>
      <Section title={t('Accounts')} slot="sources-accounts">
        {read.accounts.length === 0 ? (
          <Text fontSize="$3" color="$soft">{t('No provider accounts reported.')}</Text>
        ) : null}
        <Accounts accounts={read.accounts} sources={read.sources} usage={read.provider} surface={surface} deviceId={deviceId} now={read.at} selected={selected} onPick={onPick} />
      </Section>
      <Totals title={t('Usage by provider · last {n} days', { n: range })} slot="sources-providers" rows={read.provider.rows} />
      <Totals title={t('Models · last {n} days', { n: range })} slot="sources-models" rows={read.model.rows} model />
    </YStack>
  )
}

export function Section({ title, slot, children }: { title: string; slot: string; children: React.ReactNode }) {
  return (
    <YStack gap="$2.5" data-slot={slot}>
      <Text fontSize="$4" fontWeight="600" color="$ink" render="h3">{title}</Text>
      {children}
    </YStack>
  )
}

function Dot({ state }: { state: Source['state'] }) {
  const { t } = useI18n()
  const label = state === 'online' ? t('Online') : state === 'offline' ? t('Offline') : t('Revoked')
  return (
    <YStack
      role="img"
      aria-label={label}
      data-state={state}
      width={8}
      height={8}
      rounded={999}
      shrink={0}
      bg={state === 'online' ? 'var(--state-online)' : state === 'revoked' ? 'var(--state-error)' : 'var(--border-strong)'}
    />
  )
}

function SourceRow({ client, source: s, used, now, onRevoked }: { client: Client; source: Source; used?: Row; now: Date; onRevoked: () => void }) {
  const { t, locale } = useI18n()
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState(false)
  const revoke = useCallback(async () => {
    setBusy(true)
    setRefused(false)
    try {
      await client.revoke(s.id)
      setAsk(false)
      onRevoked()
    } catch {
      setRefused(true)
    } finally {
      setBusy(false)
    }
  }, [client, s.id, onRevoked])

  const seen = s.state === 'online' ? t('online now') : s.last_seen ? t('last seen {when} ago', { when: ago(s.last_seen, now, t) }) : t('never seen')
  return (
    <YStack gap="$2" borderWidth={1} borderColor={EDGE} rounded="$3" p="$3.5" data-slot="source" data-id={s.id} data-state={s.state}>
      <XStack gap="$2.5" items="center" justify="space-between" flexWrap="wrap">
        <XStack gap="$2.5" items="center" flex={1} minW={0}>
          <Dot state={s.state} />
          <YStack flex={1} minW={0}>
            <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>{s.name}</Text>
            <Text fontSize="$2" color="$aside">
              {[s.kind === 'browser' ? t('Browser') : t('Desktop'), s.os, s.version].filter(Boolean).join(' · ')} · {seen}
            </Text>
          </YStack>
        </XStack>
        {s.state !== 'revoked' ? (
          <Button size="sm" variant="outline" aria-label={t('Revoke {name}', { name: s.name })} onPress={() => setAsk(true)}>
            {t('Revoke')}
          </Button>
        ) : null}
      </XStack>
      {used ? (
        <Text fontSize="$2" color="$soft" fontVariant={['tabular-nums']}>
          {t('{tokens} tokens · {cost}', { tokens: compact(tokens(used)), cost: dollars(used.costUsd, locale) })}
        </Text>
      ) : null}

      <AlertDialog open={ask} onOpenChange={(o) => !busy && setAsk(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Revoke {name}?', { name: s.name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('It stops reporting and its link to your account is cut. Its past usage stays in your totals. Link it again from the app to bring it back.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {refused ? <Text fontSize="$2" color="var(--state-error)" role="alert">{t('Could not revoke. Try again.')}</Text> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onPress={() => void revoke()}>
              {t('Revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </YStack>
  )
}

/** Tokens and cost by provider or model over the range. The cloud totals a range; it does not split it by day. */
function Totals({ title, slot, rows, model }: { title: string; slot: string; rows: Row[]; model?: boolean }) {
  const { t, locale } = useI18n()
  if (rows.length === 0) {
    return model ? null : (
      <Section title={title} slot={slot}>
        <Text fontSize="$3" color="$soft" data-slot="sources-no-usage">{t('No usage reported in this range.')}</Text>
      </Section>
    )
  }
  const sum = total(rows)
  return (
    <Section title={title} slot={slot}>
      <YStack borderWidth={1} borderColor={EDGE} rounded="$3" overflow="hidden">
        {heaviest(rows).map((r) => (
          <XStack key={r.key} gap="$1.5" columnGap="$3" px="$3.5" py="$2.5" justify="space-between" items="center" flexWrap="wrap" data-slot={model ? 'model' : 'provider'} data-provider={r.key}>
            <Text fontSize="$2" color="$ink" flex={1} minW={160}>{r.key}</Text>
            <Text fontSize="$2" color="$soft" fontVariant={['tabular-nums']}>
              {t('{input} in · {output} out · {cache} cache', { input: compact(r.inputTokens), output: compact(r.outputTokens), cache: compact(r.cacheTokens) })}
            </Text>
            <Text fontSize="$2" color="$ink" fontVariant={['tabular-nums']} minW={64} text="end">{dollars(r.costUsd, locale)}</Text>
          </XStack>
        ))}
      </YStack>
      <Text fontSize="$2" color="$aside" fontVariant={['tabular-nums']}>
        {t('Total {tokens} tokens · {cost}', { tokens: compact(tokens(sum)), cost: dollars(sum.costUsd, locale) })}
      </Text>
    </Section>
  )
}

/** An org admin's per-person totals: counts and cost, never another person's sources or accounts. */
function People({ client, range }: { client: Client; range: Range }) {
  const { t, locale } = useI18n()
  const [read, set] = useState<{ is: 'loading' } | { is: 'error'; status: number } | { is: 'ready'; rows: Row[] }>({ is: 'loading' })
  const [bump, setBump] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    set({ is: 'loading' })
    client
      .usage('user', range, new Date(), abort.signal)
      .then((u) => set({ is: 'ready', rows: u.rows }))
      .catch((e: Error) => {
        if (e.name !== 'AbortError') set({ is: 'error', status: (e as { status?: number }).status ?? 0 })
      })
    return () => abort.abort()
  }, [client, range, bump])

  if (read.is === 'loading') return <Loading />
  if (read.is === 'error') return <Failed status={read.status} onRetry={() => setBump((n) => n + 1)} />
  return (
    <Section title={t('People · last {n} days', { n: range })} slot="sources-people">
      <Text fontSize="$2" color="$aside">{t('Totals only. An admin never sees another person’s sources, plans or labels.')}</Text>
      {read.rows.length === 0 ? (
        <Text fontSize="$3" color="$soft">{t('No usage reported in this range.')}</Text>
      ) : (
        <YStack borderWidth={1} borderColor={EDGE} rounded="$3" overflow="hidden">
          {heaviest(read.rows).map((r) => (
            <XStack key={r.key} gap="$3" px="$3.5" py="$2.5" justify="space-between" data-slot="person">
              <Text fontSize="$2" color="$ink" flex={1} minW={0} numberOfLines={1}>{r.key}</Text>
              <Text fontSize="$2" color="$soft" fontVariant={['tabular-nums']}>{t('{tokens} tokens', { tokens: compact(tokens(r)) })}</Text>
              <Text fontSize="$2" color="$ink" fontVariant={['tabular-nums']} minW={64} text="end">{dollars(r.costUsd, locale)}</Text>
            </XStack>
          ))}
        </YStack>
      )}
    </Section>
  )
}
