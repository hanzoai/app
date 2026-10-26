'use client'

// The room while a settings row is open: every section's screen (Settings.tsx
// holds the rows). Loaded when a row is chosen, never with the room.

import { useMemo, useState } from 'react'
import { phrase } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { ArrowUpRight, Check, ExternalLink, Lock, Sparkles } from 'lucide-react'
import { useChatPreferences } from './lib/chatPreferences'
import { EFFORT_STEPS } from './ThinkingEffort'
import {
  Box,
  Button,
  Input,
  Separator,
  Text,
  XStack,
  YStack,
} from '@hanzo/ui'
import { tap } from './lib/tap'
import { useIam, useIamIdentity, useOrganizations } from '@hanzo/iam/react'
import { useSignOut } from './lib/signout'
import { useModels } from '@hanzo/ai/react'
import { ModelPicker } from '@hanzo/ui/models'
import { parseModels } from '@hanzo/ui/models/catalog'
import { UsagePanel } from '@hanzo/usage/panel'
import { administers, Credits, label, Plan, Title, useChoice } from '@hanzo/build'
import { Catalog } from './Directory'
import { payPage } from './lib/pay'
import { api } from './lib/api'
import { renewal, useSubscription, useTier } from './lib/tier'
import { spendShown, useLimits } from './lib/limits'
import { showSettings } from './open'
import { Look } from './look'
import { ProviderMark } from './ProviderMark'
import { bearer, org, pick } from './lib/session'
import { site } from './where'
import { named, ROWS } from './Settings'

/** A choice among a few: a hairline edge and a corner. The fill and the edge's
 *  ink are the call site's, because they say which one is chosen. */
const CHOICE = { rounded: 8, borderWidth: 1, borderStyle: 'solid', cursor: 'pointer' } as const

/**
 * The room, while a settings row is open.
 *
 * It scrolls itself, the way the column beside a room does: `main` gives its
 * child a floor and no overflow, so a pane that did not would push the whole
 * shell down the page.
 */
export function SettingsPane({ id }: { id: string }) {
  const { t } = useI18n()
  const row = ROWS.find((r) => r.id === id)

  return (
    <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden">
      <YStack p="$5" gap="$4" maxW={860}>
        <Text fontSize="$6" fontWeight="600" color="$ink">
          {row ? named(row, t) : t('Settings')}
        </Text>
        <Pane id={id} note={row?.note ? t(row.note) : undefined} />
      </YStack>
    </YStack>
  )
}

/** One pane. `note` arrives translated. */
function Pane({ id, note }: { id: string; note?: string }) {
  const { t } = useI18n()
  if (id === 'apps' || id === 'channels') return <Catalog tab={id} />
  if (id === 'general') return <Look />
  if (id === 'account') return <Account />
  if (id === 'billing') return <Billing />
  if (id === 'referrals') return <Referrals />
  if (id === 'usage') return <Usage />
  if (id === 'model') return <Model />
  if (id === 'models') return <Served />
  if (id === 'agent') return <AgentSettings />
  if (id === 'capabilities') return <Capabilities />
  if (id === 'memory') return <MemorySettings />

  return (
    <Text fontSize="$3" color="$soft">
      {note ?? t('Nothing to configure here yet.')}
    </Text>
  )
}

/**
 * One default in one place; agents may still bring their own model. A premium
 * model is never a default: it is picked per conversation, in the composer, so
 * this picker offers the rest of the catalog.
 */
