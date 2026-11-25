'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Text } from '@hanzo/ui'
import {
  CheckCircle2,
  LayoutGrid,
  Link2,
  Loader2,
  Lock,
  Map as MapIcon,
  Maximize2,
  Minus,
  Plus,
  StickyNote,
  Trash2,
  Unlock,
  XCircle,
} from 'lucide-react'
import { FLOW_DRAG_MIME } from './FlowPalette'
import { HanzoMark, iconForSubtype } from './icons'
import {
  componentSpecFor,
  describeCron,
  isModelExecutionNode,
  isStickyNoteNode,
  type FlowEdge,
  type FlowNode,
  type FlowNodeSubtype,
  type FlowPosition,
  type FlowStepResult,
} from './types'

export const NODE_WIDTH = 256
export const NODE_HEIGHT = 128
export const NOTE_WIDTH = 276
export const NOTE_HEIGHT = 176
const GRID_STEP = 16
const MIN_ZOOM = 0.4
const MAX_ZOOM = 1.85

function snap(value: number): number {
  return Math.round(value / GRID_STEP) * GRID_STEP
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function nodeDimensions(node: FlowNode): { width: number; height: number } {
  if (isStickyNoteNode(node)) return { width: NOTE_WIDTH, height: NOTE_HEIGHT }
  const spec = componentSpecFor(node)
  const portRows = Math.max(spec.inputs.length, spec.outputs.length)
  return { width: NODE_WIDTH, height: portRows > 1 ? 148 : NODE_HEIGHT }
}

function portOffsetY(node: FlowNode, side: 'input' | 'output', handleId?: string): number {
  const { height } = nodeDimensions(node)
  const spec = componentSpecFor(node)
  const ports = side === 'input' ? spec.inputs : spec.outputs
  if (ports.length <= 1) return Math.round(height * 0.56)
  const idx = handleId
    ? Math.max(
        0,
        ports.findIndex((p) => p.id === handleId),
      )
    : 0
  const base = Math.round(height * 0.48)
  return base + idx * 28
}

function nodeSubtitle(node: FlowNode): string {
  if (isStickyNoteNode(node)) return node.config.noteBody || 'Click to edit README note'
  if (isModelExecutionNode(node)) {
    return `${node.config.model || 'enso'} · ${(node.config.prompt || '').slice(0, 46) || 'Enso prompt configured'}`
  }
  if (node.kind === 'schedule' || node.subtype === 'cron_schedule') {
    return describeCron(node.config.cron || '0 8 * * 1-5').human
  }
  if (node.kind === 'condition' || node.subtype === 'guardrail') {
    return `Rule: ${node.config.expression || 'non-empty'}`
  }
  if (node.subtype === 'api_request' || node.subtype === 'http_request') {
    return `${node.config.method || 'GET'} ${node.config.url || 'https://…'}`
  }
  if (node.subtype === 'url_fetch') return node.config.url || 'URL fetch'
  if (node.subtype === 'web_search') return `Query: ${node.config.query || '{{input}}'}`
  if (node.subtype === 'sql_query') return node.config.query || 'SQL query'
  if (node.subtype === 'embeddings' || node.subtype === 'embedding') {
    return `${node.config.model === 'zen-embedding' ? 'zen-embedding' : 'zen-embedding-3'} · /v1/embeddings`
  }
  if (node.subtype === 'knowledge_ingestion' || node.subtype === 'knowledge_ingest') {
    return `${node.config.collection || 'workspace-kb'} · /v1/knowledge/import`
  }
  if (
    node.subtype === 'knowledge_retrieval' ||
    node.subtype === 'knowledge_search' ||
    node.subtype === 'retriever' ||
    node.subtype === 'vector_store'
  ) {
    return `${node.config.collection || 'workspace-kb'} · top-${node.config.topK ?? 5} · /v1/knowledge/search`
  }
  if (node.subtype === 'hanzo_kms_secret') return `KMS: ${node.config.secretPath || '/prod/flow/...'}`
  if (node.subtype === 'hanzo_mail' || node.subtype === 'email') return `Mail → ${node.config.to || 'recipient'}`
  if (node.subtype === 'hanzo_post') return `Post → ${node.config.channel || '#updates'}`
  if (node.subtype === 'crm_update') return `CRM · ${node.config.crmEntity || 'contact'}`
  if (node.subtype === 'prompt_template') return (node.config.prompt || '{{input}}').slice(0, 56)
  return node.description || componentSpecFor(node).description
}

export function FlowCanvas({
  nodes,
  edges,
  selectedNodeId,
  stepResults,
  onSelectNode,
  onMoveNode,
  onDropComponent,
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
  onDropComponent: (subtype: FlowNodeSubtype, position: FlowPosition) => void
  onConnectNodes: (sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string) => void
  onDeleteEdge: (edgeId: string) => void
  onDeleteNode: (nodeId: string) => void
  onAutoLayout: () => void
}) {
  const { t } = useI18n()
  const patternId = useId().replace(/:/g, '')
  const viewportRef = useRef<HTMLDivElement | null>(null)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 24, y: 24 })
  const [locked, setLocked] = useState(false)
  const [showMinimap, setShowMinimap] = useState(true)

  const [connecting, setConnecting] = useState<{
    sourceId: string
    sourceHandle: string
    x: number
    y: number
    dragging: boolean
  } | null>(null)

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [panning, setPanning] = useState(false)

  const dragOriginRef = useRef<{
    nodeId: string
    startClientX: number
    startClientY: number
    origX: number
    origY: number
  } | null>(null)

  const panOriginRef = useRef<{
    startClientX: number
    startClientY: number
    origPanX: number
    origPanY: number
  } | null>(null)

  const clientToWorld = useCallback(
    (clientX: number, clientY: number): FlowPosition => {
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return { x: 80, y: 80 }
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom,
      }
    },
    [pan.x, pan.y, zoom],
  )

  // Node drag tracking
  useEffect(() => {
    if (!draggingId) return
    const onMove = (e: PointerEvent) => {
      const origin = dragOriginRef.current
      if (!origin) return
      const dx = (e.clientX - origin.startClientX) / zoom
      const dy = (e.clientY - origin.startClientY) / zoom
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
  }, [draggingId, onMoveNode, zoom])

  // Canvas background pan tracking
  useEffect(() => {
    if (!panning) return
    const onMove = (e: PointerEvent) => {
      const origin = panOriginRef.current
      if (!origin) return
      setPan({
        x: origin.origPanX + (e.clientX - origin.startClientX),
        y: origin.origPanY + (e.clientY - origin.startClientY),
      })
    }
    const onUp = () => {
      panOriginRef.current = null
      setPanning(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [panning])

  // Live drag-to-connect wire tracking
  useEffect(() => {
    if (!connecting?.dragging) return
    const onMove = (e: PointerEvent) => {
      const world = clientToWorld(e.clientX, e.clientY)
      setConnecting((cur) => (cur ? { ...cur, x: world.x, y: world.y } : null))
    }
    const onUp = () => {
      setConnecting((cur) => (cur?.dragging ? null : cur))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [connecting?.dragging, clientToWorld])

  const startNodeDrag = useCallback(
    (node: FlowNode, e: { clientX?: number; clientY?: number; button?: number; stopPropagation?: () => void }) => {
      if (e.button !== undefined && e.button !== 0) return
      e.stopPropagation?.()
      onSelectNode(node.id)
      if (locked) return
      dragOriginRef.current = {
        nodeId: node.id,
        startClientX: e.clientX ?? 0,
        startClientY: e.clientY ?? 0,
        origX: node.position.x,
        origY: node.position.y,
      }
      setDraggingId(node.id)
    },
    [locked, onSelectNode],
  )

  const startCanvasPan = useCallback(
    (e: { clientX?: number; clientY?: number; button?: number }) => {
      if (e.button !== undefined && e.button !== 0) return
      if (locked) return
      panOriginRef.current = {
        startClientX: e.clientX ?? 0,
        startClientY: e.clientY ?? 0,
        origPanX: pan.x,
        origPanY: pan.y,
      }
      setPanning(true)
    },
    [locked, pan.x, pan.y],
  )

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.08 : 0.92
      setZoom((z) => Number(clamp(z * factor, MIN_ZOOM, MAX_ZOOM).toFixed(2)))
    }
  }, [])

  const handleFitView = useCallback(() => {
    if (nodes.length === 0) {
      setZoom(1)
      setPan({ x: 24, y: 24 })
      return
    }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      const dim = nodeDimensions(n)
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + dim.width)
      maxY = Math.max(maxY, n.position.y + dim.height)
    }
    const rect = viewportRef.current?.getBoundingClientRect()
    const vw = rect?.width || 960
    const vh = rect?.height || 560
    const contentW = Math.max(300, maxX - minX + 120)
    const contentH = Math.max(240, maxY - minY + 140)
    const nextZoom = Number(clamp(Math.min(vw / contentW, vh / contentH), 0.45, 1.15).toFixed(2))
    const nextPanX = Math.round((vw - (maxX - minX) * nextZoom) / 2 - minX * nextZoom)
    const nextPanY = Math.round((vh - (maxY - minY) * nextZoom) / 2 - minY * nextZoom)
    setZoom(nextZoom)
    setPan({ x: nextPanX, y: nextPanY })
  }, [nodes])

  const completeConnection = useCallback(
    (targetId: string, targetHandle?: string) => {
      if (!connecting) return
      if (connecting.sourceId !== targetId) {
        onConnectNodes(connecting.sourceId, targetId, connecting.sourceHandle, targetHandle || 'input')
      }
      setConnecting(null)
    },
    [connecting, onConnectNodes],
  )

  const worldBounds = useMemo(() => {
    let minX = 0
    let minY = 0
    let maxX = 1440
    let maxY = 760
    for (const n of nodes) {
      const dim = nodeDimensions(n)
      minX = Math.min(minX, n.position.x - 80)
      minY = Math.min(minY, n.position.y - 80)
      maxX = Math.max(maxX, n.position.x + dim.width + 160)
      maxY = Math.max(maxY, n.position.y + dim.height + 160)
    }
    return { minX, minY, width: Math.max(1200, maxX - minX), height: Math.max(640, maxY - minY) }
  }, [nodes])

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  const edgePaths = useMemo(() => {
    return edges
      .map((edge) => {
        const src = nodeById.get(edge.source)
        const dst = nodeById.get(edge.target)
        if (!src || !dst) return null
        const srcDim = nodeDimensions(src)
        const x1 = src.position.x + srcDim.width
        const y1 = src.position.y + portOffsetY(src, 'output', edge.sourceHandle)
        const x2 = dst.position.x
        const y2 = dst.position.y + portOffsetY(dst, 'input', edge.targetHandle)
        const dx = Math.max(56, Math.abs(x2 - x1) * 0.45)
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
        const midX = (x1 + x2) / 2
        const midY = (y1 + y2) / 2
        return { edge, d, midX, midY }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [edges, nodeById])

  const previewWire = useMemo(() => {
    if (!connecting?.dragging) return null
    const src = nodeById.get(connecting.sourceId)
    if (!src) return null
    const srcDim = nodeDimensions(src)
    const x1 = src.position.x + srcDim.width
    const y1 = src.position.y + portOffsetY(src, 'output', connecting.sourceHandle)
    const x2 = connecting.x
    const y2 = connecting.y
    const dx = Math.max(48, Math.abs(x2 - x1) * 0.45)
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
  }, [connecting, nodeById])

  const gridStepScaled = Math.max(12, 24 * zoom)
  const dotRadius = Math.max(0.85, Math.min(1.8, 1.15 * Math.sqrt(zoom)))
  const dotOffsetX = ((pan.x % gridStepScaled) + gridStepScaled) % gridStepScaled
  const dotOffsetY = ((pan.y % gridStepScaled) + gridStepScaled) % gridStepScaled

  return (
    <YStack
      ref={viewportRef as never}
      flex={1}
      minW={0}
      minH={0}
      position="relative"
      overflow="hidden"
      bg="var(--background)"
      data-slot="flow-canvas"
      cursor={panning ? 'grabbing' : locked ? 'default' : 'grab'}
      onClick={() => {
        if (connecting) setConnecting(null)
        else onSelectNode(null)
      }}
      {...({
        onPointerDown: (e: PointerEvent) => startCanvasPan(e),
        onWheel: handleWheel,
        onDragOver: (e: DragEvent) => {
          e.preventDefault()
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault()
          const subtype = (e.dataTransfer?.getData(FLOW_DRAG_MIME) || e.dataTransfer?.getData('text/plain')) as
            | FlowNodeSubtype
            | ''
          if (!subtype) return
          const pos = clientToWorld(e.clientX, e.clientY)
          onDropComponent(subtype, { x: snap(pos.x - NODE_WIDTH / 2), y: snap(pos.y - NODE_HEIGHT / 2) })
        },
      } as object)}
    >
      {/* Crisp OLED dot-matrix background tracking pan & zoom smoothly */}
      <YStack
        data-slot="flow-dot-grid"
        position="absolute"
        t={0}
        l={0}
        r={0}
        b={0}
        pointerEvents="none"
      >
        <svg width="100%" height="100%" aria-hidden>
          <defs>
            <pattern
              id={`flow-dots-${patternId}`}
              width={gridStepScaled}
              height={gridStepScaled}
              x={dotOffsetX}
              y={dotOffsetY}
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx={dotRadius + 0.5}
                cy={dotRadius + 0.5}
                r={dotRadius}
                fill="var(--muted-foreground)"
                fillOpacity={0.34}
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#flow-dots-${patternId})`} />
        </svg>
      </YStack>

      {/* Connecting banner hint */}
      {connecting ? (
        <XStack
          position="absolute"
          t="$3"
          l="$3"
          z="var(--z-raised)"
          items="center"
          gap="$2"
          px="$3"
          py="$1.5"
          rounded="$3"
          bg="var(--surface-overlay)"
          borderWidth={1}
          borderColor="var(--border-strong)"
          onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
        >
          <Link2 size={13} aria-hidden />
          <Text fontSize="$1" color="$ink">
            {t('Drop on or click a target port to connect')}
          </Text>
          <XStack
            render="button"
            onClick={() => setConnecting(null)}
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

      {/* Transformed infinite canvas world */}
      <YStack
        position="absolute"
        t={0}
        l={0}
        width={worldBounds.width}
        height={worldBounds.height}
        $platform-web={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* SVG smooth bezier edges layer */}
        <YStack
          position="absolute"
          t={0}
          l={0}
          width={worldBounds.width}
          height={worldBounds.height}
          pointerEvents="none"
        >
          <svg
            width={worldBounds.width}
            height={worldBounds.height}
            viewBox={`0 0 ${worldBounds.width} ${worldBounds.height}`}
            fill="none"
            aria-hidden
          >
            {edgePaths.map(({ edge, d }) => {
              const isHighlighted =
                edge.source === selectedNodeId || edge.target === selectedNodeId
              const srcStep = stepResults.get(edge.source)
              const isActiveRun = srcStep?.status === 'running' || srcStep?.status === 'success'
              return (
                <path
                  key={edge.id}
                  d={d}
                  stroke={
                    isActiveRun
                      ? 'var(--state-online)'
                      : isHighlighted
                        ? 'var(--foreground)'
                        : 'var(--muted-foreground)'
                  }
                  strokeWidth={isHighlighted || isActiveRun ? 2.2 : 1.6}
                  strokeOpacity={isHighlighted || isActiveRun ? 0.92 : 0.48}
                  strokeDasharray={edge.sourceHandle === 'tools' || edge.targetHandle === 'tools' ? '5 4' : undefined}
                  fill="none"
                />
              )
            })}
            {previewWire ? (
              <path
                d={previewWire}
                stroke="var(--foreground)"
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeOpacity={0.8}
                fill="none"
              />
            ) : null}
          </svg>
        </YStack>

        {/* Interactive edge disconnect badges */}
        {edgePaths.map(({ edge, midX, midY }) => (
          <XStack
            key={`badge-${edge.id}`}
            render="button"
            aria-label={t('Remove connection')}
            data-slot={`flow-edge-${edge.id}`}
            position="absolute"
            l={Math.round(midX - 22)}
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
            opacity={edge.label ? 0.92 : 0.72}
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

        {/* Draggable workflow nodes & Sticky Note README cards */}
        {nodes.map((node) => {
          const isNote = isStickyNoteNode(node)
          const spec = componentSpecFor(node)
          const Icon = isNote ? StickyNote : iconForSubtype(node)
          const dim = nodeDimensions(node)
          const selected = node.id === selectedNodeId
          const step = stepResults.get(node.id)

          if (isNote) {
            return (
              <YStack
                key={node.id}
                data-slot="flow-sticky-note"
                data-flow-node={node.id}
                data-selected={selected ? 'true' : undefined}
                position="absolute"
                l={node.position.x}
                t={node.position.y}
                width={dim.width}
                minH={dim.height}
                p="$3.5"
                rounded="$4"
                bg="var(--surface-card-quiet)"
                borderWidth={1}
                borderStyle="dashed"
                borderColor={selected ? 'var(--border-selected)' : 'var(--border-strong)'}
                gap="$2"
                cursor={locked ? 'pointer' : draggingId === node.id ? 'grabbing' : 'grab'}
                z={selected ? 'var(--z-raised)' : 'var(--z-base)'}
                onClick={(e: { stopPropagation: () => void }) => {
                  e.stopPropagation()
                  onSelectNode(node.id)
                }}
                {...({
                  onPointerDown: (e: PointerEvent) => startNodeDrag(node, e),
                } as object)}
              >
                <XStack items="center" justify="space-between" gap="$2">
                  <XStack items="center" gap="$1.5">
                    <StickyNote size={13} color="var(--muted-foreground)" aria-hidden />
                    <Text fontSize="$1" fontWeight="600" color="$ink">
                      {node.title}
                    </Text>
                  </XStack>
                  {nodes.length > 1 ? (
                    <XStack
                      render="button"
                      aria-label={t('Delete note')}
                      onClick={(e: { stopPropagation: () => void }) => {
                        e.stopPropagation()
                        onDeleteNode(node.id)
                      }}
                      width={20}
                      height={20}
                      rounded="$2"
                      items="center"
                      justify="center"
                      cursor="pointer"
                      hoverStyle={{ bg: '$hover' }}
                    >
                      <Trash2 size={11} aria-hidden />
                    </XStack>
                  ) : null}
                </XStack>
                <Text fontSize="$1" color="$soft" lineHeight="$2" $platform-web={{ whiteSpace: 'pre-wrap' }}>
                  {node.config.noteBody || node.description || ''}
                </Text>
              </YStack>
            )
          }

          const borderColor =
            step?.status === 'running'
              ? 'var(--foreground)'
              : step?.status === 'success'
                ? 'var(--state-online)'
                : step?.status === 'error'
                  ? 'var(--state-error)'
                  : selected
                    ? 'var(--border-selected)'
                    : 'var(--border-strong)'

          return (
            <YStack
              key={node.id}
              data-slot="flow-node"
              data-flow-node={node.id}
              data-selected={selected ? 'true' : undefined}
              position="absolute"
              l={node.position.x}
              t={node.position.y}
              width={dim.width}
              minH={dim.height}
              p="$3"
              rounded="$4"
              bg={selected ? 'var(--surface-card-emphasis)' : 'var(--surface-card)'}
              borderWidth={1}
              borderColor={borderColor}
              gap="$1.5"
              cursor={locked ? 'pointer' : draggingId === node.id ? 'grabbing' : 'grab'}
              z={selected ? 'var(--z-raised)' : 'var(--z-base)'}
              hoverStyle={{ borderColor: 'var(--border-focus)' }}
              onClick={(e: { stopPropagation: () => void }) => {
                e.stopPropagation()
                if (connecting) {
                  completeConnection(node.id, spec.inputs[0]?.id ?? 'input')
                } else {
                  onSelectNode(node.id)
                }
              }}
              {...({
                onPointerDown: (e: PointerEvent) => startNodeDrag(node, e),
              } as object)}
            >
              {/* Node header */}
              <XStack items="center" justify="space-between" gap="$2">
                <XStack items="center" gap="$1.5" flex={1} minW={0}>
                  <XStack
                    width={24}
                    height={24}
                    rounded="$2"
                    bg="$raised"
                    borderWidth={1}
                    borderColor="$edge"
                    items="center"
                    justify="center"
                    shrink={0}
                  >
                    <Icon size={13} color="var(--foreground)" aria-hidden />
                  </XStack>
                  <Text fontSize="$1" fontWeight="500" color="$quiet" numberOfLines={1}>
                    {spec.category}
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

              {/* Typed port strip (Input / Tools on left, Output / Tools / True / False on right) */}
              <XStack items="center" justify="space-between" pt="$1" gap="$2">
                <YStack gap="$1">
                  {spec.inputs.map((port) => (
                    <XStack
                      key={port.id}
                      render="button"
                      data-slot={`flow-port-in-${node.id}-${port.id}`}
                      aria-label={`${node.title} ${port.label} input`}
                      items="center"
                      gap="$1.5"
                      cursor="crosshair"
                      onClick={(e: { stopPropagation: () => void }) => {
                        e.stopPropagation()
                        if (connecting) completeConnection(node.id, port.id)
                      }}
                      {...({
                        onPointerUp: (e: PointerEvent) => {
                          if (!connecting) return
                          e.stopPropagation()
                          completeConnection(node.id, port.id)
                        },
                      } as object)}
                    >
                      <YStack
                        width={10}
                        height={10}
                        rounded={999}
                        bg={connecting ? 'var(--foreground)' : 'var(--card)'}
                        borderWidth={1.5}
                        borderColor="var(--border-focus)"
                      />
                      <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                        {port.label}
                      </Text>
                    </XStack>
                  ))}
                </YStack>

                <YStack gap="$1" items="flex-end">
                  {spec.outputs.map((port) => (
                    <XStack
                      key={port.id}
                      render="button"
                      data-slot={`flow-port-out-${node.id}-${port.id}`}
                      aria-label={`${node.title} ${port.label} output`}
                      items="center"
                      gap="$1.5"
                      cursor="crosshair"
                      onClick={(e: { stopPropagation: () => void }) => {
                        e.stopPropagation()
                        setConnecting({
                          sourceId: node.id,
                          sourceHandle: port.id,
                          x: node.position.x + dim.width + 48,
                          y: node.position.y + portOffsetY(node, 'output', port.id),
                          dragging: false,
                        })
                      }}
                      {...({
                        onPointerDown: (e: PointerEvent) => {
                          e.stopPropagation()
                          const world = clientToWorld(e.clientX, e.clientY)
                          setConnecting({
                            sourceId: node.id,
                            sourceHandle: port.id,
                            x: world.x,
                            y: world.y,
                            dragging: true,
                          })
                        },
                      } as object)}
                    >
                      <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                        {port.label}
                      </Text>
                      <YStack
                        width={10}
                        height={10}
                        rounded={999}
                        bg={
                          connecting?.sourceId === node.id && connecting.sourceHandle === port.id
                            ? 'var(--foreground)'
                            : 'var(--card)'
                        }
                        borderWidth={1.5}
                        borderColor="var(--border-selected)"
                      />
                    </XStack>
                  ))}
                </YStack>
              </XStack>

              {step?.durationMs ? (
                <Text fontSize="$1" color={step.status === 'error' ? 'var(--state-error)' : '$quiet'} fontFamily="$mono">
                  {step.status === 'error' ? 'Failed' : `${step.durationMs}ms`}
                </Text>
              ) : null}
            </YStack>
          )
        })}
      </YStack>

      {/* Subtle Minimap overlay (bottom-right, desktop/tablet) */}
      {showMinimap ? (
        <YStack
          data-slot="flow-minimap"
          position="absolute"
          r="$3"
          b="$3"
          width={172}
          height={108}
          rounded="$3"
          bg="var(--surface-overlay)"
          borderWidth={1}
          borderColor="var(--border-strong)"
          overflow="hidden"
          z="var(--z-raised)"
          $max-md={{ display: 'none' }}
          onClick={(e: { stopPropagation: () => void }) => {
            e.stopPropagation()
            handleFitView()
          }}
          cursor="pointer"
        >
          <svg
            width={172}
            height={108}
            viewBox={`${worldBounds.minX} ${worldBounds.minY} ${worldBounds.width} ${worldBounds.height}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            {edgePaths.map(({ edge, d }) => (
              <path
                key={`mm-${edge.id}`}
                d={d}
                stroke="var(--muted-foreground)"
                strokeWidth={8}
                strokeOpacity={0.35}
                fill="none"
              />
            ))}
            {nodes.map((n) => {
              const dim = nodeDimensions(n)
              const isSelected = n.id === selectedNodeId
              const isNote = isStickyNoteNode(n)
              return (
                <rect
                  key={`mm-${n.id}`}
                  x={n.position.x}
                  y={n.position.y}
                  width={dim.width}
                  height={dim.height}
                  rx={16}
                  fill={isSelected ? 'var(--foreground)' : 'var(--muted-foreground)'}
                  fillOpacity={isSelected ? 0.88 : isNote ? 0.25 : 0.48}
                />
              )
            })}
          </svg>
        </YStack>
      ) : null}

      {/* Floating bottom studio canvas toolbar with Hanzo block-H mark */}
      <XStack
        data-slot="flow-canvas-toolbar"
        position="absolute"
        b="$3"
        l="50%"
        $platform-web={{ transform: 'translateX(-50%)' }}
        z="var(--z-raised)"
        items="center"
        gap="$1"
        px="$2.5"
        py="$1.5"
        rounded="$4"
        bg="var(--surface-overlay)"
        borderWidth={1}
        borderColor="var(--border-strong)"
        onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
      >
        <XStack items="center" pr="$1.5" borderInlineEndWidth={1} borderColor="$edge">
          <HanzoMark size={15} />
        </XStack>

        <XStack
          render="button"
          aria-label={t('Zoom out')}
          data-slot="flow-zoom-out"
          onClick={() => setZoom((z) => Number(clamp(z - 0.12, MIN_ZOOM, MAX_ZOOM).toFixed(2)))}
          width={26}
          height={26}
          rounded="$2"
          items="center"
          justify="center"
          cursor="pointer"
          hoverStyle={{ bg: '$hover' }}
        >
          <Minus size={13} aria-hidden />
        </XStack>

        <Text fontSize="$1" fontFamily="$mono" color="$soft" minW={40} text="center" data-slot="flow-zoom-level">
          {Math.round(zoom * 100)}%
        </Text>

        <XStack
          render="button"
          aria-label={t('Zoom in')}
          data-slot="flow-zoom-in"
          onClick={() => setZoom((z) => Number(clamp(z + 0.12, MIN_ZOOM, MAX_ZOOM).toFixed(2)))}
          width={26}
          height={26}
          rounded="$2"
          items="center"
          justify="center"
          cursor="pointer"
          hoverStyle={{ bg: '$hover' }}
        >
          <Plus size={13} aria-hidden />
        </XStack>

        <XStack width={1} height={16} bg="$edge" mx="$0.5" />

        <XStack
          render="button"
          aria-label={t('Fit view')}
          data-slot="flow-fit-view"
          onClick={handleFitView}
          width={26}
          height={26}
          rounded="$2"
          items="center"
          justify="center"
          cursor="pointer"
          hoverStyle={{ bg: '$hover' }}
        >
          <Maximize2 size={13} aria-hidden />
        </XStack>

        <XStack
          render="button"
          aria-label={t('Auto-layout')}
          data-slot="flow-auto-layout"
          onClick={onAutoLayout}
          width={26}
          height={26}
          rounded="$2"
          items="center"
          justify="center"
          cursor="pointer"
          hoverStyle={{ bg: '$hover' }}
        >
          <LayoutGrid size={13} aria-hidden />
        </XStack>

        <XStack
          render="button"
          aria-label={locked ? t('Unlock canvas') : t('Lock canvas')}
          data-slot="flow-lock-canvas"
          onClick={() => setLocked((v) => !v)}
          width={26}
          height={26}
          rounded="$2"
          items="center"
          justify="center"
          bg={locked ? '$raised' : 'transparent'}
          cursor="pointer"
          hoverStyle={{ bg: '$hover' }}
        >
          {locked ? <Lock size={13} aria-hidden /> : <Unlock size={13} aria-hidden />}
        </XStack>

        <XStack
          render="button"
          aria-label={t('Toggle minimap')}
          data-slot="flow-toggle-minimap"
          onClick={() => setShowMinimap((v) => !v)}
          width={26}
          height={26}
          rounded="$2"
          items="center"
          justify="center"
          bg={showMinimap ? '$raised' : 'transparent'}
          cursor="pointer"
          hoverStyle={{ bg: '$hover' }}
        >
          <MapIcon size={13} aria-hidden />
        </XStack>
      </XStack>
    </YStack>
  )
}
