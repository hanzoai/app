'use client'

// The account row and the menu it opens: the one account menu. The app's rail
// draws it for Chat, Dev and Studio (Rail.tsx) and the shell's sidebar for every
// other app (Shell.tsx).
//
// Top to bottom: who, with their plan, a row whose › opens the account itself;
// then Upgrade plan, Personalization, Profile and Settings (⌘, / Ctrl+,); Beta,
// the person's place on the beta waitlist (the site's /beta/status); then
// Help ›, the site's own pages and the keyboard shortcuts (⌘/ / Ctrl+/ from
// anywhere); and Log out. Every row opens a real destination: Settings'
// pages through `showSettings` (open.ts), which the app answers with the
// site's Settings at /settings (App.tsx) and the shell with its own pane; the plans on the
// pay site (`leave`); the site's pages through `site()`, so hanzo.team names
// hanzo.ai (help.ts).
//
// THE ACCOUNT'S › LEADS WITH THE PLAN: @hanzo/build's `Meter`, the plan by its
// family (`Max` with `20x` beside it) and, on a plan, its windows as shares; the
// free allowance left today on Free; the balance only for an account with no
// plan, whose meter it is. Then every organization the token names — the
// personal one first, with its plan — switched with `onOrg`; Create
// organization, Organization settings, and Hanzo Team (opened in the same
// organization for a team, offered as "Create a team" for a personal one); and
// All organizations for a SuperAdmin, which opens the chooser (Gate.tsx).
//
// Its words go through `t`; names, plans, addresses and keys are drawn as they
// are, a key isolated left to right so its `+` and `,` keep their places in a
// right-to-left menu, which opens toward the content from the rail's side.
//
// IAM is the source of every fact here: names and roles from the token's `orgs`
// claim, display names and which org is personal from `GET /v1/iam/organizations`,
// the plan from billing and the limits. An organization is created by the same
// `POST /v1/account/orgs` the no-organization gate uses (Gate.tsx); the next load
// mints a token that carries it.

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
  ChevronsUpDown,
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
  Palette,
  Plus,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
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
  Input,
  Kbd,
} from '@hanzo/ui'
import { api } from './lib/api'
import { createOrg, say } from './lib/org'
import type { Tier } from './lib/tier'
import { list } from './lib/list'
import { choose, org as current, orgs, pick, renew, scope, superAdmin } from './lib/session'
import { ENTRY, settings } from './lib/host'
import { leave } from './dev'
import { payUrl } from './lib/pay'
import { asked, KEYS, legal, out, pages } from './help'
import { showSettings } from './open'
import { site, where } from './where'
import { BAD } from './lib/mix'

/** An organization this tab created, until the token carries it. */
const MADE = 'hanzo:org:made'

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

/** A role as a person reads it: `owner` → Owner; one IAM names that these do not, capitalised as it comes. */
const said = (role: string, t: (source: string) => string): string =>
  ROLES[role] ? t(ROLES[role]) : role ? role.charAt(0).toUpperCase() + role.slice(1) : ''

/** The first letters of a name, at most two: Antje Worring → AW. */
export const initials = (name: string): string =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?'

/** The plan by its family, `Max 20x`, from a tier answer; '' with no plan. */
const planOf = (tier: Tier | null): string => (tier ? spoken(label(tier.plan, tier.tier?.name)) : '')

/**
 * The token's organizations with IAM's rows beside them: display name, and which
 * one is the person's own. The personal organization leads, then the token's order.
 */
function useOrgs(current: string | null): Org[] {
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
  }, [key, current])
  const drawn = names.map((name) => {
    const row = rows.find((r) => r?.name === name)
    return { name, display: row?.displayName || name, personal: Boolean(row?.isPersonal), role: roles?.[name] ?? '' }
  })
  return [...drawn.filter((o) => o.personal), ...drawn.filter((o) => !o.personal)]
}

