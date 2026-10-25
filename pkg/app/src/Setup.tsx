'use client'

// The 1-2-3 in-app onboarding: Connect GitHub, Connect Slack, Connect Google (Gmail, Calendar & Drive).
// Runs INSIDE the app as a compact card in the sidebar column and as an interactive
// popup modal dialog. Never a full-screen redirect away from the user's workspace.
//
//   1. GitHub:  Sync repositories, PRs, and team repository context
//   2. Slack:   Route notifications, agent conversations, and bot alerts
//   3. Google:  Connect Gmail, Calendar & Drive so agents can read files, draft emails & manage schedules

import { useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { Box, Dialog, DialogContent, DialogTitle, SizableText, Text, XStack, YStack } from '@hanzo/ui'
import { useIam } from '@hanzo/iam/react'
import { Check, Maximize2, Sparkles, X } from 'lucide-react'
import { ProviderMark } from './ProviderMark'
import { useKept } from './kept'
import { api, CLIENT } from './lib/api'
import { answers } from './lib/host'
import { scope } from './lib/session'
import { enter } from './lib/destination'
import { brand } from './where'
import { GOOD } from './lib/mix'

const here = (): boolean => typeof window !== 'undefined' && answers(window.location.hostname)

const LATER_KEY = 'hanzo.onboarding.later'
const GITHUB_KEY = 'hanzo.onboarding.github'
const SLACK_KEY = 'hanzo.onboarding.slack'
const GOOGLE_KEY = 'hanzo.onboarding.google'
const STEP_KEY = 'hanzo.onboarding.step'

/** Inline Slack Mark */
function SlackMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 54 54" fill="none" aria-hidden>
      <path d="M11.379 33.9993C11.379 37.1358 8.84512 39.6507 5.7276 39.6507C2.61008 39.6507 0.0572205 37.1168 0.0572205 33.9993C0.0572205 30.8817 2.5911 28.3479 5.70862 28.3479H11.36V33.9993H11.379Z" fill="#E01E5A"/>
      <path d="M14.1962 33.9997C14.1962 30.8632 16.7301 28.3483 19.8476 28.3483C22.9651 28.3483 25.499 30.8822 25.499 33.9997V48.1353C25.499 51.2718 22.9651 53.7867 19.8476 53.7867C16.7301 53.7867 14.1962 51.2718 14.1962 48.1353V33.9997Z" fill="#E01E5A"/>
      <path d="M19.8662 11.2673C16.7296 11.2673 14.2148 8.73347 14.2148 5.61594C14.2148 2.49842 16.7486 -0.0354538 19.8662 -0.0354538C22.9837 -0.0354538 25.5175 2.49842 25.5175 5.61594V11.2673H19.8662Z" fill="#36C5F0"/>
      <path d="M19.8682 14.1334C23.0047 14.1334 25.5196 16.6673 25.5196 19.7848C25.5196 22.9023 22.9857 25.4362 19.8682 25.4362H5.67566C2.53916 25.4362 0.0242615 22.9023 0.0242615 19.7848C0.0242615 16.6673 2.55814 14.1334 5.67566 14.1334H19.8682Z" fill="#36C5F0"/>
      <path d="M42.5323 19.7853C42.5323 16.6488 45.0662 14.1339 48.1837 14.1339C51.3012 14.1339 53.8351 16.6678 53.8351 19.7853C53.8351 22.9028 51.3012 25.4367 48.1837 25.4367H42.5323V19.7853Z" fill="#2EB67D"/>
      <path d="M39.7126 19.7934C39.7126 22.9299 37.1787 25.4448 34.0612 25.4448C30.9436 25.4448 28.4098 22.911 28.4098 19.7934V5.61986C28.4098 2.48336 30.9436 -0.0315399 34.0612 -0.0315399C37.1787 -0.0315399 39.7126 2.48336 39.7126 5.61986V19.7934Z" fill="#2EB67D"/>
      <path d="M34.0376 42.482C37.1741 42.482 39.689 45.0158 39.689 48.1334C39.689 51.2509 37.1552 53.7848 34.0376 53.7848C30.9201 53.7848 28.3862 51.2509 28.3862 48.1334V42.482H34.0376Z" fill="#ECB22E"/>
      <path d="M34.0381 39.6507C30.9016 39.6507 28.3867 37.1168 28.3867 33.9993C28.3867 30.8818 30.9206 28.3479 34.0381 28.3479H48.2306C51.3671 28.3479 53.882 30.8818 53.882 33.9993C53.882 37.1168 51.3482 39.6507 48.2306 39.6507H34.0381Z" fill="#ECB22E"/>
    </svg>
  )
}

