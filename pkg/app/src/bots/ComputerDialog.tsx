'use client'

// Sleek, resumable macOS-framed Desktop Sandbox Computer modal for every bot on hanzo.bot:
// - Auto-boots or resumes persistent per-bot desktop sandbox (`Starting desktop` -> `Connecting` -> live 60fps X11/noVNC stream)
// - Floating bottom-center pill: `👁 Watching` | `[Take control]` (instant live toggle via postMessage to screen/page.html)
// - Native Desktop GUI + Interactive Terminal modes, Clipboard paste, Screenshot, Park/Sleep & instant Resume
// - Zero-knowledge 1-click Login & 2FA TOTP Autofill (`action: 'autofill'`) from Unified Vault (Hanzo KMS, 1Password, LastPass)
// - Co-working prompt drawer so you can watch the bot click, browse, log in, and work in real time or jump in yourself.

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { Sandbox } from '@hanzo/ai'
import { useI18n } from '@hanzo/i18n/react'
import { Input, Text, XStack, YStack } from '@hanzo/gui'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@hanzo/ui'
import {
  Camera,
  ClipboardPaste,
  ExternalLink,
  Eye,
  KeyRound,
  Maximize2,
  Minimize2,
  Monitor,
  MousePointerClick,
  Pause,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Terminal,
} from 'lucide-react'
import { useAi } from '../lib/ai'
import { say } from '../failure'
import { called } from '../team'
import { VaultDialog, readVault, type VaultItem } from '../vault'
import {
  actComputer,
  bootOrResumeComputer,
  disk,
  findBotComputer,
  grant,
  parkComputer,
  updateBotMeta,
  type BotAgent,
} from './api'
import { CLIP, PILL, ROUND, WORD } from './kit'
import { DIM, FLOOR, GROUND, INK, LINE, PICKED, RAISED } from './ink'

function PulsingCluster({ label }: { label: string }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % 3), 480)
    return () => window.clearInterval(id)
  }, [])

  return (
    <YStack items="center" justify="center" gap={18} aria-live="polite">
      <XStack items="center" justify="center" gap={6} height={20}>
        {[0, 1, 2].map((i) => {
          const active = step === i
          const mid = i === 1
          return (
            <YStack
              key={i}
              width={mid ? 7 : 4}
              height={mid ? 7 : 4}
              rounded={999}
              bg="var(--pure-white)"
              opacity={active ? 1 : 0.35}
            />
          )
        })}
      </XStack>
      <Text fontSize={13} lineHeight={18} fontWeight="500" color="var(--pure-white)" opacity={0.58}>
        {label}
      </Text>
    </YStack>
  )
}

