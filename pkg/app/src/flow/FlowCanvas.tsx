'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Text } from '@hanzo/ui'
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  GitBranch,
  Link2,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Webhook,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  describeCron,
  type FlowEdge,
  type FlowNode,
  type FlowNodeKind,
  type FlowStepResult,
} from './types'

export const NODE_WIDTH = 236
export const NODE_HEIGHT = 112
const GRID_STEP = 16

function snap(value: number): number {
  return Math.max(16, Math.round(value / GRID_STEP) * GRID_STEP)
}

function kindMeta(kind: FlowNodeKind): { label: string; Icon: typeof Zap } {
  switch (kind) {
    case 'trigger':
      return { label: 'Trigger', Icon: Zap }
    case 'schedule':
      return { label: 'Schedule', Icon: CalendarClock }
    case 'agent':
      return { label: 'Enso Agent', Icon: Bot }
    case 'condition':
      return { label: 'Condition', Icon: GitBranch }
    case 'action':
      return { label: 'Action', Icon: Send }
  }
}

function nodeSubtitle(node: FlowNode): string {
  if (node.kind === 'agent') {
    return `${node.config.model || 'enso'} · ${(node.config.prompt || '').slice(0, 42) || 'Prompt configured'}`
  }
  if (node.kind === 'schedule') {
    return describeCron(node.config.cron || '0 8 * * 1-5').human
  }
  if (node.kind === 'condition') {
    return `Rule: ${node.config.expression || 'non-empty'}`
  }
  if (node.kind === 'action') {
    if (node.subtype === 'email') return `Email → ${node.config.to || 'recipient'}`
    if (node.subtype === 'sms') return `SMS → ${node.config.to || 'number'}`
    if (node.subtype === 'crm_update') return `CRM · ${node.config.crmEntity || 'contact'}`
    return `${node.config.method || 'POST'} ${node.config.url || 'webhook'}`
  }
  return node.description || (node.subtype === 'webhook' ? 'Webhook trigger' : 'Manual trigger')
}

