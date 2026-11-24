'use client'

import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Input, Switch, Text, Textarea } from '@hanzo/ui'
import { CalendarClock, Link2, Trash2, Unlink } from 'lucide-react'
import {
  CRON_PRESETS,
  describeCron,
  FLOW_MODELS,
  type FlowDefinition,
  type FlowEdge,
  type FlowNode,
  type FlowNodeConfig,
  type FlowNodeSubtype,
} from './types'

const ACTION_SUBTYPES: readonly { id: FlowNodeSubtype; label: string }[] = [
  { id: 'http_request', label: 'HTTP' },
  { id: 'webhook_send', label: 'Webhook' },
  { id: 'email', label: 'Email' },
  { id: 'sms', label: 'SMS' },
  { id: 'crm_update', label: 'CRM' },
]

const TRIGGER_SUBTYPES: readonly { id: FlowNodeSubtype; label: string }[] = [
  { id: 'manual', label: 'Manual' },
  { id: 'webhook', label: 'Webhook' },
  { id: 'event', label: 'Event' },
]

export function FlowInspector({
  flow,
  selectedNode,
  onUpdateFlow,
  onUpdateNode,
  onDeleteNode,
  onConnectNodes,
  onDeleteEdge,
}: {
  flow: FlowDefinition
  selectedNode: FlowNode | null
  onUpdateFlow: (patch: Partial<FlowDefinition>) => void
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>, configPatch?: Partial<FlowNodeConfig>) => void
  onDeleteNode: (nodeId: string) => void
  onConnectNodes: (sourceId: string, targetId: string) => void
  onDeleteEdge: (edgeId: string) => void
}) {
  const { t } = useI18n()

  if (!selectedNode) {
    const schedule = flow.schedule ?? { enabled: false, cron: '0 8 * * 1-5', timezone: 'UTC' }
    const cronInfo = describeCron(schedule.cron)
    return (
      <YStack
        data-slot="flow-inspector"
        width={304}
        shrink={0}
        borderInlineStartWidth={1}
        borderColor="$edge"
        bg="$background"
        p="$3.5"
        gap="$3.5"
        overflowY="auto"
        overflowX="hidden"
        $max-lg={{ width: '100%', borderInlineStartWidth: 0, borderTopWidth: 1, maxH: 320 }}
      >
        <YStack gap="$1">
          <Text fontSize="$3" fontWeight="600" color="$ink">
            {t('Flow settings')}
          </Text>
          <Text fontSize="$1" color="$quiet">
            {t('Select any step on the canvas to edit its prompt, model, or connections.')}
          </Text>
        </YStack>

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
            placeholder={t('What does this automation do?')}
            rows={3}
          />
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

  const outgoing = flow.edges.filter((e) => e.source === selectedNode.id)
  const connectableTargets = flow.nodes.filter(
    (n) => n.id !== selectedNode.id && !outgoing.some((e) => e.target === n.id),
  )
  const cronDesc =
    selectedNode.kind === 'schedule' ? describeCron(selectedNode.config.cron || '0 8 * * 1-5') : null

  return (
    <YStack
      data-slot="flow-inspector"
      width={304}
      shrink={0}
      borderInlineStartWidth={1}
      borderColor="$edge"
      bg="$background"
      p="$3.5"
      gap="$3.5"
      overflowY="auto"
      overflowX="hidden"
      $max-lg={{ width: '100%', borderInlineStartWidth: 0, borderTopWidth: 1, maxH: 360 }}
    >
      <XStack items="center" justify="space-between" gap="$2">
        <YStack minW={0} flex={1}>
          <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
            {t('Step inspector')}
          </Text>
          <Text fontSize="$1" color="$quiet" fontFamily="$mono">
            {selectedNode.kind} · {selectedNode.id}
          </Text>
        </YStack>
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
      </XStack>

      <YStack gap="$1.5">
        <Text fontSize="$1" fontWeight="500" color="$soft">
          {t('Step title')}
        </Text>
        <Input
          data-slot="inspector-node-title"
          value={selectedNode.title}
          onChangeText={(title) => onUpdateNode(selectedNode.id, { title })}
        />
      </YStack>

      {selectedNode.kind === 'trigger' ? (
        <>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Trigger type')}
            </Text>
            <XStack gap="$1" flexWrap="wrap">
              {TRIGGER_SUBTYPES.map((sub) => (
                <XStack
                  key={sub.id}
                  render="button"
                  onClick={() => onUpdateNode(selectedNode.id, { subtype: sub.id })}
                  px="$2"
                  py="$1"
                  rounded="$2"
                  bg={selectedNode.subtype === sub.id ? '$raised' : '$hover'}
                  cursor="pointer"
                >
                  <Text fontSize="$1" color="$ink">
                    {sub.label}
                  </Text>
                </XStack>
              ))}
            </XStack>
          </YStack>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Test payload')}
            </Text>
            <Textarea
              data-slot="inspector-sample-input"
              value={selectedNode.config.sampleInput ?? ''}
              onChangeText={(sampleInput) => onUpdateNode(selectedNode.id, {}, { sampleInput })}
              rows={4}
            />
          </YStack>
        </>
      ) : null}

      {selectedNode.kind === 'schedule' ? (
        <>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Cron expression')}
            </Text>
            <Input
              data-slot="inspector-cron"
              value={selectedNode.config.cron ?? '0 8 * * 1-5'}
              onChangeText={(cron) => {
                onUpdateNode(selectedNode.id, {}, { cron })
                onUpdateFlow({
                  schedule: {
                    enabled: flow.schedule?.enabled ?? true,
                    cron,
                    timezone: selectedNode.config.timezone || flow.schedule?.timezone || 'UTC',
                  },
                })
              }}
            />
            {cronDesc ? (
              <Text fontSize="$1" color={cronDesc.valid ? '$quiet' : 'var(--state-error)'}>
                {cronDesc.human}
              </Text>
            ) : null}
            <XStack gap="$1" flexWrap="wrap">
              {CRON_PRESETS.map((preset) => (
                <XStack
                  key={preset.cron}
                  render="button"
                  onClick={() => {
                    onUpdateNode(selectedNode.id, {}, { cron: preset.cron })
                    onUpdateFlow({
                      schedule: {
                        enabled: true,
                        cron: preset.cron,
                        timezone: selectedNode.config.timezone || 'UTC',
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

      {selectedNode.kind === 'agent' ? (
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
        </>
      ) : null}

      {selectedNode.kind === 'condition' ? (
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

      {selectedNode.kind === 'action' ? (
        <>
          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Action channel')}
            </Text>
            <XStack gap="$1" flexWrap="wrap">
              {ACTION_SUBTYPES.map((sub) => (
                <XStack
                  key={sub.id}
                  render="button"
                  onClick={() => onUpdateNode(selectedNode.id, { subtype: sub.id })}
                  px="$2"
                  py="$1"
                  rounded="$2"
                  bg={selectedNode.subtype === sub.id ? '$raised' : '$hover'}
                  cursor="pointer"
                >
                  <Text fontSize="$1" color="$ink">
                    {sub.label}
                  </Text>
                </XStack>
              ))}
            </XStack>
          </YStack>

          {selectedNode.subtype === 'email' || selectedNode.subtype === 'sms' ? (
            <>
              <YStack gap="$1.5">
                <Text fontSize="$1" fontWeight="500" color="$soft">
                  {selectedNode.subtype === 'email' ? t('Recipient email') : t('Phone number')}
                </Text>
                <Input
                  value={selectedNode.config.to ?? ''}
                  onChangeText={(to) => onUpdateNode(selectedNode.id, {}, { to })}
                  placeholder={selectedNode.subtype === 'email' ? 'ops@company.com' : '+15550109900'}
                />
              </YStack>
              {selectedNode.subtype === 'email' ? (
                <YStack gap="$1.5">
                  <Text fontSize="$1" fontWeight="500" color="$soft">
                    {t('Subject')}
                  </Text>
                  <Input
                    value={selectedNode.config.subject ?? ''}
                    onChangeText={(subject) => onUpdateNode(selectedNode.id, {}, { subject })}
                    placeholder={t('Automated update')}
                  />
                </YStack>
              ) : null}
            </>
          ) : selectedNode.subtype === 'crm_update' ? (
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
                  {t('Operation')}
                </Text>
                <Input
                  value={selectedNode.config.crmAction ?? 'upsert_note'}
                  onChangeText={(crmAction) => onUpdateNode(selectedNode.id, {}, { crmAction })}
                />
              </YStack>
            </XStack>
          ) : (
            <YStack gap="$1.5">
              <Text fontSize="$1" fontWeight="500" color="$soft">
                {t('Endpoint URL')}
              </Text>
              <Input
                value={selectedNode.config.url ?? ''}
                onChangeText={(url) => onUpdateNode(selectedNode.id, {}, { url })}
                placeholder="https://api.hanzo.ai/v1/workflow/hooks/..."
              />
            </YStack>
          )}

          <YStack gap="$1.5">
            <Text fontSize="$1" fontWeight="500" color="$soft">
              {t('Payload / message template')}
            </Text>
            <Textarea
              value={selectedNode.config.message ?? '{{input}}'}
              onChangeText={(message) => onUpdateNode(selectedNode.id, {}, { message })}
              rows={3}
            />
          </YStack>
        </>
      ) : null}

      {/* Outgoing connections */}
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
        {connectableTargets.length > 0 ? (
          <XStack gap="$1" flexWrap="wrap">
            {connectableTargets.map((target) => (
              <XStack
                key={target.id}
                render="button"
                onClick={() => onConnectNodes(selectedNode.id, target.id)}
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
    </YStack>
  )
}
