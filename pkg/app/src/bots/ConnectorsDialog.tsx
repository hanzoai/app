'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { useIam } from '@hanzo/iam/react'
import { Input, Text, XStack, YStack } from '@hanzo/gui'
import { Dialog, DialogContent, DialogTitle } from '@hanzo/ui'
import { Check, ChevronRight, ExternalLink, Plug, Plus, RefreshCw, Search, X } from 'lucide-react'
import {
  siDropbox,
  siGithub,
  siGooglecalendar,
  siGoogledrive,
  siHubspot,
  siLinear,
  siNotion,
  siQuickbooks,
  siShopify,
  siStripe,
  siSupabase,
} from 'simple-icons'
import { Network } from '../network'
import { api } from '../lib/api'
import { scope } from '../lib/session'
import { enter } from '../lib/destination'
import { slackSyncChannels } from './api'
import { CLIP, PILL, ROUND, WORD } from './kit'
import { DIM, FLOOR, GROUND, INK, LINE, PICKED, RAISED } from './ink'

export type ConnectorFilter = 'all' | 'personal' | 'channels' | 'business' | 'productivity'

type SectionId = 'popular' | 'channels' | 'business' | 'productivity'

interface ConnectorDef {
  id: string
  /** Backend provider id when multiple surfaces share one OAuth provider (e.g. gmail -> google). */
  providerId?: string
  name: string
  description: string
  section: SectionId
  filter: 'channels' | 'business' | 'productivity'
  network?: string
  icon?: { path: string; hex: string }
}

export const CONNECTOR_CATALOG: readonly ConnectorDef[] = [
  // Popular
  { id: 'slack', name: 'Slack', description: 'Sync @hanzo to Slack channels, threads, and workspace DMs', section: 'popular', filter: 'channels', network: 'slack' },
  { id: 'github', name: 'GitHub', description: 'Triage PRs, issues, CI runs, and release flows', section: 'popular', filter: 'productivity', icon: siGithub },
  { id: 'linear', name: 'Linear', description: 'Track issues, cycles, projects, and triage', section: 'popular', filter: 'productivity', icon: siLinear },
  { id: 'gmail', providerId: 'google', name: 'Gmail', description: 'Read, draft, triage, and manage Gmail threads', section: 'popular', filter: 'productivity', network: 'gmail' },
  { id: 'google-drive', providerId: 'google', name: 'Google Drive', description: 'Drive, Docs, Sheets, and Slides', section: 'popular', filter: 'productivity', icon: siGoogledrive },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Reply to customer and team chats on WhatsApp', section: 'popular', filter: 'channels', network: 'whatsapp' },

  // Messaging & Social
  { id: 'discord', name: 'Discord', description: 'Respond in community servers, channels, and threads', section: 'channels', filter: 'channels', network: 'discord' },
  { id: 'telegram', name: 'Telegram', description: 'Run bots across Telegram chats and groups', section: 'channels', filter: 'channels', network: 'telegram' },
  { id: 'teams', name: 'Microsoft Teams', description: 'Join organization channels and enterprise chats', section: 'channels', filter: 'channels', network: 'teams' },
  { id: 'x', name: 'X', description: 'Post updates, monitor mentions, and reply to DMs', section: 'channels', filter: 'channels', network: 'x' },
  { id: 'instagram', name: 'Instagram', description: 'Publish media and answer Instagram messages', section: 'channels', filter: 'channels', network: 'instagram' },
  { id: 'linkedin', name: 'LinkedIn', description: 'Schedule posts and manage company presence', section: 'channels', filter: 'channels', network: 'linkedin' },
  { id: 'signal', name: 'Signal', description: 'Encrypted direct messages and group alerts', section: 'channels', filter: 'channels', network: 'signal' },
  { id: 'zoom', name: 'Zoom', description: 'Join meetings, summaries, and call transcripts', section: 'channels', filter: 'channels', network: 'zoom' },

  // Small Business
  { id: 'stripe', name: 'Stripe', description: 'Accept payments, inspect invoices, and grow revenue', section: 'business', filter: 'business', icon: siStripe },
  { id: 'hubspot', name: 'HubSpot', description: 'Insights to action in HubSpot CRM', section: 'business', filter: 'business', icon: siHubspot },
  { id: 'shopify', name: 'Shopify', description: 'Orders, catalog inventory, and customer support', section: 'business', filter: 'business', icon: siShopify },
  { id: 'dropbox', name: 'Dropbox', description: 'Find, create, and organize shared files', section: 'business', filter: 'business', icon: siDropbox },
  { id: 'quickbooks', name: 'Intuit QuickBooks', description: 'Accounting, invoices, payments, and payroll', section: 'business', filter: 'business', icon: siQuickbooks },

  // Productivity & Developer
  { id: 'notion', name: 'Notion', description: 'Create docs, tasks, and databases', section: 'productivity', filter: 'productivity', icon: siNotion },
  { id: 'supabase', name: 'Supabase', description: 'Manage and query Postgres databases', section: 'productivity', filter: 'productivity', icon: siSupabase },
  { id: 'google-calendar', providerId: 'google', name: 'Google Calendar', description: 'Read availability and schedule events', section: 'productivity', filter: 'productivity', icon: siGooglecalendar },
  { id: 'outlook', providerId: 'microsoft', name: 'Outlook', description: 'Read and send Microsoft 365 mail and invites', section: 'productivity', filter: 'productivity', network: 'outlook' },
]

