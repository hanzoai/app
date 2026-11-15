'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { useIam } from '@hanzo/iam/react'
import { Input, Text, XStack, YStack } from '@hanzo/gui'
import { Dialog, DialogContent, DialogTitle } from '@hanzo/ui'
import { Check, ChevronRight, Plug, Plus, RefreshCw, Search, X } from 'lucide-react'
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
import { useKept } from '../kept'
import { Network } from '../network'
import { api } from '../lib/api'
import { scope } from '../lib/session'
import { enter } from '../lib/destination'
import { CLIP, PILL, ROUND, WORD } from './kit'
import { DIM, FLOOR, GROUND, INK, LINE, PICKED, RAISED } from './ink'

export type ConnectorFilter = 'all' | 'personal' | 'channels' | 'business' | 'productivity'

type SectionId = 'popular' | 'channels' | 'business' | 'productivity'

interface ConnectorDef {
  id: string
  name: string
  description: string
  section: SectionId
  filter: 'channels' | 'business' | 'productivity'
  network?: string
  icon?: { path: string; hex: string }
}

export const CONNECTOR_CATALOG: readonly ConnectorDef[] = [
  // Popular
  { id: 'gmail', name: 'Gmail', description: 'Read, draft, triage, and manage Gmail threads', section: 'popular', filter: 'productivity', network: 'gmail' },
  { id: 'google-drive', name: 'Google Drive', description: 'Drive, Docs, Sheets, and Slides', section: 'popular', filter: 'productivity', icon: siGoogledrive },
  { id: 'slack', name: 'Slack', description: 'Answer channels, threads, and workspace DMs', section: 'popular', filter: 'channels', network: 'slack' },
  { id: 'github', name: 'GitHub', description: 'Triage PRs, issues, CI runs, and release flows', section: 'popular', filter: 'productivity', icon: siGithub },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Reply to customer and team chats on WhatsApp', section: 'popular', filter: 'channels', network: 'whatsapp' },
  { id: 'supabase', name: 'Supabase', description: 'Manage and query Postgres databases', section: 'popular', filter: 'productivity', icon: siSupabase },

  // Messaging & Social
  { id: 'telegram', name: 'Telegram', description: 'Run bots across Telegram chats and groups', section: 'channels', filter: 'channels', network: 'telegram' },
  { id: 'discord', name: 'Discord', description: 'Respond in community servers, channels, and threads', section: 'channels', filter: 'channels', network: 'discord' },
  { id: 'x', name: 'X', description: 'Post updates, monitor mentions, and reply to DMs', section: 'channels', filter: 'channels', network: 'x' },
  { id: 'instagram', name: 'Instagram', description: 'Publish media and answer Instagram messages', section: 'channels', filter: 'channels', network: 'instagram' },
  { id: 'linkedin', name: 'LinkedIn', description: 'Schedule posts and manage company presence', section: 'channels', filter: 'channels', network: 'linkedin' },
  { id: 'teams', name: 'Microsoft Teams', description: 'Join organization channels and enterprise chats', section: 'channels', filter: 'channels', network: 'teams' },
  { id: 'signal', name: 'Signal', description: 'Encrypted direct messages and group alerts', section: 'channels', filter: 'channels', network: 'signal' },
  { id: 'zoom', name: 'Zoom', description: 'Join meetings, summaries, and call transcripts', section: 'channels', filter: 'channels', network: 'zoom' },

  // Small Business
  { id: 'dropbox', name: 'Dropbox', description: 'Find, create, and organize shared files', section: 'business', filter: 'business', icon: siDropbox },
  { id: 'quickbooks', name: 'Intuit QuickBooks', description: 'Accounting, invoices, payments, and payroll', section: 'business', filter: 'business', icon: siQuickbooks },
  { id: 'hubspot', name: 'HubSpot', description: 'Insights to action in HubSpot CRM', section: 'business', filter: 'business', icon: siHubspot },
  { id: 'stripe', name: 'Stripe', description: 'Accept payments, inspect invoices, and grow revenue', section: 'business', filter: 'business', icon: siStripe },
  { id: 'shopify', name: 'Shopify', description: 'Orders, catalog inventory, and customer support', section: 'business', filter: 'business', icon: siShopify },

  // Productivity & Developer
  { id: 'notion', name: 'Notion', description: 'Create docs, tasks, and databases', section: 'productivity', filter: 'productivity', icon: siNotion },
  { id: 'google-calendar', name: 'Google Calendar', description: 'Read availability and schedule events', section: 'productivity', filter: 'productivity', icon: siGooglecalendar },
  { id: 'linear', name: 'Linear', description: 'Track issues, cycles, projects, and triage', section: 'productivity', filter: 'productivity', icon: siLinear },
  { id: 'outlook', name: 'Outlook', description: 'Read and send Microsoft 365 mail and invites', section: 'productivity', filter: 'productivity', network: 'outlook' },
]

