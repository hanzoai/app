'use client'

import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Text,
  Textarea,
} from '@hanzo/ui'
import {
  CalendarClock,
  Link2,
  PanelRightClose,
  PanelRightOpen,
  Trash2,
  Unlink,
} from 'lucide-react'
import {
  componentSpecFor,
  CRON_PRESETS,
  describeCron,
  EMBEDDING_MODELS,
  FLOW_MODELS,
  FLOW_TIMEZONES,
  isEmbeddingNode,
  isKnowledgeIngestionNode,
  isKnowledgeRetrievalNode,
  isModelExecutionNode,
  isStickyNoteNode,
  nextCronRun,
  normalizeEmbeddingModel,
  type FlowDefinition,
  type FlowEdge,
  type FlowNode,
  type FlowNodeConfig,
} from './types'

const HTTP_METHODS: readonly ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]

function timezoneOptionsFor(currentTz?: string): string[] {
  const list = [...FLOW_TIMEZONES]
  try {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (localTz && !list.includes(localTz)) list.push(localTz)
  } catch {
    // ignore environments without resolvedOptions().timeZone
  }
  const clean = (currentTz ?? '').trim()
  if (clean && !list.includes(clean)) list.unshift(clean)
  return list
}

function formatNextRunPreview(cron: string, timezone: string): string | null {
  const tz = (timezone || 'UTC').trim() || 'UTC'
  const next = nextCronRun(cron, tz)
  if (!next) return null
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(next)
  } catch {
    return next.toISOString()
  }
}

