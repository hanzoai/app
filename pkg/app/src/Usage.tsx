'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { Activity, ArrowUpRight } from 'lucide-react'
import { Anchor, Button, Popover, PopoverContent, PopoverTrigger, Progress, Text, XStack, YStack } from '@hanzo/ui'
import { ComposerStatusProvider } from '@hanzo/ui/chat'
import { UsageMeter } from '@hanzo/ui/product/UsageMeter'
import type { UseLimits } from '@hanzo/ui/product/useLimits'
import { label } from '@hanzo/build/plan'
import { showSettings } from './open'
import { hasSession, org, subject, bearer, scope } from './lib/session'
import { fetchCloudUsage, type CloudUsageOverview } from '@hanzo/usage'
import { api } from './lib/api'
import { useHost } from './host'
import { tokensOf, type Tokens } from './lib/tokens'
import { payPage } from './lib/pay'
import { useLimits } from './lib/limits'
import { contextOf, readTokens, subscribeTokens, tokenKey, type Turn } from './lib/tokens'

export interface ContextUsage { model: string; window?: number; messages: readonly Turn[]; draft?: string; tools?: unknown }
/** The account control, shared by Chat, Dev and Studio through the composer slot. */
export function UsageControl({ context, read }: { context?: ContextUsage; read?: UseLimits }) {
  const { t, format } = useI18n()
  const [open, setOpen] = useState(false)
  const currentOrg = org()
  const identity = `${currentOrg}:${subject()}`
  const { path } = useHost()
  const run = path?.match(/^\/dev\/run\/([^/]+)/)?.[1]
  const [account, setAccount] = useState<{ key: string; data?: CloudUsageOverview; error?: string } | null>(null)
  const [runUsage, setRunUsage] = useState<{ key: string; value: Tokens } | null>(null)
  useEffect(() => {
    if (!open || !currentOrg || !bearer()) return
    const abort = new AbortController()
    const scoped: typeof fetch = (input, init) => {
      const headers = new Headers(init?.headers)
      for (const [k, v] of Object.entries(scope())) headers.set(k, v)
      headers.set('X-Org-Id', currentOrg)
      return fetch(input, { ...init, headers })
    }
    const refresh = () => {
      void fetchCloudUsage({ baseUrl: api(), token: bearer()!, range: '30d', org: currentOrg, signal: abort.signal, fetch: scoped }).then(
        (data) => { if (!abort.signal.aborted) setAccount(data.scope?.org === currentOrg && !data.scope.allOrgs ? { key: identity, data } : { key: identity, error: t('Account usage did not match this organization.') }) },
        () => { if (!abort.signal.aborted) setAccount({ key: identity, error: t('Account usage is unavailable. See all usage to retry.') }) },
      )
      if (run) void scoped(`${api()}/v1/agent/sessions/${encodeURIComponent(decodeURIComponent(run))}`, { signal: abort.signal }).then(async (response) => {
        if (!response.ok) return
        const data = await response.json()
        for (const event of [...(data.recent ?? [])].reverse()) {
          let payload = event.payload
          if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { continue } }
          const value = tokensOf(payload?.usage)
          if (value && !abort.signal.aborted) { setRunUsage({ key: `${identity}:${run}`, value }); break }
        }
      }).catch(() => {})
    }
    refresh()
    const timer = setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => { abort.abort(); clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [open, identity, run, t])
  const aggregate = account?.key === identity ? account : null
  // Chat lends its existing read. Other surfaces read only when the popover opens.
  const fallback = useLimits(!read && open && hasSession(), org())
  const usage = read ?? fallback
  const { limits, answered } = usage
  const estimate = context ? contextOf(context.messages, context.draft, context.tools) : null
  const key = context ? tokenKey(org(), context.model, context.messages, subject() ?? '') : ''
  const counted = useSyncExternalStore(subscribeTokens, () => readTokens(key), () => null)
  const tokens = counted ?? (runUsage?.key === `${identity}:${run}` ? runUsage.value : null)
  const capacity = context?.window && context.window > 0 ? context.window : null
  const percent = estimate && capacity ? Math.round(estimate.total / capacity * 100) : null
  const plan = limits?.plan ? label(limits.plan) : null
  const highest = limits ? Math.max(0, ...Object.values(limits.classes).flatMap((c) => c ? [c.percent, ...(c.window ? [c.window.percent] : [])] : [])) : null
  const title = plan ? `${plan.name}${plan.tag ? ` ${plan.tag}` : ''}` : t('Plan usage')
  const toggle = (on: boolean) => { setOpen(on); if (on && read) read.reload() }
  const integer = (n: number) => format.number(n, { maximumFractionDigits: 0 })
  const metric = (name: string, n: number) => <XStack key={name} justify="space-between" gap="$3"><Text fontSize="$2" color="$soft">{name}</Text><Text fontSize="$2" color="$ink" fontVariant={['tabular-nums']}><bdi>{integer(n)}</bdi></Text></XStack>

  return (
    <Popover open={open} onOpenChange={toggle} placement="top-end">
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" px="$2" minW={32} height={32} hitSlop={6}
          aria-label={t('Context, tokens and plan usage')} data-slot="composer-usage">
          <Activity size={15} aria-hidden />
          <Text fontSize="$1" color={highest !== null && highest >= 95 ? '$bad' : '$soft'}>
            {percent !== null ? `${percent}%` : highest !== null ? `${Math.round(highest)}%` : t('Usage')}
          </Text>
        </Button>
      </PopoverTrigger>
      <PopoverContent solid width={360} maxW="calc(100vw - 24px)" maxH="min(680px, calc(100dvh - 100px))" overflowY="auto" aria-label={t('Context, tokens and plan usage')} data-slot="composer-usage-panel">
        <YStack gap="$4" minW={0}>
          <XStack justify="space-between" items="center" gap="$3">
            <Text fontSize="$3" fontWeight="600" color="$ink">{t('Usage')}</Text>
            <Button type="button" size="sm" variant="link" onClick={() => { setOpen(false); showSettings('usage') }} data-slot="composer-see-usage">{t('See all usage')} <ArrowUpRight size={13} /></Button>
          </XStack>
          {context && estimate ? (
            <YStack gap="$2" data-slot="composer-context">
              <XStack justify="space-between" gap="$2"><Text fontSize="$2" fontWeight="600">{t('Context · estimated')}</Text><Text fontSize="$1" color="$soft">{capacity ? t('{used} / {max} tokens', { used: integer(estimate.total), max: integer(capacity) }) : t('{used} tokens', { used: integer(estimate.total) })}</Text></XStack>
              {percent !== null ? <Progress value={Math.min(100, percent)} height={5} aria-label={t('Estimated context used')} indicatorColor={percent >= 90 ? '$bad' : '$good'} /> : null}
              {estimate.rows.filter((r) => r.tokens > 0).map((r) => metric(t(r.name), r.tokens))}
              <Text fontSize="$1" color="$soft">{t('Text estimate; model tokenization and attachments can change the total.')}</Text>
              {!capacity ? <Text fontSize="$1" color="$soft">{t('This model does not report a context capacity.')}</Text> : null}
            </YStack>
          ) : null}
          <YStack gap="$2" data-slot="composer-reported-tokens">
            <Text fontSize="$2" fontWeight="600">{t('Last response · reported tokens')}</Text>
            {tokens ? <>{metric(t('Input'), tokens.input)}{metric(t('Output'), tokens.output)}{tokens.cached !== undefined ? metric(t('Cached input'), tokens.cached) : null}{tokens.reasoning !== undefined ? metric(t('Reasoning'), tokens.reasoning) : null}{metric(t('Total'), tokens.total)}</> : <Text fontSize="$2" color="$soft">{t('No token counts reported for this conversation yet. See all usage for account totals.')}</Text>}
          </YStack>
          <YStack gap="$2" data-slot="composer-account-usage">
            <Text fontSize="$2" fontWeight="600">{t('Account · last 30 days')}</Text>
            {aggregate?.data ? <>{metric(t('Tokens'), aggregate.data.totals.tokens)}{metric(t('Input'), aggregate.data.totals.promptTokens)}{metric(t('Output'), aggregate.data.totals.completionTokens)}{metric(t('Requests'), aggregate.data.totals.requests)}</> : <Text fontSize="$2" color="$soft">{aggregate?.error ?? t('Reading account usage…')}</Text>}
          </YStack>
          <YStack gap="$2" data-slot="composer-plan-usage">
            <Text fontSize="$2" fontWeight="600">{title}</Text>
            {limits ? <UsageMeter limits={limits} size="sm" /> : <Text fontSize="$2" color="$soft">{t(answered ? 'Plan usage is unavailable. Try again.' : 'Reading plan usage…')}</Text>}
            {answered && !limits ? <Button type="button" size="sm" variant="link" onClick={usage.reload}>{t('Retry')}</Button> : null}
          </YStack>
          <XStack gap="$3" justify="space-between" flexWrap="wrap">
            <Button asChild size="sm"><Anchor href={payPage('/cart')} data-slot="composer-upgrade">{t('Upgrade plan')}</Anchor></Button>
            <Button asChild size="sm" variant="outline"><Anchor href={payPage('/amount/card')} data-slot="composer-buy-credits">{t('Buy credits')}</Anchor></Button>
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
