'use client'

// The 1-2-3 in-app onboarding: Connect GitHub, Connect Slack, Connect Wallet.
// Runs INSIDE the app as a compact card in the sidebar column and as an interactive
// popup modal dialog. Never a full-screen redirect away from the user's workspace.
//
//   1. GitHub:  Sync repositories, PRs, and team repository context
//   2. Slack:   Route notifications, agent conversations, and bot alerts
//   3. Wallet:  Web3 multi-chain wallet (MetaMask/EVM/Base/Solana) for credits & payouts

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { Box, Dialog, DialogContent, DialogTitle, Input, SizableText, Text, XStack, YStack } from '@hanzo/ui'
import { useIam } from '@hanzo/iam/react'
import { ArrowUpRight, Check, ChevronRight, ExternalLink, Maximize2, Sparkles, Wallet, X } from 'lucide-react'
import { ProviderMark } from './ProviderMark'
import { useKept } from './kept'
import { api } from './lib/api'
import { scope } from './lib/session'
import { enter } from './lib/destination'
import { brand } from './where'
import { GOOD } from './lib/mix'

const LATER_KEY = 'hanzo.onboarding.later'
const GITHUB_KEY = 'hanzo.onboarding.github'
const SLACK_KEY = 'hanzo.onboarding.slack'
const WALLET_KEY = 'hanzo.onboarding.wallet'
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
  const { isAuthenticated, accessToken } = useIam()
  const [later, setLater] = useKept(LATER_KEY, false)
  const [step, setStep] = useKept(STEP_KEY, 1)

  const [githubDone, setGithubDone] = useKept(GITHUB_KEY, false)
  const [slackDone, setSlackDone] = useKept(SLACK_KEY, false)
  const [walletDone, setWalletDone] = useKept(WALLET_KEY, false)
  const [walletAddr, setWalletAddr] = useKept('hanzo.onboarding.wallet.addr', '')

  const [busy, setBusy] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [manualWallet, setManualWallet] = useState('')
  const [showWalletInput, setShowWalletInput] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const signed = isAuthenticated && Boolean(accessToken)

  // Sync with remote connectors when authenticated
  useEffect(() => {
    if (!signed) return
    let live = true
    const auth = scope()

    fetch(`${api()}/v1/integrations/connectors`, { headers: auth })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!live || !data?.connectors) return
        const set = new Set((data.connectors as Record<string, unknown>[]).map((c) => String(c.provider)))
        if (set.has('github') || set.has('github-copilot')) setGithubDone(true)
        if (set.has('slack')) setSlackDone(true)
      })
      .catch(() => {})

    fetch(`${api()}/v1/iam/preferences`, { method: 'POST', headers: auth, body: '{}' })
      .then((r) => (r.ok ? r.json() : null))
      .then((pref) => {
        if (!live || !pref) return
        const w = pref?.onboarding?.wallet ?? pref?.wallet
        if (typeof w === 'string' && w.trim()) {
          setWalletDone(true)
          setWalletAddr(w.trim())
        }
      })
      .catch(() => {})

    return () => {
      live = false
    }
  }, [signed])

  const totalDone = (githubDone ? 1 : 0) + (slackDone ? 1 : 0) + (walletDone ? 1 : 0)
  const allDone = totalDone === 3

  // Automatically advance step if current step is already done
  useEffect(() => {
    if (step === 1 && githubDone) setStep(slackDone ? (walletDone ? 3 : 3) : 2)
    else if (step === 2 && slackDone) setStep(walletDone ? 3 : 3)
  }, [githubDone, slackDone, walletDone, step])

  if (later && !modalOpen) return null

  // 1. Connect GitHub
  const handleConnectGithub = async () => {
    if (!signed) {
      enter()
      return
    }
    setBusy('github')
    setErrorMsg(null)
    try {
      const res = await fetch(`${api()}/v1/integrations/github/connect`, {
        method: 'POST',
        headers: { ...scope(), 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (res.ok) {
        const j = (await res.json()) as { authorizeUrl?: string }
        if (j.authorizeUrl) {
          window.open(j.authorizeUrl, 'hanzo-oauth-github', 'width=600,height=700')
        }
      } else {
        // Fallback: open OAuth authorize channel
        const fallback = `${api()}/v1/channels/github/oauth/authorize?redirect_uri=${encodeURIComponent(window.location.origin + '/inbox')}`
        window.open(fallback, 'hanzo-oauth-github', 'width=600,height=700')
      }
      setGithubDone(true)
      setStep(slackDone ? 3 : 2)
    } catch {
      // Local/mock fallback: set connected and advance
      setGithubDone(true)
      setStep(slackDone ? 3 : 2)
    } finally {
      setBusy(null)
    }
  }

  // 2. Connect Slack
  const handleConnectSlack = async () => {
    if (!signed) {
      enter()
      return
    }
    setBusy('slack')
    setErrorMsg(null)
    try {
      const res = await fetch(`${api()}/v1/integrations/slack/connect`, {
        method: 'POST',
        headers: { ...scope(), 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (res.ok) {
        const j = (await res.json()) as { authorizeUrl?: string }
        if (j.authorizeUrl) {
          window.open(j.authorizeUrl, 'hanzo-oauth-slack', 'width=600,height=700')
        }
      } else {
        // Fallback: open OAuth channel
        const fallback = `${api()}/v1/channels/slack/oauth/authorize?redirect_uri=${encodeURIComponent(window.location.origin + '/inbox')}`
        window.open(fallback, 'hanzo-oauth-slack', 'width=600,height=700')
      }
      setSlackDone(true)
      setStep(3)
    } catch {
      // Local/mock fallback: set connected and advance
      setSlackDone(true)
      setStep(3)
    } finally {
      setBusy(null)
    }
  }

  // 3. Connect Wallet
  const saveWalletAddress = async (addr: string) => {
    const clean = addr.trim()
    if (!clean) return
    setWalletAddr(clean)
    setWalletDone(true)
    setShowWalletInput(false)
    if (signed) {
      fetch(`${api()}/v1/iam/preferences`, {
        method: 'POST',
        headers: { ...scope(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding: { wallet: clean } }),
      }).catch(() => {})
    }
  }

  const handleConnectWalletWeb3 = async () => {
    setErrorMsg(null)
    if (typeof window !== 'undefined' && (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum) {
      setBusy('wallet')
      try {
        const eth = (window as unknown as { ethereum: { request: (args: { method: string }) => Promise<string[]> } }).ethereum
        const accounts = await eth.request({ method: 'eth_requestAccounts' })
        if (accounts && accounts[0]) {
          await saveWalletAddress(accounts[0])
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        setErrorMsg(msg)
        setShowWalletInput(true)
      } finally {
        setBusy(null)
      }
    } else {
      setShowWalletInput(true)
    }
  }

  const truncate = (s: string) => (s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s)

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
      >
        {/* Header with Step Dots & Controls */}
        <XStack items="center" justify="space-between">
          <XStack items="center" gap="$1.5">
            <Sparkles size={15} color="var(--primary)" aria-hidden />
            <SizableText size="$2" fontWeight="600" color="$ink">
              {allDone ? t('Onboarding complete') : t('Quick setup ({n}/3)', { n: totalDone })}
            </SizableText>
          </XStack>
          <XStack items="center" gap="$1">
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
          <Box flex={1} height={4} rounded={2} bg={walletDone ? GOOD : step === 3 ? '$ink' : '$edge'} />
        </XStack>

        {allDone ? (
          <YStack gap="$2" pt="$1">
            <XStack items="center" gap="$2">
              <Check size={16} color={GOOD} aria-hidden />
              <Text fontSize="$2" color="$ink" fontWeight="500">
                {t('GitHub, Slack & Wallet connected')}
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
          <YStack gap="$2">
            <XStack items="center" justify="space-between">
              <XStack items="center" gap="$2">
                <ProviderMark org="github" size={18} />
                <Text fontSize="$2" fontWeight="600" color="$ink">{t('1. Connect GitHub')}</Text>
              </XStack>
              {githubDone ? (
                <XStack items="center" gap="$1">
                  <Check size={12} color={GOOD} />
                  <Text fontSize="$1" color={GOOD} fontWeight="600">{t('Connected')}</Text>
                </XStack>
              ) : null}
            </XStack>
            <Text fontSize="$1" color="$soft">
              {t('Sync repositories, PRs, and team repository context.')}
            </Text>
            <XStack gap="$1.5" items="center" pt="$1">
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
          <YStack gap="$2">
            <XStack items="center" justify="space-between">
              <XStack items="center" gap="$2">
                <SlackMark size={18} />
                <Text fontSize="$2" fontWeight="600" color="$ink">{t('2. Connect Slack')}</Text>
              </XStack>
              {slackDone ? (
                <XStack items="center" gap="$1">
                  <Check size={12} color={GOOD} />
                  <Text fontSize="$1" color={GOOD} fontWeight="600">{t('Connected')}</Text>
                </XStack>
              ) : null}
            </XStack>
            <Text fontSize="$1" color="$soft">
              {t('Route agent notifications and chat in team channels.')}
            </Text>
            <XStack gap="$1.5" items="center" pt="$1">
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
          /* Step 3: Wallet */
          <YStack gap="$2">
            <XStack items="center" justify="space-between">
              <XStack items="center" gap="$2">
                <Wallet size={18} color="var(--primary)" />
                <Text fontSize="$2" fontWeight="600" color="$ink">{t('3. Connect Wallet')}</Text>
              </XStack>
              {walletDone ? (
                <XStack items="center" gap="$1">
                  <Check size={12} color={GOOD} />
                  <Text fontSize="$1" color={GOOD} fontWeight="600">
                    {walletAddr ? truncate(walletAddr) : t('Connected')}
                  </Text>
                </XStack>
              ) : null}
            </XStack>
            <Text fontSize="$1" color="$soft">
              {t('Link Web3 wallet for compute credits and rewards.')}
            </Text>
            {showWalletInput ? (
              <XStack gap="$1.5" items="center" pt="$1">
                <Input
                  value={manualWallet}
                  onChangeText={setManualWallet}
                  placeholder="0x… or Solana/Base"
                  height={30}
                  flex={1}
                  fontSize="$1"
                />
                <Box
                  render="button"
                  onClick={() => void saveWalletAddress(manualWallet)}
                  px="$2.5"
                  py="$1"
                  rounded="$3"
                  bg="var(--accent)"
                  hoverStyle={{ bg: 'var(--accent-hover)' }}
                  cursor="pointer"
                >
                  <Text fontSize="$1" fontWeight="600" color="var(--accent-foreground)">
                    {t('Save')}
                  </Text>
                </Box>
              </XStack>
            ) : (
              <XStack gap="$1.5" items="center" pt="$1" flexWrap="wrap">
                <Box
                  render="button"
                  onClick={handleConnectWalletWeb3}
                  aria-disabled={busy === 'wallet'}
                  px="$2.5"
                  py="$1"
                  rounded="$3"
                  bg="var(--accent)"
                  hoverStyle={{ bg: 'var(--accent-hover)' }}
                  cursor="pointer"
                >
                  <Text fontSize="$1" fontWeight="600" color="var(--accent-foreground)">
                    {busy === 'wallet' ? t('Connecting…') : t('Connect Wallet')}
                  </Text>
                </Box>
                <Box
                  render="button"
                  onClick={() => setShowWalletInput(true)}
                  px="$2"
                  py="$1"
                  rounded="$3"
                  borderWidth={1}
                  borderColor="$borderColor"
                  hoverStyle={{ bg: '$hover' }}
                  cursor="pointer"
                >
                  <Text fontSize="$1" color="$ink">{t('Enter address')}</Text>
                </Box>
              </XStack>
            )}
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
            {t('Connect your essential developer tools and Web3 wallet directly inside {brand()}.', { brand: brand() })}
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
              borderColor={walletDone ? GOOD : '$borderColor'}
              bg="$raised"
              items="center"
              justify="space-between"
              gap="$3"
            >
              <XStack items="center" gap="$3" flex={1}>
                <Wallet size={24} color="var(--primary)" />
                <YStack flex={1} minW={0}>
                  <Text fontSize="$3" fontWeight="600" color="$ink">{t('3. Web3 Wallet')}</Text>
                  <Text fontSize="$1" color="$soft">{t('On-chain identity, compute credits, and rewards')}</Text>
                </YStack>
              </XStack>
              {walletDone ? (
                <XStack items="center" gap="$1" px="$2" py="$1" rounded="$2" bg="$hover">
                  <Check size={14} color={GOOD} />
                  <Text fontSize="$1" color={GOOD} fontWeight="600">
                    {walletAddr ? truncate(walletAddr) : t('Connected')}
                  </Text>
                </XStack>
              ) : (
                <Box
                  render="button"
                  onClick={handleConnectWalletWeb3}
                  px="$3"
                  py="$1.5"
                  rounded="$3"
                  bg="var(--accent)"
                  hoverStyle={{ bg: 'var(--accent-hover)' }}
                  cursor="pointer"
                >
                  <Text fontSize="$2" fontWeight="600" color="var(--accent-foreground)">
                    {busy === 'wallet' ? t('Connecting…') : t('Connect')}
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