/** The plan of an organization other than the current one: billing, asked in its name. */
function usePlan(org: string | null, enabled: boolean): string {
  const [plan, setPlan] = useState('')
  useEffect(() => {
    if (!enabled || !org) return
    const stop = new AbortController()
    fetch(`${api()}/v1/billing/tier`, { headers: { ...scope(), 'X-Org-Id': org }, signal: stop.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((t: Tier | null) => {
        if (!stop.signal.aborted) setPlan(planOf(t))
      })
      .catch(() => {})
    return () => stop.abort()
  }, [org, enabled])
  return plan
}

/** The person's picture, or their initials. */
export function Face({ host, size = 28 }: { host: Who; size?: number }) {
  const p = host.person
  return (
    <XStack width={size} height={size} rounded={9999} items="center" justify="center" bg="$raised" overflow="hidden" shrink={0} borderWidth={1} borderColor="$borderColor">
      {p?.avatar ? (
        <img src={p.avatar} alt="" width={size} height={size} />
      ) : (
        <SizableText size="$1" fontWeight="600" color="$ink">
          {initials(p?.name || p?.email || '')}
        </SizableText>
      )}
    </XStack>
  )
}

/** A row's face: its icon in a 16px well, its words, and what trails them. */
function Line({ icon, children, sub, trail }: { icon?: ReactNode; children: string; sub?: string; trail?: ReactNode }) {
  return (
    <>
      {icon !== undefined ? (
        <XStack width={16} height={16} items="center" justify="center" shrink={0}>
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
  <XStack width={16} height={16} rounded="$2" items="center" justify="center" bg="$raised" shrink={0}>
    {org.personal ? (
      <SizableText size="$1" fontWeight="600" color="$ink">
        {initials(org.display).charAt(0)}
      </SizableText>
    ) : (
      <Building2 size={12} aria-hidden />
    )}
  </XStack>
)

/**
 * The plans row, named by the plan the organization is on: Enterprise and
 * Agency are plans a person stays on, so the row names theirs; every other
 * plan, Free included, is one to move up from.
 */
export const upgrade = (family: string | null | undefined): string =>
  family === 'Enterprise' ? phrase('Enterprise plan') : family === 'Agency' ? phrase('Agency plan') : phrase('Upgrade plan')

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
  /** The rail's: the face alone, the menu opening beside it. */
  narrow?: boolean
  /**
   * The menu opens above the face, not beside it: the foot of a phone's menu
   * (Drawer.tsx). That copy leaves ⌘/ to the rail's own, so one press opens one dialog.
   */
  above?: boolean
  /** Work in another organization: picked, then the app opened in it. */
  onOrg: (org: string) => void
  defaultAccountOpen?: boolean
}) {
  const { t, dir, locale, setLocale } = useI18n()
  const rtl = dir === 'rtl'
  const [open, setOpen] = useState(false)
  const [account, setAccount] = useState(defaultAccountOpen ?? false)
  const [orgs, setOrgs] = useState(false)
  const [lang, setLang] = useState(false)
  const [langQuery, setLangQuery] = useState('')
  const [help, setHelp] = useState(false)
  const [creating, setCreating] = useState(false)
  const [keys, setKeys] = useState(false)
  const row = useRef<HTMLElement | null>(null)
  const current = host.org
  const all = useOrgs(current)
  const here = all.find((o) => o.name === current) ?? null
  const personal = all.find((o) => o.personal) ?? null
  const target = useMemo(() => ({ api: host.api, token: host.token, org: host.org }), [host.api, host.token, host.org])
  const read = useStanding(target, open)
  const other = usePlan(personal && personal.name !== current ? personal.name : null, open)
  // THE TWO ACCOUNTS, apart: the organization's plan (hanzo · Enterprise) and the
  // person's own (Personal · Pro, or none and the way to one). A business plan is
  // the organization's; a personal plan is held beside it, never instead of it.
  const team = here && !here.personal ? here : (all.find((o) => !o.personal) ?? null)
  const teamOther = usePlan(team && team.name !== current ? team.name : null, open)
  const planFor = (o: Org) => (o.name === current ? spoken(read.value?.label ?? null) : o.personal ? other : '')
  const who = host.person?.name || host.person?.email || ''
  const plan = spoken(read.value?.label ?? null)
  const teamPlan = team ? (team.name === current ? plan : teamOther) : ''
  const ownPlan = personal ? (personal.name === current ? plan : other) : ''
  const isFree = !read.value?.label?.name || read.value?.label?.name?.toLowerCase() === 'free'
  const planName = plan || (isFree ? t('Free') : '')
  // Where the reader works, and on what: "hanzo - Enterprise", "Personal - Pro", "Personal - Free".
  const working = [here ? (here.personal ? t('Personal') : here.display) : current, planName].filter(Boolean).join(' - ')
  // A personal plan is bought for the personal organization, beside any business one.
  // The plans row's name (a phrase of `upgrade`'s).
  const plans = upgrade(read.value?.label?.name)
  const getPro = () => (personal ? window.location.assign(payUrl('/cart', { org: personal.name, returnUrl: window.location.href })) : window.location.assign(payUrl('/cart', { returnUrl: window.location.href })))
  const apple = mac()

  useEffect(() => {
    if (above) return
    const press = (e: KeyboardEvent) => {
      if (!asked(e)) return
      e.preventDefault()
      setOpen(false)
      setKeys(true)
    }
    window.addEventListener('keydown', press)
    return () => window.removeEventListener('keydown', press)
  }, [above])

  // Focus goes back to the row only when nothing the menu opened (a dialog) took it.
  const back = (e: Event) => {
    e.preventDefault()
    requestAnimationFrame(() => {
      const now = document.activeElement
      if (!now || now === document.body) row.current?.focus()
    })
  }

  if (!host.person) return null
  return (
    <>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next) return
          setAccount(false)
          setOrgs(false)
          setLang(false)
          setHelp(false)
        }}
        // Toward the content from the rail, and aligned as the row's own edge is: mirrored right to left.
        placement={narrow && !above ? (rtl ? 'left-end' : 'right-end') : above !== rtl ? 'top-end' : 'top-start'}
        // Clear of the rail's mark (or the row) it opens from, and flush with its foot.
        offset={8}
      >
        <DropdownMenuTrigger asChild>
          <XStack
            ref={(el: unknown) => {
              row.current = el instanceof HTMLElement ? el : null
            }}
            render="button"
            data-slot="me"
            // The name the gates and a screen reader know it by: who, and in which organization.
            aria-label={t('Account: {name}', { name: [who, current].filter(Boolean).join(' · ') })}
            {...({ title: who } as object)}
            width={narrow ? (above ? 44 : 36) : '100%'}
            minH={narrow ? (above ? 44 : 36) : 48}
            // A thumb's 44 on a touch screen.
            $touchable={narrow ? { width: 44, minH: 44 } : undefined}
            px={narrow ? 0 : '$2'}
            gap="$2.5"
            rounded={narrow ? 999 : '$5'}
            borderWidth={narrow && above ? 1 : 0}
            borderColor={narrow && above ? 'var(--border-strong)' : undefined}
            bg={narrow && above ? 'var(--pane-fill)' : undefined}
            items="center"
            justify={narrow ? 'center' : 'flex-start'}
            hoverStyle={{ bg: '$hover' }}
            focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
            cursor="pointer"
          >
            <Face host={host} size={narrow ? (above ? 32 : 26) : 32} />
            {narrow ? null : (
              <>
                <YStack flex={1} minW={0}>
                  <SizableText size="$3" fontWeight="600" color="$ink" numberOfLines={1} text="start">
                    {who}
                  </SizableText>
                  {working ? (
                    <SizableText size="$1" color="$soft" numberOfLines={1} text="start">
                      {working}
                    </SizableText>
                  ) : null}
                </YStack>
                {isFree ? (
                  <Button
                    size="xs"
                    variant="outline"
                    data-slot="me-upgrade"
                    px="$2"
                    py="$0.5"
                    rounded="$3"
                    onPress={(e) => {
                      e?.stopPropagation?.()
                      getPro()
                    }}
                    cursor="pointer"
                  >
                    {t('Upgrade plan')}
                  </Button>
                ) : null}
                <ChevronsUpDown size={14} aria-hidden opacity={0.6} />
              </>
            )}
          </XStack>
        </DropdownMenuTrigger>
        <DropdownMenuContent minW={260} maxW="calc(100vw - 16px)" aria-labelledby={undefined} aria-label={t('Account')} onCloseAutoFocus={back}>
          {/* 1. Account Options collapsed into the account icon */}
          <DropdownMenuSub open={account} onOpenChange={setAccount}>
            <DropdownMenuSubTrigger minH={48} gap="$2.5" data-slot="me-account">
              <Face host={host} size={28} />
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
              <DropdownMenuSubContent minW={240} maxW="calc(100vw - 16px)" pointerEvents="auto">
                <Meter read={read} onPlans={() => leave('here')} onBilling={() => (setOpen(false), showSettings('billing'))} />
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => showSettings('account')}>
                  <Line icon={<CircleUserRound size={16} aria-hidden />}>{t('Profile')}</Line>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => showSettings('general')}>
                  <Line icon={<Palette size={16} aria-hidden />}>{t('Personalization')}</Line>
                </DropdownMenuItem>
                <DropdownMenuItem aria-keyshortcuts="Control+, Meta+," onSelect={() => showSettings('general')}>
                  <Line icon={<Settings size={16} aria-hidden />} trail={<DropdownMenuShortcut aria-hidden><bdi dir="ltr">{apple ? '⌘,' : 'Ctrl+,'}</bdi></DropdownMenuShortcut>}>{t('Settings')}</Line>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => window.location.assign(site('/beta'))}>
                  <Line icon={<FlaskConical size={16} aria-hidden />}>{t('Beta')}</Line>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            ) : null}
          </DropdownMenuSub>

          {/* 2. Organization Switcher */}
          <DropdownMenuSub open={orgs} onOpenChange={setOrgs}>
            <DropdownMenuSubTrigger data-slot="me-orgs">
              <Line icon={<Mark org={here ?? all[0]} />} trail={<Check size={16} aria-label={t('Current')} />}>
                {t('{org} · {plan}', { org: (here ? (here.personal ? t('Personal') : here.display) : current), plan: planName || t('No plan') })}
              </Line>
            </DropdownMenuSubTrigger>
            {orgs ? (
              <DropdownMenuSubContent minW={260} maxW="calc(100vw - 16px)" pointerEvents="auto">
                <DropdownMenuLabel>{t('Organizations')}</DropdownMenuLabel>
                {all.map((o) => (
                  <DropdownMenuItem key={o.name} onSelect={() => o.name !== current && onOrg(o.name)}>
                    <Line
                      icon={<Mark org={o} />}
                      sub={[o.personal ? t('Personal') : said(o.role, t), planFor(o) || (isFree && o.personal ? t('Free') : '')].filter(Boolean).join(' - ')}
                      trail={o.name === current ? <Check size={16} aria-label={t('Current')} /> : null}
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
                    <Line icon={<Users size={16} aria-hidden />} trail={<ArrowUpRight size={14} aria-hidden opacity={0.6} />}>{t('Open in Hanzo Team')}</Line>
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

          <DropdownMenuItem onSelect={() => showSettings('usage')}>
            <Line icon={<Activity size={16} aria-hidden />}>{t('Usage')}</Line>
          </DropdownMenuItem>

          {/* 3. Upgrade / Plan */}
          <DropdownMenuItem onSelect={() => leave('here')}>
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
              <DropdownMenuSubContent minW={220} maxW={260} pointerEvents="auto">
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
                    height={30}
                    px="$2.5"
                    rounded="$2"
                    borderWidth={1}
                    borderColor="$borderColor"
                    bg="$background"
                    color="$ink"
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
              <DropdownMenuSubContent minW={240} maxW="calc(100vw - 16px)" pointerEvents="auto">
                {pages().map((p) => (
                  <DropdownMenuItem key={p.key} onSelect={() => out(p.href)}>
                    <Line icon={ICONS[p.key]} trail={p.key === 'help' ? <ArrowUpRight size={14} aria-hidden opacity={0.6} /> : null}>
                      {t(p.label)}
                    </Line>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem aria-keyshortcuts="Control+/ Meta+/" onSelect={() => setKeys(true)}>
                  <Line icon={<Keyboard size={16} aria-hidden />} trail={<DropdownMenuShortcut aria-hidden><bdi dir="ltr">{apple ? '⌘/' : 'Ctrl+/'}</bdi></DropdownMenuShortcut>}>{t('Keyboard shortcuts')}</Line>
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
          {host.signOut ? (
            <DropdownMenuItem onSelect={() => host.signOut?.()}>
              <Line icon={<LogOut size={16} aria-hidden data-i18n-mirror />}>{t('Log out')}</Line>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <Create open={creating} onOpenChange={setCreating} />
      <Shortcuts open={keys} onOpenChange={setKeys} apple={apple} />
    </>
  )
}

/** The app's keys (help.ts `KEYS`), one row each, spelled for this platform. */
function Shortcuts({ open, onOpenChange, apple }: { open: boolean; onOpenChange: (open: boolean) => void; apple: boolean }) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxW={440} rounded="$6" gap="$3">
        <DialogTitle>{t('Keyboard shortcuts')}</DialogTitle>
        <YStack gap="$1">
          {KEYS.map((k) => (
            <XStack key={k.does} items="center" justify="space-between" gap="$3" minH={32}>
              <SizableText size="$2" color="$ink">
                {t(k.does)}
              </SizableText>
              <Kbd>
                <bdi dir="ltr">{apple ? k.mac : k.pc}</bdi>
              </Kbd>
            </XStack>
          ))}
        </YStack>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The sheet that creates an organization: a name, then `POST /v1/account/orgs`,
 * the creator's own. The token in hand predates it, so it is renewed and the app
 * reloads in the new organization; `Made` says so if the new token does not carry
 * it yet.
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
      pick(org)
      renew()
      // The app again, where the person is, in the new organization. Not `/`: on
      // hanzo.ai that is the landing for everyone (owner, 2026-10-29), so a
      // person who made an organization from /chat was left on the marketing page.
      window.location.reload()
    } catch (e) {
      setRefused(say(e, t))
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxW={440} rounded="$6" gap="$3">
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
          <Button size="sm" variant="outline" rounded={999} onPress={() => onOpenChange(false)}>{t('Cancel')}</Button>
          <Button size="sm" rounded={999} disabled={busy || !name.trim()} onPress={() => void submit()}>
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
      // Still out of the token: go on working where the person was.
      if (kept.from && current() !== kept.from && orgs().includes(kept.from)) {
        pick(kept.from)
        return window.location.reload()
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
    <XStack data-slot="made" role="status" items="flex-start" gap="$2" px="$3" py="$2.5" rounded="$5" borderWidth={1} borderColor="$borderColor" bg="$edge">
      <SizableText flex={1} minW={0} size="$1" color="$ink">
        {t('{name} was created, and your sign-in does not include it yet, so you are still in this organization. It appears here once IAM adds you to it.', { name: made.name })}
      </SizableText>
      <XStack render="button" aria-label={t('Dismiss')} onPress={dismiss} p="$1" rounded={999} hoverStyle={{ bg: '$hover' }}>
        <X size={13} aria-hidden />
      </XStack>
    </XStack>
  )
}