function Model() {
  const { t } = useI18n()
  const { models: served } = useModels()
  const models = useMemo(() => parseModels(served).filter((m) => m.class !== 'premium'), [served])
  // The one choice Chat and Dev share (@hanzo/build): changed here, changed in both composers.
  const [choice, choose] = useChoice()
  const [chatPrefs, setChatPrefs] = useChatPreferences()
  const { isAuthenticated } = useIam()
  const { tier } = useTier(isAuthenticated, org())
  const paid = Boolean(tier?.plan && tier.plan !== 'free')

  return (
    <YStack gap="$5" maxW={540}>
      {/* Default Model */}
      <YStack gap="$2">
        <Text fontSize="$4" fontWeight="600" color="$ink">
          {t('Default model')}
        </Text>
        <Text fontSize="$2" color="$soft">
          {t('Used for new chats and runs. An agent with its own model keeps that choice.')}
        </Text>
        <XStack self="flex-start" pt="$1">
          <ModelPicker models={models} scope="chat" value={choice.model} onChange={(id) => choose({ model: id })} size="sm" />
        </XStack>
      </YStack>

      <Separator />

      {/* Reasoning Effort */}
      <YStack gap="$2">
        <Text fontSize="$4" fontWeight="600" color="$ink">
          {t('Default reasoning effort')}
        </Text>
        <Text fontSize="$2" color="$soft">
          {t('Sets how deeply models think before answering. Defaults to High across all plans.')}
        </Text>
        <XStack gap="$2" pt="$1" flexWrap="wrap">
          {EFFORT_STEPS.map((step) => {
            const active = (chatPrefs.effort || 'high') === step.id
            return (
              <Box
                render={<button type="button" />}
                key={step.id}
                {...tap}
                onClick={() => {
                  setChatPrefs({ effort: step.id })
                  if (step.id === 'low' || step.id === 'medium' || step.id === 'high') {
                    choose({ effort: step.id as any })
                  }
                }}
                {...CHOICE}
                bg={active ? 'var(--edge, var(--white-14))' : 'transparent'}
                borderColor={active ? 'var(--borderColor, var(--white-22))' : 'var(--white-08)'}
                py={6}
                px={12}
              >
                <XStack items="center" gap="$1.5">
                  <Text fontSize="$2" fontWeight={active ? '600' : '400'} color={active ? '$ink' : '$soft'}>
                    {step.label}
                  </Text>
                  {active ? <Check size={12} color="var(--primary)" aria-hidden /> : null}
                </XStack>
              </Box>
            )
          })}
        </XStack>
      </YStack>

      <Separator />

      {/* Tool & Action Approval (Auto vs Manual) */}
      <YStack gap="$2" data-slot="settings-approval-mode">
        <Text fontSize="$4" fontWeight="600" color="$ink">
          {t('Tool & action approval')}
        </Text>
        <Text fontSize="$2" color="$soft">
          {t('Choose whether agents run tools and connectors automatically or ask for manual approval before each action.')}
        </Text>
        <XStack gap="$2" pt="$1">
          {[
            { id: 'auto' as const, label: t('Auto'), desc: t('Runs tools on its own; pauses only for anything risky.') },
            { id: 'manual' as const, label: t('Manual'), desc: t('Asks before each tool, connector or site it opens.') },
          ].map((opt) => {
            const active = (chatPrefs.approvalMode || 'auto') === opt.id
            return (
              <Box
                render={<button type="button" />}
                key={opt.id}
                {...tap}
                onClick={() => setChatPrefs({ approvalMode: opt.id })}
                {...CHOICE}
                flex={1}
                p={10}
                bg={active ? 'var(--edge, var(--white-14))' : 'transparent'}
                borderColor={active ? 'var(--borderColor, var(--white-22))' : 'var(--white-08)'}
              >
                <XStack items="center" justify="space-between">
                  <Text fontSize="$2" fontWeight="600" color="$ink">
                    {opt.label}
                  </Text>
                  {active ? <Check size={12} color="var(--primary)" aria-hidden /> : null}
                </XStack>
                <Text fontSize="$1" color="$soft">
                  {opt.desc}
                </Text>
              </Box>
            )
          })}
        </XStack>
      </YStack>

      <Separator />

      {/* Advanced Paid Plan Controls */}
      <YStack gap="$3">
        <XStack items="center" justify="space-between">
          <YStack gap="$0.5">
            <XStack items="center" gap="$1.5">
              <Text fontSize="$4" fontWeight="600" color="$ink">
                {t('Advanced composer controls')}
              </Text>
              {!paid ? (
                <XStack items="center" gap="$1" px="$2" py="$0.5" rounded={9999} bg="var(--edge, var(--white-10))">
                  <Lock size={11} color="$soft" aria-hidden />
                  <Text fontSize="$1" fontWeight="600" color="$soft">
                    {t('Paid plan')}
                  </Text>
                </XStack>
              ) : null}
            </XStack>
            <Text fontSize="$2" color="$soft">
              {t('Customize composer controls and third-party model access.')}
            </Text>
          </YStack>
        </XStack>

        {/* Toggle 1: Show model selector in composer */}
        <YStack p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor" gap="$2">
          <XStack items="center" justify="space-between">
            <YStack flex={1} pr="$2">
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Show model selector in composer')}
              </Text>
              <Text fontSize="$2" color="$soft">
                {t('By default, chat composers simplify controls to reasoning effort only. Enable this to pick models on the fly in the composer.')}
              </Text>
            </YStack>
            <Button
              size="sm"
              variant={chatPrefs.showModelSelector ? 'default' : 'outline'}
              disabled={!paid}
              onClick={() => paid && setChatPrefs({ showModelSelector: !chatPrefs.showModelSelector })}
            >
              {chatPrefs.showModelSelector ? t('Enabled') : t('Disabled')}
            </Button>
          </XStack>
        </YStack>

        {/* Toggle 2: Enable third-party models */}
        <YStack p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor" gap="$2">
          <XStack items="center" justify="space-between">
            <YStack flex={1} pr="$2">
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Enable third-party models')}
              </Text>
              <Text fontSize="$2" color="$soft">
                {t('Third-party models (OpenAI, Anthropic, Google, DeepSeek) are billed from your pre-paid credit topup. First-party models (Enso, Zen, Kai) are covered by your plan.')}
              </Text>
            </YStack>
            <Button
              size="sm"
              variant={chatPrefs.allowThirdPartyModels ? 'default' : 'outline'}
              disabled={!paid}
              onClick={() => paid && setChatPrefs({ allowThirdPartyModels: !chatPrefs.allowThirdPartyModels })}
            >
              {chatPrefs.allowThirdPartyModels ? t('Enabled') : t('Disabled')}
            </Button>
          </XStack>
        </YStack>

        {/* Toggle 3: Show spoken language selector in composer */}
        <YStack p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor" gap="$2">
          <XStack items="center" justify="space-between">
            <YStack flex={1} pr="$2">
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Show language selector beside +')}
              </Text>
              <Text fontSize="$2" color="$soft">
                {t('Display the dictation language indicator next to the + context button on the composer row.')}
              </Text>
            </YStack>
            <Button
              size="sm"
              variant={chatPrefs.showLanguage ? 'default' : 'outline'}
              onClick={() => setChatPrefs({ showLanguage: !chatPrefs.showLanguage })}
            >
              {chatPrefs.showLanguage ? t('Enabled') : t('Disabled')}
            </Button>
          </XStack>
        </YStack>

        {/* Toggle 4: Show turbo approval indicator */}
        <YStack p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor" gap="$2">
          <XStack items="center" justify="space-between">
            <YStack flex={1} pr="$2">
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Show turbo approval indicator')}
              </Text>
              <Text fontSize="$2" color="$soft">
                {t('Display the turbo / manual approval badge next to the thinking effort and send controls.')}
              </Text>
            </YStack>
            <Button
              size="sm"
              variant={chatPrefs.showTurboApproval ? 'default' : 'outline'}
              onClick={() => setChatPrefs({ showTurboApproval: !chatPrefs.showTurboApproval })}
            >
              {chatPrefs.showTurboApproval ? t('Enabled') : t('Disabled')}
            </Button>
          </XStack>
        </YStack>

        {!paid ? (
          <XStack pt="$1">
            <Button size="sm" variant="outline" onClick={() => window.location.assign(site('/pricing'))}>
              <Sparkles size={14} color="var(--primary)" aria-hidden />
              {t('Upgrade to unlock advanced model controls')}
            </Button>
          </XStack>
        ) : null}
      </YStack>
    </YStack>
  )
}