export function Setup() {
  const { t } = useI18n()
  const { isAuthenticated, accessToken, sdk } = useIam()
  const [later, setLater] = useKept(LATER_KEY, false)
  const [step, setStep] = useKept(STEP_KEY, 1)

  const [githubDone, setGithubDone] = useKept(GITHUB_KEY, false)
  const [slackDone, setSlackDone] = useKept(SLACK_KEY, false)
  const [googleDone, setGoogleDone] = useKept(GOOGLE_KEY, false)

  const [busy, setBusy] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [syncTurn, setSyncTurn] = useState(0)

  const signed = isAuthenticated && Boolean(accessToken)

  // Sync with remote integrations, connectors & linked IAM accounts when authenticated or returning from OAuth tab/popup
  useEffect(() => {
    if (!signed) return
    let live = true
    const auth = scope()

    Promise.all([
      fetch(`${api()}/v1/integrations`, { headers: auth })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${api()}/v1/integrations/connectors`, { headers: auth })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(`${api()}/v1/iam/linked-accounts`, { headers: auth })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([integrationsData, connectorsData, linkedData]) => {
      if (!live) return
      const providers = Array.isArray(integrationsData?.providers)
        ? (integrationsData.providers as Record<string, unknown>[])
        : null
      const connectors = Array.isArray(connectorsData?.connectors)
        ? (connectorsData.connectors as Record<string, unknown>[])
        : null
      const linkedAccounts = Array.isArray(linkedData?.data)
        ? (linkedData.data as Record<string, unknown>[])
        : null

      if (!providers && !connectors && !linkedAccounts) return

      const connectedSet = new Set<string>()
      if (providers) {
        for (const p of providers) {
          if (p.connected) connectedSet.add(String(p.id))
        }
      }
      if (connectors) {
        for (const c of connectors) {
          connectedSet.add(String(c.provider))
        }
      }
      if (linkedAccounts) {
        for (const l of linkedAccounts) {
          if (l.provider) connectedSet.add(String(l.provider).toLowerCase())
        }
      }

      const hasGithub = connectedSet.has('github') || connectedSet.has('github-copilot')
      const hasSlack = connectedSet.has('slack')
      const hasGoogle =
        connectedSet.has('google') ||
        connectedSet.has('gmail') ||
        connectedSet.has('google-drive') ||
        connectedSet.has('google-calendar')

      if (hasGithub) setGithubDone(true)
      if (hasSlack) setSlackDone(true)
      if (hasGoogle) setGoogleDone(true)
    })

    return () => {
      live = false
    }
  }, [signed, syncTurn])

  useEffect(() => {
    if (!signed) return
    const onReturn = () => {
      if (document.visibilityState === 'visible') {
        setSyncTurn((n) => n + 1)
      }
    }
    const onFocus = () => setSyncTurn((n) => n + 1)
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onFocus)
    }
  }, [signed])

  const totalDone = (githubDone ? 1 : 0) + (slackDone ? 1 : 0) + (googleDone ? 1 : 0)
  const allDone = totalDone === 3

  // Automatically advance step if current step is already done
  useEffect(() => {
    if (step === 1 && githubDone) setStep(slackDone ? 3 : 2)
    else if (step === 2 && slackDone) setStep(googleDone ? 1 : 3)
    else if (step === 3 && googleDone && (!githubDone || !slackDone)) setStep(!githubDone ? 1 : 2)
  }, [githubDone, slackDone, googleDone, step])

  if (later && !modalOpen) return null

  const openOAuthPopup = (authorizeUrl: string, provider: 'github' | 'slack' | 'google') => {
    const popup = window.open(authorizeUrl, `hanzo-oauth-${provider}`, 'width=600,height=700')
    if (!popup) {
      window.open(authorizeUrl, '_blank', 'noopener,noreferrer')
    } else {
      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer)
          setSyncTurn((n) => n + 1)
        }
      }, 1000)
    }
  }

  const connectGoogleViaIam = async (onDone: () => void): Promise<string | 'done' | null> => {
    try {
      const linkOrigin = here() && typeof window !== 'undefined' ? window.location.origin : api()
      const returnUri = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'https://hanzo.ai/auth/callback'
      const linkRes = await fetch(`${linkOrigin}/v1/iam/link`, {
        method: 'POST',
        headers: { ...scope(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'provider-google',
          clientId: CLIENT,
          returnUri,
        }),
      }).catch(() => null)

      if (linkRes?.ok) {
        const linkJson = (await linkRes.json().catch(() => null)) as {
          status?: string
          msg?: string
          data?: unknown
        } | null
        if (linkJson?.status === 'ok' && typeof linkJson.data === 'string' && linkJson.data) {
          return linkJson.data
        }
        if (linkJson?.msg && linkJson.msg.toLowerCase().includes('already connected')) {
          onDone()
          return 'done'
        }
      }

      if (sdk && typeof sdk.getSigninUrl === 'function') {
        const signinHref = await sdk.getSigninUrl({ additionalParams: { provider: 'provider-google' } })
        const url = new URL(signinHref)
        if (here() && typeof window !== 'undefined') {
          url.protocol = window.location.protocol
          url.host = window.location.host
        }
        return url.href
      }
    } catch {
      // fall through
    }
    return null
  }

  const connectOAuthProvider = async (
    provider: 'github' | 'slack' | 'google',
    label: string,
    onDone: () => void,
  ) => {
    if (!signed) {
      enter()
      return
    }
    setBusy(provider)
    setErrorMsg(null)
    try {
      if (provider === 'google') {
        const iamResult = await connectGoogleViaIam(onDone)
        if (iamResult === 'done') return
        if (iamResult) {
          openOAuthPopup(iamResult, 'google')
          return
        }
      }
      const res = await fetch(`${api()}/v1/integrations/${provider}/connect`, {
        method: 'POST',
        headers: { ...scope(), 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (!res.ok) {
        let detail = ''
        try {
          const errJson = (await res.json()) as { error?: string | { message?: string }; message?: string }
          detail =
            (typeof errJson?.error === 'string' ? errJson.error : errJson?.error?.message) ||
            errJson?.message ||
            ''
        } catch {
          // ignore
        }
        setErrorMsg(
          detail || t('Could not connect {provider} right now. Please try again.', { provider: label }),
        )
        return
      }
      const j = (await res.json()) as { authorizeUrl?: string; connected?: boolean }
      if (j.authorizeUrl) {
        openOAuthPopup(j.authorizeUrl, provider)
      } else if (j.connected) {
        onDone()
      }
    } catch {
      setErrorMsg(t('Could not connect {provider} right now. Please try again.', { provider: label }))
    } finally {
      setBusy(null)
    }
  }

  // 1. Connect GitHub
  const handleConnectGithub = () =>
    connectOAuthProvider('github', 'GitHub', () => {
      setGithubDone(true)
      setStep(slackDone ? 3 : 2)
    })

  // 2. Connect Slack
  const handleConnectSlack = () =>
    connectOAuthProvider('slack', 'Slack', () => {
      setSlackDone(true)
      setStep(3)
    })

  // 3. Connect Google (Gmail, Calendar & Drive)
  const handleConnectGoogle = () =>
    connectOAuthProvider('google', 'Google', () => {
      setGoogleDone(true)
    })

  return (
    <>
      <YStack
        data-slot="setup"
        role="region"
        aria-label={t('Onboarding (1-2-3)')}
        gap="$2.5"
        p="$3"
        rounded="$4"
        borderWidth={1}
        borderColor="$borderColor"
        bg="$raised"
        width="100%"
        overflow="hidden"
      >
        {/* Header with Step Dots & Controls */}
        <XStack items="center" justify="space-between" gap="$1.5" minW={0}>
          <XStack items="center" gap="$1.5" minW={0} flex={1}>
            <Sparkles size={15} color="var(--primary)" aria-hidden />
            <SizableText size="$2" fontWeight="600" color="$ink" numberOfLines={1}>
              {allDone ? t('Onboarding complete') : t('Quick setup ({n}/3)', { n: totalDone })}
            </SizableText>
          </XStack>
          <XStack items="center" gap="$1" shrink={0}>
            <Box
              render="button"
              aria-label={t('Expand onboarding popup')}
              onClick={() => setModalOpen(true)}
              p="$1"
              rounded={999}
              hoverStyle={{ bg: '$hover' }}
              cursor="pointer"
            >
              <Maximize2 size={13} aria-hidden color="$soft" />
            </Box>
            <Box
              render="button"
              aria-label={t('Dismiss')}
              onClick={() => setLater(true)}
              p="$1"
              rounded={999}
              hoverStyle={{ bg: '$hover' }}
              cursor="pointer"
            >
              <X size={13} aria-hidden color="$soft" />
            </Box>
          </XStack>
        </XStack>

        {/* Progress bar */}
        <XStack gap="$1" width="100%">
          <Box flex={1} height={4} rounded={2} bg={githubDone ? GOOD : step === 1 ? '$ink' : '$edge'} />
          <Box flex={1} height={4} rounded={2} bg={slackDone ? GOOD : step === 2 ? '$ink' : '$edge'} />
          <Box flex={1} height={4} rounded={2} bg={googleDone ? GOOD : step === 3 ? '$ink' : '$edge'} />
        </XStack>

        {allDone ? (
          <YStack gap="$2" pt="$1">
            <XStack items="center" gap="$2">
              <Check size={16} color={GOOD} aria-hidden />
              <Text fontSize="$2" color="$ink" fontWeight="500">
                {t('GitHub, Slack & Google connected')}
              </Text>
            </XStack>
            <Box
              render="button"
              onClick={() => setLater(true)}
              p="$1.5"
              rounded="$3"
              bg="$edge"
              hoverStyle={{ bg: '$hover' }}
              items="center"
              justify="center"
              cursor="pointer"
            >
              <Text fontSize="$2" fontWeight="500">{t('Done')}</Text>
            </Box>
          </YStack>
        ) : step === 1 ? (
          /* Step 1: GitHub */
          <YStack gap="$2" minW={0}>
            <XStack items="center" justify="space-between" gap="$1.5" flexWrap="wrap" minW={0}>
              <XStack items="center" gap="$2" minW={0} flex={1}>
                <ProviderMark org="github" size={18} />
                <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1}>{t('1. Connect GitHub')}</Text>
              </XStack>
              {githubDone ? (
                <XStack items="center" gap="$1" shrink={0}>
                  <Check size={12} color={GOOD} aria-hidden />
                  <Text fontSize="$1" color={GOOD} fontWeight="600">{t('Connected')}</Text>
                </XStack>
              ) : null}
            </XStack>
            <Text fontSize="$1" color="$soft">
              {t('Sync repositories, PRs, and team repository context.')}
            </Text>
            <XStack gap="$1.5" items="center" pt="$1" flexWrap="wrap">
              <Box
                render="button"
                onClick={handleConnectGithub}
                aria-disabled={busy === 'github'}
                px="$2.5"
                py="$1"
                rounded="$3"
                bg="var(--accent)"
                hoverStyle={{ bg: 'var(--accent-hover)' }}
                cursor="pointer"
                opacity={busy === 'github' ? 0.6 : 1}
              >
                <Text fontSize="$1" fontWeight="600" color="var(--accent-foreground)">
                  {busy === 'github' ? t('Connecting…') : githubDone ? t('Reconnect') : t('Connect GitHub')}
                </Text>
              </Box>
              <Box
                render="button"
                onClick={() => setStep(2)}
                px="$2"
                py="$1"
                rounded="$3"
                bg="transparent"
                hoverStyle={{ bg: '$hover' }}
                cursor="pointer"
              >
                <Text fontSize="$1" color="$soft">{t('Skip')}</Text>
              </Box>
            </XStack>
          </YStack>
        ) : step === 2 ? (
          /* Step 2: Slack */
          <YStack gap="$2" minW={0}>
            <XStack items="center" justify="space-between" gap="$1.5" flexWrap="wrap" minW={0}>
              <XStack items="center" gap="$2" minW={0} flex={1}>
                <SlackMark size={18} />
                <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1}>{t('2. Connect Slack')}</Text>
              </XStack>
              {slackDone ? (
                <XStack items="center" gap="$1" shrink={0}>
                  <Check size={12} color={GOOD} aria-hidden />
                  <Text fontSize="$1" color={GOOD} fontWeight="600">{t('Connected')}</Text>
                </XStack>
              ) : null}
            </XStack>
            <Text fontSize="$1" color="$soft">
              {t('Route agent notifications and chat in team channels.')}
            </Text>
            <XStack gap="$1.5" items="center" pt="$1" flexWrap="wrap">
              <Box
                render="button"
                onClick={handleConnectSlack}
                aria-disabled={busy === 'slack'}
                px="$2.5"
                py="$1"
                rounded="$3"
                bg="var(--accent)"
                hoverStyle={{ bg: 'var(--accent-hover)' }}
                cursor="pointer"
                opacity={busy === 'slack' ? 0.6 : 1}
              >
                <Text fontSize="$1" fontWeight="600" color="var(--accent-foreground)">
                  {busy === 'slack' ? t('Connecting…') : slackDone ? t('Reconnect') : t('Connect Slack')}
                </Text>
              </Box>
              <Box
                render="button"
                onClick={() => setStep(3)}
                px="$2"
                py="$1"
                rounded="$3"
                bg="transparent"
                hoverStyle={{ bg: '$hover' }}
                cursor="pointer"
              >
                <Text fontSize="$1" color="$soft">{t('Skip')}</Text>
              </Box>
            </XStack>
          </YStack>
        ) : (
          /* Step 3: Google Workspace (Gmail, Calendar & Drive) */
          <YStack gap="$2" minW={0}>
            <XStack items="center" justify="space-between" gap="$1.5" flexWrap="wrap" minW={0}>
              <XStack items="center" gap="$2" minW={0} flex={1}>
                <ProviderMark org="google" size={18} />
                <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1}>{t('3. Connect Google')}</Text>
              </XStack>
              {googleDone ? (
                <XStack items="center" gap="$1" shrink={0}>
                  <Check size={12} color={GOOD} aria-hidden />
                  <Text fontSize="$1" color={GOOD} fontWeight="600">
                    {t('Connected')}
                  </Text>
                </XStack>
              ) : null}
            </XStack>
            <Text fontSize="$1" color="$soft">
              {t('Sync Gmail, Calendar & Drive so Hanzo can read files, draft emails & schedule meetings.')}
            </Text>
            <XStack gap="$1.5" items="center" pt="$1" flexWrap="wrap">
              <Box
                render="button"
                onClick={handleConnectGoogle}
                aria-disabled={busy === 'google'}
                px="$2.5"
                py="$1"
                rounded="$3"
                bg="var(--accent)"
                hoverStyle={{ bg: 'var(--accent-hover)' }}
                cursor="pointer"
                opacity={busy === 'google' ? 0.6 : 1}
              >
                <Text fontSize="$1" fontWeight="600" color="var(--accent-foreground)">
                  {busy === 'google' ? t('Connecting…') : googleDone ? t('Reconnect') : t('Connect Google')}
                </Text>
              </Box>
              <Box
                render="button"
                onClick={() => setLater(true)}
                px="$2"
                py="$1"
                rounded="$3"
                bg="transparent"
                hoverStyle={{ bg: '$hover' }}
                cursor="pointer"
              >
                <Text fontSize="$1" color="$soft">{t('Skip')}</Text>
              </Box>
            </XStack>
          </YStack>
        )}

        {errorMsg ? (
          <Text fontSize="$1" color="$red10">
            {errorMsg}
          </Text>
        ) : null}
      </YStack>

      {/* Pop-up Dialog for 1-2-3 Full View */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent maxW={520} rounded="$6" gap="$4" p="$5">
          <DialogTitle>
            <XStack items="center" gap="$2">
              <Sparkles size={20} color="var(--primary)" aria-hidden />
              <Text fontSize="$5" fontWeight="600" color="$ink">
                {t('Set up {brand} in 3 steps', { brand: brand() })}
              </Text>
            </XStack>
          </DialogTitle>
          <Text fontSize="$2" color="$soft">
            {t('Connect your code, team chat, and Google Workspace (Gmail, Calendar & Drive) directly inside {brand}.', { brand: brand() })}
          </Text>

          <YStack gap="$3">
            {/* Step 1 Item */}
            <XStack
              p="$3"
              rounded="$4"
              borderWidth={1}
              borderColor={githubDone ? GOOD : '$borderColor'}
              bg="$raised"
              items="center"
              justify="space-between"
              gap="$3"
            >
              <XStack items="center" gap="$3" flex={1}>
                <ProviderMark org="github" size={24} />
                <YStack flex={1} minW={0}>
                  <Text fontSize="$3" fontWeight="600" color="$ink">{t('1. GitHub')}</Text>
                  <Text fontSize="$1" color="$soft">{t('Sync repositories, PRs, and code context')}</Text>
                </YStack>
              </XStack>
              {githubDone ? (
                <XStack items="center" gap="$1" px="$2" py="$1" rounded="$2" bg="$hover">
                  <Check size={14} color={GOOD} />
                  <Text fontSize="$1" color={GOOD} fontWeight="600">{t('Connected')}</Text>
                </XStack>
              ) : (
                <Box
                  render="button"
                  onClick={handleConnectGithub}
                  px="$3"
                  py="$1.5"
                  rounded="$3"
                  bg="var(--accent)"
                  hoverStyle={{ bg: 'var(--accent-hover)' }}
                  cursor="pointer"
                >
                  <Text fontSize="$2" fontWeight="600" color="var(--accent-foreground)">
                    {busy === 'github' ? t('Connecting…') : t('Connect')}
                  </Text>
                </Box>
              )}
            </XStack>

            {/* Step 2 Item */}
            <XStack
              p="$3"
              rounded="$4"
              borderWidth={1}
              borderColor={slackDone ? GOOD : '$borderColor'}
              bg="$raised"
              items="center"
              justify="space-between"
              gap="$3"
            >
              <XStack items="center" gap="$3" flex={1}>
                <SlackMark size={24} />
                <YStack flex={1} minW={0}>
                  <Text fontSize="$3" fontWeight="600" color="$ink">{t('2. Slack')}</Text>
                  <Text fontSize="$1" color="$soft">{t('Notifications and agent bot chat in channels')}</Text>
                </YStack>
              </XStack>
              {slackDone ? (
                <XStack items="center" gap="$1" px="$2" py="$1" rounded="$2" bg="$hover">
                  <Check size={14} color={GOOD} />
                  <Text fontSize="$1" color={GOOD} fontWeight="600">{t('Connected')}</Text>
                </XStack>
              ) : (
                <Box
                  render="button"
                  onClick={handleConnectSlack}
                  px="$3"
                  py="$1.5"
                  rounded="$3"
                  bg="var(--accent)"
                  hoverStyle={{ bg: 'var(--accent-hover)' }}
                  cursor="pointer"
                >
                  <Text fontSize="$2" fontWeight="600" color="var(--accent-foreground)">
                    {busy === 'slack' ? t('Connecting…') : t('Connect')}
                  </Text>
                </Box>
              )}
            </XStack>

            {/* Step 3 Item */}
            <XStack
              p="$3"
              rounded="$4"
              borderWidth={1}
              borderColor={googleDone ? GOOD : '$borderColor'}
              bg="$raised"
              items="center"
              justify="space-between"
              gap="$3"
            >
              <XStack items="center" gap="$3" flex={1}>
                <ProviderMark org="google" size={24} />
                <YStack flex={1} minW={0}>
                  <Text fontSize="$3" fontWeight="600" color="$ink">{t('3. Google Workspace (Gmail, Calendar & Drive)')}</Text>
                  <Text fontSize="$1" color="$soft">{t('Access Docs, Sheets, Slides, Drive files, Gmail & Calendar')}</Text>
                </YStack>
              </XStack>
              {googleDone ? (
                <XStack items="center" gap="$1" px="$2" py="$1" rounded="$2" bg="$hover">
                  <Check size={14} color={GOOD} />
                  <Text fontSize="$1" color={GOOD} fontWeight="600">
                    {t('Connected')}
                  </Text>
                </XStack>
              ) : (
                <Box
                  render="button"
                  onClick={handleConnectGoogle}
                  px="$3"
                  py="$1.5"
                  rounded="$3"
                  bg="var(--accent)"
                  hoverStyle={{ bg: 'var(--accent-hover)' }}
                  cursor="pointer"
                >
                  <Text fontSize="$2" fontWeight="600" color="var(--accent-foreground)">
                    {busy === 'google' ? t('Connecting…') : t('Connect')}
                  </Text>
                </Box>
              )}
            </XStack>
          </YStack>

          <XStack justify="flex-end" pt="$2">
            <Box
              render="button"
              onClick={() => setModalOpen(false)}
              px="$4"
              py="$2"
              rounded="$3"
              borderWidth={1}
              borderColor="$borderColor"
              hoverStyle={{ bg: '$hover' }}
              cursor="pointer"
            >
              <Text fontSize="$2" fontWeight="500" color="$ink">{t('Close')}</Text>
            </Box>
          </XStack>
        </DialogContent>
      </Dialog>
    </>
  )
}
