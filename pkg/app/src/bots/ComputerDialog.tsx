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
  X,
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
  opened,
  parkComputer,
  runDesktopAgent,
  updateBotMeta,
  type BotAgent,
} from './api'
import { CLIP, PILL, ROUND, WORD } from './kit'
import { DIM, EDGE, FLOOR, GROUND, INK, LINE, PICKED, RAISED } from './ink'
import { useDevMode } from '../lib/dev-mode'
import { confirming, useSpend } from '../Confirm'

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
              bg={INK}
              opacity={active ? 1 : 0.3}
            />
          )
        })}
      </XStack>
      <Text fontSize={13} lineHeight={18} fontWeight="500" color={DIM}>
        {label}
      </Text>
    </YStack>
  )
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
  const [devMode] = useDevMode()
  const { client } = useAi()
  const displayName = called(bot.name)

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const controlRef = useRef<'watching' | 'controlling'>('watching')

  const [localBox, setLocalBox] = useState<Sandbox | null>(box)
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<'screen' | 'terminal'>('screen')
  const [control, setControl] = useState<'watching' | 'controlling'>('watching')
  controlRef.current = control
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
    if (!box) return
    setLocalBox((prev) => {
      if (prev?.status === 'running' && box.status !== 'running') {
        return prev
      }
      return box
    })
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
          const finalUrl = opened(g.url, kind === 'screen' ? wantViewOnly : undefined)
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
    async () => {
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
          await openStream(leased.id, effectiveMode, controlRef.current === 'watching')
        } else {
          // Poll up to ~25s while the sandbox container schedules & boots X11
          for (let attempt = 0; attempt < 12; attempt++) {
            await new Promise((r) => window.setTimeout(r, 2000))
            const latest = await findBotComputer(client, { ...bot, computeRef: leased.id })
            if (latest) setLocalBox(latest)
            if (latest?.status === 'running') {
              await onUpdated()
              await openStream(
                latest.id,
                latest.class === 'desktop' ? mode : 'terminal',
                controlRef.current === 'watching',
              )
              break
            }
          }
        }
        setStatusToast(t('Desktop ready.'))
      } catch (e) {
        setError(say(e, t('{name}’s desktop computer', { name: displayName }), 'save', t))
        setPhase('idle')
      } finally {
        setBusy(false)
      }
    },
    [client, busy, bot, activeBox, onUpdated, mode, openStream, displayName, t],
  )

  // Opening shows a desktop that is already running; it never starts one. A cloud desktop is
  // rented, so it starts only on Start desktop, after the person says yes.
  // Intentionally reads `controlRef.current` rather than depending on `control` so
  // clicking `Take control` / `Watching` sends instant postMessage without reloading the iframe.
  useEffect(() => {
    if (!open) {
      setFrameUrl(null)
      setSnapDataUrl(null)
      setError(null)
      setStatusToast(null)
      setControl('watching')
      setPhase('idle')
      return
    }

    if (activeBox?.id && activeBox.status === 'running') {
      const effectiveMode = activeBox.class === 'desktop' ? mode : 'terminal'
      void openStream(activeBox.id, effectiveMode, controlRef.current === 'watching')
    }
  }, [open, activeBox?.id, activeBox?.status, activeBox?.class, mode, openStream])

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

  const runAutofill = async (
    item: VaultItem,
    field: 'login' | 'login_totp' | 'username' | 'password' | 'totp' | 'secret',
  ) => {
    if (!client || !activeBox?.id || runningTask) return
    setRunningTask(true)
    setError(null)
    setStatusToast(null)
    try {
      const out = await actComputer(client, {
        id: activeBox.id,
        action: 'autofill',
        credential: item.id || item.domain || item.name,
        field,
        submit: field === 'login' || field === 'login_totp' || field === 'totp',
      })
      if (out.ok === false) {
        setError(out.text || t('Could not autofill {name}.', { name: item.name }))
        return
      }
      setStatusToast(
        out.text ||
          (field === 'totp'
            ? devMode
              ? t('Typed 6-digit 2FA code for {name} via KMS.', { name: item.name })
              : t('Entered 6-digit verification code for {name}.', { name: item.name })
            : devMode
              ? t('Autofilled {name} via zero-knowledge KMS.', { name: item.name })
              : t('Filled login for {name}.', { name: item.name })),
      )
    } catch (e) {
      setError(say(e, t('credential autofill'), 'save', t))
    } finally {
      setRunningTask(false)
    }
  }

  const sealStagedAppCredential = async () => {
    if (!client || !activeBox?.id || runningTask) return
    setRunningTask(true)
    setError(null)
    setStatusToast(null)
    try {
      const out = await actComputer(client, {
        id: activeBox.id,
        action: 'save_credential',
      })
      if (out.ok === false) {
        setError(
          out.text ||
            (devMode
              ? t('No staged credential found at /dev/shm/.hanzo-credential.json.')
              : t('No staged app login found to save.')),
        )
        return
      }
      await refreshVault()
      setStatusToast(
        out.text ||
          (devMode
            ? t('Sealed sandbox app credential into Hanzo KMS and shredded RAM file.')
            : t('Saved login to your vault.')),
      )
    } catch (e) {
      setError(say(e, t('sandbox credential save'), 'save', t))
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
      if (out.ok === false) {
        setError(out.text || t('Could not capture desktop screenshot.'))
        return
      }
      if (out.image) {
        setSnapDataUrl(
          out.image.startsWith('data:') ? out.image : `data:${out.mimeType || 'image/jpeg'};base64,${out.image}`,
        )
        setStatusToast(t('Captured {w}×{h} frame.', { w: out.width || 1280, h: out.height || 800 }))
      }
    } catch (e) {
      setError(say(e, t('desktop screenshot'), 'read', t))
    } finally {
      setRunningTask(false)
    }
  }

  const desktop = useSpend(
    'bot-desktop',
    t('Start a cloud desktop?'),
    t('This starts a cloud desktop for {name}. It keeps running until you pause it.', { name: displayName }),
    t('Start desktop'),
  )
  const run = useSpend('bot-task', t('Run this task now?'), t('{name} starts working on it right away.', { name: displayName }), t('Run task'))

  // A task is a run of the bot: it asks first, through the one spend confirm.
  const submitComputerTask = (e?: FormEvent, preset?: string) => {
    e?.preventDefault()
    const prompt = (preset ?? task).trim()
    if (!client || !prompt || runningTask) return
    run.ask(() => void runTask(prompt, Boolean(preset)))
  }

  const runTask = async (prompt: string, preset: boolean) => {
    if (!client) return
    setRunningTask(true)
    setError(null)
    setStatusToast(null)
    if (!preset) setTask('')
    // Automatically switch to Watching mode so the user sees the bot move the cursor live
    if (control === 'controlling') toggleControl('watching')
    try {
      if (activeBox?.id) {
        const ran = await runDesktopAgent(activeBox.id, prompt, (step) => {
          setStatusToast(step)
        })
        if (ran.savedCredential) {
          await refreshVault()
        }
        setStatusToast(ran.output || t('Task completed on desktop computer.'))
      } else {
        if (!bot.tools?.length) {
          await updateBotMeta(client, bot.name, { tools: ['*'], computeRef: bot.computeRef }).catch(() => null)
        }
        const ran = await client.http.json<{ output?: string; error?: string }>({
          method: 'POST',
          path: `/v1/agent/${encodeURIComponent(bot.name)}/run`,
          body: { input: prompt },
        })
        setStatusToast(ran.output || ran.error || t('Task completed on desktop computer.'))
        await onUpdated()
      }
    } catch (err) {
      setError(say(err, t('desktop computer task'), 'save', t))
    } finally {
      setRunningTask(false)
    }
  }

  useEffect(() => {
    if (!open || vaultOpen) return
    const onKey = (e: KeyboardEvent) => {
      // Escape in a confirm over this dialog closes the confirm alone.
      if (e.key === 'Escape' && !confirming()) {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, vaultOpen, onOpenChange])

  const logins = vaultItems.filter((i) => i.kind === 'login')
  const otherSecrets = vaultItems.filter((i) => i.kind !== 'login')
  const showBottomBar = phase === 'connecting' || phase === 'live' || awake

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-parity-key="bots.computer.dialog"
          width="calc(100vw - 24px)"
          maxW={expanded ? 1480 : 1140}
          $max-sm={{ width: 'calc(100vw - 24px)', maxW: 'calc(100vw - 24px)', rounded: 14 }}
          p={0}
          showCloseButton={false}
          bg={GROUND}
          borderWidth={1}
          borderColor={EDGE}
          rounded={18}
          overflow="hidden"
        >
          {/* The confirms open INSIDE this dialog, stacked over it: Escape or Cancel closes the confirm alone. */}
          {desktop.dialog}
          {run.dialog}
          <YStack height={expanded ? '92vh' : '86vh'} maxH="94vh" bg={GROUND} minW={0}>
            {/* Clean monochrome window top chrome */}
            <XStack
              minH={46}
              px={14}
              py={6}
              $max-sm={{ px: 10, py: 8, gap: 8 }}
              items="center"
              justify="space-between"
              flexWrap="wrap"
              gap={10}
              borderBottomWidth={1}
              borderColor={LINE}
              bg={FLOOR}
              shrink={0}
            >
              <XStack items="center" gap={10} minW={0} flex={1}>
                <YStack
                  width={8}
                  height={8}
                  rounded={999}
                  shrink={0}
                  bg={awake ? 'var(--state-online)' : DIM}
                  opacity={awake ? 1 : 0.45}
                  aria-hidden
                />
                <DialogTitle>
                  <Text {...CLIP} fontSize="$2" lineHeight={18} fontWeight="500" color={INK}>
                    {awake
                      ? devMode
                        ? `${displayName} · ${activeBox?.id ?? disk(bot.name)}`
                        : `${displayName} · ${t('Cloud desktop')}`
                      : phase === 'parked'
                        ? `${displayName} · ${t('Paused')}`
                        : `${displayName} · ${t('Cloud desktop')}`}
                  </Text>
                </DialogTitle>
              </XStack>

              <XStack items="center" gap={6} flexWrap="wrap" shrink={0}>
                {awake && activeBox?.id ? (
                  <>
                    {devMode || mode === 'terminal' ? (
                      <XStack
                        render="button"
                        {...{ type: 'button' }}
                        aria-label={mode === 'screen' ? t('Switch to terminal') : t('Switch to desktop')}
                        onClick={() => {
                          setSnapDataUrl(null)
                          setMode((m) => (m === 'screen' ? 'terminal' : 'screen'))
                        }}
                        height={28}
                        $max-sm={{ minH: 44 }}
                        px={10}
                        gap={5}
                        rounded={999}
                        items="center"
                        bg={RAISED}
                        borderWidth={1}
                        borderColor={EDGE}
                        cursor="pointer"
                        transition="quickest"
                        hoverStyle={{ bg: PICKED }}
                        focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                      >
                        {mode === 'screen' ? (
                          <Terminal size={12} color={INK} aria-hidden />
                        ) : (
                          <Monitor size={12} color={INK} aria-hidden />
                        )}
                        <Text fontSize="$1" lineHeight={15} color={INK}>
                          {mode === 'screen' ? t('Terminal') : t('Desktop')}
                        </Text>
                      </XStack>
                    ) : null}

                    <DropdownMenu placement="bottom-end" offset={6}>
                      <DropdownMenuTrigger asChild>
                        <XStack
                          render="button"
                          {...{ type: 'button' }}
                          aria-label={t('Autofill login or secret')}
                          height={28}
                          $max-sm={{ minH: 44 }}
                          px={10}
                          gap={5}
                          rounded={999}
                          items="center"
                          bg={RAISED}
                          borderWidth={1}
                          borderColor={EDGE}
                          cursor="pointer"
                          transition="quickest"
                          hoverStyle={{ bg: PICKED }}
                          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                        >
                          <KeyRound size={12} color={INK} aria-hidden />
                          <Text fontSize={11} lineHeight={15} color={INK}>
                            {t('Autofill')}
                          </Text>
                        </XStack>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent minW={260}>
                        {logins.map((item) => (
                          <DropdownMenuItem
                            key={item.id}
                            onSelect={() => void runAutofill(item, item.totpSecretKey ? 'login_totp' : 'login')}
                          >
                            <YStack gap={1}>
                              <Text fontSize="$3" fontWeight="500" color="$ink">
                                {`${item.name}${item.domain ? ` (${item.domain})` : ''}`}
                              </Text>
                              <Text fontSize="$1" color={DIM}>
                                {item.username
                                  ? item.totpSecretKey
                                    ? t('Fill {user} + password + 2FA via {src}', {
                                        user: item.username,
                                        src: item.source,
                                      })
                                    : t('Fill {user} + password via {src}', { user: item.username, src: item.source })
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
                                {t('2FA TOTP code only · {name}', { name: item.name })}
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
                        {devMode ? (
                          <DropdownMenuItem onSelect={() => void sealStagedAppCredential()}>
                            <YStack gap={1}>
                              <Text fontFamily="$body" fontSize="$2" fontWeight="600" color="$ink">
                                {t('Seal staged sandbox app login → KMS')}
                              </Text>
                              <Text fontFamily="$body" fontSize="$1" color={DIM}>
                                {t('Imports /dev/shm/.hanzo-credential.json & shreds RAM file')}
                              </Text>
                            </YStack>
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onSelect={() => setVaultOpen(true)}>
                          <Text fontFamily="$body" fontSize="$2" fontWeight="600" color="$ink">
                            {vaultItems.length === 0
                              ? devMode
                                ? t('+ Add 1Password, LastPass, or KMS logins…')
                                : t('Add saved logins…')
                              : devMode
                                ? t('Manage vault & password managers…')
                                : t('Manage saved logins…')}
                          </Text>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      aria-label={t('Paste clipboard to desktop')}
                      onClick={() => void pasteClipboardToDesktop()}
                      width={28}
                      height={28}
                      $max-sm={{ width: 44, height: 44 }}
                      rounded={999}
                      items="center"
                      justify="center"
                      bg="transparent"
                      borderWidth={0}
                      cursor="pointer"
                      transition="quickest"
                      hoverStyle={{ bg: PICKED }}
                      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    >
                      <ClipboardPaste size={13} color={DIM} aria-hidden />
                    </XStack>

                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      aria-label={t('Capture screenshot')}
                      onClick={() => void captureScreenshot()}
                      width={28}
                      height={28}
                      $max-sm={{ width: 44, height: 44 }}
                      rounded={999}
                      items="center"
                      justify="center"
                      bg="transparent"
                      borderWidth={0}
                      cursor="pointer"
                      transition="quickest"
                      hoverStyle={{ bg: PICKED }}
                      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    >
                      <Camera size={13} color={DIM} aria-hidden />
                    </XStack>

                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      aria-label={t('Reconnect stream')}
                      onClick={() => {
                        setSnapDataUrl(null)
                        void openStream(activeBox.id, mode, control === 'watching')
                      }}
                      width={28}
                      height={28}
                      $max-sm={{ width: 44, height: 44 }}
                      rounded={999}
                      items="center"
                      justify="center"
                      bg="transparent"
                      borderWidth={0}
                      cursor="pointer"
                      transition="quickest"
                      hoverStyle={{ bg: PICKED }}
                      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    >
                      <RefreshCw size={13} color={DIM} aria-hidden />
                    </XStack>

                    {frameUrl ? (
                      <XStack
                        render="button"
                        {...{ type: 'button' }}
                        aria-label={t('Open stream in new tab')}
                        onClick={() => window.open(frameUrl, '_blank', 'noopener,noreferrer')}
                        width={28}
                        height={28}
                        $max-sm={{ width: 44, height: 44 }}
                        rounded={999}
                        items="center"
                        justify="center"
                        bg="transparent"
                        borderWidth={0}
                        cursor="pointer"
                        transition="quickest"
                        hoverStyle={{ bg: PICKED }}
                        focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                      >
                        <ExternalLink size={13} color={DIM} aria-hidden />
                      </XStack>
                    ) : null}

                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      aria-label={t('Park desktop')}
                      disabled={busy}
                      onClick={() => void handlePark()}
                      height={28}
                      $max-sm={{ minH: 44 }}
                      px={10}
                      gap={4}
                      rounded={999}
                      items="center"
                      bg={RAISED}
                      borderWidth={1}
                      borderColor={EDGE}
                      cursor="pointer"
                      transition="quickest"
                      hoverStyle={{ bg: PICKED }}
                      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    >
                      <Pause size={11} color={INK} aria-hidden />
                      <Text fontSize={11} lineHeight={15} color={INK}>
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
                  $max-sm={{ display: 'none' }}
                  rounded={999}
                  items="center"
                  justify="center"
                  bg="transparent"
                  borderWidth={0}
                  cursor="pointer"
                  transition="quickest"
                  hoverStyle={{ bg: PICKED }}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                >
                  {expanded ? (
                    <Minimize2 size={14} color={DIM} aria-hidden />
                  ) : (
                    <Maximize2 size={14} color={DIM} aria-hidden />
                  )}
                </XStack>

                <XStack
                  {...ROUND}
                  width={30}
                  height={30}
                  borderColor={EDGE}
                  focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                  $max-sm={{ width: 44, height: 44 }}
                  aria-label={t('Close computer window')}
                  onClick={() => onOpenChange(false)}
                >
                  <X size={15} color={INK} aria-hidden />
                </XStack>
              </XStack>
            </XStack>

            {/* Main Desktop Screen Canvas */}
            <YStack flex={1} minH={0} px={10} pt={10} pb={showBottomBar ? 0 : 12} items="center" justify="center">
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
                  <Text fontSize="$3" lineHeight={22} fontWeight="600" color={INK} text="center">
                    {phase === 'parked' ? t('Desktop is paused') : t('{name}’s cloud desktop', { name: displayName })}
                  </Text>
                  <Text fontSize="$2" lineHeight={19} maxW={440} color={DIM} text="center">
                    {devMode
                      ? t('Persistent home volume preserves open files, browser sessions, and tools across sleep/wake cycles.')
                      : t('Keeps open files, browser tabs, and logins ready whenever you resume.')}
                  </Text>
                  {error ? (
                    <Text role="alert" fontSize={12} lineHeight={17} color="var(--state-error)" text="center">
                      {error}
                    </Text>
                  ) : null}
                  <XStack
                    {...PILL}
                    bg={INK}
                    borderColor={INK}
                    hoverStyle={{ opacity: 0.9 }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    $max-sm={{ minH: 44 }}
                    disabled={busy}
                    onClick={() => desktop.ask(() => void startOrResume())}
                  >
                    <Play size={13} color="var(--background)" aria-hidden />
                    <Text {...WORD} color="var(--background)">
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
                        <XStack
                          {...PILL}
                          height={30}
                          $max-sm={{ minH: 44 }}
                          px={12}
                          bg={RAISED}
                          borderColor={EDGE}
                          focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                          onClick={() => setSnapDataUrl(null)}
                        >
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
              <YStack px={14} $max-sm={{ px: 10 }} pt={10} gap={8}>
                <XStack render="form" {...{ onSubmit: (e: FormEvent) => void submitComputerTask(e) }} gap={8} items="center" flexWrap="wrap">
                  <Input
                    unstyled
                    autoFocus
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    placeholder={
                      devMode
                        ? t(
                            'Tell {name} what to do on this desktop (e.g., "Log in with my GitHub vault credentials and review open PRs")…',
                            { name: displayName },
                          )
                        : t('Tell {name} what to do on this desktop…', { name: displayName })
                    }
                    aria-label={t('Co-work with {name} on desktop', { name: displayName })}
                    flex={1}
                    minW={180}
                    height={36}
                    $max-sm={{ minH: 44 }}
                    px={14}
                    rounded={999}
                    bg={RAISED}
                    borderWidth={1}
                    borderColor={EDGE}
                    focusStyle={{ borderColor: 'var(--ring)' }}
                    color={INK}
                    fontSize={13}
                    placeholderTextColor="$placeholderColor"
                  />
                  <XStack
                    {...PILL}
                    {...{ type: 'submit' }}
                    height={36}
                    $max-sm={{ minH: 44 }}
                    px={14}
                    bg={INK}
                    borderColor={INK}
                    hoverStyle={{ opacity: 0.9 }}
                    focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    disabled={!task.trim() || runningTask}
                    opacity={!task.trim() || runningTask ? 0.5 : 1}
                  >
                    <Send size={12} color="var(--background)" aria-hidden />
                    <Text {...WORD} fontSize={12} color="var(--background)">
                      {runningTask ? t('Working…') : t('Run on desktop')}
                    </Text>
                  </XStack>
                </XStack>
              </YStack>
            ) : null}

            {/* Floating Bottom Control Dock */}
            {showBottomBar ? (
              <XStack
                minH={58}
                px={14}
                py={8}
                $max-sm={{ px: 10, gap: 8, justify: 'center' }}
                items="center"
                justify="space-between"
                flexWrap="wrap"
                gap={10}
                shrink={0}
              >
                <XStack flex={1} items="center" gap={8} minW={0} $max-sm={{ display: error || statusToast ? 'flex' : 'none', width: '100%', justify: 'center' }}>
                  {error ? (
                    <Text {...CLIP} role="alert" fontSize={12} lineHeight={16} color="var(--state-error)">
                      {error}
                    </Text>
                  ) : statusToast ? (
                    <Text {...CLIP} fontSize={12} lineHeight={16} color={DIM}>
                      {statusToast}
                    </Text>
                  ) : null}
                </XStack>

                {/* Centerpiece pill: `Watching` | `Take control` */}
                <XStack
                  data-parity-key="bots.computer.control-pill"
                  height={38}
                  $max-sm={{ minH: 44 }}
                  pl={14}
                  pr={5}
                  gap={12}
                  rounded={999}
                  items="center"
                  bg={RAISED}
                  borderWidth={1}
                  borderColor={EDGE}
                >
                  <XStack items="center" gap={7}>
                    {control === 'watching' ? (
                      <Eye size={14} color={DIM} aria-hidden />
                    ) : (
                      <MousePointerClick size={14} color="var(--state-online)" aria-hidden />
                    )}
                    <Text fontSize={13} lineHeight={18} fontWeight="500" color={INK}>
                      {control === 'watching' ? t('Watching') : t('In control')}
                    </Text>
                  </XStack>

                  {control === 'watching' ? (
                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      onClick={() => toggleControl('controlling')}
                      height={28}
                      $max-sm={{ minH: 36 }}
                      px={13}
                      rounded={999}
                      items="center"
                      justify="center"
                      bg={INK}
                      borderWidth={0}
                      cursor="pointer"
                      transition="quickest"
                      hoverStyle={{ opacity: 0.9 }}
                      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    >
                      <Text fontSize={12} lineHeight={16} fontWeight="600" color="var(--background)">
                        {t('Take control')}
                      </Text>
                    </XStack>
                  ) : (
                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      onClick={() => toggleControl('watching')}
                      height={28}
                      $max-sm={{ minH: 36 }}
                      px={13}
                      rounded={999}
                      items="center"
                      justify="center"
                      bg={PICKED}
                      borderWidth={1}
                      borderColor={EDGE}
                      cursor="pointer"
                      transition="quickest"
                      hoverStyle={{ bg: GROUND }}
                      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    >
                      <Text fontSize={12} lineHeight={16} fontWeight="500" color={INK}>
                        {t('Watch only')}
                      </Text>
                    </XStack>
                  )}
                </XStack>

                <XStack flex={1} items="center" justify="flex-end" gap={8} $max-sm={{ flex: 0, justify: 'center' }}>
                  {awake ? (
                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      onClick={() => setPromptOpen((v) => !v)}
                      height={30}
                      $max-sm={{ minH: 44 }}
                      px={11}
                      gap={6}
                      rounded={999}
                      items="center"
                      bg={promptOpen ? PICKED : 'transparent'}
                      borderWidth={1}
                      borderColor={promptOpen ? EDGE : 'transparent'}
                      cursor="pointer"
                      transition="quickest"
                      hoverStyle={{ bg: RAISED, borderColor: EDGE }}
                      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: 'var(--ring)' }}
                    >
                      <Sparkles size={12} color={DIM} aria-hidden />
                      <Text fontSize={12} lineHeight={16} color={INK}>
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
