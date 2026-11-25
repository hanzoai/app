'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Input, Text } from '@hanzo/ui'
import {
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Trash2,
  Workflow,
} from 'lucide-react'
import { iconForCategory, iconForSubtype } from './icons'
import {
  FLOW_COMPONENT_CATALOG,
  FLOW_NODE_CATEGORIES,
  type FlowComponentSpec,
  type FlowDefinition,
  type FlowNodeCategory,
  type FlowNodeSubtype,
} from './types'

export const FLOW_DRAG_MIME = 'application/x-hanzo-flow-component'

export function FlowPalette({
  collapsed,
  onToggleCollapse,
  flows,
  activeFlowId,
  onSelectFlow,
  onCreateFlow,
  onDeleteFlow,
  onAddComponent,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  flows: readonly FlowDefinition[]
  activeFlowId: string
  onSelectFlow: (flowId: string) => void
  onCreateFlow: () => void
  onDeleteFlow: (flowId: string) => void
  onAddComponent: (subtype: FlowNodeSubtype) => void
}) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'components' | 'flows'>('components')
  const [query, setQuery] = useState('')
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FLOW_NODE_CATEGORIES.map((c, idx) => [c, idx < 3 || c === 'Hanzo'])),
  )

  const normalizedQuery = query.trim().toLowerCase()

  const grouped = useMemo(() => {
    const map = new Map<FlowNodeCategory, FlowComponentSpec[]>()
    for (const cat of FLOW_NODE_CATEGORIES) map.set(cat, [])
    for (const spec of FLOW_COMPONENT_CATALOG) {
      if (normalizedQuery) {
        const hay = `${spec.label} ${spec.description} ${spec.category} ${spec.subtype}`.toLowerCase()
        if (!hay.includes(normalizedQuery)) continue
      }
      map.get(spec.category)?.push(spec)
    }
    return FLOW_NODE_CATEGORIES.map((category) => ({
      category,
      items: map.get(category) ?? [],
    })).filter((g) => g.items.length > 0)
  }, [normalizedQuery])

  if (collapsed) {
    return (
      <YStack
        data-slot="flow-palette-collapsed"
        width={42}
        shrink={0}
        borderInlineEndWidth={1}
        borderColor="$edge"
        bg="var(--card)"
        py="$2.5"
        items="center"
        gap="$2"
        $max-lg={{
          width: '100%',
          flexDirection: 'row',
          px: '$2.5',
          py: '$1.5',
          borderInlineEndWidth: 0,
          borderBottomWidth: 1,
        }}
      >
        <XStack
          render="button"
          aria-label={t('Expand component palette')}
          data-slot="flow-palette-expand"
          onClick={onToggleCollapse}
          minW={28}
          height={28}
          px="$1.5"
          gap="$1.5"
          rounded="$2"
          items="center"
          justify="center"
          cursor="pointer"
          hoverStyle={{ bg: '$hover' }}
        >
          <PanelLeftOpen size={15} aria-hidden />
          <Text display="none" $max-lg={{ display: 'flex' }} fontSize="$2" color="$soft">
            {t('Components')}
          </Text>
        </XStack>
      </YStack>
    )
  }

  return (
    <YStack
      data-slot="flow-palette-sidebar"
      width={256}
      shrink={0}
      borderInlineEndWidth={1}
      borderColor="$edge"
      bg="var(--card)"
      minH={0}
      $max-lg={{ width: '100%', borderInlineEndWidth: 0, borderBottomWidth: 1, maxH: 260 }}
    >
      {/* Header tabs: Components | Flows + collapse */}
      <XStack
        px="$2.5"
        py="$2"
        gap="$1.5"
        items="center"
        justify="space-between"
        borderBottomWidth={1}
        borderColor="$edge"
        shrink={0}
      >
        <XStack gap="$1" flex={1} minW={0}>
          <XStack
            render="button"
            data-slot="palette-tab-components"
            onClick={() => setTab('components')}
            px="$2"
            py="$1"
            rounded="$2"
            bg={tab === 'components' ? '$raised' : 'transparent'}
            cursor="pointer"
            hoverStyle={{ bg: tab === 'components' ? '$raised' : '$hover' }}
          >
            <Text fontSize="$1" fontWeight={tab === 'components' ? '600' : '500'} color={tab === 'components' ? '$ink' : '$soft'}>
              {t('Components')} ({FLOW_COMPONENT_CATALOG.length})
            </Text>
          </XStack>
          <XStack
            render="button"
            data-slot="palette-tab-flows"
            onClick={() => setTab('flows')}
            px="$2"
            py="$1"
            rounded="$2"
            bg={tab === 'flows' ? '$raised' : 'transparent'}
            cursor="pointer"
            hoverStyle={{ bg: tab === 'flows' ? '$raised' : '$hover' }}
          >
            <Text fontSize="$1" fontWeight={tab === 'flows' ? '600' : '500'} color={tab === 'flows' ? '$ink' : '$soft'}>
              {t('Flows')} ({flows.length})
            </Text>
          </XStack>
        </XStack>

        <XStack
          render="button"
          aria-label={t('Collapse component palette')}
          data-slot="flow-palette-collapse"
          onClick={onToggleCollapse}
          width={24}
          height={24}
          rounded="$2"
          items="center"
          justify="center"
          cursor="pointer"
          hoverStyle={{ bg: '$hover' }}
        >
          <PanelLeftClose size={14} aria-hidden />
        </XStack>
      </XStack>

      {tab === 'components' ? (
        <YStack flex={1} minH={0}>
          {/* Search box */}
          <YStack px="$2.5" py="$2" borderBottomWidth={1} borderColor="$edge" shrink={0}>
            <XStack
              items="center"
              gap="$1.5"
              px="$2"
              rounded="$3"
              borderWidth={1}
              borderColor="$edge"
              bg="$background"
            >
              <Search size={13} color="var(--muted-foreground)" aria-hidden />
              <Input
                data-slot="flow-component-search"
                value={query}
                onChangeText={setQuery}
                placeholder={t('Search components…')}
                borderWidth={0}
                bg="transparent"
                flex={1}
                minW={0}
                size="sm"
              />
            </XStack>
          </YStack>

          {/* Categorized component list */}
          <YStack
            data-slot="flow-component-list"
            flex={1}
            minH={0}
            overflowY="auto"
            overflowX="hidden"
            p="$2"
            gap="$1.5"
          >
            {grouped.length === 0 ? (
              <YStack p="$3" items="center" gap="$1">
                <Text fontSize="$2" color="$quiet">
                  {t('No matching components')}
                </Text>
              </YStack>
            ) : (
              grouped.map(({ category, items }) => {
                const isOpen = normalizedQuery.length > 0 || Boolean(openCategories[category])
                const CatIcon = iconForCategory(category)
                return (
                  <YStack key={category} data-slot={`flow-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} gap="$1">
                    <XStack
                      render="button"
                      onClick={() =>
                        setOpenCategories((prev) => ({ ...prev, [category]: !isOpen }))
                      }
                      items="center"
                      justify="space-between"
                      px="$2"
                      py="$1.5"
                      rounded="$2"
                      cursor="pointer"
                      hoverStyle={{ bg: '$hover' }}
                    >
                      <XStack items="center" gap="$1.5" minW={0} flex={1}>
                        {isOpen ? (
                          <ChevronDown size={12} color="var(--muted-foreground)" aria-hidden />
                        ) : (
                          <ChevronRight size={12} color="var(--muted-foreground)" aria-hidden />
                        )}
                        <CatIcon size={12} color="var(--muted-foreground)" aria-hidden />
                        <Text fontSize="$1" fontWeight="600" color="$soft" numberOfLines={1}>
                          {t(category)}
                        </Text>
                      </XStack>
                      <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                        {items.length}
                      </Text>
                    </XStack>

                    {isOpen ? (
                      <YStack gap="$1" pl="$1">
                        {items.map((spec) => {
                          const ItemIcon = iconForSubtype(spec.subtype)
                          return (
                            <XStack
                              key={spec.subtype}
                              render="button"
                              data-slot={`flow-component-${spec.subtype}`}
                              onClick={() => onAddComponent(spec.subtype)}
                              items="center"
                              gap="$2"
                              px="$2"
                              py="$1.5"
                              rounded="$3"
                              borderWidth={1}
                              borderColor="$edge"
                              bg="$background"
                              cursor="grab"
                              hoverStyle={{ bg: '$raised', borderColor: 'var(--border-strong)' }}
                              {...({
                                draggable: true,
                                onDragStart: (e: DragEvent) => {
                                  e.dataTransfer?.setData(FLOW_DRAG_MIME, spec.subtype)
                                  e.dataTransfer?.setData('text/plain', spec.subtype)
                                },
                              } as object)}
                            >
                              <XStack
                                width={22}
                                height={22}
                                rounded="$2"
                                bg="$hover"
                                items="center"
                                justify="center"
                                shrink={0}
                              >
                                <ItemIcon size={12} color="var(--foreground)" aria-hidden />
                              </XStack>
                              <YStack flex={1} minW={0} items="flex-start">
                                <Text fontSize="$1" fontWeight="500" color="$ink" numberOfLines={1}>
                                  {t(spec.label)}
                                </Text>
                                <Text fontSize="$1" color="$quiet" numberOfLines={1}>
                                  {spec.description}
                                </Text>
                              </YStack>
                              <Plus size={12} color="var(--muted-foreground)" aria-hidden />
                            </XStack>
                          )
                        })}
                      </YStack>
                    ) : null}
                  </YStack>
                )
              })
            )}
          </YStack>
        </YStack>
      ) : (
        <YStack data-slot="flow-list" flex={1} minH={0} overflowY="auto" overflowX="hidden" p="$2.5" gap="$2">
          <XStack items="center" justify="space-between" px="$1">
            <Text fontSize="$1" fontWeight="500" color="$quiet">
              {t('Active flows')} ({flows.length})
            </Text>
            <XStack
              render="button"
              aria-label={t('New flow')}
              data-slot="flow-list-new"
              onClick={onCreateFlow}
              width={24}
              height={24}
              rounded="$2"
              items="center"
              justify="center"
              cursor="pointer"
              hoverStyle={{ bg: '$hover' }}
            >
              <Plus size={14} aria-hidden />
            </XStack>
          </XStack>

          <YStack gap="$1">
            {flows.map((item) => {
              const isCurrent = item.id === activeFlowId
              return (
                <XStack
                  key={item.id}
                  data-slot={`flow-row-${item.id}`}
                  items="center"
                  justify="space-between"
                  gap="$1.5"
                  px="$2"
                  py="$1.5"
                  rounded="$3"
                  bg={isCurrent ? '$raised' : 'transparent'}
                  hoverStyle={{ bg: isCurrent ? '$raised' : '$hover' }}
                >
                  <YStack
                    render="button"
                    flex={1}
                    minW={0}
                    items="flex-start"
                    bg="transparent"
                    cursor="pointer"
                    onClick={() => onSelectFlow(item.id)}
                  >
                    <XStack items="center" gap="$1.5" width="100%">
                      <Workflow size={12} color="var(--muted-foreground)" aria-hidden />
                      <Text fontSize="$2" fontWeight={isCurrent ? '600' : '400'} color="$ink" numberOfLines={1} flex={1}>
                        {item.name}
                      </Text>
                    </XStack>
                    <Text fontSize="$1" color="$quiet" numberOfLines={1}>
                      {item.nodes.length} {t('nodes')}
                      {item.schedule?.enabled ? ` · ${t('Scheduled')}` : ''}
                    </Text>
                  </YStack>
                  {flows.length > 1 ? (
                    <XStack
                      render="button"
                      aria-label={t('Delete flow')}
                      onClick={() => onDeleteFlow(item.id)}
                      width={22}
                      height={22}
                      rounded="$2"
                      items="center"
                      justify="center"
                      opacity={0.6}
                      cursor="pointer"
                      hoverStyle={{ opacity: 1, bg: '$hover' }}
                    >
                      <Trash2 size={12} aria-hidden />
                    </XStack>
                  ) : null}
                </XStack>
              )
            })}
          </YStack>
        </YStack>
      )}
    </YStack>
  )
}