/**
 * WHAT THE GATEWAY SERVES, read from the same `/v1/models` the rooms read.
 *
 * Counted, never typed: the catalog moves without this file, so a number written
 * here is wrong by the next deploy. An empty answer says the account reaches
 * nothing rather than drawing a zero, and the mark comes from the model's own
 * id so a family wears the logo of the lab that makes it.
 */
function Served() {
  const { t } = useI18n()
  const { models, loading, error } = useModels()

  if (loading) {
    return <Text fontSize="$3" color="$soft">{t('Reading the catalog.')}</Text>
  }
  if (error) {
    return <Text fontSize="$3" color="$soft">{t('The catalog did not answer: {message}', { message: error.message })}</Text>
  }
  if (models.length === 0) {
    return (
      <Text fontSize="$3" color="$soft">
        {t('No model answers on this account. Sign in to reach the ones your org opens.')}
      </Text>
    )
  }

  return (
    <YStack gap="$3">
      <Text fontSize="$3" color="$soft">
        {t('{count} models answer at {path} on this account.', { count: models.length, path: '/v1/models' })}
      </Text>
      <YStack>
        {models.map((m) => (
          <XStack
            key={m.id}
            items="center"
            gap="$2.5"
            py="$2"
            borderBottomWidth={1}
            borderColor="$borderColor"
          >
            <ProviderMark model={m.id} org={m.owned_by} size={16} ink />
            <Text fontSize="$2" color="$ink" flex={1}><bdi dir="ltr">{m.id}</bdi></Text>
            {m.owned_by ? <Text fontSize="$1" color="$soft"><bdi dir="ltr">{m.owned_by}</bdi></Text> : null}
          </XStack>
        ))}
      </YStack>
      <XStack>
        <Box render={<a href={site('/models')} />} {...tap}>
          <XStack items="center" gap="$2" py="$2">
            <Text fontSize="$3" color="$ink">{t('Browse the model catalog')}</Text>
            <ArrowUpRight size={13} aria-hidden />
          </XStack>
        </Box>
      </XStack>
    </YStack>
  )
}

