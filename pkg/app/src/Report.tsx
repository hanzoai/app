'use client'

// "Something broke — Report it": the quiet toast, the sheet it opens, and the
// boundary that catches a render that threw. ONE MOUNT POINT: App wraps itself
// in <Report>, and Help in the account menu opens the same sheet with
// `reportProblem()`.
//
// Nothing leaves the device before the person presses Send. The sheet lists what
// goes (the error, the page path, the version, the browser, the console's last
// lines with secrets taken out, and the screenshot if it is kept), shows the
// screenshot, and can show the exact text of the issue.

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Dialog, DialogContent, DialogTitle, Input, SizableText, Text, Textarea, View, XStack, YStack } from '@hanzo/ui'
import { useI18n } from '@hanzo/i18n/react'
import { body, catches, details, DISCORD_HELP_URL, hear, listen, screenOf, send, type Caught, type Filed } from './fault'
import { useHost } from './host'
import { talk } from './lib/host'
import { shoot } from './shot'
import { superAdmin } from './lib/session'

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback below */
  }
  try {
    if (typeof document === 'undefined') return false
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

const OPEN = 'hanzo:report'

/** Opens the report sheet by hand: Help's "Report a problem". */
export const reportProblem = (): void => void window.dispatchEvent(new CustomEvent(OPEN))

/** Catches what React threw while rendering, files it with the report listener, and says so. */
class Catch extends Component<{ children: ReactNode }, { broke: Error | null }> {
  state: { broke: Error | null } = { broke: null }
  static getDerivedStateFromError(error: Error) {
    return { broke: error }
  }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    catches('render', Object.assign(new Error(error.message), { stack: `${error.stack ?? ''}\n${info.componentStack ?? ''}` }))
  }
  render() {
    if (!this.state.broke) return this.props.children
    return <Broke error={this.state.broke} onBack={() => this.setState({ broke: null })} />
  }
}

/**
 * The crash screen: which screen broke, in plain words, and three ways on. Back to
 * Chat moves through the host's router and draws the app again without a reload,
 * so the window's other state survives. Plain English, no i18n: the providers
 * above may be the thing that broke. No stack on screen; Copy details has the
 * error, the path and the version for a bug report.
 */
export function Broke({ error, onBack }: { error: Error; onBack: () => void }) {
  const { router, route, path: moved } = useHost()
  const [copied, setCopied] = useState(false)
  const [path] = useState(() => (typeof window === 'undefined' ? '' : window.location.pathname))
  const name = screenOf(path)
  // A router that moves after the press returns (Next's) is heard here: the app is drawn again once the address moved.
  const [from] = useState(() => `${route}|${moved}`)
  useEffect(() => {
    if (`${route}|${moved}` !== from) onBack()
  }, [route, moved, from, onBack])
  return (
    <View role="alert" data-slot="broke" height="100dvh" items="center" justify="center" gap={12} p={24}>
      <Text fontSize="$5" fontWeight="600">{name ? `The ${name} screen hit an error.` : 'This screen hit an error.'}</Text>
      <SizableText size="$2" color="$quiet" text="center" maxW={420}>
        You can go back to Chat, or reload to try this screen again.
      </SizableText>
      <XStack gap={8} flexWrap="wrap" justify="center">
        <Button
          data-slot="broke-chat"
          onPress={() => {
            // Broke on Chat itself: pushing the same address moves nothing, so the app is drawn again here.
            if (path === talk()) return onBack()
            router.push(talk())
            // A router that moved at once (the desktop window's history): draw the app again now.
            if (window.location.pathname !== path) onBack()
          }}
        >
          Back to Chat
        </Button>
        <Button data-slot="broke-reload" variant="outline" onPress={() => window.location.reload()}>
          Reload
        </Button>
        <Button
          data-slot="broke-copy"
          variant="ghost"
          onPress={() => void copyText(details(error.message, window.location.href)).then((ok) => { if (ok) setCopied(true) })}
        >
          {copied ? '✓ Copied details' : 'Copy details'}
        </Button>
        <Button
          data-slot="broke-discord"
          variant="ghost"
          onPress={() => window.open(DISCORD_HELP_URL, '_blank', 'noopener,noreferrer')}
        >
          Get help on Discord
        </Button>
      </XStack>
    </View>
  )
}

