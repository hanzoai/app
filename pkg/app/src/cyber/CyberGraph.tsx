'use client'

import { useMemo } from 'react'
import { XStack, YStack } from '@hanzo/gui'
import { Text } from '@hanzo/ui'
import type { CyberGraphNode } from './types'

interface PositionedNode {
  node: CyberGraphNode
  x: number
  y: number
  depth: number
}

const NODE_W = 248
const NODE_H = 74
const COL_GAP = 56
const ROW_GAP = 24
const PAD = 28

const KIND_LABEL: Record<string, string> = {
  goal: 'Goal',
  intent: 'Intent',
  finding: 'Finding',
  hint: 'Kai gate',
  action: 'Action',
}

export function CyberGraph({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: readonly CyberGraphNode[]
  selectedId: string | null
  onSelect: (node: CyberGraphNode) => void
}) {
  const layout = useMemo(() => {
    if (nodes.length === 0) {
      return {
        items: [] as PositionedNode[],
        edges: [] as { from: PositionedNode; to: PositionedNode }[],
        width: 640,
        height: 240,
      }
    }
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const depthCache = new Map<string, number>()
    const depthOf = (n: CyberGraphNode, seen = new Set<string>()): number => {
      if (depthCache.has(n.id)) return depthCache.get(n.id)!
      if (!n.parentId || !byId.has(n.parentId) || seen.has(n.id)) {
        depthCache.set(n.id, 0)
        return 0
      }
      seen.add(n.id)
      const d = depthOf(byId.get(n.parentId)!, seen) + 1
      depthCache.set(n.id, d)
      return d
    }

    const columns = new Map<number, CyberGraphNode[]>()
    for (const n of nodes) {
      const d = depthOf(n)
      const col = columns.get(d) ?? []
      col.push(n)
      columns.set(d, col)
    }

    const items: PositionedNode[] = []
    const positioned = new Map<string, PositionedNode>()
    let maxCol = 0
    let maxRows = 1
    for (const [colIdx, colNodes] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
      maxCol = Math.max(maxCol, colIdx)
      maxRows = Math.max(maxRows, colNodes.length)
      colNodes.forEach((node, rowIdx) => {
        const p: PositionedNode = {
          node,
          depth: colIdx,
          x: PAD + colIdx * (NODE_W + COL_GAP),
          y: PAD + rowIdx * (NODE_H + ROW_GAP),
        }
        items.push(p)
        positioned.set(node.id, p)
      })
    }

    const edges: { from: PositionedNode; to: PositionedNode }[] = []
    for (const item of items) {
      if (item.node.parentId && positioned.has(item.node.parentId)) {
        edges.push({ from: positioned.get(item.node.parentId)!, to: item })
      }
    }

    const width = PAD * 2 + (maxCol + 1) * NODE_W + maxCol * COL_GAP
    const height = Math.max(240, PAD * 2 + maxRows * NODE_H + Math.max(0, maxRows - 1) * ROW_GAP)
    return { items, edges, width, height }
  }, [nodes])

  if (nodes.length === 0) {
    return (
      <YStack
        p="$6"
        rounded="$4"
        borderWidth={1}
        borderColor="$edge"
        bg="var(--card)"
        items="center"
        justify="center"
        minH={220}
      >
        <Text fontSize="$3" color="$soft">
          No reasoning nodes recorded for this task yet.
        </Text>
      </YStack>
    )
  }

  return (
    <YStack
      data-slot="cyber-graph"
      rounded="$4"
      borderWidth={1}
      borderColor="$edge"
      bg="$background"
      overflow="scroll"
      minH={320}
      position="relative"
    >
      <YStack position="relative" width={layout.width} height={layout.height} minW="100%">
        <YStack position="absolute" t={0} l={0} width={layout.width} height={layout.height} pointerEvents="none">
          <svg width={layout.width} height={layout.height} aria-hidden="true">
            {layout.edges.map(({ from, to }) => {
              const x1 = from.x + NODE_W
              const y1 = from.y + NODE_H / 2
              const x2 = to.x
              const y2 = to.y + NODE_H / 2
              const mx = (x1 + x2) / 2
              return (
                <path
                  key={`${from.node.id}-${to.node.id}`}
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="var(--border-strong)"
                  strokeWidth={1.5}
                />
              )
            })}
          </svg>
        </YStack>

        {layout.items.map(({ node, x, y }) => {
          const active = node.id === selectedId
          return (
            <YStack
              key={node.id}
              render="button"
              data-slot="cyber-graph-node"
              data-kind={node.kind}
              onClick={() => onSelect(node)}
              position="absolute"
              l={x}
              t={y}
              width={NODE_W}
              height={NODE_H}
              p="$2.5"
              rounded="$3"
              borderWidth={1}
              borderColor={active ? '$ink' : '$edge'}
              bg={active ? '$raised' : 'var(--card)'}
              hoverStyle={{ bg: '$hover', borderColor: '$ink' }}
              cursor="pointer"
              gap="$1"
              justify="space-between"
            >
              <XStack items="center" justify="space-between" width="100%" gap="$2">
                <Text fontSize="$1" fontFamily="$mono" fontWeight="600" color="$soft">
                  {KIND_LABEL[node.kind] ?? node.kind}
                </Text>
                <Text fontSize="$1" fontFamily="$mono" color="$soft">
                  {node.severity || node.status}
                </Text>
              </XStack>
              <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={2}>
                {node.label}
              </Text>
            </YStack>
          )
        })}
      </YStack>
    </YStack>
  )
}