/** Who is signed in, and where they can act. */
function Account() {
  const { t } = useI18n()
  const identity = useIamIdentity()
  const { isAuthenticated } = useIam()
  const logout = useSignOut()
  const { organizations, currentOrgId, currentRole, switchOrg } = useOrganizations()

  if (!isAuthenticated || !identity) {
    return <Text fontSize="$3" color="$soft">{t('Sign in to see your account.')}</Text>
  }

  return (
    <YStack gap="$4">
      <XStack items="center" gap="$3">
        <YStack
          width={44}
          height={44}
          rounded={22}
          bg="$borderColor"
          items="center"
          justify="center"
        >
          <Text fontSize="$3" color="$ink">{identity.initials}</Text>
        </YStack>
        <YStack gap="$1" flex={1} minW={0}>
          <Text fontSize="$4" color="$ink">{identity.name}</Text>
          {identity.email ? <Text fontSize="$2" color="$soft"><bdi dir="ltr">{identity.email}</bdi></Text> : null}
        </YStack>
      </XStack>

      <Separator />

      <YStack gap="$2">
        <Text fontSize="$2" color="$soft">{t('Organizations')}</Text>
        {organizations.length === 0 ? (
          <Text fontSize="$3" color="$soft">{t('You are not a member of an organization.')}</Text>
        ) : (
          organizations.map((o) => {
            const here = o.name === currentOrgId
            return (
              <Box render={<button type="button" />} key={o.name} onClick={() => { pick(o.name); switchOrg(o.name) }} {...tap}>
                <XStack items="center" justify="space-between" py="$2" width="100%" gap="$2">
                  <Text fontSize="$3" color={here ? '$ink' : '$soft'}>{o.displayName || o.name}</Text>
                  {here && currentRole ? <Text fontSize="$2" color="$soft">{currentRole}</Text> : null}
                </XStack>
              </Box>
            )
          })
        )}
      </YStack>

      <Separator />

      <WalletPayouts />

      <Separator />

      <XStack>
        <Button size="sm" onClick={() => logout()}>{t('Sign out')}</Button>
      </XStack>
    </YStack>
  )
}