const SECTIONS: readonly { id: SectionId; title: string }[] = [
  { id: 'popular', title: 'Popular' },
  { id: 'channels', title: 'Messaging & social' },
  { id: 'business', title: 'Small business' },
  { id: 'productivity', title: 'Productivity & developer' },
]

const FILTERS: readonly { id: ConnectorFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'personal', label: 'Connected' },
  { id: 'channels', label: 'Messaging & social' },
  { id: 'business', label: 'Small business' },
  { id: 'productivity', label: 'Productivity' },
]

interface ProviderState {
  connected: boolean
  available?: boolean
  account?: string
  scope?: 'org' | 'user'
  connectionId?: string
}

function backendId(item: ConnectorDef): string {
  return (item.providerId || item.id).toLowerCase()
}

function Mark({ item }: { item: ConnectorDef }) {
  if (item.network) {
    return (
      <YStack width={36} height={36} rounded={10} items="center" justify="center" shrink={0} overflow="hidden">
        <Network transport={item.network} size={36} />
      </YStack>
    )
  }
  if (item.icon) {
    return (
      <YStack
        width={36}
        height={36}
        rounded={10}
        items="center"
        justify="center"
        shrink={0}
        bg={RAISED}
        borderWidth={1}
        borderColor={LINE}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="var(--foreground)" aria-hidden="true">
          <path d={item.icon.path} />
        </svg>
      </YStack>
    )
  }
  return (
    <YStack width={36} height={36} rounded={10} items="center" justify="center" shrink={0} bg={RAISED} borderWidth={1} borderColor={LINE}>
      <Plug size={17} color={INK} aria-hidden />
    </YStack>
  )
}