function ScheduleTimezoneAndPreview({
  cron,
  timezone,
  selectSlot,
  previewSlot,
  onChangeTimezone,
}: {
  cron: string
  timezone: string
  selectSlot: string
  previewSlot: string
  onChangeTimezone: (timezone: string) => void
}) {
  const { t } = useI18n()
  const tz = (timezone || 'UTC').trim() || 'UTC'
  const options = timezoneOptionsFor(tz)
  const nextText = formatNextRunPreview(cron, tz)

  return (
    <YStack gap="$1.5">
      <Text fontSize="$1" fontWeight="500" color="$soft">
        {t('Timezone')}
      </Text>
      <Select value={tz} onValueChange={onChangeTimezone}>
        <SelectTrigger data-slot={selectSlot} aria-label={t('Timezone')} width="100%">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((zone) => (
            <SelectItem key={zone} value={zone}>
              {zone}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Text
        data-slot={previewSlot}
        fontSize="$1"
        color={nextText ? '$quiet' : 'var(--state-error)'}
      >
        {nextText
          ? t('Next run: {when}', { when: nextText })
          : t('Next run: invalid schedule')}
      </Text>
    </YStack>
  )
}

export function FlowInspector({
  collapsed,
  onToggleCollapse,
  flow,
  selectedNode,
  onUpdateFlow,
  onUpdateNode,
  onDeleteNode,
  onConnectNodes,
  onDeleteEdge,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
  flow: FlowDefinition
  selectedNode: FlowNode | null
  onUpdateFlow: (patch: Partial<FlowDefinition>) => void
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>, configPatch?: Partial<FlowNodeConfig>) => void
  onDeleteNode: (nodeId: string) => void
  onConnectNodes: (sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string) => void
  onDeleteEdge: (edgeId: string) => void
}) {
  const { t } = useI18n()

  if (collapsed) {
    return (
      <YStack
        data-slot="flow-inspector-collapsed"
        width={42}
        shrink={0}
        borderInlineStartWidth={1}
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
          borderInlineStartWidth: 0,
          borderTopWidth: 1,
        }}
      >
        <XStack
          render="button"
          aria-label={t('Expand inspector')}
          data-slot="flow-inspector-expand"
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
          <PanelRightOpen size={15} aria-hidden />
          <Text display="none" $max-lg={{ display: 'flex' }} fontSize="$2" color="$soft">
            {t('Inspector')}
          </Text>
        </XStack>
      </YStack>
    )
  }

  if (!selectedNode) {
    const schedule = flow.schedule ?? { enabled: false, cron: '0 8 * * 1-5', timezone: 'UTC' }
    const cronInfo = describeCron(schedule.cron)
    return (
      <YStack
        data-slot="flow-inspector"
        width={308}
        shrink={0}
        borderInlineStartWidth={1}
        borderColor="$edge"
        bg="var(--card)"
        p="$3.5"
        gap="$3.5"
        overflowY="auto"
        overflowX="hidden"
        $max-lg={{ width: '100%', borderInlineStartWidth: 0, borderTopWidth: 1, maxH: 320 }}
      >
        <XStack items="center" justify="space-between" gap="$2">
          <YStack gap="$0.5" flex={1} minW={0}>
            <Text fontSize="$3" fontWeight="600" color="$ink">
              {t('Flow settings')}
            </Text>
            <Text fontSize="$1" color="$quiet">
              {t('Select any component on the canvas to configure it.')}
            </Text>
          </YStack>
          <XStack
            render="button"
            aria-label={t('Collapse inspector')}
            data-slot="flow-inspector-collapse"
            onClick={onToggleCollapse}
            width={24}
            height={24}
            rounded="$2"
            items="center"
            justify="center"
            cursor="pointer"
            hoverStyle={{ bg: '$hover' }}
          >
            <PanelRightClose size={14} aria-hidden />
          </XStack>
        </XStack>

        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {t('Flow name')}
          </Text>
          <Input
            data-slot="flow-name-input"
            value={flow.name}
            onChangeText={(name) => onUpdateFlow({ name })}
            placeholder={t('Untitled flow')}
          />
        </YStack>

        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {t('Description')}
          </Text>
          <Textarea
            data-slot="flow-description-input"
            value={flow.description}
            onChangeText={(description) => onUpdateFlow({ description })}
            placeholder={t('What does this workflow do?')}
            rows={3}
          />
        </YStack>

        <YStack gap="$1.5" data-slot="flow-status-toggle">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {t('Status')}
          </Text>
          <XStack gap="$1">
            {(['active', 'paused', 'draft'] as const).map((status) => {
              const current = flow.status === status
              return (
                <XStack
                  key={status}
                  render="button"
                  {...{ type: 'button' }}
                  data-slot={`flow-status-${status}`}
                  aria-pressed={current}
                  onClick={() => onUpdateFlow({ status })}
                  flex={1}
                  px="$2"
                  py="$1.5"
                  rounded="$2"
                  borderWidth={1}
                  borderColor={current ? 'var(--border-selected)' : '$edge'}
                  bg={current ? '$raised' : 'transparent'}
                  items="center"
                  justify="center"
                  cursor="pointer"
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                >
                  <Text fontSize="$1" fontWeight={current ? '600' : '400'} color="$ink">
                    {status === 'active' ? t('Active') : status === 'paused' ? t('Paused') : t('Draft')}
                  </Text>
                </XStack>
              )
            })}
          </XStack>
          {flow.status === 'paused' ? (
            <Text fontSize="$1" color="$quiet">
              {t('Scheduled and webhook triggers skip while this flow is paused.')}
            </Text>
          ) : null}
        </YStack>

        <YStack gap="$2" pt="$2" borderTopWidth={1} borderColor="$edge">
          <XStack items="center" justify="space-between" gap="$2">
            <XStack items="center" gap="$1.5">
              <CalendarClock size={14} aria-hidden />
              <Text fontSize="$2" fontWeight="500" color="$ink">
                {t('Schedule')}
              </Text>
            </XStack>
            <Switch
              checked={schedule.enabled}
              onCheckedChange={(enabled) =>
                onUpdateFlow({
                  schedule: { ...schedule, enabled: Boolean(enabled) },
                })
              }
            />
          </XStack>
          <Input
            data-slot="flow-schedule-cron"
            value={schedule.cron}
            onChangeText={(cron) =>
              onUpdateFlow({
                schedule: { ...schedule, cron },
              })
            }
            placeholder="0 8 * * 1-5"
          />
          <Text fontSize="$1" color={cronInfo.valid ? '$quiet' : 'var(--state-error)'}>
            {cronInfo.human} ({schedule.timezone || 'UTC'})
          </Text>
          <ScheduleTimezoneAndPreview
            cron={schedule.cron}
            timezone={schedule.timezone || 'UTC'}
            selectSlot="flow-schedule-timezone"
            previewSlot="flow-schedule-next-run"
            onChangeTimezone={(timezone) =>
              onUpdateFlow({
                schedule: { ...schedule, timezone },
              })
            }
          />
          <XStack gap="$1" flexWrap="wrap">
            {CRON_PRESETS.map((preset) => (
              <XStack
                key={preset.cron}
                render="button"
                onClick={() =>
                  onUpdateFlow({
                    schedule: { ...schedule, enabled: true, cron: preset.cron },
                  })
                }
                px="$2"
                py="$1"
                rounded="$2"
                bg={schedule.cron === preset.cron ? '$raised' : '$hover'}
                cursor="pointer"
              >
                <Text fontSize="$1" color="$ink">
                  {preset.label}
                </Text>
              </XStack>
            ))}
          </XStack>
        </YStack>
      </YStack>
    )
  }

  const spec = componentSpecFor(selectedNode)
  const isNote = isStickyNoteNode(selectedNode)
  const isModelNode = isModelExecutionNode(selectedNode)
  const outgoing = flow.edges.filter((e) => e.source === selectedNode.id)
  const connectableTargets = flow.nodes.filter(
    (n) =>
      n.id !== selectedNode.id &&
      !isStickyNoteNode(n) &&
      !outgoing.some((e) => e.target === n.id),
  )
  const cronDesc =
    selectedNode.kind === 'schedule' || selectedNode.subtype === 'cron_schedule'
      ? describeCron(selectedNode.config.cron || '0 8 * * 1-5')
      : null

  return (
    <YStack
      data-slot="flow-inspector"
      width={308}
      shrink={0}
      borderInlineStartWidth={1}
      borderColor="$edge"
      bg="var(--card)"
      p="$3.5"
      gap="$3.5"
      overflowY="auto"
      overflowX="hidden"
      $max-lg={{ width: '100%', borderInlineStartWidth: 0, borderTopWidth: 1, maxH: 360 }}
    >
      <XStack items="center" justify="space-between" gap="$2">
        <YStack minW={0} flex={1}>
          <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
            {spec.label}
          </Text>
          <Text fontSize="$1" color="$quiet" fontFamily="$mono">
            {spec.category} · {selectedNode.id}
          </Text>
        </YStack>
        <XStack items="center" gap="$1">
          {flow.nodes.length > 1 ? (
            <Button
              size="sm"
              variant="ghost"
              data-slot="inspector-delete-node"
              onPress={() => onDeleteNode(selectedNode.id)}
            >
              <Trash2 size={14} aria-hidden />
            </Button>
          ) : null}
          <XStack
            render="button"
            aria-label={t('Collapse inspector')}
            data-slot="flow-inspector-collapse"
            onClick={onToggleCollapse}
            width={24}
            height={24}
            rounded="$2"
            items="center"
            justify="center"
            cursor="pointer"
            hoverStyle={{ bg: '$hover' }}
          >
            <PanelRightClose size={14} aria-hidden />
          </XStack>
        </XStack>
      </XStack>

      <YStack gap="$1.5">
        <Text fontSize="$1" fontWeight="500" color="$soft">
          {t('Title')}
        </Text>
        <Input
          data-slot="inspector-node-title"
          value={selectedNode.title}
          onChangeText={(title) => onUpdateNode(selectedNode.id, { title })}
        />
      </YStack>

      {/* Sticky Note body */}
      {isNote ? (
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {t('Note content')}
          </Text>
          <Textarea
            data-slot="inspector-note-body"
            value={selectedNode.config.noteBody ?? ''}
            onChangeText={(noteBody) => onUpdateNode(selectedNode.id, {}, { noteBody })}
            rows={8}
          />
        </YStack>
      ) : null}

      {/* Trigger / Input nodes */}
      {selectedNode.kind === 'trigger' ? (
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {t('Sample input')}
          </Text>
          <Textarea
            data-slot="inspector-sample-input"
            value={selectedNode.config.sampleInput ?? ''}
            onChangeText={(sampleInput) => onUpdateNode(selectedNode.id, {}, { sampleInput })}
            rows={4}
          />
        </YStack>
      ) : null}

      {/* Cron Schedule */}
      {selectedNode.kind === 'schedule' || selectedNode.subtype === 'cron_schedule' ? (
        <>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Cron expression')}
            </Text>
            <Input
              data-slot="inspector-cron"
              value={selectedNode.config.cron ?? '0 8 * * 1-5'}
              onChangeText={(cron) => {
                const timezone = selectedNode.config.timezone || flow.schedule?.timezone || 'UTC'
                onUpdateNode(selectedNode.id, {}, { cron })
                onUpdateFlow({
                  schedule: {
                    enabled: flow.schedule?.enabled ?? true,
                    cron,
                    timezone,
                  },
                })
              }}
            />
            {cronDesc ? (
              <Text fontSize="$1" color={cronDesc.valid ? '$quiet' : 'var(--state-error)'}>
                {cronDesc.human}
              </Text>
            ) : null}
            <ScheduleTimezoneAndPreview
              cron={selectedNode.config.cron ?? '0 8 * * 1-5'}
              timezone={selectedNode.config.timezone || flow.schedule?.timezone || 'UTC'}
              selectSlot="inspector-cron-timezone"
              previewSlot="inspector-cron-next-run"
              onChangeTimezone={(timezone) => {
                const cron = selectedNode.config.cron ?? '0 8 * * 1-5'
                onUpdateNode(selectedNode.id, {}, { timezone })
                onUpdateFlow({
                  schedule: {
                    enabled: flow.schedule?.enabled ?? true,
                    cron,
                    timezone,
                  },
                })
              }}
            />
            <XStack gap="$1" flexWrap="wrap">
              {CRON_PRESETS.map((preset) => (
                <XStack
                  key={preset.cron}
                  render="button"
                  onClick={() => {
                    const timezone = selectedNode.config.timezone || flow.schedule?.timezone || 'UTC'
                    onUpdateNode(selectedNode.id, {}, { cron: preset.cron })
                    onUpdateFlow({
                      schedule: {
                        enabled: true,
                        cron: preset.cron,
                        timezone,
                      },
                    })
                  }}
                  px="$2"
                  py="$1"
                  rounded="$2"
                  bg={selectedNode.config.cron === preset.cron ? '$raised' : '$hover'}
                  cursor="pointer"
                >
                  <Text fontSize="$1" color="$ink">
                    {preset.label}
                  </Text>
                </XStack>
              ))}
            </XStack>
          </YStack>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Run input')}
            </Text>
            <Textarea
              value={selectedNode.config.sampleInput ?? ''}
              onChangeText={(sampleInput) => onUpdateNode(selectedNode.id, {}, { sampleInput })}
              rows={3}
            />
          </YStack>
        </>
      ) : null}

      {/* Enso / Zen Model & Agent nodes — authenticated automatically via Hanzo IAM */}
      {isModelNode ? (
        <>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Model')}
            </Text>
            <XStack gap="$1" flexWrap="wrap" data-slot="inspector-model-picker">
              {FLOW_MODELS.map((m) => (
                <XStack
                  key={m.id}
                  render="button"
                  data-model-id={m.id}
                  onClick={() => onUpdateNode(selectedNode.id, {}, { model: m.id })}
                  px="$2"
                  py="$1"
                  rounded="$2"
                  borderWidth={1}
                  borderColor={(selectedNode.config.model || 'enso') === m.id ? 'var(--border-selected)' : '$edge'}
                  bg={(selectedNode.config.model || 'enso') === m.id ? '$raised' : 'transparent'}
                  cursor="pointer"
                >
                  <Text fontSize="$1" fontFamily="$mono" color="$ink">
                    {m.id}
                  </Text>
                </XStack>
              ))}
            </XStack>
          </YStack>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('System instruction')}
            </Text>
            <Textarea
              data-slot="inspector-system-prompt"
              value={selectedNode.config.systemPrompt ?? ''}
              onChangeText={(systemPrompt) => onUpdateNode(selectedNode.id, {}, { systemPrompt })}
              rows={3}
            />
          </YStack>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Prompt template (use {{input}})')}
            </Text>
            <Textarea
              data-slot="inspector-prompt"
              value={selectedNode.config.prompt ?? ''}
              onChangeText={(prompt) => onUpdateNode(selectedNode.id, {}, { prompt })}
              rows={4}
            />
          </YStack>
          {selectedNode.subtype === 'structured_output' ? (
            <YStack gap="$1.5">
              <Text fontSize="$1" fontWeight="500" color="$soft">
                {t('JSON output schema')}
              </Text>
              <Textarea
                value={selectedNode.config.schema ?? ''}
                onChangeText={(schema) => onUpdateNode(selectedNode.id, {}, { schema })}
                rows={3}
              />
            </YStack>
          ) : null}
        </>
      ) : null}

      {/* Prompt Template */}
      {selectedNode.subtype === 'prompt_template' ? (
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {t('Template (use {{input}})')}
          </Text>
          <Textarea
            data-slot="inspector-prompt"
            value={selectedNode.config.prompt ?? '{{input}}'}
            onChangeText={(prompt) => onUpdateNode(selectedNode.id, {}, { prompt })}
            rows={5}
          />
        </YStack>
      ) : null}

      {/* Embeddings (live POST /v1/embeddings via Hanzo IAM) */}
      {isEmbeddingNode(selectedNode) ? (
        <YStack gap="$2">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {t('Embedding model')}
          </Text>
          <XStack gap="$1" flexWrap="wrap" data-slot="inspector-embedding-picker">
            {EMBEDDING_MODELS.map((m) => {
              const activeModel = normalizeEmbeddingModel(selectedNode.config.model)
              return (
                <XStack
                  key={m.id}
                  render="button"
                  data-embedding-model={m.id}
                  onClick={() => onUpdateNode(selectedNode.id, {}, { model: m.id })}
                  px="$2"
                  py="$1"
                  rounded="$2"
                  borderWidth={1}
                  borderColor={activeModel === m.id ? 'var(--border-selected)' : '$edge'}
                  bg={activeModel === m.id ? '$raised' : 'transparent'}
                  cursor="pointer"
                >
                  <Text fontSize="$1" fontFamily="$mono" color="$ink">
                    {m.id}
                  </Text>
                </XStack>
              )
            })}
          </XStack>
          <Text fontSize="$1" color="$quiet" fontFamily="$mono">
            POST /v1/embeddings · Hanzo IAM (active)
          </Text>
        </YStack>
      ) : null}

      {/* API Request / URL Fetch */}
      {selectedNode.subtype === 'api_request' || selectedNode.subtype === 'http_request' ? (
        <>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('HTTP method')}
            </Text>
            <XStack gap="$1" flexWrap="wrap">
              {HTTP_METHODS.map((method) => (
                <XStack
                  key={method}
                  render="button"
                  onClick={() => onUpdateNode(selectedNode.id, {}, { method })}
                  px="$2"
                  py="$1"
                  rounded="$2"
                  bg={(selectedNode.config.method || 'GET') === method ? '$raised' : '$hover'}
                  cursor="pointer"
                >
                  <Text fontSize="$1" fontFamily="$mono" color="$ink">
                    {method}
                  </Text>
                </XStack>
              ))}
            </XStack>
          </YStack>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Endpoint URL (supports {{query}} and {{input}})')}
            </Text>
            <Input
              data-slot="inspector-api-url"
              value={selectedNode.config.url ?? ''}
              onChangeText={(url) => onUpdateNode(selectedNode.id, {}, { url })}
              placeholder="https://pokeapi.co/api/v2/pokemon/{{query}}"
            />
          </YStack>
          <XStack items="center" justify="space-between">
            <Text fontSize="$1" color="$soft">
              {t('Tool mode (feed Agent Tools port)')}
            </Text>
            <Switch
              checked={Boolean(selectedNode.config.toolMode)}
              onCheckedChange={(toolMode) => onUpdateNode(selectedNode.id, {}, { toolMode: Boolean(toolMode) })}
            />
          </XStack>
        </>
      ) : null}

      {selectedNode.subtype === 'url_fetch' ? (
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {t('Target URL')}
          </Text>
          <Input
            value={selectedNode.config.url ?? ''}
            onChangeText={(url) => onUpdateNode(selectedNode.id, {}, { url })}
            placeholder="https://hanzo.ai/docs"
          />
        </YStack>
      ) : null}

      {selectedNode.subtype === 'web_search' || selectedNode.subtype === 'sql_query' ? (
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {selectedNode.subtype === 'sql_query' ? t('SQL query') : t('Search query')}
          </Text>
          <Textarea
            value={selectedNode.config.query ?? '{{input}}'}
            onChangeText={(query) => onUpdateNode(selectedNode.id, {}, { query })}
            rows={3}
          />
        </YStack>
      ) : null}

      {selectedNode.subtype === 'file_loader' ? (
        <>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('File name / path')}
            </Text>
            <Input
              value={selectedNode.config.filePath ?? ''}
              onChangeText={(filePath) => onUpdateNode(selectedNode.id, {}, { filePath })}
            />
          </YStack>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Document contents')}
            </Text>
            <Textarea
              value={selectedNode.config.sampleInput ?? ''}
              onChangeText={(sampleInput) => onUpdateNode(selectedNode.id, {}, { sampleInput })}
              rows={5}
            />
          </YStack>
        </>
      ) : null}

      {isKnowledgeIngestionNode(selectedNode) ||
      isKnowledgeRetrievalNode(selectedNode) ||
      selectedNode.subtype === 'hanzo_base' ? (
        <YStack gap="$2.5">
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Collection / Knowledge base')}
            </Text>
            <Input
              data-slot="inspector-kb-collection"
              value={selectedNode.config.collection ?? 'workspace-kb'}
              onChangeText={(collection) => onUpdateNode(selectedNode.id, {}, { collection })}
            />
          </YStack>
          {isKnowledgeRetrievalNode(selectedNode) ? (
            <YStack gap="$1.5">
              <Text fontSize="$1" fontWeight="500" color="$soft">
                {t('Top-K passages')}
              </Text>
              <Input
                data-slot="inspector-kb-topk"
                value={String(selectedNode.config.topK ?? 5)}
                onChangeText={(raw) => {
                  const n = Number.parseInt(raw, 10)
                  if (!Number.isNaN(n) && n > 0) onUpdateNode(selectedNode.id, {}, { topK: Math.min(24, n) })
                }}
              />
            </YStack>
          ) : null}
          {selectedNode.subtype === 'vector_store' || isKnowledgeIngestionNode(selectedNode) ? (
            <YStack gap="$1.5">
              <Text fontSize="$1" fontWeight="500" color="$soft">
                {t('Embedding model')}
              </Text>
              <XStack gap="$1" flexWrap="wrap">
                {EMBEDDING_MODELS.map((m) => {
                  const activeModel = normalizeEmbeddingModel(selectedNode.config.model)
                  return (
                    <XStack
                      key={m.id}
                      render="button"
                      onClick={() => onUpdateNode(selectedNode.id, {}, { model: m.id })}
                      px="$2"
                      py="$1"
                      rounded="$2"
                      borderWidth={1}
                      borderColor={activeModel === m.id ? 'var(--border-selected)' : '$edge'}
                      bg={activeModel === m.id ? '$raised' : 'transparent'}
                      cursor="pointer"
                    >
                      <Text fontSize="$1" fontFamily="$mono" color="$ink">
                        {m.id}
                      </Text>
                    </XStack>
                  )
                })}
              </XStack>
            </YStack>
          ) : null}
          <Text fontSize="$1" color="$quiet" fontFamily="$mono">
            {isKnowledgeIngestionNode(selectedNode)
              ? 'POST /v1/knowledge/import · Hanzo IAM'
              : isKnowledgeRetrievalNode(selectedNode)
                ? 'POST /v1/knowledge/search + files/retrieve · Hanzo IAM'
                : 'Hanzo Base · Hanzo IAM'}
          </Text>
        </YStack>
      ) : null}

      {selectedNode.subtype === 'sandbox_code' ? (
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {t('Script expression')}
          </Text>
          <Textarea
            value={selectedNode.config.code ?? 'return input.trim()'}
            onChangeText={(code) => onUpdateNode(selectedNode.id, {}, { code })}
            rows={4}
          />
        </YStack>
      ) : null}

      {selectedNode.subtype === 'human_approval' ? (
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {t('Approval prompt')}
          </Text>
          <Textarea
            data-slot="inspector-approval-prompt"
            value={selectedNode.config.prompt ?? 'Review the upstream output and approve or reject continuing.'}
            onChangeText={(prompt) => onUpdateNode(selectedNode.id, {}, { prompt })}
            rows={3}
          />
          <Text fontSize="$1" color="$quiet">
            {t('Pauses the run until a reviewer approves or rejects from Run history.')}
          </Text>
        </YStack>
      ) : null}

      {selectedNode.kind === 'condition' || selectedNode.subtype === 'guardrail' ? (
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {t('Condition expression')}
          </Text>
          <Input
            data-slot="inspector-expression"
            value={selectedNode.config.expression ?? 'non-empty'}
            onChangeText={(expression) => onUpdateNode(selectedNode.id, {}, { expression })}
            placeholder="non-empty | contains:urgent | length > 20"
          />
          <Text fontSize="$1" color="$quiet">
            {t('Supports non-empty, contains:<text>, !contains:<text>, or length > <n>.')}
          </Text>
        </YStack>
      ) : null}

      {selectedNode.subtype === 'hanzo_kms_secret' ? (
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {t('KMS secret path (reference only)')}
          </Text>
          <Input
            value={selectedNode.config.secretPath ?? '/prod/flow/WEBHOOK_SIGNING_KEY'}
            onChangeText={(secretPath) => onUpdateNode(selectedNode.id, {}, { secretPath })}
          />
        </YStack>
      ) : null}

      {selectedNode.subtype === 'hanzo_mail' || selectedNode.subtype === 'email' ? (
        <>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Recipient email')}
            </Text>
            <Input
              value={selectedNode.config.to ?? ''}
              onChangeText={(to) => onUpdateNode(selectedNode.id, {}, { to })}
              placeholder="team@hanzo.ai"
            />
          </YStack>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Subject')}
            </Text>
            <Input
              value={selectedNode.config.subject ?? ''}
              onChangeText={(subject) => onUpdateNode(selectedNode.id, {}, { subject })}
            />
          </YStack>
        </>
      ) : null}

      {selectedNode.subtype === 'hanzo_post' ? (
        <YStack gap="$1.5">
          <Text fontSize="$1" fontWeight="500" color="$soft">
            {t('Channel')}
          </Text>
          <Input
            value={selectedNode.config.channel ?? '#updates'}
            onChangeText={(channel) => onUpdateNode(selectedNode.id, {}, { channel })}
          />
        </YStack>
      ) : null}

      {selectedNode.subtype === 'crm_update' ? (
        <XStack gap="$2">
          <YStack flex={1} gap="$1">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Entity')}
            </Text>
            <Input
              value={selectedNode.config.crmEntity ?? 'contact'}
              onChangeText={(crmEntity) => onUpdateNode(selectedNode.id, {}, { crmEntity })}
            />
          </YStack>
          <YStack flex={1} gap="$1">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Action')}
            </Text>
            <Input
              value={selectedNode.config.crmAction ?? 'upsert_note'}
              onChangeText={(crmAction) => onUpdateNode(selectedNode.id, {}, { crmAction })}
            />
          </YStack>
        </XStack>
      ) : null}

      {selectedNode.subtype === 'variable_store' ? (
        <XStack gap="$2">
          <YStack flex={1} gap="$1">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Key')}
            </Text>
            <Input
              value={selectedNode.config.variableKey ?? 'context'}
              onChangeText={(variableKey) => onUpdateNode(selectedNode.id, {}, { variableKey })}
            />
          </YStack>
          <YStack flex={1} gap="$1">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Value')}
            </Text>
            <Input
              value={selectedNode.config.variableValue ?? '{{input}}'}
              onChangeText={(variableValue) => onUpdateNode(selectedNode.id, {}, { variableValue })}
            />
          </YStack>
        </XStack>
      ) : null}

      {/* Outgoing connections (hidden for sticky notes) */}
      {!isNote ? (
        <YStack gap="$2" pt="$2" borderTopWidth={1} borderColor="$edge">
          <XStack items="center" gap="$1.5">
            <Link2 size={13} aria-hidden />
            <Text fontSize="$2" fontWeight="500" color="$ink">
              {t('Outgoing connections')}
            </Text>
          </XStack>
          {outgoing.length === 0 ? (
            <Text fontSize="$1" color="$quiet">
              {t('Not connected to any downstream step.')}
            </Text>
          ) : (
            <YStack gap="$1">
              {outgoing.map((edge: FlowEdge) => {
                const target = flow.nodes.find((n) => n.id === edge.target)
                return (
                  <XStack
                    key={edge.id}
                    items="center"
                    justify="space-between"
                    px="$2"
                    py="$1.5"
                    rounded="$2"
                    bg="$hover"
                  >
                    <Text fontSize="$1" color="$ink" numberOfLines={1} flex={1}>
                      → {target?.title ?? edge.target}
                      {edge.label ? ` (${edge.label})` : ''}
                    </Text>
                    <XStack
                      render="button"
                      aria-label={t('Disconnect')}
                      onClick={() => onDeleteEdge(edge.id)}
                      p="$1"
                      rounded="$2"
                      cursor="pointer"
                      hoverStyle={{ bg: '$raised' }}
                    >
                      <Unlink size={12} aria-hidden />
                    </XStack>
                  </XStack>
                )
              })}
            </YStack>
          )}
          {connectableTargets.length > 0 && spec.outputs.length > 0 ? (
            <XStack gap="$1" flexWrap="wrap">
              {connectableTargets.map((target) => (
                <XStack
                  key={target.id}
                  render="button"
                  onClick={() =>
                    onConnectNodes(
                      selectedNode.id,
                      target.id,
                      spec.outputs[0]?.id ?? 'output',
                      componentSpecFor(target).inputs[0]?.id ?? 'input',
                    )
                  }
                  px="$2"
                  py="$1"
                  rounded="$2"
                  borderWidth={1}
                  borderColor="$edge"
                  cursor="pointer"
                  hoverStyle={{ bg: '$hover' }}
                >
                  <Text fontSize="$1" color="$soft">
                    + {target.title}
                  </Text>
                </XStack>
              ))}
            </XStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  )
}