function appendViewParam(rawUrl: string, viewOnly: boolean): string {
  try {
    const u = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : 'https://api.hanzo.ai')
    u.searchParams.set('viewOnly', viewOnly ? '1' : '0')
    return u.toString()
  } catch {
    const join = rawUrl.includes('?') ? '&' : '?'
    return `${rawUrl}${join}viewOnly=${viewOnly ? '1' : '0'}`
  }
}

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

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const autoBootedRef = useRef(false)

  const [localBox, setLocalBox] = useState<Sandbox | null>(box)
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<'screen' | 'terminal'>('screen')
  const [control, setControl] = useState<'watching' | 'controlling'>('watching')
  const [phase, setPhase] = useState<'idle' | 'starting' | 'connecting' | 'live' | 'parked'>('idle')
  const [frameUrl, setFrameUrl] = useState<string | null>(null)
  const [snapDataUrl, setSnapDataUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [task, setTask] = useState('')
  const [runningTask, setRunningTask] = useState(false)
  const [statusToast, setStatusToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [vaultOpen, setVaultOpen] = useState(false)
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([])

  useEffect(() => {
    if (box) setLocalBox(box)
  }, [box])

  const activeBox = localBox ?? box
  const awake = activeBox?.status === 'running'

  const refreshVault = useCallback(async () => {
    const doc = await readVault()
    setVaultItems(doc.items)
  }, [])

  useEffect(() => {
    if (open) void refreshVault()
  }, [open, refreshVault])

  // Listen for live state handshakes from `apps/sandbox/screen/page.html`
  useEffect(() => {
    if (!open) return
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as { type?: string; state?: string; viewOnly?: boolean } | null
      if (!data || data.type !== 'hanzo-screen-state') return
      if (data.state === 'connected') {
        setPhase('live')
      } else if (data.state === 'connecting') {
        setPhase((prev) => (prev === 'live' ? 'live' : 'connecting'))
      }
      if (typeof data.viewOnly === 'boolean') {
        setControl(data.viewOnly ? 'watching' : 'controlling')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [open])

  const openStream = useCallback(
    async (targetId: string, kind: 'screen' | 'terminal', wantViewOnly: boolean) => {
      if (!client) return
      setError(null)
      setPhase('connecting')
      try {
        const g = await grant(client, targetId, kind)
        if (g.url) {
          const finalUrl = kind === 'screen' ? appendViewParam(g.url, wantViewOnly) : g.url
          setFrameUrl(finalUrl)
          // Terminal or older edge screen page without postMessage transitions smoothly after load
          window.setTimeout(() => {
            setPhase((cur) => (cur === 'connecting' ? 'live' : cur))
          }, 1600)
        } else {
          setError(t('Desktop stream ticket was minted without a stream URL.'))
          setPhase('idle')
        }
      } catch (e) {
        setError(say(e, t('{name}’s desktop stream', { name: displayName }), 'read', t))
        setPhase('idle')
      }
    },
    [client, displayName, t],
  )

  const startOrResume = useCallback(
    async (manual = false) => {
      if (!client || busy) return
      setBusy(true)
      setError(null)
      setSnapDataUrl(null)
      setPhase('starting')
      try {
        const leased = await bootOrResumeComputer(client, bot, activeBox)
        setLocalBox(leased)
        await onUpdated()

        if (leased.status === 'running') {
          const effectiveMode = leased.class === 'desktop' ? mode : 'terminal'
          await openStream(leased.id, effectiveMode, control === 'watching')
        } else {
          // Poll up to ~25s while the sandbox container schedules & boots X11
          for (let attempt = 0; attempt < 12; attempt++) {
            await new Promise((r) => window.setTimeout(r, 2000))
            const latest = await findBotComputer(client, { ...bot, computeRef: leased.id })
            if (latest) setLocalBox(latest)
            if (latest?.status === 'running') {
              await onUpdated()
              await openStream(latest.id, latest.class === 'desktop' ? mode : 'terminal', control === 'watching')
              break
            }
          }
        }
        if (manual) {
          setStatusToast(t('Desktop ready.'))
        }
      } catch (e) {
        setError(say(e, t('{name}’s desktop computer', { name: displayName }), 'save', t))
        setPhase('idle')
      } finally {
        setBusy(false)
      }
    },
    [client, busy, bot, activeBox, onUpdated, mode, openStream, control, displayName, t],
  )

  // Auto-open live stream if running, or auto-boot/resume on open!
  useEffect(() => {
    if (!open) {
      autoBootedRef.current = false
      setFrameUrl(null)
      setSnapDataUrl(null)
      setError(null)
      setStatusToast(null)
      setControl('watching')
      setPhase('idle')
      return
    }

    if (activeBox?.id && activeBox.status === 'running') {
      autoBootedRef.current = true
      const effectiveMode = activeBox.class === 'desktop' ? mode : 'terminal'
      void openStream(activeBox.id, effectiveMode, control === 'watching')
      return
    }

    if (!autoBootedRef.current && client) {
      autoBootedRef.current = true
      void startOrResume(false)
    }
  }, [open, activeBox?.id, activeBox?.status, activeBox?.class, mode, client, openStream, startOrResume, control])

  const toggleControl = (nextControl: 'watching' | 'controlling') => {
    setControl(nextControl)
    const viewOnly = nextControl === 'watching'
    try {
      iframeRef.current?.contentWindow?.postMessage({ type: 'hanzo-screen-control', viewOnly }, '*')
      if (!viewOnly) {
        iframeRef.current?.focus()
      }
    } catch {
      // ignore cross-frame focus errors
    }
  }

  const handlePark = async () => {
    if (!client || !activeBox?.id || busy) return
    setBusy(true)
    setError(null)
    try {
      await parkComputer(client, activeBox.id)
      setFrameUrl(null)
      setLocalBox((prev) => (prev ? { ...prev, status: 'stopped' as Sandbox['status'] } : null))
      setPhase('parked')
      setStatusToast(t('Desktop parked — workspace disk is preserved and resumes instantly.'))
      await onUpdated()
    } catch (e) {
      setError(say(e, t('{name}’s desktop computer', { name: displayName }), 'save', t))
    } finally {
      setBusy(false)
    }
  }

  const pasteClipboardToDesktop = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      iframeRef.current?.contentWindow?.postMessage({ type: 'hanzo-screen-clipboard', text }, '*')
      if (client && activeBox?.id) {
        await actComputer(client, { id: activeBox.id, action: 'type', text })
      }
      setStatusToast(t('Pasted clipboard to desktop.'))
    } catch {
      setError(t('Grant browser clipboard permission or take control to paste directly.'))
    }
  }

  const runAutofill = async (item: VaultItem, field: 'login' | 'username' | 'password' | 'totp' | 'secret') => {
    if (!client || !activeBox?.id || runningTask) return
    setRunningTask(true)
    setError(null)
    setStatusToast(null)
    try {
      await actComputer(client, {
        id: activeBox.id,
        action: 'autofill',
        credential: item.id || item.domain || item.name,
        field,
        submit: field === 'login' || field === 'totp',
      })
      setStatusToast(
        field === 'totp'
          ? t('Typed 6-digit 2FA code for {name} via KMS.', { name: item.name })
          : t('Autofilled {name} via zero-knowledge KMS.', { name: item.name }),
      )
    } catch (e) {
      setError(say(e, t('credential autofill'), 'save', t))
    } finally {
      setRunningTask(false)
    }
  }

  const captureScreenshot = async () => {
    if (!client || !activeBox?.id || runningTask) return
    setRunningTask(true)
    setError(null)
    try {
      const out = await actComputer(client, { id: activeBox.id, action: 'screenshot' })
      if (out.image) {
        setSnapDataUrl(`data:${out.mimeType || 'image/png'};base64,${out.image}`)
        setStatusToast(t('Captured {w}×{h} frame.', { w: out.width || 1280, h: out.height || 800 }))
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
    setStatusToast(null)
    if (!preset) setTask('')
    // Automatically switch to Watching mode so the user sees the bot move the cursor live
    if (control === 'controlling') toggleControl('watching')
    try {
      if (!bot.tools?.length) {
        await updateBotMeta(client, bot.name, { tools: ['*'], computeRef: activeBox?.id || bot.computeRef }).catch(() => null)
      }
      const directive = `[Desktop Computer Use] Use your resumable desktop sandbox computer (computer_in_sandbox — screenshot, click, move, drag, type, key, scroll, navigate, autofill for KMS/1Password/LastPass logins, and shell) to complete this task while I watch live:\n\n${prompt}`
      const ran = await client.agents.run(bot.name, directive)
      setStatusToast(ran.output || ran.error || t('Task completed on desktop computer.'))
      await onUpdated()
    } catch (err) {
      setError(say(err, t('desktop computer task'), 'save', t))
    } finally {
      setRunningTask(false)
    }
  }

  const logins = vaultItems.filter((i) => i.kind === 'login')
  const otherSecrets = vaultItems.filter((i) => i.kind !== 'login')
  const showBottomBar = phase === 'connecting' || phase === 'live' || awake

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-parity-key="bots.computer.dialog"
          width={expanded ? '98vw' : '95vw'}
          maxW={expanded ? 1480 : 1140}
          p={0}
          showCloseButton={false}
          bg="var(--pure-black)"
          borderWidth={1}
          borderColor={LINE}
          rounded={18}
          overflow="hidden"
        >
          <YStack height={expanded ? '94vh' : '86vh'} maxH="95vh" bg="var(--pure-black)">
            {/* Sleek macOS window top chrome (`• • •` left, native tools + expand/collapse right) */}
            <XStack height={44} px={16} items="center" justify="space-between" gap={12} shrink={0}>
              <XStack items="center" gap={12} minW={0}>
                <XStack items="center" gap={8} shrink={0}>
                  <YStack
                    render="button"
                    {...{ type: 'button' }}
                    aria-label={t('Close computer window')}
                    onClick={() => onOpenChange(false)}
                    width={12}
                    height={12}
                    rounded={999}
                    bg="var(--chrome-dot-red)"
                    borderWidth={0}
                    p={0}
                    cursor="pointer"
                  />
                  <YStack
                    render="button"
                    {...{ type: 'button' }}
                    aria-label={t('Park desktop computer')}
                    onClick={() => (awake ? void handlePark() : onOpenChange(false))}
                    width={12}
                    height={12}
                    rounded={999}
                    bg="var(--chrome-dot-yellow)"
                    borderWidth={0}
                    p={0}
                    cursor="pointer"
                  />
                  <YStack
                    render="button"
                    {...{ type: 'button' }}
                    aria-label={expanded ? t('Exit fullscreen size') : t('Expand computer window')}
                    onClick={() => setExpanded((v) => !v)}
                    width={12}
                    height={12}
                    rounded={999}
                    bg="var(--chrome-dot-green)"
                    borderWidth={0}
                    p={0}
                    cursor="pointer"
                  />
                </XStack>

                <DialogTitle>
                  <Text {...CLIP} fontSize={12} lineHeight={16} fontWeight="500" color="var(--pure-white)" opacity={0.55}>
                    {awake
                      ? `${displayName} · ${activeBox?.id ?? disk(bot.name)}`
                      : phase === 'parked'
                        ? `${displayName} · ${t('Parked (resumable)')}`
                        : `${displayName} · ${t('Desktop')}`}
                  </Text>
                </DialogTitle>
              </XStack>

              <XStack items="center" gap={6}>
                {awake && activeBox?.id ? (
                  <>
                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      aria-label={mode === 'screen' ? t('Switch to Terminal') : t('Switch to Desktop GUI')}
                      onClick={() => {
                        setSnapDataUrl(null)
                        setMode((m) => (m === 'screen' ? 'terminal' : 'screen'))
                      }}
                      height={26}
                      px={9}
                      gap={5}
                      rounded={999}
                      items="center"
                      bg={RAISED}
                      borderWidth={1}
                      borderColor={LINE}
                      cursor="pointer"
                    >
                      {mode === 'screen' ? (
                        <Terminal size={12} color="var(--pure-white)" aria-hidden />
                      ) : (
                        <Monitor size={12} color="var(--pure-white)" aria-hidden />
                      )}
                      <Text fontSize={11} lineHeight={15} color="var(--pure-white)" opacity={0.85}>
                        {mode === 'screen' ? t('Terminal') : t('Desktop')}
                      </Text>
                    </XStack>

                    <DropdownMenu placement="bottom-end" offset={6}>
                      <DropdownMenuTrigger asChild>
                        <XStack
                          render="button"
                          {...{ type: 'button' }}
                          aria-label={t('Autofill login or secret')}
                          height={26}
                          px={9}
                          gap={5}
                          rounded={999}
                          items="center"
                          bg={RAISED}
                          borderWidth={1}
                          borderColor={LINE}
                          cursor="pointer"
                        >
                          <KeyRound size={12} color="var(--pure-white)" aria-hidden />
                          <Text fontSize={11} lineHeight={15} color="var(--pure-white)" opacity={0.85}>
                            {t('Autofill')}
                          </Text>
                        </XStack>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent minW={240}>
                        {logins.map((item) => (
                          <DropdownMenuItem key={item.id} onSelect={() => void runAutofill(item, 'login')}>
                            <YStack gap={1}>
                              <Text fontSize="$3" fontWeight="500" color="$ink">
                                {`${item.name}${item.domain ? ` (${item.domain})` : ''}`}
                              </Text>
                              <Text fontSize="$1" color={DIM}>
                                {item.username
                                  ? t('Fill {user} + password via {src}', { user: item.username, src: item.source })
                                  : t('Fill password via {src}', { src: item.source })}
                              </Text>
                            </YStack>
                          </DropdownMenuItem>
                        ))}
                        {logins
                          .filter((i) => Boolean(i.totpSecretKey))
                          .map((item) => (
                            <DropdownMenuItem key={`${item.id}-totp`} onSelect={() => void runAutofill(item, 'totp')}>
                              <Text fontSize="$2" color="$ink">
                                {t('2FA TOTP code · {name}', { name: item.name })}
                              </Text>
                            </DropdownMenuItem>
                          ))}
                        {otherSecrets.slice(0, 5).map((item) => (
                          <DropdownMenuItem key={item.id} onSelect={() => void runAutofill(item, 'secret')}>
                            <Text fontSize="$2" color="$ink">
                              {t('Type secret · {name}', { name: item.name })}
                            </Text>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem onSelect={() => setVaultOpen(true)}>
                          <Text fontSize="$2" fontWeight="600" color="$ink">
                            {vaultItems.length === 0
                              ? t('+ Add 1Password, LastPass, or KMS logins…')
                              : t('Manage Vault & Password Managers…')}
                          </Text>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      aria-label={t('Paste clipboard to desktop')}
                      onClick={() => void pasteClipboardToDesktop()}
                      width={26}
                      height={26}
                      rounded={999}
                      items="center"
                      justify="center"
                      bg="transparent"
                      borderWidth={0}
                      cursor="pointer"
                      hoverStyle={{ bg: RAISED }}
                    >
                      <ClipboardPaste size={13} color="var(--pure-white)" opacity={0.7} aria-hidden />
                    </XStack>

                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      aria-label={t('Capture screenshot')}
                      onClick={() => void captureScreenshot()}
                      width={26}
                      height={26}
                      rounded={999}
                      items="center"
                      justify="center"
                      bg="transparent"
                      borderWidth={0}
                      cursor="pointer"
                      hoverStyle={{ bg: RAISED }}
                    >
                      <Camera size={13} color="var(--pure-white)" opacity={0.7} aria-hidden />
                    </XStack>

                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      aria-label={t('Reconnect stream')}
                      onClick={() => {
                        setSnapDataUrl(null)
                        void openStream(activeBox.id, mode, control === 'watching')
                      }}
                      width={26}
                      height={26}
                      rounded={999}
                      items="center"
                      justify="center"
                      bg="transparent"
                      borderWidth={0}
                      cursor="pointer"
                      hoverStyle={{ bg: RAISED }}
                    >
                      <RefreshCw size={13} color="var(--pure-white)" opacity={0.7} aria-hidden />
                    </XStack>

                    {frameUrl ? (
                      <XStack
                        render="button"
                        {...{ type: 'button' }}
                        aria-label={t('Open stream in new tab')}
                        onClick={() => window.open(frameUrl, '_blank', 'noopener,noreferrer')}
                        width={26}
                        height={26}
                        rounded={999}
                        items="center"
                        justify="center"
                        bg="transparent"
                        borderWidth={0}
                        cursor="pointer"
                        hoverStyle={{ bg: RAISED }}
                      >
                        <ExternalLink size={13} color="var(--pure-white)" opacity={0.7} aria-hidden />
                      </XStack>
                    ) : null}

                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      aria-label={t('Park desktop')}
                      disabled={busy}
                      onClick={() => void handlePark()}
                      height={26}
                      px={9}
                      gap={4}
                      rounded={999}
                      items="center"
                      bg={RAISED}
                      borderWidth={1}
                      borderColor={LINE}
                      cursor="pointer"
                    >
                      <Pause size={11} color="var(--pure-white)" aria-hidden />
                      <Text fontSize={11} lineHeight={15} color="var(--pure-white)" opacity={0.85}>
                        {t('Park')}
                      </Text>
                    </XStack>
                  </>
                ) : null}

                <XStack
                  render="button"
                  {...{ type: 'button' }}
                  aria-label={expanded ? t('Collapse window') : t('Expand window')}
                  onClick={() => setExpanded((v) => !v)}
                  width={28}
                  height={28}
                  rounded={8}
                  items="center"
                  justify="center"
                  bg="transparent"
                  borderWidth={0}
                  cursor="pointer"
                  hoverStyle={{ bg: RAISED }}
                >
                  {expanded ? (
                    <Minimize2 size={14} color="var(--pure-white)" opacity={0.65} aria-hidden />
                  ) : (
                    <Maximize2 size={14} color="var(--pure-white)" opacity={0.65} aria-hidden />
                  )}
                </XStack>
              </XStack>
            </XStack>

            {/* Main Desktop Screen Canvas (`Starting desktop` -> framed `Connecting` -> live X11 desktop) */}
            <YStack flex={1} minH={0} px={10} pt={4} pb={showBottomBar ? 0 : 12} items="center" justify="center">
              {phase === 'starting' && !frameUrl ? (
                <YStack flex={1} width="100%" items="center" justify="center">
                  <PulsingCluster label={t('Starting desktop')} />
                </YStack>
              ) : phase === 'parked' || (!awake && !busy && !frameUrl) ? (
                <YStack
                  flex={1}
                  width="100%"
                  rounded={12}
                  borderWidth={1}
                  borderColor={LINE}
                  bg={FLOOR}
                  items="center"
                  justify="center"
                  gap={14}
                  px={24}
                >
                  <Text fontSize={16} lineHeight={22} fontWeight="600" color="var(--pure-white)" text="center">
                    {phase === 'parked' ? t('Desktop is parked') : t('{name}’s resumable desktop', { name: displayName })}
                  </Text>
                  <Text fontSize={13} lineHeight={19} maxW={440} color="var(--pure-white)" opacity={0.62} text="center">
                    {t(
                      'Persistent home volume preserves open files, browser sessions, and tools across sleep/wake cycles.',
                    )}
                  </Text>
                  {error ? (
                    <Text role="alert" fontSize={12} lineHeight={17} color="var(--pure-white)" opacity={0.75} text="center">
                      {error}
                    </Text>
                  ) : null}
                  <XStack
                    {...PILL}
                    bg="var(--pure-white)"
                    borderColor="var(--pure-white)"
                    disabled={busy}
                    onClick={() => void startOrResume(true)}
                  >
                    <Play size={13} color="var(--pure-black)" aria-hidden />
                    <Text {...WORD} color="var(--pure-black)">
                      {phase === 'parked' ? t('Resume desktop') : t('Start desktop')}
                    </Text>
                  </XStack>
                </YStack>
              ) : (
                <YStack
                  flex={1}
                  width="100%"
                  rounded={10}
                  borderWidth={1}
                  borderColor={LINE}
                  bg={FLOOR}
                  overflow="hidden"
                  position="relative"
                  items="center"
                  justify="center"
                >
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
                            {t('Back to live desktop')}
                          </Text>
                        </XStack>
                      </XStack>
                    </YStack>
                  ) : frameUrl ? (
                    <YStack
                      ref={iframeRef as never}
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
                    <PulsingCluster label={t('Connecting')} />
                  )}
                </YStack>
              )}
            </YStack>

            {/* Optional Co-Working Task Drawer */}
            {promptOpen && awake ? (
              <YStack px={16} pt={10} gap={8}>
                <XStack render="form" {...{ onSubmit: (e: FormEvent) => void submitComputerTask(e) }} gap={8} items="center">
                  <Input
                    unstyled
                    autoFocus
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    placeholder={t(
                      'Tell {name} what to do on this desktop (e.g., "Log in with my GitHub vault credentials and review open PRs")…',
                      { name: displayName },
                    )}
                    aria-label={t('Co-work with {name} on desktop', { name: displayName })}
                    flex={1}
                    height={36}
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
                    height={36}
                    px={14}
                    bg="var(--pure-white)"
                    borderColor="var(--pure-white)"
                    disabled={!task.trim() || runningTask}
                    opacity={!task.trim() || runningTask ? 0.5 : 1}
                  >
                    <Send size={12} color="var(--pure-black)" aria-hidden />
                    <Text {...WORD} fontSize={12} color="var(--pure-black)">
                      {runningTask ? t('Working…') : t('Run on desktop')}
                    </Text>
                  </XStack>
                </XStack>
              </YStack>
            ) : null}

            {/* Floating Bottom Control Dock (`👁 Watching` | `[Take control]` centerpiece matching reference) */}
            {showBottomBar ? (
              <XStack height={58} px={16} items="center" justify="space-between" gap={12} shrink={0}>
                <XStack flex={1} items="center" gap={8} minW={0}>
                  {error ? (
                    <Text {...CLIP} role="alert" fontSize={12} lineHeight={16} color="var(--pure-white)" opacity={0.75}>
                      {error}
                    </Text>
                  ) : statusToast ? (
                    <Text {...CLIP} fontSize={12} lineHeight={16} color="var(--pure-white)" opacity={0.68}>
                      {statusToast}
                    </Text>
                  ) : null}
                </XStack>

                {/* Centerpiece pill: `👁 Watching` | `[Take control]` */}
                <XStack
                  data-parity-key="bots.computer.control-pill"
                  height={38}
                  pl={14}
                  pr={5}
                  gap={12}
                  rounded={999}
                  items="center"
                  bg={RAISED}
                  borderWidth={1}
                  borderColor={LINE}
                >
                  <XStack items="center" gap={7}>
                    {control === 'watching' ? (
                      <Eye size={14} color="var(--pure-white)" opacity={0.75} aria-hidden />
                    ) : (
                      <MousePointerClick size={14} color="var(--state-online)" aria-hidden />
                    )}
                    <Text fontSize={13} lineHeight={18} fontWeight="500" color="var(--pure-white)" opacity={0.88}>
                      {control === 'watching' ? t('Watching') : t('In control')}
                    </Text>
                  </XStack>

                  {control === 'watching' ? (
                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      onClick={() => toggleControl('controlling')}
                      height={28}
                      px={13}
                      rounded={999}
                      items="center"
                      justify="center"
                      bg="var(--pure-white)"
                      borderWidth={0}
                      cursor="pointer"
                    >
                      <Text fontSize={12} lineHeight={16} fontWeight="600" color="var(--pure-black)">
                        {t('Take control')}
                      </Text>
                    </XStack>
                  ) : (
                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      onClick={() => toggleControl('watching')}
                      height={28}
                      px={13}
                      rounded={999}
                      items="center"
                      justify="center"
                      bg={PICKED}
                      borderWidth={1}
                      borderColor={LINE}
                      cursor="pointer"
                    >
                      <Text fontSize={12} lineHeight={16} fontWeight="500" color="var(--pure-white)">
                        {t('Watch only')}
                      </Text>
                    </XStack>
                  )}
                </XStack>

                <XStack flex={1} items="center" justify="flex-end" gap={8}>
                  {awake ? (
                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      onClick={() => setPromptOpen((v) => !v)}
                      height={30}
                      px={11}
                      gap={6}
                      rounded={999}
                      items="center"
                      bg={promptOpen ? PICKED : 'transparent'}
                      borderWidth={1}
                      borderColor={promptOpen ? LINE : 'transparent'}
                      cursor="pointer"
                      hoverStyle={{ bg: RAISED }}
                    >
                      <Sparkles size={12} color="var(--pure-white)" opacity={0.78} aria-hidden />
                      <Text fontSize={12} lineHeight={16} color="var(--pure-white)" opacity={0.78}>
                        {runningTask ? t('{name} working…', { name: displayName }) : t('Work with {name}', { name: displayName })}
                      </Text>
                    </XStack>
                  ) : null}
                </XStack>
              </XStack>
            ) : null}
          </YStack>
        </DialogContent>
      </Dialog>

      <VaultDialog
        open={vaultOpen}
        onOpenChange={(next) => {
          setVaultOpen(next)
          if (!next) void refreshVault()
        }}
        onAutofill={awake ? (item, field) => void runAutofill(item, field ?? 'login') : undefined}
        onChanged={(doc) => setVaultItems(doc.items)}
      />
    </>
  )
}
