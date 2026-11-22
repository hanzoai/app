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

import { Component, useCallback, useEffect, useState, type ReactNode } from 'react'
import { Button, Dialog, DialogContent, DialogTitle, Input, SizableText, Text, Textarea, View, XStack, YStack } from '@hanzo/ui'
import { useI18n } from '@hanzo/i18n/react'
import { body, catches, details, hear, listen, repo, screenOf, send, type Caught, type Filed } from './fault'
import { useHost } from './host'
import { talk } from './lib/host'
import { shoot } from './shot'
import { bearer, superAdmin } from './lib/session'

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
          onPress={() => void navigator.clipboard?.writeText(details(error.message, window.location.href)).then(() => setCopied(true), () => undefined)}
        >
          {copied ? 'Copied' : 'Copy details'}
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

  useEffect(() => {
    listen()
    const q = new URLSearchParams(window.location.search).get('report-test')
    if (q && superAdmin()) setProbe(q)
    return hear((c) => {
      if (!bearer()) return
      // The picture is taken as the break happens, not after the sheet has changed the page.
      void shoot().then(setShot)
      setCaught(c)
    })
  }, [])

  const begin = useCallback((c: Caught) => {
    setCaught(c)
    setTitle(c.message.slice(0, 100))
    setNote('')
    setKeep(true)
    setState('idle')
    setFiled(null)
    setOpen(true)
  }, [])

  useEffect(() => {
    const by = () => {
      if (caught) return begin(caught)
      void shoot().then((s) => {
        setShot(s)
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
        })
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
        <DialogContent data-slot="report-sheet" width={520} maxW="calc(100vw - 24px)" maxH="88dvh" bg="var(--popover)" borderWidth={1} borderColor="var(--border-strong)" rounded="$6" gap="$3" overflow="hidden">
          <DialogTitle>{t('Report a problem')}</DialogTitle>
          {state === 'done' && filed ? (
            <YStack gap="$3">
              <Text data-slot="report-done">{filed.again ? t('Added to {id}, already open. Thank you.', { id: filed.identifier }) : t('Filed as {id}. Thank you.', { id: filed.identifier })}</Text>
              <Button onPress={() => close(false)}>{t('Close')}</Button>
            </YStack>
          ) : caught ? (
            <YStack gap="$3" overflowY="auto" minH={0}>
              <Input aria-label={t('Title')} value={title} onChangeText={setTitle} />
              <Textarea aria-label={t('What happened?')} placeholder={t('What were you doing? (optional)')} value={note} onChangeText={setNote} rows={3} />
              {shot ? (
                <YStack gap="$2">
                  {keep ? <View data-slot="report-shot" render={<img alt={t('Screenshot of the page')} src={shot} />} width="100%" rounded="$3" borderWidth={1} borderColor="var(--border)" /> : null}
                  <Button size="sm" variant="ghost" self="flex-start" onPress={() => setKeep(!keep)}>
                    {keep ? t('Remove screenshot') : t('Include screenshot')}
                  </Button>
                </YStack>
              ) : null}
              <SizableText size="$1" color="$quiet">
                {t('Nothing is sent until you press Send. Sent to {repo}: the error, the page path, the app version, your browser, the last console lines with tokens, keys, cookies and emails removed, and the screenshot if kept.', { repo: repo() })}
              </SizableText>
              <View render={<details />}>
                <Text render="summary" fontSize="$1" cursor="pointer">{t('See exactly what will be sent')}</Text>
                <Text render="pre" fontSize="$1" whiteSpace="pre-wrap" maxH={180} overflowY="auto">{body({ caught, title, description: note, shot: keep ? shot : null }, keep && shot ? '(screenshot)' : undefined)}</Text>
              </View>
              {state === 'failed' ? (
                <SizableText size="$2" color="$red10" role="alert">
                  {failedReason ? `${t('Could not send.')} ${failedReason}` : t('Could not send. Check your connection and try again.')}
                </SizableText>
              ) : null}
              <XStack gap="$2" justify="flex-end">
                <Button variant="ghost" onPress={() => close(false)}>{t('Cancel')}</Button>
                <Button data-slot="report-send" disabled={state === 'sending'} onPress={go}>{state === 'sending' ? t('Sending…') : t('Send')}</Button>
              </XStack>
            </YStack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Catch>
  )
}