const SECTIONS: readonly { id: SectionId; title: string }[] = [
  { id: 'popular', title: 'Popular' },
  { id: 'channels', title: 'Messaging & Social' },
  { id: 'business', title: 'Small Business' },
  { id: 'productivity', title: 'Productivity & Developer' },
]

const FILTERS: readonly { id: ConnectorFilter; label: string }[] = [
  { id: 'all', label: 'Public' },
  { id: 'personal', label: 'Personal' },
  { id: 'channels', label: 'Messaging & Social' },
  { id: 'business', label: 'Small Business' },
  { id: 'productivity', label: 'Productivity' },
]

interface ProviderState {
  connected: boolean
  available?: boolean
  account?: string
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
  const [localSaved, setLocalSaved] = useKept<Record<string, ProviderState>>('hanzo.connectors.v1', {})
  const [remoteRegistry, setRemoteRegistry] = useState<Record<string, ProviderState>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [configuring, setConfiguring] = useState<ConnectorDef | null>(null)
  const [secret, setSecret] = useState('')
  const [statusNote, setStatusNote] = useState<string | null>(null)
  const [turn, setTurn] = useState(0)

  const registry = useMemo<Record<string, ProviderState>>(
    () => ({ ...(localSaved ?? {}), ...remoteRegistry }),
    [localSaved, remoteRegistry],
  )

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
        }
      }
    }
    if (connRes.status === 'fulfilled' && connRes.value?.connectors) {
      for (const c of connRes.value.connectors as Record<string, unknown>[]) {
        const id = String(c.provider ?? c.id ?? '').toLowerCase()
        if (!id) continue
        next[id] = {
          connected: true,
          available: next[id]?.available ?? true,
          account: String(c.account ?? c.name ?? next[id]?.account ?? ''),
        }
      }
    }
    setRemoteRegistry(next)
  }, [signed])

  useEffect(() => {
    void load()
  }, [turn, load])

  const connectItem = async (item: ConnectorDef) => {
    if (!signed) {
      enter()
      return
    }
    const state = registry[item.id]
    setBusyId(item.id)
    setStatusNote(null)
    if (state?.connected) {
      try {
        await fetch(`${api()}/v1/provider/${encodeURIComponent(item.id)}/disconnect`, {
          method: 'POST',
          headers: { ...scope(), 'Content-Type': 'application/json' },
          body: '{}',
        }).catch(() => null)
      } finally {
        const copy = { ...(localSaved ?? {}) }
        delete copy[item.id]
        setLocalSaved(copy)
        setRemoteRegistry((prev) => {
          const next = { ...prev }
          delete next[item.id]
          return next
        })
        setBusyId(null)
        onConnected?.()
      }
      return
    }

    try {
      const r = await fetch(`${api()}/v1/provider/${encodeURIComponent(item.id)}/connect`, {
        method: 'POST',
        headers: { ...scope(), 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (r.ok) {
        const j = (await r.json()) as { authorizeUrl?: string }
        if (j.authorizeUrl) {
          window.open(j.authorizeUrl, '_blank', 'noopener,noreferrer')
        }
        setLocalSaved({ ...(localSaved ?? {}), [item.id]: { connected: true } })
        setTurn((n) => n + 1)
        onConnected?.()
        return
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
    setBusyId(configuring.id)
    setStatusNote(null)
    try {
      const r = await fetch(`${api()}/v1/connection`, {
        method: 'POST',
        headers: { ...scope(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: configuring.id,
          name: configuring.name,
          token: secret.trim(),
        }),
      }).catch(() => null)
      setLocalSaved({
        ...(localSaved ?? {}),
        [configuring.id]: { connected: true, available: true },
      })
      setStatusNote(
        r?.ok
          ? t('Connected {name}.', { name: configuring.name })
          : t('Connected {name} for this workspace.', { name: configuring.name }),
      )
      setConfiguring(null)
      setSecret('')
      onConnected?.()
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CONNECTOR_CATALOG.filter((item) => {
      if (filter === 'personal' && !registry[item.id]?.connected) return false
      if (filter !== 'all' && filter !== 'personal' && item.filter !== filter) return false
      if (!q) return true
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q) || item.id.includes(q)
    })
  }, [filter, query, registry])

  return (
    <YStack flex={1} minH={0} bg={embedded ? 'transparent' : GROUND}>
      <YStack
        px={embedded ? 0 : 28}
        pt={embedded ? 0 : 22}
        pb={14}
        gap={14}
        borderBottomWidth={1}
        borderColor={LINE}
        bg={embedded ? 'transparent' : FLOOR}
      >
        <XStack items="center" justify="space-between" gap={12} flexWrap="wrap">
          <YStack gap={3}>
            {embedded ? (
              <Text fontSize={14} lineHeight={20} color={DIM}>
                {t('Connect external apps, socials, and MCP servers to work across your tools.')}
              </Text>
            ) : (
              <>
                <DialogTitle>
                  <Text fontSize={21} lineHeight={27} fontWeight="600" color={INK}>
                    {t('Connectors')}
                  </Text>
                </DialogTitle>
                <Text fontSize={13} lineHeight={18} color={DIM}>
                  {t('Connect external apps, socials, and channels to work across your tools.')}
                </Text>
              </>
            )}
          </YStack>

          <XStack items="center" gap={8}>
            <XStack
              height={34}
              width={220}
              px={11}
              gap={7}
              items="center"
              rounded={999}
              bg={RAISED}
              borderWidth={1}
              borderColor={LINE}
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
                  p={0}
                  cursor="pointer"
                >
                  <X size={13} color={DIM} aria-hidden />
                </XStack>
              ) : null}
            </XStack>

            <XStack
              {...ROUND}
              width={34}
              height={34}
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
              px={14}
              bg={INK}
              borderColor={INK}
              onClick={() =>
                setConfiguring({
                  id: 'custom-mcp',
                  name: t('Custom MCP Server'),
                  description: t('Connect any Model Context Protocol URL or bearer token'),
                  section: 'productivity',
                  filter: 'productivity',
                })
              }
            >
              <Plus size={13} color="var(--background)" aria-hidden />
              <Text {...WORD} fontSize={13} color="var(--background)">
                {t('Add')}
              </Text>
            </XStack>

            {onClose ? (
              <XStack {...ROUND} width={34} height={34} aria-label={t('Close connectors')} onClick={onClose}>
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
                px={13}
                rounded={999}
                items="center"
                bg={active ? PICKED : 'transparent'}
                borderWidth={1}
                borderColor={active ? LINE : 'transparent'}
                cursor="pointer"
                hoverStyle={{ bg: PICKED }}
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
        <YStack px={embedded ? 0 : 28} py={14} gap={10} bg={RAISED} borderBottomWidth={1} borderColor={LINE}>
          <XStack items="center" justify="space-between" gap={10}>
            <XStack items="center" gap={10}>
              <Mark item={configuring} />
              <YStack>
                <Text fontSize={14} lineHeight={19} fontWeight="600" color={INK}>
                  {t('Connect {name}', { name: configuring.name })}
                </Text>
                <Text fontSize={12} lineHeight={17} color={DIM}>
                  {configuring.id === 'custom-mcp'
                    ? t('Enter an MCP server URL (https://…) or bearer credential.')
                    : t('Paste an API key, webhook URL, or bot token for {name}.', { name: configuring.name })}
                </Text>
              </YStack>
            </XStack>
            <XStack {...ROUND} width={28} height={28} aria-label={t('Cancel')} onClick={() => setConfiguring(null)}>
              <X size={14} color={DIM} aria-hidden />
            </XStack>
          </XStack>
          <XStack gap={8} items="center">
            <Input
              unstyled
              autoFocus
              type={configuring.id === 'custom-mcp' ? 'url' : 'password'}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={configuring.id === 'custom-mcp' ? 'https://mcp.example.com/sse' : `${configuring.name} API key or token`}
              aria-label={t('{name} credential', { name: configuring.name })}
              flex={1}
              height={36}
              px={12}
              rounded={9}
              bg={GROUND}
              borderWidth={1}
              borderColor={LINE}
              color={INK}
              fontSize={13}
              placeholderTextColor="$placeholderColor"
            />
            <XStack
              {...PILL}
              render="button"
              {...{ type: 'button' }}
              height={36}
              px={16}
              bg={INK}
              borderColor={INK}
              opacity={secret.trim() ? 1 : 0.45}
              onClick={() => void saveCredential()}
            >
              <Text {...WORD} fontSize={13} color="var(--background)">
                {t('Connect')}
              </Text>
            </XStack>
          </XStack>
        </YStack>
      ) : null}

      {statusNote ? (
        <XStack px={embedded ? 0 : 28} py={9} bg={RAISED} borderBottomWidth={1} borderColor={LINE} items="center" justify="space-between">
          <Text fontSize={12} lineHeight={17} color={DIM}>
            {statusNote}
          </Text>
          <XStack render="button" {...{ type: 'button' }} onClick={() => setStatusNote(null)} bg="transparent" borderWidth={0} cursor="pointer">
            <X size={13} color={DIM} aria-hidden />
          </XStack>
        </XStack>
      ) : null}

      <YStack flex={1} minH={0} overflowY={embedded ? undefined : 'auto'} px={embedded ? 0 : 28} py={20} gap={24}>
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
                  const state = registry[item.id]
                  const connected = Boolean(state?.connected)
                  const busy = busyId === item.id
                  return (
                    <XStack
                      key={item.id}
                      data-connector={item.id}
                      width="calc(50% - 12px)"
                      $max-md={{ width: '100%' }}
                      minH={56}
                      px={10}
                      py={8}
                      rounded={12}
                      items="center"
                      gap={12}
                      hoverStyle={{ bg: RAISED }}
                    >
                      <Mark item={item} />
                      <YStack flex={1} minW={0} gap={1}>
                        <Text {...CLIP} fontSize={14} lineHeight={19} fontWeight="500" color={INK}>
                          {item.name}
                        </Text>
                        <Text {...CLIP} fontSize={12} lineHeight={17} color={DIM}>
                          {connected && state?.account ? `${t('Connected')} · ${state.account}` : item.description}
                        </Text>
                      </YStack>
                      <XStack
                        render="button"
                        {...{ type: 'button' }}
                        aria-label={connected ? t('Disconnect {name}', { name: item.name }) : t('Connect {name}', { name: item.name })}
                        disabled={busy}
                        onClick={() => void connectItem(item)}
                        height={30}
                        minW={30}
                        px={connected ? 10 : 0}
                        rounded={999}
                        items="center"
                        justify="center"
                        gap={5}
                        bg={connected ? PICKED : 'transparent'}
                        borderWidth={connected ? 1 : 0}
                        borderColor={LINE}
                        cursor="pointer"
                        opacity={busy ? 0.5 : 1}
                        hoverStyle={{ bg: PICKED }}
                      >
                        {connected ? (
                          <>
                            <Check size={13} color={INK} aria-hidden />
                            <Text fontSize={12} lineHeight={16} fontWeight="500" color={INK}>
                              {t('Connected')}
                            </Text>
                          </>
                        ) : (
                          <Plus size={17} color={DIM} aria-hidden />
                        )}
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
            <Text fontSize={14} lineHeight={20} color={DIM}>
              {filter === 'personal' && !query
                ? t('No personal connectors connected yet. Switch to Public to connect Slack, Stripe, Gmail, GitHub, and more.')
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
        width="94vw"
        maxW={880}
        p={0}
        showCloseButton={false}
        bg={GROUND}
        borderWidth={1}
        borderColor={LINE}
        rounded={16}
        overflow="hidden"
      >
        <YStack maxH="86vh" bg={GROUND}>
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
