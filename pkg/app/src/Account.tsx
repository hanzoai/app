'use client'

// Unified profile trigger & HoverCard for the signed-in shell:
// - Hovering shows membership tier, live usage/credit stats, Developer mode toggle,
//   workspace switcher, Upgrade CTA, and quick actions.
// - Clicking the profile button itself remembers the current route and opens
//   `/settings/account` in 1 click.
// - A subtle `⋯` menu inside the hover card exposes multi-account switching,
//   language selection, keyboard shortcuts, and organization creation.

import { forget, trusts } from './lib/spend'
import { phrase, locales } from '@hanzo/i18n'
import { useI18n } from '@hanzo/i18n/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SizableText, XStack, YStack } from '@hanzo/gui'
import {
  ArrowUpRight,
  Activity,
  BookOpen,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Bug,
  CircleHelp,
  CircleUserRound,
  Download,
  FileText,
  FlaskConical,
  Info,
  Keyboard,
  Languages,
  LifeBuoy,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  Palette,
  Plus,
  RotateCcw,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { label, Meter, said as spoken, useStanding, type Host } from '@hanzo/build'
import { useOrganizations } from '@hanzo/iam/react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Input,
  Kbd,
  Switch,
  Text,
} from '@hanzo/ui'
import { label as accountLabel, useAccounts } from './lib/accounts'
import { useSigningOut } from './lib/signout'
import { api } from './lib/api'
import { createOrg, say } from './lib/org'
import type { Tier } from './lib/tier'
import { list } from './lib/list'
import { onServed } from './lib/served'
import { subscribeTokens, totalRecordedTokens } from './lib/tokens'
import { choose, org as current, orgs, renew, reopen, scope, superAdmin } from './lib/session'
import { ENTRY, settings } from './lib/host'
import { rememberSettingsReturn, useDevMode } from './lib/dev-mode'
import { InfoHint } from './lib/info-hint'
import { leave } from './dev'
import { reportProblem } from './Report'
import { legal, out, pages, rows, type KeyGroup, type Row } from './help'
import { showSettings } from './open'
import { MARK } from './ground'
import { site, where } from './where'
import { BAD } from './lib/mix'

