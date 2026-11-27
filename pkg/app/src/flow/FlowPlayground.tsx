'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Box, Button, Text } from '@hanzo/ui'
import { Composer } from '@hanzo/ui/chat'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { Prose } from '../Prose'
import {
  createDefaultPlaygroundSession,
  executeFlow,
  readPlaygroundSessions,
  writePlaygroundSessions,
} from './api'
import { FlowStepIo } from './FlowStepIo'
import { HanzoMark } from './icons'
import { FLOW_TEMPLATES } from './templates'
import { usePromptPlus } from '../lib/promptPlus'
import {
  FLOW_MODELS,
  isModelExecutionNode,
  type FlowDefinition,
  type FlowRunRecord,
  type FlowStepResult,
  type PlaygroundMessage,
  type PlaygroundSession,
} from './types'

export function FlowPlayground({
  flow,
  orgId,
  onClose,
  onLiveStepsChange,
  onRunRecorded,
}: {
  flow: FlowDefinition
  orgId?: string | null
  onClose: () => void
  onLiveStepsChange: (steps: FlowStepResult[]) => void
  onRunRecorded: (record: FlowRunRecord) => void
}) {
  const { t } = useI18n()
  const [sessions, setSessions] = useState<PlaygroundSession[]>(() =>
    readPlaygroundSessions(flow.id, orgId),
  )
  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id ?? '')
  const [draft, setDraft] = useState('')
  const { plus, carried, composeText, clearCarried, hasCarried } = usePromptPlus(setDraft)
  const [busy, setBusy] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const modelNode = flow.nodes.find((n) => isModelExecutionNode(n) && n.config.model)
    return modelNode?.config.model || 'enso'
  })
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [expandedStepKey, setExpandedStepKey] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Reset sessions when switching flows
  useEffect(() => {
    const loaded = readPlaygroundSessions(flow.id, orgId)
    setSessions(loaded)
    setActiveSessionId(loaded[0]?.id ?? '')
    const modelNode = flow.nodes.find((n) => isModelExecutionNode(n) && n.config.model)
    setSelectedModel(modelNode?.config.model || 'enso')
  }, [flow.id, orgId])

  useEffect(() => () => abortRef.current?.abort(), [])

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? sessions[0]!,
    [sessions, activeSessionId],
  )

  const templateStarters = useMemo(() => {
    const matched = FLOW_TEMPLATES.find((tpl) => tpl.id === flow.templateId)
    if (matched?.starterPrompts && matched.starterPrompts.length > 0) return matched.starterPrompts
    const sample = flow.nodes.find((n) => n.config.sampleInput)?.config.sampleInput
    return sample ? [sample] : [`Run ${flow.name}`]
  }, [flow])

  const commitSessions = useCallback(
    (updater: (prev: PlaygroundSession[]) => PlaygroundSession[]) => {
      setSessions((prev) => {
        const next = updater(prev)
        writePlaygroundSessions(flow.id, next, orgId)
        return next
      })
    },
    [flow.id, orgId],
  )

  const handleNewSession = useCallback(() => {
    const fresh = createDefaultPlaygroundSession(`Session ${sessions.length + 1}`)
    commitSessions((prev) => [fresh, ...prev])
    setActiveSessionId(fresh.id)
  }, [sessions.length, commitSessions])

  const handleClearSession = useCallback(() => {
    commitSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id ? { ...s, messages: [], updatedAt: new Date().toISOString() } : s,
      ),
    )
    onLiveStepsChange([])
  }, [activeSession.id, commitSessions, onLiveStepsChange])

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      commitSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== sessionId)
        const next = remaining.length > 0 ? remaining : [createDefaultPlaygroundSession()]
        if (activeSessionId === sessionId) setActiveSessionId(next[0]!.id)
        return next
      })
    },
    [activeSessionId, commitSessions],
  )

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setBusy(false)
  }, [])

  const runMessage = useCallback(
    async (text: string) => {
      const prompt = text.trim()
      if (!prompt || busy) return
      setDraft('')
      setModelMenuOpen(false)

      const userMsg: PlaygroundMessage = {
        id: `msg_u_${Date.now().toString(36)}`,
        role: 'user',
        content: prompt,
        createdAt: new Date().toISOString(),
      }
      const assistantId = `msg_a_${Date.now().toString(36)}`
      const assistantPlaceholder: PlaygroundMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        model: selectedModel,
        createdAt: new Date().toISOString(),
        steps: [],
        streaming: true,
      }

      const priorHistory: { role: 'user' | 'assistant'; content: string }[] = []
      for (let idx = 0; idx < activeSession.messages.length; idx++) {
        const m = activeSession.messages[idx]!
        if (m.error || !m.content.trim()) continue
        if (m.role === 'user') {
          const next = activeSession.messages[idx + 1]
          if (next?.role === 'assistant' && next.error) continue
        }
        priorHistory.push({ role: m.role, content: m.content })
      }

      commitSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? {
                ...s,
                updatedAt: new Date().toISOString(),
                messages: [...s.messages, userMsg, assistantPlaceholder],
              }
            : s,
        ),
      )

      const ctrl = new AbortController()
      abortRef.current = ctrl
      setBusy(true)

      const updateAssistant = (patch: Partial<PlaygroundMessage>) => {
        commitSessions((prev) =>
          prev.map((s) =>
            s.id === activeSession.id
              ? {
                  ...s,
                  updatedAt: new Date().toISOString(),
                  messages: s.messages.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)),
                }
              : s,
          ),
        )
      }

      try {
        const record = await executeFlow(flow, {
          trigger: 'playground',
          sampleInput: prompt,
          modelOverride: selectedModel,
          conversationHistory: priorHistory,
          signal: ctrl.signal,
          onStepUpdate: (steps) => {
            onLiveStepsChange(steps)
            updateAssistant({ steps })
          },
          onToken: (_delta, accumulated) => {
            updateAssistant({ content: accumulated, streaming: true })
          },
        })

        onRunRecorded(record)
        const failedStep = record.steps.find((st) => st.status === 'error')
        if (record.status === 'failed' || failedStep) {
          updateAssistant({
            streaming: false,
            steps: record.steps,
            error: failedStep?.error || record.summary || 'Flow execution failed.',
          })
        } else if (record.status === 'waiting_approval') {
          const gateStep = record.steps.find((st) => st.status === 'waiting_approval')
          updateAssistant({
            streaming: false,
            steps: record.steps,
            content: `${t('Paused for human approval')}: ${gateStep?.output || t('Open Run history to approve or reject continuing.')}`,
          })
        } else if (record.status === 'rejected') {
          updateAssistant({
            streaming: false,
            steps: record.steps,
            error: record.summary || t('Flow run was rejected at an approval gate.'),
          })
        } else {
          updateAssistant({
            streaming: false,
            steps: record.steps,
            content: record.finalOutput || record.summary || 'Completed.',
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        updateAssistant({
          streaming: false,
          error: ctrl.signal.aborted ? 'Execution stopped.' : msg || 'Unexpected execution error.',
        })
      } finally {
        abortRef.current = null
        setBusy(false)
      }
    },
    [activeSession, busy, commitSessions, flow, onLiveStepsChange, onRunRecorded, selectedModel],
  )

  const handleSend = useCallback(() => {
    const composed = composeText(draft)
    if (!composed) return
    clearCarried()
    void runMessage(composed)
  }, [draft, composeText, clearCarried, runMessage])

  const activeModelLabel = FLOW_MODELS.find((m) => m.id === selectedModel)?.label ?? selectedModel

  return (
    <YStack
      data-slot="flow-playground"
      position="absolute"
      t={0}
      l={0}
      r={0}
      b={0}
      z="var(--z-modal)"
      bg="var(--background)"
    >
      {/* Top Playground bar */}
      <XStack
        px="$4"
        py="$2.5"
        items="center"
        justify="space-between"
        borderBottomWidth={1}
        borderColor="$edge"
        bg="var(--card)"
        shrink={0}
      >
        <XStack items="center" gap="$2.5" minW={0}>
          <XStack
            width={26}
            height={26}
            rounded="$2"
            bg="$raised"
            borderWidth={1}
            borderColor="$edge"
            items="center"
            justify="center"
          >
            <HanzoMark size={14} />
          </XStack>
          <YStack minW={0}>
            <Text fontSize="$3" fontWeight="600" color="$ink" numberOfLines={1}>
              {t('Playground')} · {flow.name}
            </Text>
            <Text fontSize="$1" color="$quiet" numberOfLines={1}>
              {activeSession.name} · {selectedModel}
            </Text>
          </YStack>
        </XStack>

        <XStack items="center" gap="$2">
          <Button size="sm" variant="outline" data-slot="playground-clear-session" onPress={handleClearSession}>
            <RotateCcw size={13} aria-hidden />
            {t('Clear')}
          </Button>
          <XStack
            render="button"
            aria-label={t('Close Playground')}
            data-slot="playground-close"
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
      </XStack>

      {/* Main split: Sessions rail + Transcript & Composer */}
      <XStack flex={1} minW={0} minH={0} $max-md={{ flexDirection: 'column' }}>
        {/* Sessions Rail */}
        <YStack
          data-slot="playground-sessions"
          width={220}
          shrink={0}
          borderInlineEndWidth={1}
          borderColor="$edge"
          bg="var(--card)"
          p="$2.5"
          gap="$2"
          overflowY="auto"
          $max-md={{ width: '100%', borderInlineEndWidth: 0, borderBottomWidth: 1, maxH: 132 }}
        >
          <XStack items="center" justify="space-between" px="$1">
            <Text fontSize="$1" fontWeight="600" color="$soft">
              {t('Sessions')}
            </Text>
            <XStack
              render="button"
              data-slot="playground-new-session"
              onClick={handleNewSession}
              items="center"
              gap="$1"
              px="$2"
              py="$1"
              rounded="$2"
              bg="$raised"
              cursor="pointer"
              hoverStyle={{ bg: '$hover' }}
            >
              <Plus size={12} aria-hidden />
              <Text fontSize="$1" fontWeight="500" color="$ink">
                {t('New Session')}
              </Text>
            </XStack>
          </XStack>

          <YStack gap="$1">
            {sessions.map((sess) => {
              const isCurrent = sess.id === activeSession.id
              return (
                <XStack
                  key={sess.id}
                  data-slot={`playground-session-${sess.id}`}
                  items="center"
                  justify="space-between"
                  gap="$1.5"
                  px="$2"
                  py="$1.5"
                  rounded="$3"
                  bg={isCurrent ? '$raised' : 'transparent'}
                  hoverStyle={{ bg: isCurrent ? '$raised' : '$hover' }}
                >
                  <XStack
                    render="button"
                    flex={1}
                    minW={0}
                    items="center"
                    gap="$1.5"
                    cursor="pointer"
                    onClick={() => setActiveSessionId(sess.id)}
                  >
                    <MessageSquare size={12} color="var(--muted-foreground)" aria-hidden />
                    <YStack flex={1} minW={0} items="flex-start">
                      <Text fontSize="$2" fontWeight={isCurrent ? '600' : '400'} color="$ink" numberOfLines={1}>
                        {sess.name}
                      </Text>
                      <Text fontSize="$1" color="$quiet">
                        {sess.messages.length} {t('messages')}
                      </Text>
                    </YStack>
                  </XStack>
                  {sessions.length > 1 ? (
                    <XStack
                      render="button"
                      aria-label={t('Delete session')}
                      onClick={() => handleDeleteSession(sess.id)}
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

        {/* Conversation Transcript + Standard @hanzo/ui/chat Composer */}
        <YStack flex={1} minW={0} minH={0} bg="var(--background)">
          <YStack
            ref={scrollRef as never}
            data-slot="playground-transcript"
            flex={1}
            minH={0}
            overflowY="auto"
            overflowX="hidden"
            px="$5"
            py="$5"
            gap="$4"
          >
            <YStack width="100%" maxW={768} mx="auto" gap="$4">
              {activeSession.messages.length === 0 ? (
                <YStack items="center" py="$8" gap="$3">
                  <XStack
                    width={44}
                    height={44}
                    rounded="$4"
                    bg="var(--surface-card)"
                    borderWidth={1}
                    borderColor="var(--border-strong)"
                    items="center"
                    justify="center"
                  >
                    <HanzoMark size={22} />
                  </XStack>
                  <Text fontSize="$5" fontWeight="600" color="$ink" text="center">
                    {flow.name}
                  </Text>
                  <Text fontSize="$2" color="$soft" text="center" maxW={520}>
                    {flow.description}
                  </Text>
                  <XStack gap="$2" flexWrap="wrap" justify="center" pt="$2">
                    {templateStarters.map((starter) => (
                      <Box
                        key={starter}
                        render={<button type="button" />}
                        data-slot="playground-starter"
                        onClick={() => void runMessage(starter)}
                        px="$3"
                        py="$2"
                        rounded="$4"
                        bg="var(--surface-card)"
                        borderWidth={1}
                        borderColor="var(--border-strong)"
                        cursor="pointer"
                        hoverStyle={{ bg: 'var(--surface-card-emphasis)', borderColor: 'var(--border-focus)' }}
                      >
                        <Text fontSize="$2" color="$ink">
                          {starter}
                        </Text>
                      </Box>
                    ))}
                  </XStack>
                </YStack>
              ) : (
                activeSession.messages.map((msg, msgIndex) =>
                  msg.role === 'user' ? (
                    <XStack key={msg.id} justify="flex-end" data-slot="playground-user-msg">
                      <YStack
                        maxW="82%"
                        px="$4"
                        py="$2"
                        rounded={9999}
                        bg="var(--surface-card-emphasis)"
                      >
                        <Text fontSize="$3" color="$ink" $platform-web={{ whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                        </Text>
                      </YStack>
                    </XStack>
                  ) : (() => {
                    const priorUserPrompt = activeSession.messages
                      .slice(0, msgIndex)
                      .reverse()
                      .find((m) => m.role === 'user' && m.content.trim().length > 0)?.content
                    return (
                    <XStack key={msg.id} items="flex-start" gap="$3" data-slot="playground-assistant-msg">
                      <XStack
                        width={28}
                        height={28}
                        rounded={999}
                        bg="var(--surface-card)"
                        borderWidth={1}
                        borderColor="var(--border-strong)"
                        items="center"
                        justify="center"
                        shrink={0}
                        mt="$0.5"
                      >
                        <HanzoMark size={14} />
                      </XStack>
                      <YStack flex={1} minW={0} gap="$2">
                        <XStack items="center" gap="$2">
                          <Text fontSize="$2" fontWeight="600" color="$ink">
                            {t('Hanzo Flow')}
                          </Text>
                          {msg.model ? (
                            <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                              {msg.model}
                            </Text>
                          ) : null}
                          {msg.streaming ? <Loader2 size={12} color="var(--muted-foreground)" aria-hidden /> : null}
                        </XStack>

                        {/* Step-by-step live tool & node activity pills */}
                        {msg.steps && msg.steps.length > 0 ? (
                          <YStack gap="$1.5" data-slot="playground-step-pills">
                            <XStack gap="$1.5" flexWrap="wrap" items="center">
                              {msg.steps.map((step, idx) => {
                                const key = `${msg.id}:${step.nodeId}`
                                const open = expandedStepKey === key
                                return (
                                  <XStack key={step.nodeId} items="center" gap="$1">
                                    <Box
                                      render={<button type="button" />}
                                      data-slot={`playground-step-pill-${step.nodeId}`}
                                      aria-expanded={open}
                                      onClick={() => setExpandedStepKey(open ? null : key)}
                                      display="flex"
                                      items="center"
                                      gap="$1"
                                      px="$2"
                                      py="$1"
                                      rounded="$3"
                                      bg={open ? '$raised' : 'var(--surface-card)'}
                                      borderWidth={1}
                                      borderColor={
                                        step.status === 'error'
                                          ? 'var(--state-error)'
                                          : step.status === 'running'
                                            ? 'var(--border-selected)'
                                            : '$edge'
                                      }
                                      cursor="pointer"
                                      hoverStyle={{ borderColor: 'var(--border-strong)' }}
                                    >
                                      {step.status === 'running' ? (
                                        <Loader2 size={11} color="var(--foreground)" aria-hidden />
                                      ) : step.status === 'success' ? (
                                        <CheckCircle2 size={11} color="var(--state-online)" aria-hidden />
                                      ) : step.status === 'error' ? (
                                        <XCircle size={11} color="var(--state-error)" aria-hidden />
                                      ) : null}
                                      <Text fontSize="$1" color="$ink">
                                        {step.nodeTitle}
                                      </Text>
                                      {step.durationMs ? (
                                        <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                                          {step.durationMs}ms
                                        </Text>
                                      ) : null}
                                    </Box>
                                    {idx < msg.steps!.length - 1 ? (
                                      <Text fontSize="$1" color="$quiet">
                                        →
                                      </Text>
                                    ) : null}
                                  </XStack>
                                )
                              })}
                            </XStack>

                            {/* Expanded step input and output preview */}
                            {msg.steps.map((step) => {
                              const key = `${msg.id}:${step.nodeId}`
                              if (expandedStepKey !== key) return null
                              return (
                                <YStack
                                  key={`detail-${step.nodeId}`}
                                  data-slot="playground-step-detail"
                                  p="$2.5"
                                  rounded="$3"
                                  bg="var(--card)"
                                  borderWidth={1}
                                  borderColor="$edge"
                                  gap="$1"
                                >
                                  <Text fontSize="$1" fontWeight="600" color="$ink">
                                    {step.nodeTitle} · {step.status}
                                  </Text>
                                  <FlowStepIo step={step} />
                                </YStack>
                              )
                            })}
                          </YStack>
                        ) : null}

                        {/* Clear, actionable error callout (never silently vanishes) */}
                        {msg.error ? (
                          <XStack
                            data-slot="playground-error"
                            p="$3"
                            rounded="$3"
                            bg="var(--state-error-bg)"
                            borderWidth={1}
                            borderColor="var(--state-error)"
                            items="flex-start"
                            gap="$2"
                          >
                            <AlertCircle size={15} color="var(--state-error)" aria-hidden />
                            <YStack flex={1} minW={0} gap="$1.5">
                              <Text fontSize="$2" fontWeight="600" color="var(--state-error-text)">
                                {t('Flow run failed')}
                              </Text>
                              <Text fontSize="$2" color="$ink">
                                {msg.error}
                              </Text>
                              {priorUserPrompt ? (
                                <XStack pt="$1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    data-slot="playground-retry"
                                    disabled={busy}
                                    onPress={() => void runMessage(priorUserPrompt)}
                                  >
                                    <RotateCcw size={12} aria-hidden />
                                    {t('Retry')}
                                  </Button>
                                </XStack>
                              ) : null}
                            </YStack>
                          </XStack>
                        ) : null}

                        {/* Streamed / final markdown answer */}
                        {msg.content ? (
                          <YStack data-slot="playground-answer">
                            <Prose text={msg.content} />
                          </YStack>
                        ) : msg.streaming ? (
                          <Text fontSize="$2" color="$quiet">
                            {t('Running flow graph…')}
                          </Text>
                        ) : null}
                      </YStack>
                    </XStack>
                    )
                  })(),
                )
              )}
            </YStack>
          </YStack>

          {/* Bottom Standard @hanzo/ui/chat Composer (exact Home.tsx chrome) */}
          <YStack px="$4" pb="$4" pt="$2" shrink={0}>
            <YStack width="100%" maxW={768} mx="auto" position="relative">
              {/* Popover canonical Enso/Zen model picker */}
              {modelMenuOpen ? (
                <YStack
                  data-slot="playground-model-menu"
                  position="absolute"
                  b="100%"
                  l={0}
                  mb="$2"
                  width={240}
                  p="$1.5"
                  rounded="$4"
                  bg="var(--surface-overlay)"
                  borderWidth={1}
                  borderColor="var(--border-strong)"
                  z="var(--z-popover)"
                  gap="$0.5"
                >
                  {FLOW_MODELS.map((m) => {
                    const chosen = m.id === selectedModel
                    return (
                      <XStack
                        key={m.id}
                        render="button"
                        data-model-id={m.id}
                        onClick={() => {
                          setSelectedModel(m.id)
                          setModelMenuOpen(false)
                        }}
                        items="center"
                        justify="space-between"
                        px="$2.5"
                        py="$1.5"
                        rounded="$2"
                        bg={chosen ? '$raised' : 'transparent'}
                        cursor="pointer"
                        hoverStyle={{ bg: '$hover' }}
                      >
                        <Text fontSize="$2" fontWeight={chosen ? '600' : '400'} color="$ink">
                          {m.label}
                        </Text>
                        <Text fontSize="$1" fontFamily="$mono" color="$quiet">
                          {m.id}
                        </Text>
                      </XStack>
                    )
                  })}
                </YStack>
              ) : null}

              <YStack
                data-slot="flow-playground-composer"
                width="100%"
                rounded={17}
              >
                <Composer
                  value={draft}
                  onChange={setDraft}
                  onSend={handleSend}
                  onStop={handleStop}
                  ready={Boolean(draft.trim()) || hasCarried}
                  plus={plus}
                  carried={carried}
                  busy={busy}
                  placeholder={t('Message {flow}…', { flow: flow.name })}
                  label={t('Message {flow}', { flow: flow.name })}
                  rows={2}
                  maxHeight={220}
                >
                  <XStack items="center" gap="$1.5">
                    <Box
                      render={<button type="button" />}
                      data-slot="playground-model-pill"
                      aria-label={t('Select Enso model')}
                      onClick={() => setModelMenuOpen((v) => !v)}
                      display="inline-flex"
                      items="center"
                      gap="$1.5"
                      px="$2.5"
                      py="$1"
                      rounded="$10"
                      bg="$raised"
                      borderWidth={1}
                      borderColor="var(--border-strong)"
                      cursor="pointer"
                      hoverStyle={{ bg: '$hover', borderColor: 'var(--border-focus)' }}
                    >
                      <Sparkles size={12} color="var(--foreground)" aria-hidden />
                      <Text fontSize="$1" fontWeight="500" color="$ink">
                        {activeModelLabel}
                      </Text>
                      <ChevronDown size={12} color="var(--muted-foreground)" aria-hidden />
                    </Box>
                  </XStack>
                </Composer>
              </YStack>
            </YStack>
          </YStack>
        </YStack>
      </XStack>
    </YStack>
  )
}
