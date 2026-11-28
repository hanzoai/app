'use client'

// The machines & providers view: every machine and browser a person linked to
// Hanzo, every AI provider each detected, and what they used. One component for
// every surface; the host passes a client and says where it runs. It holds no
// credential and reports nothing: metadata only, never prompts or code.

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
import { RANGES, type Choice, type Machine, type Range, type Row, type Surface } from './types'

const EDGE = 'var(--border-strong)'

/** Where a signed-out person goes. IAM owns sign-in; the host's origin decides nothing here. */
export const SIGN_IN = 'https://hanzo.ai/login'

/** Where a web user downloads Hanzo Desktop to track local providers across machines. */
export const DOWNLOAD_APP = 'https://hanzo.ai/download'

export interface MachinesViewProps {
  client: Client
  /** Where this view runs: decides which provider accounts are usable here. */
  surface: Surface
  /** The machine id of the device this surface runs on, when it is a linked one. */
  deviceId?: string
  /** An org admin: adds the People tab, per-user totals only. */
  admin?: boolean
  /** Makes provider rows choosable: the picker contract. */
  onPick?: (pick: Picked) => void
  /** The provider in use, marked on its row. */
  selected?: Choice | null
  signIn?: string
  downloadApp?: string
}

export function MachinesView({ client, surface, deviceId, admin, onPick, selected, signIn = SIGN_IN, downloadApp = DOWNLOAD_APP }: MachinesViewProps) {
  const { t } = useI18n()
  const [range, setRange] = useState<Range>(7)
  const [bump, setBump] = useState(0)
  const [tab, setTab] = useState<'mine' | 'people'>('mine')
  const read = useRead(client, range, bump)

  if (!client.signedIn()) return <SignedOut href={signIn} />

  return (
    <YStack gap="$5" data-slot="machines">
      <YStack gap="$1.5">
        <Text fontSize="$3" color="$soft">{t('Every machine and browser you linked to Hanzo, and what each used.')}</Text>
        <Text fontSize="$2" color="$aside" data-slot="machines-copy">
          {t('Only metadata is reported: token counts, cost and plan limits. Never your prompts, replies or code. A subscription login stays on the device that holds it.')}
        </Text>
      </YStack>

      <XStack gap="$3" items="center" justify="space-between" flexWrap="wrap">
        {admin ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v === 'people' ? 'people' : 'mine')}>
            <TabsList>
              <TabsTrigger value="mine">{t('Your machines')}</TabsTrigger>
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
        <Ready read={read} client={client} surface={surface} deviceId={deviceId} range={range} onPick={onPick} selected={selected} downloadApp={downloadApp} onRevoked={() => setBump((n) => n + 1)} />
      )}
    </YStack>
  )
}

export function SignedOut({ href }: { href: string }) {
  const { t } = useI18n()
  return (
    <YStack gap="$2" data-slot="machines-signed-out">
      <Text fontSize="$3" color="$soft">{t('Sign in to see your linked machines.')}</Text>
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
      <Text fontSize="$3" color="$soft">{t('Reading your machines…')}</Text>
    </XStack>
  )
}