export function FlowCanvas({
  nodes,
  edges,
  selectedNodeId,
  stepResults,
  onSelectNode,
  onMoveNode,
  onAddNode,
  onConnectNodes,
  onDeleteEdge,
  onDeleteNode,
  onAutoLayout,
}: {
  nodes: readonly FlowNode[]
  edges: readonly FlowEdge[]
  selectedNodeId: string | null
  stepResults: ReadonlyMap<string, FlowStepResult>
  onSelectNode: (nodeId: string | null) => void
  onMoveNode: (nodeId: string, x: number, y: number) => void
  onAddNode: (kind: FlowNodeKind) => void
  onConnectNodes: (sourceId: string, targetId: string) => void
  onDeleteEdge: (edgeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onAutoLayout: () => void
}) {
  const { t } = useI18n()
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragOriginRef = useRef<{
    nodeId: string
    startClientX: number
    startClientY: number
    origX: number
    origY: number
  } | null>(null)

  useEffect(() => {
    if (!draggingId) return
    const onMove = (e: PointerEvent) => {
      const origin = dragOriginRef.current
      if (!origin) return
      const dx = e.clientX - origin.startClientX
      const dy = e.clientY - origin.startClientY
      onMoveNode(origin.nodeId, snap(origin.origX + dx), snap(origin.origY + dy))
    }
    const onUp = () => {
      dragOriginRef.current = null
      setDraggingId(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [draggingId, onMoveNode])

  const startDrag = useCallback(
    (node: FlowNode, e: { clientX?: number; clientY?: number; button?: number; stopPropagation?: () => void }) => {
      if (e.button !== undefined && e.button !== 0) return
      e.stopPropagation?.()
      onSelectNode(node.id)
      dragOriginRef.current = {
        nodeId: node.id,
        startClientX: e.clientX ?? 0,
        startClientY: e.clientY ?? 0,
        origX: node.position.x,
        origY: node.position.y,
      }
      setDraggingId(node.id)
    },
    [onSelectNode],
  )

  const handleNodeClick = useCallback(
    (nodeId: string, e?: { stopPropagation?: () => void }) => {
      e?.stopPropagation?.()
      if (connectingFrom) {
        if (connectingFrom !== nodeId) {
          onConnectNodes(connectingFrom, nodeId)
        }
        setConnectingFrom(null)
        return
      }
      onSelectNode(nodeId)
    },
    [connectingFrom, onConnectNodes, onSelectNode],
  )

  const boardSize = useMemo(() => {
    let maxX = 1120
    let maxY = 460
    for (const n of nodes) {
      maxX = Math.max(maxX, n.position.x + NODE_WIDTH + 96)
      maxY = Math.max(maxY, n.position.y + NODE_HEIGHT + 96)
    }
    return { width: maxX, height: maxY }
  }, [nodes])

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const edgePaths = useMemo(() => {
    return edges
      .map((edge) => {
        const src = nodeById.get(edge.source)
        const dst = nodeById.get(edge.target)
        if (!src || !dst) return null
        const x1 = src.position.x + NODE_WIDTH
        const y1 = src.position.y + NODE_HEIGHT / 2
        const x2 = dst.position.x
        const y2 = dst.position.y + NODE_HEIGHT / 2
        const dx = Math.max(48, Math.abs(x2 - x1) * 0.45)
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
        const midX = (x1 + x2) / 2
        const midY = (y1 + y2) / 2
        return { edge, d, midX, midY }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [edges, nodeById])

  const paletteKinds: readonly { kind: FlowNodeKind; label: string; Icon: typeof Zap }[] = [
    { kind: 'trigger', label: t('Trigger'), Icon: Webhook },
    { kind: 'schedule', label: t('Schedule'), Icon: CalendarClock },
    { kind: 'agent', label: t('Enso Agent'), Icon: Sparkles },
    { kind: 'condition', label: t('Condition'), Icon: GitBranch },
    { kind: 'action', label: t('Action'), Icon: Send },
  ]

  return (
    <YStack flex={1} minW={0} minH={0} bg="$background" data-slot="flow-canvas-shell">
      {/* Add-step palette & canvas actions */}
      <XStack
        data-slot="flow-palette"
        px="$3"
        py="$2"
        gap="$1.5"
        items="center"
        justify="space-between"
        flexWrap="wrap"
        borderBottomWidth={1}
        borderColor="$edge"
        shrink={0}
      >
        <XStack items="center" gap="$1.5" flexWrap="wrap">
          <Text fontSize="$1" color="$quiet" pr="$1">
            {t('Add step')}
          </Text>
          {paletteKinds.map(({ kind, label, Icon }) => (
            <Button
              key={kind}
              size="sm"
              variant="outline"
              data-slot={`flow-add-${kind}`}
              onPress={() => onAddNode(kind)}
            >
              <Plus size={12} aria-hidden />
              <Icon size={13} aria-hidden />
              {label}
            </Button>
          ))}
        </XStack>
        <XStack items="center" gap="$2">
          {connectingFrom ? (
            <XStack items="center" gap="$1.5" px="$2.5" py="$1" rounded="$3" bg="$raised">
              <Link2 size={13} aria-hidden />
              <Text fontSize="$1" color="$ink">
                {t('Click a target step to connect')}
              </Text>
              <XStack
                render="button"
                aria-label={t('Cancel connect')}
                onClick={() => setConnectingFrom(null)}
                px="$1.5"
                py={2}
                rounded="$2"
                cursor="pointer"
                hoverStyle={{ bg: '$hover' }}
              >
                <Text fontSize="$1" color="$soft">
                  {t('Cancel')}
                </Text>
              </XStack>
            </XStack>
          ) : null}
          <Button size="sm" variant="ghost" data-slot="flow-auto-layout" onPress={onAutoLayout}>
            {t('Auto-layout')}
          </Button>
        </XStack>
      </XStack>

      {/* Scrollable interactive graph viewport */}
      <YStack
        flex={1}
        minW={0}
        minH={0}
        overflowX="auto"
        overflowY="auto"
        position="relative"
        bg="var(--background)"
        data-slot="flow-canvas"
        onClick={() => {
          if (connectingFrom) setConnectingFrom(null)
          else onSelectNode(null)
        }}
      >
        <YStack
          position="relative"
          width={boardSize.width}
          height={boardSize.height}
          minW="100%"
          minH="100%"
        >
          {/* SVG connections layer */}
          <YStack
            position="absolute"
            t={0}
            l={0}
            width={boardSize.width}
            height={boardSize.height}
            pointerEvents="none"
          >
            <svg
              width={boardSize.width}
              height={boardSize.height}
              viewBox={`0 0 ${boardSize.width} ${boardSize.height}`}
              fill="none"
              aria-hidden
            >
              {edgePaths.map(({ edge, d }) => {
                const isHighlighted =
                  edge.source === selectedNodeId || edge.target === selectedNodeId
                return (
                  <path
                    key={edge.id}
                    d={d}
                    stroke={isHighlighted ? 'var(--foreground)' : 'var(--muted-foreground)'}
                    strokeWidth={isHighlighted ? 2 : 1.5}
                    strokeOpacity={isHighlighted ? 0.9 : 0.45}
                    fill="none"
                  />
                )
              })}
            </svg>
          </YStack>

          {/* Interactive edge badges for quick disconnect */}
          {edgePaths.map(({ edge, midX, midY }) => (
            <XStack
              key={`badge-${edge.id}`}
              render="button"
              aria-label={t('Remove connection')}
              data-slot={`flow-edge-${edge.id}`}
              position="absolute"
              l={Math.round(midX - 18)}
              t={Math.round(midY - 11)}
              px="$1.5"
              py={2}
              rounded="$2"
              bg="var(--card)"
              borderWidth={1}
              borderColor="$edge"
              items="center"
              justify="center"
              cursor="pointer"
              opacity={0.75}
              hoverStyle={{ opacity: 1, borderColor: 'var(--border-strong)', bg: '$raised' }}
              onClick={(e: { stopPropagation: () => void }) => {
                e.stopPropagation()
                onDeleteEdge(edge.id)
              }}
            >
              <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                {edge.label ? `${edge.label} ×` : '×'}
              </Text>
            </XStack>
          ))}

          {/* Draggable workflow nodes */}
          {nodes.map((node) => {
            const { label, Icon } = kindMeta(node.kind)
            const selected = node.id === selectedNodeId
            const isConnectSource = connectingFrom === node.id
            const isConnectTarget = Boolean(connectingFrom && connectingFrom !== node.id)
            const step = stepResults.get(node.id)
            return (
              <YStack
                key={node.id}
                data-slot="flow-node"
                data-flow-node={node.id}
                data-selected={selected ? 'true' : undefined}
                position="absolute"
                l={node.position.x}
                t={node.position.y}
                width={NODE_WIDTH}
                minH={NODE_HEIGHT}
                p="$3"
                rounded="$4"
                bg={selected ? '$raised' : 'var(--card)'}
                borderWidth={1}
                borderColor={
                  isConnectSource || selected
                    ? 'var(--border-selected)'
                    : isConnectTarget
                      ? 'var(--border-strong)'
                      : '$edge'
                }
                gap="$1.5"
                cursor={draggingId === node.id ? 'grabbing' : 'grab'}
                z={selected ? 'var(--z-raised)' : 'var(--z-base)'}
                hoverStyle={{ borderColor: 'var(--border-strong)' }}
                onClick={(e: { stopPropagation: () => void }) => handleNodeClick(node.id, e)}
                {...({
                  onPointerDown: (e: PointerEvent) => startDrag(node, e),
                } as object)}
              >
                <XStack items="center" justify="space-between" gap="$2">
                  <XStack items="center" gap="$1.5" flex={1} minW={0}>
                    <XStack
                      width={22}
                      height={22}
                      rounded="$2"
                      bg="$hover"
                      items="center"
                      justify="center"
                      shrink={0}
                    >
                      <Icon size={13} aria-hidden />
                    </XStack>
                    <Text fontSize="$1" fontWeight="500" color="$quiet" numberOfLines={1}>
                      {label}
                    </Text>
                  </XStack>
                  <XStack items="center" gap="$1" shrink={0}>
                    {step?.status === 'running' ? (
                      <Loader2 size={13} color="var(--foreground)" aria-hidden />
                    ) : step?.status === 'success' ? (
                      <CheckCircle2 size={13} color="var(--state-online)" aria-hidden />
                    ) : step?.status === 'error' ? (
                      <XCircle size={13} color="var(--state-error)" aria-hidden />
                    ) : null}
                    <XStack
                      render="button"
                      aria-label={t('Connect from this step')}
                      data-slot={`flow-connect-${node.id}`}
                      width={22}
                      height={22}
                      rounded="$2"
                      items="center"
                      justify="center"
                      bg={isConnectSource ? '$raised' : 'transparent'}
                      cursor="pointer"
                      hoverStyle={{ bg: '$hover' }}
                      onClick={(e: { stopPropagation: () => void }) => {
                        e.stopPropagation()
                        setConnectingFrom((cur) => (cur === node.id ? null : node.id))
                      }}
                    >
                      <Link2 size={12} aria-hidden />
                    </XStack>
                    {nodes.length > 1 ? (
                      <XStack
                        render="button"
                        aria-label={t('Delete step')}
                        data-slot={`flow-delete-${node.id}`}
                        width={22}
                        height={22}
                        rounded="$2"
                        items="center"
                        justify="center"
                        bg="transparent"
                        cursor="pointer"
                        hoverStyle={{ bg: '$hover' }}
                        onClick={(e: { stopPropagation: () => void }) => {
                          e.stopPropagation()
                          onDeleteNode(node.id)
                        }}
                      >
                        <Trash2 size={12} aria-hidden />
                      </XStack>
                    ) : null}
                  </XStack>
                </XStack>

                <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1}>
                  {node.title}
                </Text>

                <Text fontSize="$1" color="$soft" numberOfLines={2}>
                  {nodeSubtitle(node)}
                </Text>

                {step?.durationMs ? (
                  <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                    {step.status === 'error' ? 'Failed' : `${step.durationMs}ms`}
                  </Text>
                ) : null}
              </YStack>
            )
          })}
        </YStack>
      </YStack>
    </YStack>
  )
}