export function ConnectorsCatalog({
  defaultFilter = 'all',
  embedded = false,
  onClose,
  onConnected,
}: {
  defaultFilter?: ConnectorFilter
  embedded?: boolean
  onClose?: () => void
  onConnected?: () => void
}) {
  const { t } = useI18n()
  const { isAuthenticated, accessToken } = useIam()
  const signed = isAuthenticated && Boolean(accessToken)

  const [filter, setFilter] = useState<ConnectorFilter>(defaultFilter)
  const [query, setQuery] = useState('')
  const [registry, setRegistry] = useState<Record<string, ProviderState>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingOAuth, setPendingOAuth] = useState<string | null>(null)
  const [configuring, setConfiguring] = useState<ConnectorDef | null>(null)
  const [secret, setSecret] = useState('')
  const [statusNote, setStatusNote] = useState<string | null>(null)
  const [syncingSlack, setSyncingSlack] = useState(false)
  const [turn, setTurn] = useState(0)

  const load = useCallback(async () => {
    if (!signed) return
    const headers = scope()
    const next: Record<string, ProviderState> = {}
    const [provRes, connRes] = await Promise.allSettled([
      fetch(`${api()}/v1/provider`, { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${api()}/v1/connection`, { headers }).then((r) => (r.ok ? r.json() : null)),
    ])
    if (provRes.status === 'fulfilled' && provRes.value?.providers) {
      for (const p of provRes.value.providers as Record<string, unknown>[]) {
        const id = String(p.id ?? '').toLowerCase()
        if (!id) continue
        const link = (p.connection ?? {}) as Record<string, unknown>
        next[id] = {
          connected: Boolean(p.connected),
          available: Boolean(p.available),
          account: String(link.account ?? link.label ?? ''),
          scope: 'org',
        }
      }
    }
    if (connRes.status === 'fulfilled' && connRes.value?.connectors) {
      for (const c of connRes.value.connectors as Record<string, unknown>[]) {
        const rawId = String(c.id ?? '')
        const prov = String(c.provider ?? rawId.split(':')[0] ?? '').toLowerCase()
        if (!prov) continue
        next[prov] = {
          connected: true,
          available: next[prov]?.available ?? true,
          account: String(c.account ?? c.label ?? c.name ?? next[prov]?.account ?? ''),
          scope: next[prov]?.connected ? next[prov]?.scope : 'user',
          connectionId: rawId || `${prov}:default`,
        }
      }
    }
    setRegistry(next)
    if (pendingOAuth && next[pendingOAuth]?.connected) {
      setPendingOAuth(null)
      setStatusNote(t('Connected {name}.', { name: pendingOAuth }))
      onConnected?.()
    }
  }, [signed, pendingOAuth, onConnected, t])

  useEffect(() => {
    void load()
  }, [turn, load])

  // Re-check live provider status whenever the user returns from an OAuth popup/tab.
  useEffect(() => {
    if (!signed) return
    const refresh = () => {
      if (document.visibilityState === 'visible') void load()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [signed, load])

  useEffect(() => {
    if (!pendingOAuth || !signed) return
    const timer = window.setInterval(() => void load(), 3000)
    return () => window.clearInterval(timer)
  }, [pendingOAuth, signed, load])

  const stateOf = useCallback(
    (item: ConnectorDef): ProviderState | undefined => registry[item.id] ?? registry[backendId(item)],
    [registry],
  )

  const connectItem = async (item: ConnectorDef) => {
    if (!signed) {
      enter()
      return
    }
    const target = backendId(item)
    const state = stateOf(item)
    setBusyId(item.id)
    setStatusNote(null)

    if (state?.connected) {
      try {
        if (state.scope === 'user' && state.connectionId) {
          await fetch(`${api()}/v1/connection/${encodeURIComponent(state.connectionId)}`, {
            method: 'DELETE',
            headers: scope(),
          }).catch(() => null)
        } else {
          await fetch(`${api()}/v1/provider/${encodeURIComponent(target)}/disconnect`, {
            method: 'POST',
            headers: { ...scope(), 'Content-Type': 'application/json' },
            body: '{}',
          }).catch(() => null)
        }
      } finally {
        await load()
        setBusyId(null)
        onConnected?.()
      }
      return
    }

    try {
      // User-scoped Google / GitHub connectors also expose `/user/connect`.
      const connectPaths =
        target === 'google'
          ? [`/v1/provider/google/connect`, `/v1/provider/google/user/connect`]
          : [`/v1/provider/${encodeURIComponent(target)}/connect`]

      for (const p of connectPaths) {
        const r = await fetch(`${api()}${p}`, {
          method: 'POST',
          headers: { ...scope(), 'Content-Type': 'application/json' },
          body: '{}',
        })
        if (r.ok) {
          const j = (await r.json()) as { authorizeUrl?: string; connected?: boolean }
          if (j.authorizeUrl) {
            window.open(j.authorizeUrl, '_blank', 'noopener,noreferrer')
            setPendingOAuth(target)
            setStatusNote(
              t('Complete {name} authorization in the opened tab — status updates automatically once approved.', {
                name: item.name,
              }),
            )
            return
          }
          if (j.connected) {
            await load()
            onConnected?.()
            return
          }
        }
      }
      setConfiguring(item)
      setSecret('')
    } catch {
      setConfiguring(item)
      setSecret('')
    } finally {
      setBusyId(null)
    }
  }

  const saveCredential = async () => {
    if (!configuring || !secret.trim()) return
    const target = backendId(configuring)
    const token = secret.trim()
    setBusyId(configuring.id)
    setStatusNote(null)
    try {
      let ok = false
      let detail = ''

      // Telegram bot tokens bind directly on the org provider plane (`/v1/provider/telegram/connect`).
      if (target === 'telegram') {
        const r = await fetch(`${api()}/v1/provider/telegram/connect`, {
          method: 'POST',
          headers: { ...scope(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        ok = r.ok
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: { message?: string }; message?: string }
          detail = j.error?.message || j.message || ''
        }
      } else {
        // Try org-scoped apikey connect first, then per-user `/v1/connection/:provider/credential`.
        const orgRes = await fetch(`${api()}/v1/provider/${encodeURIComponent(target)}/connect`, {
          method: 'POST',
          headers: { ...scope(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, apiKey: token }),
        }).catch(() => null)

        if (orgRes?.ok) {
          const j = (await orgRes.json().catch(() => ({}))) as { authorizeUrl?: string }
          if (!j.authorizeUrl) ok = true
        }
        if (!ok) {
          const userRes = await fetch(`${api()}/v1/connection/${encodeURIComponent(target)}/credential`, {
            method: 'POST',
            headers: { ...scope(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: 'default', token }),
          }).catch(() => null)
          ok = Boolean(userRes?.ok)
          if (userRes && !userRes.ok) {
            const j = (await userRes.json().catch(() => ({}))) as { error?: { message?: string }; message?: string }
            detail = j.error?.message || j.message || ''
          }
        }
      }

      if (!ok) {
        setStatusNote(
          detail ||
            t('Could not verify credential for {name}. Check the token or workspace OAuth configuration.', {
              name: configuring.name,
            }),
        )
        return
      }

      await load()
      setStatusNote(t('Connected {name}.', { name: configuring.name }))
      setConfiguring(null)
      setSecret('')
      onConnected?.()
    } finally {
      setBusyId(null)
    }
  }

  const handleSlackSync = async () => {
    setSyncingSlack(true)
    setStatusNote(null)
    try {
      const res = await slackSyncChannels()
      setStatusNote(
        res.ok
          ? res.joined !== undefined
            ? t('Synced @hanzo across {n} Slack channels.', { n: res.joined })
            : t('Synced @hanzo across workspace Slack channels.')
          : t('Could not sync Slack channels. Make sure Slack is connected with org admin permissions.'),
      )
      onConnected?.()
    } finally {
      setSyncingSlack(false)
    }
  }

  useEffect(() => {
    if (embedded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (configuring) {
        e.preventDefault()
        setConfiguring(null)
        return
      }
      onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [embedded, configuring, onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CONNECTOR_CATALOG.filter((item) => {
      const st = stateOf(item)
      if (filter === 'personal' && !st?.connected) return false
      if (filter !== 'all' && filter !== 'personal' && item.filter !== filter) return false
      if (!q) return true
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q) || item.id.includes(q)
    })
  }, [filter, query, stateOf])

  return (
    <YStack flex={1} minH={0} minW={0} bg={embedded ? 'transparent' : GROUND}>
      <YStack
        px={embedded ? 0 : 28}
        pt={embedded ? 0 : 22}
        $max-sm={{ px: embedded ? 0 : 14, pt: embedded ? 0 : 14 }}
        pb={14}
        gap={14}
        borderBottomWidth={1}
        borderColor={LINE}
        bg={embedded ? 'transparent' : FLOOR}
      >
        <XStack items="flex-start" justify="space-between" gap={12} flexWrap="wrap" minW={0}>
          <YStack gap={3} flex={1} minW={200}>
            {embedded ? (
              <Text fontSize={14} lineHeight={20} color={DIM}>
                {t('Sync Slack (@hanzo), GitHub, Linear, and MCP servers so your primary bot and groups act across your stack.')}
              </Text>
            ) : (
              <>
                <DialogTitle>
                  <Text fontSize={21} lineHeight={27} fontWeight="600" color={INK}>
                    {t('Connectors & channels')}
                  </Text>
                </DialogTitle>
                <Text fontSize={13} lineHeight={18} color={DIM}>
                  {t('Add @hanzo to Slack, link repos, and connect tools across every bot and group.')}
                </Text>
              </>
            )}
          </YStack>

          <XStack items="center" gap={8} flexWrap="wrap" $max-sm={{ width: '100%' }}>
            <XStack
              height={34}
              width={220}
              $max-sm={{ flex: 1, width: 'auto', minW: 140, minH: 44 }}
              px={11}
              gap={7}
              items="center"
              rounded={999}
              bg={RAISED}
              borderWidth={1}
              borderColor="var(--border-strong)"
              focusWithinStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
            >
              <Search size={14} color={DIM} aria-hidden />
              <Input
                unstyled
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Search connectors')}
                aria-label={t('Search connectors')}
                flex={1}
                minW={0}
                color={INK}
                fontSize={13}
                placeholderTextColor="$placeholderColor"
              />
              {query ? (
                <XStack
                  render="button"
                  {...{ type: 'button' }}
                  aria-label={t('Clear search')}
                  onClick={() => setQuery('')}
                  bg="transparent"
                  borderWidth={0}
                  p={4}
                  rounded={999}
                  cursor="pointer"
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                >
                  <X size={13} color={DIM} aria-hidden />
                </XStack>
              ) : null}
            </XStack>

            <XStack
              {...ROUND}
              width={34}
              height={34}
              borderColor="var(--border-strong)"
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              $max-sm={{ width: 44, height: 44 }}
              aria-label={t('Refresh connectors')}
              onClick={() => setTurn((n) => n + 1)}
            >
              <RefreshCw size={14} color={DIM} aria-hidden />
            </XStack>

            <XStack
              {...PILL}
              render="button"
              {...{ type: 'button' }}
              height={34}
              $max-sm={{ minH: 44 }}
              px={14}
              bg={INK}
              borderColor={INK}
              hoverStyle={{ opacity: 0.9 }}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              onClick={() =>
                setConfiguring({
                  id: 'openai',
                  name: t('API key credential'),
                  description: t('Store a verified provider API token in KMS'),
                  section: 'productivity',
                  filter: 'productivity',
                })
              }
            >
              <Plus size={13} color="var(--background)" aria-hidden />
              <Text {...WORD} fontSize={13} color="var(--background)">
                {t('Add token')}
              </Text>
            </XStack>

            {onClose ? (
              <XStack
                {...ROUND}
                width={34}
                height={34}
                borderColor="var(--border-strong)"
                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                $max-sm={{ width: 44, height: 44 }}
                aria-label={t('Close connectors')}
                onClick={onClose}
              >
                <X size={15} color={INK} aria-hidden />
              </XStack>
            ) : null}
          </XStack>
        </XStack>

        <XStack items="center" gap={6} flexWrap="wrap">
          {FILTERS.map((f) => {
            const active = filter === f.id
            return (
              <XStack
                key={f.id}
                render="button"
                {...{ type: 'button', 'aria-pressed': active }}
                onClick={() => setFilter(f.id)}
                height={30}
                $max-sm={{ minH: 40 }}
                px={13}
                rounded={999}
                items="center"
                bg={active ? PICKED : 'transparent'}
                borderWidth={1}
                borderColor={active ? 'var(--border-strong)' : 'transparent'}
                cursor="pointer"
                transition="quickest"
                hoverStyle={{ bg: PICKED, borderColor: 'var(--border-strong)' }}
                focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              >
                <Text fontSize={13} lineHeight={18} fontWeight={active ? '500' : '400'} color={active ? INK : DIM}>
                  {t(f.label)}
                </Text>
              </XStack>
            )
          })}
        </XStack>
      </YStack>

      {configuring ? (
        <YStack
          px={embedded ? 0 : 28}
          $max-sm={{ px: embedded ? 0 : 14 }}
          py={14}
          gap={10}
          bg={RAISED}
          borderBottomWidth={1}
          borderColor={LINE}
        >
          <XStack items="center" justify="space-between" gap={10}>
            <XStack items="center" gap={10} flex={1} minW={0}>
              <Mark item={configuring} />
              <YStack flex={1} minW={0}>
                <Text {...CLIP} fontSize={14} lineHeight={19} fontWeight="600" color={INK}>
                  {t('Connect {name}', { name: configuring.name })}
                </Text>
                <Text fontSize={12} lineHeight={17} color={DIM}>
                  {t('Paste an API key or bot token for {name}. Verified live before sealing in KMS.', {
                    name: configuring.name,
                  })}
                </Text>
              </YStack>
            </XStack>
            <XStack
              {...ROUND}
              width={28}
              height={28}
              borderColor="var(--border-strong)"
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              $max-sm={{ width: 44, height: 44 }}
              aria-label={t('Cancel')}
              onClick={() => setConfiguring(null)}
            >
              <X size={14} color={DIM} aria-hidden />
            </XStack>
          </XStack>
          <XStack gap={8} items="center" flexWrap="wrap">
            <Input
              unstyled
              autoFocus
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && secret.trim()) void saveCredential()
              }}
              placeholder={`${configuring.name} token`}
              aria-label={t('{name} credential', { name: configuring.name })}
              flex={1}
              minW={180}
              height={36}
              $max-sm={{ minH: 44 }}
              px={12}
              rounded={9}
              bg={GROUND}
              borderWidth={1}
              borderColor="var(--border-strong)"
              focusStyle={{ borderColor: 'var(--ring)' }}
              color={INK}
              fontSize={13}
              placeholderTextColor="$placeholderColor"
            />
            <XStack
              {...PILL}
              render="button"
              {...{ type: 'button' }}
              height={36}
              $max-sm={{ minH: 44 }}
              px={16}
              bg={INK}
              borderColor={INK}
              opacity={secret.trim() ? 1 : 0.45}
              focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
              onClick={() => void saveCredential()}
            >
              <Text {...WORD} fontSize={13} color="var(--background)">
                {t('Verify & save')}
              </Text>
            </XStack>
          </XStack>
        </YStack>
      ) : null}

      {statusNote ? (
        <XStack
          px={embedded ? 0 : 28}
          $max-sm={{ px: embedded ? 0 : 14 }}
          py={9}
          bg={RAISED}
          borderBottomWidth={1}
          borderColor={LINE}
          items="center"
          justify="space-between"
          gap={8}
        >
          <Text fontSize={12} lineHeight={17} color={INK} flex={1} minW={0}>
            {statusNote}
          </Text>
          <XStack
            render="button"
            {...{ type: 'button' }}
            aria-label={t('Dismiss')}
            onClick={() => setStatusNote(null)}
            bg="transparent"
            borderWidth={0}
            p={4}
            rounded={999}
            cursor="pointer"
            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
          >
            <X size={13} color={DIM} aria-hidden />
          </XStack>
        </XStack>
      ) : null}

      <YStack
        flex={1}
        minH={0}
        overflowY={embedded ? undefined : 'auto'}
        overflowX="hidden"
        px={embedded ? 0 : 28}
        $max-sm={{ px: embedded ? 0 : 14, py: 14 }}
        py={20}
        gap={24}
      >
        {SECTIONS.map((sec) => {
          const items = filtered.filter((i) => i.section === sec.id)
          if (!items.length) return null
          return (
            <YStack key={sec.id} gap={10}>
              <XStack items="center" gap={4}>
                <Text fontSize={13} lineHeight={18} fontWeight="600" color={INK}>
                  {t(sec.title)}
                </Text>
                <ChevronRight size={14} color={DIM} aria-hidden />
              </XStack>

              <XStack flexWrap="wrap" columnGap={24} rowGap={6}>
                {items.map((item) => {
                  const state = stateOf(item)
                  const connected = Boolean(state?.connected)
                  const waiting = pendingOAuth === backendId(item)
                  const busy = busyId === item.id
                  const isSlack = item.id === 'slack'
                  return (
                    <XStack
                      key={item.id}
                      data-connector={item.id}
                      width="calc(50% - 12px)"
                      $max-md={{ width: '100%' }}
                      minW={0}
                      minH={60}
                      px={10}
                      py={8}
                      rounded={12}
                      items="center"
                      flexWrap="wrap"
                      gap={12}
                      transition="quickest"
                      hoverStyle={{ bg: RAISED }}
                    >
                      <Mark item={item} />
                      <YStack flex={1} minW={120} gap={1}>
                        <Text {...CLIP} fontSize={14} lineHeight={19} fontWeight="500" color={INK}>
                          {item.name}
                        </Text>
                        <Text {...CLIP} fontSize={12} lineHeight={17} color={DIM}>
                          {connected && state?.account
                            ? `${t('Connected')} · ${state.account}`
                            : waiting
                              ? t('Waiting for authorization…')
                              : item.description}
                        </Text>
                      </YStack>

                      <XStack items="center" gap={6} flexWrap="wrap" shrink={0}>
                        {isSlack && connected ? (
                          <XStack
                            render="button"
                            {...{ type: 'button' }}
                            disabled={syncingSlack}
                            onClick={() => void handleSlackSync()}
                            height={30}
                            $max-sm={{ minH: 44 }}
                            px={10}
                            rounded={999}
                            items="center"
                            gap={5}
                            bg={RAISED}
                            borderWidth={1}
                            borderColor="var(--border-strong)"
                            cursor="pointer"
                            opacity={syncingSlack ? 0.5 : 1}
                            transition="quickest"
                            hoverStyle={{ bg: PICKED }}
                            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                          >
                            <RefreshCw size={12} color={INK} aria-hidden />
                            <Text fontSize={12} lineHeight={16} fontWeight="500" color={INK}>
                              {syncingSlack ? t('Syncing…') : t('Sync channels')}
                            </Text>
                          </XStack>
                        ) : null}

                        <XStack
                          render="button"
                          {...{ type: 'button' }}
                          aria-label={connected ? t('Disconnect {name}', { name: item.name }) : t('Connect {name}', { name: item.name })}
                          disabled={busy}
                          onClick={() => void connectItem(item)}
                          height={30}
                          $max-sm={{ minH: 44 }}
                          minW={30}
                          px={connected || isSlack ? 11 : 10}
                          rounded={999}
                          items="center"
                          justify="center"
                          gap={5}
                          bg={connected ? PICKED : isSlack ? INK : RAISED}
                          borderWidth={1}
                          borderColor={connected ? 'var(--border-strong)' : isSlack ? INK : 'var(--border-strong)'}
                          cursor="pointer"
                          opacity={busy ? 0.5 : 1}
                          transition="quickest"
                          hoverStyle={{ bg: connected ? PICKED : isSlack ? INK : PICKED, opacity: isSlack && !connected ? 0.9 : 1 }}
                          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                        >
                          {connected ? (
                            <>
                              <Check size={13} color="var(--state-success)" aria-hidden />
                              <Text fontSize={12} lineHeight={16} fontWeight="500" color={INK}>
                                {t('Connected')}
                              </Text>
                            </>
                          ) : isSlack ? (
                            <>
                              <ExternalLink size={12} color="var(--background)" aria-hidden />
                              <Text fontSize={12} lineHeight={16} fontWeight="500" color="var(--background)">
                                {t('Add to Slack')}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Plus size={14} color={INK} aria-hidden />
                              <Text fontSize={12} lineHeight={16} fontWeight="500" color={INK}>
                                {t('Connect')}
                              </Text>
                            </>
                          )}
                        </XStack>
                      </XStack>
                    </XStack>
                  )
                })}
              </XStack>
            </YStack>
          )
        })}

        {filtered.length === 0 ? (
          <YStack py={36} items="center" gap={8}>
            <Text fontSize={14} lineHeight={20} color={DIM} text="center">
              {filter === 'personal' && !query
                ? t('No connectors active yet. Switch to All to add @hanzo to Slack, connect GitHub, Linear, and more.')
                : t('No connectors match “{query}”.', { query })}
            </Text>
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  )
}

export function ConnectorsDialog({
  open,
  onOpenChange,
  defaultFilter = 'all',
  onConnected,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultFilter?: ConnectorFilter
  onConnected?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        width="calc(100vw - 24px)"
        maxW={880}
        $max-sm={{ width: 'calc(100vw - 24px)', maxW: 'calc(100vw - 24px)', rounded: 14 }}
        p={0}
        showCloseButton={false}
        bg={GROUND}
        borderWidth={1}
        borderColor="var(--border-strong)"
        rounded={16}
        overflow="hidden"
      >
        <YStack height="82vh" maxH="86vh" bg={GROUND}>
          <ConnectorsCatalog
            defaultFilter={defaultFilter}
            onClose={() => onOpenChange(false)}
            onConnected={onConnected}
          />
        </YStack>
      </DialogContent>
    </Dialog>
  )
}