/** An organization this tab created, until the token carries it. */
const MADE = 'hanzo:org:made'
const INK = 'var(--foreground)'
const SOFT = 'var(--text-secondary, var(--muted-foreground))'
const STRONG = 'var(--border-strong)' as const
const FOCUS_RING = { outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' } as const

/** What the menu reads of its host: who is signed in, in which organization, and how they leave. */
export type Who = Pick<Host, 'api' | 'token' | 'org' | 'person' | 'signOut'>

/** Each Help page's icon, by its key in help.ts. */
const ICONS: Record<string, ReactNode> = {
  help: <CircleHelp size={16} aria-hidden />,
  docs: <BookOpen size={16} aria-hidden />,
  contact: <MessagesSquare size={16} aria-hidden />,
  center: <ShieldCheck size={16} aria-hidden />,
  releases: <ScrollText size={16} aria-hidden />,
  download: <Download size={16} aria-hidden />,
  terms: <FileText size={16} aria-hidden />,
  privacy: <Info size={16} aria-hidden />,
}

/** One organization as the menu draws it. */
export interface Org {
  name: string
  display: string
  personal: boolean
  role: string
}

/** IAM's roles as a person reads them, through `t`. */
const ROLES: Record<string, string> = { owner: phrase('Owner'), admin: phrase('Admin'), member: phrase('Member') }

/** A role as a person reads it: `owner` -> Owner; one IAM names that these do not, capitalised as it comes. */
const said = (role: string, t: (source: string) => string): string =>
  ROLES[role] ? t(ROLES[role]) : role ? role.charAt(0).toUpperCase() + role.slice(1) : ''

/** The first letters of a name, at most two: Antje Worring -> AW. */
export const initials = (name: string): string =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?'

/** The plan from a tier answer: its display name (`Unlimited`), else by its family (`Max 20x`); '' with no plan. */
export const planOf = (tier: Tier | null): string => (tier ? spoken(label(tier.plan, tier.tier?.name, tier.planName)) : '')

/**
 * The token's organizations with IAM's rows beside them: display name, and which
 * one is the person's own. The personal organization leads, then the token's order.
 */
function useOrgs(currentOrg: string | null): Org[] {
  const { roles } = useOrganizations()
  const names = orgs()
  const [rows, setRows] = useState<{ name?: string; displayName?: string; isPersonal?: boolean }[]>([])
  const key = names.join(',')
  useEffect(() => {
    if (!key) return
    const stop = new AbortController()
    fetch(`${api()}/v1/iam/organizations?limit=100`, { headers: scope(), signal: stop.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { organizations?: unknown } | null) => {
        if (!stop.signal.aborted) setRows(list(body?.organizations))
      })
      .catch(() => {})
    return () => stop.abort()
  }, [key, currentOrg])
  const drawn = names.map((name) => {
    const row = rows.find((r) => r?.name === name)
    return { name, display: row?.displayName || name, personal: Boolean(row?.isPersonal), role: roles?.[name] ?? '' }
  })
  return [...drawn.filter((o) => o.personal), ...drawn.filter((o) => !o.personal)]
}

/** The plan of an organization: billing, asked in its name. */
function usePlan(orgName: string | null, enabled: boolean): string {
  const [plan, setPlan] = useState('')
  useEffect(() => {
    if (!enabled || !orgName) return
    const stop = new AbortController()
    fetch(`${api()}/v1/billing/tier`, { headers: { ...scope(), 'X-Org-Id': orgName }, signal: stop.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((t: Tier | null) => {
        if (!stop.signal.aborted) setPlan(planOf(t))
      })
      .catch(() => {})
    return () => stop.abort()
  }, [orgName, enabled])
  return plan
}

/** The person's picture, or their initials. */
export function Face({ host, size = 28 }: { host: Who; size?: number }) {
  const p = host.person
  const cleanSrc = p?.avatar && !(p.avatar.includes('gravatar.com/avatar/') && p.avatar.includes('d=identicon')) ? p.avatar : undefined
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [cleanSrc])
  return (
    <XStack
      width={size}
      height={size}
      rounded={9999}
      items="center"
      justify="center"
      bg="$raised"
      overflow="hidden"
      shrink={0}
      borderWidth={1}
      borderColor={STRONG}
    >
      {cleanSrc && !failed ? (
        <img src={cleanSrc} alt="" width={size} height={size} onError={() => setFailed(true)} />
      ) : (
        <SizableText size={size >= 30 ? '$2' : '$1'} fontWeight="600" color="$ink">
          {initials(p?.name || p?.email || '')}
        </SizableText>
      )}
    </XStack>
  )
}

/** A row's face: its icon in a 20px well, its words, and what trails them. */
function Line({ icon, children, sub, trail }: { icon?: ReactNode; children: string; sub?: string; trail?: ReactNode }) {
  return (
    <>
      {icon !== undefined ? (
        <XStack width={20} height={20} items="center" justify="center" shrink={0}>
          {icon}
        </XStack>
      ) : null}
      <YStack flex={1} minW={0}>
        <SizableText size="$2" color="$ink" numberOfLines={1}>
          {children}
        </SizableText>
        {sub ? (
          <SizableText size="$1" color="$soft" numberOfLines={1}>
            {sub}
          </SizableText>
        ) : null}
      </YStack>
      {trail}
    </>
  )
}

/** An organization's mark in the list: its initials on a rounded square. */
const Mark = ({ org }: { org: Org }) => (
  <XStack
    width={18}
    height={18}
    rounded="$2"
    items="center"
    justify="center"
    bg="$raised"
    borderWidth={1}
    borderColor="$edge"
    shrink={0}
  >
    {org.personal ? (
      <SizableText size="$1" fontWeight="600" color="$ink">
        {initials(org.display).charAt(0)}
      </SizableText>
    ) : (
      <Building2 size={12} color={INK} aria-hidden />
    )}
  </XStack>
)

/**
 * The plans a person stays on: nothing is sold above them. Enterprise and Agency
 * are arranged with the team; Unlimited is assigned at admin.hanzo.ai and is
 * above every plan the pay site sells, so "Upgrade plan" sent an Unlimited org
 * from Dev to a checkout of Go and Pro (hanzo-inc/app issue 303).
 */
const STAY = new Set(['Enterprise', 'Agency', 'Unlimited'])

/** Whether the organization's plan is one a person stays on (`STAY`): its row opens Billing, not the plans. */
export const stays = (family: string | null | undefined): boolean => STAY.has(family ?? '')

/**
 * The plans row, named by the plan the organization is on: a plan a person
 * stays on (`stays`) names theirs; every other plan, Free included, is one to
 * move up from.
 */
export const upgrade = (family: string | null | undefined): string =>
  family === 'Enterprise'
    ? phrase('Enterprise plan')
    : family === 'Agency'
      ? phrase('Agency plan')
      : family === 'Unlimited'
        ? phrase('Unlimited plan')
        : phrase('Upgrade plan')

/** The keys a row prints, in this platform's spelling. */
const mac = (): boolean => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

export function Account({
  host,
  narrow = false,
  above = false,
  onOrg,
  defaultAccountOpen = false,
}: {
  host: Who
  /** The rail's folded mode: the face alone, the hover card opening beside it. */
  narrow?: boolean
  /**
   * The card opens above the face, not beside it: the foot of a phone's menu
   * (Drawer.tsx). That copy leaves ⌘/ to the rail's own, so one press opens one dialog.
   */
  above?: boolean
  /** Work in another organization: picked, then the app opened in it. */
  onOrg: (org: string) => void
  defaultAccountOpen?: boolean
}) {
  const { t, dir, locale, setLocale } = useI18n()
  const rtl = dir === 'rtl'
  const [devMode, setDevMode] = useDevMode()
  const [hoverOpen, setHoverOpen] = useState(false)
  // Which sign-out control was pressed: it says "Signing out…" while the one sign-out runs (lib/signout).
  const signingOut = useSigningOut()
  const [pressed, setPressed] = useState<'one' | 'all' | 'hover' | null>(null)
  const leaving = (which: 'one' | 'all' | 'hover') => signingOut && pressed === which
  const [menuOpen, setMenuOpen] = useState(false)
  const [workspacesOpen, setWorkspacesOpen] = useState(false)
  const [account, setAccount] = useState(defaultAccountOpen ?? false)
  const [orgsOpen, setOrgsOpen] = useState(false)
  const [lang, setLang] = useState(false)
  const [langQuery, setLangQuery] = useState('')
  const [help, setHelp] = useState(false)
  const [creating, setCreating] = useState(false)
  const [keys, setKeys] = useState(false)
  const row = useRef<HTMLElement | null>(null)
  const currentOrg = host.org
  const signedIn = useAccounts()
  const others = signedIn.accounts.filter((a) => a.sub !== signedIn.current?.sub)
  const several = signedIn.accounts.length > 1
  const all = useOrgs(currentOrg)
  const here = all.find((o) => o.name === currentOrg) ?? null
  const personal = all.find((o) => o.personal) ?? null
  const target = useMemo(() => ({ api: host.api, token: host.token, org: host.org }), [host.api, host.token, host.org])
  const read = useStanding(target, Boolean(host.person))
  const currentTierPlan = usePlan(currentOrg, Boolean(host.person))
  const [tokenTick, setTokenTick] = useState(0)

  useEffect(() => {
    const offServed = onServed(() => {
      setTokenTick((n) => n + 1)
      if (hoverOpen || menuOpen) read.reload()
    })
    const offTokens = subscribeTokens(() => {
      setTokenTick((n) => n + 1)
      if (hoverOpen || menuOpen) read.reload()
    })
    return () => {
      offServed()
      offTokens()
    }
  }, [hoverOpen, menuOpen, read])

  useEffect(() => {
    if (hoverOpen || (account && menuOpen)) read.reload()
  }, [hoverOpen, account, menuOpen, read])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.has('checkout') || params.has('subscription')) {
      read.reload()
    }
  }, [read])

  const liveRead = useMemo(() => {
    void tokenTick
    if (!read.value || !read.value.limits) return read
    const recorded = totalRecordedTokens()
    const hasChatTurn =
      typeof window !== 'undefined' &&
      (/^\/chat\/[^/]+/.test(window.location.pathname) ||
        document.querySelectorAll('[data-slot="message"], [data-slot="turn-assistant"]').length > 0)
    if (recorded <= 0 && !hasChatTurn) return read
    const lim = read.value.limits
    const floorPct = recorded > 0 ? Math.min(100, Math.max(1, Math.round(recorded / 5000))) : 1
    const classes = { ...lim.classes }
    for (const k of Object.keys(classes) as Array<keyof typeof classes>) {
      const c = classes[k]
      if (c && c.percent === 0) classes[k] = { ...c, percent: 1 }
    }
    return {
      ...read,
      value: {
        ...read.value,
        limits: {
          ...lim,
          session: lim.session && lim.session.percent === 0 ? { ...lim.session, percent: floorPct } : lim.session,
          day: lim.day && lim.day.percent === 0 ? { ...lim.day, percent: Math.max(1, Math.round(floorPct / 2)) } : lim.day,
          classes,
        },
      },
    }
  }, [read, tokenTick])

  const other = usePlan(personal && personal.name !== currentOrg ? personal.name : null, hoverOpen || menuOpen)
  // The platform SuperAdmin (owner == "admin") is never offered a plan: the badge names the role.
  const sudo = superAdmin()
  const plan = sudo ? t('Admin') : spoken(read.value?.label ?? null) || currentTierPlan
  const planFor = (o: Org) => (o.name === currentOrg ? plan : o.personal ? other : '')
  const who = host.person?.name || host.person?.email || ''
  // A plan not yet read is not Free: Free is what billing answered, and no answer shows no plan and no offer.
  const known = Boolean(plan) || read.value !== null
  const isFree = !sudo && known && (!plan || plan.toLowerCase() === 'free')
  const planName = plan || (known ? t('Free') : '')
  const working = [here ? (here.personal ? t('Personal') : here.display) : currentOrg, planName].filter(Boolean).join(' - ')
  const plans = upgrade(read.value?.label?.name)
  const apple = mac()

  const goSettings = (section: string) => {
    setHoverOpen(false)
    setMenuOpen(false)
    rememberSettingsReturn()
    showSettings(section)
  }

  const triggerUpgrade = () => {
    setHoverOpen(false)
    setMenuOpen(false)
    if (stays(read.value?.label?.name)) {
      rememberSettingsReturn()
      showSettings('billing')
      return
    }
    leave('here')
  }

  const back = (e: Event) => {
    e.preventDefault()
    requestAnimationFrame(() => {
      const now = document.activeElement
      if (!now || now === document.body) row.current?.focus()
    })
  }

  if (!host.person) return null

  const tierPill = (
    <XStack
      data-slot="me-tier-pill"
      px="$2"
      py={2}
      rounded="$10"
      items="center"
      justify="center"
      shrink={0}
      borderWidth={1}
      bg={isFree ? '$panel' : '$raised'}
      borderColor={isFree ? '$edge' : STRONG}
    >
      <Text
        fontFamily="$body"
        fontSize="$1"
        fontWeight="600"
        color={isFree ? '$aside' : '$ink'}
        numberOfLines={1}
      >
        {planName}
      </Text>
    </XStack>
  )

  const offer = isFree ? (
    <XStack
      render={<button type="button" />}
      data-slot="me-upgrade"
      aria-label={t('Upgrade plan')}
      onClick={triggerUpgrade}
      width={narrow ? (above ? 44 : MARK) : '100%'}
      height={narrow ? (above ? 44 : MARK) : undefined}
      minH={narrow ? undefined : 36}
      px={narrow ? 0 : '$2.5'}
      mb="$1"
      gap="$2"
      rounded={narrow ? 12 : '$3'}
      items="center"
      justify="center"
      bg="$raised"
      borderWidth={1}
      borderColor={STRONG}
      hoverStyle={{ bg: '$hover' }}
      focusVisibleStyle={FOCUS_RING}
      cursor="pointer"
    >
      <Sparkles size={14} color={INK} aria-hidden />
      {narrow ? null : (
        <Text fontFamily="$body" fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1}>
          {t('Upgrade')}
        </Text>
      )}
    </XStack>
  ) : null

  return (
    <>
      {offer}
      <HoverCard
        open={hoverOpen}
        onOpenChange={(next) => {
          if (!next && menuOpen) return
          setHoverOpen(next)
          if (!next) setWorkspacesOpen(false)
        }}
        openDelay={120}
        closeDelay={180}
      >
        <HoverCardTrigger asChild>
          <XStack
            ref={(el: unknown) => {
              row.current = el instanceof HTMLElement ? el : null
            }}
            render={<button type="button" />}
            data-slot="me"
            aria-label={t('Account: {name}', { name: [who, currentOrg].filter(Boolean).join(' · ') })}
            width={narrow ? (above ? 44 : MARK) : '100%'}
            height={narrow ? (above ? 44 : MARK) : undefined}
            minH={narrow ? (above ? 44 : MARK) : 42}
            $touchable={narrow ? { width: 44, height: 44, minH: 44 } : { minH: 44 }}
            px={narrow ? 0 : '$2'}
            py={narrow ? 0 : '$1'}
            gap="$2"
            rounded={narrow ? 12 : '$3'}
            borderWidth={narrow && above ? 1 : 0}
            borderColor={narrow && above ? STRONG : undefined}
            bg={narrow && above ? '$panel' : narrow && hoverOpen ? '$hover' : 'transparent'}
            items="center"
            justify={narrow ? 'center' : 'flex-start'}
            hoverStyle={{ bg: '$hover' }}
            pressStyle={{ bg: '$raised' }}
            focusVisibleStyle={FOCUS_RING}
            cursor="pointer"
            onClick={() => goSettings('account')}
          >
            <Face host={host} size={narrow ? (above ? 32 : 26) : 28} />
            {narrow ? null : (
              <>
                <YStack flex={1} minW={0}>
                  <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$ink" numberOfLines={1} text="start">
                    {who}
                  </Text>
                </YStack>
              </>
            )}
          </XStack>
        </HoverCardTrigger>

        <HoverCardContent
          data-slot="me-hover-card"
          side={narrow && !above ? (rtl ? 'left' : 'right') : 'top'}
          align={narrow && !above ? 'end' : 'start'}
          sideOffset={8}
          bg="var(--popover)"
          borderWidth={1}
          borderColor={STRONG}
          rounded="$5"
          p="$4"
          width={284}
          maxW="calc(100vw - 24px)"
          z="var(--z-popover)"
          boxShadow="var(--shadow-floating)"
        >
          <YStack gap="$3" width="100%">
            {/* 1. Identity + Membership Tier Pill + Full Menu overflow */}
            <XStack items="flex-start" justify="space-between" gap="$2">
              <XStack items="center" gap="$2.5" flex={1} minW={0}>
                <Face host={host} size={34} />
                <YStack flex={1} minW={0} gap={2}>
                  <XStack items="center" gap="$1.5" minW={0}>
                    <Text fontFamily="$body" fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1}>
                      {who}
                    </Text>
                    {tierPill}
                  </XStack>
                  {host.person.email ? (
                    <Text fontFamily="$body" fontSize="$1" color="$aside" numberOfLines={1}>
                      {host.person.email}
                    </Text>
                  ) : null}
                </YStack>
              </XStack>

              <DropdownMenu
                open={menuOpen}
                onOpenChange={(next) => {
                  setMenuOpen(next)
                  if (next) return
                  setAccount(false)
                  setOrgsOpen(false)
                  setLang(false)
                  setHelp(false)
                }}
                placement={rtl ? 'bottom-start' : 'bottom-end'}
                offset={6}
              >
                <DropdownMenuTrigger asChild>
                  <XStack
                    render={<button type="button" />}
                    data-slot="me-more"
                    aria-label={t('More account options')}
                    width={28}
                    height={28}
                    $max-sm={{ width: 44, height: 44 }}
                    rounded="$2"
                    items="center"
                    justify="center"
                    cursor="pointer"
                    borderWidth={1}
                    borderColor={menuOpen ? STRONG : 'transparent'}
                    bg={menuOpen ? '$hover' : 'transparent'}
                    hoverStyle={{ bg: '$hover', borderColor: STRONG }}
                    focusVisibleStyle={FOCUS_RING}
                  >
                    <MoreHorizontal size={15} color={SOFT} aria-hidden />
                  </XStack>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  minW={250}
                  maxW="calc(100vw - 24px)"
                  bg="var(--popover)"
                  borderWidth={1}
                  borderColor={STRONG}
                  aria-labelledby={undefined}
                  aria-label={t('Account')}
                  onCloseAutoFocus={back}
                >
                  <DropdownMenuSub open={account} onOpenChange={setAccount}>
                    <DropdownMenuSubTrigger minH={44} gap="$2.5" data-slot="me-account">
                      <Face host={host} size={26} />
                      <YStack flex={1} minW={0}>
                        <SizableText size="$2" fontWeight="600" color="$ink" numberOfLines={1}>
                          {who}
                        </SizableText>
                        <SizableText size="$1" color="$soft" numberOfLines={1}>
                          {host.person.email || working}
                        </SizableText>
                      </YStack>
                    </DropdownMenuSubTrigger>
                    {account ? (
                      <DropdownMenuSubContent
                        minW={230}
                        maxW="calc(100vw - 24px)"
                        bg="var(--popover)"
                        borderWidth={1}
                        borderColor={STRONG}
                        pointerEvents="auto"
                      >
                        <DropdownMenuItem onSelect={() => goSettings('account')}>
                          <Line icon={<CircleUserRound size={16} aria-hidden />}>{t('Profile')}</Line>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => goSettings('personalization')}>
                          <Line icon={<Palette size={16} aria-hidden />}>{t('Personalization')}</Line>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => goSettings('account')}>
                          <Line icon={<Settings size={16} aria-hidden />}>{t('Settings')}</Line>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => window.location.assign(site('/beta'))}>
                          <Line icon={<FlaskConical size={16} aria-hidden />}>{t('Beta')}</Line>
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    ) : null}
                  </DropdownMenuSub>

                  {others.map((a) => {
                    const { title, line } = accountLabel(a)
                    return (
                      <DropdownMenuItem key={a.sub} data-slot="me-switch" onSelect={() => void signedIn.switchTo(a)}>
                        <Line icon={<CircleUserRound size={16} aria-hidden />} sub={line || undefined}>
                          {title}
                        </Line>
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuItem data-slot="me-add" onSelect={() => void signedIn.add()}>
                    <Line icon={<UserPlus size={16} aria-hidden />}>{t('Add account')}</Line>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />

                  <DropdownMenuSub open={orgsOpen} onOpenChange={setOrgsOpen}>
                    <DropdownMenuSubTrigger data-slot="me-orgs">
                      <Line icon={<Mark org={here ?? all[0]} />} trail={<Check size={16} aria-label={t('Current')} />}>
                        {t('{org} · {plan}', { org: (here ? (here.personal ? t('Personal') : here.display) : currentOrg), plan: planName || t('No plan') })}
                      </Line>
                    </DropdownMenuSubTrigger>
                    {orgsOpen ? (
                      <DropdownMenuSubContent
                        minW={250}
                        maxW="calc(100vw - 24px)"
                        bg="var(--popover)"
                        borderWidth={1}
                        borderColor={STRONG}
                        pointerEvents="auto"
                      >
                        <DropdownMenuLabel>{t('Organizations')}</DropdownMenuLabel>
                        {all.map((o) => (
                          <DropdownMenuItem key={o.name} onSelect={() => o.name !== currentOrg && onOrg(o.name)}>
                            <Line
                              icon={<Mark org={o} />}
                              sub={[o.personal ? t('Personal') : said(o.role, t), planFor(o) || (isFree && o.personal ? t('Free') : '')].filter(Boolean).join(' - ')}
                              trail={o.name === currentOrg ? <Check size={16} aria-label={t('Current')} /> : null}
                            >
                              {o.display}
                            </Line>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem onSelect={() => setCreating(true)}>
                          <Line icon={<Plus size={16} aria-hidden />}>{t('Create organization')}</Line>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => out(site(settings('organization')))}>
                          <Line icon={<Settings size={16} aria-hidden />}>{t('Organization settings')}</Line>
                        </DropdownMenuItem>
                        {where().team ? null : here && !here.personal ? (
                          <DropdownMenuItem onSelect={() => out(`${ENTRY}&org=${encodeURIComponent(here.name)}`)}>
                            <Line icon={<Users size={16} aria-hidden />} trail={<ArrowUpRight size={14} color="var(--text-tertiary)" aria-hidden />}>{t('Open in Hanzo Team')}</Line>
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => setCreating(true)}>
                            <Line icon={<Users size={16} aria-hidden />}>{t('Create a team')}</Line>
                          </DropdownMenuItem>
                        )}
                        {superAdmin() ? (
                          <DropdownMenuItem onSelect={choose}>
                            <Line icon={<Building2 size={16} aria-hidden />}>{t('All organizations')}</Line>
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuSubContent>
                    ) : null}
                  </DropdownMenuSub>

                  <DropdownMenuItem onSelect={() => goSettings('usage')}>
                    <Line icon={<Activity size={16} aria-hidden />}>{t('Usage')}</Line>
                  </DropdownMenuItem>
                  <DropdownMenuItem aria-keyshortcuts="Control+, Meta+," onSelect={() => goSettings('account')}>
                    <Line icon={<Settings size={16} aria-hidden />} trail={<DropdownMenuShortcut aria-hidden><bdi dir="ltr">{apple ? '⌘,' : 'Ctrl+,'}</bdi></DropdownMenuShortcut>}>{t('Settings')}</Line>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={triggerUpgrade}>
                    <Line icon={<Sparkles size={16} aria-hidden />}>{t(plans)}</Line>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />

                  <DropdownMenuSub
                    open={lang}
                    onOpenChange={(next) => {
                      setLang(next)
                      if (!next) setLangQuery('')
                    }}
                  >
                    <DropdownMenuSubTrigger>
                      <Line icon={<Languages size={16} aria-hidden />}>{t('Language')}</Line>
                    </DropdownMenuSubTrigger>
                    {lang ? (
                      <DropdownMenuSubContent
                        minW={220}
                        maxW="calc(100vw - 24px)"
                        bg="var(--popover)"
                        borderWidth={1}
                        borderColor={STRONG}
                        pointerEvents="auto"
                      >
                        <XStack px="$2" pt="$1.5" pb="$1">
                          <SizableText
                            render={
                              <input
                                type="search"
                                value={langQuery}
                                onChange={(e) => setLangQuery(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                                placeholder={t('Search language...')}
                                aria-label={t('Search language')}
                              />
                            }
                            width="100%"
                            height={32}
                            px="$2.5"
                            rounded="$2"
                            borderWidth={1}
                            borderColor={STRONG}
                            bg="$panel"
                            color="$ink"
                            focusVisibleStyle={FOCUS_RING}
                            size="$2"
                          />
                        </XStack>
                        <YStack maxH={260} overflowY="auto">
                          {locales
                            .filter((l) => !l.review || l.code === locale)
                            .filter((l) => {
                              const q = langQuery.trim().toLowerCase()
                              if (!q) return true
                              return (
                                l.name.toLowerCase().includes(q) ||
                                l.englishName.toLowerCase().includes(q) ||
                                l.code.toLowerCase().includes(q)
                              )
                            })
                            .map((l) => (
                              <DropdownMenuItem key={l.code} onSelect={() => void setLocale(l.code)}>
                                <Line trail={l.code === locale ? <Check size={16} aria-label={t('Current')} /> : null}>
                                  {l.englishName !== l.name ? `${l.name} (${l.englishName})` : l.name}
                                </Line>
                              </DropdownMenuItem>
                            ))}
                        </YStack>
                      </DropdownMenuSubContent>
                    ) : null}
                  </DropdownMenuSub>

                  <DropdownMenuSub open={help} onOpenChange={setHelp}>
                    <DropdownMenuSubTrigger>
                      <Line icon={<LifeBuoy size={16} aria-hidden />}>{t('Help')}</Line>
                    </DropdownMenuSubTrigger>
                    {help ? (
                      <DropdownMenuSubContent
                        minW={240}
                        maxW="calc(100vw - 24px)"
                        bg="var(--popover)"
                        borderWidth={1}
                        borderColor={STRONG}
                        pointerEvents="auto"
                      >
                        {pages().map((p) => (
                          <DropdownMenuItem key={p.key} onSelect={() => out(p.href)}>
                            <Line icon={ICONS[p.key]} trail={p.key === 'help' ? <ArrowUpRight size={14} color="var(--text-tertiary)" aria-hidden /> : null}>
                              {t(p.label)}
                            </Line>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem aria-keyshortcuts="Control+/ Meta+/" onSelect={() => setKeys(true)}>
                          <Line icon={<Keyboard size={16} aria-hidden />} trail={<DropdownMenuShortcut aria-hidden><bdi dir="ltr">{apple ? '⌘/' : 'Ctrl+/'}</bdi></DropdownMenuShortcut>}>{t('Keyboard shortcuts')}</Line>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={reportProblem}>
                          <Line icon={<Bug size={16} aria-hidden />}>{t('Report a problem')}</Line>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {legal().map((p) => (
                          <DropdownMenuItem key={p.key} onSelect={() => out(p.href)}>
                            <Line icon={ICONS[p.key]}>{t(p.label)}</Line>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    ) : null}
                  </DropdownMenuSub>

                  {/* Drawn only while there is a "Don't ask again" to take back: a row that does nothing is not drawn. */}
                  {trusts() ? (
                    <DropdownMenuItem data-slot="me-ask-again" onSelect={forget}>
                      <Line icon={<RotateCcw size={16} aria-hidden />}>{t('Ask me again before spending')}</Line>
                    </DropdownMenuItem>
                  ) : null}
                  {several && signedIn.current ? (
                    // The menu stays open while it signs out, so the row pressed can say so.
                    <DropdownMenuItem
                      data-slot="me-leave"
                      preventCloseOnSelect
                      disabled={signingOut}
                      onSelect={() => {
                        setPressed('one')
                        void signedIn.leave(signedIn.current!)
                      }}
                    >
                      <Line icon={<LogOut size={16} aria-hidden data-i18n-mirror />}>
                        {leaving('one') ? t('Signing out…') : t('Sign out {name}', { name: accountLabel(signedIn.current).title })}
                      </Line>
                    </DropdownMenuItem>
                  ) : null}
                  {host.signOut ? (
                    <DropdownMenuItem
                      data-slot="me-log-out"
                      preventCloseOnSelect
                      disabled={signingOut}
                      onSelect={() => {
                        setPressed('all')
                        host.signOut?.()
                      }}
                    >
                      <Line icon={<LogOut size={16} aria-hidden data-i18n-mirror />}>
                        {leaving('all') ? t('Signing out…') : several ? t('Sign out of all accounts') : t('Log out')}
                      </Line>
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </XStack>

            {/* 2. Key Stats: live session/weekly usage & credit balance */}
            <YStack
              data-slot="me-stats"
              role="button"
              tabIndex={0}
              aria-label={t('Usage')}
              rounded="$3"
              bg="$panel"
              borderWidth={1}
              borderColor={STRONG}
              cursor="pointer"
              hoverStyle={{ bg: '$hover' }}
              focusVisibleStyle={FOCUS_RING}
              onPress={() => goSettings('usage')}
              onKeyDown={(e: { key?: string; preventDefault?: () => void }) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault?.()
                  goSettings('usage')
                }
              }}
            >
              <Meter
                read={liveRead}
                onPlans={triggerUpgrade}
                onBilling={() => goSettings('billing')}
              />
            </YStack>

            {/* 3. Developer mode inline toggle */}
            <XStack
              data-slot="me-dev-row"
              items="center"
              justify="space-between"
              gap="$2"
              minH={40}
              $max-sm={{ minH: 44 }}
              px="$2.5"
              py="$2"
              rounded="$3"
              bg="$panel"
              borderWidth={1}
              borderColor="$edge"
            >
              <XStack items="center" gap="$1.5" minW={0} flex={1}>
                <Text fontFamily="$body" fontSize="$2" fontWeight="500" color="$ink" numberOfLines={1}>
                  {t('Developer mode')}
                </Text>
                <InfoHint text={t('Shows the process: the terminal, the commands Hanzo runs and each step. Off, Hanzo shows the result.')} />
              </XStack>
              <Switch
                size="sm"
                checked={devMode}
                onCheckedChange={setDevMode}
                aria-label={t('Developer mode')}
                data-slot="me-dev-mode"
              />
            </XStack>

            <XStack height={1} bg="$edge" width="100%" />

            {/* 4. Subtle footer actions */}
            <YStack gap="$0.5">
              {isFree ? (
                <XStack
                  render={<button type="button" />}
                  data-slot="me-hover-upgrade"
                  onClick={triggerUpgrade}
                  items="center"
                  gap="$2"
                  minH={36}
                  $max-sm={{ minH: 44 }}
                  px="$2.5"
                  py="$1.5"
                  rounded="$3"
                  cursor="pointer"
                  bg="$raised"
                  borderWidth={1}
                  borderColor={STRONG}
                  hoverStyle={{ bg: '$hover' }}
                  focusVisibleStyle={FOCUS_RING}
                >
                  <Sparkles size={14} color={INK} aria-hidden />
                  <Text
                    fontFamily="$body"
                    fontSize="$2"
                    fontWeight="600"
                    color="$ink"
                    flex={1}
                    text="start"
                  >
                    {t('Upgrade plan')}
                  </Text>
                </XStack>
              ) : null}

              <XStack
                render={<button type="button" />}
                data-slot="me-hover-settings"
                onClick={() => goSettings('account')}
                items="center"
                gap="$2"
                minH={34}
                $max-sm={{ minH: 44 }}
                px="$2"
                py="$1.5"
                rounded="$3"
                cursor="pointer"
                bg="transparent"
                hoverStyle={{ bg: '$hover' }}
                focusVisibleStyle={FOCUS_RING}
              >
                <Settings size={14} color={INK} aria-hidden />
                <Text fontFamily="$body" fontSize="$2" color="$ink" flex={1} text="start">
                  {t('Open settings')}
                </Text>
                <Text fontFamily="$mono" fontSize="$1" color="$aside">
                  <bdi dir="ltr">{apple ? '⌘,' : 'Ctrl+,'}</bdi>
                </Text>
              </XStack>

              {all.length > 1 ? (
                <YStack gap="$0.5">
                  <XStack
                    render={<button type="button" />}
                    data-slot="me-hover-workspaces"
                    aria-expanded={workspacesOpen}
                    onClick={() => setWorkspacesOpen((v) => !v)}
                    items="center"
                    gap="$2"
                    minH={34}
                    $max-sm={{ minH: 44 }}
                    px="$2"
                    py="$1.5"
                    rounded="$3"
                    cursor="pointer"
                    bg="transparent"
                    hoverStyle={{ bg: '$hover' }}
                    focusVisibleStyle={FOCUS_RING}
                  >
                    <Building2 size={14} color={INK} aria-hidden />
                    <Text fontFamily="$body" fontSize="$2" color="$ink" flex={1} text="start" numberOfLines={1}>
                      {t('Switch workspace')}
                    </Text>
                    {workspacesOpen ? (
                      <ChevronDown size={13} color={SOFT} aria-hidden />
                    ) : (
                      <ChevronRight size={13} color={SOFT} aria-hidden />
                    )}
                  </XStack>
                  {workspacesOpen ? (
                    <YStack pl="$4" gap="$0.5">
                      {all.map((o) => (
                        <XStack
                          key={o.name}
                          render={<button type="button" />}
                          onClick={() => {
                            if (o.name !== currentOrg) {
                              setHoverOpen(false)
                              onOrg(o.name)
                            }
                          }}
                          items="center"
                          gap="$2"
                          minH={32}
                          $max-sm={{ minH: 44 }}
                          px="$2"
                          py="$1"
                          rounded="$2"
                          cursor="pointer"
                          bg={o.name === currentOrg ? '$hover' : 'transparent'}
                          hoverStyle={{ bg: '$hover' }}
                          focusVisibleStyle={FOCUS_RING}
                        >
                          <Mark org={o} />
                          <Text fontFamily="$body" fontSize="$1" color="$ink" flex={1} text="start" numberOfLines={1}>
                            {o.personal ? t('Personal') : o.display}
                          </Text>
                          {o.name === currentOrg ? <Check size={12} color={INK} aria-hidden /> : null}
                        </XStack>
                      ))}
                    </YStack>
                  ) : null}
                </YStack>
              ) : null}

              {host.signOut ? (
                <XStack
                  render={<button type="button" />}
                  data-slot="me-hover-logout"
                  disabled={signingOut}
                  aria-disabled={signingOut || undefined}
                  onClick={() => {
                    setPressed('hover')
                    host.signOut?.()
                  }}
                  items="center"
                  gap="$2"
                  minH={34}
                  $max-sm={{ minH: 44 }}
                  px="$2"
                  py="$1.5"
                  rounded="$3"
                  cursor="pointer"
                  bg="transparent"
                  hoverStyle={{ bg: '$hover' }}
                  focusVisibleStyle={FOCUS_RING}
                >
                  <LogOut size={14} color={SOFT} aria-hidden data-i18n-mirror />
                  <Text fontFamily="$body" fontSize="$2" color="$aside" flex={1} text="start">
                    {leaving('hover') ? t('Signing out…') : t('Log out')}
                  </Text>
                </XStack>
              ) : null}
            </YStack>
          </YStack>
        </HoverCardContent>
      </HoverCard>
      <Create open={creating} onOpenChange={setCreating} />
      <Shortcuts open={keys} onOpenChange={setKeys} apple={apple} />
    </>
  )
}

/** Split a printed shortcut into discrete keycap tokens: `⌘⇧O` → `['⌘','⇧','O']`, `Ctrl+Shift+O` → `['Ctrl','Shift','O']`. */
function splitShortcut(combo: string): string[] {
  if (combo.includes('+')) return combo.split('+').filter(Boolean)
  const mods: string[] = []
  let rest = combo
  while (rest.length > 1 && /^[⌘⌃⌥⇧]/.test(rest)) {
    mods.push(rest[0])
    rest = rest.slice(1)
  }
  return rest ? [...mods, rest] : mods
}

const SHORTCUT_GROUPS: readonly KeyGroup[] = ['Navigation', 'Workspace', 'Chat', 'Window']

/** The app's keys (help.ts `KEYS`), categorized with crisp `--border-strong` keycaps for this platform. */
export function Shortcuts({ open, onOpenChange, apple }: { open: boolean; onOpenChange: (open: boolean) => void; apple: boolean }) {
  const { t } = useI18n()
  const sections = useMemo(() => {
    const byGroup = new Map<string, Row[]>()
    for (const k of rows()) byGroup.set(k.group, [...(byGroup.get(k.group) ?? []), k])
    return SHORTCUT_GROUPS.map((g) => ({ group: g, items: byGroup.get(g) ?? [] })).filter((s) => s.items.length > 0)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="shortcuts-dialog"
        width={480}
        maxW="calc(100vw - 24px)"
        maxH="82dvh"
        bg="var(--popover)"
        borderWidth={1}
        borderColor={STRONG}
        rounded="$6"
        gap="$3"
        overflow="hidden"
      >
        <YStack gap="$1" shrink={0}>
          <DialogTitle>{t('Keyboard shortcuts')}</DialogTitle>
          <SizableText size="$2" color="$quiet">
            {t('Global commands and conversation controls.')}
          </SizableText>
        </YStack>
        <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden" gap="$4" pr="$1">
          {sections.map((section) => (
            <YStack key={section.group} gap="$1">
              <SizableText size="$1" fontWeight="600" color="$quiet" pb="$1">
                {t(section.group)}
              </SizableText>
              <YStack rounded="$4" borderWidth={1} borderColor="$edge" bg="$panel" overflow="hidden">
                {section.items.map((k, idx) => {
                  const chords = k.chords.map((c) => splitShortcut(apple ? c.mac : c.pc))
                  return (
                    <XStack
                      key={k.does}
                      items="center"
                      justify="space-between"
                      gap="$3"
                      px="$3"
                      minH={38}
                      $max-sm={{ minH: 44 }}
                      borderTopWidth={idx === 0 ? 0 : 1}
                      borderColor="$edge"
                    >
                      <SizableText size="$2" color="$ink" flex={1} minW={0} numberOfLines={1}>
                        {t(k.does)}
                      </SizableText>
                      <XStack items="center" gap="$1" shrink={0} data-i18n-ltr="">
                        <bdi dir="ltr">
                          <XStack items="center" gap="$2">
                            {chords.map((caps, chi) => (
                              <XStack key={`${k.does}-${chi}`} items="center" gap="$1">
                                {caps.map((cap, ci) => (
                                  <Kbd key={ci} variant="cap">
                                    {cap}
                                  </Kbd>
                                ))}
                              </XStack>
                            ))}
                          </XStack>
                        </bdi>
                      </XStack>
                    </XStack>
                  )
                })}
              </YStack>
            </YStack>
          ))}
        </YStack>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The sheet that creates an organization: a name, then `POST /v1/account/orgs`,
 * the creator's own.
 */
function Create({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState('')
  useEffect(() => {
    if (open) {
      setName('')
      setRefused('')
    }
  }, [open])
  const submit = async () => {
    const words = name.trim()
    if (!words) return setRefused(t('Give it a name.'))
    if (busy) return
    setBusy(true)
    setRefused('')
    try {
      const org = await createOrg(words)
      try {
        sessionStorage.setItem(MADE, JSON.stringify({ org, name: words, from: current() }))
      } catch {
        /* the next load simply says nothing */
      }
      renew()
      reopen(org)
    } catch (e) {
      setRefused(say(e, t))
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        width={440}
        maxW="calc(100vw - 24px)"
        bg="var(--popover)"
        borderWidth={1}
        borderColor={STRONG}
        rounded="$6"
        gap="$3"
      >
        <DialogTitle>{t('Create organization')}</DialogTitle>
        <SizableText size="$2" color="$soft">{t('You own it. Agents, credits and members belong to it, and you switch to it from this menu.')}</SizableText>
        <Input
          autoFocus
          value={name}
          onChangeText={setName}
          aria-label={t('Organization name')}
          placeholder={t('Acme')}
          maxLength={80}
          onKeyDown={(e: { key?: string }) => {
            if (e.key === 'Enter') void submit()
          }}
        />
        {refused ? (
          <SizableText size="$1" color={BAD} role="alert">
            {refused}
          </SizableText>
        ) : null}
        <XStack gap="$2" justify="flex-end">
          <Button size="sm" variant="outline" borderColor={STRONG} rounded={999} onPress={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button size="sm" variant="primary" tone="accent" rounded={999} disabled={busy || !name.trim()} onPress={() => void submit()}>
            {t(busy ? 'Creating…' : 'Create')}
          </Button>
        </XStack>
      </DialogContent>
    </Dialog>
  )
}

/**
 * What became of an organization this tab created: nothing to say once the token
 * carries it (the app is already in it), and a plain line while it does not.
 */
export function Made() {
  const { t } = useI18n()
  const [made, setMade] = useState<{ org: string; name: string } | null>(null)
  useEffect(() => {
    try {
      const kept = JSON.parse(sessionStorage.getItem(MADE) || 'null') as { org?: string; name?: string; from?: string | null } | null
      if (!kept?.org) return
      if (orgs().includes(kept.org)) return sessionStorage.removeItem(MADE)
      if (kept.from && current() !== kept.from && orgs().includes(kept.from)) {
        return reopen(kept.from)
      }
      setMade({ org: kept.org, name: kept.name || kept.org })
    } catch {
      /* nothing kept */
    }
  }, [])
  if (!made) return null
  const dismiss = () => {
    try {
      sessionStorage.removeItem(MADE)
    } catch {
      /* gone with the tab */
    }
    setMade(null)
  }
  return (
    <XStack data-slot="made" role="status" items="flex-start" gap="$2" px="$3" py="$2.5" rounded="$5" borderWidth={1} borderColor={STRONG} bg="$panel">
      <SizableText flex={1} minW={0} size="$1" color="$ink">
        {t('{name} was created, and your sign-in does not include it yet, so you are still in this organization. It appears here once IAM adds you to it.', { name: made.name })}
      </SizableText>
      <XStack
        render={<button type="button" />}
        aria-label={t('Dismiss')}
        onClick={dismiss}
        p="$1"
        rounded={999}
        cursor="pointer"
        hoverStyle={{ bg: '$hover' }}
        focusVisibleStyle={FOCUS_RING}
      >
        <X size={13} color={SOFT} aria-hidden />
      </XStack>
    </XStack>
  )
}
