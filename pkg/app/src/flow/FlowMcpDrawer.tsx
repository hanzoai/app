'use client'

import { useCallback, useMemo, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Text } from '@hanzo/ui'
import { Check, Copy, Server, ShieldCheck, Terminal, X } from 'lucide-react'
import { buildFlowMcpConfig } from './api'
import { isStickyNoteNode, type FlowDefinition } from './types'

export function FlowMcpDrawer({
  flow,
  orgId,
  onClose,
}: {
  flow: FlowDefinition
  orgId?: string | null
  onClose: () => void
}) {
  const { t } = useI18n()
  const [copiedField, setCopiedField] = useState<'json' | 'curl' | 'url' | null>(null)

  const mcp = useMemo(() => buildFlowMcpConfig(flow, orgId), [flow, orgId])
  const runnableNodes = useMemo(
    () => flow.nodes.filter((n) => !isStickyNoteNode(n)),
    [flow.nodes],
  )

  const copyText = useCallback(async (text: string, field: 'json' | 'curl' | 'url') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField((cur) => (cur === field ? null : cur)), 1800)
    } catch {
      // clipboard unavailable in restricted environments
    }
  }, [])

  return (
    <YStack
      data-slot="flow-mcp-drawer"
      position="absolute"
      t={0}
      r={0}
      b={0}
      width={460}
      maxW="100%"
      z="var(--z-modal)"
      bg="var(--card)"
      borderInlineStartWidth={1}
      borderColor="var(--border-strong)"
    >
      {/* Header */}
      <XStack
        px="$4"
        py="$3"
        items="center"
        justify="space-between"
        borderBottomWidth={1}
        borderColor="$edge"
        shrink={0}
      >
        <XStack items="center" gap="$2.5" minW={0} flex={1}>
          <XStack
            width={28}
            height={28}
            rounded="$2"
            bg="$raised"
            borderWidth={1}
            borderColor="$edge"
            items="center"
            justify="center"
            shrink={0}
          >
            <Server size={14} color="var(--foreground)" aria-hidden />
          </XStack>
          <YStack minW={0} flex={1}>
            <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
              {t('MCP Server')} · {mcp.serverName}
            </Text>
            <Text fontSize="$1" color="$quiet" fontFamily="$mono" numberOfLines={1}>
              Streamable HTTP · Hanzo IAM Bearer
            </Text>
          </YStack>
        </XStack>
        <XStack
          render="button"
          aria-label={t('Close MCP Server panel')}
          data-slot="flow-mcp-close"
          onClick={onClose}
          width={28}
          height={28}
          rounded="$2"
          items="center"
          justify="center"
          cursor="pointer"
          hoverStyle={{ bg: '$hover' }}
        >
          <X size={15} aria-hidden />
        </XStack>
      </XStack>

      {/* Scrollable Body */}
      <YStack flex={1} minH={0} overflowY="auto" p="$4" gap="$4">
        {/* Auth assurance banner */}
        <XStack
          p="$3"
          rounded="$3"
          bg="var(--surface-card)"
          borderWidth={1}
          borderColor="$edge"
          items="flex-start"
          gap="$2.5"
        >
          <ShieldCheck size={16} color="var(--state-online)" aria-hidden />
          <YStack flex={1} gap="$1">
            <Text fontSize="$2" fontWeight="600" color="$ink">
              {t('Authenticated via Hanzo IAM')}
            </Text>
            <Text fontSize="$1" color="$soft">
              {t('Expose this flow as a canonical Streamable HTTP MCP tool server using your Hanzo IAM Bearer token. One auth plane — no external API keys required.')}
            </Text>
          </YStack>
        </XStack>

        {/* Canonical Endpoints */}
        <YStack gap="$2">
          <Text fontSize="$2" fontWeight="600" color="$ink">
            {t('Streamable HTTP Endpoints')}
          </Text>

          <YStack p="$3" rounded="$3" borderWidth={1} borderColor="$edge" bg="$background" gap="$2">
            <XStack items="center" justify="space-between" gap="$2">
              <Text fontSize="$1" color="$quiet">
                {t('Flow MCP Endpoint')}
              </Text>
              <Button
                size="sm"
                variant="ghost"
                data-slot="flow-mcp-copy-url"
                onPress={() => void copyText(mcp.endpointUrl, 'url')}
              >
                {copiedField === 'url' ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                {copiedField === 'url' ? t('Copied') : t('Copy')}
              </Button>
            </XStack>
            <Text fontSize="$1" fontFamily="$mono" color="$ink" data-slot="flow-mcp-endpoint">
              {mcp.endpointUrl}
            </Text>

            <YStack pt="$2" borderTopWidth={1} borderColor="$edge" gap="$1">
              <Text fontSize="$1" color="$quiet">
                {t('Flow Studio MCP URL')}
              </Text>
              <Text fontSize="$1" fontFamily="$mono" color="$soft">
                {mcp.studioMcpUrl}
              </Text>
            </YStack>

            <YStack pt="$2" borderTopWidth={1} borderColor="$edge" gap="$1">
              <Text fontSize="$1" color="$quiet">
                {t('Hanzo Cloud Fleet MCP')}
              </Text>
              <Text fontSize="$1" fontFamily="$mono" color="$soft">
                {mcp.cloudMcpUrl}
              </Text>
            </YStack>
          </YStack>
        </YStack>

        {/* MCP Client JSON Config */}
        <YStack gap="$2">
          <XStack items="center" justify="space-between" gap="$2">
            <Text fontSize="$2" fontWeight="600" color="$ink">
              {t('MCP Client Configuration')}
            </Text>
            <Button
              size="sm"
              variant="outline"
              data-slot="flow-mcp-copy-json"
              onPress={() => void copyText(mcp.clientJson, 'json')}
            >
              {copiedField === 'json' ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
              {copiedField === 'json' ? t('Copied JSON') : t('Copy JSON')}
            </Button>
          </XStack>

          <YStack
            data-slot="flow-mcp-json"
            p="$3"
            rounded="$3"
            borderWidth={1}
            borderColor="$edge"
            bg="$background"
            overflowX="auto"
          >
            <Text
              fontSize="$1"
              fontFamily="$mono"
              color="$ink"
              $platform-web={{ whiteSpace: 'pre' }}
            >
              {mcp.clientJson}
            </Text>
          </YStack>
        </YStack>

        {/* Direct Run API (cURL) */}
        <YStack gap="$2">
          <XStack items="center" justify="space-between" gap="$2">
            <XStack items="center" gap="$1.5">
              <Terminal size={13} color="var(--muted-foreground)" aria-hidden />
              <Text fontSize="$2" fontWeight="600" color="$ink">
                {t('Direct Run API')}
              </Text>
            </XStack>
            <Button
              size="sm"
              variant="outline"
              data-slot="flow-mcp-copy-curl"
              onPress={() => void copyText(mcp.curlExample, 'curl')}
            >
              {copiedField === 'curl' ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
              {copiedField === 'curl' ? t('Copied cURL') : t('Copy cURL')}
            </Button>
          </XStack>

          <YStack
            data-slot="flow-mcp-curl"
            p="$3"
            rounded="$3"
            borderWidth={1}
            borderColor="$edge"
            bg="$background"
            overflowX="auto"
          >
            <Text
              fontSize="$1"
              fontFamily="$mono"
              color="$soft"
              $platform-web={{ whiteSpace: 'pre' }}
            >
              {mcp.curlExample}
            </Text>
          </YStack>
        </YStack>

        {/* Exposed Flow Graph Summary */}
        <YStack gap="$2">
          <Text fontSize="$2" fontWeight="600" color="$ink">
            {t('Exposed Pipeline Steps')} ({runnableNodes.length})
          </Text>
          <XStack gap="$1.5" flexWrap="wrap">
            {runnableNodes.map((n) => (
              <Text
                key={n.id}
                fontSize="$1"
                fontFamily="$mono"
                color="$soft"
                px="$2"
                py="$1"
                rounded="$2"
                borderWidth={1}
                borderColor="$edge"
                bg="$background"
              >
                {n.title}
              </Text>
            ))}
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  )
}