/** A superadmin's way to prove the path end to end: `?report-test=error|render|http`. */
function Probe({ kind }: { kind: string }): null {
  useEffect(() => {
    if (kind === 'error') setTimeout(() => { throw new Error('Report test: a thrown error') }, 0)
    if (kind === 'http') void fetch('/v1/report-test/unavailable').catch(() => undefined)
  }, [kind])
  if (kind === 'render') throw new Error('Report test: a render that threw')
  return null
}

export function Report({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [caught, setCaught] = useState<Caught | null>(null)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [shot, setShot] = useState<string | null>(null)
  const [keep, setKeep] = useState(true)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle')
  const [failedReason, setFailedReason] = useState('')
  const [filed, setFiled] = useState<Filed | null>(null)
  const [probe, setProbe] = useState('')
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])

  const copyPayload = useCallback(() => {
    if (!caught) return
    const text = body({ caught, title, description: note, shot: null })
    void copyText(text).then((ok) => {
      if (!ok) return
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2500)
    })
  }, [caught, title, note])

  useEffect(() => {
    listen()
    const q = new URLSearchParams(window.location.search).get('report-test')
    if (q && superAdmin()) setProbe(q)
    return hear((c) => {
      // Record the caught fault immediately; defer heavy DOM/SVG screenshot capture until
      // the person actually clicks "Report it" (`begin`) so background faults never block the main thread.
      setShot(null)
      setCaught(c)
    })
  }, [])

  const begin = useCallback((c: Caught, existingShot?: string | null) => {
    setCaught(c)
    setTitle(c.message.slice(0, 100))
    setNote('')
    setKeep(true)
    setState('idle')
    setFiled(null)
    if (existingShot !== undefined) {
      setShot(existingShot)
      setOpen(true)
      return
    }
    void shoot().then((s) => {
      setShot(s)
      setOpen(true)
    })
  }, [])

  useEffect(() => {
    const by = () => {
      if (caught) return begin(caught)
      void shoot().then((s) => {
        begin({
          kind: 'error',
          message: 'Reported by hand',
          stack: '',
          route: window.location.pathname,
          at: new Date().toISOString(),
          fingerprint: `hand${Date.now().toString(16)}`,
          version: '',
          agent: navigator.userAgent,
          lines: [],
        }, s)
      })
    }
    window.addEventListener(OPEN, by)
    return () => window.removeEventListener(OPEN, by)
  }, [caught, begin])

  const go = async () => {
    if (!caught) return
    setState('sending')
    setFailedReason('')
    try {
      setFiled(await send({ caught, title, description: note, shot: keep ? shot : null }))
      setState('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn('report', msg)
      setFailedReason(msg)
      setState('failed')
    }
  }

  const close = (next: boolean) => {
    setOpen(next)
    if (!next && state === 'done') setCaught(null)
  }

  return (
    <Catch>
      {probe ? <Probe kind={probe} /> : null}
      {children}
      {caught && !open ? (
        <XStack
          role="status"
          data-slot="report-toast"
          position="fixed"
          b={16}
          l={16}
          z={2147483000}
          items="center"
          gap="$3"
          px="$3"
          py="$2"
          rounded="$4"
          borderWidth={1}
          borderColor="var(--border-strong)"
          bg="var(--popover)"
        >
          <SizableText size="$2" color="$quiet">
            {t('Something broke')} —
          </SizableText>
          <Button size="sm" variant="ghost" onPress={() => begin(caught)}>
            {t('Report it')}
          </Button>
          <Button size="sm" variant="ghost" aria-label={t('Dismiss')} onPress={() => setCaught(null)}>
            ×
          </Button>
        </XStack>
      ) : null}
      <Dialog open={open} onOpenChange={close}>
        <DialogContent
          data-slot="report-sheet"
          width={520}
          maxW="calc(100vw - 24px)"
          maxH="90dvh"
          bg="var(--popover)"
          borderWidth={1}
          borderColor="var(--border-strong)"
          rounded="$6"
          gap="$3"
          overflow="hidden"
        >
          <DialogTitle>{t('Report a problem')}</DialogTitle>
          {state === 'done' && filed ? (
            <YStack gap="$3">
              <Text data-slot="report-done">{filed.again ? t('Already reported as {id}. Thank you.', { id: filed.identifier }) : t('Report received ({id}). Thank you.', { id: filed.identifier })}</Text>
              <XStack gap="$2" justify="space-between" items="center" flexWrap="wrap">
                <Button variant="ghost" size="sm" onPress={() => window.open(DISCORD_HELP_URL, '_blank', 'noopener,noreferrer')}>
                  {t('Get help on Discord')}
                </Button>
                <Button onPress={() => close(false)}>{t('Close')}</Button>
              </XStack>
            </YStack>
          ) : caught ? (
            <YStack gap="$3">
              <YStack
                gap="$3"
                maxH="min(58dvh, 440px)"
                overflowY="auto"
                overflowX="hidden"
                $platform-web={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <Input aria-label={t('Title')} value={title} onChangeText={setTitle} />
                <Textarea aria-label={t('What happened?')} placeholder={t('What were you doing? (optional)')} value={note} onChangeText={setNote} rows={3} />
                {shot ? (
                  <YStack gap="$2">
                    {keep ? (
                      <View
                        data-slot="report-shot"
                        render={<img alt={t('Screenshot of the page')} src={shot} />}
                        width="100%"
                        maxH={168}
                        objectFit="contain"
                        bg="$background"
                        rounded="$3"
                        borderWidth={1}
                        borderColor="var(--border)"
                      />
                    ) : null}
                    <Button size="sm" variant="ghost" self="flex-start" onPress={() => setKeep(!keep)}>
                      {keep ? t('Remove screenshot') : t('Include screenshot')}
                    </Button>
                  </YStack>
                ) : null}
                <SizableText size="$1" color="$quiet">
                  {t('Sent to Hanzo when you press Send: the report title, your note, the page path, the app version, your browser, and the last console lines with tokens, keys, cookies and emails removed.')}
                </SizableText>
                <View render={<details />}>
                  <Text render="summary" fontSize="$1" cursor="pointer">{t('See exactly what will be sent')}</Text>
                  <Text
                    render="pre"
                    fontSize="$1"
                    whiteSpace="pre-wrap"
                    maxH={140}
                    overflowY="auto"
                    $platform-web={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {body({ caught, title, description: note, shot: keep ? shot : null }, keep && shot ? '(screenshot)' : undefined)}
                  </Text>
                </View>
                {state === 'failed' ? (
                  <SizableText size="$2" color="$red10" role="alert">
                    {failedReason ? `${t('Could not send.')} ${failedReason}` : t('Could not send. Check your connection and try again.')}
                  </SizableText>
                ) : null}
              </YStack>
              <XStack
                data-slot="report-actions"
                shrink={0}
                pt="$2.5"
                borderTopWidth={1}
                borderColor="var(--border)"
                gap="$2"
                justify="space-between"
                items="center"
                flexWrap="wrap"
              >
                <Button variant="ghost" size="sm" onPress={() => window.open(DISCORD_HELP_URL, '_blank', 'noopener,noreferrer')}>
                  {t('Get help on Discord')}
                </Button>
                <XStack gap="$2" items="center" flexWrap="wrap">
                  <Button data-slot="report-copy" size="sm" variant="ghost" onPress={copyPayload}>
                    {copied ? t('✓ Copied details') : t('Copy details')}
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => close(false)}>{t('Cancel')}</Button>
                  <Button size="sm" data-slot="report-send" disabled={state === 'sending'} onPress={go}>{state === 'sending' ? t('Sending…') : t('Send')}</Button>
                </XStack>
              </XStack>
            </YStack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Catch>
  )
}
