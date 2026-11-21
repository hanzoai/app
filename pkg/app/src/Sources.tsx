'use client'

// Linked sources (HIP-1350, "One view"): every desktop and browser a person
// linked to Hanzo, what each can reach, and what it used. A client of the cloud
// (lib/sources); it draws no second copy of the desktop's "Linked to Hanzo"
// screen or of Dev's own usage panel, and it holds no credential.

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { administers } from '@hanzo/build'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Box,
  Button,
  Progress,
  Spinner,
  Tabs,
  TabsList,
  TabsTrigger,
  Text,
  XStack,
  YStack,
} from '@hanzo/ui'
import { ago } from './recent'
import { bearer, org } from './lib/session'
import {
  RANGES,
  compact,
  dollars,
  heaviest,
  level,
  listSources,
  named,
  ordered,
  percent,
  providers,
  readUsage,
  resets,
  revokeSource,
  route,
  snapshotsFor,
  tokens,
  total,
  type Range,
  type Row,
  type Snapshot,
  type Source,
  type Usage,
} from './lib/sources'

const EDGE = 'var(--border-strong)'
const NONE: Usage = { rows: [], snapshots: [] }

interface Loaded {
  sources: Source[]
  provider: Usage
  model: Usage
  source: Usage
  at: Date
}

type Read = { is: 'loading' } | { is: 'error'; status: number } | ({ is: 'ready' } & Loaded)

/** Reads the registry and the three totals the view draws, again when `range` or `bump` change. */
function useRead(range: Range, bump: number): Read {
  const [read, set] = useState<Read>({ is: 'loading' })
  useEffect(() => {
    const abort = new AbortController()
    const now = new Date()
    set({ is: 'loading' })
    Promise.all([
      listSources(abort.signal),
      readUsage('provider', range, now, abort.signal),
      readUsage('model', range, now, abort.signal),
      readUsage('source', range, now, abort.signal),
    ])
      .then(([sources, provider, model, source]) => set({ is: 'ready', sources, provider, model, source, at: now }))
      .catch((e: Error) => {
        if (e.name !== 'AbortError') set({ is: 'error', status: (e as { status?: number }).status ?? 0 })
      })
    return () => abort.abort()
  }, [range, bump])
  return read
}

/** The view, in Settings → Linked sources. */
export function Sources() {
  const { t } = useI18n()
  const [range, setRange] = useState<Range>(7)
  const [bump, setBump] = useState(0)
  const [tab, setTab] = useState<'mine' | 'people'>('mine')
  const read = useRead(range, bump)
  const admin = administers(bearer(), org())

  if (!bearer()) return <Text fontSize="$3" color="$soft">{t('Sign in to see your linked sources.')}</Text>

  return (
    <YStack gap="$5" data-slot="sources">
      <YStack gap="$1.5">
        <Text fontSize="$3" color="$soft">
          {t('Every desktop and browser you linked to Hanzo, and what each used.')}
        </Text>
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
        <People range={range} />
      ) : read.is === 'loading' ? (
        <XStack gap="$2" items="center" role="status">
          <Spinner size={16} />
          <Text fontSize="$3" color="$soft">{t('Reading your sources…')}</Text>
        </XStack>
      ) : read.is === 'error' ? (
        <Failed status={read.status} onRetry={() => setBump((n) => n + 1)} />
      ) : (
        <Ready read={read} range={range} onRevoked={() => setBump((n) => n + 1)} />
      )}
    </YStack>
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

function Failed({ status, onRetry }: { status: number; onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <YStack gap="$2" role="alert" data-slot="sources-error">
      <Text fontSize="$3" color="var(--state-error)">
        {status === 401 || status === 403
          ? t('Sign in again to see your linked sources.')
          : status === 0
            ? t('Could not reach Hanzo. Check your connection.')
            : t('Hanzo could not read your linked sources ({status}).', { status })}
      </Text>
      <XStack>
        <Button size="sm" variant="outline" onPress={onRetry}>{t('Try again')}</Button>
      </XStack>
    </YStack>
  )
}

function Ready({ read, range, onRevoked }: { read: Loaded; range: Range; onRevoked: () => void }) {
  const { t } = useI18n()
  const live = read.sources.filter((s) => s.state !== 'revoked')
  if (live.length === 0 && read.sources.length === 0) {
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
          <SourceRow key={s.id} source={s} used={by(s.id)} now={read.at} onRevoked={onRevoked} />
        ))}
      </Section>
      <Providers usage={read.provider} sources={read.sources} now={read.at} range={range} />
      <Models rows={read.model.rows} range={range} />
    </YStack>
  )
}

