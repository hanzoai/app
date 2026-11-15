'use client'

// Embedded Desktop Sandbox Computer modal for any bot on hanzo.bot:
// - Live interactive X11 GUI desktop (`screen` ticket -> noVNC) + interactive shell (`terminal` ticket)
// - Persistent per-bot disk (`bot-<name>`) and `computeRef` binding on the bot record
// - Full Computer Use task bar so the user can watch the bot click, type, browse,
//   take screenshots, and run commands on its dedicated desktop in real time.

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Sandbox } from '@hanzo/ai'
import { useI18n } from '@hanzo/i18n/react'
import { Input, Text, XStack, YStack } from '@hanzo/gui'
import { Dialog, DialogContent, DialogTitle } from '@hanzo/ui'
import { Camera, ExternalLink, Monitor, Pause, Play, RefreshCw, Send, Terminal, X } from 'lucide-react'
import { useAi } from '../lib/ai'
import { say } from '../failure'
import { called } from '../team'
import { Face } from './face'
import { actComputer, disk, grant, parkComputer, updateBotMeta, type BotAgent } from './api'
import { CLIP, PILL, ROUND, WORD } from './kit'
import { DIM, FLOOR, GROUND, INK, LINE, PICKED, RAISED } from './ink'

export function ComputerDialog({
  open,
  onOpenChange,
  bot,
  box,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  bot: BotAgent
  box: Sandbox | null
  onUpdated: () => void | Promise<void>
}) {
  const { t } = useI18n()
  const { client } = useAi()
  const displayName = called(bot.name)

  const [mode, setMode] = useState<'screen' | 'terminal'>('screen')
  const [frameUrl, setFrameUrl] = useState<string | null>(null)
  const [snapDataUrl, setSnapDataUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [task, setTask] = useState('')
  const [runningTask, setRunningTask] = useState(false)
  const [lastAnswer, setLastAnswer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const awake = box?.status === 'running'
  const waking = box?.status === 'pending'

  const openStream = useCallback(
    async (targetId: string, kind: 'screen' | 'terminal') => {
      if (!client) return
      setError(null)
      try {
        const g = await grant(client, targetId, kind)
        if (g.url) {
          setFrameUrl(g.url)
        } else {
          setError(t('Desktop stream ticket was minted without a stream URL.'))
        }
      } catch (e) {
        setError(say(e, t('{name}’s desktop stream', { name: displayName }), 'read', t))
      }
    },
    [client, displayName, t],
  )

  useEffect(() => {
    if (!open) {
      setFrameUrl(null)
      setSnapDataUrl(null)
      setError(null)
      return
    }
    if (box?.id && box.status === 'running') {
      const effectiveMode = box.class === 'desktop' ? mode : 'terminal'
      void openStream(box.id, effectiveMode)
    } else {
      setFrameUrl(null)
    }
  }, [open, box?.id, box?.status, box?.class, mode, openStream])

  const startComputer = async () => {
    if (!client || busy) return
    setBusy(true)
    setError(null)
    try {
      const leased = await client.sandboxes.lease({ class: 'desktop', project: disk(bot.name) })
      if (leased?.id && bot.computeRef !== leased.id) {
        await updateBotMeta(client, bot.name, { computeRef: leased.id, tools: ['*'] }).catch(() => null)
      }
      await onUpdated()
      if (leased?.id && leased.status === 'running') {
        await openStream(leased.id, 'screen')
      }
    } catch (e) {
      setError(say(e, t('{name}’s desktop computer', { name: displayName }), 'save', t))
    } finally {
      setBusy(false)
    }
  }

  const handlePark = async () => {
    if (!client || !box?.id || busy) return
    setBusy(true)
    setError(null)
    try {
      await parkComputer(client, box.id)
      setFrameUrl(null)
      await onUpdated()
    } catch (e) {
      setError(say(e, t('{name}’s desktop computer', { name: displayName }), 'save', t))
    } finally {
      setBusy(false)
    }
  }

  const captureScreenshot = async () => {
    if (!client || !box?.id || runningTask) return
    setRunningTask(true)
    setError(null)
    try {
      const out = await actComputer(client, { id: box.id, action: 'screenshot' })
      if (out.image) {
        setSnapDataUrl(`data:${out.mimeType || 'image/png'};base64,${out.image}`)
        setLastAnswer(t('Captured live {w}×{h} desktop frame.', { w: out.width || 1280, h: out.height || 800 }))
      }
    } catch (e) {
      setError(say(e, t('desktop screenshot'), 'read', t))
    } finally {
      setRunningTask(false)
    }
  }

  const submitComputerTask = async (e?: FormEvent, preset?: string) => {
    e?.preventDefault()
    const prompt = (preset ?? task).trim()
    if (!client || !prompt || runningTask) return
    setRunningTask(true)
    setError(null)
    setLastAnswer(null)
    if (!preset) setTask('')
    try {
      // Ensure the bot has full tool access so `computer_in_sandbox` is active on the run.
      if (!bot.tools?.length) {
        await updateBotMeta(client, bot.name, { tools: ['*'], computeRef: box?.id || bot.computeRef }).catch(() => null)
      }
      const directive = `[Desktop Computer Use] Use your desktop sandbox computer (computer_in_sandbox — screenshot, click, move, drag, type, key, scroll, navigate, shell) to complete this task and report what you did:\n\n${prompt}`
      const ran = await client.agents.run(bot.name, directive)
      setLastAnswer(ran.output || ran.error || t('Task completed on desktop computer.'))
      await onUpdated()
    } catch (err) {
      setError(say(err, t('desktop computer task'), 'save', t))
    } finally {
      setRunningTask(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-parity-key="bots.computer.dialog"
        width="95vw"
        maxW={1060}
        p={0}
        showCloseButton={false}
        bg={GROUND}
        borderWidth={1}
        borderColor={LINE}
        rounded={18}
        overflow="hidden"
      >
        <YStack maxH="90vh" bg={GROUND}>
          <XStack
            px={18}
            py={12}
            items="center"
            justify="space-between"
            gap={12}
            flexWrap="wrap"
            bg={FLOOR}
            borderBottomWidth={1}
            borderColor={LINE}
          >
            <XStack items="center" gap={10} minW={0}>
              <Face bot={bot} size={34} starred={Boolean(bot.isPrimary)} />
              <YStack minW={0}>
                <DialogTitle>
                  <Text {...CLIP} fontSize={15} lineHeight={20} fontWeight="600" color={INK}>
                    {t('{name}’s Desktop Computer', { name: displayName })}
                  </Text>
                </DialogTitle>
                <XStack items="center" gap={7}>
                  <YStack
                    width={7}
                    height={7}
                    rounded={999}
                    bg={awake ? 'var(--state-online)' : waking ? 'var(--chrome-dot-yellow)' : DIM}
                  />
                  <Text fontSize={12} lineHeight={16} color={DIM}>
                    {awake
                      ? `${t('Awake')} · ${box?.id ?? disk(bot.name)}`
                      : waking
                        ? t('Starting desktop sandbox…')
                        : `${t('Asleep')} · ${disk(bot.name)}`}
                  </Text>
                </XStack>
              </YStack>
            </XStack>

            <XStack items="center" gap={8} flexWrap="wrap">
              <XStack p={3} rounded={999} bg={RAISED} borderWidth={1} borderColor={LINE} gap={2}>
                {(
                  [
                    { id: 'screen', label: t('Desktop GUI'), Icon: Monitor },
                    { id: 'terminal', label: t('Terminal'), Icon: Terminal },
                  ] as const
                ).map(({ id, label, Icon }) => {
                  const active = mode === id
                  return (
                    <XStack
                      key={id}
                      render="button"
                      {...{ type: 'button' }}
                      onClick={() => {
                        setSnapDataUrl(null)
                        setMode(id)
                      }}
                      height={28}
                      px={12}
                      gap={6}
                      rounded={999}
                      items="center"
                      bg={active ? PICKED : 'transparent'}
                      borderWidth={0}
                      cursor="pointer"
                    >
                      <Icon size={13} color={active ? INK : DIM} aria-hidden />
                      <Text fontSize={12} lineHeight={16} fontWeight={active ? '500' : '400'} color={active ? INK : DIM}>
                        {label}
                      </Text>
                    </XStack>
                  )
                })}
              </XStack>

              {awake && box?.id ? (
                <>
                  <XStack
                    {...ROUND}
                    width={32}
                    height={32}
                    aria-label={t('Capture screenshot')}
                    onClick={() => void captureScreenshot()}
                  >
                    <Camera size={14} color={INK} aria-hidden />
                  </XStack>
                  <XStack
                    {...ROUND}
                    width={32}
                    height={32}
                    aria-label={t('Refresh desktop stream')}
                    onClick={() => {
                      setSnapDataUrl(null)
                      void openStream(box.id, mode)
                    }}
                  >
                    <RefreshCw size={14} color={INK} aria-hidden />
                  </XStack>
                  {frameUrl ? (
                    <XStack
                      {...ROUND}
                      width={32}
                      height={32}
                      aria-label={t('Open in new tab')}
                      onClick={() => window.open(frameUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink size={14} color={INK} aria-hidden />
                    </XStack>
                  ) : null}
                  <XStack
                    {...PILL}
                    height={32}
                    px={12}
                    disabled={busy}
                    onClick={() => void handlePark()}
                  >
                    <Pause size={12} color={INK} aria-hidden />
                    <Text fontSize={12} lineHeight={16} fontWeight="500" color={INK}>
                      {t('Park')}
                    </Text>
                  </XStack>
                </>
              ) : (
                <XStack
                  {...PILL}
                  height={32}
                  px={13}
                  bg={INK}
                  borderColor={INK}
                  disabled={busy || waking}
                  opacity={busy || waking ? 0.5 : 1}
                  onClick={() => void startComputer()}
                >
                  <Play size={12} color="var(--background)" aria-hidden />
                  <Text fontSize={12} lineHeight={16} fontWeight="500" color="var(--background)">
                    {busy || waking ? t('Waking…') : t('Wake Desktop')}
                  </Text>
                </XStack>
              )}

              <XStack {...ROUND} width={32} height={32} aria-label={t('Close')} onClick={() => onOpenChange(false)}>
                <X size={15} color={INK} aria-hidden />
              </XStack>
            </XStack>
          </XStack>

          <YStack height={470} bg="var(--pure-black)" items="center" justify="center" position="relative" overflow="hidden">
            {snapDataUrl ? (
              <YStack width="100%" height="100%" items="center" justify="center" position="relative">
                <YStack
                  render="img"
                  {...{ src: snapDataUrl, alt: `${displayName} desktop screenshot` }}
                  maxW="100%"
                  maxH="100%"
                  objectFit="contain"
                />
                <XStack position="absolute" t={12} r={12}>
                  <XStack {...PILL} height={30} px={12} onClick={() => setSnapDataUrl(null)}>
                    <Text fontSize={12} lineHeight={16} color={INK}>
                      {t('Back to live stream')}
                    </Text>
                  </XStack>
                </XStack>
              </YStack>
            ) : awake && frameUrl ? (
              <YStack
                render="iframe"
                {...{
                  src: frameUrl,
                  title: `${displayName} desktop ${mode}`,
                  allow: 'clipboard-read; clipboard-write; fullscreen',
                }}
                width="100%"
                height="100%"
                borderWidth={0}
              />
            ) : (
              <YStack maxW={460} px={24} items="center" gap={14}>
                <YStack
                  width={56}
                  height={56}
                  rounded={16}
                  bg={RAISED}
                  borderWidth={1}
                  borderColor={LINE}
                  items="center"
                  justify="center"
                >
                  <Monitor size={24} color={INK} aria-hidden />
                </YStack>
                <Text fontSize={17} lineHeight={23} fontWeight="600" color="var(--pure-white)" text="center">
                  {waking ? t('Booting X11 Desktop Sandbox…') : t('Dedicated Desktop Sandbox Computer')}
                </Text>
                <Text fontSize={13} lineHeight={19} color="var(--pure-white)" opacity={0.72} text="center">
                  {t(
                    'Every bot gets its own isolated Linux GUI desktop with Chromium, persistent workspace disk ({disk}), and full Computer Use — mouse clicks, drags, keyboard typing, live screenshots, and shell execution.',
                    { disk: disk(bot.name) },
                  )}
                </Text>
                <XStack
                  {...PILL}
                  bg="var(--pure-white)"
                  borderColor="var(--pure-white)"
                  disabled={busy || waking}
                  opacity={busy || waking ? 0.5 : 1}
                  onClick={() => void startComputer()}
                >
                  <Play size={14} color="var(--pure-black)" aria-hidden />
                  <Text {...WORD} color="var(--pure-black)">
                    {busy || waking ? t('Starting computer…') : t('Start Desktop Computer')}
                  </Text>
                </XStack>
              </YStack>
            )}
          </YStack>

          <YStack px={18} py={12} gap={10} bg={FLOOR} borderTopWidth={1} borderColor={LINE}>
            {error ? (
              <Text role="alert" fontSize={12} lineHeight={17} color={DIM}>
                {error}
              </Text>
            ) : null}

            {lastAnswer ? (
              <YStack px={12} py={9} rounded={10} bg={RAISED} borderWidth={1} borderColor={LINE} maxH={96} overflowY="auto">
                <Text fontSize={12} lineHeight={17} color={INK}>
                  {lastAnswer}
                </Text>
              </YStack>
            ) : null}

            <XStack render="form" {...{ onSubmit: (e: FormEvent) => void submitComputerTask(e) }} gap={8} items="center">
              <Input
                unstyled
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder={t('Ask {name} to use its computer (open a URL, click UI, inspect logs, run tests…)', {
                  name: displayName,
                })}
                aria-label={t('Computer Use directive')}
                flex={1}
                height={38}
                px={14}
                rounded={999}
                bg={RAISED}
                borderWidth={1}
                borderColor={LINE}
                color={INK}
                fontSize={13}
                placeholderTextColor="$placeholderColor"
              />
              <XStack
                {...PILL}
                {...{ type: 'submit' }}
                height={38}
                px={15}
                bg={INK}
                borderColor={INK}
                disabled={!task.trim() || runningTask}
                opacity={!task.trim() || runningTask ? 0.45 : 1}
              >
                <Send size={13} color="var(--background)" aria-hidden />
                <Text {...WORD} fontSize={13} color="var(--background)">
                  {runningTask ? t('Working…') : t('Computer Use')}
                </Text>
              </XStack>
            </XStack>

            <XStack items="center" gap={6} flexWrap="wrap">
              <Text fontSize={11} lineHeight={15} color={DIM}>
                {t('Quick actions:')}
              </Text>
              {[
                { label: t('Open hanzo.ai in browser'), prompt: 'Navigate to https://hanzo.ai on the desktop browser, take a screenshot, and summarize what is visible.' },
                { label: t('Inspect workspace & tools'), prompt: 'Run uname -a, check installed browsers and developer tools in your sandbox, and take a desktop screenshot.' },
              ].map((q) => (
                <XStack
                  key={q.label}
                  render="button"
                  {...{ type: 'button' }}
                  disabled={runningTask}
                  onClick={() => void submitComputerTask(undefined, q.prompt)}
                  height={25}
                  px={10}
                  rounded={999}
                  items="center"
                  bg={RAISED}
                  borderWidth={1}
                  borderColor={LINE}
                  cursor="pointer"
                  hoverStyle={{ bg: PICKED }}
                >
                  <Text fontSize={11} lineHeight={15} color={DIM}>
                    {q.label}
                  </Text>
                </XStack>
              ))}
            </XStack>
          </YStack>
        </YStack>
      </DialogContent>
    </Dialog>
  )
}