/** Real Web3 Wallet Connect & Payout Address for collecting referral & compute rewards. */
function WalletPayouts() {
  const { t } = useI18n()
  const [address, setAddress] = useState<string>(() => {
    try {
      return typeof window !== 'undefined' ? (window.localStorage.getItem('hanzo.wallet.address') ?? '') : ''
    } catch {
      return ''
    }
  })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const persist = async (addr: string, provider: string) => {
    const clean = addr.trim()
    setAddress(clean)
    try {
      if (clean) window.localStorage.setItem('hanzo.wallet.address', clean)
      else window.localStorage.removeItem('hanzo.wallet.address')
    } catch {}
    const tok = bearer()
    if (tok && clean) {
      await fetch(`${api()}/v1/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          preferences: {
            rewards_payout_wallet: clean,
            rewards_payout_provider: provider,
          },
        }),
      }).catch(() => {})
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2400)
  }

  const connectEvm = async () => {
    setError('')
    setBusy(true)
    try {
      const eth = typeof window !== 'undefined' ? (window as unknown as { ethereum?: { request?: (args: { method: string }) => Promise<string[]> } }).ethereum : undefined
      if (!eth?.request) {
        setError(t('No EVM browser wallet detected. Install MetaMask, Coinbase Wallet, or Brave Wallet, or paste your payout address below.'))
        return
      }
      const accounts = await eth.request({ method: 'eth_requestAccounts' })
      const first = accounts?.[0]
      if (first) await persist(first, 'evm')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Wallet connection cancelled.'))
    } finally {
      setBusy(false)
    }
  }

  const connectSolana = async () => {
    setError('')
    setBusy(true)
    try {
      const sol = typeof window !== 'undefined' ? (window as unknown as { solana?: { connect?: () => Promise<{ publicKey?: { toString(): string } }> } }).solana : undefined
      if (!sol?.connect) {
        setError(t('No Solana wallet detected. Install Phantom or Backpack, or paste your payout address below.'))
        return
      }
      const resp = await sol.connect()
      const pub = resp?.publicKey?.toString()
      if (pub) await persist(pub, 'solana')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Wallet connection cancelled.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <YStack gap="$2.5" data-slot="wallet-payouts">
      <Text fontSize="$3" fontWeight="600" color="$ink">{t('Web3 Wallet & Rewards Payouts')}</Text>
      <Text fontSize="$2" color="$soft">
        {t('Connect your Web3 wallet (MetaMask, EVM / Base, or Solana) or enter a payout address to collect referral rewards, affiliate commissions, and AI compute rebates.')}
      </Text>
      <XStack gap="$2" flexWrap="wrap">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void connectEvm()}>
          {t('Connect EVM / MetaMask')}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void connectSolana()}>
          {t('Connect Solana Wallet')}
        </Button>
      </XStack>
      <XStack gap="$2" items="center">
        <Input
          flex={1}
          size="sm"
          placeholder={t('0x... (EVM / Base) or Solana payout address')}
          value={address}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
        />
        <Button size="sm" onClick={() => void persist(address, 'manual')}>
          {saved ? t('Saved!') : t('Save Payout Wallet')}
        </Button>
      </XStack>
      {error ? <Text fontSize="$1" color="$soft">{error}</Text> : null}
    </YStack>
  )
}

/** Referrals & Rewards — customer referral program and affiliate partner portal. */
function Referrals() {
  const { t } = useI18n()
  const identity = useIamIdentity()
  const { isAuthenticated } = useIam()
  const [copied, setCopied] = useState(false)
  const [vanity, setVanity] = useState('')
  const [applied, setApplied] = useState(false)

  if (!isAuthenticated || !identity) {
    return <Text fontSize="$3" color="$soft">{t('Sign in to view your referral program.')}</Text>
  }

  const handle = identity.name ? identity.name.toLowerCase().replace(/\s+/g, '-') : (identity.email ? identity.email.split('@')[0] : 'user')
  const referralUrl = `https://hanzo.ai/?ref=${encodeURIComponent(handle)}`

  const copy = () => {
    navigator.clipboard.writeText(referralUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tweet = () => {
    const text = 'Deploy AI agents, sites, and apps on @HanzoAI. Get $20 in free cloud compute credits:'
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralUrl)}`, '_blank', 'noopener,noreferrer')
  }

  const linkedin = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`, '_blank', 'noopener,noreferrer')
  }

  const telegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralUrl)}&text=${encodeURIComponent('Get $20 free Hanzo cloud compute credits:')}`, '_blank', 'noopener,noreferrer')
  }

  const whatsapp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent('Deploy with Hanzo — get $20 in free cloud credits: ' + referralUrl)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <YStack gap="$5" maxW={640}>
      <YStack gap="$1.5">
        <XStack items="center" gap="$2">
          <Text fontSize="$4" fontWeight="600" color="$ink">{t('Give $20, Get 20%')}</Text>
        </XStack>
        <Text fontSize="$3" color="$soft">
          {t('Invite developers, creators, and colleagues to Hanzo. They get $20 in free cloud compute credits, and you earn 20% recurring revenue share on their compute spend for 12 months.')}
        </Text>
      </YStack>

      <YStack gap="$2" p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor">
        <Text fontSize="$2" fontWeight="600" color="$ink">{t('Your Personal Referral Link')}</Text>
        <XStack items="center" gap="$2">
          <Box flex={1} p="$2" rounded="$2" bg="$hover" borderWidth={1} borderColor="$borderColor">
            <Text fontSize="$2" color="$ink" fontFamily="$mono" numberOfLines={1}>{referralUrl}</Text>
          </Box>
          <Button size="sm" onClick={copy}>
            {copied ? t('Copied!') : t('Copy Link')}
          </Button>
        </XStack>

        <XStack items="center" justify="space-between" pt="$2" flexWrap="wrap" gap="$2">
          <Text fontSize="$1" color="$soft">{t('1-Click Social Share:')}</Text>
          <XStack gap="$2" flexWrap="wrap">
            <Button size="sm" variant="outline" onClick={tweet}>𝕏 (Twitter)</Button>
            <Button size="sm" variant="outline" onClick={linkedin}>LinkedIn</Button>
            <Button size="sm" variant="outline" onClick={telegram}>Telegram</Button>
            <Button size="sm" variant="outline" onClick={whatsapp}>WhatsApp</Button>
          </XStack>
        </XStack>
      </YStack>

      <Separator />

      <WalletPayouts />

      <Separator />

      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="600" color="$ink">{t('Referral Rules & Offer Details')}</Text>
        <YStack gap="$1">
          <Text fontSize="$2" color="$soft">• {t('30-day attribution window: First click binds to user identity upon registration.')}</Text>
          <Text fontSize="$2" color="$soft">• {t('20% recurring margin share: Calculated against net platform margin (safe from wholesale token dilution).')}</Text>
          <Text fontSize="$2" color="$soft">• {t('Payout options: Platform credits, direct wire/ACH, or on-chain EVM wallet settlement.')}</Text>
        </YStack>
      </YStack>

      <Separator />

      <YStack gap="$3">
        <Text fontSize="$3" fontWeight="600" color="$ink">{t('Official Affiliate & Creator Program')}</Text>
        <Text fontSize="$2" color="$soft">
          {t('Building an open-source project, template, or dev community? Apply for official affiliate status for custom vanity links (hanzo.ai/?aff=code) and elevated commission tiers.')}
        </Text>
        {!applied ? (
          <XStack gap="$2">
            <Input
              flex={1}
              size="sm"
              placeholder={t('Desired vanity code (e.g. your project)')}
              value={vanity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVanity(e.target.value)}
            />
            <Button size="sm" onClick={() => { if (vanity.trim()) setApplied(true) }}>
              {t('Apply for Partner')}
            </Button>
          </XStack>
        ) : (
          <Box p="$3" rounded="$2" bg="$hover">
            <Text fontSize="$2" color="$ink">{t('Application submitted for review. Manage payouts and advanced settings in platform.hanzo.ai/dashboard/settings/referrals')}</Text>
          </Box>
        )}
        <XStack pt="$1">
          <Box render={<a href="https://platform.hanzo.ai/dashboard/settings/referrals" target="_blank" rel="noreferrer" />} {...tap}>
            <XStack items="center" gap="$1.5">
              <Text fontSize="$2" color="$ink">{t('Open Full Referrals & Affiliate Portal')}</Text>
              <ArrowUpRight size={13} aria-hidden />
            </XStack>
          </Box>
        </XStack>
      </YStack>
    </YStack>
  )
}

/** Where the plan's and billing's reads go: this browser's bearer, in its organization. */
function useTarget() {
  const scoped = org()
  return useMemo(() => ({ api: api(), token: bearer, org: scoped }), [scoped])
}

/**
 * The plan and its term, then the credits — @hanzo/build's `Credits`, the one
 * view every Billing page draws: the balance, grants, auto-reload, this month's
 * spend and its limit, said to be separate from the plan's usage. Money moves on
 * the payment host, so adding funds and a card both open it.
 */
function Billing() {
  const { t } = useI18n()
  const { isAuthenticated } = useIam()
  const target = useTarget()
  const { tier } = useTier(isAuthenticated, org())
  const sub = useSubscription(isAuthenticated, org())
  if (!isAuthenticated) return <Text fontSize="$3" color="$soft">{t('Sign in to see billing.')}</Text>
  // WHAT THE CUSTOMER BOUGHT, by its family: `Max` with `20x` beside it.
  const plan = tier ? label(tier.plan, tier.tier.name) ?? { name: 'Free', tag: '' } : null
  return (
    <YStack gap="$5">
      {plan ? (
        <YStack gap="$1" data-slot="billing-plan">
          <Title label={plan} size="$5" />
          <Text fontSize="$2" color="$soft">
            {sub ? renewal(sub, t) : tier?.plan ? t('Your plan.') : t('No paid plan. Usage is paid from credits.')}
          </Text>
        </YStack>
      ) : (
        <Text fontSize="$3" color="$soft">{t('Reading your plan…')}</Text>
      )}
      <Credits target={target} admin={administers(bearer(), org())} add={payPage()} />
      <Separator />
      <YStack gap="$2">
        <Text fontSize="$2" color="$soft">{t('Payment')}</Text>
        <Text fontSize="$3" color="$soft">
          {t('A card is entered on the payment host and nowhere else, so this is the one control here that opens another surface.')}
        </Text>
        <XStack>
          <Box render={<a href={payPage()} target="_blank" rel="noreferrer" />} {...tap}>
            <XStack items="center" gap="$2" py="$2">
              <Text fontSize="$3" color="$ink">{t('Manage plan, payment method and invoices')}</Text>
              <ExternalLink size={13} aria-hidden />
            </XStack>
          </Box>
        </XStack>
      </YStack>
    </YStack>
  )
}

/**
 * Usage: @hanzo/build's `Plan`, the one view every Usage page draws — the plan's
 * windows and each class of model's share, as shares; the free allowance on
 * Free; the balance with no plan — and the choice of paying from credits once
 * the allowance runs out. A reader with no paid plan also sees what was spent,
 * over time (@hanzo/usage), because money is their meter.
 */
function Usage() {
  const { t } = useI18n()
  const { accessToken, isAuthenticated } = useIam()
  const target = useTarget()
  const read = useLimits(isAuthenticated, org())

  if (!isAuthenticated || !accessToken) {
    return <Text fontSize="$3" color="$soft">{t('Sign in to see your usage.')}</Text>
  }
  const plan = <Plan target={target} onPlans={() => window.location.assign(site('/pricing'))} onBilling={() => showSettings('billing')} />
  if (!spendShown(read)) return plan
  // The address is read HERE rather than at import: the panel sends the bearer
  // with every read, and a credentialed read to an absolute address from a page
  // the gateway does not admit dies in preflight — which drew this panel as an
  // account that had spent nothing.
  return (
    <YStack gap="$6">
      {plan}
      <UsagePanel baseUrl={api()} token={accessToken} upgrade={payPage()} title={t('Spend')} />
    </YStack>
  )
}

/** `words`: the name is authored English, drawn through `t`; the rest are people's names, drawn as they are. */
const HISTORICAL_PERSONAS: { id: string; name: string; role: string; words?: true }[] = [
  { id: 'architect', name: phrase('Software Architect'), role: 'Full-stack & systems design', words: true },
  { id: 'satoshi', name: 'Satoshi Nakamoto', role: 'Distributed cryptography & consensus' },
  { id: 'turing', name: 'Alan Turing', role: 'Algorithmic logic & formal verification' },
  { id: 'ada', name: 'Ada Lovelace', role: 'Computational precision & analysis' },
  { id: 'davinci', name: 'Leonardo da Vinci', role: 'Polymathic engineering & design' },
]

function AgentSettings() {
  const { t } = useI18n()
  const [instructions, setInstructions] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('hanzo.agent.instructions') || 'You are an autonomous AI software engineer at Hanzo. Think step-by-step and write robust code.'
  })
  const [persona, setPersona] = useState(() => {
    if (typeof window === 'undefined') return 'architect'
    return localStorage.getItem('hanzo.agent.persona') || 'architect'
  })
  const [autonomy, setAutonomy] = useState<'supervised' | 'autonomous'>(() => {
    if (typeof window === 'undefined') return 'autonomous'
    return (localStorage.getItem('hanzo.agent.autonomy') as any) || 'autonomous'
  })
  const [saved, setSaved] = useState(false)

  const [, setChatPrefs] = useChatPreferences()
  const save = () => {
    localStorage.setItem('hanzo.agent.instructions', instructions)
    localStorage.setItem('hanzo.agent.persona', persona)
    localStorage.setItem('hanzo.agent.autonomy', autonomy)
    setChatPrefs({ approvalMode: autonomy === 'supervised' ? 'manual' : 'auto' })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <YStack gap="$4" maxW={480}>
      <Text fontSize="$3" color="$soft">
        {t('Nothing is bound to this surface yet — when you bind a personal agent, its persona, tools and memory live here rather than in a shared team.')}
      </Text>
      <YStack gap="$1.5">
        <Text fontSize="$3" fontWeight="600" color="$ink">{t('Persona & Historical Character')}</Text>
        <Text fontSize="$2" color="$soft">
          {t('Pick an intellectual archetype for agent reasoning and tone.')}
        </Text>
        <XStack flexWrap="wrap" gap="$2" pt="$1">
          {HISTORICAL_PERSONAS.map((p) => {
            const active = persona === p.id
            return (
              <Box
                render={<button type="button" />}
                key={p.id}
                {...tap}
                onClick={() => setPersona(p.id)}
                {...CHOICE}
                bg={active ? 'var(--edge, var(--white-14))' : 'transparent'}
                borderColor={active ? 'var(--borderColor, var(--white-22))' : 'var(--white-08)'}
                py={6}
                px={12}
              >
                <Text fontSize="$2" fontWeight={active ? '600' : '400'} color={active ? '$ink' : '$soft'}>
                  {p.words ? t(p.name) : p.name}
                </Text>
              </Box>
            )
          })}
        </XStack>
      </YStack>

      <Separator />

      <YStack gap="$1.5">
        <Text fontSize="$3" fontWeight="600" color="$ink">{t('System Prompt Instructions')}</Text>
        <Text fontSize="$2" color="$soft">
          {t('Custom system directions prepended to all coding and research runs.')}
        </Text>
        <Text
          render={<textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} />}
          width="100%"
          bg="var(--panel, color-mix(in srgb, var(--pure-black) 30%, transparent))"
          color="inherit"
          borderWidth={1}
          borderColor="var(--borderColor, var(--white-15))"
          rounded={8}
          p={10}
          fontSize="$2"
          fontFamily="$mono"
        />
      </YStack>

      <Separator />

      <YStack gap="$1.5">
        <Text fontSize="$3" fontWeight="600" color="$ink">{t('Autonomy & Permissions')}</Text>
        <XStack gap="$2">
          <Box
            render={<button type="button" />}
            {...tap}
            onClick={() => setAutonomy('autonomous')}
            {...CHOICE}
            flex={1}
            p={10}
            bg={autonomy === 'autonomous' ? 'var(--edge, var(--white-14))' : 'transparent'}
            borderColor={autonomy === 'autonomous' ? 'var(--borderColor, var(--white-22))' : 'var(--white-08)'}
          >
            <Text fontSize="$2" fontWeight="600" color="$ink">{t('Autonomous')}</Text>
            <Text fontSize="$1" color="$soft">{t('Executes tools & writes code without interrupting.')}</Text>
          </Box>
          <Box
            render={<button type="button" />}
            {...tap}
            onClick={() => setAutonomy('supervised')}
            {...CHOICE}
            flex={1}
            p={10}
            bg={autonomy === 'supervised' ? 'var(--edge, var(--white-14))' : 'transparent'}
            borderColor={autonomy === 'supervised' ? 'var(--borderColor, var(--white-22))' : 'var(--white-08)'}
          >
            <Text fontSize="$2" fontWeight="600" color="$ink">{t('Supervised')}</Text>
            <Text fontSize="$1" color="$soft">{t('Requests confirmation before file writes and commands.')}</Text>
          </Box>
        </XStack>
      </YStack>

      <XStack self="flex-start" pt="$2">
        <Button size="sm" onClick={save}>
          {t(saved ? 'Saved' : 'Save agent preferences')}
        </Button>
      </XStack>
    </YStack>
  )
}

/**
 * WHAT A RUN MAY REACH FOR — the four capabilities, described and not measured.
 *
 * Each row used to carry a badge reading "Enabled", and the MCP row read
 * "Active (:8080/mcp)". Nothing asked. No call stands behind any of the four,
 * so the badges said "on" for a reader whose run had none of it, and the port
 * was one developer's machine printed on everybody's settings pane. A green
 * light nobody wired is worse than no light: it is read as a check that passed.
 *
 * These are facts about the PRODUCT — what a run is allowed to do — which is
 * what this pane is for. Whether a given run got them is a fact about that run,
 * and the run is where it belongs.
 */
function Capabilities() {
  const { t } = useI18n()
  return (
    <YStack gap="$3" maxW={480}>
      <Text fontSize="$3" color="$soft">
        {t('What models and agent swarms are granted access to during tasks.')}
      </Text>
      <YStack gap="$2" pt="$1">
        {[
          { id: 'files', title: t('Filesystem (Read / Write)'), desc: t('Create, modify, and delete workspace files in the target repository.') },
          { id: 'shell', title: t('Shell & Terminal Exec'), desc: t('Execute build, test, and shell commands in isolated sandbox VMs.') },
          { id: 'web', title: t('Live Web & Search'), desc: t('Query internet search APIs and fetch web documentation.') },
          { id: 'mcp', title: t('MCP Protocol Server'), desc: t('Expose local and remote tools via Model Context Protocol at /mcp.') },
        ].map((cap) => (
          <YStack key={cap.id} gap="$0.5" p="$2.5" rounded="$3" borderWidth={1} borderColor="$borderColor">
            <Text fontSize="$3" fontWeight="600" color="$ink">{cap.title}</Text>
            <Text fontSize="$2" color="$soft">{cap.desc}</Text>
          </YStack>
        ))}
      </YStack>
    </YStack>
  )
}

function MemorySettings() {
  const { t } = useI18n()
  const [cleared, setCleared] = useState(false)

  const clearMemory = () => {
    localStorage.removeItem('hanzo.chat.history')
    setCleared(true)
    setTimeout(() => setCleared(false), 2000)
  }

  return (
    <YStack gap="$3" maxW={480}>
      <Text fontSize="$3" color="$soft">
        {t('Semantic memory and conversation recall across sessions.')}
      </Text>
      {/* Described, not measured — the badge here read "Active (pgvector)" for
          an index nothing had asked about, and named the store it is kept in,
          which is the estate talking to itself. The button below is the one
          thing on this pane that acts, and it acts on this browser. */}
      <YStack gap="$0.5" p="$2.5" rounded="$3" borderWidth={1} borderColor="$borderColor">
        <Text fontSize="$3" fontWeight="600" color="$ink">{t('Semantic Vector Index')}</Text>
        <Text fontSize="$2" color="$soft">{t('Automatically indexes past workspace sessions into vector memory.')}</Text>
      </YStack>
      <XStack self="flex-start" pt="$2">
        <Button size="sm" variant="outline" onClick={clearMemory}>
          {t(cleared ? 'Memory cleared' : 'Clear local memory cache')}
        </Button>
      </XStack>
    </YStack>
  )
}