function Section({ title, slot, children }: { title: string; slot: string; children: React.ReactNode }) {
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
    <Box
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

function SourceRow({ source: s, used, now, onRevoked }: { source: Source; used?: Row; now: Date; onRevoked: () => void }) {
  const { t, locale } = useI18n()
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState(false)
  const revoke = useCallback(async () => {
    setBusy(true)
    setRefused(false)
    try {
      await revokeSource(s.id)
      setAsk(false)
      onRevoked()
    } catch {
      setRefused(true)
    } finally {
      setBusy(false)
    }
  }, [s.id, onRevoked])

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

      {s.providers.length > 0 ? (
        <YStack gap="$1.5" pt="$1">
          {s.providers.map((p) => (
            <XStack key={`${p.provider}/${p.instance}`} gap="$2" items="center" flexWrap="wrap" data-slot="source-provider">
              <Text fontSize="$2" color="$ink">{p.provider}{p.plan ? ` · ${p.plan}` : ''}</Text>
              <Badge variant="secondary" size="sm">{route(p.kind, t)}</Badge>
              <Text fontSize="$1" color="$aside">{p.state.replace(/_/g, ' ')}</Text>
            </XStack>
          ))}
        </YStack>
      ) : s.state !== 'revoked' ? (
        <Text fontSize="$2" color="$aside">{t('No provider accounts reported.')}</Text>
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

function Providers({ usage, sources, now, range }: { usage: Usage; sources: Source[]; now: Date; range: Range }) {
  const { t, locale } = useI18n()
  const names = providers(usage)
  return (
    <Section title={t('Usage by provider · last {n} days', { n: range })} slot="sources-providers">
      {names.length === 0 ? (
        <Text fontSize="$3" color="$soft" data-slot="sources-no-usage">{t('No usage reported in this range.')}</Text>
      ) : (
        names.map((p) => {
          const row = usage.rows.find((r) => r.key === p)
          const snaps = snapshotsFor(usage, p)
          return (
            <YStack key={p} gap="$2" borderWidth={1} borderColor={EDGE} rounded="$3" p="$3.5" data-slot="provider" data-provider={p}>
              <XStack justify="space-between" gap="$2" flexWrap="wrap">
                <Text fontSize="$3" fontWeight="600" color="$ink">{p}</Text>
                {row ? (
                  <Text fontSize="$2" color="$soft" fontVariant={['tabular-nums']}>
                    {t('{tokens} tokens · {cost}', { tokens: compact(tokens(row)), cost: dollars(row.costUsd, locale) })}
                  </Text>
                ) : null}
              </XStack>
              {snaps.map((s) => (
                <Snap key={`${s.sourceId}/${s.provider}`} snap={s} from={named(sources, s.sourceId)} now={now} />
              ))}
            </YStack>
          )
        })
      )}
    </Section>
  )
}

function Snap({ snap, from, now }: { snap: Snapshot; from: string; now: Date }) {
  const { t, locale } = useI18n()
  const c = snap.credits
  return (
    <YStack gap="$1.5" data-slot="snapshot">
      <Text fontSize="$1" color="$aside">
        {from}{snap.plan ? ` · ${snap.plan}` : ''} · {t('updated {when} ago', { when: ago(snap.fetchedAt, now, t) })}
      </Text>
      {snap.error ? <Text fontSize="$2" color="var(--state-error)">{t('The last refresh failed: {code}', { code: snap.error })}</Text> : null}
      {snap.windows.map((w) => {
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

/** An amount in the currency the provider reported; a code Intl does not know is printed as it came. */
function money(n: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n)
  } catch {
    return `${n} ${currency}`
  }
}

/** Tokens and cost by model over the range. The cloud totals a range; it does not split it by day. */
function Models({ rows, range }: { rows: Row[]; range: Range }) {
  const { t, locale } = useI18n()
  if (rows.length === 0) return null
  const sum = total(rows)
  return (
    <Section title={t('Models · last {n} days', { n: range })} slot="sources-models">
      <YStack borderWidth={1} borderColor={EDGE} rounded="$3" overflow="hidden">
        {heaviest(rows).map((r) => (
          <XStack key={r.key} gap="$1.5" columnGap="$3" px="$3.5" py="$2.5" justify="space-between" items="center" flexWrap="wrap" data-slot="model">
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
function People({ range }: { range: Range }) {
  const { t, locale } = useI18n()
  const [read, set] = useState<{ is: 'loading' } | { is: 'error'; status: number } | { is: 'ready'; rows: Row[] }>({ is: 'loading' })
  const [bump, setBump] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    set({ is: 'loading' })
    readUsage('user', range, new Date(), abort.signal)
      .then((u) => set({ is: 'ready', rows: u.rows }))
      .catch((e: Error) => {
        if (e.name !== 'AbortError') set({ is: 'error', status: (e as { status?: number }).status ?? 0 })
      })
    return () => abort.abort()
  }, [range, bump])

  if (read.is === 'loading') return <Spinner size={16} />
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