function RangePicker({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  const { t } = useI18n()
  return (
    <Tabs value={String(range)} onValueChange={(v) => onChange(Number(v) === 30 ? 30 : 7)} data-slot="machines-range" aria-label={t('Range')}>
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
    <YStack gap="$2" role="alert" data-slot="machines-error">
      <Text fontSize="$3" color="var(--state-error)">
        {denied
          ? t('Sign in again to see your linked machines.')
          : status === 0
            ? t('Could not reach Hanzo. Check your connection.')
            : t('Hanzo could not read your linked machines ({status}).', { status })}
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
  downloadApp,
  onRevoked,
}: {
  read: Loaded
  client: Client
  surface: Surface
  deviceId?: string
  range: Range
  onPick?: (pick: Picked) => void
  selected?: Choice | null
  downloadApp: string
  onRevoked: () => void
}) {
  const { t } = useI18n()
  if (read.machines.length === 0 && read.accounts.length === 0) {
    return (
      <YStack gap="$3" borderWidth={1} borderColor={EDGE} rounded="$3" p="$4" data-slot="machines-empty">
        <YStack gap="$1.5">
          <Text fontSize="$4" fontWeight="600" color="$ink">{t('Nothing is linked yet')}</Text>
          <Text fontSize="$3" color="$soft">
            {t('Download Hanzo Desktop (or run hanzo link on a server) to link a machine and report unified provider usage here.')}
          </Text>
        </YStack>
        <XStack gap="$2" flexWrap="wrap">
          <Button size="sm" variant="primary" render={<a href={downloadApp} target="_blank" rel="noopener noreferrer" />} data-slot="machines-download">
            {t('Download Hanzo Desktop')}
          </Button>
        </XStack>
      </YStack>
    )
  }
  const by = (id: string) => read.machine.rows.find((r) => r.key === id)
  return (
    <YStack gap="$6">
      <Section
        title={t('Linked machines')}
        slot="machines-list"
        action={
          surface === 'web' ? (
            <Button size="sm" variant="outline" render={<a href={downloadApp} target="_blank" rel="noopener noreferrer" />} data-slot="machines-download">
              {t('Download Hanzo Desktop')}
            </Button>
          ) : undefined
        }
      >
        {ordered(read.machines).map((m) => (
          <MachineRow key={m.id} client={client} machine={m} used={by(m.id)} now={read.at} onRevoked={onRevoked} />
        ))}
      </Section>
      <Section title={t('Providers')} slot="machines-accounts">
        {read.accounts.length === 0 ? (
          <Text fontSize="$3" color="$soft">{t('No provider accounts reported.')}</Text>
        ) : null}
        <Accounts accounts={read.accounts} machines={read.machines} usage={read.provider} surface={surface} deviceId={deviceId} now={read.at} selected={selected} onPick={onPick} />
      </Section>
      <Totals title={t('Usage by provider · last {n} days', { n: range })} slot="machines-providers" rows={read.provider.rows} />
      <Totals title={t('Models · last {n} days', { n: range })} slot="machines-models" rows={read.model.rows} model />
    </YStack>
  )
}

export function Section({ title, slot, action, children }: { title: string; slot: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <YStack gap="$2.5" data-slot={slot}>
      <XStack gap="$2" items="center" justify="space-between" flexWrap="wrap">
        <Text fontSize="$4" fontWeight="600" color="$ink" render="h3">{title}</Text>
        {action ?? null}
      </XStack>
      {children}
    </YStack>
  )
}

function Dot({ state }: { state: Machine['state'] }) {
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

function kindLabel(kind: Machine['kind'], t: ReturnType<typeof useI18n>['t']): string {
  if (kind === 'browser') return t('Browser')
  if (kind === 'gpu') return t('GPU')
  if (kind === 'cloud_compute') return t('Cloud VM')
  if (kind === 'byo') return t('Fleet node')
  return t('Machine')
}

function MachineRow({ client, machine: m, used, now, onRevoked }: { client: Client; machine: Machine; used?: Row; now: Date; onRevoked: () => void }) {
  const { t, locale } = useI18n()
  const [ask, setAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState(false)
  const revoke = useCallback(async () => {
    setBusy(true)
    setRefused(false)
    try {
      await client.revoke(m.id)
      setAsk(false)
      onRevoked()
    } catch {
      setRefused(true)
    } finally {
      setBusy(false)
    }
  }, [client, m.id, onRevoked])

  const revocable = m.state !== 'revoked' && m.origin !== 'cloud' && m.origin !== 'byo'
  const seen = m.state === 'online' ? t('online now') : m.last_seen ? t('last seen {when} ago', { when: ago(m.last_seen, now, t) }) : t('never seen')
  return (
    <YStack gap="$2" borderWidth={1} borderColor={EDGE} rounded="$3" p="$3.5" data-slot="machine" data-id={m.id} data-state={m.state}>
      <XStack gap="$2.5" items="center" justify="space-between" flexWrap="wrap">
        <XStack gap="$2.5" items="center" flex={1} minW={0}>
          <Dot state={m.state} />
          <YStack flex={1} minW={0}>
            <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>{m.name}</Text>
            <Text fontSize="$2" color="$aside">
              {[kindLabel(m.kind, t), m.gpu, m.os, m.version].filter(Boolean).join(' · ')} · {seen}
            </Text>
          </YStack>
        </XStack>
        {revocable ? (
          <Button size="sm" variant="outline" aria-label={t('Revoke {name}', { name: m.name })} onPress={() => setAsk(true)}>
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
            <AlertDialogTitle>{t('Revoke {name}?', { name: m.name })}</AlertDialogTitle>
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
        <Text fontSize="$3" color="$soft" data-slot="machines-no-usage">{t('No usage reported in this range.')}</Text>
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

/** An org admin's per-person totals: counts and cost, never another person's machines or providers. */
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
    <Section title={t('People · last {n} days', { n: range })} slot="machines-people">
      <Text fontSize="$2" color="$aside">{t('Totals only. An admin never sees another person’s machines, plans or labels.')}</Text>
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
